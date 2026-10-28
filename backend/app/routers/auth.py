"""Authentication: institute-domain sign-in, invitation activation, Google Sign-In, demo logins and
SPOC dual-context switching."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Invitation, Student, User
from ..rules import utcnow
from ..security import create_token, hash_password, verify_password
from ..services import Actor, bad, forbidden, get_actor, log, not_found, resolve_actor

router = APIRouter(prefix="/api/auth", tags=["auth"])

# One-click demo accounts shown on the login page when DEMO_MODE is on.
DEMO_ACCOUNTS = [
    {"key": "student", "label": "Student", "email": "2026aim1028@iitrpr.ac.in", "name": "Rohan Verma", "hint": "M.Tech AI · Verified & locked"},
    {"key": "verifier", "label": "Verifier", "email": "verifier@iitrpr.ac.in", "name": "Dr. Subrat Kar", "hint": "Faculty verification desk"},
    {"key": "spoc", "label": "SPOC", "email": "spoc@iitrpr.ac.in", "name": "Ananya Sharma", "hint": "Acme, Orbit, Vertex, Atlas"},
    {"key": "ccpc", "label": "CCPC Admin", "email": "ccpc@iitrpr.ac.in", "name": "CCPC Office", "hint": "Full governance access"},
]


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)


class DemoLoginIn(BaseModel):
    email: str = Field(max_length=254)


class GoogleIn(BaseModel):
    credential: str


class ActivateIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=200)


class ChangePasswordIn(BaseModel):
    currentPassword: str = ""
    newPassword: str = Field(min_length=8, max_length=200)


def session_out(actor: Actor, token: str | None = None) -> dict:
    u = actor.user
    out = {
        "role": u.role,
        "userId": (actor.student.roll if actor.student else None) if u.role == "STUDENT" else u.email,
        "inviteId": actor.invitation.invitation_id if actor.invitation else None,
        "email": u.email,
        "name": u.name,
        "title": u.title,
        "canVerify": u.can_verify or u.role == "CCPC",
        "linkedStudentId": u.linked_student_roll,
        "backTo": actor.back_to,
    }
    if token:
        out["token"] = token
    return out


def _issue(db: Session, user: User, back_to: str | None = None) -> dict:
    user.last_login_at = utcnow()
    db.commit()
    actor = resolve_actor(db, user, back_to)
    return session_out(actor, create_token(user.email, user.role, back_to=back_to))


def _find_user_for_login(db: Session, email: str) -> User:
    e = email.strip().lower()
    if not settings.email_allowed(e):
        raise forbidden(f"Only @{settings.allowed_email_domain} college accounts can sign in.")
    user = db.get(User, e)
    invite = db.scalar(select(Invitation).where(Invitation.email == e))
    if user is None:
        if invite and invite.status == "NOT_INVITED":
            raise forbidden("You have not been invited yet. Placement invitations are sent by CCPC.")
        if invite and invite.status == "DECLINED":
            raise forbidden("This invitation was declined. Ask CCPC to re-invite you.")
        raise HTTPException(404, "No account found for this college email.")
    if not user.is_active:
        raise forbidden("This account has been deactivated. Contact the CCPC office.")
    if user.role == "STUDENT":
        has_profile = db.scalar(select(Student.roll).where(Student.user_email == e)) is not None
        if not has_profile and invite and invite.status == "DECLINED":
            raise forbidden("This invitation was declined. Ask CCPC to re-invite you.")
        if not has_profile and invite and invite.status == "NOT_INVITED":
            raise forbidden("You have not been invited yet. Placement invitations are sent by CCPC.")
    return user


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = _find_user_for_login(db, body.email)
    if not user.password_hash:
        raise forbidden("Account not activated yet. Open the activation link from your CCPC invitation"
                        + (" or use Google sign-in." if settings.google_client_id else "."))
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect password." + (f' Demo accounts use "{settings.demo_password}".' if settings.demo_mode else ""))
    return _issue(db, user)


@router.post("/demo-login")
def demo_login(body: DemoLoginIn, db: Session = Depends(get_db)):
    """Password-less login used by the demo account switcher. Disabled when DEMO_MODE=false."""
    if not settings.demo_mode:
        raise not_found("Endpoint")
    return _issue(db, _find_user_for_login(db, body.email))


@router.post("/google")
def google_login(body: GoogleIn, db: Session = Depends(get_db)):
    """Verify a Google Identity Services ID token and sign in the matching @iitrpr.ac.in account."""
    if not settings.google_client_id:
        raise bad("Google sign-in is not configured on this server (set GOOGLE_CLIENT_ID).")
    import jwt
    from jwt import PyJWKClient

    try:
        signing_key = PyJWKClient("https://www.googleapis.com/oauth2/v3/certs").get_signing_key_from_jwt(body.credential)
        claims = jwt.decode(
            body.credential,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=["https://accounts.google.com", "accounts.google.com"],
        )
    except Exception as exc:  # invalid / expired / network
        raise HTTPException(401, f"Google token could not be verified: {exc}")
    if not claims.get("email_verified"):
        raise forbidden("Your Google email address is not verified.")
    return _issue(db, _find_user_for_login(db, claims.get("email", "")))


@router.get("/invite-info")
def invite_info(token: str, db: Session = Depends(get_db)):
    inv = db.scalar(select(Invitation).where(Invitation.invite_token == token))
    if inv is None or inv.status != "INVITED":
        raise not_found("Invitation")
    expired = inv.token_expires_at is not None and inv.token_expires_at < utcnow()
    return {"name": inv.name, "entryNo": inv.entry_no, "email": inv.email, "branch": inv.branch, "expired": expired}


@router.post("/activate")
def activate(body: ActivateIn, db: Session = Depends(get_db)):
    """Invited student sets a password using the one-time link from their invitation."""
    inv = db.scalar(select(Invitation).where(Invitation.invite_token == body.token).with_for_update())
    if inv is None or inv.status != "INVITED":
        raise bad("This activation link is invalid or has already been used.")
    if inv.token_expires_at is not None and inv.token_expires_at < utcnow():
        raise bad("This activation link has expired. Ask CCPC to resend the invitation.")
    user = db.get(User, inv.email)
    if user is None:
        user = User(email=inv.email, name=inv.name, role="STUDENT", title="Student")
        db.add(user)
    user.password_hash = hash_password(body.password)
    user.is_active = True
    inv.invite_token = None  # one-time use
    db.flush()
    log(db, resolve_actor(db, user), "Invitation", "ACCOUNT_ACTIVATED", f"{inv.entry_no} ({inv.name}) activated their account.")
    return _issue(db, user)


@router.get("/me")
def me(actor: Actor = Depends(get_actor)):
    return session_out(actor)


@router.post("/switch-to-student")
def switch_to_student(actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """A student SPOC switches to their own candidate feed (dual-context access)."""
    if actor.role != "SPOC" or not actor.user.linked_student_roll:
        raise forbidden("Only a SPOC linked to a student profile can switch to a candidate feed.")
    student = db.get(Student, actor.user.linked_student_roll)
    if student is None:
        raise not_found("Linked student profile")
    target = db.get(User, student.user_email)
    if target is None or not target.is_active:
        raise forbidden("The linked student account is inactive.")
    return _issue(db, target, back_to=actor.email)


@router.post("/switch-back")
def switch_back(actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    if not actor.back_to:
        raise bad("There is no SPOC workspace to return to.")
    spoc = db.get(User, actor.back_to)
    if spoc is None or not spoc.is_active or spoc.linked_student_roll != actor.roll:
        raise forbidden("Cannot return to the SPOC workspace.")
    return _issue(db, spoc)


@router.post("/change-password")
def change_password(body: ChangePasswordIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    user = actor.user
    if user.password_hash and not verify_password(body.currentPassword, user.password_hash):
        raise bad("Current password is incorrect.")
    user.password_hash = hash_password(body.newPassword)
    log(db, actor, "User", "PASSWORD_CHANGED", f"{user.email} changed their password.")
    db.commit()
    return {"ok": True}


config_router = APIRouter(tags=["config"])


@config_router.get("/api/config")
def public_config():
    return {
        "demoMode": settings.demo_mode,
        "demoPassword": settings.demo_password if settings.demo_mode else None,
        "demoAccounts": DEMO_ACCOUNTS if settings.demo_mode else [],
        "allowedDomain": settings.allowed_email_domain,
        "googleClientId": settings.google_client_id or None,
        "maxUploadMb": settings.max_upload_bytes // (1024 * 1024),
    }


@config_router.get("/api/health")
def health(db: Session = Depends(get_db)):
    from sqlalchemy import text

    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
