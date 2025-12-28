import re
from typing import List, Set

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.database import get_db
from app.deps.auth import require_teacher
from models.classes import Class
from models.topics import Topic

from app.core.openai_client import get_openai_client, get_openai_model
from app.schemas.note_generation import (
    GenerateNotesIn,
    GenerateNotesOut,
    ContextCheckOut,
    AutoTagOut,
)

router = APIRouter()

YEAR_RE = re.compile(r"\b(1[0-9]{3}|20[0-9]{2})\b")
RANGE_RE = re.compile(r"\b(1[0-9]{3}|20[0-9]{2})\s*[–-]\s*(1[0-9]{3}|20[0-9]{2})\b")

def _assert_teacher_owns_topic(db: Session, class_id: int, topic_id: int, teacher_id: int) -> tuple[Class, Topic]:
    cls = db.query(Class).filter(Class.id == class_id, Class.teacher_id == teacher_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.class_id == class_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    return cls, topic

def _collect_years_from_text(md: str) -> Set[str]:
    years = set(YEAR_RE.findall(md))
    for a, b in RANGE_RE.findall(md):
        years.add(a)
        years.add(b)
    return years

def _allowed_years_from_metadata(meta: AutoTagOut) -> Set[str]:
    years: Set[str] = set()
    for d in meta.dates:
        years |= _collect_years_from_text(d.value)
        if d.context:
            years |= _collect_years_from_text(d.context)
    for f in meta.facts:
        if f.when:
            years |= _collect_years_from_text(f.when)
        if f.event:
            years |= _collect_years_from_text(f.event)
    return years

def _soft_year_warnings(teacher_md: str, student_md: str, extracted: AutoTagOut) -> List[str]:
    allowed = _allowed_years_from_metadata(extracted)
    out_years = _collect_years_from_text(teacher_md) | _collect_years_from_text(student_md)
    extra = sorted([y for y in out_years if y not in allowed])

    if not extra:
        return []
    shown = ", ".join(extra[:8])
    return [f"Pozor: vygenerovaný text obsahuje letopočty ({shown}), které nebyly ve vstupu/metadata. Může jít o halucinaci."]

@router.post("/classes/{class_id}/topics/{topic_id}/generate-notes", response_model=GenerateNotesOut)
def generate_notes(
    class_id: int,
    topic_id: int,
    payload: GenerateNotesIn,
    db: Session = Depends(get_db),
    user=Depends(require_teacher),
):
    cls, topic = _assert_teacher_owns_topic(db, class_id, topic_id, user.id)

    if not payload.raw_text.strip():
        raise HTTPException(status_code=400, detail="raw_text is empty")

    client = get_openai_client()
    model = get_openai_model()

    meta = {
        "subject": cls.subject,
        "grade": cls.grade,
        "chapter_title": topic.title,
        "duration_minutes": payload.duration_minutes,
        "language": "cs",
    }

    # -------------------------
    # 1) KONTROLA KONTEXTU (GATE)
    # -------------------------
    context_system = (
        "Jsi kontrolor. Zkontroluj, zda text odpovídá předmětu a tématu. "
        "Pokud neodpovídá, nastav rejected=true a napiš krátký důvod do reject_reason. "
        "Pokud odpovídá, rejected=false a reject_reason nech prázdné. "
        "Nevymýšlej obsah. Vrať pouze JSON podle schématu."
    )
    context_user = f"""
PŘEDMĚT: {cls.subject}
TÉMA/KAPITOLA: {topic.title}

TEXT UČITELE:
{payload.raw_text}
""".strip()

    context = client.responses.parse(
        model=model,
        input=[
            {"role": "system", "content": context_system},
            {"role": "user", "content": context_user},
        ],
        text_format=ContextCheckOut,
    ).output_parsed

    if context.rejected:
        # STOP – šetříme peníze
        return GenerateNotesOut(
            meta=meta,
            rejected=True,
            reject_reason=context.reject_reason or "Text neodpovídá tématu/předmětu.",
            extracted=None,
            warnings=[],
            teacher_notes_md="",
            student_notes_md="",
        )

    # -------------------------
    # 2) AUTO_TAG_METADATA (JSON)
    # -------------------------
    autotag_system = (
        "Vrať POUZE JSON dle schématu. "
        "EXTRAHUJ pouze to, co je v textu EXPLICITNĚ uvedené. "
        "Nedomýšlej historická fakta. "
        "Letopočty/intervaly piš přesně tak, jak jsou v textu. "
        "keywords: 6–12 hesel."
    )

    autotag_user = f"""
Klasifikuj:
- subject: {cls.subject}
- grade: {cls.grade}
- chapter_title: {topic.title}

Z TEXTU vytáhni:
- content_type ∈ {{ "theory", "example", "exercise", "definition" }}
- keywords (6–12 hesel z textu)
- dates (roky/intervaly přesně z textu)
- facts (spoj událost + jméno + datum, jen když je to v textu)
- missing (co v textu chybí / je nejasné)

TEXT:
{payload.raw_text}
""".strip()

    extracted = client.responses.parse(
        model=model,
        input=[
            {"role": "system", "content": autotag_system},
            {"role": "user", "content": autotag_user},
        ],
        text_format=AutoTagOut,
    ).output_parsed

    # -------------------------
    # 3) TEACHER NOTES (MD)
    # -------------------------
    teacher_system = (
        "Jsi didaktický asistent pro základní školu. "
        "Tvým úkolem je vytvořit plán hodiny a teoretickou přípravu pro učitele. "
        "KRITICKÉ: Používej pouze fakta/roky z EXTRACTED METADATA. "
        "Nepřidávej nové letopočty. "
        "Piš česky, přehledně, v markdown."
    )

    teacher_user = f"""
META:
- PŘEDMĚT: {cls.subject}
- ROČNÍK: {cls.grade}
- TÉMA/KAPITOLA: {topic.title}
- DÉLKA: {payload.duration_minutes} minut

EXTRACTED METADATA (z toho čerpej klíčová slova + fakta + roky):
{extracted.model_dump()}

TEXT UČITELE:
{payload.raw_text}

VRAŤ PŘESNĚ V TOMTO FORMÁTU (beze změn nadpisů):

# Příprava hodiny: {cls.grade}. třída – {topic.title} ({payload.duration_minutes} minut)

## Časový plán
- 0–X min: Úvod (cíl hodiny, aktivace předchozích znalostí) — [konkrétní body]
- X–Y min: [název bloku] — [co učitel dělá/říká + klíčová fakta z textu]
- … (další bloky tak, aby součet minut dal {payload.duration_minutes})
- [poslední interval]: Uzavření hodiny (shrnutí, exit ticket)

## 3 doporučené aktivity pro žáky
1) **Název** — *Cíl:* … — *Instrukce:* … — *Pomůcky:* … — *Ověření porozumění:* …
2) **Název** — *Cíl:* … — *Instrukce:* … — *Pomůcky:* … — *Ověření porozumění:* …
3) **Název** — *Cíl:* … — *Instrukce:* … — *Pomůcky:* … — *Ověření porozumění:* …

## Klíčová slova
- [vyjmenuj 6–12 klíčových slov]
""".strip()

    teacher_md = client.responses.create(
        model=model,
        input=[
            {"role": "system", "content": teacher_system},
            {"role": "user", "content": teacher_user},
        ],
    ).output_text.strip()

    # -------------------------
    # 4) STUDENT NOTES (MD)
    # -------------------------
    student_system = (
        "Jsi nejpilnější žák a nejlepší zapisovatel. "
        "Vytvoř kvalitní zápis pro spolužáka ze základní školy. "
        "Vynech aktivity a shrnutí s opakováním. "
        "KRITICKÉ: Nepřidávej nové letopočty; použij jen ty z EXTRACTED METADATA. "
        "Piš česky a v markdown."
    )

    student_user = f"""
ROČNÍK: {cls.grade}
TÉMA: {topic.title}

EXTRACTED METADATA (fakta/roky, která smíš použít):
{extracted.model_dump()}

TEXT UČITELE:
{payload.raw_text}

VÝSTUP (Markdown):
- Nadpis
- Stručné odrážky (hlavní body)
- Definice pojmů (pokud jsou v textu)
- 5 kontrolních otázek na závěr
""".strip()

    student_md = client.responses.create(
        model=model,
        input=[
            {"role": "system", "content": student_system},
            {"role": "user", "content": student_user},
        ],
    ).output_text.strip()

    warnings: List[str] = []
    if len(extracted.dates) == 0:
        warnings.append("V textu nebyly nalezeny žádné explicitní letopočty/intervaly. Poznámky budou bez přesných dat.")
    warnings.extend(_soft_year_warnings(teacher_md, student_md, extracted))

    return GenerateNotesOut(
        meta=meta,
        rejected=False,
        reject_reason="",
        extracted=extracted,
        warnings=warnings,
        teacher_notes_md=teacher_md,
        student_notes_md=student_md,
    )
