"""Fee-paid onboarding: import the Academic Section list, send invitations (activation links),
accept / decline as the invited student."""

from __future__ import annotations

import logging
import smtplib
from datetime import timedelta
from email.message import EmailMessage

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import serializers as S
from ..config import settings
from ..database import get_db
from ..models import Invitation, Student, User
from ..rules import BRANCH_CODES, ROLL_BRANCH, ROLL_REGEX, utcnow
from ..security import new_invite_token, short_id
from ..services import Actor, bad, forbidden, get_actor, log, not_found, notify

router = APIRouter(prefix="/api/invitations", tags=["invitations"])
logger = logging.getLogger("placematrix.invitations")


class InviteeIn(BaseModel):
    entryNo: str = Field(max_length=16)
    name: str = Field(max_length=120)
    branch: str | None = None
    degree: str | None = None
    email: str | None = None


class ImportIn(BaseModel):
    rows: list[InviteeIn] = Field(min_length=1, max_length=2000)


@router.post("/import")
def import_fee_paid(body: ImportIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC")
    existing = set(db.scalars(select(Invitation.entry_no)))
    added, errors = [], []
    for i, row in enumerate(body.rows, start=1):
        entry = row.entryNo.strip().upper()
        m = ROLL_REGEX.match(entry)
        if not m:
            errors.append(f"Row {i}: {row.entryNo!r} is not a valid entry number")
            continue
        if entry in existing:
            continue
        branch = (row.branch or ROLL_BRANCH[m.group(2)]).upper()
        if branch not in BRANCH_CODES:
            errors.append(f"Row {i}: unknown branch {branch}")
            continue
        email = (row.email or f"{entry.lower()}@{settings.allowed_email_domain}").strip().lower()
        if not settings.email_allowed(email):
            errors.append(f"Row {i}: email must be @{settings.allowed_email_domain}")
            continue
        existing.add(entry)
        added.append(entry)
        db.add(Invitation(invitation_id=short_id("inv"), entry_no=entry, name=row.name.strip(), email=email, branch=branch,
                          degree=row.degree or ("M.Tech" if m.group(3) == "M" else "B.Tech"), fee_paid=True, status="NOT_INVITED"))
    if not added:
        raise bad(errors[0] if errors else "All entries already exist in the onboarding list.")
    log(db, actor, "Invitation", "FEE_LIST_IMPORTED", f"{len(added)} fee-paid student(s) added from the Academic Section list.")
    db.commit()
    return {"added": added, "errors": errors}


def _send_email(inv: Invitation, link: str) -> bool:
    if not settings.smtp_host:
        return False
    msg = EmailMessage()
    msg["Subject"] = "PlaceMatrix — Placement Season invitation from CDPC, IIT Ropar"
    msg["From"] = settings.smtp_from
    msg["To"] = inv.email
    msg.set_content(
        f"Dear {inv.name},\n\nYou have been invited to the IIT Ropar placement season on PlaceMatrix.\n"
        f"Activate your account and set a password here (valid for {settings.invite_ttl_days} days):\n\n{link}\n\n"
        "After activation, accept the invitation, fill your Profile Audit and upload your documents.\n\n— CDPC, IIT Ropar"
    )
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
        return True
    except Exception as exc:  # never block the invitation on email delivery
        logger.warning("Invitation email to %s failed: %s", inv.email, exc)
        return False


def _issue_invite(db: Session, inv: Invitation) -> None:
    inv.status = "INVITED"
    inv.updated_at = utcnow()
    inv.invite_token = new_invite_token()
    inv.token_expires_at = utcnow() + timedelta(days=settings.invite_ttl_days)
    user = db.get(User, inv.email)
    if user is None:
        db.add(User(email=inv.email, name=inv.name, role="STUDENT", title="Student", is_active=True))
    elif user.role == "STUDENT":
        user.is_active = True


class SendIn(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=2000)


@router.post("/send")
def send_invitations(body: SendIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC")
    invs = db.scalars(select(Invitation).where(Invitation.invitation_id.in_(body.ids))).all()
    sent = []
    for inv in invs:
        if inv.status == "REGISTERED":
            continue
        _issue_invite(db, inv)
        sent.append(inv)
    if not sent:
        raise bad("No invitable students selected.")
    db.flush()
    emailed = sum(_send_email(inv, S.invite_link(inv)) for inv in sent)
    entries = [i.entry_no for i in sent]
    log(db, actor, "Invitation", "INVITATION_SENT",
        f"Invitation sent to {entries[0]}." if len(sent) == 1 else f"Bulk onboarding invitation sent to {len(sent)} fee-paid student(s).")
    db.commit()
    return {"sent": entries, "emailed": emailed, "links": [{"id": i.invitation_id, "entryNo": i.entry_no, "link": S.invite_link(i)} for i in sent]}


@router.post("/{invitation_id}/link")
def regenerate_link(invitation_id: str, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC")
    inv = db.get(Invitation, invitation_id)
    if inv is None:
        raise not_found("Invitation")
    if inv.status != "INVITED":
        raise bad("Only invited students have an activation link.")
    _issue_invite(db, inv)
    log(db, actor, "Invitation", "INVITATION_LINK_REISSUED", f"Activation link re-issued for {inv.entry_no}.")
    db.commit()
    return {"link": S.invite_link(inv)}


def _own_invitation(actor: Actor, invitation_id: str) -> Invitation:
    actor.require("STUDENT")
    inv = actor.invitation
    if inv is None or inv.invitation_id != invitation_id:
        raise forbidden("This invitation does not belong to you.")
    return inv


@router.post("/{invitation_id}/accept")
def accept_invitation(invitation_id: str, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    inv = _own_invitation(actor, invitation_id)
    db.refresh(inv, with_for_update=True)
    if inv.status != "INVITED":
        raise bad("This invitation is no longer active.")
    m = ROLL_REGEX.match(inv.entry_no)
    student = Student(
        roll=inv.entry_no, user_email=inv.email, name=inv.name, phone="",
        degree="M.Tech" if m and m.group(3) == "M" else "B.Tech", branch=inv.branch, grad_year=settings.default_grad_year,
        backlogs=0, sem_cgpa=[], skills=[], verification="NOT_SUBMITTED", locked=False, placement="UNPLACED", proof={},
    )
    db.add(student)
    db.flush()  # the student row must exist before invitations.roll can reference it
    inv.status = "REGISTERED"
    inv.updated_at = utcnow()
    inv.roll = inv.entry_no
    inv.invite_token = None
    db.flush()
    notify(db, student.roll, "Welcome to PlaceMatrix! Fill your Profile Audit and upload your documents.", "/student/profile")
    log(db, actor, "Invitation", "INVITATION_ACCEPTED", f"{inv.entry_no} ({inv.name}) accepted the invitation and created a profile.")
    db.commit()
    return S.student_out(student)


@router.post("/{invitation_id}/decline")
def decline_invitation(invitation_id: str, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    inv = _own_invitation(actor, invitation_id)
    if inv.status != "INVITED":
        raise bad("This invitation is no longer active.")
    inv.status = "DECLINED"
    inv.updated_at = utcnow()
    inv.invite_token = None
    log(db, actor, "Invitation", "INVITATION_DECLINED", f"{inv.entry_no} ({inv.name}) declined the placement invitation.")
    db.commit()
    return S.invitation_out(inv)
