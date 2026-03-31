import re

def sanitize_text(v: str | None) -> str | None:
    if v is None:
        return v
    
    v_clean = re.sub(r'<[^>]*>', '', v)
    
    return v_clean.strip()

def validate_password_spaces(v: str) -> str:
    if " " in v:
        raise ValueError("Heslo nesmí obsahovat mezery.")
    return v