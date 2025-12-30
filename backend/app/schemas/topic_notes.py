from typing import Any, Optional, List, Dict
from pydantic import BaseModel, Field


class TopicNotesSaveIn(BaseModel):
    duration_minutes: int = Field(45, ge=5, le=240)
    raw_text: str = ""
    teacher_notes_md: str = ""
    student_notes_md: str = ""
    extracted: Optional[Dict[str, Any]] = None
    attachments: Optional[List[Dict[str, Any]]] = None


class TopicNotesOut(BaseModel):
    id: int
    topic_id: int
    duration_minutes: int
    raw_text: str
    teacher_notes_md: str
    student_notes_md: str
    extracted: Optional[Dict[str, Any]] = None
    attachments: Optional[List[Dict[str, Any]]] = None

    class Config:
        from_attributes = True
