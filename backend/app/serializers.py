"""Convert ORM rows into the JSON shapes the React frontend expects (camelCase, string ids)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from .config import settings
from .models import (
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
from .rules import profile_state


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def f(value: Decimal | float | int | None) -> float | None:
    return float(value) if value is not None else None


def user_out(u: User) -> dict:
    return {
        "id": u.email,
        "email": u.email,
        "name": u.name,
        "role": u.role,
        "title": u.title,
        "canVerify": u.can_verify,
        "isActive": u.is_active,
        "linkedStudentId": u.linked_student_roll,
        "hasPassword": bool(u.password_hash),
        "lastLoginAt": iso(u.last_login_at),
    }


def student_out(s: Student) -> dict:
    proof = dict(s.proof or {})
    return {
        "id": s.roll,
        "roll": s.roll,
        "name": s.name,
        "email": s.user_email,
        "phone": s.phone or "",
        "degree": s.degree or "",
        "branch": s.branch or "",
        "gradYear": s.grad_year,
        "cgpa": f(s.cgpa),
        "semCgpa": [float(x) for x in (s.sem_cgpa or [])],
        "class10": f(s.class10),
        "class12": f(s.class12),
        "backlogs": s.backlogs or 0,
        "skills": list(s.skills or []),
        "verification": s.verification,
        "locked": s.locked,
        "verifiedBy": s.verified_by,
        "verifiedAt": iso(s.verified_at),
        "submittedAt": iso(s.submitted_at),
        "revisionReason": s.revision_reason,
        "placement": s.placement,
        "placedCompany": s.placed_company,
        "proof": proof,
        "defaultResumeId": s.default_resume_id,
        "createdAt": iso(s.created_at),
        "profileState": profile_state(s),
    }


def document_out(d: Document) -> dict:
    return {
        "id": d.doc_id,
        "studentId": d.roll,
        "type": d.doc_type,
        "label": d.label,
        "fileName": d.file_name,
        "fileType": d.file_type,
        "size": d.size_bytes,
        "uploadedAt": iso(d.uploaded_at),
        "status": d.status,
        "remarks": d.remarks or "",
        "claimedValue": d.claimed_value,
        "isDefault": d.is_default,
        "hasFile": bool(d.file_path),
        "reviewedBy": d.reviewed_by,
        "reviewedAt": iso(d.reviewed_at),
    }


def company_out(c: Company, *, include_contact: bool = True) -> dict:
    out = {
        "id": c.company_id,
        "name": c.name,
        "industry": c.industry or "",
        "website": c.website or "",
        "description": c.description or "",
        "spocId": c.assigned_spoc,
        "status": c.status,
        "active": c.active,
        "approvedAt": iso(c.approved_at),
    }
    if include_contact:
        out.update(contactName=c.contact_name or "", recruiterEmail=c.recruiter_email or "", phone=c.phone or "")
    return out


def drive_out(d: Drive) -> dict:
    return {
        "id": d.drive_id,
        "companyId": d.company_id,
        "role": d.role,
        "ctc": f(d.ctc),
        "location": d.location or "",
        "category": d.category or "",
        "description": d.description or "",
        "criteria": {
            "minCgpa": f(d.min_cgpa),
            "branches": list(d.allowed_branches or []),
            "maxBacklogs": d.max_backlogs,
            "gradYears": list(d.grad_years or []),
            "degrees": list(d.degrees or []),
            "skills": list(d.skills or []),
        },
        "deadline": iso(d.close_at),
        "status": d.status,
        "createdBy": d.created_by,
        "createdAt": iso(d.created_at),
    }


def application_out(a: Application) -> dict:
    return {
        "id": a.application_id,
        "studentId": a.roll,
        "driveId": a.drive_id,
        "resumeId": a.resume_doc_id,
        "appliedAt": iso(a.applied_at),
        "stage": a.stage,
        "updatedAt": iso(a.updated_at),
        "history": [{"stage": e.stage, "at": iso(e.at), "by": e.actor or "", "note": e.note or ""} for e in a.events],
    }


def ticket_out(t: Ticket) -> dict:
    return {
        "id": t.ticket_id,
        "studentId": t.roll,
        "type": t.ticket_type,
        "field": t.field,
        "fieldLabel": t.field_label,
        "currentValue": t.current_value,
        "requestedValue": t.requested_value,
        "justification": t.justification,
        "status": t.status,
        "createdAt": iso(t.created_at),
        "resolvedAt": iso(t.resolved_at),
        "resolvedBy": t.resolved_by,
        "resolution": t.resolution or "",
    }


def invitation_out(i: Invitation, *, include_link: bool = False) -> dict:
    out = {
        "id": i.invitation_id,
        "entryNo": i.entry_no,
        "name": i.name,
        "email": i.email,
        "branch": i.branch,
        "degree": i.degree,
        "feePaid": i.fee_paid,
        "status": i.status,
        "updatedAt": iso(i.updated_at),
        "studentId": i.roll,
    }
    if include_link:
        out["inviteLink"] = invite_link(i)
    return out


def invite_link(i: Invitation) -> str | None:
    if i.status != "INVITED" or not i.invite_token:
        return None
    return f"{settings.frontend_url}/activate?token={i.invite_token}"


def audit_out(e: AuditLog) -> dict:
    return {
        "id": e.log_id,
        "at": iso(e.ts),
        "actorName": e.actor,
        "actorEmail": e.actor_email,
        "actorRole": e.actor_role,
        "entity": e.entity,
        "action": e.action_type,
        "description": e.description,
    }


def notification_out(n: Notification) -> dict:
    return {
        "id": n.notification_id,
        "userId": n.roll,
        "message": n.message,
        "at": iso(n.created_at),
        "read": n.is_read,
        "link": n.link,
    }
