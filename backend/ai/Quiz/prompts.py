def quiz_generation_system() -> str:
    return "Jsi AI asistent pro učitele. Generuješ školní kvíz pro konkrétní třídu."

def quiz_generation_user(
    class_grade: str, 
    subject: str, 
    chapter_title: str, 
    plain_text: str, 
    mcq: int, 
    yesno: int, 
    final_open: int
) -> str:
    return f"""
Popis třídy: {class_grade} třída. předmět: {subject} probírané téma: {chapter_title}

Informace budeš čerpat ze zápisků, které schválil učitel a studenti se podle nich učí: 
{plain_text}

ÚKOL:
1) Vygeneruj kvíz pouze z dodaného textu (žádná fakta mimo text).
2) Vytvoř {mcq} otázek typu mcq, {yesno} typu yesno (ANO/NE) a {final_open} final_open jako poslední otázku.
3) FINAL_OPEN musí být kreativní, ale vhodná pro předmět a úroveň třídy (15. úroveň obtížnosti).
   - délka odpovědí bude vždy určená na počet vět, NE na počet slov nebo znaků.
   - 1.–5. třída: 5 vět | 6.–7. třída: 7 vět | 8.–9. třída: 10 vět

KRITICKÁ PRAVIDLA PRO JSON (POKUD JE PORUŠÍŠ, SYSTÉM SPADNE):
1. "difficulty": Pro 'mcq' a 'yesno' otázky MUSÍ být hodnota POUZE celé číslo 1, 2 nebo 3. NESMÍŠ použít vyšší čísla! Pro 'final_open' je obtížnost vždy přesně 15.
2. "options" u 'yesno' otázek: Klíče musí být striktně "A" a "B".
   - SPRÁVNĚ: {{"A": "ano", "B": "ne"}}
   - ŠPATNĚ: {{"Ano": "Ano", "Ne": "Ne"}} (Toto nesmíš nikdy udělat!)
3. "options" u 'mcq' otázek: Klíče musí být striktně "A", "B", "C", "D".
4. "correct_answer": Musí to být JEDNO PÍSMENO, které odpovídá klíči z options (tedy "A", "B", "C" nebo "D"). Nesmí to být celé slovo (např. "ano" je špatně, "A" je správně).

Pravidla:
- mcq: 4 možnosti A–D, pouze 1 správná
- yesno: A = ano, B = ne
- final_open: bez správné odpovědi
- obtížnost 1–3, final_open vždy 15
- žádný markdown, žádný komentář mimo JSON
""".strip()

def quiz_edit_system() -> str:
    return "Jsi špičkový AI asistent učitele. Tvým úkolem je upravit existující školní kvíz přesně podle připomínek učitele."

def quiz_edit_user(current_quiz_json: str, teacher_comment: str) -> str:
    return f"""
Zde je aktuální podoba kvízu:
{current_quiz_json}

Učitel má k tomuto kvízu následující připomínky a požadavky na úpravu:
"{teacher_comment}"

ÚKOL:
Uprav kvíz tak, abys plně vyhověl připomínkám učitele.
MUSÍŠ zachovat logiku a typy otázek (mcq, yesno, final_open).
DODRŽUJ KRITICKÁ PRAVIDLA PRO JSON:
1. "options" u yesno musí být vždy {{"A": "ano", "B": "ne"}}.
2. "difficulty" je 1-3 pro mcq/yesno, a přesně 15 pro final_open.
3. "correct_answer" je vždy jen jedno písmeno (A, B, C, D).

VÝSTUP:
Vrať kompletní upravený kvíz ve validní struktuře JSON. Neodpovídej žádným jiným textem než požadovaným kvízem.
""".strip()