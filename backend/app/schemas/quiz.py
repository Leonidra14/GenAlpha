from __future__ import annotations

import json
from datetime import date, datetime
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


class TutorMessageIn(BaseModel):
    """Student tutor chat during an active quiz question (SSE endpoint body)."""

    question_id: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=2000)

    @field_validator("question_id", "message", mode="before")
    @classmethod
    def clean_tutor_fields(cls, v: str | None) -> str | None:
        return sanitize_text(v)


class QuizAttemptAnswerStudentRowOut(BaseModel):
    """Student results row: no explanation (leaks correct choice for closed types)."""

    question_id: str
    prompt: str
    type: QuizQuestionType
    student_answer: str
    is_correct: bool
    score_delta: float
    feedback: Optional[str] = None


class QuizAttemptDetailStudentOut(BaseModel):
    """Sanitized finished attempt for the owning student (results UI)."""

    attempt_id: str
    finished_at: datetime
    score: float
    max_score: float
    question_count: int
    duration_sec: int
    correct_count: int
    incorrect_count: int
    answers: List[QuizAttemptAnswerStudentRowOut]


class QuizAttemptListItemStudentOut(BaseModel):
    """One finished attempt row for topic history (student owns the attempts)."""

    attempt_id: str
    finished_at: datetime
    score: float
    max_score: float
    duration_sec: int
    attempt_kind: str


class QuizFinishOut(BaseModel):
    attempt_id: str
    total_score: float
    max_score: float
    question_count: int
    results_preview: Optional[QuizAttemptDetailStudentOut] = None


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


# --- Teacher topic quiz stats (aggregates + per-student rows) ---


class TopicQuizQuestionStatOut(BaseModel):
    """Per-question rates from enrolled students' latest main attempts (see router aggregation)."""

    question_id: str
    prompt: Optional[str] = None
    correct_rate: float = Field(..., ge=0, le=100)
    answered_count: int = Field(..., ge=0)


class TopicQuizStatsOut(BaseModel):
    """Class-level aggregates for one topic's main quiz attempts."""

    enrolled_count: int = Field(..., ge=0)
    completed_count: int = Field(..., ge=0)
    completion_percent: float = Field(..., ge=0, le=100)
    avg_score_percent: Optional[float] = Field(None, ge=0, le=100)
    median_score_percent: Optional[float] = Field(None, ge=0, le=100)
    avg_duration_sec: Optional[int] = Field(None, ge=0)
    median_duration_sec: Optional[int] = Field(None, ge=0)
    quiz_max_score: Optional[float] = Field(None, ge=0)
    quiz_has_final_open: bool = Field(
        default=False,
        description="basic_quiz obsahuje aspoň jednu final_open (pro UI)",
    )
    per_question: List[TopicQuizQuestionStatOut] = Field(default_factory=list)


class TopicQuizStudentRowOut(BaseModel):
    """One enrolled student and their main-attempt summary for the topic."""

    student_id: int
    first_name: str
    last_name: str
    attempt_count: int = Field(..., ge=0)
    latest_attempt_id: Optional[str] = None
    latest_finished_at: Optional[datetime] = None
    latest_score: Optional[float] = None
    latest_max_score: Optional[float] = None
    best_score_percent: Optional[float] = Field(None, ge=0, le=100)


class TopicQuizAnswerMatrixQuestionOut(BaseModel):
    """Question metadata used as columns in student-answer matrix."""

    question_id: str
    prompt: Optional[str] = None
    type: QuizQuestionType


class TopicQuizAnswerMatrixCellOut(BaseModel):
    """One matrix cell for latest main attempt answer of a student."""

    question_id: str
    has_answer: bool = False
    is_correct: Optional[bool] = None
    student_answer: Optional[str] = None


class TopicQuizAnswerMatrixRowOut(BaseModel):
    """One matrix row (student) with cells aligned to matrix question columns."""

    student_id: int
    first_name: str
    last_name: str
    latest_attempt_id: Optional[str] = None
    cells: List[TopicQuizAnswerMatrixCellOut] = Field(default_factory=list)


class TopicQuizTeacherStatsOut(TopicQuizStatsOut):
    """Full payload for GET .../teacher-stats (aggregates + student table)."""

    students: List[TopicQuizStudentRowOut] = Field(default_factory=list)
    answer_matrix_questions: List[TopicQuizAnswerMatrixQuestionOut] = Field(default_factory=list)
    answer_matrix_rows: List[TopicQuizAnswerMatrixRowOut] = Field(default_factory=list)


# --- Teacher class-wide quiz stats ---


class TeacherClassStatsOverviewOut(BaseModel):
    class_id: int
    enrolled_count: int = Field(..., ge=0)
    avg_score_percent: Optional[float] = Field(None, ge=0, le=100)
    median_score_percent: Optional[float] = Field(None, ge=0, le=100)
    active_students_7d: int = Field(..., ge=0)
    active_students_30d: int = Field(..., ge=0)
    active_students_7d_percent: float = Field(..., ge=0, le=100)
    active_students_30d_percent: float = Field(..., ge=0, le=100)
    students_below_threshold: int = Field(..., ge=0)
    risk_threshold_percent: float = Field(..., ge=0, le=100)


class TeacherClassStatsTrendPointOut(BaseModel):
    day: date
    attempt_count: int = Field(..., ge=0)
    active_students: int = Field(..., ge=0)
    avg_score_percent: Optional[float] = Field(None, ge=0, le=100)
    completion_percent: float = Field(..., ge=0, le=100)


class TeacherClassStatsTrendOut(BaseModel):
    class_id: int
    period_days: int = Field(..., ge=1, le=365)
    enrolled_count: int = Field(..., ge=0)
    points: List[TeacherClassStatsTrendPointOut] = Field(default_factory=list)


class TeacherClassTopicStatsRowOut(BaseModel):
    topic_id: int
    topic_title: str
    active: bool = True
    enrolled_count: int = Field(..., ge=0)
    attempted_students: int = Field(..., ge=0)
    completion_percent: float = Field(..., ge=0, le=100)
    avg_score_percent: Optional[float] = Field(None, ge=0, le=100)
    median_score_percent: Optional[float] = Field(None, ge=0, le=100)
    avg_duration_sec: Optional[int] = Field(None, ge=0)
    median_duration_sec: Optional[int] = Field(None, ge=0)
    last_attempt_at: Optional[datetime] = None


class TeacherClassTopicStatsOut(BaseModel):
    class_id: int
    rows: List[TeacherClassTopicStatsRowOut] = Field(default_factory=list)


ClassRiskLevel = Literal["low", "medium", "high"]


class TeacherClassRiskStudentOut(BaseModel):
    student_id: int
    first_name: str
    last_name: str
    risk_level: ClassRiskLevel
    risk_score: int = Field(..., ge=0, le=100)
    reasons: List[str] = Field(default_factory=list)
    teacher_recommendation: Optional[str] = None
    attempt_count: int = Field(..., ge=0)
    avg_score_percent: Optional[float] = Field(None, ge=0, le=100)
    completion_percent: float = Field(..., ge=0, le=100)
    last_attempt_at: Optional[datetime] = None
    inactive_days: Optional[int] = Field(None, ge=0)


class TeacherClassRiskStudentsOut(BaseModel):
    class_id: int
    generated_at: datetime
    threshold_percent: float = Field(..., ge=0, le=100)
    students: List[TeacherClassRiskStudentOut] = Field(default_factory=list)


class TeacherClassStudentTopicChartRowOut(BaseModel):
    """Per-topic aggregates for one student (finished main attempts only)."""

    topic_id: int
    topic_title: str
    main_attempt_count: int = Field(..., ge=0)
    max_score: float = Field(..., ge=0)
    total_duration_sec: int = Field(..., ge=0)
    avg_duration_sec: Optional[float] = Field(None, ge=0)


class TeacherClassStudentDetailOut(BaseModel):
    class_id: int
    student_id: int
    first_name: str = ""
    last_name: str = ""
    summary_markdown: str = ""
    topics: List[TeacherClassStudentTopicChartRowOut] = Field(default_factory=list)


class QuizAttemptAnswerTeacherRowOut(BaseModel):
    """Teacher view of one answer row: includes correct key and explanation for closed types."""

    question_id: str
    prompt: str
    type: QuizQuestionType
    student_answer: str
    is_correct: bool
    score_delta: float
    feedback: Optional[str] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    # final_open rubric fields from LLM; stored in answers_json; omitted from student API
    teacher_summary: Optional[str] = None
    teacher_recommendation: Optional[str] = None
    final_open_criteria: Optional[FinalOpenCriteriaEval] = None


class QuizAttemptDetailTeacherOut(BaseModel):
    """Finished attempt detail for a teacher (class/topic/student scoped)."""

    attempt_id: str
    student_id: int
    first_name: str
    last_name: str
    attempt_kind: str
    finished_at: datetime
    score: float
    max_score: float
    question_count: int
    duration_sec: int
    correct_count: int
    incorrect_count: int
    answers: List[QuizAttemptAnswerTeacherRowOut]
