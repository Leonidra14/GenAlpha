from __future__ import annotations

import json
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field, ValidationError, field_validator

from app.core.utils import sanitize_text

QuizQuestionType = Literal["mcq", "yesno", "final_open"]


class QuizQuestionBase(BaseModel):
    id: str
    type: QuizQuestionType
    difficulty: int
    prompt: str

    options: Optional[Dict[str, str]] = None

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

    @field_validator("options", mode="before")
    @classmethod
    def validate_options(cls, v, info):
        t = info.data.get("type")
        if t == "final_open":
            return None
        if v is None:
            raise ValueError("options required for mcq/yesno")

        if isinstance(v, dict):
            v = {str(k).upper(): val for k, val in v.items()}

        if t == "mcq":
            if set(v.keys()) != {"A", "B", "C", "D"}:
                raise ValueError("mcq options must be exactly A,B,C,D")
        if t == "yesno":
            if set(v.keys()) != {"A", "B"}:
                raise ValueError("yesno options must be exactly A,B")
            if v["A"].strip().lower() != "ano" or v["B"].strip().lower() != "ne":
                raise ValueError('yesno options must be A="ano", B="ne"')
        return v


class QuizQuestion(QuizQuestionBase):
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None

    @field_validator("correct_answer", mode="before")
    @classmethod
    def validate_correct_answer(cls, v, info):
        t = info.data.get("type")
        if t == "final_open":
            return None
        if not v:
            raise ValueError("correct_answer required for mcq/yesno")

        if isinstance(v, str):
            v = v.upper()

        opts = info.data.get("options") or {}
        if v not in opts:
            raise ValueError(f"correct_answer '{v}' must be one of the option keys")
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


class QuizQuestionPublic(QuizQuestionBase):
    """Student-facing question: no correct_answer or explanation."""

    pass


class QuizOut(BaseModel):
    questions: List[QuizQuestion]


class QuizOutPublic(BaseModel):
    questions: List[QuizQuestionPublic]


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


def parse_quiz_json_to_quiz_out(quiz_json: str) -> QuizOut:
    """Parse a JSON string and validate as full teacher/stored quiz (QuizOut)."""
    try:
        raw = json.loads(quiz_json)
    except json.JSONDecodeError as e:
        raise ValueError("quiz_json není validní JSON string") from e
    try:
        return QuizOut.model_validate(raw)
    except ValidationError as e:
        parts = []
        for err in e.errors():
            loc = ".".join(str(x) for x in err["loc"])
            parts.append(f"{loc}: {err['msg']}")
        raise ValueError("quiz_json neodpovídá struktuře kvízu: " + "; ".join(parts)) from e


def quiz_out_to_public(quiz: QuizOut) -> QuizOutPublic:
    """Strip sensitive fields for student API responses."""
    public_questions = [
        QuizQuestionPublic.model_validate(q.model_dump(exclude={"correct_answer", "explanation"}))
        for q in quiz.questions
    ]
    return QuizOutPublic(questions=public_questions)


# --- Student runtime session (API contracts) ---


class QuizStartOut(BaseModel):
    attempt_id: str
    questions: List[QuizQuestionPublic]


class QuizSubmitAnswerIn(BaseModel):
    question_id: str = Field(..., min_length=1, max_length=200)
    answer: str = Field(..., min_length=0, max_length=20000)


class QuizSubmitAnswerOut(BaseModel):
    is_correct: bool
    score_delta: float
    explanation: Optional[str] = None
    feedback: Optional[str] = None


class QuizFinishOut(BaseModel):
    attempt_id: str
    total_score: float
    max_score: float
    question_count: int


class FinalOpenCriterionEval(BaseModel):
    score: int = Field(..., ge=0, le=5)
    reason: str = Field(default="", max_length=2000)


class FinalOpenCriteriaEval(BaseModel):
    task_fulfillment: FinalOpenCriterionEval
    topic_accuracy: FinalOpenCriterionEval
    coherence: FinalOpenCriterionEval
    length_requirement: FinalOpenCriterionEval


class FinalOpenEvalParsed(BaseModel):
    """Structured LLM output for grading final_open answers (strict JSON rubric)."""

    points_awarded: int = Field(..., ge=0, le=15)
    max_points: Literal[15] = 15
    score_percent: int = Field(..., ge=0, le=100)
    criteria: FinalOpenCriteriaEval
    teacher_summary: str = Field(default="", max_length=4000)
    teacher_recommendation: str = Field(default="", max_length=4000)
    student_feedback: str = Field(default="", max_length=4000)
