from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from database.database import get_db
from models.users import User
from models.classes import Class
from app.deps.auth import require_teacher
from app.schemas.classes import ClassOut, ClassUpdate

router = APIRouter(tags=["classes"])


def to_class_out(cl: Class) -> ClassOut:
    return ClassOut(
        id=cl.id,
        subject=cl.subject,
        teacher_id=cl.teacher_id,
        grade=cl.grade,
        custom_name=cl.custom_name,
        note=cl.note,
        active=bool(cl.active),
        num_students=len(cl.enrollments) if cl.enrollments else 0,
    )


@router.get("/teacher/{teacher_id}", response_model=List[ClassOut])
def get_classes_for_teacher(teacher_id: int, db: Session = Depends(get_db)):
    teacher = (
        db.query(User)
        .filter(User.id == teacher_id, User.role == "teacher")
        .first()
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    classes = (
        db.query(Class)
        .filter(Class.teacher_id == teacher_id)
        .options(joinedload(Class.enrollments))
        .all()
    )

    return [to_class_out(cl) for cl in classes]


@router.get("/me", response_model=List[ClassOut])
def classes_me(user=Depends(require_teacher), db: Session = Depends(get_db)):
    classes = (
        db.query(Class)
        .filter(Class.teacher_id == user.id)
        .options(joinedload(Class.enrollments))
        .all()
    )

    return [to_class_out(cl) for cl in classes]


@router.get("/{class_id}", response_model=ClassOut)
def get_class_detail(class_id: int, user=Depends(require_teacher), db: Session = Depends(get_db)):
    cl = (
        db.query(Class)
        .filter(Class.id == class_id, Class.teacher_id == user.id)
        .options(joinedload(Class.enrollments))
        .first()
    )
    if not cl:
        raise HTTPException(status_code=404, detail="Class not found")
    return to_class_out(cl)


@router.put("/{class_id}", response_model=ClassOut)
def update_class(class_id: int, payload: ClassUpdate, user=Depends(require_teacher), db: Session = Depends(get_db)):
    cl = db.query(Class).filter(Class.id == class_id, Class.teacher_id == user.id).first()
    if not cl:
        raise HTTPException(status_code=404, detail="Class not found")

    if payload.subject is not None:
        s = payload.subject.strip()
        if not s:
            raise HTTPException(status_code=422, detail="Subject cannot be empty")
        cl.subject = s

    if payload.grade is not None:
        cl.grade = payload.grade

    if payload.custom_name is not None:
        v = payload.custom_name.strip()
        cl.custom_name = v if v else None

    if payload.note is not None:
        v = payload.note.strip()
        cl.note = v if v else None

    if payload.active is not None:
        cl.active = bool(payload.active)

    db.commit()
    db.refresh(cl)

    cl = db.query(Class).filter(Class.id == class_id).options(joinedload(Class.enrollments)).first()
    return to_class_out(cl)
