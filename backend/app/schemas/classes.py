from pydantic import BaseModel, Field, field_validator
from typing import Optional
from app.core.utils import sanitize_text

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
    subject: str = Field(..., min_length=1, max_length=100, description="Předmět")
    grade: Optional[int] = Field(default=None, ge=1, le=20, description="Ročník")
    custom_name: Optional[str] = Field(default=None, max_length=100)
    note: Optional[str] = Field(default=None, max_length=500)
    active: bool = True
    @field_validator('subject', 'custom_name', 'note', mode='before')
    @classmethod    
    def sanitize_strings(cls, v: str | None) -> str | None:
        return sanitize_text(v)
    
class ClassUpdate(BaseModel):
    subject: Optional[str] = Field(default=None, min_length=1, max_length=100)
    grade: Optional[int] = Field(default=None, ge=1, le=20)
    custom_name: Optional[str] = Field(default=None, max_length=100)
    note: Optional[str] = Field(default=None, max_length=500)
    active: Optional[bool] = None
    @field_validator('subject', 'custom_name', 'note', mode='before')
    @classmethod
    def sanitize_strings(cls, v: str | None) -> str | None:
        return sanitize_text(v)
