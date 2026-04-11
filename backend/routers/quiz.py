from __future__ import annotations

import json
import random
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.database import get_db
from app.deps.auth import get_current_user as get_current_teacher, require_student

from models.topics import Topic
from models.classes import Class
from models.enrollments import Enrollment
from models.quiz_attempts import QuizAttempt
from models.topic_progress import TopicProgress

from app.core.openai_client import get_openai_client as get_client
from app.schemas.quiz import (
    QuizAttemptAnswerStudentRowOut,
    QuizAttemptDetailStudentOut,
    QuizFinishOut,
    QuizOut,
    QuizQuestion,
    QuizSaveFinalIn,
    QuizStartOut,
    QuizSubmitAnswerIn,
    QuizSubmitAnswerOut,
    parse_quiz_json_to_quiz_out,
    quiz_out_to_public,
)
from ai.Quiz.quiz_workflow import evaluate_final_open_answer, generate_quiz, regenerate_quiz

router = APIRouter(prefix="/quiz", tags=["quiz"])

# --- In-memory attempt store (single-instance backend; replace with Redis if scaled out) ---

_cache_lock = threading.Lock()
_attempts: Dict[str, "QuizAttemptRuntime"] = {}


@dataclass
class QuizAttemptRuntime:
    student_id: int
    class_id: int
    topic_id: int
    order: List[str]
    questions_by_id: Dict[str, QuizQuestion]
    answers: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    finished: bool = False
    finish_summary: Optional[QuizFinishOut] = None
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


def _new_attempt_id() -> str:
    return str(uuid.uuid4())


def _require_enrolled_student(
    db: Session, *, class_id: int, student_id: int
) -> None:
    enr = (
        db.query(Enrollment)
        .filter(Enrollment.class_id == class_id, Enrollment.student_id == student_id)
        .first()
    )
    if not enr:
        raise HTTPException(status_code=403, detail="Not enrolled in this class")


def _load_topic_for_student(
    db: Session, *, class_id: int, topic_id: int
) -> Topic:
    topic = (
        db.query(Topic)
        .filter(Topic.id == topic_id, Topic.class_id == class_id, Topic.active == True)
        .first()
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


def _runtime_question_order(questions: List[QuizQuestion]) -> List[QuizQuestion]:
    finals = [q for q in questions if q.type == "final_open"]
    rest = [q for q in questions if q.type != "final_open"]
    random.shuffle(rest)
    return rest + finals


def _normalize_mcq_yesno_answer(raw: str) -> str:
    return (raw or "").strip().upper()


def _get_attempt_locked(attempt_id: str, student_id: int) -> QuizAttemptRuntime:
    state = _attempts.get(attempt_id)
    if not state:
        raise HTTPException(status_code=404, detail="Quiz attempt not found")
    if state.student_id != student_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return state


def _current_question_id(state: QuizAttemptRuntime) -> Optional[str]:
    for qid in state.order:
        if qid not in state.answers:
            return qid
    return None


def _question_max_points(state: QuizAttemptRuntime, qid: str) -> float:
    q = state.questions_by_id.get(qid)
    if not q:
        return 1.0
    return 15.0 if q.type == "final_open" else 1.0


def _compute_finish_summary(attempt_id: str, state: QuizAttemptRuntime) -> QuizFinishOut:
    total = 0.0
    max_score = 0.0
    for qid in state.order:
        max_score += _question_max_points(state, qid)
        row = state.answers.get(qid)
        if row:
            total += float(row.get("score_delta", 0.0))
    return QuizFinishOut(
        attempt_id=attempt_id,
        total_score=total,
        max_score=max_score,
        question_count=len(state.order),
    )


def _coerce_stored_answer_rows(raw: Any) -> List[Dict[str, Any]]:
    """Normalize answers_json from DB: SQLAlchemy JSON vs plain TEXT may be list or str."""
    if raw is None:
        return []
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return []
        try:
            parsed = json.loads(s)
        except json.JSONDecodeError:
            return []
    else:
        parsed = raw
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, dict)]


def _max_score_from_stored_answers(answers_json: List[Dict[str, Any]]) -> float:
    total = 0.0
    for a in answers_json:
        t = a.get("type")
        total += 15.0 if t == "final_open" else 1.0
    return total


def _parse_attempt_db_pk(attempt_id: str) -> int:
    try:
        return int(str(attempt_id).strip(), 10)
    except (TypeError, ValueError):
        raise HTTPException(status_code=404, detail="Quiz attempt not found")


def _build_student_attempt_detail(
    attempt: QuizAttempt,
    basic_quiz_raw: str,
) -> QuizAttemptDetailStudentOut:
    answers_json = _coerce_stored_answer_rows(attempt.answers_json)
    by_id: Dict[str, Dict[str, Any]] = {}
    for row in answers_json:
        qid = str(row.get("question_id", ""))
        if qid:
            by_id[qid] = row

    answer_rows: List[QuizAttemptAnswerStudentRowOut] = []
    raw = (basic_quiz_raw or "").strip()
    quiz_out: Optional[QuizOut] = None
    if raw:
        try:
            quiz_out = parse_quiz_json_to_quiz_out(raw)
        except ValueError:
            quiz_out = None

    if quiz_out:
        for q in quiz_out.questions:
            ans = by_id.get(q.id)
            if not ans:
                continue
            q_type = q.type
            fb = None
            if q_type == "final_open":
                fb_raw = ans.get("feedback")
                fb = (str(fb_raw).strip() if fb_raw is not None else "") or None
            answer_rows.append(
                QuizAttemptAnswerStudentRowOut(
                    question_id=q.id,
                    prompt=q.prompt,
                    type=q_type,
                    student_answer=str(ans.get("answer") or ""),
                    is_correct=bool(ans.get("is_correct")),
                    score_delta=float(ans.get("score_delta") or 0.0),
                    feedback=fb,
                )
            )
    else:
        for ans in answers_json:
            qid = str(ans.get("question_id", ""))
            q_type = ans.get("type")
            if q_type not in ("mcq", "yesno", "final_open"):
                continue
            fb = None
            if q_type == "final_open":
                fb_raw = ans.get("feedback")
                fb = (str(fb_raw).strip() if fb_raw is not None else "") or None
            answer_rows.append(
                QuizAttemptAnswerStudentRowOut(
                    question_id=qid,
                    prompt="",
                    type=q_type,
                    student_answer=str(ans.get("answer") or ""),
                    is_correct=bool(ans.get("is_correct")),
                    score_delta=float(ans.get("score_delta") or 0.0),
                    feedback=fb,
                )
            )

    correct_count = sum(1 for r in answer_rows if r.is_correct)
    incorrect_count = len(answer_rows) - correct_count
    max_score = _max_score_from_stored_answers(answers_json)

    return QuizAttemptDetailStudentOut(
        attempt_id=str(attempt.id),
        finished_at=attempt.finished_at,
        score=float(attempt.score),
        max_score=max_score,
        question_count=len(answers_json),
        duration_sec=int(attempt.duration_sec),
        correct_count=correct_count,
        incorrect_count=incorrect_count,
        answers=answer_rows,
    )


def _persist_finished_attempt(
    db: Session,
    *,
    state: QuizAttemptRuntime,
    summary: QuizFinishOut,
) -> int:
    finished_at = datetime.now(timezone.utc)
    duration_sec = max(
        0,
        int((finished_at - state.started_at).total_seconds()),
    )

    answers_list: List[Dict[str, Any]] = []
    mistakes_list: List[Dict[str, Any]] = []
    for qid in state.order:
        ans = state.answers[qid]
        q = state.questions_by_id[qid]
        item: Dict[str, Any] = {
            "question_id": qid,
            "type": q.type,
            "answer": ans.get("answer_text") or "",
            "is_correct": bool(ans["is_correct"]),
            "score_delta": float(ans["score_delta"]),
            "explanation": ans.get("explanation"),
            "feedback": ans.get("feedback"),
        }
        answers_list.append(item)
        if not item["is_correct"]:
            mistakes_list.append(
                {
                    "question_id": qid,
                    "type": q.type,
                    "answer": item["answer"],
                    "score_delta": item["score_delta"],
                }
            )

    # QuizAttempt.id má Identity() — DB generuje PK; neposílat uuid ani ruční id.
    attempt_row = QuizAttempt(
        student_id=state.student_id,
        class_id=state.class_id,
        topic_id=state.topic_id,
        started_at=state.started_at,
        finished_at=finished_at,
        score=summary.total_score,
        duration_sec=duration_sec,
        answers_json=answers_list,
        mistakes_json=mistakes_list,
    )
    db.add(attempt_row)
    db.flush()

    prog = (
        db.query(TopicProgress)
        .filter(
            TopicProgress.topic_id == state.topic_id,
            TopicProgress.student_id == state.student_id,
        )
        .first()
    )
    if not prog:
        prog = TopicProgress(topic_id=state.topic_id, student_id=state.student_id)
        db.add(prog)
        db.flush()

    prev_count = prog.quiz_attempt_count or 0
    prog.quiz_attempt_count = prev_count + 1
    prog.quiz_last_score = summary.total_score
    prog.quiz_last_finished_at = finished_at
    prev_best = prog.quiz_best_score
    if prev_best is None or summary.total_score > prev_best:
        prog.quiz_best_score = summary.total_score

    return int(attempt_row.id)


class QuizGenerateIn(BaseModel):
    mcq: int = 8
    yesno: int = 4
    final_open: int = 1


class QuizRegenerateIn(BaseModel):
    quiz_json: str
    user_note: str


def _md_to_plain_text(md: str) -> str:
    # pro první verzi stačí "poslat md jako text"
    # později můžeš zlepšit (strip headings, bullets, links...)
    return (md or "").strip()


@router.post("/generate/{class_id}/{topic_id}")
def generate_quiz_for_topic(
    class_id: int,
    topic_id: int,
    payload: QuizGenerateIn,
    db: Session = Depends(get_db),
    teacher=Depends(get_current_teacher),
):
    # 1) načti topic (a ověř, že patří do class_id)
    topic = (
        db.query(Topic)
        .filter(Topic.id == topic_id, Topic.class_id == class_id)
        .first()
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # 2) načti class kvůli grade/subject
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    # (volitelné) auth check: aby učitel neviděl cizí třídu
    if getattr(cls, "teacher_id", None) != getattr(teacher, "id", None):
        raise HTTPException(status_code=403, detail="Forbidden")

    # 3) zdroj pro quiz = teacher_notes_md uložené v DB
    teacher_md = (topic.teacher_notes_md or "").strip()
    if not teacher_md:
        raise HTTPException(
            status_code=400,
            detail="Chybí Teacher Notes v DB. Nejprve ulož finální Teacher Notes.",
        )

    plain_text = _md_to_plain_text(teacher_md)

    # 4) sestav metadata pro prompt
    class_grade = str(cls.grade) if cls.grade is not None else ""
    subject = (cls.subject or "").strip()
    chapter_title = (topic.title or "").strip()

    # 5) zavolej LLM workflow
    client = get_client()
    try:
        quiz_dict = generate_quiz(
            client,
            class_grade=class_grade,
            subject=subject,
            chapter_title=chapter_title,
            plain_text=plain_text,
            mcq=int(payload.mcq),
            yesno=int(payload.yesno),
            final_open=int(payload.final_open),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return quiz_dict


@router.get("/{class_id}/{topic_id}")
def get_final_quiz(
    class_id: int,
    topic_id: int,
    db: Session = Depends(get_db),
    teacher=Depends(get_current_teacher),
):
    topic = (
        db.query(Topic)
        .filter(Topic.id == topic_id, Topic.class_id == class_id)
        .first()
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    return {"basic_quiz": topic.basic_quiz or ""}


@router.post("/{class_id}/{topic_id}/regenerate")
def regenerate_quiz_for_topic(
    class_id: int,
    topic_id: int,
    payload: QuizRegenerateIn,
    db: Session = Depends(get_db),
    teacher=Depends(get_current_teacher),
):
    topic = (
        db.query(Topic)
        .filter(Topic.id == topic_id, Topic.class_id == class_id)
        .first()
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    if getattr(cls, "teacher_id", None) != getattr(teacher, "id", None):
        raise HTTPException(status_code=403, detail="Forbidden")

    if not (payload.user_note or "").strip():
        raise HTTPException(status_code=400, detail="user_note je prázdná.")

    try:
        parse_quiz_json_to_quiz_out(payload.quiz_json)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    client = get_client()
    try:
        quiz_dict = regenerate_quiz(
            client,
            current_quiz_json=payload.quiz_json,
            teacher_comment=payload.user_note,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return quiz_dict


@router.put("/{class_id}/{topic_id}/final")
def save_final_quiz(
    class_id: int,
    topic_id: int,
    payload: QuizSaveFinalIn,
    db: Session = Depends(get_db),
    teacher=Depends(get_current_teacher),
):
    topic = (
        db.query(Topic)
        .filter(Topic.id == topic_id, Topic.class_id == class_id)
        .first()
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    try:
        parse_quiz_json_to_quiz_out(payload.quiz_json)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    topic.basic_quiz = payload.quiz_json
    db.add(topic)
    db.commit()

    return {"ok": True}


# --- Student quiz runtime (in-memory attempts) ---

_FINAL_OPEN_CORRECT_THRESHOLD = 0.65


@router.post("/{class_id}/{topic_id}/start", response_model=QuizStartOut)
def student_quiz_start(
    class_id: int,
    topic_id: int,
    db: Session = Depends(get_db),
    student=Depends(require_student),
):
    _require_enrolled_student(db, class_id=class_id, student_id=student.id)
    topic = _load_topic_for_student(db, class_id=class_id, topic_id=topic_id)

    raw = (topic.basic_quiz or "").strip()
    if not raw:
        raise HTTPException(
            status_code=400,
            detail="Pro toto téma zatím není uložený kvíz.",
        )

    try:
        quiz_out = parse_quiz_json_to_quiz_out(raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not quiz_out.questions:
        raise HTTPException(status_code=400, detail="Kvíz neobsahuje žádné otázky.")

    ids = [q.id for q in quiz_out.questions]
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=400, detail="Kvíz obsahuje duplicitní id otázek.")

    ordered = _runtime_question_order(list(quiz_out.questions))
    by_id = {q.id: q for q in quiz_out.questions}
    attempt_id = _new_attempt_id()
    state = QuizAttemptRuntime(
        student_id=student.id,
        class_id=class_id,
        topic_id=topic_id,
        order=[q.id for q in ordered],
        questions_by_id=by_id,
    )

    public = quiz_out_to_public(QuizOut.model_validate({"questions": ordered}))

    with _cache_lock:
        _attempts[attempt_id] = state

    return QuizStartOut(attempt_id=attempt_id, questions=public.questions)


@router.post(
    "/{class_id}/{topic_id}/attempts/{attempt_id}/answer",
    response_model=QuizSubmitAnswerOut,
)
def student_quiz_submit_answer(
    class_id: int,
    topic_id: int,
    attempt_id: str,
    payload: QuizSubmitAnswerIn,
    db: Session = Depends(get_db),
    student=Depends(require_student),
):
    _require_enrolled_student(db, class_id=class_id, student_id=student.id)
    topic_for_eval = _load_topic_for_student(db, class_id=class_id, topic_id=topic_id)
    cls_for_eval = db.query(Class).filter(Class.id == class_id).first()
    grade_label = str(cls_for_eval.grade) if cls_for_eval and cls_for_eval.grade is not None else ""
    study_notes = (topic_for_eval.student_notes_md or "").strip()

    with _cache_lock:
        state = _get_attempt_locked(attempt_id, student.id)
        if state.class_id != class_id or state.topic_id != topic_id:
            raise HTTPException(status_code=404, detail="Quiz attempt not found")

        state = _get_attempt_locked(attempt_id, student.id)
        if state.class_id != class_id or state.topic_id != topic_id:
            raise HTTPException(status_code=404, detail="Quiz attempt not found")

        if state.finished:
            raise HTTPException(status_code=400, detail="Pokus je již uzavřen.")

        if payload.question_id in state.answers:
            prev = state.answers[payload.question_id]
            return QuizSubmitAnswerOut(
                is_correct=prev["is_correct"],
                score_delta=prev["score_delta"],
                explanation=prev.get("explanation"),
                feedback=prev.get("feedback"),
            )

        expected = _current_question_id(state)
        if expected is None or payload.question_id != expected:
            raise HTTPException(
                status_code=400,
                detail="Odpověz v pořadí na aktuální otázku.",
            )

        q = state.questions_by_id.get(payload.question_id)
        if not q:
            raise HTTPException(status_code=400, detail="Neznámá otázka.")

        q_type = q.type
        q_prompt = q.prompt
        q_correct = (q.correct_answer or "").strip().upper()
        q_explanation = q.explanation

    if q_type in ("mcq", "yesno"):
        given = _normalize_mcq_yesno_answer(payload.answer)
        is_correct = bool(given and q_correct and given == q_correct)
        score_delta = 1.0 if is_correct else 0.0
        out = QuizSubmitAnswerOut(
            is_correct=is_correct,
            score_delta=score_delta,
            explanation=q_explanation,
            feedback=None,
        )
    elif q_type == "final_open":
        client = get_client()
        try:
            eval_result = evaluate_final_open_answer(
                client,
                question_prompt=q_prompt,
                student_answer=payload.answer,
                study_notes_md=study_notes,
                class_grade=grade_label,
                chapter_title=(topic_for_eval.title or "").strip(),
            )
        except Exception:
            raise HTTPException(
                status_code=502,
                detail="Hodnocení otevřené otázky dočasně selhalo. Zkus to znovu.",
            )
        score_delta = float(eval_result.points_awarded)
        is_correct = (score_delta / 15.0) >= _FINAL_OPEN_CORRECT_THRESHOLD
        fb = (eval_result.student_feedback or "").strip()
        out = QuizSubmitAnswerOut(
            is_correct=is_correct,
            score_delta=score_delta,
            explanation=None,
            feedback=fb or None,
        )
    else:
        raise HTTPException(status_code=400, detail="Nepodporovaný typ otázky.")

    with _cache_lock:
        state = _get_attempt_locked(attempt_id, student.id)
        if state.class_id != class_id or state.topic_id != topic_id:
            raise HTTPException(status_code=404, detail="Quiz attempt not found")
        state = _get_attempt_locked(attempt_id, student.id)
        if state.class_id != class_id or state.topic_id != topic_id:
            raise HTTPException(status_code=404, detail="Quiz attempt not found")
        if state.finished:
            raise HTTPException(status_code=400, detail="Pokus je již uzavřen.")
        if payload.question_id in state.answers:
            prev = state.answers[payload.question_id]
            return QuizSubmitAnswerOut(
                is_correct=prev["is_correct"],
                score_delta=prev["score_delta"],
                explanation=prev.get("explanation"),
                feedback=prev.get("feedback"),
            )
        expected = _current_question_id(state)
        if expected is None or payload.question_id != expected:
            raise HTTPException(
                status_code=409,
                detail="Stav pokusu se změnil. Obnov stránku a zkus to znovu.",
            )
        state.answers[payload.question_id] = {
            "is_correct": out.is_correct,
            "score_delta": out.score_delta,
            "explanation": out.explanation,
            "feedback": out.feedback,
            "answer_text": payload.answer,
        }

    return out


@router.post(
    "/{class_id}/{topic_id}/attempts/{attempt_id}/finish",
    response_model=QuizFinishOut,
)
def student_quiz_finish(
    class_id: int,
    topic_id: int,
    attempt_id: str,
    db: Session = Depends(get_db),
    student=Depends(require_student),
):
    _require_enrolled_student(db, class_id=class_id, student_id=student.id)
    _load_topic_for_student(db, class_id=class_id, topic_id=topic_id)

    with _cache_lock:
        state = _get_attempt_locked(attempt_id, student.id)
        if state.class_id != class_id or state.topic_id != topic_id:
            raise HTTPException(status_code=404, detail="Quiz attempt not found")

        if state.finish_summary is not None:
            return state.finish_summary

        if len(state.answers) != len(state.order):
            raise HTTPException(
                status_code=400,
                detail="Dokonči všechny otázky před ukončením kvízu.",
            )

        summary = _compute_finish_summary(attempt_id, state)
        try:
            row_id = _persist_finished_attempt(db, state=state, summary=summary)
            db.commit()
        except Exception:
            db.rollback()
            raise
        final_summary = QuizFinishOut(
            attempt_id=str(row_id),
            total_score=summary.total_score,
            max_score=summary.max_score,
            question_count=summary.question_count,
        )
        state.finished = True
        state.finish_summary = final_summary

    return state.finish_summary


@router.get(
    "/{class_id}/{topic_id}/my-attempts/{attempt_id}",
    response_model=QuizAttemptDetailStudentOut,
    response_model_exclude_none=True,
)
def get_student_quiz_attempt_detail(
    class_id: int,
    topic_id: int,
    attempt_id: str,
    db: Session = Depends(get_db),
    student=Depends(require_student),
):
    _require_enrolled_student(db, class_id=class_id, student_id=student.id)
    topic = _load_topic_for_student(db, class_id=class_id, topic_id=topic_id)

    aid = _parse_attempt_db_pk(attempt_id)
    attempt = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.id == aid,
            QuizAttempt.class_id == class_id,
            QuizAttempt.topic_id == topic_id,
            QuizAttempt.finished_at.isnot(None),
        )
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Quiz attempt not found")
    if attempt.student_id != student.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    return _build_student_attempt_detail(attempt, topic.basic_quiz or "")
