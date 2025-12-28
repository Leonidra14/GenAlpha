from pydantic import BaseModel, Field
from typing import List, Optional, Literal

class GenerateNotesIn(BaseModel):
    duration_minutes: int = Field(default=45, ge=5, le=240)
    raw_text: str = Field(..., min_length=1)

# 1) Kontrola kontextu
class ContextCheckOut(BaseModel):
    rejected: bool
    reject_reason: str = ""

# 2) AutoTag / Metadata
class ExtractedDate(BaseModel):
    value: str = Field(..., description="Rok nebo interval přesně jak je v textu, např. '1740–1780' nebo '1620'")
    context: Optional[str] = Field(default=None, description="K čemu se to vztahuje, jen pokud je to v textu")

class ExtractedFact(BaseModel):
    event: str = Field(..., description="Událost / jev / tvrzení")
    who: Optional[str] = Field(default=None, description="Osoba/skupina pokud je explicitně v textu")
    when: Optional[str] = Field(default=None, description="Datum/interval přesně z textu")
    source_hint: Optional[str] = Field(default=None, description="Krátký úryvek / nápověda z textu (max pár slov)")

class AutoTagOut(BaseModel):
    subject: str
    grade: int
    chapter_title: str
    content_type: Literal["theory", "example", "exercise", "definition"] = "theory"

    keywords: List[str] = Field(default_factory=list, description="6–12 klíčových slov")
    dates: List[ExtractedDate] = Field(default_factory=list)
    facts: List[ExtractedFact] = Field(default_factory=list, description="Spojení událost-jméno-datum; jen explicitně z textu")

    missing: List[str] = Field(default_factory=list, description="Co v textu chybí / nejasnosti")

# Finální response
class GenerateNotesOut(BaseModel):
    meta: dict
    rejected: bool
    reject_reason: str
    extracted: Optional[AutoTagOut] = None
    warnings: List[str] = []
    teacher_notes_md: str = ""
    student_notes_md: str = ""
