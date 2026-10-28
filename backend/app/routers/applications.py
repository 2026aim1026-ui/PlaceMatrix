"""1-click apply, withdrawals, stage transitions with the One-Offer Policy Lock, the SPOC bulk shortlist
parser and safe CSV roster exports."""

from __future__ import annotations

import csv
import io
from datetime import timezone

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .. import serializers as S
from ..database import get_db
from ..models import Application, ApplicationEvent, Company, Document, Drive, Student
from ..rules import STAGE_LABELS, TERMINAL_STAGES, can_apply, check_transition, parse_roll_numbers, tokenize, utcnow
from ..security import short_id
from ..services import Actor, bad, close_expired_drives, conflict, forbidden, get_actor, log, not_found, notify, drive_name

router = APIRouter(prefix="/api", tags=["applications & shortlisting"])


def _fmt_ctc(ctc) -> str:
    return f"₹{float(ctc):g} LPA"


# ---------------------------------------------------------------------------
# Student actions
# ---------------------------------------------------------------------------


class ApplyIn(BaseModel):
    driveId: str
    resumeId: str | None = None


@router.post("/applications/apply")
def apply(body: ApplyIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """Atomic 1-click application: eligibility re-checked server-side, verified resume attached."""
    actor.require("STUDENT")
    if actor.student is None:
        raise forbidden("Accept your invitation first.")
    close_expired_drives(db)
    s = db.get(Student, actor.student.roll, with_for_update=True)  # serialises concurrent applies / offers
    drive = db.get(Drive, body.driveId)
    if drive is None or drive.status == "DRAFT" or drive.company.status != "APPROVED":
        raise not_found("Drive")
    existing = db.scalar(select(Application).where(Application.drive_id == drive.drive_id, Application.roll == s.roll))
    ok, reason = can_apply(s, drive, existing)
    if not ok:
        raise bad(reason)
    resume = db.get(Document, body.resumeId or s.default_resume_id or "")
    if resume is None or resume.roll != s.roll or resume.doc_type != "RESUME":
        raise bad("Select a resume to attach")
    if resume.status != "APPROVED":
        raise bad("Only verified resumes can be attached to an application")
    now = utcnow()
    note = f"Applied with {resume.label or resume.file_name}"
    if existing is not None:  # re-applying after a withdrawal reuses the (drive, roll) row
        app = existing
        app.stage, app.resume_doc_id, app.applied_at, app.updated_at = "APPLIED", resume.doc_id, now, now
    else:
        app = Application(application_id=short_id("a"), drive_id=drive.drive_id, roll=s.roll, resume_doc_id=resume.doc_id,
                          stage="APPLIED", applied_at=now, updated_at=now)
        db.add(app)
    app.events.append(ApplicationEvent(stage="APPLIED", at=now, actor="Student", note=note))
    log(db, actor, "Application", "APPLICATION_SUBMITTED", f"{s.roll} applied to {drive_name(db, drive)} with {resume.file_name}.")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise conflict("You have already applied to this drive")
    return S.application_out(app)


@router.post("/applications/{application_id}/withdraw")
def withdraw(application_id: str, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("STUDENT")
    app = db.get(Application, application_id, with_for_update=True)
    if app is None or app.roll != actor.roll:
        raise not_found("Application")
    if app.stage in TERMINAL_STAGES:
        raise bad(f"Application is already {STAGE_LABELS[app.stage]}")
    now = utcnow()
    app.stage, app.updated_at = "WITHDRAWN", now
    app.events.append(ApplicationEvent(stage="WITHDRAWN", at=now, actor="Student", note="Withdrawn by student"))
    log(db, actor, "Application", "APPLICATION_WITHDRAWN", f"{app.roll} withdrew from {drive_name(db, db.get(Drive, app.drive_id))}.")
    db.commit()
    return S.application_out(app)


# ---------------------------------------------------------------------------
# Stage transitions + one-offer policy lock
# ---------------------------------------------------------------------------


def _assert_manages(actor: Actor, drive: Drive) -> None:
    if actor.role == "CCPC":
        return
    if actor.role == "SPOC" and drive.company.assigned_spoc == actor.email:
        return
    raise forbidden("You can only manage applicants of drives assigned to you.")


def move_applications(db: Session, actor: Actor, apps: list[Application], stage: str, *, note: str = "", source: str = "manual") -> dict:
    """Move applications to `stage`. Invalid transitions are skipped and reported.
    OFFERED triggers the One-Offer Policy Lock: the student is marked PLACED and every other active
    application is auto-WITHDRAWN in the same transaction."""
    moved, skipped = [], []
    for app in apps:
        drive = db.get(Drive, app.drive_id)
        _assert_manages(actor, drive)
        student = db.get(Student, app.roll, with_for_update=True)
        ok, reason = check_transition(app.stage, stage)
        if ok and stage == "OFFERED" and student.placement == "PLACED":
            ok, reason = False, f"Already placed at {student.placed_company} (one-offer policy)"
        if not ok:
            skipped.append({"id": app.application_id, "roll": app.roll, "reason": reason})
            continue
        prev, now = app.stage, utcnow()
        app.stage, app.updated_at = stage, now
        app.events.append(ApplicationEvent(stage=stage, at=now, actor=actor.name,
                                           note=note or ("Bulk shortlist parser" if source == "bulk" else "")))
        moved.append(student.roll)
        name = drive_name(db, drive)
        notify(db, student.roll, f"{name}: your application moved to {STAGE_LABELS[stage]}.", "/student/applications")
        if source != "bulk":
            log(db, actor, "Application", "STAGE_CHANGED", f"{student.roll} · {name}: {STAGE_LABELS[prev]} → {STAGE_LABELS[stage]}.")
        if stage == "OFFERED":
            company = db.get(Company, drive.company_id)
            student.placement = "PLACED"
            student.placed_company = company.name if company else None
            student.placed_drive_id = drive.drive_id
            others = db.scalars(select(Application).where(
                Application.roll == student.roll, Application.application_id != app.application_id,
                Application.stage.not_in(TERMINAL_STAGES)).with_for_update()).all()
            for other in others:
                other.stage, other.updated_at = "WITHDRAWN", now
                other.events.append(ApplicationEvent(stage="WITHDRAWN", at=now, actor="System Engine",
                                                     note="Auto-withdrawn: one-offer policy"))
            notify(db, student.roll, f"Congratulations! You were selected by {company.name if company else 'the recruiter'}. "
                                     f"One-offer policy applied: {len(others)} other application(s) withdrawn.", "/student/applications")
            log(db, None, "Profile", "POLICY_LOCK_TRIGGERED",
                f"{student.roll} placed at {company.name if company else '—'} ({_fmt_ctc(drive.ctc)}). "
                f"{len(others)} concurrent application(s) auto-WITHDRAWN.")
    return {"moved": moved, "skipped": skipped}


class StagesIn(BaseModel):
    applicationIds: list[str] = Field(min_length=1, max_length=1000)
    stage: str
    note: str = Field(default="", max_length=500)


@router.post("/applications/stages")
def update_stages(body: StagesIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC", "SPOC")
    if body.stage not in STAGE_LABELS:
        raise bad("Unknown stage")
    apps = list(db.scalars(select(Application).where(Application.application_id.in_(body.applicationIds))
                           .options(selectinload(Application.events)).order_by(Application.roll)))
    if len(apps) != len(set(body.applicationIds)):
        raise not_found("Application")
    result = move_applications(db, actor, apps, body.stage, note=body.note.strip())
    if not result["moved"] and result["skipped"]:
        db.rollback()
        raise bad(result["skipped"][0]["reason"])
    db.commit()
    return result


# ---------------------------------------------------------------------------
# Bulk shortlist parser (paste roll numbers from the recruiter's email)
# ---------------------------------------------------------------------------


class BulkIn(BaseModel):
    driveId: str
    text: str = Field(max_length=100_000)
    targetStage: str


def _parse(db: Session, actor: Actor, body: BulkIn) -> tuple[Drive, dict]:
    actor.require("CCPC", "SPOC")
    if body.targetStage not in STAGE_LABELS or body.targetStage in ("APPLIED", "WITHDRAWN"):
        raise bad("Choose a valid target stage.")
    drive = db.get(Drive, body.driveId)
    if drive is None:
        raise not_found("Drive")
    _assert_manages(actor, drive)
    apps = list(db.scalars(select(Application).where(Application.drive_id == drive.drive_id).options(selectinload(Application.events))))
    apps_by_roll = {a.roll: a for a in apps}
    tokens = {t.upper() for t in tokenize(body.text)}
    students = db.scalars(select(Student).where(Student.roll.in_(tokens))).all() if tokens else []
    parsed = parse_roll_numbers(body.text, {s.roll: s for s in students}, apps_by_roll, body.targetStage)
    return drive, parsed


def _rows_out(parsed: dict, actor: Actor) -> dict:
    rows = []
    for r in parsed["rows"]:
        st, app = r["student"], r["application"]
        visible = st is not None and (app is not None or actor.role == "CCPC")  # SPOCs never see non-applicant records
        rows.append({
            "index": r["index"], "raw": r["raw"], "roll": r["roll"], "status": r["status"],
            "message": r["message"] if visible or r["status"] != "NOT_APPLICANT" else "Not an applicant of this drive",
            "student": {"id": st.roll, "name": st.name, "roll": st.roll} if visible else None,
            "application": {"id": app.application_id, "stage": app.stage} if app else None,
        })
    return {"rows": rows, "stats": parsed["stats"]}


@router.post("/spoc/bulk-shortlist/preview")
def bulk_preview(body: BulkIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    _, parsed = _parse(db, actor, body)
    return _rows_out(parsed, actor)


@router.post("/spoc/bulk-shortlist")
def bulk_shortlist(body: BulkIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """Parse tokens, move every READY applicant and (for OFFERED) trigger the policy lock — atomically."""
    drive, parsed = _parse(db, actor, body)
    ready = [r["application"] for r in parsed["rows"] if r["status"] == "READY"]
    if not ready:
        raise bad("No ready candidates in the pasted text.")
    result = move_applications(db, actor, ready, body.targetStage, source="bulk")
    if result["moved"]:
        log(db, actor, "Application", "BATCH_SHORTLIST_EXECUTED",
            f"{drive_name(db, drive)}: {len(result['moved'])} candidate(s) moved to {body.targetStage} ({', '.join(result['moved'])}).")
    db.commit()
    _, after = _parse(db, actor, body)
    return {**result, "preview": _rows_out(after, actor)}


# ---------------------------------------------------------------------------
# CSV roster export (UTF-8 BOM, every cell quoted, formula-injection safe)
# ---------------------------------------------------------------------------

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def safe_cell(value) -> str:
    text = "" if value is None else str(value)
    return "'" + text if text.startswith(_FORMULA_PREFIXES) else text


@router.get("/drives/{drive_id}/roster.csv")
def export_roster(drive_id: str, q: str = "", branch: str = "", stage: str = "",
                  actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC", "SPOC")
    drive = db.get(Drive, drive_id)
    if drive is None:
        raise not_found("Drive")
    _assert_manages(actor, drive)
    apps = db.scalars(select(Application).where(Application.drive_id == drive_id).order_by(Application.roll)).all()
    term = q.strip().lower()
    rows = []
    for a in apps:
        s = db.get(Student, a.roll)
        if branch and s.branch != branch:
            continue
        if stage and a.stage != stage:
            continue
        if term and term not in f"{s.roll} {s.name}".lower():
            continue
        resume = db.get(Document, a.resume_doc_id) if a.resume_doc_id else None
        rows.append([
            s.roll, s.name, s.degree, s.branch, f"{float(s.cgpa):.2f}" if s.cgpa is not None else "",
            f"{float(s.class10):.2f}" if s.class10 is not None else "", f"{float(s.class12):.2f}" if s.class12 is not None else "",
            s.backlogs, s.user_email, s.phone, resume.file_name if resume else "", STAGE_LABELS[a.stage],
            a.applied_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        ])
    if not rows:
        raise bad("This roster has no rows to export.")
    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
    writer.writerow(["Roll Number", "Name", "Degree", "Branch", "CGPA", "10th %", "12th %", "Backlogs", "Email", "Phone",
                     "Resume file", "Stage", "Applied At"])
    for r in rows:
        writer.writerow([safe_cell(c) for c in r])
    name = drive_name(db, drive)
    log(db, actor, "Application", "ROSTER_EXPORTED", f"{name}: {len(rows)} applicant rows exported as CSV.")
    db.commit()
    slug = "".join(ch if ch.isalnum() else "_" for ch in name).strip("_")
    return Response(
        content="﻿" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{slug}_roster.csv"', "X-Row-Count": str(len(rows))},
    )
