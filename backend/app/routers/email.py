"""Email through SMTP: placement invitations and custom emails to students, a test email, and the log.

Who can send:
  * CDPC — any student, optionally tied to a company / drive.
  * SPOC — only for recruitments currently assigned to them, and only to students who applied to that
    recruitment or (for a drive) are eligible for it. Enforced here on every request.
  * Verifiers and students cannot send.
"""

from __future__ import annotations

from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .. import emailer
from ..config import settings
from ..database import get_db
from ..emailer import OutgoingEmail
from ..models import Application, Company, Drive, EmailLog, Student
from ..rules import STAGE_LABELS, evaluate_eligibility, utcnow
from ..security import short_id
from ..serializers import iso
from ..services import Actor, bad, forbidden, get_actor, log, manages_company, not_found, notify

router = APIRouter(prefix="/api/email", tags=["email"])

IST = timezone(timedelta(hours=5, minutes=30), "IST")
PLACEHOLDERS = ["name", "first_name", "roll", "branch", "company", "role", "ctc", "deadline", "link", "sender"]


# ---------------------------------------------------------------------------------------------
# Shared helper (also used by onboarding invitations and assignment notices)
# ---------------------------------------------------------------------------------------------


def send_and_log(db: Session, actor: Actor | None, kind: str, items: list[tuple[OutgoingEmail, str | None]], *,
                 company_id: str | None = None, drive_id: str | None = None) -> list[dict]:
    """Send emails over one SMTP connection and write one email_logs row per recipient.
    `items` is a list of (email, recipient roll or None). The caller commits."""
    batch = short_id("mail")
    results = emailer.send_many([e for e, _ in items])
    out = []
    for (email, roll), res in zip(items, results):
        db.add(EmailLog(
            batch_id=batch, kind=kind, status="SENT" if res.ok else "FAILED", error=res.error,
            sender_email=actor.email if actor else None, sender_name=actor.name if actor else "PlaceMatrix",
            sender_role=actor.role if actor else "SYSTEM", recipient_email=email.to_email, recipient_name=email.to_name,
            recipient_roll=roll, company_id=company_id, drive_id=drive_id, subject=email.subject[:255], body=email.body,
        ))
        out.append({"roll": roll, "name": email.to_name, "email": email.to_email,
                    "status": "SENT" if res.ok else "FAILED", "error": res.error})
    return out


def _fmt_deadline(dt) -> str:
    return dt.astimezone(IST).strftime("%d %b %Y, %I:%M %p IST") if dt else ""


def _student_values(s: Student, drive: Drive | None, company: Company | None, actor: Actor) -> dict[str, str]:
    link = f"{settings.frontend_url}/student/opportunities/{drive.drive_id}" if drive else f"{settings.frontend_url}/login"
    return {
        "name": s.name, "first_name": s.name.split()[0], "roll": s.roll, "branch": s.branch or "",
        "company": company.name if company else "", "role": drive.role if drive else "",
        "ctc": f"₹{float(drive.ctc):g} LPA" if drive else "", "deadline": _fmt_deadline(drive.close_at) if drive else "",
        "link": link, "sender": actor.name,
    }


def _scope(db: Session, actor: Actor, drive_id: str | None, company_id: str | None) -> tuple[Drive | None, Company | None]:
    """Resolve and authorise the recruitment an email is about."""
    actor.require("CDPC", "SPOC")
    drive = company = None
    if drive_id:
        drive = db.get(Drive, drive_id)
        if drive is None:
            raise not_found("Drive")
        company = drive.company
        if company_id and company_id != company.company_id:
            raise bad("That drive does not belong to the selected company.")
    elif company_id:
        company = db.get(Company, company_id)
        if company is None:
            raise not_found("Company")
    if actor.role == "SPOC":
        if company is None:
            raise forbidden("SPOCs can email students only about a recruitment assigned to them — choose a company or drive.")
        if not manages_company(actor, company):
            raise forbidden("You can only email students about recruitments currently assigned to you.")
    return drive, company


def _allowed_students(db: Session, actor: Actor, drive: Drive | None, company: Company | None) -> dict[str, dict]:
    """Students the actor may email for this scope, with eligibility info for the picker."""
    if drive is not None:
        apps = {a.roll: a for a in db.scalars(select(Application).where(Application.drive_id == drive.drive_id))}
    elif company is not None:
        drive_ids = select(Drive.drive_id).where(Drive.company_id == company.company_id)
        apps = {a.roll: a for a in db.scalars(select(Application).where(Application.drive_id.in_(drive_ids)))}
    else:
        apps = {}
    out: dict[str, dict] = {}
    for s in db.scalars(select(Student).order_by(Student.roll)):
        app = apps.get(s.roll)
        elig = evaluate_eligibility(s, drive) if drive is not None else None
        eligible = bool(elig and elig.eligible)
        if actor.role == "SPOC" and app is None and not eligible:
            continue  # SPOCs only reach their applicants and the students eligible for their drive
        out[s.roll] = {
            "id": s.roll, "roll": s.roll, "name": s.name, "branch": s.branch, "degree": s.degree,
            "cgpa": float(s.cgpa) if s.cgpa is not None else None, "verification": s.verification,
            "placement": s.placement, "eligible": eligible if drive is not None else None,
            "reason": elig.reasons[0].message if elig and not elig.eligible else None,
            "applied": app is not None, "stage": app.stage if app else None,
            "stageLabel": STAGE_LABELS[app.stage] if app else None,
            "_student": s,
        }
    return out


# ---------------------------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------------------------


@router.get("/status")
def email_status(actor: Actor = Depends(get_actor)):
    actor.require("CDPC", "SPOC")
    return {**emailer.public_status(full=actor.role == "CDPC"), "placeholders": PLACEHOLDERS,
            "maxRecipients": settings.email_max_recipients}


class TestIn(BaseModel):
    to: str | None = Field(default=None, max_length=254)


@router.post("/test")
def send_test(body: TestIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """CDPC: send a test email to check the SMTP settings (defaults to your own address)."""
    actor.require("CDPC")
    to = (body.to or actor.email).strip().lower()
    if not emailer.EMAIL_RE.match(to):
        raise bad("Enter a valid email address.")
    email = OutgoingEmail(
        to_email=to, to_name=None, subject="PlaceMatrix SMTP test",
        body=(f"Hello,\n\nThis is a test email from PlaceMatrix, sent by {actor.name}.\n"
              f"SMTP server: {settings.smtp_host}:{settings.smtp_port} ({settings.smtp_security}).\n\n"
              "If you can read this, email delivery is working.\n\n— PlaceMatrix"),
    )
    result = send_and_log(db, actor, "TEST", [(email, None)])[0]
    log(db, actor, "Email", "EMAIL_TEST_SENT" if result["status"] == "SENT" else "EMAIL_TEST_FAILED",
        f"SMTP test email to {to}: {result['status'].lower()}{' — ' + result['error'] if result['error'] else ''}.")
    db.commit()
    return result


@router.get("/recipients")
def recipients(driveId: str | None = None, companyId: str | None = None,
               actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """Students the signed-in user may email for this recruitment (with eligibility and application stage)."""
    drive, company = _scope(db, actor, driveId, companyId)
    rows = _allowed_students(db, actor, drive, company)
    return {"students": [{k: v for k, v in r.items() if k != "_student"} for r in rows.values()]}


class SendIn(BaseModel):
    recipients: list[str] = Field(min_length=1)
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=20_000)
    kind: str = "CUSTOM"
    driveId: str | None = None
    companyId: str | None = None


@router.post("/send")
def send_email(body: SendIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """Send a placement invitation or a custom email to selected students (addresses come from the database).
    {placeholders} such as {name}, {company}, {role}, {deadline} and {link} are filled per student."""
    if body.kind not in ("INVITATION", "CUSTOM"):
        raise bad("kind must be INVITATION or CUSTOM.")
    drive, company = _scope(db, actor, body.driveId, body.companyId)
    if body.kind == "INVITATION":
        if drive is None:
            raise bad("Choose the drive you are inviting students to.")
        if drive.status != "OPEN":
            raise bad(f"Invitations can only be sent for open drives (this drive is {drive.status.lower()}).")
    rolls = list(dict.fromkeys(r.strip().upper() for r in body.recipients if r.strip()))
    if not rolls:
        raise bad("Select at least one student.")
    if len(rolls) > settings.email_max_recipients:
        raise bad(f"At most {settings.email_max_recipients} recipients per email.")
    allowed = _allowed_students(db, actor, drive, company)
    unknown = [r for r in rolls if r not in allowed]
    if unknown:
        if actor.role == "SPOC":
            raise forbidden(f"You are not authorised to email: {', '.join(unknown[:5])}. SPOCs can email only "
                            "applicants of, or students eligible for, their own recruitments.")
        raise bad(f"Unknown student roll number(s): {', '.join(unknown[:5])}")
    subject, text = body.subject.strip(), body.body.strip()

    items = []
    for roll in rolls:
        s = allowed[roll]["_student"]
        values = _student_values(s, drive, company, actor)
        items.append((OutgoingEmail(to_email=s.user_email, to_name=s.name,
                                    subject=emailer.render_template(subject, values),
                                    body=emailer.render_template(text, values)), s.roll))
    results = send_and_log(db, actor, body.kind, items, company_id=company.company_id if company else None,
                           drive_id=drive.drive_id if drive else None)
    sent = sum(1 for r in results if r["status"] == "SENT")
    if body.kind == "INVITATION":  # in-app notice as well, whatever happened to the email
        for roll in rolls:
            notify(db, roll, f"You're invited to apply: {company.name} — {drive.role}.", f"/student/opportunities/{drive.drive_id}")
    what = "Placement invitation" if body.kind == "INVITATION" else "Email"
    about = f" for {company.name}{' — ' + drive.role if drive else ''}" if company else ""
    log(db, actor, "Email", "INVITATION_EMAILED" if body.kind == "INVITATION" else "EMAIL_SENT",
        f"{what}{about} '{subject[:80]}' to {len(rolls)} student(s): {sent} sent, {len(rolls) - sent} failed.")
    db.commit()
    return {"sent": sent, "failed": len(results) - sent, "results": results}


@router.get("/logs")
def email_logs(driveId: str | None = None, companyId: str | None = None, status: str | None = None,
               limit: int = Query(300, ge=1, le=1000), actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """Email history. CDPC sees everything; a SPOC sees what they sent and emails about their recruitments."""
    actor.require("CDPC", "SPOC")
    q = select(EmailLog).order_by(EmailLog.email_id.desc()).limit(limit)
    if actor.role == "SPOC":
        mine = select(Company.company_id).where(Company.assigned_spoc == actor.email)
        q = q.where(or_(EmailLog.sender_email == actor.email, EmailLog.company_id.in_(mine)))
    if driveId:
        q = q.where(EmailLog.drive_id == driveId)
    if companyId:
        q = q.where(EmailLog.company_id == companyId)
    if status:
        q = q.where(EmailLog.status == status.upper())
    rows = db.scalars(q).all()
    return {"logs": [{
        "id": e.email_id, "batchId": e.batch_id, "kind": e.kind, "status": e.status, "error": e.error,
        "senderName": e.sender_name, "senderEmail": e.sender_email, "senderRole": e.sender_role,
        "recipientEmail": e.recipient_email, "recipientName": e.recipient_name, "recipientRoll": e.recipient_roll,
        "companyId": e.company_id, "driveId": e.drive_id, "subject": e.subject, "preview": e.body[:280],
        "at": iso(e.created_at),
    } for e in rows], "generatedAt": utcnow().isoformat()}
