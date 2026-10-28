"""Faculty/Staff Verification Workflow: record proof values, approve (auto-lock), request revision, reject."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import serializers as S
from ..database import get_db
from ..models import Document, Student
from ..rules import DOC_TYPE_META, compare_claims, utcnow
from ..services import Actor, bad, forbidden, get_actor, log, not_found, notify

router = APIRouter(prefix="/api/verification", tags=["verification"])


def _student(db: Session, roll: str) -> Student:
    s = db.get(Student, roll, with_for_update=True)
    if s is None:
        raise not_found("Student")
    return s


class ProofIn(BaseModel):
    values: dict[str, Any]


@router.put("/{roll}/proof")
def set_proof_values(roll: str, body: ProofIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """The verifier records the values read off the proof documents (the "As per proof" column)."""
    actor.require_verifier()
    s = _student(db, roll)
    if s.verification != "PENDING":
        raise bad("Proof values can be recorded only while the profile is awaiting verification.")
    clean: dict[str, Any] = {}
    for key, value in body.values.items():
        if key in ("cgpa", "class10", "class12"):
            try:
                clean[key] = round(float(value), 2)
            except (TypeError, ValueError):
                raise bad(f"Enter a number for {key}.")
        elif key == "backlogs":
            try:
                clean[key] = int(value)
            except (TypeError, ValueError):
                raise bad("Enter a whole number for backlogs.")
        elif key in ("branch", "degree"):
            clean[key] = str(value).strip()
    if not clean:
        raise bad("No proof values supplied.")
    s.proof = {**(s.proof or {}), **clean}
    log(db, actor, "Verification", "PROOF_VALUES_RECORDED",
        f"{actor.name} recorded proof values for {s.roll}: {', '.join(f'{k}={v}' for k, v in clean.items())}.")
    db.commit()
    return S.student_out(s)


class ApproveIn(BaseModel):
    remarks: str = Field(default="", max_length=1000)


@router.post("/{roll}/approve")
def approve_profile(roll: str, body: ApproveIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require_verifier()
    s = _student(db, roll)
    if s.verification != "PENDING":
        raise bad("Only profiles awaiting verification can be approved.")
    mismatches = [r for r in compare_claims(s) if not r["match"]]
    if mismatches:
        raise bad(f"Resolve mismatches first: {', '.join(m['label'] for m in mismatches)}")
    remarks = body.remarks.strip()
    now = utcnow()
    s.verification = "VERIFIED"
    s.locked = True
    s.verified_by = actor.name
    s.verified_by_email = actor.email
    s.verified_at = now
    s.revision_reason = None
    docs = list(db.scalars(select(Document).where(Document.roll == s.roll)))
    for d in docs:
        if d.status == "PENDING":
            d.status = "APPROVED"
            d.remarks = remarks
            d.reviewed_by = actor.name
            d.reviewed_at = now
    if not s.default_resume_id:
        resume = next((d for d in docs if d.doc_type == "RESUME" and d.status == "APPROVED"), None)
        if resume:
            resume.is_default = True
            s.default_resume_id = resume.doc_id
    notify(db, s.roll, f"Your profile was verified by {actor.name} and is now locked. You can apply to eligible drives.", "/student/profile")
    log(db, actor, "Profile", "PROFILE_VERIFIED", f"{s.roll} ({s.name}) verified{f' — {remarks}' if remarks else ''}.")
    log(db, actor, "Profile", "PROFILE_LOCKED", f"{s.roll} academic record auto-locked after verification.")
    db.commit()
    return S.student_out(s)


class RevisionIn(BaseModel):
    reason: str = Field(max_length=1000)
    docIds: list[str] = []


@router.post("/{roll}/revision")
def request_revision(roll: str, body: RevisionIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    reason = body.reason.strip()
    if not reason:
        raise bad("A reason is required to request a revision.")
    s = _student(db, roll)
    if s.verification == "PENDING":
        actor.require_verifier()
    elif actor.role != "CCPC":
        raise forbidden("Only CCPC can unlock a profile that is not awaiting verification.")
    if s.placement == "PLACED":
        raise bad("This profile is policy-locked after placement.")
    was_locked = s.locked
    s.verification = "REVISION"
    s.locked = False
    s.revision_reason = reason
    docs = list(db.scalars(select(Document).where(Document.roll == s.roll)))
    if body.docIds:
        flagged = [d for d in docs if d.doc_id in set(body.docIds)]
    else:
        flagged = [d for d in docs if DOC_TYPE_META[d.doc_type]["academic"] and d.status == "PENDING"]
    for d in flagged:
        d.status = "REVISION"
        d.remarks = reason
        d.reviewed_by = actor.name
        d.reviewed_at = utcnow()
    notify(db, s.roll, f"Revision requested on your Profile Audit: {reason}", "/student/profile")
    log(db, actor, "Profile", "REVISION_REQUESTED", f"{s.roll} ({s.name}): {reason}")
    if was_locked:
        log(db, actor, "Profile", "PROFILE_UNLOCKED", f"{s.roll} academic record unlocked by CCPC for revision.")
    db.commit()
    return S.student_out(s)


class RejectIn(BaseModel):
    reason: str = Field(max_length=1000)


@router.post("/{roll}/reject")
def reject_profile(roll: str, body: RejectIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require_verifier()
    reason = body.reason.strip()
    if not reason:
        raise bad("A reason is required to reject a profile.")
    s = _student(db, roll)
    if s.verification != "PENDING":
        raise bad("Only profiles awaiting verification can be rejected.")
    s.verification = "REJECTED"
    s.locked = False
    s.revision_reason = reason
    for d in db.scalars(select(Document).where(Document.roll == s.roll, Document.status == "PENDING")):
        d.status = "REJECTED"
        d.remarks = reason
        d.reviewed_by = actor.name
        d.reviewed_at = utcnow()
    notify(db, s.roll, f"Your profile submission was rejected: {reason}", "/student/profile")
    log(db, actor, "Profile", "PROFILE_REJECTED", f"{s.roll} ({s.name}) rejected: {reason}")
    db.commit()
    return S.student_out(s)
