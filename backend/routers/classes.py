from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from database.database import get_db
from models.users import User
from models.classes import Class
from app.deps.auth import require_teacher
from app.schemas.classes import ClassOut


router = APIRouter(tags=["classes"])


@router.get("/teacher/{teacher_id}", response_model=List[ClassOut])
def get_classes_for_teacher(teacher_id: int, db: Session = Depends(get_db)):
    teacher = (
        db.query(User)
        .filter(User.id == teacher_id, User.role == "teacher")
        .first()
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    return db.query(Class).filter(Class.teacher_id == teacher_id).all()


@router.get("/me")
def classes_me(user=Depends(require_teacher), db: Session = Depends(get_db)):
    return db.query(Class).filter(Class.teacher_id == user.id).all()

@router.get("/{class_id}", response_model=ClassOut)
def get_class_detail(class_id: int, user=Depends(require_teacher), db: Session = Depends(get_db)):
    cl = db.query(Class).filter(Class.id == class_id, Class.teacher_id == user.id).first()
    if not cl:
        raise HTTPException(status_code=404, detail="Class not found")
    return cl