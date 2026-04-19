import re
import logging
from typing import List, Set, Optional, Tuple, Dict, Any

from openai import OpenAI

from ai.TeacherNotes import prompts
from app.core.openai_client import (
    model_fast,
    model_quality,
    temp_context,
    temp_autotag,
    temp_quality,
)
from app.schemas.note_generation import ContextCheckOut, AutoTagOut

logger = logging.getLogger(__name__)

YEAR_RE = re.compile(r"\b(1[0-9]{3}|20[0-9]{2})\b")
RANGE_RE = re.compile(r"\b(1[0-9]{3}|20[0-9]{2})\s*[–-]\s*(1[0-9]{3}|20[0-9]{2})\b")


def _collect_years_from_text(md: str) -> Set[str]:
    years = set(YEAR_RE.findall(md))
    for a, b in RANGE_RE.findall(md):
        years.add(a)
        years.add(b)
    return years


def _build_multimodal_content(
    text: str,
    *,
    file_ids: List[str],
    image_data_urls: List[str],
) -> List[Dict[str, Any]]:
    parts: List[Dict[str, Any]] = [{"type": "input_text", "text": text}]
    for fid in file_ids:
        parts.append({"type": "input_file", "file_id": fid})
    for url in image_data_urls:
        parts.append({"type": "input_image", "image_url": url})
    return parts


def _allowed_years_from_metadata(meta: AutoTagOut) -> Set[str]:
    years: Set[str] = set()
    for d in meta.dates:
        if d.value:
            years |= _collect_years_from_text(d.value)
        if getattr(d, "context", None):
            years |= _collect_years_from_text(d.context or "")
    for f in meta.facts:
        if getattr(f, "when", None):
            years |= _collect_years_from_text(f.when or "")
        if getattr(f, "event", None):
            years |= _collect_years_from_text(f.event or "")
    return years


def _soft_year_warnings(teacher_md: str, student_md: str, extracted: AutoTagOut) -> List[str]:
    allowed = _allowed_years_from_metadata(extracted)
    out_years = _collect_years_from_text(teacher_md) | _collect_years_from_text(student_md)
    extra = sorted([y for y in out_years if y not in allowed])
    if not extra:
        return []
    shown = ", ".join(extra[:8])
    return [
        f"Pozor: vygenerovaný text obsahuje letopočty ({shown}), "
        "které nebyly ve vstupu/metadata. Může jít o halucinaci."
    ]


def run_notes_workflow(
    client: OpenAI,
    *,
    subject: str,
    grade: int,
    chapter_title: str,
    duration_minutes: int,
    raw_text: str,
    file_ids: Optional[List[str]] = None,
    image_data_urls: Optional[List[str]] = None,
) -> Tuple[bool, str, Optional[AutoTagOut], List[str], str, str]:
    
    file_ids = file_ids or []
    image_data_urls = image_data_urls or []
    max_retries = 3

    # --- 1) CONTEXT GATE ---
    context_user_text = prompts.context_gate_user(subject, chapter_title, raw_text)
    context = None
    
    for attempt in range(max_retries):
        try:
            context = client.responses.parse(
                model=model_fast(),
                temperature=temp_context(),
                input=[
                    {"role": "system", "content": prompts.context_gate_system()},
                    {"role": "user", "content": _build_multimodal_content(
                        context_user_text, file_ids=file_ids, image_data_urls=image_data_urls
                    )},
                ],
                text_format=ContextCheckOut, 
            ).output_parsed
            break
        except Exception as e:
            if attempt == max_retries - 1: raise e
            logger.warning(f"Context gate selhal (pokus {attempt + 1}): {e}")

    if context.rejected:
        return True, (context.reject_reason or "Text/soubory neodpovídají tématu."), None, [], "", ""

    # --- 2) AUTOTAG (EXTRAKCE) ---
    autotag_user_text = prompts.autotag_user(subject, grade, chapter_title, raw_text)
    extracted = None

    for attempt in range(max_retries):
        try:
            extracted = client.responses.parse(
                model=model_fast(),
                temperature=temp_autotag(),
                input=[
                    {"role": "system", "content": prompts.autotag_system()},
                    {"role": "user", "content": _build_multimodal_content(
                        autotag_user_text, file_ids=file_ids, image_data_urls=image_data_urls
                    )},
                ],
                text_format=AutoTagOut,
            ).output_parsed
            break
        except Exception as e:
            if attempt == max_retries - 1: raise e
            logger.warning(f"Autotag selhal (pokus {attempt + 1}): {e}")

    extracted_dump = extracted.model_dump()

    # --- 3) TEACHER NOTES ---
    teacher_user_text = prompts.teacher_notes_user(
        subject, grade, chapter_title, duration_minutes, extracted_dump, raw_text
    )
    teacher_md = ""

    for attempt in range(max_retries):
        try:
            teacher_md = client.responses.create(
                model=model_quality(),
                temperature=temp_quality(),
                input=[
                    {"role": "system", "content": prompts.teacher_notes_system()},
                    {"role": "user", "content": _build_multimodal_content(
                        teacher_user_text, file_ids=file_ids, image_data_urls=image_data_urls
                    )},
                ],
            ).output_text.strip()
            if teacher_md: break
        except Exception as e:
            if attempt == max_retries - 1: raise e
            logger.warning(f"Teacher notes selhaly (pokus {attempt + 1}): {e}")

    # --- 4) STUDENT NOTES ---
    student_user_text = prompts.student_notes_user(
        grade, chapter_title, extracted_dump, raw_text
    )
    student_md = ""

    for attempt in range(max_retries):
        try:
            student_md = client.responses.create(
                model=model_quality(),
                temperature=temp_quality(),
                input=[
                    {"role": "system", "content": prompts.student_notes_system()},
                    {"role": "user", "content": _build_multimodal_content(
                        student_user_text, file_ids=file_ids, image_data_urls=image_data_urls
                    )},
                ],
            ).output_text.strip()
            if student_md: break
        except Exception as e:
            if attempt == max_retries - 1: raise e
            logger.warning(f"Student notes selhaly (pokus {attempt + 1}): {e}")

    warnings: List[str] = []
    if not extracted.dates:
        warnings.append("V textu/souborech nebyly nalezeny žádné explicitní letopočty/intervaly.")
    warnings.extend(_soft_year_warnings(teacher_md, student_md, extracted))

    return False, "", extracted, warnings, teacher_md, student_md