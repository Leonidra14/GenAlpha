import base64
import os
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from database.database import get_db
from app.deps.auth import require_teacher
from models.classes import Class
from models.topics import Topic
from app.core.openai_client import get_openai_client
from ai.TeacherNotes.note_workflow import run_notes_workflow
from app.schemas.note_generation import GenerateNotesOut

router = APIRouter()

# ====== CONFIG ======
MAX_FILES = 3
UPLOAD_DIR = Path("uploads")  # uloží se do backend/uploads (spouštíš z backend/)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

DOC_MIME = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/json",
    "application/xml",
    "text/html",
    "text/csv",
}

IMAGE_MIME = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}


def _assert_teacher_owns_topic(db: Session, class_id: int, topic_id: int, teacher_id: int) -> tuple[Class, Topic]:
    cls = db.query(Class).filter(Class.id == class_id, Class.teacher_id == teacher_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.class_id == class_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    return cls, topic


def _safe_filename(name: str) -> str:
    # jednoduché “očištění”
    keep = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_."
    cleaned = "".join(c if c in keep else "_" for c in (name or "file"))
    return cleaned[:120] or "file"


def _to_data_url(data: bytes, mime: str) -> str:
    b64 = base64.b64encode(data).decode("utf-8")
    return f"data:{mime};base64,{b64}"


@router.post("/classes/{class_id}/topics/{topic_id}/generate-notes", response_model=GenerateNotesOut)
async def generate_notes(
    class_id: int,
    topic_id: int,
    duration_minutes: int = Form(45),
    raw_text: str = Form(""),
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    user=Depends(require_teacher),
):
    cls, topic = _assert_teacher_owns_topic(db, class_id, topic_id, user.id)

    files = files or []

    if not raw_text.strip() and len(files) == 0:
        raise HTTPException(status_code=400, detail="Zadej text nebo nahraj soubor.")

    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Maximální počet souborů je {MAX_FILES}.")

    client = get_openai_client()

    # Rozdělíme na DOC vs IMAGE
    openai_file_ids: List[str] = []       # pro PDF/TXT/MD... (input_file)
    image_data_urls: List[str] = []       # pro JPG/PNG/WEBP... (input_image)

    saved_files_meta: List[dict] = []     # jen pro info/debug

    for f in files:
        mime = (f.content_type or "").lower()
        filename = _safe_filename(f.filename or "file")

        data = await f.read()

        # 1) Uložit lokálně (jak chceš)
        # vytvoříme unikátní název
        out_path = UPLOAD_DIR / f"{user.id}_{class_id}_{topic_id}_{filename}"
        # pokud existuje, přidáme suffix
        i = 1
        while out_path.exists():
            stem = out_path.stem
            suffix = out_path.suffix
            out_path = UPLOAD_DIR / f"{stem}_{i}{suffix}"
            i += 1

        out_path.write_bytes(data)
        saved_files_meta.append({"name": filename, "mime": mime, "path": str(out_path)})

        # 2) Zpracování pro AI
        if mime in IMAGE_MIME or filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            # obrázky NEPOSÍLEJ jako input_file → pošli jako input_image (data URL)
            # (pozor: base64 nafoukne velikost – max 3 soubory je OK)
            if mime == "image/jpg":
                mime = "image/jpeg"
            image_data_urls.append(_to_data_url(data, mime or "image/jpeg"))

        else:
            # dokumenty posíláme přes OpenAI Files (podporované typy typu PDF/TXT/MD)
            # Pokud mime není v DOC_MIME, pořád to může být pdf bez content-type atd.
            # necháme projít, ale bude-li to nepodporované, OpenAI to vrátí jako error.
            uploaded = client.files.create(
                file=(filename, data, mime or "application/octet-stream"),
                purpose="user_data",
            )
            openai_file_ids.append(uploaded.id)

    # Zavoláme workflow
    rejected, reason, extracted, warnings, teacher_md, student_md = run_notes_workflow(
        client,
        subject=cls.subject,
        grade=cls.grade,
        chapter_title=topic.title,
        duration_minutes=duration_minutes,
        raw_text=raw_text,
        file_ids=openai_file_ids,
        image_data_urls=image_data_urls,
    )

    meta = {
        "subject": cls.subject,
        "grade": cls.grade,
        "chapter_title": topic.title,
        "duration_minutes": duration_minutes,
        "language": "cs",
        "file_count": len(files),
        "doc_count": len(openai_file_ids),
        "image_count": len(image_data_urls),
        # volitelně: ať v UI vidíš co bylo přiloženo
        "attachments": [{"name": x["name"], "mime": x["mime"]} for x in saved_files_meta],
    }

    if rejected:
        return GenerateNotesOut(
            meta=meta,
            rejected=True,
            reject_reason=reason,
            extracted=None,
            warnings=[],
            teacher_notes_md="",
            student_notes_md="",
        )

    return GenerateNotesOut(
        meta=meta,
        rejected=False,
        reject_reason="",
        extracted=extracted,
        warnings=warnings,
        teacher_notes_md=teacher_md,
        student_notes_md=student_md,
    )
