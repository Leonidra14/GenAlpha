from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from sqlalchemy import or_


from database.database import get_db
from app.deps.auth import require_teacher
from models.classes import Class
from models.enrollments import Enrollment
from models.users import User
from app.schemas.students import StudentCreate, StudentPasswordUpdate, StudentOut
from app.schemas.enrollments import EnrollmentOut
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


@router.delete("/{class_id}/students/{student_id}")
def remove_student_from_class(
    class_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    cls = (
        db.query(Class)
        .filter(Class.id == class_id, Class.teacher_id == teacher.id)
        .first()
    )
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    existing = (
        db.query(Enrollment.class_id, Enrollment.student_id, Enrollment.id)
        .filter(Enrollment.class_id == class_id)
        .all()
    )
    print("DEBUG enrollments for class", class_id, "=>", existing)

    deleted_rows = (
        db.query(Enrollment)
        .filter(Enrollment.class_id == class_id, Enrollment.student_id == student_id)
        .delete(synchronize_session=False)
    )

    if deleted_rows == 0:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    db.commit()
    return {"ok": True, "deleted": deleted_rows}

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

@router.put("/{class_id}/students/{student_id}/password")
def set_student_password(
    class_id: int,
    student_id: int,
    payload: StudentPasswordUpdate,
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    # ověř, že třída patří učiteli
    cls = (
        db.query(Class)
        .filter(Class.id == class_id, Class.teacher_id == teacher.id)
        .first()
    )
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    # ověř, že student je ve třídě zapsaný
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.class_id == class_id, Enrollment.student_id == student_id)
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    # najdi studenta
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # nastav nové heslo
    student.hashed_password = hash_password(payload.password)
    db.commit()

    return {"ok": True}

@router.get("/{class_id}/students/available", response_model=list[StudentOut])
def available_students_for_class(
    class_id: int,
    q: Optional[str] = None,  # query pro hledání
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    cls = (
        db.query(Class)
        .filter(Class.id == class_id, Class.teacher_id == teacher.id)
        .first()
    )
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    # subquery: student_id kteří už jsou zapsaní
    enrolled_subq = (
        db.query(Enrollment.student_id)
        .filter(Enrollment.class_id == class_id)
        .subquery()
    )

    query = (
        db.query(User)
        .filter(User.role == "student")
        .filter(~User.id.in_(enrolled_subq))
    )

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                User.email.ilike(term),
                User.id.ilike(term),
            )
        )

    students = query.order_by(User.last_name.asc(), User.first_name.asc(), User.id.asc()).all()
    return students

@router.post("/{class_id}/students/{student_id}")
def enroll_existing_student(
    class_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    # ověř, že třída patří učiteli
    cls = (
        db.query(Class)
        .filter(Class.id == class_id, Class.teacher_id == teacher.id)
        .first()
    )
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    # ověř, že student existuje a je role student
    student = (
        db.query(User)
        .filter(User.id == student_id, User.role == "student")
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # už je zapsaný?
    existing = (
        db.query(Enrollment)
        .filter(Enrollment.class_id == class_id, Enrollment.student_id == student_id)
        .first()
    )
    if existing:
        return {"ok": True, "already_enrolled": True}

    enrollment = Enrollment(class_id=class_id, student_id=student_id)
    db.add(enrollment)
    db.commit()

    return {"ok": True}