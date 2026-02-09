from typing import Any, Optional
from pydantic import BaseModel

class FinalNotesPatchIn(BaseModel):
    teacher_notes_md: Optional[str] = None
    student_notes_md: Optional[str] = None

class FinalNotesOut(BaseModel):
    teacher_notes_md: str = ""
    student_notes_md: str = ""
    updated_at: Optional[str] = None
