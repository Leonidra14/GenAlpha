"""Persist and read final teacher/student markdown for a topic (separate from AI generation)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.database import get_db
from app.deps.auth import require_teacher
from models.classes import Class
from models.topics import Topic
from app.schemas.topic_notes import FinalNotesPatchIn, FinalNotesOut

router = APIRouter() 


def _assert_teacher_owns_topic(db: Session, class_id: int, topic_id: int, teacher_id: int) -> Topic:
    cls = db.query(Class).filter(
        Class.id == class_id,
        Class.teacher_id == teacher_id,
    ).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    topic = db.query(Topic).filter(
        Topic.id == topic_id,
        Topic.class_id == class_id,
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    return topic


@router.get("/classes/{class_id}/topics/{topic_id}/final-notes", response_model=FinalNotesOut)
def get_final_notes(
    class_id: int,
    topic_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_teacher),
):
    topic = _assert_teacher_owns_topic(db, class_id, topic_id, user.id)

    updated_at = None
    if getattr(topic, "updated_at", None):
        try:
            updated_at = topic.updated_at.isoformat()
        except Exception:
            updated_at = str(topic.updated_at)

    return FinalNotesOut(
        teacher_notes_md=(topic.teacher_notes_md or "").strip(),
        student_notes_md=(topic.student_notes_md or "").strip(),
        updated_at=updated_at,
    )


@router.patch("/classes/{class_id}/topics/{topic_id}/final-notes")
def patch_final_notes(
    class_id: int,
    topic_id: int,
    payload: FinalNotesPatchIn,
    db: Session = Depends(get_db),
    user=Depends(require_teacher),
):
    topic = _assert_teacher_owns_topic(db, class_id, topic_id, user.id)

    updated = {"teacher": False, "student": False}

    if payload.teacher_notes_md is not None:
        md = payload.teacher_notes_md.strip()
        if not md:
            raise HTTPException(status_code=400, detail="teacher_notes_md je prázdné.")
        topic.teacher_notes_md = md
        updated["teacher"] = True

    if payload.student_notes_md is not None:
        md = payload.student_notes_md.strip()
        if not md:
            raise HTTPException(status_code=400, detail="student_notes_md je prázdné.")
        topic.student_notes_md = md
        updated["student"] = True

    if not updated["teacher"] and not updated["student"]:
        raise HTTPException(status_code=400, detail="Nothing to save (send teacher_notes_md or student_notes_md).")

    db.add(topic)
    db.commit()
    db.refresh(topic)

    return {"ok": True, "topic_id": topic.id, "updated": updated}
