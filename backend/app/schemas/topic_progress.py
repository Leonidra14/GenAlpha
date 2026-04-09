from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TopicWithProgressOut(BaseModel):
    id: int
    title: str
    active: bool
    created_at: datetime
    class_id: int

    done: bool = False
    last_opened_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TopicProgressUpdateIn(BaseModel):
    done: bool


class StudentTopicDetailOut(BaseModel):
    topic_id: int
    title: str
    student_notes_md: str
    quiz_available: bool
