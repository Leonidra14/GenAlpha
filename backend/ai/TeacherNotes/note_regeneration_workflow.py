from typing import Tuple
from openai import OpenAI

from app.core.openai_client import model_quality, temp_quality

from ai.TeacherNotes.prompts import (
    teacher_regen_system,
    teacher_regen_user,
    student_regen_system,
    student_regen_user,
)


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

    if target in ("teacher", "both"):
        user_text = teacher_regen_user(
            current_md=teacher_out,
            user_note=user_note,
        )

        teacher_out = (
            client.responses.create(
                model=model_quality(),
                temperature=temp_quality(),
                input=[
                    {"role": "system", "content": teacher_regen_system()},
                    {"role": "user", "content": [{"type": "input_text", "text": user_text}]},
                ],
            )
            .output_text.strip()
        )

    if target in ("student", "both"):
        user_text = student_regen_user(
            current_md=student_out,
            user_note=user_note,
        )

        student_out = (
            client.responses.create(
                model=model_quality(),
                temperature=temp_quality(),
                input=[
                    {"role": "system", "content": student_regen_system()},
                    {"role": "user", "content": [{"type": "input_text", "text": user_text}]},
                ],
            )
            .output_text.strip()
        )

    return teacher_out, student_out
