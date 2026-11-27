"""Recruitment administration: SPOC / verifier (re)assignment for running recruitments, assignment history,
and authorised access to the resume submitted with each application."""

from __future__ import annotations

import io
import re
import zipfile
from types import SimpleNamespace

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import serializers as S
from ..config import settings
from ..database import SessionLocal, get_db
from ..emailer import OutgoingEmail
from ..migrations import snapshot_resume_file
from ..models import Application, AssignmentHistory, Company, Document, Drive, Student, User
from ..rules import STAGE_LABELS
from ..services import Actor, bad, forbidden, get_actor, log, manages_company, not_found, reviews_company
from .email import send_and_log

router = APIRouter(prefix="/api", tags=["recruitments"])

ROLE_LABEL = {"SPOC": "SPOC", "VERIFIER": "Verifier"}


# ---------------------------------------------------------------------------------------------
# Assignments
# ---------------------------------------------------------------------------------------------


def _staff(db: Session, email: str | None, role: str) -> User | None:
    if not email:
        return None
    u = db.get(User, email.strip().lower())
    if u is None or u.role != role:
        raise bad(f"Choose an existing {ROLE_LABEL[role]} account.")
    if not u.is_active:
        raise bad(f"{u.name} is deactivated and cannot be assigned.")
    return u


def apply_assignment(db: Session, actor: Actor, company: Company, role: str, new_email: str | None, reason: str = "") -> User | None:
    """Change the SPOC or verifier of a recruitment and record it in assignment_history.
    Access is derived from these columns on every request, so the previous person loses — and the new person
    gains — assignment-based access immediately. Drives, applications and their history are untouched."""
    column = "assigned_spoc" if role == "SPOC" else "assigned_verifier"
    new_user = _staff(db, new_email, role)
    previous = getattr(company, column)
    if (new_user.email if new_user else None) == previous:
        return None
    prev_user = db.get(User, previous) if previous else None
    setattr(company, column, new_user.email if new_user else None)
    db.add(AssignmentHistory(
        company_id=company.company_id, assignment_role=role,
        previous_email=previous, previous_name=prev_user.name if prev_user else None,
        new_email=new_user.email if new_user else None, new_name=new_user.name if new_user else None,
        reason=reason.strip(), changed_by=actor.name, changed_by_email=actor.email,
    ))
    running = db.scalars(select(Drive.drive_id).where(Drive.company_id == company.company_id, Drive.status.in_(("OPEN", "FROZEN")))).all()
    action = ("SPOC" if role == "SPOC" else "VERIFIER") + ("_REASSIGNED" if previous else "_ASSIGNED") if new_user else f"{role}_UNASSIGNED"
    log(db, actor, "Company", action,
        f"{company.name}: {ROLE_LABEL[role]} {prev_user.name if prev_user else '—'} → {new_user.name if new_user else '—'}"
        f"{f' ({len(running)} running drive(s))' if running else ''}{f'. Reason: {reason.strip()}' if reason.strip() else ''}.")
    return new_user


def _notify_assignee(sender: dict, company_name: str, company_id: str, role: str, email: str, name: str) -> None:
    """Background task: email the newly assigned person (only when SMTP is configured)."""
    if not settings.smtp_configured:
        return
    duty = ("manage its drives, applicant roster and shortlists" if role == "SPOC"
            else "review the resumes submitted by its applicants")
    msg = OutgoingEmail(
        to_email=email, to_name=name, subject=f"PlaceMatrix — you are now the {ROLE_LABEL[role]} for {company_name}",
        body=(f"Dear {name},\n\n{sender['name']} has assigned you as the {ROLE_LABEL[role]} for {company_name} on PlaceMatrix. "
              f"You can now {duty}.\n\nOpen PlaceMatrix: {settings.frontend_url}/login\n\n— CDPC, IIT Ropar"),
    )
    with SessionLocal() as db:
        send_and_log(db, SimpleNamespace(**sender), "ASSIGNMENT", [(msg, None)], company_id=company_id)
        db.commit()


class AssignmentIn(BaseModel):
    spocId: str | None = None
    verifierId: str | None = None
    reason: str = Field(default="", max_length=500)


@router.put("/recruitments/{company_id}/assignment")
def update_assignment(company_id: str, body: AssignmentIn, background: BackgroundTasks,
                      actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """CCPC only: set, change or clear the SPOC and/or verifier of a recruitment — also while it is running.
    Only the fields present in the request are changed; send null to unassign."""
    actor.require("CCPC")
    company = db.get(Company, company_id, with_for_update=True)
    if company is None:
        raise not_found("Company")
    fields = body.model_fields_set - {"reason"}
    if not fields:
        raise bad("Nothing to change: send spocId and/or verifierId.")
    changed = []
    if "spocId" in fields:
        u = apply_assignment(db, actor, company, "SPOC", body.spocId, body.reason)
        changed.append(("SPOC", u))
    if "verifierId" in fields:
        u = apply_assignment(db, actor, company, "VERIFIER", body.verifierId, body.reason)
        changed.append(("VERIFIER", u))
    db.commit()
    sender = {"email": actor.email, "name": actor.name, "role": actor.role}
    for role, user in changed:
        if user is not None:
            background.add_task(_notify_assignee, sender, company.name, company.company_id, role, user.email, user.name)
    return S.company_out(company)


@router.get("/recruitments/{company_id}/history")
def assignment_history(company_id: str, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if company is None:
        raise not_found("Company")
    if not (manages_company(actor, company) or reviews_company(actor, company)):
        raise forbidden("You cannot view this recruitment's assignment history.")
    rows = db.scalars(select(AssignmentHistory).where(AssignmentHistory.company_id == company_id)
                      .order_by(AssignmentHistory.history_id.desc())).all()
    return {"history": [S.assignment_out(h) for h in rows]}


# ---------------------------------------------------------------------------------------------
# Submitted resumes (the frozen copy stored with each application)
# ---------------------------------------------------------------------------------------------


def can_view_submission(actor: Actor, app: Application, company: Company) -> bool:
    if actor.role == "STUDENT":
        return actor.roll == app.roll
    return manages_company(actor, company) or reviews_company(actor, company)


def _snapshot_path(db: Session, app: Application):
    """Path of the frozen copy submitted with this application.

    Applications created before version 1.1 got their copy during migration 0002. If the resume file was not on
    disk at that moment (e.g. the uploads folder was restored later), the copy is made now from the resume the
    application references and stored on the application, so it is frozen from here on."""
    rel = app.resume_snapshot_path
    if not rel and app.resume_doc_id:
        doc = db.get(Document, app.resume_doc_id)
        if doc is not None:
            rel, digest, size = snapshot_resume_file(doc.file_path, app.application_id, doc.file_name)
            if rel:
                app.resume_snapshot_path, app.resume_sha256, app.resume_size = rel, digest, size
                app.resume_label = app.resume_label or doc.label
                app.resume_file_name = app.resume_file_name or doc.file_name
                app.resume_file_type = app.resume_file_type or doc.file_type
                app.resume_version = app.resume_version or doc.version or 1
                app.resume_submitted_at = app.resume_submitted_at or app.applied_at
                db.commit()
    if not rel:
        return None
    path = (settings.upload_dir / rel).resolve()
    if settings.upload_dir not in path.parents or not path.exists():
        return None
    return path


@router.get("/applications/{application_id}/resume")
def submitted_resume(application_id: str, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """The exact resume submitted with this application. Allowed: the student who applied, CCPC, and the SPOC
    and verifier currently assigned to the recruitment."""
    app = db.get(Application, application_id)
    if app is None:
        raise not_found("Application")
    drive = db.get(Drive, app.drive_id)
    if not can_view_submission(actor, app, drive.company):
        raise forbidden("You are not authorised to view resumes submitted to this recruitment.")
    path = _snapshot_path(db, app)
    if path is None:
        raise not_found("Submitted resume")
    return FileResponse(path, media_type=app.resume_file_type or "application/pdf",
                        filename=f"{app.roll}_{app.resume_file_name or path.name}", content_disposition_type="inline",
                        headers={"X-Content-Type-Options": "nosniff"})


def _slug(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", text).strip("_")[:60]


@router.get("/drives/{drive_id}/resumes.zip")
def drive_resumes_zip(drive_id: str, stage: str = "", actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """All submitted resumes of a drive as one ZIP (e.g. to forward to the recruiter). Optional stage filter."""
    drive = db.get(Drive, drive_id)
    if drive is None:
        raise not_found("Drive")
    if not (manages_company(actor, drive.company) or reviews_company(actor, drive.company)):
        raise forbidden("You are not authorised to download resumes for this recruitment.")
    if stage and stage not in STAGE_LABELS:
        raise bad("Unknown stage")
    q = select(Application).where(Application.drive_id == drive_id, Application.stage != "WITHDRAWN").order_by(Application.roll)
    if stage:
        q = q.where(Application.stage == stage)
    buf, count = io.BytesIO(), 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for app in db.scalars(q):
            path = _snapshot_path(db, app)
            if path is None:
                continue
            student = db.get(Student, app.roll)
            zf.write(path, f"{app.roll}_{_slug(student.name)}_{_slug(app.resume_label or 'resume')}{path.suffix}")
            count += 1
    if count == 0:
        raise bad("No submitted resumes to download for this selection.")
    name = f"{_slug(drive.company.name)}_{_slug(drive.role)}_resumes.zip"
    log(db, actor, "Application", "RESUMES_DOWNLOADED",
        f"{drive.company.name} — {drive.role}: {count} submitted resume(s) downloaded as ZIP{f' (stage {stage})' if stage else ''}.")
    db.commit()
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{name}"', "X-File-Count": str(count)})
