"""SMTP email delivery for PlaceMatrix.

All connection details come from settings (backend/.env): SMTP_HOST, SMTP_PORT, SMTP_USERNAME,
SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_FROM_NAME, SMTP_SECURITY (starttls | ssl | none), SMTP_TIMEOUT.
Nothing here is hard-coded and the password is never returned by any API.
"""

from __future__ import annotations

import html
import logging
import re
import smtplib
import socket
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from .config import settings

logger = logging.getLogger("placematrix.email")

EMAIL_RE = re.compile(r"^[^@\s<>\"']+@[^@\s<>\"']+\.[^@\s<>\"']+$")
_URL_RE = re.compile(r"(https?://[^\s<]+)")


@dataclass
class OutgoingEmail:
    to_email: str
    to_name: str | None
    subject: str
    body: str  # plain text; an HTML alternative is generated from it


@dataclass
class SendResult:
    ok: bool
    error: str | None = None


class EmailNotConfigured(RuntimeError):
    pass


def friendly_error(exc: BaseException) -> str:
    """Turn smtplib / socket errors into messages a CDPC admin can act on."""
    if isinstance(exc, EmailNotConfigured):
        return str(exc)
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return ("SMTP login failed — check SMTP_USERNAME and SMTP_PASSWORD (Gmail needs a 16-character App "
                f"Password, not your normal password). Server said: {_server_text(exc)}")
    if isinstance(exc, smtplib.SMTPSenderRefused):
        return f"The server refused the sender address {settings.smtp_from_email}: {_server_text(exc)}"
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        return "The server refused this recipient address."
    if isinstance(exc, smtplib.SMTPNotSupportedError):
        return f"The SMTP server does not support this security mode ({settings.smtp_security}); check SMTP_SECURITY / SMTP_PORT."
    if isinstance(exc, ssl.SSLError):
        return (f"TLS/SSL handshake failed ({exc.reason or exc}). Use SMTP_SECURITY=starttls with port 587, "
                "or SMTP_SECURITY=ssl with port 465.")
    if isinstance(exc, socket.gaierror):
        return f"SMTP host '{settings.smtp_host}' could not be found (DNS). Check SMTP_HOST."
    if isinstance(exc, ConnectionRefusedError):
        return f"Connection refused by {settings.smtp_host}:{settings.smtp_port}. Check SMTP_HOST / SMTP_PORT and your firewall."
    if isinstance(exc, (TimeoutError, socket.timeout)):
        return f"Timed out connecting to {settings.smtp_host}:{settings.smtp_port}. The port may be blocked on this network."
    if isinstance(exc, smtplib.SMTPServerDisconnected):
        return "The SMTP server closed the connection unexpectedly (wrong port/security mode, or rate limit)."
    if isinstance(exc, smtplib.SMTPResponseException):
        return f"SMTP error {exc.smtp_code}: {_server_text(exc)}"
    return f"{type(exc).__name__}: {exc}"[:300]


def _server_text(exc: smtplib.SMTPResponseException | smtplib.SMTPSenderRefused) -> str:
    msg = getattr(exc, "smtp_error", b"")
    if isinstance(msg, bytes):
        msg = msg.decode("utf-8", "replace")
    return " ".join(str(msg).split())[:200]


def to_html(body: str) -> str:
    """Plain text → simple, safe HTML (escaped, paragraphs, clickable links)."""
    escaped = html.escape(body)
    linked = _URL_RE.sub(r'<a href="\1">\1</a>', escaped)
    paragraphs = "".join(f"<p style=\"margin:0 0 12px\">{p.replace(chr(10), '<br>')}</p>" for p in linked.split("\n\n"))
    return (
        "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#14213D;max-width:640px\">"
        f"{paragraphs}<hr style=\"border:none;border-top:1px solid #E4EAF3;margin:20px 0\">"
        "<p style=\"font-size:12px;color:#7A879E;margin:0\">Sent through PlaceMatrix — CDPC, IIT Ropar</p></div>"
    )


def build_message(email: OutgoingEmail) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = email.subject
    msg["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    msg["To"] = formataddr((email.to_name or "", email.to_email))
    msg["Message-ID"] = make_msgid(domain=settings.smtp_from_email.split("@")[-1] or "placematrix.local")
    msg.set_content(email.body)
    msg.add_alternative(to_html(email.body), subtype="html")
    return msg


class Mailer:
    """One SMTP connection reused for a batch:  with Mailer() as m: m.send(email)"""

    def __init__(self) -> None:
        self.smtp: smtplib.SMTP | None = None

    def __enter__(self) -> Mailer:
        if not settings.smtp_configured:
            raise EmailNotConfigured("Email is not configured: set SMTP_HOST (and SMTP_USERNAME / SMTP_PASSWORD / "
                                     "SMTP_FROM_EMAIL) in backend/.env and restart the backend.")
        timeout = settings.smtp_timeout
        if settings.smtp_security == "ssl":
            self.smtp = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=timeout,
                                         context=ssl.create_default_context())
        else:
            self.smtp = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=timeout)
            self.smtp.ehlo()
            if settings.smtp_security == "starttls":
                self.smtp.starttls(context=ssl.create_default_context())
                self.smtp.ehlo()
        if settings.smtp_username:
            self.smtp.login(settings.smtp_username, settings.smtp_password)
        return self

    def send(self, email: OutgoingEmail) -> SendResult:
        if not EMAIL_RE.match(email.to_email or ""):
            return SendResult(False, f"Invalid recipient address: {email.to_email!r}")
        try:
            assert self.smtp is not None
            self.smtp.send_message(build_message(email))
            return SendResult(True)
        except Exception as exc:  # one bad recipient must not stop the batch
            logger.warning("Email to %s failed: %s", email.to_email, exc)
            return SendResult(False, friendly_error(exc))

    def __exit__(self, *exc) -> None:
        if self.smtp is not None:
            try:
                self.smtp.quit()
            except Exception:
                pass


def send_many(emails: list[OutgoingEmail]) -> list[SendResult]:
    """Send a batch over one connection. If the connection or login fails, every email fails with that reason."""
    if not emails:
        return []
    try:
        with Mailer() as mailer:
            return [mailer.send(e) for e in emails]
    except Exception as exc:
        reason = friendly_error(exc)
        logger.warning("SMTP batch failed: %s", reason)
        return [SendResult(False, reason) for _ in emails]


def render_template(template: str, values: dict[str, str]) -> str:
    """Replace {placeholders} with values. Unknown placeholders are left untouched (never raises)."""
    out = template
    for key, value in values.items():
        out = out.replace("{" + key + "}", value)
    return out


def public_status(full: bool) -> dict:
    """SMTP status for the UI. Never includes the password; `full` adds host details for CDPC."""
    data = {"configured": settings.smtp_configured}
    if full:
        data.update(
            host=settings.smtp_host or None,
            port=settings.smtp_port,
            security=settings.smtp_security,
            fromEmail=settings.smtp_from_email,
            fromName=settings.smtp_from_name,
            username=(settings.smtp_username[:3] + "…" + settings.smtp_username[settings.smtp_username.find("@"):])
            if "@" in settings.smtp_username else ("set" if settings.smtp_username else None),
            passwordSet=bool(settings.smtp_password),
        )
    return data
