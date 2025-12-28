from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from pydantic import Field

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
    password: str = Field(min_length=8, max_length=72)


