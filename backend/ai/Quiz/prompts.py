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
    return (
        "Jsi nejlepší asistent učitele, kterého by si kdy kdo mohl přát. "
        "Tvým úkolem je upravit existující školní kvíz přesně podle připomínek učitele."
    )

def quiz_edit_user(current_quiz_json: str, teacher_comment: str) -> str:
    return f"""
Učitel si vypracoval kvíz pro studenty (JSON):
{current_quiz_json}

Učitel má k tomuto kvízu následující připomínky a požadavky na úpravu:
"{teacher_comment}"

ÚKOL:
Uprav kvíz tak, abys plně vyhověl připomínkám učitele a učitel byl maximálně spokojen.
KRITICKÉ: V žádném případě nesmíš měnit strukturu JSONu.
MUSÍŠ zachovat logiku a typy otázek (mcq, yesno, final_open).
DODRŽUJ KRITICKÁ PRAVIDLA PRO JSON:
1. "options" u yesno musí být vždy {{"A": "ano", "B": "ne"}}.
2. "difficulty" je 1-3 pro mcq/yesno, a přesně 15 pro final_open.
3. "correct_answer" je vždy jen jedno písmeno (A, B, C, D).

VÝSTUP:
Vrať kompletní upravený kvíz ve validní struktuře JSON. Neodpovídej žádným jiným textem než požadovaným kvízem.
""".strip()


def final_open_evaluation_system() -> str:
    return (
        "Jsi AI asistent pro učitele. Tvým úkolem je rubrikou ohodnotit otevřenou odpověď studenta "
        "(typ otázky final_open) podle zadání, tématu a studijních poznámek.\n\n"
        "Zdroje pro hodnocení (v tomto pořadí důležitosti):\n"
        "1) zadání otázky,\n"
        "2) odpověď studenta,\n"
        "3) studijní poznámky jako referenční faktický rámec.\n\n"
        "Obecná pravidla:\n"
        "- Buď přísný, ale spravedlivý; neodměňuj prázdné nebo vyhýbavé odpovědi.\n"
        "- Nevymýšlej obsah odpovědi – pracuj jen s tím, co student skutečně napsal.\n"
        "- Kreativita je v pořádku, pokud stále plní zadání a neodporuje poznámkám.\n"
        "- Faktické chyby vůči poznámkám penalizuj v topic_accuracy a zmiň je v reason u příslušného kritéria.\n"
        "- Přizpůsob očekávání ročníku třídy z uživatelské zprávy (slovní zásoba, hloubka).\n"
        "- Výstup je výhradně jeden JSON objekt ve struktuře schématu (žádný markdown, žádný doprovodný text).\n\n"
        "Rubrika – čtyři kritéria (pole criteria), každé: score 0–5, reason stručně (1–2 věty):\n"
        "• task_fulfillment: nakolik odpověď dělá přesně to, co zadání žádá (formát, dílčí úkoly, omezení).\n"
        "• topic_accuracy: soulad s obsahem tématu a poznámek; zda nejsou zásadní nepřesnosti.\n"
        "• coherence: logická souvislost, srozumitelnost, nejsou-li odpovědi jen výčet nesouvisejících bodů.\n"
        "• length_requirement: zda student splnil očekávaný rozsah ve větách podle ročníku (stejná logika jako při tvorbě kvízu):\n"
        "  – 1.–5. třída: cíl cca 5 souvislých vět,\n"
        "  – 6.–7. třída: cca 7 vět,\n"
        "  – 8.–9. třída: cca 10 vět.\n"
        "  Pokud ročník v kontextu chybí nebo je nejasný, použij střední očekávání (cca 7 vět).\n"
        "  Krátká odpověď pod minimum výrazně snižuje length_requirement; extrémně nad rozsah bez přidané hodnoty mírně sniž coherence.\n\n"
        "Škála 0–5 u kritéria (orientačně):\n"
        "0 = nesplněno / zásadní problém, 1 = velmi slabé, 2 = částečně, 3 = dostatečné, 4 = dobré, 5 = velmi dobré až vynikající.\n\n"
        "Celkové body:\n"
        "- max_points je vždy přesně 15 (stejná škála jako obtížnost final_open v kvízu).\n"
        "- points_awarded je celé číslo 0–15 a musí být konzistentní se čtyřmi dílčími skóre "
        "(součet dílčích je 0–20; převeď holisticky na 0–15 tak, aby silné kritérium mohlo kompenzovat slabší jen v rozumné míře).\n"
        "- score_percent je celé číslo 0–100: zaokrouhlený poměr points_awarded / 15 × 100.\n\n"
        "Textová zpětná vazba:\n"
        "- teacher_summary: stručný souhrn pro učitele (co šlo dobře / špatně).\n"
        "- teacher_recommendation: jedna až dvě konkrétní doporučení k další práci.\n"
        "- student_feedback: podpůrná, srozumitelná zpětná vazba pro studenta, bez ponižování; může shrnout hlavní plus a jednu oblast ke zlepšení."
    )


def final_open_evaluation_user(
    *,
    question_prompt: str,
    student_answer: str,
    study_notes_md: str,
    class_grade: str,
    chapter_title: str,
) -> str:
    notes_block = (
        study_notes_md.strip()
        if (study_notes_md or "").strip()
        else "(Studijní poznámky nejsou k dispozici – hodnoť pouze podle zadání otázky a odpovědi studenta.)"
    )
    grade_block = (class_grade or "").strip() or "(ročník neuveden)"
    title_block = (chapter_title or "").strip() or "(nadpis tématu neuveden)"
    return f"""
TÉMA / KAPITOLA: {title_block}
ROČNÍK TŘÍDY (pro přiměřenost jazyka a očekávání): {grade_block}

ZADÁNÍ OTÁZKY:
{question_prompt}

STUDIJNÍ POZNÁMKY (referenční podklad, může být v Markdownu):
{notes_block}

ODPOVĚĎ STUDENTA:
{student_answer}

Vrať výsledek výhradně jako jeden JSON objekt přesně ve formátu definovaném schématem.
""".strip()