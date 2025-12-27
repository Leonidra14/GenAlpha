from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class StudentOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: Optional[str] = None

    class Config:
        from_attributes = True

class StudentCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    password: str  

class StudentPasswordUpdate(BaseModel):
    password: str  

class EnrollmentOut(BaseModel):
    id: int
    class_id: int
    student_id: int
    created_at: datetime
    student: StudentOut

    class Config:
        from_attributes = True
