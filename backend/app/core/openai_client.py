from openai import AsyncOpenAI, OpenAI
from app.core.settings import settings


# ---------- client ----------
def get_openai_client() -> OpenAI:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY není nastavený.")
    return OpenAI(api_key=settings.openai_api_key)


def get_async_openai_client() -> AsyncOpenAI:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY není nastavený.")
    return AsyncOpenAI(api_key=settings.openai_api_key)


# ---------- models ----------
def model_fast() -> str:
    if not settings.openai_model_fast:
        raise RuntimeError("OPENAI_MODEL_FAST není nastavený.")
    return settings.openai_model_fast


def model_quality() -> str:
    if not settings.openai_model_quality:
        raise RuntimeError("OPENAI_MODEL_QUALITY není nastavený.")
    return settings.openai_model_quality


# ---------- temperatures ----------
def temp_context() -> float:
    return settings.openai_temp_context


def temp_autotag() -> float:
    return settings.openai_temp_autotag


def temp_quality() -> float:
    return settings.openai_temp_quality


def temp_tutor_guard() -> float:
    return settings.openai_temp_tutor_guard


def temp_tutor_socratic() -> float:
    return settings.openai_temp_tutor_socratic
