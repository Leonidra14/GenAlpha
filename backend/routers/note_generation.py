import base64
import io
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

from app.schemas.note_regeneration import RegenerateNotesIn
from ai.TeacherNotes.note_regeneration_workflow import run_regen_workflow

router = APIRouter()

# ====== CONFIG ======
MAX_FILES = 3
UPLOAD_DIR = Path("uploads")  # uloží se do backend/uploads (spouštíš z backend/)
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


def _assert_teacher_owns_topic(db: Session, class_id: int, topic_id: int, teacher_id: int) -> tuple[Class, Topic]:
    cls = db.query(Class).filter(Class.id == class_id, Class.teacher_id == teacher_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.class_id == class_id).first()
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
    """
    Vrátí text z PDF, pokud PDF obsahuje text layer.
    Pokud je to sken (jen obrázek) nebo je PDF rozbité, vrátí "".
    """
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

    # client zatím jen kvůli workflow (PDF už sem NEuploadujeme do OpenAI)
    client = get_openai_client()

    # multimodal pro AI: pouze obrázky
    image_data_urls: List[str] = []

    # text z dokumentů (pdf/txt/md) přilepíme k raw_text
    combined_texts: List[str] = []

    saved_files_meta: List[dict] = []

    for f in files:
        mime = (f.content_type or "").lower()
        filename = _safe_filename(f.filename or "file")
        data = await f.read()

        # 1) uložit lokálně (jak chceš)
        out_path = UPLOAD_DIR / f"{user.id}_{class_id}_{topic_id}_{filename}"
        i = 1
        while out_path.exists():
            stem = out_path.stem
            suffix = out_path.suffix
            out_path = UPLOAD_DIR / f"{stem}_{i}{suffix}"
            i += 1
        out_path.write_bytes(data)

        saved_files_meta.append({"name": filename, "mime": mime, "path": str(out_path)})

        lower = filename.lower()

        # 2) obrázky → input_image
        if mime in IMAGE_MIME or lower.endswith((".jpg", ".jpeg", ".png", ".webp")):
            if mime == "image/jpg":
                mime = "image/jpeg"
            image_data_urls.append(_to_data_url(data, mime or "image/jpeg"))
            continue

        # 3) PDF → nejdřív lokálně vytáhnout text, NEposílat do OpenAI files
        if lower.endswith(".pdf"):
            extracted = _extract_text_from_pdf(data)
            if not extracted:
                raise _file_error(
                    f"Soubor „{filename}“ nelze přečíst. "
                    "Pravděpodobně jde o chráněný/poškozený dokument. "
                    "Zkus vložit text ručně. "
                )
            combined_texts.append(f"\n\n--- TEXT Z PDF ({filename}) ---\n{extracted}")
            continue

        # 4) textové soubory → přilepit do raw_text
        if lower.endswith((".txt", ".md", ".markdown", ".json", ".xml", ".csv", ".html", ".htm")):
            try:
                decoded = data.decode("utf-8", errors="ignore").strip()
            except Exception:
                decoded = ""
            if decoded:
                combined_texts.append(f"\n\n--- TEXT ZE SOUBORU ({filename}) ---\n{decoded}")
            else:
                raise _file_error(f"Soubor „{filename}“ se nepodařilo načíst jako text.")
            continue

        # 5) ostatní nepodporované typy
        raise _file_error(
            f"Soubor „{filename}“ má nepodporovaný typ. "
            "Nahraj PDF (s textem) nebo obrázek (JPG/PNG/WEBP), případně TXT/MD."
        )

    # spojíme raw_text + extracted texty z dokumentů
    if combined_texts:
        raw_text = (raw_text or "").strip()
        raw_text = (raw_text + "\n\n" + "\n".join(combined_texts)).strip()

    # workflow (PDF už nejde jako input_file; pouze raw_text + images)
    rejected, reason, extracted, warnings, teacher_md, student_md = run_notes_workflow(
        client,
        subject=cls.subject,
        grade=cls.grade,
        chapter_title=topic.title,
        duration_minutes=duration_minutes,
        raw_text=raw_text,
        file_ids=[],  # důležité: PDF už neposíláme do OpenAI files
        image_data_urls=image_data_urls,
    )

    meta = {
        "subject": cls.subject,
        "grade": cls.grade,
        "chapter_title": topic.title,
        "duration_minutes": duration_minutes,
        "language": "cs",
        "file_count": len(files),
        "doc_count": len(combined_texts),       # kolik doc-textů jsme přilepili
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


@router.post("/classes/{class_id}/topics/{topic_id}/regenerate-notes", response_model=GenerateNotesOut)
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

    if not payload.extracted:
        raise HTTPException(status_code=400, detail="Chybí extracted metadata (pošli z frontendu).")

    client = get_openai_client()

    extracted_dump = payload.extracted

    teacher_md, student_md = run_regen_workflow(
        client,
        subject=cls.subject,
        grade=cls.grade,
        chapter_title=topic.title,
        duration_minutes=payload.duration_minutes or 45,
        raw_text=payload.raw_text or "",
        extracted_dump=extracted_dump,
        user_note=payload.user_note,
        target=payload.target,
        teacher_notes_md=payload.teacher_notes_md or "",
        student_notes_md=payload.student_notes_md or "",
        file_ids=[],
        image_data_urls=[],
    )

    meta = {
        "subject": cls.subject,
        "grade": cls.grade,
        "chapter_title": topic.title,
        "duration_minutes": payload.duration_minutes or 45,
        "language": "cs",
        "regen": True,
        "target": payload.target,
    }

    return GenerateNotesOut(
        meta=meta,
        rejected=False,
        reject_reason="",
        extracted=payload.extracted,
        warnings=[],
        teacher_notes_md=teacher_md,
        student_notes_md=student_md,
    )
