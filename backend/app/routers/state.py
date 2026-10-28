"""Role-scoped state snapshot (least privilege), live-sync version and notifications."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import serializers as S
from ..database import get_db
from ..models import (
    Application,
    AuditLog,
    Company,
    Document,
    Drive,
    Invitation,
    Notification,
    Student,
    Ticket,
    User,
)
from ..rules import can_apply, evaluate_eligibility
from ..services import Actor, close_expired_drives, get_actor, mark_notifications_read, sync_version

router = APIRouter(prefix="/api", tags=["state"])

AUDIT_LIMIT = 3000


def _apps(db: Session, *where) -> list[Application]:
    q = select(Application).options(selectinload(Application.events)).order_by(Application.applied_at)
    if where:
        q = q.where(*where)
    return list(db.scalars(q))


def build_state(db: Session, actor: Actor) -> dict:
    empty = {k: [] for k in ("adminUsers", "students", "documents", "companies", "drives", "applications",
                             "invitations", "tickets", "audit", "notifications")}
    state = dict(empty)
    role = actor.role

    if role == "STUDENT":
        if actor.invitation and not actor.student:
            state["invitations"] = [S.invitation_out(actor.invitation)]
            return state
        s = actor.student
        if s is None:
            return state
        approved = list(db.scalars(select(Company).where(Company.status == "APPROVED").order_by(Company.name)))
        approved_ids = {c.company_id for c in approved}
        state["students"] = [S.student_out(s)]
        state["documents"] = [S.document_out(d) for d in db.scalars(select(Document).where(Document.roll == s.roll).order_by(Document.uploaded_at))]
        state["companies"] = [S.company_out(c, include_contact=False) for c in approved]
        state["drives"] = [S.drive_out(d) for d in db.scalars(select(Drive).where(Drive.status != "DRAFT").order_by(Drive.close_at)) if d.company_id in approved_ids]
        state["applications"] = [S.application_out(a) for a in _apps(db, Application.roll == s.roll)]
        state["tickets"] = [S.ticket_out(t) for t in db.scalars(select(Ticket).where(Ticket.roll == s.roll).order_by(Ticket.created_at))]
        state["notifications"] = [S.notification_out(n) for n in db.scalars(
            select(Notification).where(Notification.roll == s.roll).order_by(Notification.created_at.desc()).limit(100))]
        inv = db.scalar(select(Invitation).where(Invitation.roll == s.roll))
        state["invitations"] = [S.invitation_out(inv)] if inv else []
        return state

    me_user = [S.user_out(actor.user)]

    if role == "CCPC":
        state["adminUsers"] = [S.user_out(u) for u in db.scalars(select(User).where(User.role != "STUDENT").order_by(User.role, User.name))]
        state["students"] = [S.student_out(s) for s in db.scalars(select(Student).order_by(Student.roll))]
        state["documents"] = [S.document_out(d) for d in db.scalars(select(Document).order_by(Document.uploaded_at))]
        state["companies"] = [S.company_out(c) for c in db.scalars(select(Company).order_by(Company.name))]
        state["drives"] = [S.drive_out(d) for d in db.scalars(select(Drive).order_by(Drive.close_at))]
        state["applications"] = [S.application_out(a) for a in _apps(db)]
        state["invitations"] = [S.invitation_out(i, include_link=True) for i in db.scalars(select(Invitation).order_by(Invitation.created_at, Invitation.entry_no))]
        state["tickets"] = [S.ticket_out(t) for t in db.scalars(select(Ticket).order_by(Ticket.created_at))]
        audit = list(db.scalars(select(AuditLog).order_by(AuditLog.log_id.desc()).limit(AUDIT_LIMIT)))
        state["audit"] = [S.audit_out(e) for e in reversed(audit)]
        return state

    if role == "VERIFIER":
        # Verification desk: student records and their documents. No tickets, invitations or company contacts.
        state["adminUsers"] = me_user
        state["students"] = [S.student_out(s) for s in db.scalars(select(Student).order_by(Student.roll))]
        state["documents"] = [S.document_out(d) for d in db.scalars(select(Document).order_by(Document.uploaded_at))]
        state["companies"] = [S.company_out(c, include_contact=False) for c in db.scalars(select(Company).order_by(Company.name))]
        state["drives"] = [S.drive_out(d) for d in db.scalars(select(Drive).where(Drive.status != "DRAFT"))]
        state["applications"] = [S.application_out(a) for a in _apps(db)]
    elif role == "SPOC":
        # Workspace isolation: only assigned companies, their drives and their applicants.
        companies = list(db.scalars(select(Company).where(Company.assigned_spoc == actor.email).order_by(Company.name)))
        company_ids = [c.company_id for c in companies]
        drives = list(db.scalars(select(Drive).where(Drive.company_id.in_(company_ids)).order_by(Drive.close_at))) if company_ids else []
        drive_ids = [d.drive_id for d in drives]
        apps = _apps(db, Application.drive_id.in_(drive_ids)) if drive_ids else []
        rolls = {a.roll for a in apps}
        if actor.user.linked_student_roll:
            rolls.add(actor.user.linked_student_roll)
        resume_ids = {a.resume_doc_id for a in apps if a.resume_doc_id}
        state["adminUsers"] = me_user
        state["companies"] = [S.company_out(c) for c in companies]
        state["drives"] = [S.drive_out(d) for d in drives]
        state["applications"] = [S.application_out(a) for a in apps]
        state["students"] = [S.student_out(s) for s in db.scalars(select(Student).where(Student.roll.in_(rolls)))] if rolls else []
        state["documents"] = [S.document_out(d) for d in db.scalars(select(Document).where(Document.doc_id.in_(resume_ids)))] if resume_ids else []

    # Non-CCPC staff see their own recent activity in the bell feed.
    own = list(db.scalars(select(AuditLog).where(AuditLog.actor_email == actor.email).order_by(AuditLog.log_id.desc()).limit(50)))
    state["audit"] = [S.audit_out(e) for e in reversed(own)]
    return state


@router.get("/state")
def get_state(actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    close_expired_drives(db)
    return {"version": sync_version(db), "data": build_state(db, actor)}


@router.get("/sync")
def get_sync(actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """Cheap polling endpoint: the client refetches /state only when this number changes."""
    close_expired_drives(db)
    unread = 0
    if actor.student:
        unread = len(db.scalars(select(Notification.notification_id).where(
            Notification.roll == actor.student.roll, Notification.is_read.is_(False))).all())
    return {"version": sync_version(db), "unread": unread}


@router.post("/notifications/read-all")
def read_all(actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    if actor.student:
        mark_notifications_read(db, actor.student.roll)
        db.commit()
    return {"ok": True}


@router.get("/drives/eligible")
def eligible_drives(actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """Dynamic eligibility query from the report: CGPA >= cutoff AND branch allowed AND backlogs <= limit
    AND status == VERIFIED_LOCKED (plus batch, degree, skills and the one-offer policy)."""
    actor.require("STUDENT")
    s = actor.student
    if s is None:
        return {"drives": []}
    close_expired_drives(db)
    out = []
    drives = db.scalars(
        select(Drive).join(Company).where(Drive.status != "DRAFT", Company.status == "APPROVED").order_by(Drive.close_at)
    ).all()
    for d in drives:
        existing = db.scalar(select(Application).where(Application.drive_id == d.drive_id, Application.roll == s.roll))
        ok, reason = can_apply(s, d, existing)
        out.append({**S.drive_out(d), "eligibility": evaluate_eligibility(s, d).as_dict(), "canApply": ok, "reason": reason or None})
    return {"drives": out}

