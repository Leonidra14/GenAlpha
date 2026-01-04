from typing import Optional
from pydantic import BaseModel

class FinalNotesPatchIn(BaseModel):
    teacher_notes_md: Optional[str] = None
    student_notes_md: Optional[str] = None
