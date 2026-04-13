import json
import logging
from typing import Any, Dict, Literal

from openai import OpenAI

from app.core.openai_client import model_quality, temp_quality
from app.schemas.quiz import QuizOut

from . import prompts

logger = logging.getLogger(__name__)

BonusQuizTier = Literal["beginner", "medium", "advanced"]


def tier_from_score_pct(score_pct: float) -> BonusQuizTier:
    """
    Map main-quiz percentage score to bonus tier (exclusive of endpoint at 50/85 boundaries per plan).

    - score_pct > 85  -> advanced (7 mcq, 3 yesno, 1 final_open)
    - score_pct < 50  -> beginner (3 mcq, 7 yesno, 1 final_open)
    - otherwise       -> medium   (5 mcq, 5 yesno, 1 final_open)
    """
    if score_pct > 85:
        return "advanced"
    if score_pct < 50:
        return "beginner"
    return "medium"


def tier_question_counts(tier: BonusQuizTier) -> tuple[int, int, int]:
    """Returns (mcq, yesno, final_open)."""
    if tier == "advanced":
        return 7, 3, 1
    if tier == "beginner":
        return 3, 7, 1
    return 5, 5, 1


def generate_bonus_quiz(
    client: OpenAI,
    *,
    tier: BonusQuizTier,
    class_grade: str,
    subject: str,
    chapter_title: str,
    student_notes_md: str,
    mistakes_json: str,
    base_quiz_json: str,
    score: float,
    score_pct: float,
) -> Dict[str, Any]:
    """
    Generate a bonus quiz via structured output (QuizOut), same parse path as generate_quiz.

    Caller is responsible for validating tier counts match returned questions if needed.
    """
    system_text = prompts.bonus_quiz_generation_system()
    common_kwargs = dict(
        class_grade=class_grade,
        subject=subject,
        chapter_title=chapter_title,
        student_notes_md=student_notes_md,
        mistakes_json=mistakes_json,
        base_quiz_json=base_quiz_json,
        score=score,
        score_pct=score_pct,
    )
    if tier == "beginner":
        user_text = prompts.bonus_quiz_user_beginner(**common_kwargs)
    elif tier == "advanced":
        user_text = prompts.bonus_quiz_user_advanced(**common_kwargs)
    else:
        user_text = prompts.bonus_quiz_user_medium(**common_kwargs)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            parsed_response = client.beta.chat.completions.parse(
                model=model_quality(),
                temperature=temp_quality(),
                messages=[
                    {"role": "system", "content": system_text},
                    {"role": "user", "content": user_text},
                ],
                response_format=QuizOut,
            )
            parsed = parsed_response.choices[0].message.parsed
            if parsed is None:
                raise ValueError("empty parse for bonus quiz")
            data = parsed.model_dump()
            _assert_bonus_counts(data, tier)
            return data
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error("Generování bonusového kvízu definitivně selhalo: %s", e)
                raise e
            logger.warning("Pokus %s o generování bonusového kvízu selhal: %s", attempt + 1, e)


def _assert_bonus_counts(data: Dict[str, Any], tier: BonusQuizTier) -> None:
    """Lightweight sanity check so wrong-tier prompts fail fast before persistence."""
    questions = data.get("questions") or []
    mcq, yesno, final_open = tier_question_counts(tier)
    expected_total = mcq + yesno + final_open
    if len(questions) != expected_total:
        raise ValueError(
            f"bonus quiz ({tier}): očekáváno {expected_total} otázek, model vrátil {len(questions)}"
        )
    counts = {"mcq": 0, "yesno": 0, "final_open": 0}
    for q in questions:
        t = (q or {}).get("type")
        if t in counts:
            counts[t] += 1
    if counts["mcq"] != mcq or counts["yesno"] != yesno or counts["final_open"] != final_open:
        raise ValueError(
            "bonus quiz ("
            + tier
            + "): špatné počty typů "
            + json.dumps(counts, ensure_ascii=False)
            + f", očekáváno mcq={mcq}, yesno={yesno}, final_open={final_open}"
        )
    if questions and questions[-1].get("type") != "final_open":
        raise ValueError("bonus quiz: poslední otázka musí být final_open")
