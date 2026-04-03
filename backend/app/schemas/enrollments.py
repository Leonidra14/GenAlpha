from app.schemas.students import StudentOut
from pydantic import BaseModel
from datetime import datetime
from pydantic import Field
from pydantic import field_validator


class EnrollmentCreate(BaseModel):
    student_id: int

class EnrollmentOut(BaseModel):
    id: int
    class_id: int
    student_id: int
    created_at: datetime
    student: StudentOut

    class Config:
        from_attributes = True