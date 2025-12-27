# app/models/users.py
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from database.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="student")  # "teacher" / "student"

    # vztahy
    classes = relationship("Class", back_populates="teacher")
    enrollments = relationship("Enrollment", back_populates="student")
    # NECHÁVÁME BEZ Result a Activity, dokud ty modely neexistují
