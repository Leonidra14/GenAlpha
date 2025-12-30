from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB

from database.database import Base


class TopicNotes(Base):
    __tablename__ = "topic_notes"

    id = Column(Integer, primary_key=True, index=True)

    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)

    duration_minutes = Column(Integer, nullable=False, default=45)

    raw_text = Column(Text, nullable=False, default="")

    teacher_notes_md = Column(Text, nullable=False, default="")
    student_notes_md = Column(Text, nullable=False, default="")

    extracted = Column(JSONB, nullable=True)

    attachments = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("topic_id", name="uq_topic_notes_topic_id"),
    )
