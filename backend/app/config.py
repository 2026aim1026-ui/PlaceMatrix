import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    google_client_id: str = ""
    jwt_secret: str = "development-only-change-me"
    database_url: str = "sqlite:///./placematrix.db"
    frontend_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    ccpc_emails: str = ""
    verifier_emails: str = ""
    spoc_emails: str = ""
    token_expiry_minutes: int = 720
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    def email_set(self, value: str) -> set[str]:
        return {item.strip().lower() for item in value.split(",") if item.strip()}

    @property
    def origins(self) -> list[str]:
        return [item.strip() for item in self.frontend_origins.split(",") if item.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
