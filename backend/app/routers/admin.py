"""CCPC administration: user & verifier-rights management, analytics and audit-trail helpers."""

from __future__ import annotations

import csv
import io
import secrets
import statistics
from collections import Counter, defaultdict
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import serializers as S
from ..config import settings
from ..database import get_db
from ..models import Application, AuditLog, Company, Document, Drive, Invitation, Student, Ticket, User
from ..rules import BRANCH_CODES, utcnow
from ..security import hash_password
from ..services import Actor, bad, conflict, get_actor, log, not_found

router = APIRouter(prefix="/api", tags=["administration"])

STAFF_ROLES = ("VERIFIER", "SPOC", "CCPC")

# ---------------------------------------------------------------------------
# Users & verification permissions
# ---------------------------------------------------------------------------


class UserIn(BaseModel):
    email: str = Field(max_length=254)
    name: str = Field(max_length=120)
    role: str
    title: str = Field(default="", max_length=120)
    canVerify: bool = False
    linkedStudentId: str | None = None
    password: str | None = Field(default=None, max_length=200)


class UserPatch(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    title: str | None = Field(default=None, max_length=120)
    role: str | None = None
    canVerify: bool | None = None
    isActive: bool | None = None
    linkedStudentId: str | None = None


def _temp_password() -> str:
    return settings.demo_password if settings.demo_mode else secrets.token_urlsafe(9)


def _check_link(db: Session, roll: str | None) -> str | None:
    if not roll:
        return None
    if db.get(Student, roll) is None:
        raise bad(f"No student profile with roll {roll}.")
    return roll


@router.post("/users")
def create_user(body: UserIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC")
    email = body.email.strip().lower()
    if not settings.email_allowed(email):
        raise bad(f"Staff accounts must use an @{settings.allowed_email_domain} address.")
    if body.role not in STAFF_ROLES:
        raise bad("Role must be VERIFIER, SPOC or CCPC. Students join through onboarding invitations.")
    if db.get(User, email):
        raise conflict("An account with this email already exists.")
    if body.password is not None and len(body.password) < 8:
        raise bad("Password must be at least 8 characters.")
    password = body.password or _temp_password()
    u = User(email=email, name=body.name.strip(), role=body.role, title=body.title.strip() or None,
             can_verify=body.canVerify if body.role == "VERIFIER" else body.role == "CCPC",
             linked_student_roll=_check_link(db, body.linkedStudentId) if body.role == "SPOC" else None,
             password_hash=hash_password(password), is_active=True)
    db.add(u)
    log(db, actor, "User", "USER_CREATED", f"{u.name} ({email}) added as {u.role}{' with verification rights' if u.can_verify and u.role == 'VERIFIER' else ''}.")
    db.commit()
    return {"user": S.user_out(u), "temporaryPassword": None if body.password else password}


@router.put("/users/{email}")
def update_user(email: str, body: UserPatch, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC")
    u = db.get(User, email.lower())
    if u is None or u.role == "STUDENT":
        raise not_found("Staff user")
    changes = []
    if body.role is not None and body.role != u.role:
        if body.role not in STAFF_ROLES:
            raise bad("Unknown role.")
        if u.role == "SPOC" and db.scalar(select(Company.company_id).where(Company.assigned_spoc == u.email).limit(1)):
            raise bad("Reassign this SPOC's companies before changing their role.")
        if u.email == actor.email:
            raise bad("You cannot change your own role.")
        changes.append(f"role {u.role} → {body.role}")
        u.role = body.role
        if body.role != "SPOC":
            u.linked_student_roll = None
    if body.name is not None and body.name.strip():
        u.name = body.name.strip()
    if body.title is not None:
        u.title = body.title.strip() or None
    if body.canVerify is not None and body.canVerify != u.can_verify:
        u.can_verify = body.canVerify
        changes.append("verification rights " + ("granted" if body.canVerify else "revoked"))
    if body.isActive is not None and body.isActive != u.is_active:
        if u.email == actor.email:
            raise bad("You cannot deactivate your own account.")
        u.is_active = body.isActive
        changes.append("activated" if body.isActive else "deactivated")
    if "linkedStudentId" in body.model_fields_set and u.role == "SPOC":
        u.linked_student_roll = _check_link(db, body.linkedStudentId)
        changes.append(f"linked student {u.linked_student_roll or '—'}")
    log(db, actor, "User", "USER_UPDATED", f"{u.name} ({u.email}) updated" + (f": {', '.join(changes)}." if changes else "."))
    db.commit()
    return S.user_out(u)


@router.post("/users/{email}/reset-password")
def reset_password(email: str, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC")
    u = db.get(User, email.lower())
    if u is None:
        raise not_found("User")
    password = _temp_password()
    u.password_hash = hash_password(password)
    log(db, actor, "User", "PASSWORD_RESET", f"Password reset for {u.email}.")
    db.commit()
    return {"temporaryPassword": password}


# ---------------------------------------------------------------------------
# Audit trail helpers
# ---------------------------------------------------------------------------


class ExportLogIn(BaseModel):
    entity: str = Field(max_length=40)
    description: str = Field(max_length=500)


@router.post("/audit/export-log")
def log_export(body: ExportLogIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """Client-side exports (e.g. student records CSV) are recorded in the audit trail."""
    actor.require("CCPC", "VERIFIER", "SPOC")
    log(db, actor, body.entity, "ROSTER_EXPORTED" if body.entity == "Application" else "RECORDS_EXPORTED", body.description)
    db.commit()
    return {"ok": True}


@router.get("/audit/export.csv")
def export_audit(actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC")
    buf = io.StringIO()
    w = csv.writer(buf, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
    w.writerow(["Log ID", "Timestamp (UTC)", "Actor", "Actor email", "Role", "Entity", "Action", "Description"])
    for e in db.scalars(select(AuditLog).order_by(AuditLog.log_id)):
        cells = [e.log_id, e.ts.astimezone(timezone.utc).isoformat(), e.actor, e.actor_email or "", e.actor_role, e.entity, e.action_type, e.description]
        w.writerow([("'" + c) if isinstance(c, str) and c.startswith(("=", "+", "-", "@")) else c for c in cells])
    log(db, actor, "Audit", "AUDIT_EXPORTED", "Full audit trail exported as CSV.")
    db.commit()
    return Response("﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="placematrix_audit_trail.csv"'})


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


@router.get("/analytics/summary")
def analytics(actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC")
    students = db.scalars(select(Student)).all()
    drives = {d.drive_id: d for d in db.scalars(select(Drive))}
    companies = {c.company_id: c for c in db.scalars(select(Company))}
    apps = db.scalars(select(Application).options(selectinload(Application.events))).all()
    docs = db.scalars(select(Document)).all()
    tickets = db.scalars(select(Ticket)).all()
    invites = db.scalars(select(Invitation)).all()

    offers = [a for a in apps if a.stage == "OFFERED"]
    offer_ctcs = [float(drives[a.drive_id].ctc) for a in offers if a.drive_id in drives]
    placed = [s for s in students if s.placement == "PLACED"]
    verified = [s for s in students if s.verification == "VERIFIED"]

    by_branch = []
    for b in BRANCH_CODES:
        bs = [s for s in students if s.branch == b]
        if not bs:
            continue
        bp = [s for s in bs if s.placement == "PLACED"]
        bctc = [float(drives[a.drive_id].ctc) for a in offers if a.roll in {s.roll for s in bp} and a.drive_id in drives]
        by_branch.append({
            "branch": b, "students": len(bs), "verified": sum(1 for s in bs if s.verification == "VERIFIED"),
            "placed": len(bp), "placementRate": round(100 * len(bp) / len(bs), 1),
            "avgCtc": round(statistics.mean(bctc), 2) if bctc else None,
        })

    by_company = []
    for cid, c in companies.items():
        cd = [d for d in drives.values() if d.company_id == cid]
        cids = {d.drive_id for d in cd}
        capps = [a for a in apps if a.drive_id in cids and a.stage != "WITHDRAWN"]
        by_company.append({
            "company": c.name, "drives": len(cd), "applicants": len(capps),
            "shortlisted": sum(1 for a in capps if any(e.stage == "SHORTLISTED" for e in a.events)),
            "offers": sum(1 for a in capps if a.stage == "OFFERED"),
            "maxCtc": max((float(d.ctc) for d in cd), default=None),
        })
    by_company.sort(key=lambda r: (-r["offers"], -r["applicants"], r["company"]))

    active = [a for a in apps if a.stage != "WITHDRAWN"]

    def reached(stages: set[str]) -> int:
        return sum(1 for a in active if any(e.stage in stages for e in a.events))

    funnel = [
        {"stage": "Applied", "count": len(active)},
        {"stage": "Shortlisted", "count": reached({"SHORTLISTED", "ASSESSMENT", "INTERVIEW", "OFFERED"})},
        {"stage": "Assessment", "count": reached({"ASSESSMENT", "INTERVIEW", "OFFERED"})},
        {"stage": "Interview", "count": reached({"INTERVIEW", "OFFERED"})},
        {"stage": "Offered", "count": reached({"OFFERED"})},
    ]

    turnaround = [
        (s.verified_at - s.submitted_at).total_seconds() / 3600
        for s in verified if s.verified_at and s.submitted_at and s.verified_at > s.submitted_at
    ]

    today = utcnow().date()
    days = [today - timedelta(days=i) for i in range(13, -1, -1)]
    per_day = Counter(a.applied_at.astimezone(timezone.utc).date() for a in apps)
    activity = Counter(e.actor_role for e in db.scalars(select(AuditLog).where(AuditLog.ts >= utcnow() - timedelta(days=14))))

    ctc_bands = defaultdict(int)
    for v in offer_ctcs:
        band = "< 10" if v < 10 else "10–20" if v < 20 else "20–30" if v < 30 else "30–40" if v < 40 else "40+"
        ctc_bands[band] += 1

    return {
        "generatedAt": utcnow().isoformat(),
        "kpis": {
            "students": len(students),
            "verified": len(verified),
            "pendingVerification": sum(1 for s in students if s.verification == "PENDING"),
            "placed": len(placed),
            "placementRate": round(100 * len(placed) / len(verified), 1) if verified else 0,
            "offers": len(offers),
            "highestCtc": max(offer_ctcs) if offer_ctcs else None,
            "averageCtc": round(statistics.mean(offer_ctcs), 2) if offer_ctcs else None,
            "medianCtc": round(statistics.median(offer_ctcs), 2) if offer_ctcs else None,
            "openDrives": sum(1 for d in drives.values() if d.status == "OPEN"),
            "companies": sum(1 for c in companies.values() if c.status == "APPROVED"),
            "applications": len(active),
            "avgVerificationHours": round(statistics.mean(turnaround), 1) if turnaround else None,
            "openTickets": sum(1 for t in tickets if t.status == "OPEN"),
        },
        "byBranch": by_branch,
        "byCompany": by_company,
        "funnel": funnel,
        "verification": dict(Counter(s.verification for s in students)),
        "documents": dict(Counter(d.status for d in docs)),
        "tickets": {"byStatus": dict(Counter(t.status for t in tickets)), "byType": dict(Counter(t.ticket_type for t in tickets))},
        "invitations": dict(Counter(i.status for i in invites)),
        "applicationsPerDay": [{"date": d.isoformat(), "count": per_day.get(d, 0)} for d in days],
        "ctcBands": [{"band": b, "count": ctc_bands.get(b, 0)} for b in ["< 10", "10–20", "20–30", "30–40", "40+"]],
        "activityByRole": dict(activity),
    }
