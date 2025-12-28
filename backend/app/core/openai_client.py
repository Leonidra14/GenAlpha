import os
from openai import OpenAI

def get_openai_client() -> OpenAI:
    return OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def get_openai_model() -> str:
    return os.environ.get("OPENAI_MODEL", "gpt-4o-mini-2024-07-18")
