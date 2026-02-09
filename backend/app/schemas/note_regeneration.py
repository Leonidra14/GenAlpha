from typing import Literal, Optional, Any
from pydantic import BaseModel, Field

TargetType = Literal["teacher", "student", "both"]

class RegenerateNotesIn(BaseModel):
    target: TargetType = "teacher"
    user_note: str = Field(..., min_length=2, max_length=2000)

    teacher_notes_md: Optional[str] = None
    student_notes_md: Optional[str] = None
