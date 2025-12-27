# app/models/enrollments.py
from xmlrpc.client import DateTime
from sqlalchemy import Column, Integer, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from database.database import Base


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False)

    class_ = relationship("Class", back_populates="enrollments")
    student = relationship("User", back_populates="enrollments")
