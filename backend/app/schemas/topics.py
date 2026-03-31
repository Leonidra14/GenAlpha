from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime

from app.core.utils import sanitize_text

class TopicOut(BaseModel):
    id: int
    title: str
    active: bool
    created_at: datetime
    class_id: int

    class Config:
        from_attributes = True


class TopicCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    active: Optional[bool] = True

    @field_validator('title', mode='before')
    @classmethod
    def sanitize_title(cls, v: str | None) -> str | None:
        return sanitize_text(v)


class TopicUpdate(BaseModel):
    title: Optional[str] = None
    active: Optional[bool] = None
    @field_validator('title', mode='before')
    @classmethod
    def sanitize_title(cls, v: str | None) -> str | None:
        return sanitize_text(v)

class TopicImport(BaseModel):
    source_topic_id: int
