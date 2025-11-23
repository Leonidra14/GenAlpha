from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from database import Base

# Model pro tabulku uživatelů (users)
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="student")  # "teacher" nebo "student"
    
    # Vztahy (relationships)
    classes = relationship("Class", back_populates="teacher")       # třídy vyučované tímto učitelem
    enrollments = relationship("Enrollment", back_populates="student")  # zápisy (přiřazení studenta do tříd)
    results = relationship("Result", back_populates="student")      # výsledky testů/úkolů tohoto uživatele
    activities = relationship("Activity", back_populates="user")    # aktivity uživatele (log aktivit)
