from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

# Model pro tabulku tříd (classes)
class Class(Base):
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Vztahy (relationships)
    teacher = relationship("User", back_populates="classes")         # odkaz na učitele (User) vyučujícího tuto třídu
    enrollments = relationship("Enrollment", back_populates="class") # seznam zápisů studentů v této třídě
    assignments = relationship("Assignment", back_populates="class") # seznam úkolů přiřazených této třídě
    activities = relationship("Activity", back_populates="class")    # aktivity spojené s touto třídou (pokud relevantní)
