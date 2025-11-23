from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

# Model pro tabulku zápisů (enrollments) - propojení studentů a tříd
class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Vztahy (relationships)
    class_ = relationship("Class", back_populates="enrollments")   # odkaz na příslušnou třídu
    student = relationship("User", back_populates="enrollments")  # odkaz na studenta (uživatele) v této třídě
