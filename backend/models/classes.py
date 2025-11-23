# app/models/classes.py
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database.database import Base


class Class(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # vztahy
    teacher = relationship("User", back_populates="classes")
    enrollments = relationship(
        "Enrollment",
        back_populates="class_",
        cascade="all, delete-orphan"
    )
    # zatím BEZ assignments a activities – až budeš mít modely, přidáme
    # assignments = relationship("Assignment", back_populates="class")
    # activities = relationship("Activity", back_populates="class")
