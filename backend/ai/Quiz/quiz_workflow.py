import json
from typing import Any, Dict
from openai import OpenAI

from app.core.openai_client import model_quality, temp_quality

import logging
logger = logging.getLogger(__name__)


def _strip_outer_code_fence(s: str) -> str:
    t = (s or "").strip()
    if not t.startswith("```"):
        return t
    lines = t.splitlines()
    if len(lines) < 3:
        return t
    if not lines[0].startswith("```"):
        return t
    if lines[-1].strip() != "```":
        return t
    return "\n".join(lines[1:-1]).strip()


def run_quiz_generate_workflow(
    client: OpenAI,
    *,
    class_grade: str,
    subject: str,
    chapter_title: str,
    plain_text: str,
    mcq: int,
    yesno: int,
    final_open: int,
) -> Dict[str, Any]:
    """
    Vrací dict odpovídající JSON schématu:
    { "questions": [ ... ] }
    """

    system = "Jsi AI asistent pro učitele. Generuješ školní kvíz pro konkrétní třídu."

    user = f"""
Popis třídy: {class_grade} třída. předmět: {subject} probírané téma: {chapter_title}

Informace budeš čerpat ze zápisků, které schálil učitel a studenti se podle nich učí: {plain_text}

ÚKOL:
1) Vygeneruj kvíz pouze z {plain_text} (žádná fakta mimo text).
2) Vytvoř {mcq} mcq, {yesno} yesno (ANO/NE) a {final_open} final_open jako poslední otázku.
3) FINAL_OPEN musí být kreativní, ale vhodná pro předmět a úroveň třídy:
   - sám kreativně zvol typ úlohy (letter / diary / dialogue / explain_process / story…)
   - úloha musí ověřovat pochopení souvislostí a schopnost použít znalosti
   - zadání musí být konkrétní, měřitelné a přiměřené věku žáku v {class_grade}.třídě
   - délka odpovědí bude vždy počet vět, NE slov, nebo znaků 

minimální DÉLKA FINAL_OPEN ODPOVĚDI (POUZE POČET VĚT, NE SLOV):
- 1.–5. třída: 5 vět
- 6.–7. třída: 7 vět
- 8.–9. třída: 10 vět

Ke KAŽDÉ uzavřené otázce přidej vysvětlení:
- explanation: 1 věta, proč je odpověď správná spojená s  krátká zajímavost, souvislost nebo perlička, která pomůže zapamatování
  (např. historická zajímavost, překvapivý fakt, praktická souvislost)

VÝSTUP:
Vrať POUZE validní JSON ve struktuře:
{{
  "questions": [
    {{
      "id": "q1",
      "type": "mcq",
      "difficulty": 1,
      "prompt": "Zadání otázky…",
      "options": {{
        "A": "…",
        "B": "…",
        "C": "…",
        "D": "…"
      }},
      "correct_answer": "B",
      "explanation": "Krátké odůvodnění (1–2 věty), případně krátký kontext."
    }},
    {{
      "id": "q2",
      "type": "yesno",
      "difficulty": 1,
      "prompt": "Tvrzení… (ANO/NE)",
      "options": {{
        "A": "ano",
        "B": "ne"
      }},
      "correct_answer": "A",
      "explanation": "Krátké odůvodnění, proč ano/ne."
    }},
    {{
      "id": "q_last",
      "type": "final_open",
      "difficulty": 15,
      "prompt": "Kreativní závěrečná úloha vhodná pro předmět a úroveň třídy s přesnými a měřitelnými požadavky…"
    }}
  ]
}}

Pravidla:
- mcq: 4 možnosti A–D, pouze 1 správná
- yesno: A = ano, B = ne
- final_open: bez správné odpovědi
- obtížnost 1–3, final_open vždy 15
- žádný markdown, žádný komentář mimo JSON
""".strip()
    
    max_retries = 3
    last_exception = None

    for attempt in range(max_retries):
        try:
            resp = client.responses.create(
                model=model_quality(),
                temperature=temp_quality(),
                input=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": [{"type": "input_text", "text": user}]},
                ],
            )
            
            text = _strip_outer_code_fence(resp.output_text or "")
            data = json.loads(text)

            if not isinstance(data, dict) or "questions" not in data:
                raise ValueError("Chybí klíč 'questions'")

            return data 

        except (json.JSONDecodeError, ValueError, Exception) as e:
            last_exception = e
            logger.warning(f"Pokus {attempt + 1} o generování kvízu selhal: {e}")
            continue

    raise ValueError(f"Po {max_retries} pokusech se nepodařilo vygenerovat validní kvíz. Chyba: {last_exception}")



def generate_quiz(
    client: OpenAI,
    *,
    class_grade: str,
    subject: str,
    chapter_title: str,
    plain_text: str,
    mcq: int,
    yesno: int,
    final_open: int,
) -> Dict[str, Any]:
    return run_quiz_generate_workflow(
        client,
        class_grade=class_grade,
        subject=subject,
        chapter_title=chapter_title,
        plain_text=plain_text,
        mcq=mcq,
        yesno=yesno,
        final_open=final_open,
    )
