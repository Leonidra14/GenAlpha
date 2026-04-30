def _critical_json_rules_block() -> str:
    # Keep in sync with backend/ai/Quiz/prompts.py (quiz_generation_user).
    return """
KRITICKÁ PRAVIDLA PRO JSON (POKUD JE PORUŠÍŠ, SYSTÉM SPADNE):
1. "difficulty": Pro 'mcq' a 'yesno' otázky MUSÍ být hodnota POUZE celé číslo 1, 2 nebo 3. NESMÍŠ použít vyšší čísla! Pro 'final_open' je obtížnost vždy přesně 15.
2. "options" u 'yesno' otázek: Klíče musí být striktně "A" a "B".
   - SPRÁVNĚ: {"A": "ano", "B": "ne"}
   - ŠPATNĚ: {"Ano": "Ano", "Ne": "Ne"} (Toto nesmíš nikdy udělat!)
3. "options" u 'mcq' otázek: Klíče musí být striktně "A", "B", "C", "D".
4. "correct_answer": Musí to být JEDNO PÍSMENO, které odpovídá klíči z options (tedy "A", "B", "C" nebo "D"). Nesmí to být celé slovo (např. "ano" je špatně, "A" je správně).

Obecná pravidla typů:
- mcq: 4 možnosti A–D, pouze 1 správná, vždy vyplň "explanation".
- yesno: A = ano, B = ne, vždy vyplň "explanation".
- final_open: bez správné odpovědi, bez "options", obtížnost vždy 15, bez "correct_answer" a "explanation".
- žádný markdown, žádný komentář mimo JSON
""".strip()


def bonus_quiz_generation_system() -> str:
    return (
        "Jsi AI asistent pro školu. Generuješ bonusový doplnkový kvíz pro studenta "
        "na základě jeho studijních poznámek, výsledku hlavního kvízu a chyb z posledního pokusu. "
        "Kvíz musí být konzistentní se schématem aplikace (mcq, yesno, jedna závěrečná final_open)."
    )


def bonus_quiz_user_beginner(
    *,
    class_grade: str,
    subject: str,
    chapter_title: str,
    student_notes_md: str,
    mistakes_json: str,
    base_quiz_json: str,
    score: float,
    score_pct: float,
) -> str:
    mcq, yesno, final_open = 3, 7, 1
    return f"""
Popis třídy: {class_grade}. Předmět: {subject}. Téma / kapitola: {chapter_title}

VÝSLEDEK POSLEDNÍHO DOKONČENÉHO HLAVNÍHO KVÍZU (pro kontext obtížnosti bonusu):
- body (raw score): {score}
- úspěšnost v procentech: {score_pct:.1f} %

Tato úroveň bonusu je ZAČÁTECNICKÁ (nízká úspěšnost v hlavním kvízu): upřednostni srozumitelné otázky ANO/NE a kratší jistotu u výběru z možností.

STUDIJNÍ POZNÁMKY STUDENTA (primární zdroj faktů pro bonus; může být Markdown):
{student_notes_md}

CHYBY / PROBLÉMOVÉ ČÁSTI Z POSLEDNÍHO HLAVNÍHO POKUSU (JSON nebo text; může být prázdné):
{mistakes_json}

PŮVODNÍ HLAVNÍ KVÍZ K TÉMATU (JSON – inspirace stylu a pokrytí, nepoužívej stejné otázky jako v base_quiz_json):
{base_quiz_json}

ÚKOL:
1) Vygeneruj bonusový kvíz výhradně z obsahu studijních poznámek (žádná fakta mimo ně), s důrazem na oblasti, kde student chyboval.
2) Pořadí typů je libovolné, ale na konci musí být přesně jedna otázka typu final_open (poslední v seznamu questions).
3) Počty: {mcq}× mcq, {yesno}× yesno, {final_open}× final_open.
4) FINAL_OPEN musí být jedna kreativní závěrečná úloha vhodná pro předmět a ročník (obtížnost vždy 15).
   - otázka je jednodušší než final_open v base_quiz_json
   - délka očekávané odpovědi studenta je vždy určená na počet vět, NE na počet slov nebo znaků.
   - 1.–5. třída: cca 5 vět | 6.–7. třída: cca 7 vět | 8.–9. třída: cca 10 vět

{_critical_json_rules_block()}
""".strip()


def bonus_quiz_user_medium(
    *,
    class_grade: str,
    subject: str,
    chapter_title: str,
    student_notes_md: str,
    mistakes_json: str,
    base_quiz_json: str,
    score: float,
    score_pct: float,
) -> str:
    mcq, yesno, final_open = 5, 5, 1
    return f"""
Popis třídy: {class_grade}. Předmět: {subject}. Téma / kapitola: {chapter_title}

VÝSLEDEK POSLEDNÍHO DOKONČENÉHO HLAVNÍHO KVÍZU:
- body (raw score): {score}
- úspěšnost v procentech: {score_pct:.1f} %

Tato úroveň bonusu je STŘEDNÍ: vyvážený mix uzavřených typů a jedna náročnější otevřená úloha.

STUDIJNÍ POZNÁMKY STUDENTA (primární zdroj; může být Markdown):
{student_notes_md}

CHYBY Z POSLEDNÍHO HLAVNÍHO POKUSU (JSON nebo text):
{mistakes_json}

PŮVODNÍ HLAVNÍ KVÍZ K TÉMATU (JSON – reference, ne kopie):
{base_quiz_json}

ÚKOL:
1) Bonusový kvíz pouze z poznámek; propoj s typickými chybami studenta.
2) Poslední otázka v seznamu musí být přesně jedna final_open.
3) Počty: {mcq}× mcq, {yesno}× yesno, {final_open}× final_open.
4) FINAL_OPEN: kreativní závěrečná úloha, obtížnost 15, očekávaný rozsah odpovědi podle ročníku ve větách 
(viz níže). Její obtížnost je podobná jako ve  final_open v base_quiz_json.

Rozsah odpovědi u final_open (počet vět, ne slov):
- 1.–5. třída: cca 5 vět | 6.–7. třída: cca 7 vět | 8.–9. třída: cca 10 vět

{_critical_json_rules_block()}
""".strip()


def bonus_quiz_user_advanced(
    *,
    class_grade: str,
    subject: str,
    chapter_title: str,
    student_notes_md: str,
    mistakes_json: str,
    base_quiz_json: str,
    score: float,
    score_pct: float,
) -> str:
    mcq, yesno, final_open = 7, 3, 1
    return f"""
Popis třídy: {class_grade}. Předmět: {subject}. Téma / kapitola: {chapter_title}

VÝSLEDEK POSLEDNÍHO DOKONČENÉHO HLAVNÍHO KVÍZU:
- body (raw score): {score}
- úspěšnost v procentech: {score_pct:.1f} %

Tato úroveň bonusu je POKROČILÁ (vysoká úspěšnost v hlavním kvízu): více náročných výběrových otázek (mcq), méně jednoduchých ANO/NE, stále jedna závěrečná kreativní final_open.

STUDIJNÍ POZNÁMKY STUDENTA (primární zdroj; může být Markdown):
{student_notes_md}

CHYBY Z POSLEDNÍHO HLAVNÍHO POKUSU (JSON nebo text; i malé nepřesnosti zde zohledni):
{mistakes_json}

PŮVODNÍ HLAVNÍ KVÍZ K TÉMATU (JSON – reference stylu a hloubky):
{base_quiz_json}

ÚKOL:
1) Bonusový kvíz výhradně z poznámek; přidej jemnější rozlišování pojmů v mcq tam, kde to dává smysl.
2) Poslední položka v questions musí být přesně jedna final_open.
3) Počty: {mcq}× mcq, {yesno}× yesno, {final_open}× final_open.
4) FINAL_OPEN: náročnější kreativní závěrečná úloha (obtížnost 15), stále odvozená z poznámek.

Rozsah odpovědi u final_open (počet vět):
- 1.–5. třída: cca 5 vět | 6.–7. třída: cca 7 vět | 8.–9. třída: cca 10 vět

{_critical_json_rules_block()}
""".strip()
