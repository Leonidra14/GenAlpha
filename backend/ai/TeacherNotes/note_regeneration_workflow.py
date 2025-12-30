from typing import Any, Dict, List, Optional, Tuple
from openai import OpenAI

from ai.TeacherNotes import prompts
from app.core.openai_client import model_quality, temp_quality


def run_regen_workflow(
    client: OpenAI,
    *,
    subject: str,
    grade: int,
    chapter_title: str,
    duration_minutes: int,
    raw_text: str,
    extracted_dump: Dict[str, Any],
    user_note: str,
    target: str,  # "teacher" | "student" | "both"
    file_ids: Optional[List[str]] = None,
    image_data_urls: Optional[List[str]] = None,
    teacher_notes_md: str = "",
    student_notes_md: str = "",
) -> Tuple[str, str]:
    file_ids = file_ids or []
    image_data_urls = image_data_urls or []

    def mm(text: str) -> List[dict]:
        parts = [{"type": "input_text", "text": text}]
        for fid in file_ids:
            parts.append({"type": "input_file", "file_id": fid})
        for url in image_data_urls:
            parts.append({"type": "input_image", "image_url": url})
        return parts

    new_teacher = teacher_notes_md
    new_student = student_notes_md

    if target in ("teacher", "both"):
        teacher_user = prompts.teacher_regen_user(
            subject=subject,
            grade=grade,
            chapter_title=chapter_title,
            duration_minutes=duration_minutes,
            extracted_dump=extracted_dump,
            raw_text=raw_text,
            current_md=teacher_notes_md,
            user_note=user_note,
        )
        new_teacher = client.responses.create(
            model=model_quality(),
            temperature=temp_quality(),
            input=[
                {"role": "system", "content": prompts.teacher_regen_system()},
                {"role": "user", "content": mm(teacher_user)},
            ],
        ).output_text.strip()

    if target in ("student", "both"):
        student_user = prompts.student_regen_user(
            grade=grade,
            chapter_title=chapter_title,
            extracted_dump=extracted_dump,
            raw_text=raw_text,
            current_md=student_notes_md,
            user_note=user_note,
        )
        new_student = client.responses.create(
            model=model_quality(),
            temperature=temp_quality(),
            input=[
                {"role": "system", "content": prompts.student_regen_system()},
                {"role": "user", "content": mm(student_user)},
            ],
        ).output_text.strip()

    return new_teacher, new_student
