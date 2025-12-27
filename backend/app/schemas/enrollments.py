from pydantic import BaseModel

class StudentOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str

    class Config:
        from_attributes = True

class EnrollmentCreate(BaseModel):
    student_id: int
