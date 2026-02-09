from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TopicOut(BaseModel):
    id: int
    title: str
    active: bool
    created_at: datetime
    class_id: int

    class Config:
        from_attributes = True


class TopicCreate(BaseModel):
    title: str
    active: Optional[bool] = True


class TopicUpdate(BaseModel):
    title: Optional[str] = None
    active: Optional[bool] = None

class TopicImport(BaseModel):
    source_topic_id: int
