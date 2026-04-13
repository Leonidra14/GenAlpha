from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # --- DB / Auth ---
    DB_URL: str
    JWT_SECRET: str
    JWT_ACCESS_EXPIRES_MINUTES: int = 30
    JWT_REFRESH_EXPIRES_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"

    # --- OpenAI ---
    openai_api_key: str | None = None

    # model roles
    openai_model_fast: str = "gpt-4.1-mini"
    openai_model_quality: str = "gpt-4.1"

    # temperatures
    openai_temp_context: float = 0.1
    openai_temp_autotag: float = 0.1
    openai_temp_quality: float = 0.7
    openai_temp_tutor_guard: float = 0.15
    openai_temp_tutor_socratic: float = 0.45
    class_risk_cache_ttl_seconds: int = 86400

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

settings = Settings()