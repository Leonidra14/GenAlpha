# backend/models/topics.py
from sqlalchemy import Column, Integer, String, ForeignKey, Text, Boolean, DateTime, func
from sqlalchemy.orm import relationship
from database.database import Base


class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    teacher_notes_md = Column(Text, nullable=True)
    student_notes_md = Column(Text, nullable=True)

    # vztahy
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    class_ = relationship("Class", back_populates="topics")
