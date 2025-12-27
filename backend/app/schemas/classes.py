from pydantic import BaseModel
from typing import Optional

class ClassOut(BaseModel):
    id: int
    subject: str
    teacher_id: int
    grade: Optional[int] = None
    custom_name: Optional[str] = None
    note: Optional[str] = None
    active: bool
    num_students: int

    class Config:
        from_attributes = True

class ClassCreate(BaseModel):
    subject: str
    grade: Optional[int] = None

class ClassUpdate(BaseModel):
    subject: Optional[str] = None
    grade: Optional[int] = None
    custom_name: Optional[str] = None
    note: Optional[str] = None
    active: Optional[bool] = None
