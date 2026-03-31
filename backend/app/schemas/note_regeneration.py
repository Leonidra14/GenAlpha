import re
from typing import Literal, Optional, Any
from pydantic import BaseModel, Field, field_validator

from app.core.utils import sanitize_text

TargetType = Literal["teacher", "student", "both"]

class RegenerateNotesIn(BaseModel):
    target: TargetType = "teacher"
    user_note: str = Field(..., min_length=2, max_length=2000)

    teacher_notes_md: Optional[str] = None
    student_notes_md: Optional[str] = None
    @field_validator("user_note")
    @classmethod
    def sanitize_user_note(cls, v: str) -> str:
        return sanitize_text(v)
