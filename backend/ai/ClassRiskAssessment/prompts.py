def _escape_for_prompt(value: str) -> str:
    return (value or "").strip()


def class_risk_system() -> str:
    return (
        "Jsi analytický AI asistent pro učitele. "
        "Hodnotíš riziko žáků v rámci jedné třídy na základě dodaných metrik "
        "a ke každému žákovi doplníš praktické doporučení pro učitele. "
        "Vrať výhradně strukturovaný JSON podle response schema. "
        "Nevypisuj markdown, vysvětlivky ani text mimo JSON."
    )


def class_risk_user(
    *,
    class_id: int,
    class_grade: str,
    subject: str,
    topic_scope: str,
    threshold_percent: float,
    generated_at_iso: str,
    student_rows_json: str,
) -> str:
    return (
        f"class_id: {class_id}\n"
        f"trida/rocnik: {_escape_for_prompt(class_grade)}\n"
        f"predmet: {_escape_for_prompt(subject)}\n"
        f"scope_temat: {_escape_for_prompt(topic_scope)}\n"
        f"prahovy_procentualni_limit: {threshold_percent:.2f}\n"
        f"cas_vyhodnoceni_iso: {_escape_for_prompt(generated_at_iso)}\n\n"
        "Vstupni data studentu (JSON array). Kazdy objekt muze obsahovat metriky jako:\n"
        "- student_id, first_name, last_name\n"
        "- attempt_count, avg_score_percent, completion_percent\n"
        "- inactive_days, trend_delta_percent, no_improvement_attempts\n"
        "- optional_signal_flags[]\n\n"
        "Pravidla hodnoceni:\n"
        "1) risk_level musi byt low|medium|high.\n"
        "2) risk_score je integer 0..100 a musi odpovidat duvodum.\n"
        "3) reasons jsou strucne ceske vety, konkretni a navazane na metriky.\n"
        "4) teacher_recommendation u kazdeho studenta: prakticke doporuceni pro ucitele (1-3 vety, cestina), "
        "navazujici na reasons (co zkusit ve tride, individualne, s rodicem).\n"
        "5) Pokud data nestaci, zvol konzervativni odhad (spis medium nez high) a uved chybejici signal v reasons.\n"
        "6) summary ma byt kratky prehled pro ucitele (1-3 vety).\n"
        "7) Nevymyslej studenty, vrat jen studenty ze vstupu.\n\n"
        f"student_rows_json:\n{student_rows_json}"
    )
