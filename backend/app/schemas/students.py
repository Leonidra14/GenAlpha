from typing import Optional
from datetime import datetime
from pydantic import Field, BaseModel, field_validator, model_validator
from app.core.utils import sanitize_text, validate_password_spaces
from app.core.student_login_key import strip_last_name_for_login

class StudentOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: Optional[str] = None
    login_key: Optional[str] = None

    class Config:
        from_attributes = True

class StudentCreate(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=2, max_length=100)
    email: Optional[str] = Field(default=None, max_length=255)
    password: str = Field(..., min_length=8, max_length=72)

    @field_validator('first_name', 'last_name', 'email', mode='before')
    @classmethod
    def sanitize_strings(cls, v: str | None) -> str | None:
        return sanitize_text(v)

    @model_validator(mode="after")
    def last_name_must_form_login_slug(self) -> "StudentCreate":
        if not strip_last_name_for_login(self.last_name or ""):
            raise ValueError(
                "příjmení musí obsahovat alespoň jedno písmeno nebo číslici (bez diakritiky) pro přihlášení"
            )
        return self

class StudentPasswordUpdate(BaseModel):
    password: str = Field(min_length=8, max_length=72)
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        v = sanitize_text(v)
        return validate_password_spaces(v)
    
class StudentClassDetailOut(BaseModel):
    id: int
    subject: str
    grade: Optional[int] = None
    custom_name: Optional[str] = None
    note: Optional[str] = None
    active: bool

    teacher_first_name: Optional[str] = None
    teacher_last_name: Optional[str] = None


