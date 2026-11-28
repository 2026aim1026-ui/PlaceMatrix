"""Cross-cutting helpers: request actor, errors, audit log, notifications, live-sync version and
the deadline engine that auto-closes drives."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .database import get_db
from .models import AuditLog, Company, Drive, Invitation, Notification, Student, User
from .rules import utcnow
from .security import decode_token

# ---------------------------------------------------------------------------
# Errors (FastAPI returns {"detail": "..."} which the frontend shows in a toast)
# ---------------------------------------------------------------------------


def bad(msg: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, msg)


def forbidden(msg: str = "You do not have permission to do this.") -> HTTPException:
    return HTTPException(status.HTTP_403_FORBIDDEN, msg)


def not_found(label: str) -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, f"{label} not found")


def conflict(msg: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, msg)


# ---------------------------------------------------------------------------
# Actor (the signed-in user resolved from the JWT)
# ---------------------------------------------------------------------------


@dataclass
class Actor:
    user: User
    student: Student | None = None
    invitation: Invitation | None = None
    back_to: str | None = None

    @property
    def email(self) -> str:
        return self.user.email

    @property
    def name(self) -> str:
        return self.user.name

    @property
    def role(self) -> str:
        return self.user.role

    @property
    def roll(self) -> str | None:
        return self.student.roll if self.student else None

    def require(self, *roles: str) -> None:
        if self.role not in roles:
            raise forbidden(f"This action is not available to the {self.role.title()} role.")

    def require_verifier(self) -> None:
        """CDPC always; VERIFIER only when CDPC granted verification rights (can_verify)."""
        if self.role == "CDPC":
            return
        if self.role == "VERIFIER" and self.user.can_verify:
            return
        if self.role == "VERIFIER":
            raise forbidden("Your verifier account does not have verification rights. Ask CDPC to enable them.")
        raise forbidden("Only authorised verifiers or CDPC can do this.")


def manages_company(actor: Actor, company: Company | None) -> bool:
    """CDPC, or the SPOC currently assigned to this recruitment. Checked live on every request, so a
    reassignment takes effect immediately for both the old and the new SPOC."""
    if company is None:
        return False
    return actor.role == "CDPC" or (actor.role == "SPOC" and company.assigned_spoc == actor.email)


def reviews_company(actor: Actor, company: Company | None) -> bool:
    """CDPC, or the verifier currently assigned to this recruitment."""
    if company is None:
        return False
    return actor.role == "CDPC" or (actor.role == "VERIFIER" and company.assigned_verifier == actor.email)


def resolve_actor(db: Session, user: User, back_to: str | None = None) -> Actor:
    actor = Actor(user=user, back_to=back_to)
    if user.role == "STUDENT":
        actor.student = db.scalar(select(Student).where(Student.user_email == user.email))
        if actor.student is None:
            actor.invitation = db.scalar(select(Invitation).where(Invitation.email == user.email))
    return actor


def _token_from_header(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    return token.strip() if scheme.lower() == "bearer" and token.strip() else None


def get_actor(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> Actor:
    token = _token_from_header(authorization)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    try:
        claims = decode_token(token)
    except Exception:  # expired / tampered
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired — please sign in again")
    user = db.get(User, claims.get("sub"))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is disabled or no longer exists")
    return resolve_actor(db, user, claims.get("back"))


def get_optional_actor(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> Actor | None:
    try:
        return get_actor(authorization, db)
    except HTTPException:
        return None


# ---------------------------------------------------------------------------
# Audit log & notifications
# ---------------------------------------------------------------------------


def log(db: Session, actor: Actor | None, entity: str, action: str, description: str) -> None:
    """Append one audit event (the table is append-only; rows are never updated)."""
    db.add(AuditLog(
        actor=actor.name if actor else "System Engine",
        actor_email=actor.email if actor else None,
        actor_role=actor.role if actor else "SYSTEM",
        entity=entity,
        action_type=action,
        description=description,
    ))


def notify(db: Session, roll: str, message: str, link: str | None = None) -> None:
    db.add(Notification(roll=roll, message=message, link=link))


def notify_all_students(db: Session, message: str, link: str | None = None) -> None:
    rolls = db.scalars(select(Student.roll)).all()
    db.add_all([Notification(roll=r, message=message, link=link) for r in rolls])


def drive_name(db: Session, drive: Drive) -> str:
    company = db.get(Company, drive.company_id)
    return f"{company.name if company else 'Company'} — {drive.role}"


# ---------------------------------------------------------------------------
# Deadline engine & live sync
# ---------------------------------------------------------------------------


def close_expired_drives(db: Session) -> int:
    """Close OPEN drives whose deadline has passed (one stored deadline, same for everyone)."""
    now = utcnow()
    expired = db.scalars(
        select(Drive).where(Drive.status == "OPEN", Drive.close_at <= now).with_for_update(skip_locked=True)
    ).all()
    for d in expired:
        d.status = "CLOSED"
        log(db, None, "Drive", "DRIVE_CLOSED", f"{drive_name(db, d)} closed automatically at its deadline.")
    if expired:
        db.commit()
    return len(expired)


def sync_version(db: Session) -> str:
    """Version of the shared state. Changes after every committed change to any PlaceMatrix table,
    including edits made directly in the database (see realtime.py)."""
    from .realtime import current_version

    return current_version(db)


def mark_notifications_read(db: Session, roll: str) -> None:
    db.execute(update(Notification).where(Notification.roll == roll, Notification.is_read.is_(False)).values(is_read=True))
