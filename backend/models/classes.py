# app/models/classes.py
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database.database import Base


class Class(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String, nullable=False)
    grade = Column(Integer, nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # vztahy
    teacher = relationship("User", back_populates="classes")
    enrollments = relationship(
        "Enrollment",
        back_populates="class_",
        cascade="all, delete-orphan"
    )
    topics = relationship("Topic", back_populates="class_", cascade="all, delete-orphan")

