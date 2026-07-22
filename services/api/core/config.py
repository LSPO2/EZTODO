"""Application configuration."""

from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with strict validation."""

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # App
    APP_ENV: str = "development"
    APP_NAME: str = "EZTODO API"
    APP_VERSION: str = "0.1.0-m0"

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    # Database
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "eztodo"
    POSTGRES_USER: str = "eztodo"
    POSTGRES_PASSWORD: str = ""

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def DATABASE_URL_SYNC(self) -> str:
        return f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # JWT
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # AI
    AI_PROVIDER: str = "openai"
    AI_API_BASE: str = "https://api.openai.com/v1"
    AI_API_KEY: str = ""
    AI_MODEL: str = "gpt-4o-mini"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
