from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator
from app.core.utils import sanitize_text, validate_password_spaces

class RegisterIn(BaseModel):
    first_name: str = Field(min_length=2, max_length=80)
    last_name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    @field_validator('first_name', 'last_name', mode='before')
    @classmethod
    def sanitize_names(cls, v: str) -> str:
        return sanitize_text(v)
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        v = sanitize_text(v)
        return validate_password_spaces(v)
    

class LoginIn(BaseModel):
    login: str = Field(..., min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=72)

    @field_validator("login", mode="before")
    @classmethod
    def strip_login(cls, v: str) -> str:
        return sanitize_text(v) if isinstance(v, str) else v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        v = sanitize_text(v)
        return validate_password_spaces(v)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class MeOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    login_key: Optional[str] = None
    role: str