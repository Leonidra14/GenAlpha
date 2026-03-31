import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.database import get_db
from app.deps.auth import get_current_user as get_current_teacher

from models.topics import Topic
from models.classes import Class

from app.core.openai_client import get_openai_client as get_client
from ai.Quiz.quiz_workflow import generate_quiz

router = APIRouter(prefix="/quiz", tags=["quiz"])


class QuizGenerateIn(BaseModel):
    mcq: int = 8
    yesno: int = 4
    final_open: int = 1


class QuizSaveIn(BaseModel):
    quiz_json: str  # uložíme jako TEXT


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


@router.put("/{class_id}/{topic_id}/final")
def save_final_quiz(
    class_id: int,
    topic_id: int,
    payload: QuizSaveIn,
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
        json.loads(payload.quiz_json)
    except Exception:
        raise HTTPException(status_code=400, detail="quiz_json není validní JSON string")

    topic.basic_quiz = payload.quiz_json
    db.add(topic)
    db.commit()

    return {"ok": True}
