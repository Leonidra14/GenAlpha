from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from database.database import get_db
from app.deps.auth import require_teacher
from models.classes import Class
from models.enrollments import Enrollment
from models.users import User
from app.schemas.students import EnrollmentOut, StudentCreate, StudentPasswordUpdate
from app.core.security import hash_password

router = APIRouter(tags=["enrollments"])

def ensure_teacher_owns_class(db: Session, class_id: int, teacher_id: int) -> Class:
    cl = db.query(Class).filter(Class.id == class_id, Class.teacher_id == teacher_id).first()
    if not cl:
        raise HTTPException(status_code=404, detail="Class not found")
    return cl


@router.get("/classes/{class_id}/students", response_model=List[EnrollmentOut])
def list_class_students(class_id: int, user=Depends(require_teacher), db: Session = Depends(get_db)):
    ensure_teacher_owns_class(db, class_id, user.id)

    enrolls = (
        db.query(Enrollment)
        .filter(Enrollment.class_id == class_id)
        .options(joinedload(Enrollment.student))
        .order_by(Enrollment.created_at.asc())
        .all()
    )
    return enrolls


@router.post("/classes/{class_id}/students", response_model=EnrollmentOut)
def create_and_enroll_student(class_id: int, payload: StudentCreate, user=Depends(require_teacher), db: Session = Depends(get_db)):
    ensure_teacher_owns_class(db, class_id, user.id)

    fn = payload.first_name.strip()
    ln = payload.last_name.strip()
    if not fn or not ln:
        raise HTTPException(status_code=422, detail="First name and last name are required")

    pw = payload.password
    if not pw or len(pw) < 8 or len(pw) > 72:
        raise HTTPException(status_code=422, detail="Password must be 8–72 characters")

    student = User(
        first_name=fn,
        last_name=ln,
        email=payload.email.strip() if payload.email else None,
        role="student",
        hashed_password=hash_password(pw),
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    enr = Enrollment(class_id=class_id, student_id=student.id)
    db.add(enr)
    db.commit()
    db.refresh(enr)

    enr = (
        db.query(Enrollment)
        .filter(Enrollment.id == enr.id)
        .options(joinedload(Enrollment.student))
        .first()
    )
    return enr


@router.delete("/classes/{class_id}/students/{student_id}")
def remove_student(class_id: int, student_id: int, user=Depends(require_teacher), db: Session = Depends(get_db)):
    ensure_teacher_owns_class(db, class_id, user.id)

    enr = db.query(Enrollment).filter(Enrollment.class_id == class_id, Enrollment.student_id == student_id).first()
    if not enr:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    db.delete(enr)
    db.commit()
    return {"ok": True}


@router.put("/classes/{class_id}/students/{student_id}/password")
def set_student_password(class_id: int, student_id: int, payload: StudentPasswordUpdate, user=Depends(require_teacher), db: Session = Depends(get_db)):
    ensure_teacher_owns_class(db, class_id, user.id)

    enr = db.query(Enrollment).filter(Enrollment.class_id == class_id, Enrollment.student_id == student_id).first()
    if not enr:
        raise HTTPException(status_code=404, detail="Student is not enrolled in this class")

    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    pw = payload.password
    if not pw or len(pw) < 8 or len(pw) > 72:
        raise HTTPException(status_code=422, detail="Password must be 8–72 characters")

    student.hashed_password = hash_password(pw)
    db.commit()

    return {"ok": True}
