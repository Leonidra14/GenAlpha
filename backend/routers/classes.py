# app/routers/classes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from database.database import get_db
from models.users import User
from models.classes import Class

from pydantic import BaseModel


class ClassInfo(BaseModel):
    class_id: int
    name: str
    num_students: int
    last_assignment: Optional[str] = None

    class Config:
        # pydantic v2
        from_attributes = True


router = APIRouter(prefix="/classes", tags=["classes"])


@router.get("/teacher/{teacher_id}", response_model=List[ClassInfo])
def get_classes_for_teacher(teacher_id: int, db: Session = Depends(get_db)):
    # ověření, že učitel existuje
    teacher = (
        db.query(User)
        .filter(User.id == teacher_id, User.role == "teacher")
        .first()
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    # načtení tříd
    classes = (
        db.query(Class)
        .filter(Class.teacher_id == teacher_id)
        .options(joinedload(Class.enrollments))
        .all()
    )

    result: List[ClassInfo] = []
    for cl in classes:
        num_students = len(cl.enrollments)
        last_assignment_title = None  # teď žádné assignments nemáme

        result.append(
            ClassInfo(
                class_id=cl.id,
                name=cl.name,
                num_students=num_students,
                last_assignment=last_assignment_title,
            )
        )

    return result
