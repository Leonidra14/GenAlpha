from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DB_URL: str
    JWT_SECRET: str
    JWT_ACCESS_EXPIRES_MINUTES: int = 60
    JWT_ALGORITHM: str = "HS256"

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini-2024-07-18"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",  # <-- důležité: nepadá to na dalších env proměnných
    )

settings = Settings()