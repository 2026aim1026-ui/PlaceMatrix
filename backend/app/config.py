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
        # SMTP (outgoing email). Credentials only ever come from the environment / backend/.env.
        # SMTP_USER / SMTP_FROM are accepted as older names for SMTP_USERNAME / SMTP_FROM_EMAIL.
        self.smtp_host: str = os.getenv("SMTP_HOST", "").strip()
        self.smtp_port: int = int(os.getenv("SMTP_PORT", "587") or 587)
        self.smtp_username: str = (os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER") or "").strip()
        self.smtp_password: str = os.getenv("SMTP_PASSWORD", "").replace(" ", "")  # Gmail app passwords are shown with spaces
        self.smtp_from_email: str = (os.getenv("SMTP_FROM_EMAIL") or os.getenv("SMTP_FROM") or self.smtp_username
                                     or f"cdpc@{self.allowed_email_domain}").strip()
        self.smtp_from_name: str = os.getenv("SMTP_FROM_NAME", "CDPC IIT Ropar — PlaceMatrix").strip()
        # starttls (port 587, Gmail/Outlook), ssl (port 465) or none (local test server only).
        security = os.getenv("SMTP_SECURITY", "").strip().lower()
        if not security:
            if _bool("SMTP_USE_SSL", False) or os.getenv("SMTP_SSL", "").lower() in {"1", "true", "yes"}:
                security = "ssl"
            elif os.getenv("SMTP_USE_TLS", os.getenv("SMTP_TLS", "")).lower() in {"0", "false", "no"}:
                security = "none"
            else:
                security = "ssl" if self.smtp_port == 465 else "starttls"
        if security not in {"starttls", "ssl", "none"}:
            raise ValueError("SMTP_SECURITY must be starttls, ssl or none")
        self.smtp_security: str = security
        self.smtp_timeout: int = int(os.getenv("SMTP_TIMEOUT", "20"))
        self.email_max_recipients: int = int(os.getenv("EMAIL_MAX_RECIPIENTS", "200"))
        self.invite_ttl_days: int = int(os.getenv("INVITE_TTL_DAYS", "14"))
        # Resume library
        self.max_resumes: int = int(os.getenv("MAX_RESUMES", "10"))
        # Schema & live sync
        self.auto_migrate: bool = _bool("AUTO_MIGRATE", True)
        self.realtime_sync: bool = _bool("REALTIME_SYNC", True)
        # Graduation batch assigned to newly onboarded students (editable in their Profile Audit).
        self.default_grad_year: int = int(os.getenv("DEFAULT_GRAD_YEAR", "2026"))

    def email_allowed(self, email: str) -> bool:
        return email.strip().lower().endswith("@" + self.allowed_email_domain)

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_from_email)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
