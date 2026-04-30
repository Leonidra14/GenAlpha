from __future__ import annotations

"""
Quiz HTTP API: student attempts (in-memory runtime + Postgres rows), bonus flow, teacher stats,
and tutor SSE. Ephemeral attempt id is used when there is no DB row yet (e.g. bonus preview).
"""

import copy
import json
import logging
import random
import threading
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from database.database import get_db
from app.deps.auth import get_current_user as get_current_teacher, require_student

from models.topics import Topic
from models.classes import Class
from models.enrollments import Enrollment
from models.quiz_attempts import QuizAttempt
from models.topic_progress import TopicProgress
from models.users import User

from app.core.openai_client import (
    get_async_openai_client as get_async_client,
    get_openai_client as get_client,
)
from app.core.settings import settings
from app.schemas.quiz import (
    FinalOpenCriteriaEval,
    TeacherClassRiskStudentOut,
    TeacherClassRiskStudentsOut,
    TeacherClassStudentDetailOut,
    TeacherClassStudentTopicChartRowOut,
    TeacherClassStatsOverviewOut,
    TeacherClassStatsTrendOut,
    TeacherClassStatsTrendPointOut,
    TeacherClassTopicStatsOut,
    TeacherClassTopicStatsRowOut,
    TopicQuizAnswerMatrixCellOut,
    TopicQuizAnswerMatrixQuestionOut,
    TopicQuizAnswerMatrixRowOut,
    QuizAttemptAnswerStudentRowOut,
    QuizAttemptAnswerTeacherRowOut,
    QuizAttemptDetailStudentOut,
    QuizAttemptDetailTeacherOut,
    QuizAttemptListItemStudentOut,
    QuizFinishOut,
    QuizOut,
    QuizQuestion,
    QuizSaveFinalIn,
    QuizStartOut,
    QuizSubmitAnswerIn,
    QuizSubmitAnswerOut,
    TopicQuizQuestionStatOut,
    TopicQuizStudentRowOut,
    TopicQuizTeacherStatsOut,
    TutorMessageIn,
    parse_quiz_json_to_quiz_out,
    quiz_out_to_public,
)
from ai.Tutor.tutor_workflow import (
    SAFE_FALLBACK_LEAK,
    classify_with_fast_path,
    looks_like_prompt_leak,
    refusal_message_for_reason,
    rewrite_unsafe_answer,
    should_refuse,
    stream_tutor_reply,
    update_stuck_count,
    check_answer_safe,
)
from ai.BonusQuiz.bonus_quiz_workflow import generate_bonus_quiz, tier_from_score_pct
from ai.ClassRiskAssessment import generate_class_risk_assessment
from ai.Quiz.quiz_workflow import evaluate_final_open_answer, generate_quiz, regenerate_quiz

router = APIRouter(prefix="/quiz", tags=["quiz"])

logger = logging.getLogger(__name__)

# Tutor SSE: cap embedded student notes (system prompt size)
_TUTOR_NOTES_MAX_CHARS = 12000
_TUTOR_NOTES_TRUNC_SUFFIX = "\n\n[Zápisky zkráceny kvůli délce.]"

# URL segment + results_preview.attempt_id for non-persisted (bonus) quiz finish — no DB row.
EPHEMERAL_QUIZ_ATTEMPT_ID = "local"

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
    attempt_kind: str = "main"
    quiz_snapshot_json: Optional[str] = None
    # Tutor (SSE): loaded once per attempt on first tutor request; messages reset per question.
    tutor_context_loaded: bool = False
    tutor_student_notes_md: Optional[str] = None
    tutor_subject: Optional[str] = None
    tutor_grade_label: Optional[str] = None
    tutor_chapter_title: Optional[str] = None
    tutor_messages: List[Dict[str, Any]] = field(default_factory=list)
    tutor_last_question_id: Optional[str] = None
    tutor_stuck_count: int = 0


@dataclass(frozen=True)
class ClassRiskCacheKey:
    class_id: int
    topic_ids_key: str
    threshold_bp: int


@dataclass
class ClassRiskCacheEntry:
    payload: TeacherClassRiskStudentsOut
    refreshed_at: datetime


_class_risk_cache_lock = threading.Lock()
_class_risk_cache: Dict[ClassRiskCacheKey, ClassRiskCacheEntry] = {}


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


def _tutor_reset_messages_if_question_changed(
    state: QuizAttemptRuntime, question_id: str
) -> None:
    """New quiz question = new thread; long-lived notes stay in tutor fields once loaded."""
    if state.tutor_last_question_id != question_id:
        state.tutor_messages.clear()
        state.tutor_last_question_id = question_id
        state.tutor_stuck_count = 0


def _truncate_for_tutor_notes(md: str) -> str:
    if len(md) <= _TUTOR_NOTES_MAX_CHARS:
        return md
    return md[:_TUTOR_NOTES_MAX_CHARS] + _TUTOR_NOTES_TRUNC_SUFFIX


def _quiz_question_student_facing_text(q: QuizQuestion) -> str:
    """Prompt + options only — never correct_answer / explanation (leak guard)."""
    lines = [q.prompt.strip()]
    if q.type in ("mcq", "yesno") and q.options:
        for key in sorted(q.options.keys()):
            lines.append(f"{key}: {q.options[key]}")
    return "\n".join(lines)


def _ensure_tutor_context_locked(db: Session, state: QuizAttemptRuntime) -> None:
    if state.tutor_context_loaded:
        return
    topic = (
        db.query(Topic)
        .filter(
            Topic.id == state.topic_id,
            Topic.class_id == state.class_id,
            Topic.active == True,
        )
        .first()
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    cls = db.query(Class).filter(Class.id == state.class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    raw_notes = (topic.student_notes_md or "").strip()
    state.tutor_student_notes_md = _truncate_for_tutor_notes(raw_notes)
    state.tutor_subject = (cls.subject or "").strip()
    state.tutor_grade_label = str(cls.grade) if cls.grade is not None else ""
    state.tutor_chapter_title = (topic.title or "").strip()
    state.tutor_context_loaded = True


def _tutor_sse_line(payload: Dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _tutor_append_turn(
    attempt_id: str,
    student_id: int,
    user_text: str,
    assistant_text: str,
    *,
    new_stuck_count: Optional[int] = None,
) -> None:
    with _cache_lock:
        try:
            state = _get_attempt_locked(attempt_id, student_id)
        except HTTPException:
            return
        if state.finished:
            return
        state.tutor_messages.append({"role": "user", "content": user_text})
        state.tutor_messages.append({"role": "assistant", "content": assistant_text})
        if new_stuck_count is not None:
            state.tutor_stuck_count = new_stuck_count


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


def _build_runtime_student_attempt_detail(
    state: QuizAttemptRuntime,
    *,
    finished_at: datetime,
    duration_sec: int,
    summary: QuizFinishOut,
) -> QuizAttemptDetailStudentOut:
    """Same shape as DB-backed attempt detail, built from in-memory runtime (no persist)."""
    answer_rows: List[QuizAttemptAnswerStudentRowOut] = []
    for qid in state.order:
        ans = state.answers.get(qid)
        q = state.questions_by_id.get(qid)
        if not ans or not q:
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
                student_answer=str(ans.get("answer_text") or ""),
                is_correct=bool(ans.get("is_correct")),
                score_delta=float(ans.get("score_delta") or 0.0),
                feedback=fb,
            )
        )
    correct_count = sum(1 for r in answer_rows if r.is_correct)
    incorrect_count = len(answer_rows) - correct_count
    return QuizAttemptDetailStudentOut(
        attempt_id=EPHEMERAL_QUIZ_ATTEMPT_ID,
        finished_at=finished_at,
        score=float(summary.total_score),
        max_score=float(summary.max_score),
        question_count=int(summary.question_count),
        duration_sec=duration_sec,
        correct_count=correct_count,
        incorrect_count=incorrect_count,
        answers=answer_rows,
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


def _mistakes_json_for_bonus_prompt(raw: Any) -> str:
    if raw is None:
        return "[]"
    if isinstance(raw, str):
        s = raw.strip()
        return s if s else "[]"
    try:
        return json.dumps(raw, ensure_ascii=False)
    except (TypeError, ValueError):
        return "[]"


def _latest_finished_main_attempt(
    db: Session,
    *,
    class_id: int,
    topic_id: int,
    student_id: int,
) -> Optional[QuizAttempt]:
    return (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.class_id == class_id,
            QuizAttempt.topic_id == topic_id,
            QuizAttempt.student_id == student_id,
            QuizAttempt.finished_at.isnot(None),
            QuizAttempt.attempt_kind == "main",
        )
        .order_by(QuizAttempt.finished_at.desc())
        .first()
    )


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


def _final_open_criteria_from_stored(raw: Any) -> Optional[FinalOpenCriteriaEval]:
    if not isinstance(raw, dict):
        return None
    try:
        return FinalOpenCriteriaEval.model_validate(raw)
    except ValidationError:
        return None


def _teacher_final_open_extras_from_row(ans: Dict[str, Any]) -> tuple[Optional[str], Optional[str], Optional[FinalOpenCriteriaEval]]:
    ts_raw = ans.get("teacher_summary")
    tr_raw = ans.get("teacher_recommendation")
    ts = (str(ts_raw).strip() if ts_raw is not None else "") or None
    tr = (str(tr_raw).strip() if tr_raw is not None else "") or None
    crit = _final_open_criteria_from_stored(ans.get("criteria"))
    return ts, tr, crit


def _build_teacher_attempt_detail(
    attempt: QuizAttempt,
    basic_quiz_raw: str,
    *,
    student: User,
) -> QuizAttemptDetailTeacherOut:
    answers_json = _coerce_stored_answer_rows(attempt.answers_json)
    by_id: Dict[str, Dict[str, Any]] = {}
    for row in answers_json:
        qid = str(row.get("question_id", ""))
        if qid:
            by_id[qid] = row

    answer_rows: List[QuizAttemptAnswerTeacherRowOut] = []
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
            ca = None
            expl = None
            if q_type in ("mcq", "yesno"):
                ca = (q.correct_answer or "").strip().upper() or None
                expl = (q.explanation or "").strip() or None
            ts, tr, crit = (None, None, None)
            if q_type == "final_open":
                ts, tr, crit = _teacher_final_open_extras_from_row(ans)
            answer_rows.append(
                QuizAttemptAnswerTeacherRowOut(
                    question_id=q.id,
                    prompt=q.prompt,
                    type=q_type,
                    student_answer=str(ans.get("answer") or ""),
                    is_correct=bool(ans.get("is_correct")),
                    score_delta=float(ans.get("score_delta") or 0.0),
                    feedback=fb,
                    correct_answer=ca,
                    explanation=expl,
                    teacher_summary=ts,
                    teacher_recommendation=tr,
                    final_open_criteria=crit,
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
            expl_raw = ans.get("explanation")
            expl = (
                (str(expl_raw).strip() if expl_raw is not None else "")
                or None
            )
            if q_type == "final_open":
                expl = None
            ts, tr, crit = (None, None, None)
            if q_type == "final_open":
                ts, tr, crit = _teacher_final_open_extras_from_row(ans)
            answer_rows.append(
                QuizAttemptAnswerTeacherRowOut(
                    question_id=qid,
                    prompt="",
                    type=q_type,
                    student_answer=str(ans.get("answer") or ""),
                    is_correct=bool(ans.get("is_correct")),
                    score_delta=float(ans.get("score_delta") or 0.0),
                    feedback=fb,
                    correct_answer=None,
                    explanation=expl,
                    teacher_summary=ts,
                    teacher_recommendation=tr,
                    final_open_criteria=crit,
                )
            )

    correct_count = sum(1 for r in answer_rows if r.is_correct)
    incorrect_count = len(answer_rows) - correct_count
    max_score = _max_score_from_stored_answers(answers_json)
    kind = (attempt.attempt_kind or "main").strip() or "main"

    return QuizAttemptDetailTeacherOut(
        attempt_id=str(attempt.id),
        student_id=student.id,
        first_name=student.first_name,
        last_name=student.last_name,
        attempt_kind=kind,
        finished_at=attempt.finished_at,
        score=float(attempt.score),
        max_score=max_score,
        question_count=len(answers_json),
        duration_sec=int(attempt.duration_sec),
        correct_count=correct_count,
        incorrect_count=incorrect_count,
        answers=answer_rows,
    )


def _student_attempt_list_item(attempt: QuizAttempt) -> QuizAttemptListItemStudentOut:
    answers_json = _coerce_stored_answer_rows(attempt.answers_json)
    max_score = _max_score_from_stored_answers(answers_json)
    kind = (attempt.attempt_kind or "main").strip() or "main"
    return QuizAttemptListItemStudentOut(
        attempt_id=str(attempt.id),
        finished_at=attempt.finished_at,
        score=float(attempt.score),
        max_score=max_score,
        duration_sec=int(attempt.duration_sec),
        attempt_kind=kind,
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
            "teacher_summary": ans.get("teacher_summary"),
            "teacher_recommendation": ans.get("teacher_recommendation"),
            "criteria": ans.get("criteria"),
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

    # QuizAttempt.id is DB-generated (Identity); do not set uuid or manual id.
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
        attempt_kind=state.attempt_kind or "main",
        quiz_snapshot_json=state.quiz_snapshot_json,
    )
    db.add(attempt_row)
    db.flush()

    if (state.attempt_kind or "main") != "bonus":
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


def _median_float(values: List[float]) -> Optional[float]:
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    m = n // 2
    if n % 2:
        return float(s[m])
    return (float(s[m - 1]) + float(s[m])) / 2.0


def _median_int(values: List[int]) -> Optional[int]:
    mf = _median_float([float(x) for x in values])
    return int(round(mf)) if mf is not None else None


def _quiz_max_score_from_quiz_out(quiz_out: QuizOut) -> float:
    total = 0.0
    for q in quiz_out.questions:
        total += 15.0 if q.type == "final_open" else 1.0
    return total


def _require_teacher_class_topic(
    db: Session, *, class_id: int, topic_id: int, teacher_id: int
) -> Topic:
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
    if getattr(cls, "teacher_id", None) != teacher_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return topic


def _build_topic_quiz_teacher_stats(
    db: Session, *, class_id: int, topic_id: int, topic: Topic
) -> TopicQuizTeacherStatsOut:
    enrollment_rows = (
        db.query(Enrollment, User)
        .join(User, User.id == Enrollment.student_id)
        .filter(Enrollment.class_id == class_id)
        .all()
    )
    enrolled_count = len(enrollment_rows)
    enrollment_student_ids = {u.id for _, u in enrollment_rows}

    attempts = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.class_id == class_id,
            QuizAttempt.topic_id == topic_id,
            QuizAttempt.finished_at.isnot(None),
            QuizAttempt.attempt_kind == "main",
        )
        .order_by(QuizAttempt.finished_at.asc(), QuizAttempt.id.asc())
        .all()
    )

    by_student: Dict[int, List[QuizAttempt]] = {}
    for a in attempts:
        by_student.setdefault(a.student_id, []).append(a)

    quiz_raw = (topic.basic_quiz or "").strip()
    quiz_out: Optional[QuizOut] = None
    quiz_max_score: Optional[float] = None
    quiz_has_final_open = False
    if quiz_raw:
        try:
            quiz_out = parse_quiz_json_to_quiz_out(quiz_raw)
            quiz_max_score = _quiz_max_score_from_quiz_out(quiz_out)
            quiz_has_final_open = any(q.type == "final_open" for q in quiz_out.questions)
        except ValueError:
            quiz_out = None

    per_question: List[TopicQuizQuestionStatOut] = []
    matrix_questions: List[TopicQuizAnswerMatrixQuestionOut] = []
    if quiz_out:
        for q in quiz_out.questions:
            if q.type == "final_open":
                continue
            matrix_questions.append(
                TopicQuizAnswerMatrixQuestionOut(
                    question_id=q.id,
                    prompt=q.prompt,
                    type=q.type,
                )
            )
            answered = 0
            correct = 0
            for sid in enrollment_student_ids:
                lst = by_student.get(sid)
                if not lst:
                    continue
                latest = lst[-1]
                rows = _coerce_stored_answer_rows(latest.answers_json)
                match = next(
                    (r for r in rows if str(r.get("question_id", "")) == q.id),
                    None,
                )
                if match is None:
                    continue
                answered += 1
                if bool(match.get("is_correct")):
                    correct += 1
            rate = (100.0 * correct / answered) if answered else 0.0
            per_question.append(
                TopicQuizQuestionStatOut(
                    question_id=q.id,
                    prompt=q.prompt,
                    correct_rate=rate,
                    answered_count=answered,
                )
            )

    completed_count = sum(
        1 for sid in enrollment_student_ids if bool(by_student.get(sid))
    )
    completion_percent = (
        (100.0 * completed_count / enrolled_count) if enrolled_count else 0.0
    )

    score_pcts: List[float] = []
    durs: List[int] = []
    for sid in enrollment_student_ids:
        lst = by_student.get(sid)
        if not lst:
            continue
        latest = lst[-1]
        ajson = _coerce_stored_answer_rows(latest.answers_json)
        ms = _max_score_from_stored_answers(ajson)
        if ms > 0:
            score_pcts.append(100.0 * float(latest.score) / ms)
        else:
            score_pcts.append(0.0)
        durs.append(int(latest.duration_sec))

    avg_score = (
        float(sum(score_pcts) / len(score_pcts)) if score_pcts else None
    )
    median_score = _median_float(score_pcts)
    avg_dur = int(round(sum(durs) / len(durs))) if durs else None
    median_dur = _median_int(durs)

    sorted_enrollments = sorted(
        enrollment_rows,
        key=lambda pair: (
            (pair[1].last_name or "").lower(),
            (pair[1].first_name or "").lower(),
            pair[1].id,
        ),
    )

    latest_answers_by_student: Dict[int, Dict[str, Dict[str, Any]]] = {}
    for sid in enrollment_student_ids:
        lst = by_student.get(sid)
        if not lst:
            latest_answers_by_student[sid] = {}
            continue
        latest_rows = _coerce_stored_answer_rows(lst[-1].answers_json)
        latest_answers_by_student[sid] = {
            str(r.get("question_id", "")): r
            for r in latest_rows
            if str(r.get("question_id", ""))
        }

    students_out: List[TopicQuizStudentRowOut] = []
    matrix_rows: List[TopicQuizAnswerMatrixRowOut] = []
    for _, user in sorted_enrollments:
        sid = user.id
        lst = by_student.get(sid) or []
        attempt_count = len(lst)
        latest = lst[-1] if lst else None
        latest_attempt_id = str(latest.id) if latest else None
        latest_finished_at = latest.finished_at if latest else None
        latest_score = float(latest.score) if latest else None
        latest_max: Optional[float] = None
        best_pct: Optional[float] = None
        if latest is not None:
            aj = _coerce_stored_answer_rows(latest.answers_json)
            latest_max = _max_score_from_stored_answers(aj)
        if lst:
            pcts: List[float] = []
            for att in lst:
                aj = _coerce_stored_answer_rows(att.answers_json)
                m = _max_score_from_stored_answers(aj)
                if m > 0:
                    pcts.append(100.0 * float(att.score) / m)
                else:
                    pcts.append(0.0)
            best_pct = max(pcts) if pcts else None

        students_out.append(
            TopicQuizStudentRowOut(
                student_id=sid,
                first_name=user.first_name,
                last_name=user.last_name,
                attempt_count=attempt_count,
                latest_attempt_id=latest_attempt_id,
                latest_finished_at=latest_finished_at,
                latest_score=latest_score,
                latest_max_score=latest_max,
                best_score_percent=best_pct,
            )
        )

        by_qid = latest_answers_by_student.get(sid) or {}
        cells: List[TopicQuizAnswerMatrixCellOut] = []
        for q in matrix_questions:
            row = by_qid.get(q.question_id)
            has_answer = row is not None
            answer_raw = None if row is None else row.get("student_answer")
            answer_text = (
                str(answer_raw).strip() if answer_raw is not None else None
            ) or None
            is_correct = None
            if has_answer:
                is_correct = bool(row.get("is_correct"))
            cells.append(
                TopicQuizAnswerMatrixCellOut(
                    question_id=q.question_id,
                    has_answer=has_answer,
                    is_correct=is_correct,
                    student_answer=answer_text,
                )
            )
        matrix_rows.append(
            TopicQuizAnswerMatrixRowOut(
                student_id=sid,
                first_name=user.first_name,
                last_name=user.last_name,
                latest_attempt_id=latest_attempt_id,
                cells=cells,
            )
        )

    return TopicQuizTeacherStatsOut(
        enrolled_count=enrolled_count,
        completed_count=completed_count,
        completion_percent=completion_percent,
        avg_score_percent=avg_score,
        median_score_percent=median_score,
        avg_duration_sec=avg_dur,
        median_duration_sec=median_dur,
        quiz_max_score=quiz_max_score,
        quiz_has_final_open=quiz_has_final_open,
        per_question=per_question,
        students=students_out,
        answer_matrix_questions=matrix_questions,
        answer_matrix_rows=matrix_rows,
    )


def _require_teacher_class(db: Session, *, class_id: int, teacher_id: int) -> Class:
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    if getattr(cls, "teacher_id", None) != teacher_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return cls


def _score_percent_from_attempt(attempt: QuizAttempt) -> float:
    answers_json = _coerce_stored_answer_rows(attempt.answers_json)
    max_score = _max_score_from_stored_answers(answers_json)
    if max_score <= 0:
        return 0.0
    return 100.0 * float(attempt.score) / max_score


def _safe_percent(value: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return 100.0 * float(value) / float(total)


def _best_main_attempt_per_student(attempts: List[QuizAttempt]) -> Dict[int, QuizAttempt]:
    """One attempt per student: highest score %; ties broken by later finished_at."""
    by_student: Dict[int, QuizAttempt] = {}
    for a in attempts:
        sid = int(a.student_id)
        if sid not in by_student:
            by_student[sid] = a
            continue
        cur = by_student[sid]
        c_pct = _score_percent_from_attempt(cur)
        n_pct = _score_percent_from_attempt(a)
        if n_pct > c_pct:
            by_student[sid] = a
        elif n_pct == c_pct and a.finished_at and cur.finished_at and a.finished_at > cur.finished_at:
            by_student[sid] = a
    return by_student


def _class_topics_scope(
    db: Session,
    *,
    class_id: int,
    topic_ids: Optional[List[int]],
) -> List[Topic]:
    q = db.query(Topic).filter(Topic.class_id == class_id, Topic.active == True)
    normalized = sorted({int(tid) for tid in (topic_ids or []) if int(tid) > 0})
    if normalized:
        q = q.filter(Topic.id.in_(normalized))
    topics = q.order_by(Topic.created_at.asc(), Topic.id.asc()).all()
    if normalized and not topics:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topics


def _parse_topic_ids_query(
    *,
    topic_id: Optional[int],
    topic_ids_csv: Optional[str],
) -> Optional[List[int]]:
    values: List[int] = []
    if topic_id is not None:
        values.append(int(topic_id))
    if topic_ids_csv:
        for part in str(topic_ids_csv).split(","):
            token = part.strip()
            if not token:
                continue
            try:
                val = int(token, 10)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid topic_ids value: {token}") from exc
            if val <= 0:
                raise HTTPException(status_code=400, detail=f"Invalid topic_ids value: {token}")
            values.append(val)
    if not values:
        return None
    return sorted(set(values))


def _class_finished_main_attempts_scope(
    db: Session,
    *,
    class_id: int,
    topic_ids: List[int],
) -> List[QuizAttempt]:
    if not topic_ids:
        return []
    return (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.class_id == class_id,
            QuizAttempt.topic_id.in_(topic_ids),
            QuizAttempt.finished_at.isnot(None),
            QuizAttempt.attempt_kind == "main",
        )
        .order_by(QuizAttempt.finished_at.asc(), QuizAttempt.id.asc())
        .all()
    )


def _build_teacher_class_stats_overview(
    db: Session,
    *,
    class_id: int,
    topic_ids: Optional[List[int]],
    risk_threshold_percent: float,
) -> TeacherClassStatsOverviewOut:
    enrollment_rows = (
        db.query(Enrollment, User)
        .join(User, User.id == Enrollment.student_id)
        .filter(Enrollment.class_id == class_id)
        .all()
    )
    enrolled_ids = {u.id for _, u in enrollment_rows}
    enrolled_count = len(enrolled_ids)

    topics = _class_topics_scope(db, class_id=class_id, topic_ids=topic_ids)
    topic_ids = [int(t.id) for t in topics]
    attempts = _class_finished_main_attempts_scope(
        db, class_id=class_id, topic_ids=topic_ids
    )
    attempts_enrolled = [a for a in attempts if a.student_id in enrolled_ids]
    best_by_student = _best_main_attempt_per_student(attempts_enrolled)

    score_pcts = [_score_percent_from_attempt(a) for a in best_by_student.values()]
    avg_score = (
        (float(sum(score_pcts) / len(score_pcts))) if score_pcts else None
    )
    median_score = _median_float(score_pcts)

    now_utc = datetime.now(timezone.utc)
    active_7_cutoff = now_utc - timedelta(days=7)
    active_30_cutoff = now_utc - timedelta(days=30)
    active_7 = len(
        {
            a.student_id
            for a in attempts
            if a.student_id in enrolled_ids and a.finished_at >= active_7_cutoff
        }
    )
    active_30 = len(
        {
            a.student_id
            for a in attempts
            if a.student_id in enrolled_ids and a.finished_at >= active_30_cutoff
        }
    )
    below_threshold = sum(1 for pct in score_pcts if pct < risk_threshold_percent)

    return TeacherClassStatsOverviewOut(
        class_id=class_id,
        enrolled_count=enrolled_count,
        avg_score_percent=avg_score,
        median_score_percent=median_score,
        active_students_7d=active_7,
        active_students_30d=active_30,
        active_students_7d_percent=_safe_percent(active_7, enrolled_count),
        active_students_30d_percent=_safe_percent(active_30, enrolled_count),
        students_below_threshold=below_threshold,
        risk_threshold_percent=risk_threshold_percent,
    )


def _build_teacher_class_stats_trend(
    db: Session,
    *,
    class_id: int,
    topic_ids: Optional[List[int]],
    period_days: int,
) -> TeacherClassStatsTrendOut:
    enrollment_ids = {
        enr.student_id
        for enr in db.query(Enrollment).filter(Enrollment.class_id == class_id).all()
    }
    enrolled_count = len(enrollment_ids)
    topics = _class_topics_scope(db, class_id=class_id, topic_ids=topic_ids)
    attempts = _class_finished_main_attempts_scope(
        db, class_id=class_id, topic_ids=[int(t.id) for t in topics]
    )

    today = datetime.now(timezone.utc).date()
    start_day = today - timedelta(days=period_days - 1)
    attempts_in_period = [
        a for a in attempts if a.finished_at and a.finished_at.date() >= start_day
    ]
    attempts_by_day: Dict[date, List[QuizAttempt]] = {}
    for a in attempts_in_period:
        d = a.finished_at.date()
        attempts_by_day.setdefault(d, []).append(a)

    completed_students_so_far: set[int] = set()
    points: List[TeacherClassStatsTrendPointOut] = []
    for i in range(period_days):
        day = start_day + timedelta(days=i)
        day_attempts = attempts_by_day.get(day, [])
        day_student_ids = {
            a.student_id for a in day_attempts if a.student_id in enrollment_ids
        }
        completed_students_so_far.update(day_student_ids)
        pct_values = [_score_percent_from_attempt(a) for a in day_attempts]
        avg_pct = (
            float(sum(pct_values) / len(pct_values)) if pct_values else None
        )
        points.append(
            TeacherClassStatsTrendPointOut(
                day=day,
                attempt_count=len(day_attempts),
                active_students=len(day_student_ids),
                avg_score_percent=avg_pct,
                completion_percent=_safe_percent(
                    len(completed_students_so_far), enrolled_count
                ),
            )
        )

    return TeacherClassStatsTrendOut(
        class_id=class_id,
        period_days=period_days,
        enrolled_count=enrolled_count,
        points=points,
    )


def _build_teacher_class_topic_stats(
    db: Session,
    *,
    class_id: int,
    topic_ids: Optional[List[int]],
) -> TeacherClassTopicStatsOut:
    enrollment_ids = {
        enr.student_id
        for enr in db.query(Enrollment).filter(Enrollment.class_id == class_id).all()
    }
    enrolled_count = len(enrollment_ids)
    topics = _class_topics_scope(db, class_id=class_id, topic_ids=topic_ids)
    topic_ids = [int(t.id) for t in topics]
    all_attempts = _class_finished_main_attempts_scope(
        db, class_id=class_id, topic_ids=topic_ids
    )

    attempts_by_topic: Dict[int, List[QuizAttempt]] = {}
    for a in all_attempts:
        if a.student_id in enrollment_ids:
            attempts_by_topic.setdefault(int(a.topic_id), []).append(a)

    rows: List[TeacherClassTopicStatsRowOut] = []
    for t in topics:
        topic_attempts = attempts_by_topic.get(int(t.id), [])
        best_by_student = _best_main_attempt_per_student(topic_attempts)
        attempted_students = len(best_by_student)
        pcts = [_score_percent_from_attempt(a) for a in best_by_student.values()]
        durs = [int(a.duration_sec) for a in best_by_student.values()]
        avg_dur = int(round(sum(durs) / len(durs))) if durs else None
        median_dur = _median_int(durs) if durs else None
        last_attempt_at = (
            max(a.finished_at for a in topic_attempts) if topic_attempts else None
        )
        rows.append(
            TeacherClassTopicStatsRowOut(
                topic_id=int(t.id),
                topic_title=(t.title or "").strip(),
                active=bool(getattr(t, "active", True)),
                enrolled_count=enrolled_count,
                attempted_students=attempted_students,
                completion_percent=_safe_percent(attempted_students, enrolled_count),
                avg_score_percent=(
                    (float(sum(pcts) / len(pcts))) if pcts else None
                ),
                median_score_percent=_median_float(pcts),
                avg_duration_sec=avg_dur,
                median_duration_sec=median_dur,
                last_attempt_at=last_attempt_at,
            )
        )

    return TeacherClassTopicStatsOut(class_id=class_id, rows=rows)


def _risk_level_from_score(score: int) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _class_risk_threshold_bp(threshold_percent: float) -> int:
    return int(round(float(threshold_percent) * 100.0))


def _class_risk_cache_ttl_seconds() -> int:
    return max(0, int(getattr(settings, "class_risk_cache_ttl_seconds", 86400) or 0))


def _class_risk_cache_is_fresh(entry: ClassRiskCacheEntry, now_utc: datetime) -> bool:
    ttl_seconds = _class_risk_cache_ttl_seconds()
    if ttl_seconds <= 0:
        return False
    return (now_utc - entry.refreshed_at).total_seconds() < ttl_seconds


def _fallback_risk_row(
    *,
    user: User,
    student_attempts: List[QuizAttempt],
    threshold_percent: float,
    topic_count: int,
    now_utc: datetime,
) -> TeacherClassRiskStudentOut:
    topic_done_count = len({int(a.topic_id) for a in student_attempts})
    completion_pct = _safe_percent(topic_done_count, topic_count)
    pct_values = [_score_percent_from_attempt(a) for a in student_attempts]
    avg_pct = float(sum(pct_values) / len(pct_values)) if pct_values else None
    last_attempt_at = (
        max(a.finished_at for a in student_attempts) if student_attempts else None
    )
    inactive_days = None
    if last_attempt_at:
        inactive_days = max(0, int((now_utc - last_attempt_at).total_seconds() // 86400))

    risk_score = 0
    reasons: List[str] = []
    if not student_attempts:
        risk_score += 65
        reasons.append("Zatim nema zadny dokonceny kviz.")
    if avg_pct is not None and avg_pct < threshold_percent:
        risk_score += 35
        reasons.append("Dlouhodobe nizsi uspesnost pod prahem.")
    if completion_pct < 50.0:
        risk_score += 25
        reasons.append("Nizka dokoncenost temat.")
    if inactive_days is not None and inactive_days >= 30:
        risk_score += 35
        reasons.append("Dlouha neaktivita ve kvizech (30+ dni).")
    elif inactive_days is not None and inactive_days >= 14:
        risk_score += 20
        reasons.append("Slabsi aktivita ve kvizech (14+ dni).")
    if len(pct_values) >= 3 and avg_pct is not None and avg_pct < threshold_percent:
        if pct_values[-1] - pct_values[0] < 5.0:
            risk_score += 15
            reasons.append("Vice pokusu bez viditelneho zlepseni.")

    risk_score = max(0, min(100, risk_score))
    return TeacherClassRiskStudentOut(
        student_id=int(user.id),
        first_name=user.first_name,
        last_name=user.last_name,
        risk_level=_risk_level_from_score(risk_score),
        risk_score=risk_score,
        reasons=reasons,
        attempt_count=len(student_attempts),
        avg_score_percent=avg_pct,
        completion_percent=completion_pct,
        last_attempt_at=last_attempt_at,
        inactive_days=inactive_days,
    )


def _build_ai_risk_input_row(
    *,
    fallback_row: TeacherClassRiskStudentOut,
    student_attempts: List[QuizAttempt],
    threshold_percent: float,
) -> Dict[str, Any]:
    pct_values = [_score_percent_from_attempt(a) for a in student_attempts]
    trend_delta = None
    if len(pct_values) >= 2:
        trend_delta = float(pct_values[-1] - pct_values[0])
    no_improvement_attempts = 0
    if len(pct_values) >= 2:
        for idx in range(1, len(pct_values)):
            if pct_values[idx] <= pct_values[idx - 1]:
                no_improvement_attempts += 1
    flags: List[str] = []
    if fallback_row.attempt_count == 0:
        flags.append("no_attempts")
    if (fallback_row.avg_score_percent or 0.0) < threshold_percent:
        flags.append("below_threshold")
    if fallback_row.completion_percent < 50.0:
        flags.append("low_completion")
    if (fallback_row.inactive_days or 0) >= 14:
        flags.append("low_activity")
    if no_improvement_attempts >= 2:
        flags.append("no_improvement")

    return {
        "student_id": fallback_row.student_id,
        "first_name": fallback_row.first_name,
        "last_name": fallback_row.last_name,
        "attempt_count": fallback_row.attempt_count,
        "avg_score_percent": fallback_row.avg_score_percent,
        "completion_percent": fallback_row.completion_percent,
        "inactive_days": fallback_row.inactive_days,
        "trend_delta_percent": trend_delta,
        "no_improvement_attempts": no_improvement_attempts,
        "optional_signal_flags": flags,
    }


def _build_teacher_class_risk_students_fresh(
    db: Session,
    *,
    class_id: int,
    topic_ids: Optional[List[int]],
    threshold_percent: float,
) -> TeacherClassRiskStudentsOut:
    enrollment_rows = (
        db.query(Enrollment, User)
        .join(User, User.id == Enrollment.student_id)
        .filter(Enrollment.class_id == class_id)
        .all()
    )
    users_by_id = {u.id: u for _, u in enrollment_rows}
    enrolled_ids = set(users_by_id.keys())
    topics = _class_topics_scope(db, class_id=class_id, topic_ids=topic_ids)
    topic_ids = [int(t.id) for t in topics]
    attempts = _class_finished_main_attempts_scope(
        db, class_id=class_id, topic_ids=topic_ids
    )
    attempts_by_student: Dict[int, List[QuizAttempt]] = {}
    for a in attempts:
        if a.student_id in enrolled_ids:
            attempts_by_student.setdefault(a.student_id, []).append(a)

    now_utc = datetime.now(timezone.utc)
    fallback_rows: List[TeacherClassRiskStudentOut] = []
    ai_rows_input: List[Dict[str, Any]] = []
    for sid, user in users_by_id.items():
        student_attempts = attempts_by_student.get(sid, [])
        fallback_row = _fallback_risk_row(
            user=user,
            student_attempts=student_attempts,
            threshold_percent=threshold_percent,
            topic_count=len(topic_ids),
            now_utc=now_utc,
        )
        fallback_rows.append(fallback_row)
        ai_rows_input.append(
            _build_ai_risk_input_row(
                fallback_row=fallback_row,
                student_attempts=student_attempts,
                threshold_percent=threshold_percent,
            )
        )

    rows_by_student_id = {r.student_id: r for r in fallback_rows}
    cls = db.query(Class).filter(Class.id == class_id).first()
    class_grade = str(cls.grade) if cls and cls.grade is not None else ""
    subject = (cls.subject or "").strip() if cls else ""
    if topic_ids:
        topic_scope = "topic_ids:" + ",".join(str(tid) for tid in topic_ids)
    else:
        topic_scope = "all_active_topics"

    try:
        client = get_client()
        ai_result = generate_class_risk_assessment(
            client,
            class_id=class_id,
            class_grade=class_grade,
            subject=subject,
            topic_scope=topic_scope,
            threshold_percent=threshold_percent,
            generated_at_iso=now_utc.isoformat(),
            student_rows_json=json.dumps(ai_rows_input, ensure_ascii=False),
        )
        ai_students = ai_result.get("students")
        if isinstance(ai_students, list):
            for row in ai_students:
                if not isinstance(row, dict):
                    continue
                sid_raw = row.get("student_id")
                if sid_raw is None:
                    continue
                try:
                    sid = int(sid_raw)
                except (TypeError, ValueError):
                    continue
                fallback = rows_by_student_id.get(sid)
                if fallback is None:
                    continue
                score_raw = row.get("risk_score")
                try:
                    ai_score = int(score_raw)
                except (TypeError, ValueError):
                    continue
                ai_score = max(0, min(100, ai_score))
                level_raw = str(row.get("risk_level") or "").strip().lower()
                ai_level = (
                    level_raw
                    if level_raw in ("low", "medium", "high")
                    else _risk_level_from_score(ai_score)
                )
                reasons_raw = row.get("reasons")
                ai_reasons: List[str] = []
                if isinstance(reasons_raw, list):
                    ai_reasons = [
                        str(x).strip() for x in reasons_raw if str(x).strip()
                    ]
                rec_raw = row.get("teacher_recommendation")
                ai_rec = str(rec_raw).strip() if rec_raw is not None else ""
                rows_by_student_id[sid] = TeacherClassRiskStudentOut(
                    student_id=fallback.student_id,
                    first_name=fallback.first_name,
                    last_name=fallback.last_name,
                    risk_level=ai_level,
                    risk_score=ai_score,
                    reasons=ai_reasons or fallback.reasons,
                    teacher_recommendation=ai_rec or None,
                    attempt_count=fallback.attempt_count,
                    avg_score_percent=fallback.avg_score_percent,
                    completion_percent=fallback.completion_percent,
                    last_attempt_at=fallback.last_attempt_at,
                    inactive_days=fallback.inactive_days,
                )
    except Exception:
        logger.warning(
            "AI class risk fallback used for class_id=%s topic_id=%s",
            class_id,
            topic_id,
            exc_info=True,
        )

    out_rows = list(rows_by_student_id.values())
    out_rows.sort(key=lambda x: (-x.risk_score, x.last_name.lower(), x.first_name.lower()))
    return TeacherClassRiskStudentsOut(
        class_id=class_id,
        generated_at=now_utc,
        threshold_percent=threshold_percent,
        students=out_rows,
    )


def _get_teacher_class_risk_students(
    db: Session,
    *,
    class_id: int,
    topic_ids: Optional[List[int]],
    threshold_percent: float,
    force_refresh: bool,
) -> TeacherClassRiskStudentsOut:
    normalized_topic_ids = sorted(set(topic_ids or []))
    topic_ids_key = ",".join(str(tid) for tid in normalized_topic_ids) if normalized_topic_ids else "all"
    cache_key = ClassRiskCacheKey(
        class_id=int(class_id),
        topic_ids_key=topic_ids_key,
        threshold_bp=_class_risk_threshold_bp(threshold_percent),
    )
    now_utc = datetime.now(timezone.utc)
    if not force_refresh:
        with _class_risk_cache_lock:
            cached = _class_risk_cache.get(cache_key)
            if cached and _class_risk_cache_is_fresh(cached, now_utc):
                return cached.payload.model_copy(deep=True)

    payload = _build_teacher_class_risk_students_fresh(
        db,
        class_id=class_id,
        topic_ids=normalized_topic_ids or None,
        threshold_percent=threshold_percent,
    )
    with _class_risk_cache_lock:
        _class_risk_cache[cache_key] = ClassRiskCacheEntry(
            payload=payload,
            refreshed_at=now_utc,
        )
    return payload.model_copy(deep=True)


class QuizGenerateIn(BaseModel):
    mcq: int = 8
    yesno: int = 4
    final_open: int = 1


class QuizRegenerateIn(BaseModel):
    quiz_json: str
    user_note: str


def _md_to_plain_text(md: str) -> str:
    return (md or "").strip()


@router.post("/generate/{class_id}/{topic_id}")
async def generate_quiz_for_topic(
    class_id: int,
    topic_id: int,
    payload: QuizGenerateIn,
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

    teacher_md = (topic.teacher_notes_md or "").strip()
    if not teacher_md:
        raise HTTPException(
            status_code=400,
            detail="Chybí Teacher Notes v DB. Nejprve ulož finální Teacher Notes.",
        )

    plain_text = _md_to_plain_text(teacher_md)

    class_grade = str(cls.grade) if cls.grade is not None else ""
    subject = (cls.subject or "").strip()
    chapter_title = (topic.title or "").strip()

    client = get_async_client()
    try:
        quiz_dict = await generate_quiz(
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
async def regenerate_quiz_for_topic(
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

    client = get_async_client()
    try:
        quiz_dict = await regenerate_quiz(
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


@router.get(
    "/{class_id}/{topic_id}/teacher-stats",
    response_model=TopicQuizTeacherStatsOut,
    response_model_exclude_none=True,
)
def get_teacher_topic_quiz_stats(
    class_id: int,
    topic_id: int,
    db: Session = Depends(get_db),
    teacher=Depends(get_current_teacher),
):
    topic = _require_teacher_class_topic(
        db, class_id=class_id, topic_id=topic_id, teacher_id=teacher.id
    )
    return _build_topic_quiz_teacher_stats(
        db, class_id=class_id, topic_id=topic_id, topic=topic
    )


@router.get(
    "/{class_id}/{topic_id}/teacher-stats/students/{student_id}/attempts/{attempt_id}",
    response_model=QuizAttemptDetailTeacherOut,
    response_model_exclude_none=True,
)
def get_teacher_student_quiz_attempt_detail(
    class_id: int,
    topic_id: int,
    student_id: int,
    attempt_id: str,
    db: Session = Depends(get_db),
    teacher=Depends(get_current_teacher),
):
    topic = _require_teacher_class_topic(
        db, class_id=class_id, topic_id=topic_id, teacher_id=teacher.id
    )
    _require_enrolled_student(db, class_id=class_id, student_id=student_id)
    aid = _parse_attempt_db_pk(attempt_id)
    attempt = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.id == aid,
            QuizAttempt.class_id == class_id,
            QuizAttempt.topic_id == topic_id,
            QuizAttempt.student_id == student_id,
            QuizAttempt.finished_at.isnot(None),
        )
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Quiz attempt not found")
    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    quiz_raw = (attempt.quiz_snapshot_json or topic.basic_quiz or "").strip()
    return _build_teacher_attempt_detail(attempt, quiz_raw, student=student)


@router.get(
    "/{class_id}/stats/overview",
    response_model=TeacherClassStatsOverviewOut,
    response_model_exclude_none=True,
)
def get_teacher_class_stats_overview(
    class_id: int,
    topic_id: Optional[int] = Query(default=None, ge=1),
    topic_ids: Optional[str] = Query(default=None, description="CSV topic ids, e.g. 1,2,3"),
    risk_threshold_percent: float = Query(default=50.0, ge=0.0, le=100.0),
    db: Session = Depends(get_db),
    teacher=Depends(get_current_teacher),
):
    scope_topic_ids = _parse_topic_ids_query(topic_id=topic_id, topic_ids_csv=topic_ids)
    _require_teacher_class(db, class_id=class_id, teacher_id=teacher.id)
    return _build_teacher_class_stats_overview(
        db,
        class_id=class_id,
        topic_ids=scope_topic_ids,
        risk_threshold_percent=risk_threshold_percent,
    )


@router.get(
    "/{class_id}/stats/trend",
    response_model=TeacherClassStatsTrendOut,
    response_model_exclude_none=True,
)
def get_teacher_class_stats_trend(
    class_id: int,
    topic_id: Optional[int] = Query(default=None, ge=1),
    topic_ids: Optional[str] = Query(default=None, description="CSV topic ids, e.g. 1,2,3"),
    period_days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    teacher=Depends(get_current_teacher),
):
    scope_topic_ids = _parse_topic_ids_query(topic_id=topic_id, topic_ids_csv=topic_ids)
    _require_teacher_class(db, class_id=class_id, teacher_id=teacher.id)
    return _build_teacher_class_stats_trend(
        db,
        class_id=class_id,
        topic_ids=scope_topic_ids,
        period_days=period_days,
    )


@router.get(
    "/{class_id}/stats/topics",
    response_model=TeacherClassTopicStatsOut,
    response_model_exclude_none=True,
)
def get_teacher_class_topic_stats(
    class_id: int,
    topic_id: Optional[int] = Query(default=None, ge=1),
    topic_ids: Optional[str] = Query(default=None, description="CSV topic ids, e.g. 1,2,3"),
    db: Session = Depends(get_db),
    teacher=Depends(get_current_teacher),
):
    scope_topic_ids = _parse_topic_ids_query(topic_id=topic_id, topic_ids_csv=topic_ids)
    _require_teacher_class(db, class_id=class_id, teacher_id=teacher.id)
    return _build_teacher_class_topic_stats(
        db,
        class_id=class_id,
        topic_ids=scope_topic_ids,
    )


@router.get(
    "/{class_id}/stats/risk-students",
    response_model=TeacherClassRiskStudentsOut,
    response_model_exclude_none=True,
)
def get_teacher_class_risk_students(
    class_id: int,
    topic_id: Optional[int] = Query(default=None, ge=1),
    topic_ids: Optional[str] = Query(default=None, description="CSV topic ids, e.g. 1,2,3"),
    threshold_percent: float = Query(default=50.0, ge=0.0, le=100.0),
    db: Session = Depends(get_db),
    teacher=Depends(get_current_teacher),
):
    scope_topic_ids = _parse_topic_ids_query(topic_id=topic_id, topic_ids_csv=topic_ids)
    _require_teacher_class(db, class_id=class_id, teacher_id=teacher.id)
    return _get_teacher_class_risk_students(
        db,
        class_id=class_id,
        topic_ids=scope_topic_ids,
        threshold_percent=threshold_percent,
        force_refresh=False,
    )


@router.post(
    "/{class_id}/stats/risk-students/regenerate",
    response_model=TeacherClassRiskStudentsOut,
    response_model_exclude_none=True,
)
def regenerate_teacher_class_risk_students(
    class_id: int,
    topic_id: Optional[int] = Query(default=None, ge=1),
    topic_ids: Optional[str] = Query(default=None, description="CSV topic ids, e.g. 1,2,3"),
    threshold_percent: float = Query(default=50.0, ge=0.0, le=100.0),
    db: Session = Depends(get_db),
    teacher=Depends(get_current_teacher),
):
    scope_topic_ids = _parse_topic_ids_query(topic_id=topic_id, topic_ids_csv=topic_ids)
    _require_teacher_class(db, class_id=class_id, teacher_id=teacher.id)
    return _get_teacher_class_risk_students(
        db,
        class_id=class_id,
        topic_ids=scope_topic_ids,
        threshold_percent=threshold_percent,
        force_refresh=True,
    )


def _escape_md_table_cell(text: str) -> str:
    return (text or "").replace("\n", " ").strip().replace("|", "\\|")


def _format_mm_ss_md(seconds: int) -> str:
    s = max(0, int(seconds))
    m, r = divmod(s, 60)
    return f"{m}:{r:02d}"


def _build_teacher_class_student_stats_markdown(
    first_name: str,
    last_name: str,
    rows: List[TeacherClassStudentTopicChartRowOut],
) -> str:
    fn = (first_name or "").strip()
    ln = (last_name or "").strip()
    name = f"{fn} {ln}".strip() or "Student"
    lines = [
        f"# {name}",
        "",
        "Souhrn za **dokončené hlavní kvízy** v této třídě (podle filtru témat na stránce statistik).",
        "",
        "| Téma | Pokusů | Max. body | Celkem času | Ø čas / pokus |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for r in rows:
        ttitle = _escape_md_table_cell(r.topic_title or f"Téma {r.topic_id}")
        avg_cell = (
            _format_mm_ss_md(int(round(r.avg_duration_sec)))
            if r.avg_duration_sec is not None
            else "—"
        )
        lines.append(
            f"| {ttitle} | {r.main_attempt_count} | {r.max_score:.1f} | "
            f"{_format_mm_ss_md(r.total_duration_sec)} | {avg_cell} |"
        )
    lines.append("")
    lines.append(
        "Grafy níže: počty pokusů, maximální dosažené body a průměrná délka jednoho pokusu v každém tématu."
    )
    return "\n".join(lines)


def _build_teacher_class_student_stats_detail(
    db: Session,
    *,
    class_id: int,
    student_id: int,
    topic_ids: Optional[List[int]],
    user: User,
) -> TeacherClassStudentDetailOut:
    topics = _class_topics_scope(db, class_id=class_id, topic_ids=topic_ids)
    if not topics:
        fn = (user.first_name or "").strip()
        ln = (user.last_name or "").strip()
        disp = f"{fn} {ln}".strip() or "Student"
        return TeacherClassStudentDetailOut(
            class_id=class_id,
            student_id=student_id,
            first_name=user.first_name or "",
            last_name=user.last_name or "",
            summary_markdown=f"# {disp}\n\nV rozsahu filtru nejsou žádná aktivní témata.",
            topics=[],
        )

    topic_ids = [int(t.id) for t in topics]
    attempts = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.class_id == class_id,
            QuizAttempt.student_id == student_id,
            QuizAttempt.topic_id.in_(topic_ids),
            QuizAttempt.finished_at.isnot(None),
            QuizAttempt.attempt_kind == "main",
        )
        .order_by(QuizAttempt.finished_at.asc())
        .all()
    )
    by_topic: Dict[int, List[QuizAttempt]] = {}
    for a in attempts:
        by_topic.setdefault(int(a.topic_id), []).append(a)

    rows: List[TeacherClassStudentTopicChartRowOut] = []
    for t in topics:
        tid = int(t.id)
        lst = by_topic.get(tid, [])
        n = len(lst)
        max_sc = max((float(x.score) for x in lst), default=0.0)
        total_dur = sum(int(x.duration_sec) for x in lst)
        avg_dur = float(total_dur) / n if n else None
        rows.append(
            TeacherClassStudentTopicChartRowOut(
                topic_id=tid,
                topic_title=(t.title or "").strip(),
                main_attempt_count=n,
                max_score=max_sc,
                total_duration_sec=total_dur,
                avg_duration_sec=avg_dur,
            )
        )

    summary_md = _build_teacher_class_student_stats_markdown(
        user.first_name or "",
        user.last_name or "",
        rows,
    )
    return TeacherClassStudentDetailOut(
        class_id=class_id,
        student_id=student_id,
        first_name=user.first_name or "",
        last_name=user.last_name or "",
        summary_markdown=summary_md,
        topics=rows,
    )


@router.get(
    "/{class_id}/stats/students/{student_id}/detail",
    response_model=TeacherClassStudentDetailOut,
    response_model_exclude_none=True,
)
def get_teacher_class_student_stats_detail(
    class_id: int,
    student_id: int,
    topic_id: Optional[int] = Query(default=None, ge=1),
    topic_ids: Optional[str] = Query(default=None, description="CSV topic ids, e.g. 1,2,3"),
    db: Session = Depends(get_db),
    teacher=Depends(get_current_teacher),
):
    scope_topic_ids = _parse_topic_ids_query(topic_id=topic_id, topic_ids_csv=topic_ids)
    _require_teacher_class(db, class_id=class_id, teacher_id=teacher.id)
    _require_enrolled_student(db, class_id=class_id, student_id=student_id)
    user = db.query(User).filter(User.id == student_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")
    return _build_teacher_class_student_stats_detail(
        db,
        class_id=class_id,
        student_id=student_id,
        topic_ids=scope_topic_ids,
        user=user,
    )


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


@router.post("/{class_id}/{topic_id}/bonus/start", response_model=QuizStartOut)
async def student_bonus_quiz_start(
    class_id: int,
    topic_id: int,
    db: Session = Depends(get_db),
    student=Depends(require_student),
):
    _require_enrolled_student(db, class_id=class_id, student_id=student.id)
    topic = _load_topic_for_student(db, class_id=class_id, topic_id=topic_id)

    notes_md = (topic.student_notes_md or "").strip()
    if not notes_md:
        raise HTTPException(
            status_code=400,
            detail="Bonusový kvíz vyžaduje uložené studentské poznámky k tématu.",
        )

    base_raw = (topic.basic_quiz or "").strip()
    if not base_raw:
        raise HTTPException(
            status_code=400,
            detail="Pro toto téma zatím není uložený kvíz.",
        )
    try:
        parse_quiz_json_to_quiz_out(base_raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    main_attempt = _latest_finished_main_attempt(
        db, class_id=class_id, topic_id=topic_id, student_id=student.id
    )
    if not main_attempt:
        raise HTTPException(
            status_code=400,
            detail="Nejprve dokonči hlavní kvíz.",
        )

    answers_rows = _coerce_stored_answer_rows(main_attempt.answers_json)
    max_score = _max_score_from_stored_answers(answers_rows)
    if max_score <= 0:
        score_pct = 0.0
    else:
        score_pct = 100.0 * float(main_attempt.score) / max_score

    tier = tier_from_score_pct(score_pct)

    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    class_grade = str(cls.grade) if cls.grade is not None else ""
    subject = (cls.subject or "").strip()
    chapter_title = (topic.title or "").strip()
    mistakes_str = _mistakes_json_for_bonus_prompt(main_attempt.mistakes_json)

    client = get_async_client()
    try:
        quiz_dict = await generate_bonus_quiz(
            client,
            tier=tier,
            class_grade=class_grade,
            subject=subject,
            chapter_title=chapter_title,
            student_notes_md=notes_md,
            mistakes_json=mistakes_str,
            base_quiz_json=base_raw,
            score=float(main_attempt.score),
            score_pct=float(score_pct),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    quiz_snapshot_json = json.dumps(quiz_dict, ensure_ascii=False)
    try:
        quiz_out = parse_quiz_json_to_quiz_out(quiz_snapshot_json)
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
        attempt_kind="bonus",
        quiz_snapshot_json=quiz_snapshot_json,
    )

    public = quiz_out_to_public(QuizOut.model_validate({"questions": ordered}))

    with _cache_lock:
        _attempts[attempt_id] = state

    return QuizStartOut(attempt_id=attempt_id, questions=public.questions)


@router.post(
    "/{class_id}/{topic_id}/attempts/{attempt_id}/answer",
    response_model=QuizSubmitAnswerOut,
)
async def student_quiz_submit_answer(
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
        client = get_async_client()
        try:
            eval_result = await evaluate_final_open_answer(
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
        answer_entry: Dict[str, Any] = {
            "is_correct": out.is_correct,
            "score_delta": out.score_delta,
            "explanation": out.explanation,
            "feedback": out.feedback,
            "answer_text": payload.answer,
        }
        if q_type == "final_open":
            answer_entry["teacher_summary"] = (eval_result.teacher_summary or "").strip() or None
            answer_entry["teacher_recommendation"] = (eval_result.teacher_recommendation or "").strip() or None
            answer_entry["criteria"] = eval_result.criteria.model_dump()
        state.answers[payload.question_id] = answer_entry

    return out


@router.post("/{class_id}/{topic_id}/attempts/{attempt_id}/tutor")
def student_quiz_tutor_sse(
    class_id: int,
    topic_id: int,
    attempt_id: str,
    payload: TutorMessageIn,
    db: Session = Depends(get_db),
    student=Depends(require_student),
):
    """
    SSE tutor during the current unanswered question only.
    Quiz question text for the LLM excludes correct_answer and explanation.
    """
    _require_enrolled_student(db, class_id=class_id, student_id=student.id)
    _load_topic_for_student(db, class_id=class_id, topic_id=topic_id)

    client = get_client()
    user_msg = (payload.message or "").strip()

    with _cache_lock:
        state = _get_attempt_locked(attempt_id, student.id)
        if state.class_id != class_id or state.topic_id != topic_id:
            raise HTTPException(status_code=404, detail="Quiz attempt not found")

        if state.finished:
            raise HTTPException(status_code=400, detail="Pokus je již uzavřen.")

        expected = _current_question_id(state)
        if expected is None:
            raise HTTPException(
                status_code=400,
                detail="Tutor je dostupný jen u aktivní otázky.",
            )
        if payload.question_id != expected:
            raise HTTPException(
                status_code=400,
                detail="Tutor lze použít jen u aktuální otázky v pořadí.",
            )

        _tutor_reset_messages_if_question_changed(state, payload.question_id)
        _ensure_tutor_context_locked(db, state)

        q = state.questions_by_id.get(payload.question_id)
        if not q:
            raise HTTPException(status_code=400, detail="Neznámá otázka.")

        kviz_text = _quiz_question_student_facing_text(q)
        messages_before = copy.deepcopy(state.tutor_messages)
        predmet = state.tutor_subject or ""
        trida = state.tutor_grade_label or ""
        nazev = state.tutor_chapter_title or ""
        notes_excerpt = state.tutor_student_notes_md or ""
        stuck_before = state.tutor_stuck_count

    sid = student.id

    def event_stream():
        try:
            yield _tutor_sse_line({"type": "status", "phase": "checking"})

            classification = classify_with_fast_path(
                client,
                user_message=user_msg,
                tutor_messages=messages_before,
                predmet=predmet,
                trida=trida,
                nazev_kapitoly=nazev,
                kvizova_otazka=kviz_text,
            )

            refuse_kind = should_refuse(classification)
            if refuse_kind is not None:
                refusal = refusal_message_for_reason(refuse_kind)
                new_stuck = update_stuck_count(user_msg, stuck_before)
                yield _tutor_sse_line({"type": "reject", "text": refusal})
                yield _tutor_sse_line({"type": "done"})
                _tutor_append_turn(
                    attempt_id,
                    sid,
                    user_msg,
                    refusal,
                    new_stuck_count=new_stuck,
                )
                return

            stuck_for_prompt = update_stuck_count(user_msg, stuck_before)

            yield _tutor_sse_line({"type": "status", "phase": "answering"})

            pieces: List[str] = []
            for chunk in stream_tutor_reply(
                client,
                predmet=predmet,
                trida=trida,
                nazev_kapitoly=nazev,
                kvizova_otazka=kviz_text,
                student_notes_excerpt=notes_excerpt,
                tutor_messages_before_user=messages_before,
                user_message_plain=user_msg,
                intent=classification.intent,
                stuck_count=stuck_for_prompt,
            ):
                pieces.append(chunk)
                yield _tutor_sse_line({"type": "token", "text": chunk})

            draft = "".join(pieces).strip()
            if not draft:
                draft = (
                    "Omlouvám se, nepodařilo se vygenerovat odpověď. "
                    "Zkus prosím otázku znovu formulovat."
                )

            final_text = draft
            if looks_like_prompt_leak(final_text):
                final_text = SAFE_FALLBACK_LEAK
                yield _tutor_sse_line({"type": "replace", "text": final_text})
            else:
                safety_ctx = messages_before + [
                    {"role": "user", "content": user_msg},
                    {"role": "assistant", "content": draft},
                ]
                safety = check_answer_safe(
                    client,
                    draft_answer=draft,
                    dotaz=user_msg,
                    kvizova_otazka=kviz_text,
                    tutor_messages=safety_ctx,
                )

                if not safety.safe:
                    try:
                        final_text = rewrite_unsafe_answer(
                            client,
                            draft_answer=draft,
                            dotaz=user_msg,
                            kvizova_otazka=kviz_text,
                            issue_summary=safety.issue_summary or "",
                            tutor_messages=safety_ctx,
                        )
                    except Exception:
                        logger.exception("Tutor rewrite failed after unsafe guard")
                        final_text = (
                            "Zkus prosím jinak formulovat dotaz — nemohu ti přímo "
                            "sdělit odpověď na tuto kvízovou otázku."
                        )
                    if looks_like_prompt_leak(final_text):
                        final_text = SAFE_FALLBACK_LEAK
                    yield _tutor_sse_line({"type": "replace", "text": final_text})

            yield _tutor_sse_line({"type": "done"})
            _tutor_append_turn(
                attempt_id,
                sid,
                user_msg,
                final_text,
                new_stuck_count=stuck_for_prompt,
            )

        except Exception:
            logger.exception("Tutor SSE pipeline failed")
            yield _tutor_sse_line(
                {
                    "type": "error",
                    "message": "Asistent dočasně selhal. Zkus to prosím znovu.",
                }
            )
            yield _tutor_sse_line({"type": "done"})

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers=headers,
    )


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

        if (state.attempt_kind or "main") == "bonus":
            finished_at = datetime.now(timezone.utc)
            duration_sec = max(
                0,
                int((finished_at - state.started_at).total_seconds()),
            )
            preview = _build_runtime_student_attempt_detail(
                state,
                finished_at=finished_at,
                duration_sec=duration_sec,
                summary=summary,
            )
            final_summary = QuizFinishOut(
                attempt_id=EPHEMERAL_QUIZ_ATTEMPT_ID,
                total_score=summary.total_score,
                max_score=summary.max_score,
                question_count=summary.question_count,
                results_preview=preview,
            )
            state.finished = True
            state.finish_summary = final_summary
        else:
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
    "/{class_id}/{topic_id}/my-attempts",
    response_model=List[QuizAttemptListItemStudentOut],
    response_model_exclude_none=True,
)
def list_student_quiz_attempts(
    class_id: int,
    topic_id: int,
    db: Session = Depends(get_db),
    student=Depends(require_student),
):
    _require_enrolled_student(db, class_id=class_id, student_id=student.id)
    _load_topic_for_student(db, class_id=class_id, topic_id=topic_id)

    rows = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.class_id == class_id,
            QuizAttempt.topic_id == topic_id,
            QuizAttempt.student_id == student.id,
            QuizAttempt.finished_at.isnot(None),
        )
        .order_by(QuizAttempt.finished_at.asc(), QuizAttempt.id.asc())
        .all()
    )
    return [_student_attempt_list_item(a) for a in rows]


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

    quiz_raw = (attempt.quiz_snapshot_json or topic.basic_quiz or "").strip()
    return _build_student_attempt_detail(attempt, quiz_raw)
