def context_gate_system() -> str:
    return (
        "Jsi kontrolor kontextu. "
        "Zkontroluj, zda text odpovídá PŘEDMĚTU a TÉMATU/KAPITOLE. "
        "Buď rozumně tolerantní – pokud text zjevně souvisí, rejected=false. "
        "rejected=true pouze pokud je téma očividně jiné nebo nesmysl. "
        "Vrať POUZE JSON dle schématu."
    )


def context_gate_user(subject: str, chapter_title: str, raw_text: str) -> str:
    return f"""
    PŘEDMĚT: {subject}
    TÉMA/KAPITOLA: {chapter_title}

    TEXT UČITELE:
    {raw_text}
    """.strip()


def autotag_system() -> str:
    return (
        "Vrať POUZE JSON dle schématu.\n"
        "Tvým úkolem je EXTRAHOVAT strukturované informace z textu.\n\n"
        "ZÁSADNÍ PRAVIDLA:\n"
        "- Extrahuj POUZE to, co je v textu EXPLICITNĚ uvedené.\n"
        "- NIC nedoplňuj ze svých znalostí.\n"
        "- Pokud informace v textu není, pole ponech prázdné.\n"
        "- Čísla, jednotky, roky nebo rozsahy zapisuj přesně tak, jak jsou v textu.\n\n"
        "facts:\n"
        "- fact = konkrétní tvrzení nebo poznatek obsažený v textu.\n"
        "- Může jít o definici, zákon, vztah, vlastnost, proces, historický fakt apod.\n"
        "- Pokud je součástí tvrzení číslo / jednotka / rok, uveď je.\n"
        "- Pokud text obsahuje vztah (A způsobuje B, A závisí na B), uveď ho jako jeden fact.\n\n"
        "keywords:\n"
        "- 6–12 klíčových pojmů nebo termínů z textu.\n"
        "- Preferuj odborné pojmy.\n\n"
        "content_type:\n"
        "- theory = výklad / popis jevu\n"
        "- definition = definice pojmů\n"
        "- example = příklady\n"
        "- exercise = úlohy / otázky\n\n"
        "missing:\n"
        "- Uveď, co by bylo potřeba doplnit, aby byl výklad úplný (pokud je zřejmé).\n"
    )


def autotag_user(subject: str, grade: int, chapter_title: str, raw_text: str) -> str:
    return f"""
KONTEXT (slouží pouze k orientaci, NE k doplňování informací):
- Předmět: {subject}
- Ročník: {grade}
- Téma/Kapitola: {chapter_title}

INSTRUKCE:
- Extrahuj informace pouze z TEXTU níže.
- Nepředpokládej typické znalosti daného předmětu.
- Pokud text neobsahuje data, osoby, čísla nebo vztahy, nic nevymýšlej.

TEXT:
{raw_text}
""".strip()


def teacher_notes_system() -> str:
    return (
        "Jsi didaktický asistent pro základní školu. "
        "Vytvoř plán hodiny a teoretickou přípravu pro učitele. "
        "KRITICKÉ: Používej pouze fakta a letopočty z EXTRACTED METADATA. "
        "Nepřidávej nové roky. "
        "NEPŘIDÁVEJ žádná varování, upozornění ani meta-komentáře o pravidlech. "
        "Piš česky, strukturovaně, v markdown."
    )


def teacher_notes_user(
    subject: str,
    grade: int,
    chapter_title: str,
    duration_minutes: int,
    extracted_dump: dict,
    raw_text: str,
) -> str:
    return f"""
META:
- PŘEDMĚT: {subject}
- ROČNÍK: {grade}
- TÉMA: {chapter_title}
- DÉLKA: {duration_minutes} minut

EXTRACTED METADATA:
{extracted_dump}

TEXT UČITELE:
{raw_text}

PRAVIDLA:
- Použij 4–7 bloků
- Každý blok musí mít konkrétní interval (např. 0–5, 5–15…)
- Součet musí dát přesně {duration_minutes} minut
- V každém bloku uveď aktivitu pro žáky (diskuze, práce ve dvojicích, cvičení, čtení s porozuměním…)
- Nezapomeň zahrnout čas na doporučenou aktivitu pro žáky

VÝSTUP:

# Příprava hodiny: {grade}. třída – {chapter_title} ({duration_minutes} minut)

## Časový plán
...

## 3 doporučené aktivity pro žáky
...

## Klíčová slova
...
""".strip()


def student_notes_system() -> str:
    return (
        "Jsi nejpilnější žák a nejlepší zapisovatel. "
        "Vytvoř přehledný zápis pro spolužáka ze základní školy. "
        "Vynech aktivity. "
        "Max cca 25 řádků. "
        "Nepřidávej nové informace – použij jen ty z EXTRACTED METADATA. "
        "Piš česky v markdown."
    )


def student_notes_user(
    grade: int,
    chapter_title: str,
    extracted_dump: dict,
    raw_text: str,
) -> str:
    return f"""
    ROČNÍK: {grade}
    TÉMA: {chapter_title}

    EXTRACTED METADATA:
    {extracted_dump}

    TEXT UČITELE:
    {raw_text}

    VÝSTUP:
    - Nadpis
    - Odrážky (hlavní body)
    - Definice pojmů
    - 5 kontrolních otázek
    """.strip()

def teacher_regen_system() -> str:
    return (
        "Jsi didaktický asistent. Přepisuješ UČITELSKÉ poznámky podle uživatelské poznámky.\n"
        "Piš česky a vracej čistý Markdown.\n"
        "DŮLEŽITÉ: Jediný zdroj informací a faktů je text, který upravuješ (CURRENT_MD).\n"
        "Nevymýšlej žádná nová fakta, letopočty ani jména, která nejsou v CURRENT_MD. Pokud to uživatel přímo nevyžaduje.\n"
    )


def teacher_regen_user(*, current_md: str, user_note: str) -> str:
        return f"""
    AKTUÁLNÍ UČITELSKÉ POZNÁMKY (JEDINÝ ZDROJ; tohle uprav):
    ---
    {current_md}
    ---

    UŽIVATELSKÁ POZNÁMKA (pokyny k úpravě):
    ---
    {user_note}
    ---

    POŽADAVKY:
    - Vrať kompletní přepsaný text (celý dokument).
    - Zachovej stejnou strukturu a nadpisy jako v CURRENT_MD (jen uprav obsah podle pokynů).
    - Nezaváděj nové fakta (žádné nové roky/jména/události mimo CURRENT_MD) pokud je uživatel nevyžaduje.
    """.strip()

def student_regen_system() -> str:
    return (
        "Jsi nejlepší zapisovatel. Přepisuješ STUDENTSKÉ poznámky podle uživatelské poznámky.\n"
        "Piš česky a vracej čistý Markdown.\n"
        "DŮLEŽITÉ: Jediný zdroj informací a faktů je text, který upravuješ (CURRENT_MD).\n"
        "Nevymýšlej žádná nová fakta, letopočty ani jména, která nejsou v CURRENT_MD. Pokud to uživatel přímo nevyžaduje.\n"
    )


def student_regen_user(*, current_md: str, user_note: str) -> str:
    return f"""
    AKTUÁLNÍ STUDENTSKÉ POZNÁMKY (JEDINÝ ZDROJ; tohle uprav):
    ---
    {current_md}
    ---

    UŽIVATELSKÁ POZNÁMKA:
    ---
    {user_note}
    ---

    POŽADAVKY:
    - Vrať kompletní přepsaný text.
    - Zachovej markdown strukturu z CURRENT_MD (nadpisy/sekce).
    - Když je v CURRENT_MD část pro učitele (metodika/poznámky pro učitele), zjednoduš ji pro žáka nebo ji vynech.
    """.strip()
