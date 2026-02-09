import base64
import io
from pathlib import Path
from typing import List, Optional

from pypdf import PdfReader
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from database.database import get_db
from app.deps.auth import require_teacher
from models.classes import Class
from models.topics import Topic
from app.core.openai_client import get_openai_client

from ai.TeacherNotes.note_workflow import run_notes_workflow
from ai.TeacherNotes.note_regeneration_workflow import run_regen_workflow

from app.schemas.note_generation import GenerateNotesOut
from app.schemas.note_regeneration import RegenerateNotesIn

router = APIRouter()

# ====== CONFIG ======
MAX_FILES = 3
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

IMAGE_MIME = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

# -----------------------
# Helpers
# -----------------------
def _file_error(message: str) -> HTTPException:
    return HTTPException(
        status_code=400,
        detail={"code": "file_error", "message": message},
    )


def _assert_teacher_owns_topic(
    db: Session, class_id: int, topic_id: int, teacher_id: int
) -> tuple[Class, Topic]:
    cls = db.query(Class).filter(
        Class.id == class_id,
        Class.teacher_id == teacher_id,
    ).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    topic = db.query(Topic).filter(
        Topic.id == topic_id,
        Topic.class_id == class_id,
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    return cls, topic


def _safe_filename(name: str) -> str:
    keep = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_."
    cleaned = "".join(c if c in keep else "_" for c in (name or "file"))
    return cleaned[:120] or "file"


def _to_data_url(data: bytes, mime: str) -> str:
    b64 = base64.b64encode(data).decode("utf-8")
    return f"data:{mime};base64,{b64}"


def _extract_text_from_pdf(data: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
        texts: List[str] = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                texts.append(t)
        return "\n\n".join(texts).strip()
    except Exception:
        return ""


# =====================================================================
# GENERATE NOTES
# =====================================================================
@router.post(
    "/classes/{class_id}/topics/{topic_id}/generate-notes",
    response_model=GenerateNotesOut,
)
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
    if not raw_text.strip() and not files:
        raise HTTPException(status_code=400, detail="Zadej text nebo nahraj soubor.")

    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Maximální počet souborů je {MAX_FILES}.")

    client = get_openai_client()

    image_data_urls: List[str] = []
    combined_texts: List[str] = []
    saved_files_meta: List[dict] = []

    try:
        # ---------- UPLOAD + EXTRACT ----------
        for f in files:
            mime = (f.content_type or "").lower()
            filename = _safe_filename(f.filename or "file")
            data = await f.read()

            out_path = UPLOAD_DIR / f"{user.id}_{class_id}_{topic_id}_{filename}"
            i = 1
            while out_path.exists():
                out_path = UPLOAD_DIR / f"{out_path.stem}_{i}{out_path.suffix}"
                i += 1
            out_path.write_bytes(data)

            saved_files_meta.append(
                {"name": filename, "mime": mime, "path": str(out_path)}
            )

            lower = filename.lower()

            if mime in IMAGE_MIME or lower.endswith((".jpg", ".jpeg", ".png", ".webp")):
                image_data_urls.append(_to_data_url(data, mime or "image/jpeg"))
                continue

            if lower.endswith(".pdf"):
                extracted = _extract_text_from_pdf(data)
                if not extracted:
                    raise _file_error(
                        f"Soubor „{filename}“ nelze přečíst. "
                        "Zkus vložit text ručně."
                    )
                combined_texts.append(
                    f"\n\n--- TEXT Z PDF ({filename}) ---\n{extracted}"
                )
                continue

            if lower.endswith((".txt", ".md", ".markdown", ".json", ".xml", ".csv", ".html", ".htm")):
                decoded = data.decode("utf-8", errors="ignore").strip()
                if not decoded:
                    raise _file_error(f"Soubor „{filename}“ se nepodařilo načíst jako text.")
                combined_texts.append(
                    f"\n\n--- TEXT ZE SOUBORU ({filename}) ---\n{decoded}"
                )
                continue

            raise _file_error(f"Nepodporovaný typ souboru: {filename}")

        if combined_texts:
            raw_text = (raw_text or "").strip()
            raw_text = (raw_text + "\n\n" + "\n".join(combined_texts)).strip()

        # ---------- AI WORKFLOW ----------
        rejected, reason, extracted, warnings, teacher_md, student_md = run_notes_workflow(
            client,
            subject=cls.subject,
            grade=cls.grade,
            chapter_title=topic.title,
            duration_minutes=duration_minutes,
            raw_text=raw_text,
            file_ids=[],
            image_data_urls=image_data_urls,
        )

    finally:
        # 🧹 CLEANUP – SMAŽ UPLOADY
        for f in saved_files_meta:
            try:
                Path(f["path"]).unlink(missing_ok=True)
            except Exception:
                pass

    meta = {
        "subject": cls.subject,
        "grade": cls.grade,
        "chapter_title": topic.title,
        "duration_minutes": duration_minutes,
        "language": "cs",
        "file_count": len(files),
        "doc_count": len(combined_texts),
        "image_count": len(image_data_urls),
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


# =====================================================================
# REGENERATE NOTES
# =====================================================================
@router.post(
    "/classes/{class_id}/topics/{topic_id}/regenerate-notes",
    response_model=GenerateNotesOut,
)
async def regenerate_notes(
    class_id: int,
    topic_id: int,
    payload: RegenerateNotesIn,
    db: Session = Depends(get_db),
    user=Depends(require_teacher),
):
    cls, topic = _assert_teacher_owns_topic(db, class_id, topic_id, user.id)

    if not payload.user_note.strip():
        raise HTTPException(status_code=400, detail="user_note je prázdná.")

    if payload.target in ("teacher", "both") and not (payload.teacher_notes_md or "").strip():
        raise HTTPException(status_code=400, detail="Chybí teacher_notes_md.")

    if payload.target in ("student", "both") and not (payload.student_notes_md or "").strip():
        raise HTTPException(status_code=400, detail="Chybí student_notes_md.")

    client = get_openai_client()

    teacher_md, student_md = run_regen_workflow(
        client,
        user_note=payload.user_note,
        target=payload.target,
        teacher_notes_md=payload.teacher_notes_md or "",
        student_notes_md=payload.student_notes_md or "",
    )

    return GenerateNotesOut(
        meta={
            "subject": cls.subject,
            "grade": cls.grade,
            "chapter_title": topic.title,
            "language": "cs",
            "regen": True,
            "target": payload.target,
        },
        rejected=False,
        reject_reason="",
        extracted=None,
        warnings=[],
        teacher_notes_md=teacher_md,
        student_notes_md=student_md,
    )
