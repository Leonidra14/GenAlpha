from sqlalchemy import Column, Integer, BigInteger, Boolean, DateTime, Float, ForeignKey, UniqueConstraint, func, text
from database.database import Base

class TopicProgress(Base):
    __tablename__ = "topic_progress"

    id = Column(BigInteger, primary_key=True, index=True)

    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    done = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    last_opened_at = Column(DateTime(timezone=True), nullable=True)

    quiz_attempt_count = Column(Integer, nullable=False, server_default=text("0"))
    quiz_best_score = Column(Float, nullable=True)
    quiz_last_score = Column(Float, nullable=True)
    quiz_last_finished_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("topic_id", "student_id", name="uq_topic_progress_topic_student"),
    )
