from typing import Any, Optional
from pydantic import BaseModel, Field

class FinalNotesPatchIn(BaseModel):
    teacher_notes_md: Optional[str] = Field(default=None, max_length=50000)
    student_notes_md: Optional[str] = Field(default=None, max_length=50000)

class FinalNotesOut(BaseModel):
    teacher_notes_md: str = ""
    student_notes_md: str = ""
    updated_at: Optional[str] = None