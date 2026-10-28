"""Student Profile & Academic Audit, Document Vault & Resume Repository, Unfreeze/Correction tickets."""

from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import serializers as S
from ..config import settings
from ..database import get_db
from ..models import Application, Document, Student, Ticket
from ..rules import (
    ACADEMIC_FIELDS,
    BRANCH_CODES,
    CONTACT_FIELDS,
    DEGREES,
    DOC_TYPE_META,
    TERMINAL_STAGES,
    claimed_value,
    missing_for_submission,
    to_decimal,
    utcnow,
)
from ..security import short_id
from ..services import Actor, bad, conflict, forbidden, get_actor, log, not_found, notify

router = APIRouter(prefix="/api", tags=["profile & documents"])

ALLOWED_TYPES = {"application/pdf": b"%PDF", "image/png": b"\x89PNG", "image/jpeg": b"\xff\xd8\xff"}

FIELD_LABELS = {
    "cgpa": "Overall CGPA",
    "semCgpa": "Semester SGPA",
    "class10": "Class 10 %",
    "class12": "Class 12 %",
    "backlogs": "Active backlogs",
    "branch": "Branch",
    "degree": "Degree",
}


def _own_student(actor: Actor, roll: str) -> Student:
    actor.require("STUDENT")
    if actor.student is None or actor.student.roll != roll:
        raise forbidden("You can only change your own profile.")
    return actor.student


def _student_docs(db: Session, roll: str) -> list[Document]:
    return list(db.scalars(select(Document).where(Document.roll == roll)))


def _sync_claimed_values(db: Session, s: Student) -> None:
    for d in _student_docs(db, s.roll):
        value = claimed_value(d.doc_type, s)
        if value is not None:
            d.claimed_value = value


# ---------------------------------------------------------------------------
# Profile audit
# ---------------------------------------------------------------------------


class ProfilePatch(BaseModel):
    patch: dict[str, Any]


def _validate_patch(patch: dict[str, Any]) -> dict[str, Any]:
    clean: dict[str, Any] = {}
    for key, value in patch.items():
        if key not in ACADEMIC_FIELDS | CONTACT_FIELDS:
            continue  # name, email and roll come from the Academic Section and cannot be edited
        if key == "cgpa":
            v = float(value)
            if not 0 <= v <= 10:
                raise bad("CGPA must be between 0 and 10.")
            clean[key] = to_decimal(round(v, 2))
        elif key in ("class10", "class12"):
            v = float(value)
            if not 33 <= v <= 100:
                raise bad(f"{FIELD_LABELS[key]} must be between 33 and 100.")
            clean[key] = to_decimal(round(v, 2))
        elif key == "backlogs":
            v = int(value)
            if not 0 <= v <= 20:
                raise bad("Backlogs must be between 0 and 20.")
            clean[key] = v
        elif key == "semCgpa":
            values = [float(x) for x in (value or [])]
            if any(not 0 <= x <= 10 for x in values) or len(values) > 12:
                raise bad("Semester SGPA values must be between 0 and 10.")
            clean[key] = [to_decimal(round(x, 2)) for x in values]
        elif key == "degree":
            if value not in DEGREES:
                raise bad("Unknown degree.")
            clean[key] = value
        elif key == "branch":
            if value not in BRANCH_CODES:
                raise bad("Unknown branch.")
            clean[key] = value
        elif key == "gradYear":
            v = int(value)
            if not 2020 <= v <= 2035:
                raise bad("Graduation year looks wrong.")
            clean[key] = v
        elif key == "phone":
            v = str(value or "").strip()
            if v and not (10 <= len(v) <= 20):
                raise bad("Enter a valid phone number.")
            clean[key] = v
        elif key == "skills":
            clean[key] = [str(x).strip()[:60] for x in (value or []) if str(x).strip()][:30]
    return clean


COLUMN = {"cgpa": "cgpa", "class10": "class10", "class12": "class12", "backlogs": "backlogs", "semCgpa": "sem_cgpa",
          "degree": "degree", "branch": "branch", "gradYear": "grad_year", "phone": "phone", "skills": "skills"}


@router.patch("/students/{roll}/profile")
def update_profile(roll: str, body: ProfilePatch, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    s = _own_student(actor, roll)
    try:
        patch = _validate_patch(body.patch)
    except (TypeError, ValueError):
        raise bad("One of the values is not a valid number.")
    if not patch:
        raise bad("Nothing to update.")
    touches_academic = any(k in ACADEMIC_FIELDS for k in patch)
    if touches_academic and s.placement == "PLACED":
        raise bad("Your profile is policy-locked after placement.")
    if touches_academic and s.locked:
        raise bad("Academic record is locked. Raise a correction request instead.")
    if touches_academic and s.verification == "PENDING":
        raise bad("Profile is under verification and cannot be edited right now.")
    for key, value in patch.items():
        setattr(s, COLUMN[key], value)
    if touches_academic:
        _sync_claimed_values(db, s)
    log(db, actor, "Profile", "ACADEMIC_RECORD_UPDATED" if touches_academic else "CONTACT_UPDATED",
        f"{s.roll} updated {', '.join(patch.keys())}.")
    db.commit()
    return S.student_out(s)


@router.post("/students/{roll}/submit")
def submit_for_verification(roll: str, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    s = _own_student(actor, roll)
    db.refresh(s, with_for_update=True)
    if s.locked:
        raise bad("Profile is already verified and locked")
    if s.verification == "PENDING":
        raise bad("Profile is already awaiting verification")
    docs = _student_docs(db, s.roll)
    missing = missing_for_submission(s, docs)
    if missing:
        raise bad(f"Complete these first: {', '.join(missing)}")
    s.verification = "PENDING"
    s.submitted_at = utcnow()
    for d in docs:
        if d.status == "REVISION":
            d.status = "PENDING"
    log(db, actor, "Profile", "PROFILE_SUBMITTED", f"{s.roll} ({s.name}) submitted profile for verification.")
    db.commit()
    return S.student_out(s)


# ---------------------------------------------------------------------------
# Document vault & resume repository
# ---------------------------------------------------------------------------


@router.post("/documents")
async def upload_document(
    type: str = Form(...),
    label: str | None = Form(default=None),
    file: UploadFile = File(...),
    actor: Actor = Depends(get_actor),
    db: Session = Depends(get_db),
):
    actor.require("STUDENT")
    s = actor.student
    if s is None:
        raise forbidden("Accept your invitation first.")
    meta = DOC_TYPE_META.get(type)
    if meta is None:
        raise bad("Unknown document type")
    if meta["academic"] and s.locked:
        raise bad("Academic documents are locked with your verified profile.")
    if meta["academic"] and s.verification == "PENDING":
        raise bad("Academic documents cannot be changed while your profile is under verification.")
    if type in ("RESUME", "CERTIFICATE", "OTHER") and not (label or "").strip():
        raise bad('Give this document a name, e.g. "Data Resume".')

    content_type = (file.content_type or "").lower()
    if content_type == "image/jpg":
        content_type = "image/jpeg"
    data = await file.read(settings.max_upload_bytes + 1)
    if not data:
        raise bad("File is empty")
    if len(data) > settings.max_upload_bytes:
        raise bad(f"File is too large. Maximum is {settings.max_upload_bytes // (1024 * 1024)} MB.")
    magic = ALLOWED_TYPES.get(content_type)
    if magic is None or not data.startswith(magic):
        raise bad("Unsupported or corrupted file. Allowed: PDF, PNG, JPG.")

    doc_id = short_id("doc")
    ext = {"application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg"}[content_type]
    folder = settings.upload_dir / s.roll
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{doc_id}{ext}"

    if meta["academic"]:  # a re-upload replaces the previous proof of the same type
        for old in db.scalars(select(Document).where(Document.roll == s.roll, Document.doc_type == type)):
            _delete_file(old)
            db.delete(old)
        db.flush()

    has_resume = db.scalar(select(Document.doc_id).where(Document.roll == s.roll, Document.doc_type == "RESUME").limit(1))
    doc = Document(
        doc_id=doc_id, roll=s.roll, doc_type=type, label=(label or "").strip() or None,
        file_name=Path(file.filename or f"{doc_id}{ext}").name[:255], file_type=content_type, size_bytes=len(data),
        file_path=str(path.relative_to(settings.upload_dir)), status="PENDING", remarks="",
        claimed_value=claimed_value(type, s), is_default=False,
    )
    if type == "RESUME" and not has_resume:
        doc.is_default = True
    db.add(doc)
    db.flush()
    if doc.is_default:
        s.default_resume_id = doc.doc_id
    path.write_bytes(data)
    log(db, actor, "Document", "DOCUMENT_UPLOADED",
        f"{s.roll} uploaded {meta['label']}{f' ({doc.label})' if doc.label else ''}: {doc.file_name}.")
    try:
        db.commit()
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return S.document_out(doc)


def _delete_file(doc: Document) -> None:
    if doc.file_path:
        p = (settings.upload_dir / doc.file_path).resolve()
        if settings.upload_dir in p.parents:
            p.unlink(missing_ok=True)


def _get_doc(db: Session, doc_id: str) -> Document:
    doc = db.get(Document, doc_id)
    if doc is None:
        raise not_found("Document")
    return doc


@router.delete("/documents/{doc_id}")
def remove_document(doc_id: str, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    doc = _get_doc(db, doc_id)
    s = _own_student(actor, doc.roll)
    if DOC_TYPE_META[doc.doc_type]["academic"] and (s.locked or s.verification == "PENDING"):
        raise bad("Verified or under-review academic documents cannot be removed.")
    used = db.scalar(select(Application.application_id).where(
        Application.resume_doc_id == doc_id, Application.stage.not_in(TERMINAL_STAGES)).limit(1))
    if used:
        raise bad("This resume is attached to an active application and cannot be removed.")
    was_default = s.default_resume_id == doc_id
    if was_default:
        s.default_resume_id = None
        db.flush()
    _delete_file(doc)
    db.delete(doc)
    db.flush()
    if was_default:
        nxt = db.scalar(select(Document).where(Document.roll == s.roll, Document.doc_type == "RESUME",
                                               Document.status == "APPROVED").order_by(Document.uploaded_at))
        if nxt:
            nxt.is_default = True
            s.default_resume_id = nxt.doc_id
    log(db, actor, "Document", "DOCUMENT_REMOVED", f"{s.roll} removed {doc.file_name}.")
    db.commit()
    return {"ok": True}


@router.post("/documents/{doc_id}/default")
def set_default_resume(doc_id: str, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    doc = _get_doc(db, doc_id)
    s = _own_student(actor, doc.roll)
    if doc.doc_type != "RESUME":
        raise bad("Only resumes can be set as default.")
    if doc.status != "APPROVED":
        raise bad("Only verified resumes can be set as default.")
    for d in db.scalars(select(Document).where(Document.roll == s.roll, Document.is_default.is_(True))):
        d.is_default = False
    db.flush()
    doc.is_default = True
    s.default_resume_id = doc.doc_id
    log(db, actor, "Document", "DEFAULT_RESUME_SET", f"{s.roll} set {doc.file_name} as default resume.")
    db.commit()
    return S.document_out(doc)


@router.get("/documents/{doc_id}/file")
def download_document(doc_id: str, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    doc = _get_doc(db, doc_id)
    allowed = (
        (actor.role == "STUDENT" and actor.roll == doc.roll)
        or actor.role in ("VERIFIER", "CCPC")
    )
    if not allowed:
        raise forbidden("You cannot view this student's documents.")
    if not doc.file_path:
        raise not_found("File")
    path = (settings.upload_dir / doc.file_path).resolve()
    if settings.upload_dir not in path.parents or not path.exists():
        raise not_found("File")
    media = doc.file_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media, filename=doc.file_name, content_disposition_type="inline")


class ReviewIn(BaseModel):
    status: str
    remarks: str = Field(default="", max_length=1000)


@router.post("/documents/{doc_id}/review")
def review_document(doc_id: str, body: ReviewIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """Approve or reject a single document (resumes added after verification)."""
    actor.require_verifier()
    doc = _get_doc(db, doc_id)
    if body.status not in ("APPROVED", "REJECTED", "REVISION"):
        raise bad("Status must be APPROVED, REJECTED or REVISION.")
    if body.status != "APPROVED" and not body.remarks.strip():
        raise bad("Add a remark explaining the decision.")
    s = db.get(Student, doc.roll)
    doc.status = body.status
    doc.remarks = body.remarks.strip()
    doc.reviewed_by = actor.name
    doc.reviewed_at = utcnow()
    label = doc.label or DOC_TYPE_META[doc.doc_type]["label"]
    notify(db, s.roll, f"{label} ({doc.file_name}) was {body.status.lower()}.", "/student/documents")
    log(db, actor, "Document", "DOCUMENT_APPROVED" if body.status == "APPROVED" else "DOCUMENT_REJECTED",
        f"{s.roll}: {doc.file_name} {body.status.lower()}{f' — {doc.remarks}' if doc.remarks else ''}.")
    db.commit()
    return S.document_out(doc)


# ---------------------------------------------------------------------------
# Correction / unfreeze tickets
# ---------------------------------------------------------------------------


class TicketIn(BaseModel):
    type: str
    field: str
    requestedValue: str = Field(max_length=200)
    justification: str = Field(max_length=2000)


def _current_value(s: Student, field: str) -> str:
    if field == "semCgpa":
        return ", ".join(f"{float(x):g}" for x in (s.sem_cgpa or []))
    value = getattr(s, COLUMN[field])
    if value is None:
        return ""
    if field in ("cgpa", "class10", "class12"):
        return f"{float(value):g}"
    return str(value)


@router.post("/tickets")
def create_ticket(body: TicketIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("STUDENT")
    s = actor.student
    if s is None:
        raise forbidden("Accept your invitation first.")
    if body.type not in ("CORRECTION", "UNFREEZE"):
        raise bad("Unknown ticket type.")
    if body.field not in FIELD_LABELS:
        raise bad("This field cannot be corrected through a ticket.")
    if s.placement == "PLACED":
        raise bad("Your profile is policy-locked after placement (one-offer policy). Contact CCPC directly.")
    if not s.locked:
        raise bad("Tickets are available once your profile is verified and locked. Edit your record directly.")
    justification = body.justification.strip()
    if len(justification) < 20:
        raise bad("Justification must be at least 20 characters.")
    current = _current_value(s, body.field)
    requested = body.requestedValue.strip()
    if not requested or requested == current:
        raise bad("Requested value must differ from the current value.")
    if db.scalar(select(Ticket.ticket_id).where(Ticket.roll == s.roll, Ticket.status == "OPEN")):
        raise conflict("You already have an open ticket. Wait for it to be resolved.")
    t = Ticket(ticket_id=short_id("t"), roll=s.roll, ticket_type=body.type, field=body.field,
               field_label=FIELD_LABELS[body.field], current_value=current, requested_value=requested,
               justification=justification, status="OPEN")
    db.add(t)
    log(db, actor, "Ticket", "UNFREEZE_REQUESTED" if body.type == "UNFREEZE" else "CORRECTION_REQUESTED",
        f"{s.roll} requested {'profile unfreeze' if body.type == 'UNFREEZE' else 'a correction'} ({t.field_label}).")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise conflict("You already have an open ticket. Wait for it to be resolved.")
    return S.ticket_out(t)


class ResolveIn(BaseModel):
    decision: str
    resolution: str = Field(max_length=2000)


@router.post("/tickets/{ticket_id}/resolve")
def resolve_ticket(ticket_id: str, body: ResolveIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """CCPC governance: approving a ticket unfreezes the profile for correction and re-verification."""
    actor.require("CCPC")
    t = db.get(Ticket, ticket_id, with_for_update=True)
    if t is None:
        raise not_found("Ticket")
    if t.status != "OPEN":
        raise bad("Ticket is already resolved.")
    if body.decision not in ("APPROVED", "REJECTED"):
        raise bad("Decision must be APPROVED or REJECTED.")
    note = body.resolution.strip()
    if not note:
        raise bad("Add a resolution note.")
    s = db.get(Student, t.roll, with_for_update=True)
    t.status = body.decision
    t.resolved_at = utcnow()
    t.resolved_by = actor.name
    t.resolution = note
    if body.decision == "APPROVED":
        s.locked = False
        s.verification = "REVISION"
        s.revision_reason = f"Unfrozen for correction of {t.field_label}: {note}"
        notify(db, s.roll, f"Your ticket was approved. Your profile is unlocked — update {t.field_label} and resubmit.", "/student/profile")
        log(db, actor, "Ticket", "TICKET_APPROVED", f"Ticket for {s.roll} ({t.field_label}) approved; profile unfrozen.")
        log(db, actor, "Profile", "PROFILE_UNLOCKED", f"{s.roll} academic record unlocked for correction.")
    else:
        notify(db, s.roll, f"Your ticket for {t.field_label} was rejected: {note}", "/student/profile")
        log(db, actor, "Ticket", "TICKET_REJECTED", f"Ticket for {s.roll} ({t.field_label}) rejected.")
    db.commit()
    return S.ticket_out(t)
