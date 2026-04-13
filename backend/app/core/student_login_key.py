from __future__ import annotations

import re
import unicodedata


def strip_last_name_for_login(last_name: str) -> str:
    s = (last_name or "").strip()
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.lower()
    return re.sub(r"[^a-z0-9]", "", s)


def build_student_login_key(last_name: str, user_id: int) -> str:
    slug = strip_last_name_for_login(last_name)
    if not slug:
        raise ValueError("empty_login_slug")
    return f"{slug}{int(user_id)}"
