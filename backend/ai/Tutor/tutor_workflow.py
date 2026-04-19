import logging
import re
from collections.abc import Iterator
from typing import Any, Literal

from openai import OpenAI
from pydantic import BaseModel, Field

from app.core.openai_client import (
    model_fast,
    model_quality,
    temp_tutor_guard,
    temp_tutor_socratic,
)

from . import prompts

logger = logging.getLogger(__name__)

TUTOR_HISTORY_MESSAGE_CAP = 10
TUTOR_RECENT_USER_SNIPPETS = 2
_MAX_PARSE_RETRIES = 3

# Short follow-ups: skip strict classifier when there is prior chat context
_LOW_INFO_FOLLOWUPS_RAW = {
    "ano",
    "jo",
    "jasně",
    "jasne",
    "ok",
    "okej",
    "ne",
    "nevim",
    "nevím",
    "proc",
    "proč",
    "jak",
    "co",
    "coze",
    "cože",
    "hm",
    "hmm",
    "aha",
    "no jo",
}

_STUCK_SIGNALS = {
    "nevim",
    "nevím",
    "ne",
    "netusim",
    "netuším",
    "nechápu",
    "nechapu",
    "nevím vůbec",
    "nevim vubec",
    "fakt nevim",
    "fakt nevím",
    "nemám tušení",
    "nemam tuseni",
    "nevím.",
    "nevim.",
}

SAFE_FALLBACK_LEAK = (
    "Držme se této otázky. Můžu ti dát krátkou nápovědu k pojmu, době nebo souvislosti, "
    "aby ses mohl rozhodnout sám — napiš, co ti nejvíc hapruje."
)

REFUSAL_CHEATING = (
    "Přímo správnou odpověď nebo písmeno možnosti ti říct nemůžu. "
    "Můžu ale stručně upřesnit pojem nebo souvislost s tématem otázky — napiš, co ti není jasné."
)

REFUSAL_OFFTOPIC = (
    "Teď pomáhám jen u této kvízové otázky. Napiš prosím, s čím u ní potřebuješ pomoct — "
    "pojem, souvislost, nebo jak otázku uchopit."
)

_LEAK_PATTERNS = [
    re.compile(r"Textové šablony", re.IGNORECASE),
    re.compile(r"def\s+\w+\s*\(", re.IGNORECASE),
    re.compile(r"```"),
    re.compile(r"Vrať\s+POUZE", re.IGNORECASE),
    re.compile(r"response_format", re.IGNORECASE),
    re.compile(r"Jsi\s+klasifikátor", re.IGNORECASE),
    re.compile(r"Jsi\s+kontrolní\s+model", re.IGNORECASE),
    re.compile(r"Jsi\s+stručný\s+tutor", re.IGNORECASE),
    re.compile(r"Jsi\s+Sokratovský", re.IGNORECASE),
    re.compile(r"\bis_relevant\b"),
    re.compile(r"\brefuse_reason\b"),
    re.compile(r"Interní\s+(úryvek|poznámky|instrukce)", re.IGNORECASE),
    re.compile(r"Skryté\s+poznámky\s+jen\s+pro\s+tebe", re.IGNORECASE),
]


class TutorClassifyOut(BaseModel):
    is_relevant: bool
    intent: Literal[
        "answer_attempt",
        "ask_hint",
        "ask_explanation",
        "confusion",
        "meta_feedback",
        "frustration",
        "unclear_followup",
        "offtopic",
        "cheating",
    ]
    refuse_reason: Literal["none", "offtopic", "cheating"]
    short_reason: str = Field(default="", description="Krátký důvod pro logování")


class TutorAnswerSafetyOut(BaseModel):
    safe: bool
    issue_summary: str = Field(
        default="",
        description="Stručně co je špatně, pokud safe=False",
    )


def slice_tutor_messages(messages: list[dict[str, Any]], max_messages: int = TUTOR_HISTORY_MESSAGE_CAP) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for m in messages:
        role = m.get("role")
        if role not in ("user", "assistant"):
            continue
        content = m.get("content")
        if not isinstance(content, str):
            continue
        out.append({"role": role, "content": content})
    if len(out) <= max_messages:
        return out
    return out[-max_messages:]


def format_chat_history_text(messages: list[dict[str, Any]]) -> str:
    trimmed = slice_tutor_messages(messages, TUTOR_HISTORY_MESSAGE_CAP)
    if not trimmed:
        return "(žádná předchozí konverzace)"
    lines: list[str] = []
    for m in trimmed:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        label = "Student" if role == "user" else "Asistent"
        lines.append(f"{label}: {content}")
    return "\n".join(lines)


def recent_user_queries_text(messages: list[dict[str, Any]], max_users: int = TUTOR_RECENT_USER_SNIPPETS) -> str:
    users: list[str] = []
    for m in reversed(slice_tutor_messages(messages, TUTOR_HISTORY_MESSAGE_CAP)):
        if m.get("role") == "user":
            t = (m.get("content") or "").strip()
            if t:
                users.append(t)
            if len(users) >= max_users:
                break
    if not users:
        return "(žádné nedávné dotazy studenta)"
    users.reverse()
    return "\n".join(f"- {u}" for u in users)


def _normalize_short_reply(s: str) -> str:
    t = (s or "").strip().lower()
    t = t.rstrip("?!.…").strip()
    return t


def is_low_info_followup(user_message: str) -> bool:
    return _normalize_short_reply(user_message) in _LOW_INFO_FOLLOWUPS_RAW


def update_stuck_count(dotaz: str, current: int) -> int:
    normalized = _normalize_short_reply(dotaz)
    if normalized in _STUCK_SIGNALS:
        return current + 1
    return 0


def looks_like_prompt_leak(text: str) -> bool:
    if not (text or "").strip():
        return False
    for pat in _LEAK_PATTERNS:
        if pat.search(text):
            return True
    return False


def refusal_message_for_reason(reason: Literal["offtopic", "cheating"]) -> str:
    if reason == "cheating":
        return REFUSAL_CHEATING
    return REFUSAL_OFFTOPIC


def classify_intent(
    client: OpenAI,
    *,
    predmet: str,
    trida: str,
    nazev_kapitoly: str,
    dotaz: str,
    kvizova_otazka: str,
    tutor_messages: list[dict[str, Any]],
) -> TutorClassifyOut:
    chat_history_text = format_chat_history_text(tutor_messages)
    system_text = prompts.classify_system()
    user_text = prompts.classify_user(
        predmet=predmet,
        trida=trida,
        nazev_kapitoly=nazev_kapitoly,
        dotaz=dotaz,
        kvizova_otazka=kvizova_otazka,
        chat_history_text=chat_history_text,
    )
    for attempt in range(_MAX_PARSE_RETRIES):
        try:
            parsed_response = client.beta.chat.completions.parse(
                model=model_fast(),
                temperature=temp_tutor_guard(),
                messages=[
                    {"role": "system", "content": system_text},
                    {"role": "user", "content": user_text},
                ],
                response_format=TutorClassifyOut,
            )
            parsed = parsed_response.choices[0].message.parsed
            if parsed is None:
                raise ValueError("empty classify parse")
            return parsed
        except Exception as e:
            if attempt == _MAX_PARSE_RETRIES - 1:
                logger.error("Klasifikace tutora selhala: %s", e)
                raise
            logger.warning("Pokus %s o klasifikaci tutora selhal: %s", attempt + 1, e)
    raise RuntimeError("unreachable")


def classify_with_fast_path(
    client: OpenAI,
    *,
    user_message: str,
    tutor_messages: list[dict[str, Any]],
    predmet: str,
    trida: str,
    nazev_kapitoly: str,
    kvizova_otazka: str,
) -> TutorClassifyOut:
    trimmed_hist = slice_tutor_messages(tutor_messages, TUTOR_HISTORY_MESSAGE_CAP)
    if is_low_info_followup(user_message) and len(trimmed_hist) > 0:
        return TutorClassifyOut(
            is_relevant=True,
            intent="unclear_followup",
            refuse_reason="none",
            short_reason="low_info_fast_path",
        )
    return classify_intent(
        client,
        predmet=predmet,
        trida=trida,
        nazev_kapitoly=nazev_kapitoly,
        dotaz=user_message,
        kvizova_otazka=kvizova_otazka,
        tutor_messages=tutor_messages,
    )


def should_refuse(classification: TutorClassifyOut) -> Literal["offtopic", "cheating"] | None:
    """Return refusal kind, or None to generate a tutor reply (incl. meta / confusion / vague follow-up)."""
    if classification.refuse_reason == "cheating":
        return "cheating"
    if classification.refuse_reason == "offtopic" and not classification.is_relevant:
        return "offtopic"
    return None


def stream_tutor_reply(
    client: OpenAI,
    *,
    predmet: str,
    trida: str,
    nazev_kapitoly: str,
    kvizova_otazka: str,
    student_notes_excerpt: str,
    tutor_messages_before_user: list[dict[str, Any]],
    user_message_plain: str,
    intent: str,
    stuck_count: int,
) -> Iterator[str]:
    """
    Historie konverzace = samostatné API messages + poslední user = strukturovaný tutor_user().
    """
    system_content = prompts.tutor_system(
        predmet=predmet,
        trida=trida,
        nazev_kapitoly=nazev_kapitoly,
        kvizova_otazka=kvizova_otazka,
        student_notes_excerpt=student_notes_excerpt,
    )
    chat_history_text = format_chat_history_text(tutor_messages_before_user)
    wrapped_user = prompts.tutor_user(
        intent=intent,
        stuck_count=stuck_count,
        dotaz=user_message_plain,
        kvizova_otazka=kvizova_otazka,
        chat_history_text=chat_history_text,
    )
    api_messages: list[dict[str, Any]] = [{"role": "system", "content": system_content}]
    api_messages.extend(slice_tutor_messages(tutor_messages_before_user, TUTOR_HISTORY_MESSAGE_CAP))
    api_messages.append({"role": "user", "content": wrapped_user})

    stream = client.chat.completions.create(
        model=model_quality(),
        temperature=temp_tutor_socratic(),
        messages=api_messages,
        stream=True,
    )
    for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        if delta is None:
            continue
        piece = delta.content
        if piece:
            yield piece


def check_answer_safe(
    client: OpenAI,
    *,
    draft_answer: str,
    dotaz: str,
    kvizova_otazka: str,
    tutor_messages: list[dict[str, Any]],
) -> TutorAnswerSafetyOut:
    history_for_safety = format_chat_history_text(tutor_messages)
    system_text = prompts.safety_system()
    user_text = prompts.safety_user(
        draft_answer=draft_answer,
        dotaz=dotaz,
        kvizova_otazka=kvizova_otazka,
        chat_history_text=history_for_safety,
    )
    for attempt in range(_MAX_PARSE_RETRIES):
        try:
            parsed_response = client.beta.chat.completions.parse(
                model=model_fast(),
                temperature=temp_tutor_guard(),
                messages=[
                    {"role": "system", "content": system_text},
                    {"role": "user", "content": user_text},
                ],
                response_format=TutorAnswerSafetyOut,
            )
            parsed = parsed_response.choices[0].message.parsed
            if parsed is None:
                raise ValueError("empty safety parse")
            return parsed
        except Exception as e:
            if attempt == _MAX_PARSE_RETRIES - 1:
                logger.error("Tutor reply safety check failed: %s", e)
                raise
            logger.warning("Pokus %s o safety tutora selhal: %s", attempt + 1, e)
    raise RuntimeError("unreachable")


def rewrite_unsafe_answer(
    client: OpenAI,
    *,
    draft_answer: str,
    dotaz: str,
    kvizova_otazka: str,
    issue_summary: str,
    tutor_messages: list[dict[str, Any]],
) -> str:
    chat_excerpt = recent_user_queries_text(tutor_messages)
    system_text = prompts.rewrite_system()
    user_text = prompts.rewrite_user(
        draft_answer=draft_answer,
        dotaz=dotaz,
        kvizova_otazka=kvizova_otazka,
        issue_summary=issue_summary,
        chat_history_text=chat_excerpt,
    )
    for attempt in range(_MAX_PARSE_RETRIES):
        try:
            resp = client.chat.completions.create(
                model=model_quality(),
                temperature=temp_tutor_socratic(),
                messages=[
                    {"role": "system", "content": system_text},
                    {"role": "user", "content": user_text},
                ],
            )
            choice = resp.choices[0].message.content
            if choice and choice.strip():
                out = choice.strip()
                if looks_like_prompt_leak(out):
                    return SAFE_FALLBACK_LEAK
                return out
            raise ValueError("empty rewrite content")
        except Exception as e:
            if attempt == _MAX_PARSE_RETRIES - 1:
                logger.error("Failed to sanitize unsafe tutor reply: %s", e)
                raise
            logger.warning("Pokus %s o rewrite tutora selhal: %s", attempt + 1, e)
    raise RuntimeError("unreachable")
