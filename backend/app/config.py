"""Application settings, read from environment variables (or a .env file in backend/)."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/


def _load_dotenv() -> None:
    """Minimal .env loader so the project runs without python-dotenv."""
    env_file = BASE_DIR / ".env"
    if not env_file.exists():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_dotenv()


def _bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _normalize_db_url(url: str) -> str:
    """Hosting sites (Render, Heroku...) give postgres:// or postgresql://; this app uses the psycopg 3 driver."""
    url = url.strip()
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


class Settings:
    def __init__(self) -> None:
        self.database_url: str = _normalize_db_url(os.getenv(
            "DATABASE_URL", "postgresql+psycopg://placematrix:placematrix@localhost:5432/placematrix"
        ))
        self.secret_key: str = os.getenv("SECRET_KEY", "change-me-in-production-placematrix-secret")
        self.token_ttl_hours: int = int(os.getenv("TOKEN_TTL_HOURS", "12"))
        self.allowed_email_domain: str = os.getenv("ALLOWED_EMAIL_DOMAIN", "iitrpr.ac.in").lower().lstrip("@")
        # Demo mode enables one-click demo logins, account switching and "Reset demo data".
        self.demo_mode: bool = _bool("DEMO_MODE", True)
        self.demo_password: str = os.getenv("DEMO_PASSWORD", "demo123")
        upload_dir = Path(os.getenv("UPLOAD_DIR", "uploads"))
        self.upload_dir: Path = (upload_dir if upload_dir.is_absolute() else BASE_DIR / upload_dir).resolve()
        self.max_upload_bytes: int = int(os.getenv("MAX_UPLOAD_MB", "5")) * 1024 * 1024
        self.cors_origins: list[str] = [
            o.strip()
            for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
            if o.strip()
        ]
        self.frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
        # Optional Google Sign-In (OAuth2 / OpenID Connect ID tokens).
        self.google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "").strip()
        # Optional SMTP relay for invitation emails. Without it, activation links are shown to CCPC.
        self.smtp_host: str = os.getenv("SMTP_HOST", "").strip()
        self.smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user: str = os.getenv("SMTP_USER", "").strip()
        self.smtp_password: str = os.getenv("SMTP_PASSWORD", "")
        self.smtp_from: str = os.getenv("SMTP_FROM", f"cdpc@{self.allowed_email_domain}")
        self.invite_ttl_days: int = int(os.getenv("INVITE_TTL_DAYS", "14"))
        # Graduation batch assigned to newly onboarded students (editable in their Profile Audit).
        self.default_grad_year: int = int(os.getenv("DEFAULT_GRAD_YEAR", "2026"))

    def email_allowed(self, email: str) -> bool:
        return email.strip().lower().endswith("@" + self.allowed_email_domain)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
