"""Classes and topics CRUD for teachers, student class/topic views, enrollments listing, leaderboards."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from sqlalchemy import and_, func
from datetime import datetime


from database.database import get_db
from models.users import User
from models.classes import Class
from app.deps.auth import require_teacher, require_student
from app.schemas.classes import ClassOut, ClassUpdate
from models.enrollments import Enrollment
from app.schemas.students import StudentOut
from app.schemas.classes import ClassCreate
from models.topics import Topic
from app.schemas.topics import TopicOut
from models.topic_progress import TopicProgress
from models.quiz_attempts import QuizAttempt
from app.schemas.students import StudentClassDetailOut
from app.schemas.topic_progress import (
    MainQuizLeaderboardOut,
    MainQuizLeaderboardPodiumEntryOut,
    StudentTopicDetailOut,
    TopicWithProgressOut,
    TopicProgressUpdateIn,
)




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

    if "custom_name" in payload.model_fields_set:
        v = (payload.custom_name or "").strip()
        cl.custom_name = v if v else None

    if "note" in payload.model_fields_set:
        v = (payload.note or "").strip()
        cl.note = v if v else None

    if payload.active is not None:
        cl.active = bool(payload.active)

    db.commit()
    db.refresh(cl)

    cl = db.query(Class).filter(Class.id == class_id).options(joinedload(Class.enrollments)).first()
    return to_class_out(cl)

@router.get("/{class_id}/students", response_model=list[StudentOut])
def get_students_for_class(
    class_id: int,
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
    ):
    cls = db.query(Class).filter(Class.id == class_id, Class.teacher_id == teacher.id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    students = (
        db.query(User)
        .join(Enrollment, Enrollment.student_id == User.id)
        .filter(Enrollment.class_id == class_id)
        .filter(User.role == "student")
        .order_by(User.last_name.asc(), User.first_name.asc(), User.id.asc())
        .all()
    )

    return students

@router.post("", response_model=ClassOut)
def create_class(
    payload: ClassCreate,
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    if not payload.subject.strip():
        raise HTTPException(status_code=400, detail="Subject is required")
    if payload.grade is None or payload.grade <= 0:
        raise HTTPException(status_code=400, detail="Grade must be a positive number")

    cls = Class(
        subject=payload.subject.strip(),
        grade=payload.grade,
        custom_name=payload.custom_name.strip() if payload.custom_name and payload.custom_name.strip() else None,
        note=payload.note.strip() if payload.note and payload.note.strip() else None,
        active=payload.active,
        teacher_id=teacher.id,
    )

    db.add(cls)
    db.commit()
    db.refresh(cls)

    try:
        cls.num_students = 0
    except Exception:
        pass

    return cls


# ==========================
# STUDENT ENDPOINTS
# ==========================

@router.get("/student/classes", response_model=List[ClassOut])
def student_classes_me(user=Depends(require_student), db: Session = Depends(get_db)):
    classes = (
        db.query(Class)
        .join(Enrollment, Enrollment.class_id == Class.id)
        .filter(Enrollment.student_id == user.id)
        .options(joinedload(Class.enrollments))
        .all()
    )
    return [to_class_out(cl) for cl in classes]


@router.get("/student/classes/{class_id}", response_model=StudentClassDetailOut)
def student_class_detail(class_id: int, user=Depends(require_student), db: Session = Depends(get_db)):
    enr = db.query(Enrollment).filter(
        Enrollment.class_id == class_id,
        Enrollment.student_id == user.id
    ).first()
    if not enr:
        raise HTTPException(status_code=403, detail="Not enrolled in this class")

    cl = db.query(Class).filter(Class.id == class_id).first()
    if not cl:
        raise HTTPException(status_code=404, detail="Class not found")

    teacher = db.query(User).filter(User.id == cl.teacher_id).first()

    return StudentClassDetailOut(
        id=cl.id,
        subject=cl.subject,
        grade=cl.grade,
        custom_name=cl.custom_name,
        note=cl.note,
        active=bool(cl.active),
        teacher_first_name=getattr(teacher, "first_name", None),
        teacher_last_name=getattr(teacher, "last_name", None),
    )


@router.get("/student/classes/{class_id}/topics", response_model=List[TopicWithProgressOut])
def student_class_topics(class_id: int, user=Depends(require_student), db: Session = Depends(get_db)):
    enr = db.query(Enrollment).filter(
        Enrollment.class_id == class_id,
        Enrollment.student_id == user.id
    ).first()
    if not enr:
        raise HTTPException(status_code=403, detail="Not enrolled in this class")

    rows = (
        db.query(Topic, TopicProgress)
        .outerjoin(
            TopicProgress,
            and_(
                TopicProgress.topic_id == Topic.id,
                TopicProgress.student_id == user.id,
            )
        )
        .filter(Topic.class_id == class_id, Topic.active == True)
        .order_by(Topic.created_at.asc(), Topic.id.asc())
        .all()
    )

    out = []
    for topic, prog in rows:
        out.append(
            TopicWithProgressOut(
                id=topic.id,
                title=topic.title,
                active=topic.active,
                created_at=topic.created_at,
                class_id=topic.class_id,
                done=bool(prog.done) if prog else False,
                last_opened_at=prog.last_opened_at if prog else None,
            )
        )

    return out


@router.get("/student/classes/{class_id}/topics/{topic_id}", response_model=StudentTopicDetailOut)
def student_topic_detail(
    class_id: int,
    topic_id: int,
    user=Depends(require_student),
    db: Session = Depends(get_db),
):
    enr = db.query(Enrollment).filter(
        Enrollment.class_id == class_id,
        Enrollment.student_id == user.id,
    ).first()
    if not enr:
        raise HTTPException(status_code=403, detail="Not enrolled in this class")

    topic = db.query(Topic).filter(
        Topic.id == topic_id,
        Topic.class_id == class_id,
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    quiz_available = bool((topic.basic_quiz or "").strip())
    notes_nonempty = bool((topic.student_notes_md or "").strip())
    bonus_quiz_available = False
    if quiz_available and notes_nonempty:
        bonus_quiz_available = (
            db.query(QuizAttempt)
            .filter(
                QuizAttempt.class_id == class_id,
                QuizAttempt.topic_id == topic_id,
                QuizAttempt.student_id == user.id,
                QuizAttempt.finished_at.isnot(None),
                QuizAttempt.attempt_kind == "main",
            )
            .first()
            is not None
        )

    return StudentTopicDetailOut(
        topic_id=topic.id,
        title=topic.title,
        student_notes_md=topic.student_notes_md or "",
        quiz_available=quiz_available,
        bonus_quiz_available=bonus_quiz_available,
    )


@router.get(
    "/student/classes/{class_id}/topics/{topic_id}/main-quiz-leaderboard",
    response_model=MainQuizLeaderboardOut,
)
def student_topic_main_quiz_leaderboard(
    class_id: int,
    topic_id: int,
    user=Depends(require_student),
    db: Session = Depends(get_db),
):
    """Top main-quiz scores among class enrollees; podium = top 3."""
    enr = db.query(Enrollment).filter(
        Enrollment.class_id == class_id,
        Enrollment.student_id == user.id,
    ).first()
    if not enr:
        raise HTTPException(status_code=403, detail="Not enrolled in this class")

    topic = db.query(Topic).filter(
        Topic.id == topic_id,
        Topic.class_id == class_id,
        Topic.active == True,
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    enrolled_rows = (
        db.query(Enrollment.student_id)
        .filter(Enrollment.class_id == class_id)
        .all()
    )
    enrolled_ids = [int(r[0]) for r in enrolled_rows]
    if not enrolled_ids:
        return MainQuizLeaderboardOut(podium=[], my_rank=None, my_best_score=None)

    attempts_agg = (
        db.query(
            QuizAttempt.student_id,
            func.max(QuizAttempt.score).label("best_score"),
        )
        .filter(
            QuizAttempt.class_id == class_id,
            QuizAttempt.topic_id == topic_id,
            QuizAttempt.attempt_kind == "main",
            QuizAttempt.student_id.in_(enrolled_ids),
        )
        .group_by(QuizAttempt.student_id)
        .all()
    )
    best_by_student = {int(sid): float(sc) for sid, sc in attempts_agg}
    sorted_pairs = sorted(best_by_student.items(), key=lambda x: (-x[1], x[0]))

    podium_ids = [sid for sid, _ in sorted_pairs[:3]]
    users_by_id = {}
    if podium_ids:
        for u in db.query(User).filter(User.id.in_(podium_ids)).all():
            users_by_id[int(u.id)] = u

    def display_name_for(sid: int) -> str:
        u = users_by_id.get(int(sid))
        if not u:
            return f"Student {sid}"
        fn = (getattr(u, "first_name", None) or "").strip()
        ln = (getattr(u, "last_name", None) or "").strip()
        return f"{fn} {ln}".strip() or f"Student {sid}"

    podium: list[MainQuizLeaderboardPodiumEntryOut] = []
    for place_idx, (sid, sc) in enumerate(sorted_pairs[:3]):
        podium.append(
            MainQuizLeaderboardPodiumEntryOut(
                place=place_idx + 1,
                student_id=sid,
                display_name=display_name_for(sid),
                best_score=sc,
            )
        )

    my_best = best_by_student.get(int(user.id))
    my_rank = None
    if my_best is not None:
        my_rank = 1 + sum(1 for _, sc in sorted_pairs if sc > my_best)

    return MainQuizLeaderboardOut(
        podium=podium,
        my_rank=my_rank,
        my_best_score=float(my_best) if my_best is not None else None,
    )


@router.put("/student/topics/{topic_id}/progress", response_model=dict)
def student_set_topic_done(
    topic_id: int,
    payload: TopicProgressUpdateIn,
    user=Depends(require_student),
    db: Session = Depends(get_db),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    enr = db.query(Enrollment).filter(
        Enrollment.class_id == topic.class_id,
        Enrollment.student_id == user.id
    ).first()
    if not enr:
        raise HTTPException(status_code=403, detail="Not enrolled in this class")

    prog = db.query(TopicProgress).filter(
        TopicProgress.topic_id == topic_id,
        TopicProgress.student_id == user.id
    ).first()

    if not prog:
        prog = TopicProgress(topic_id=topic_id, student_id=user.id, done=bool(payload.done))
        db.add(prog)
    else:
        prog.done = bool(payload.done)

    db.commit()
    return {"ok": True, "done": bool(payload.done)}


