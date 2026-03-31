from __future__ import annotations

from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator

from app.core.utils import sanitize_text

QuizQuestionType = Literal["mcq", "yesno", "final_open"]


class QuizQuestion(BaseModel):
    id: str
    type: QuizQuestionType
    difficulty: int
    prompt: str

    options: Optional[Dict[str, str]] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, v, info):
        t = info.data.get("type")
        if t == "final_open":
            if v != 15:
                raise ValueError("final_open difficulty must be 15")
        else:
            if v not in (1, 2, 3):
                raise ValueError("mcq/yesno difficulty must be 1-3")
        return v

    @field_validator("options")
    @classmethod
    def validate_options(cls, v, info):
        t = info.data.get("type")
        if t == "final_open":
            return None
        if v is None:
            raise ValueError("options required for mcq/yesno")

        if t == "mcq":
            if set(v.keys()) != {"A", "B", "C", "D"}:
                raise ValueError("mcq options must be exactly A,B,C,D")
        if t == "yesno":
            if set(v.keys()) != {"A", "B"}:
                raise ValueError("yesno options must be exactly A,B")
            if v["A"].strip().lower() != "ano" or v["B"].strip().lower() != "ne":
                raise ValueError('yesno options must be A="ano", B="ne"')
        return v

    @field_validator("correct_answer")
    @classmethod
    def validate_correct_answer(cls, v, info):
        t = info.data.get("type")
        if t == "final_open":
            return None
        if not v:
            raise ValueError("correct_answer required for mcq/yesno")
        opts = info.data.get("options") or {}
        if v not in opts:
            raise ValueError("correct_answer must be one of the option keys")
        return v

    @field_validator("explanation")
    @classmethod
    def validate_explanation(cls, v, info):
        t = info.data.get("type")
        if t == "final_open":
            return None
        if not v or not v.strip():
            raise ValueError("explanation required for mcq/yesno")
        return v


class QuizOut(BaseModel):
    questions: List[QuizQuestion]


class QuizGenerateIn(BaseModel):
    plain_text: str = Field(..., min_length=10, max_length=30000)

    class_: str = Field(..., alias="class", min_length=1, max_length=50)
    subject: str = Field(..., min_length=1, max_length=100)
    chapter_title: str = Field(..., min_length=1, max_length=200)

    mcq: int = Field(..., ge=0, le=50)
    yesno: int = Field(..., ge=0, le=50)
    final_open: int = Field(..., ge=0, le=1)

    @field_validator("plain_text", "class_", "subject", "chapter_title", mode="before")
    @classmethod
    def clean_text_inputs(cls, v: str | None) -> str | None:
        return sanitize_text(v)


class QuizSaveFinalIn(BaseModel):
    quiz_json: str = Field(..., min_length=2, max_length=50000)