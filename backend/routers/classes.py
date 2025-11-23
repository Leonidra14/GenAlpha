from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from database.database import get_db
from models.users import User
from models.classes import Class


from pydantic import BaseModel

# Pydantic schema pro odpověď obsahující informace o třídě
class ClassInfo(BaseModel):
    class_id: int
    name: str
    num_students: int
    last_assignment: Optional[str] = None

    class Config:
        orm_mode = True  # Umožní načtení z ORM objektů, pokud bychom je přímo předávali

router = APIRouter(prefix="/classes", tags=["classes"])

@router.get("/teacher/{teacher_id}", response_model=List[ClassInfo])
def get_classes_for_teacher(teacher_id: int, db: Session = Depends(get_db)):
    # Ověření existence uživatele-učitele (volitelně lze vyhodit chybu, pokud neexistuje nebo není učitel)
    teacher = db.query(User).filter(User.id == teacher_id, User.role == "teacher").first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    
    # Načtení všech tříd daného učitele včetně zápisů a úkolů (pro efektivní výpočet počtu studentů a posledního úkolu)
    classes = db.query(Class).filter(Class.teacher_id == teacher_id) \
                .options(joinedload(Class.enrollments), joinedload(Class.assignments)) \
                .all()
    
    # Sestavení výsledného seznamu tříd s požadovanými údaji
    class_list = []
    for cl in classes:
        num_students = len(cl.enrollments)  # počet zapsaných studentů ve třídě
        last_assignment_title = None
        if cl.assignments:
            # Najít poslední úkol podle data vytvoření (created_at) nebo ID
            latest_assignment = max(cl.assignments, key=lambda a: getattr(a, "created_at", None) or a.id)
            last_assignment_title = latest_assignment.title
        class_list.append(ClassInfo(
            class_id=cl.id,
            name=cl.name,
            num_students=num_students,
            last_assignment=last_assignment_title
        ))
    
    return class_list
