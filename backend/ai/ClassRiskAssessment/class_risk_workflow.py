import logging
from typing import Any, Dict, Literal

from openai import OpenAI
from pydantic import BaseModel, Field

from app.core.openai_client import model_quality, temp_quality

from . import prompts

logger = logging.getLogger(__name__)

_MAX_PARSE_RETRIES = 3

ClassRiskLevel = Literal["low", "medium", "high"]


class ClassRiskStudentOut(BaseModel):
    student_id: int
    risk_level: ClassRiskLevel
    risk_score: int = Field(..., ge=0, le=100)
    reasons: list[str] = Field(default_factory=list)
    teacher_recommendation: str = Field(
        default="",
        max_length=1200,
        description="Konkrétní doporučení pro učitele (čeština, 1–3 věty).",
    )


class ClassRiskAssessmentOut(BaseModel):
    class_id: int
    summary: str = Field(default="")
    students: list[ClassRiskStudentOut] = Field(default_factory=list)


def generate_class_risk_assessment(
    client: OpenAI,
    *,
    class_id: int,
    class_grade: str,
    subject: str,
    topic_scope: str,
    threshold_percent: float,
    generated_at_iso: str,
    student_rows_json: str,
) -> Dict[str, Any]:
    """
    Run one structured LLM call and return parsed class risk assessment JSON.
    """
    system_text = prompts.class_risk_system()
    user_text = prompts.class_risk_user(
        class_id=class_id,
        class_grade=class_grade,
        subject=subject,
        topic_scope=topic_scope,
        threshold_percent=threshold_percent,
        generated_at_iso=generated_at_iso,
        student_rows_json=student_rows_json,
    )
    for attempt in range(_MAX_PARSE_RETRIES):
        try:
            parsed_response = client.beta.chat.completions.parse(
                model=model_quality(),
                temperature=temp_quality(),
                messages=[
                    {"role": "system", "content": system_text},
                    {"role": "user", "content": user_text},
                ],
                response_format=ClassRiskAssessmentOut,
            )
            parsed = parsed_response.choices[0].message.parsed
            if parsed is None:
                raise ValueError("empty parse for class risk assessment")
            return parsed.model_dump()
        except Exception as exc:
            if attempt == _MAX_PARSE_RETRIES - 1:
                logger.error(
                    "Generovani class risk assessment definitivne selhalo: %s",
                    exc,
                )
                raise
            logger.warning(
                "Pokus %s o class risk assessment selhal: %s",
                attempt + 1,
                exc,
            )
    raise RuntimeError("unreachable")
