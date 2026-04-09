import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, Uuid
from database.database import Base


class QuizAttempt(Base):
    """Jeden dokončený pokus o kvíz; zápis jednorázově při finish (ERD: quiz_attempts)."""

    __tablename__ = "quiz_attempts"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    started_at = Column(DateTime(timezone=True), nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=False)

    score = Column(Float, nullable=False)
    duration_sec = Column(Integer, nullable=False)

    answers_json = Column(JSON, nullable=False)
    mistakes_json = Column(JSON, nullable=False)
