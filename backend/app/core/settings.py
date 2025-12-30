from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # --- DB / Auth ---
    DB_URL: str
    JWT_SECRET: str
    JWT_ACCESS_EXPIRES_MINUTES: int = 60
    JWT_ALGORITHM: str = "HS256"

    # --- OpenAI ---
    openai_api_key: str | None = None

    # model roles (nastavuješ v .env)
    openai_model_fast: str = "gpt-4o-mini-2024-07-18"
    openai_model_quality: str = "chatgpt-4o-latest"

    # temperatures (nastavuješ v .env)
    openai_temp_context: float = 0.1
    openai_temp_autotag: float = 0.1
    openai_temp_quality: float = 0.7

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

settings = Settings()
