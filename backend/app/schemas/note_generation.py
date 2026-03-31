import re

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal

from app.core.utils import sanitize_text    

class GenerateNotesIn(BaseModel):
    duration_minutes: int = Field(default=45, ge=5, le=240)
    raw_text: str = Field(..., min_length=1, max_length=50000)
    @field_validator("raw_text")
    @classmethod
    def sanitize_text(cls, v: str) -> str:
        return sanitize_text(v)

class ContextCheckOut(BaseModel):
    rejected: bool
    reject_reason: str = ""

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

class GenerateNotesOut(BaseModel):
    meta: dict
    rejected: bool
    reject_reason: str
    extracted: Optional[AutoTagOut] = None
    warnings: List[str] = []
    teacher_notes_md: str = ""
    student_notes_md: str = ""
