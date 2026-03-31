import json
from typing import Any, Dict
from openai import OpenAI

from app.core.openai_client import model_quality, temp_quality
from ai.TeacherNotes.prompts import QUIZ_GENERATION_PROMPT_TEMPLATE


def _strip_outer_code_fence(s: str) -> str:
    t = (s or "").strip()
    if not t.startswith("```"):
        return t
    lines = t.splitlines()
    if len(lines) < 3:
        return t
    if not lines[0].startswith("```"):
        return t
    if lines[-1].strip() != "```":
        return t
    return "\n".join(lines[1:-1]).strip()


def generate_quiz(
    client: OpenAI,
    *,
    class_grade: str,
    subject: str,
    chapter_title: str,
    plain_text: str,
    mcq: int,
    yesno: int,
    final_open: int,
) -> Dict[str, Any]:
    """
    Vrací dict odpovídající JSON schématu:
    { "questions": [ ... ] }
    """

    user_text = QUIZ_GENERATION_PROMPT_TEMPLATE.format(
        class_=class_grade,
        subject=subject,
        chapter_title=chapter_title,
        plain_text=plain_text,
        mcq=mcq,
        yesno=yesno,
        final_open=final_open,
    )

    resp = client.responses.create(
        model=model_quality(),
        temperature=temp_quality(),
        input=[
            # prompt už v sobě obsahuje instrukce, takže stačí user
            {"role": "user", "content": [{"type": "input_text", "text": user_text}]},
        ],
    )

    text = _strip_outer_code_fence(resp.output_text or "")

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        snippet = text[:500]
        raise ValueError(f"LLM nevrátil validní JSON. Ukázka: {snippet}") from e

    if (
        not isinstance(data, dict)
        or "questions" not in data
        or not isinstance(data["questions"], list)
    ):
        raise ValueError("LLM JSON nemá očekávanou strukturu {questions: [...]}")

    return data
