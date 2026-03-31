import logging
from typing import Tuple
from openai import OpenAI

from app.core.openai_client import model_quality, temp_quality
from ai.TeacherNotes.prompts import (
    teacher_regen_system,
    teacher_regen_user,
    student_regen_system,
    student_regen_user,
)

logger = logging.getLogger(__name__)

def run_regen_workflow(
    client: OpenAI,
    *,
    user_note: str,
    target: str,  # "teacher" | "student" | "both"
    teacher_notes_md: str,
    student_notes_md: str,
) -> Tuple[str, str]:
    """
    Vrátí:
      teacher_md, student_md
    Regenerace pracuje jen s aktuálním markdownem + user_note (bez extracted/meta).
    """

    teacher_out = teacher_notes_md or ""
    student_out = student_notes_md or ""
    max_retries = 3

    # --- REGENERACE UČITELSKÝCH POZNÁMEK ---
    if target in ("teacher", "both"):
        user_text = teacher_regen_user(
            current_md=teacher_out,
            user_note=user_note,
        )
        
        for attempt in range(max_retries):
            try:
                resp = client.responses.create(
                    model=model_quality(),
                    temperature=temp_quality(),
                    input=[
                        {"role": "system", "content": teacher_regen_system()},
                        {"role": "user", "content": [{"type": "input_text", "text": user_text}]},
                    ],
                )
                teacher_out = resp.output_text.strip()
                break  # Úspěch, vyskočíme z loopu
            except Exception as e:
                if attempt == max_retries - 1:
                    logger.error(f"Regenerace učitelských poznámek definitivně selhala: {e}")
                    raise e
                logger.warning(f"Pokus {attempt + 1} o regeneraci učitelských poznámek selhal: {e}")

    # --- REGENERACE STUDENTSKÝCH POZNÁMEK ---
    if target in ("student", "both"):
        user_text = student_regen_user(
            current_md=student_out,
            user_note=user_note,
        )

        for attempt in range(max_retries):
            try:
                resp = client.responses.create(
                    model=model_quality(),
                    temperature=temp_quality(),
                    input=[
                        {"role": "system", "content": student_regen_system()},
                        {"role": "user", "content": [{"type": "input_text", "text": user_text}]},
                    ],
                )
                student_out = resp.output_text.strip()
                break  
            except Exception as e:
                if attempt == max_retries - 1:
                    logger.error(f"Regenerace studentských poznámek definitivně selhala: {e}")
                    raise e
                logger.warning(f"Pokus {attempt + 1} o regeneraci studentských poznámek selhal: {e}")

    return teacher_out, student_out