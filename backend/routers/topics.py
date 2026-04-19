"""Teacher CRUD for topics under a class, plus copy/import between topics."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database.database import get_db
from app.deps.auth import require_teacher

from models.classes import Class
from models.topics import Topic
from app.schemas.topics import TopicOut, TopicCreate, TopicUpdate, TopicImport

router = APIRouter(tags=["topics"])


def ensure_teacher_owns_class(db: Session, class_id: int, teacher_id: int) -> Class:
    cl = db.query(Class).filter(Class.id == class_id, Class.teacher_id == teacher_id).first()
    if not cl:
        raise HTTPException(status_code=404, detail="Class not found")
    return cl

def ensure_teacher_owns_topic(db: Session, topic_id: int, teacher_id: int) -> Topic:
    topic = (
        db.query(Topic)
        .join(Class, Topic.class_id == Class.id)
        .filter(Topic.id == topic_id, Class.teacher_id == teacher_id)
        .first()
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Source topic not found")
    return topic



@router.get("/classes/{class_id}/topics", response_model=List[TopicOut])
def list_topics(class_id: int, user=Depends(require_teacher), db: Session = Depends(get_db)):
    ensure_teacher_owns_class(db, class_id, user.id)

    return (
        db.query(Topic)
        .filter(Topic.class_id == class_id)
        .order_by(Topic.created_at.asc(), Topic.id.asc())
        .all()
    )


@router.post("/classes/{class_id}/topics", response_model=TopicOut)
def create_topic(class_id: int, payload: TopicCreate, user=Depends(require_teacher), db: Session = Depends(get_db)):
    ensure_teacher_owns_class(db, class_id, user.id)

    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Title is required")

    topic = Topic(
        class_id=class_id,
        title=title,
        active=True if payload.active is None else bool(payload.active),
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


@router.put("/classes/{class_id}/topics/{topic_id}", response_model=TopicOut)
def update_topic(class_id: int, topic_id: int, payload: TopicUpdate, user=Depends(require_teacher), db: Session = Depends(get_db)):
    ensure_teacher_owns_class(db, class_id, user.id)

    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.class_id == class_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    if payload.title is not None:
        t = payload.title.strip()
        if not t:
            raise HTTPException(status_code=422, detail="Title cannot be empty")
        topic.title = t

    if payload.active is not None:
        topic.active = bool(payload.active)

    db.commit()
    db.refresh(topic)
    return topic


@router.delete("/classes/{class_id}/topics/{topic_id}")
def delete_topic(class_id: int, topic_id: int, user=Depends(require_teacher), db: Session = Depends(get_db)):
    ensure_teacher_owns_class(db, class_id, user.id)

    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.class_id == class_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    db.delete(topic)
    db.commit()
    return {"ok": True}

@router.post("/classes/{class_id}/topics/import", response_model=TopicOut)
def import_topic(
    class_id: int,
    payload: TopicImport,
    user=Depends(require_teacher),
    db: Session = Depends(get_db),
):
    ensure_teacher_owns_class(db, class_id, user.id)

    source = ensure_teacher_owns_topic(db, payload.source_topic_id, user.id)

    copied = Topic(
        class_id=class_id,
        title=source.title,
        active=source.active,
    )

    db.add(copied)
    db.commit()
    db.refresh(copied)
    return copied
