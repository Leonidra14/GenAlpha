from pydantic import BaseModel
from typing import List, Optional
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
    bonus_quiz_available: bool


class MainQuizLeaderboardPodiumEntryOut(BaseModel):
    """Single podium slot (max 3): best main-quiz score in the topic."""

    place: int  # 1–3 on the podium
    student_id: int
    display_name: str
    best_score: float


class MainQuizLeaderboardOut(BaseModel):
    podium: List[MainQuizLeaderboardPodiumEntryOut]
    my_rank: Optional[int] = None  # rank among classmates with ≥1 attempt; None if no attempt
    my_best_score: Optional[float] = None
