"""Companies (CCPC approval + SPOC assignment) and placement drives / JAFs (SPOC roster workspace)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import serializers as S
from ..database import get_db
from ..models import Company, Drive, User
from ..rules import BRANCH_CODES, DEGREES, to_decimal, utcnow
from ..security import short_id
from ..services import Actor, bad, conflict, forbidden, get_actor, log, not_found, notify_all_students, drive_name

router = APIRouter(prefix="/api", tags=["companies & drives"])


def fmt_dt(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%d %b %Y, %H:%M UTC")


def fmt_ctc(ctc) -> str:
    return f"₹{float(ctc):g} LPA"


# ---------------------------------------------------------------------------
# Companies
# ---------------------------------------------------------------------------


class CompanyIn(BaseModel):
    id: str | None = None
    name: str = Field(max_length=120)
    industry: str = Field(default="", max_length=120)
    website: str = Field(default="", max_length=255)
    description: str = Field(default="", max_length=600)
    contactName: str = Field(default="", max_length=120)
    recruiterEmail: str = Field(default="", max_length=254)
    phone: str = Field(default="", max_length=32)
    spocId: str | None = None


def _spoc(db: Session, email: str | None) -> User | None:
    if not email:
        return None
    u = db.get(User, email)
    if u is None or u.role != "SPOC" or not u.is_active:
        raise bad("Choose an active SPOC.")
    return u


@router.post("/companies")
def save_company(body: CompanyIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC")
    name = body.name.strip()
    if len(name) < 2:
        raise bad("Company name is required.")
    dup = db.scalar(select(Company).where(func.lower(Company.name) == name.lower(), Company.company_id != (body.id or "")))
    if dup:
        raise conflict("A company with this name already exists.")
    spoc = _spoc(db, body.spocId)
    fields = dict(name=name, industry=body.industry.strip(), website=body.website.strip(), description=body.description.strip(),
                  contact_name=body.contactName.strip(), recruiter_email=body.recruiterEmail.strip(), phone=body.phone.strip())
    if body.id:
        c = db.get(Company, body.id)
        if c is None:
            raise not_found("Company")
        prev = c.assigned_spoc
        for k, v in fields.items():
            setattr(c, k, v)
        c.assigned_spoc = spoc.email if spoc else None
        log(db, actor, "Company", "COMPANY_UPDATED", f"{name} details updated.")
        if prev != c.assigned_spoc:
            log(db, actor, "Company", "SPOC_ASSIGNED", f"{name} assigned to SPOC {spoc.name if spoc else '—'}.")
    else:
        c = Company(company_id=short_id("c"), status="APPROVED", active=True, approved_at=utcnow(),
                    assigned_spoc=spoc.email if spoc else None, **fields)
        db.add(c)
        log(db, actor, "Company", "COMPANY_APPROVED", f"{name} approved and added to the season.")
        if spoc:
            log(db, actor, "Company", "SPOC_ASSIGNED", f"{name} assigned to SPOC {spoc.name}.")
    db.commit()
    return S.company_out(c)


@router.post("/companies/{company_id}/approve")
def approve_company(company_id: str, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC")
    c = db.get(Company, company_id)
    if c is None:
        raise not_found("Company")
    c.status = "APPROVED"
    c.approved_at = utcnow()
    log(db, actor, "Company", "COMPANY_APPROVED", f"{c.name} approved by CCPC.")
    db.commit()
    return S.company_out(c)


class AssignIn(BaseModel):
    spocId: str


@router.post("/companies/{company_id}/assign-spoc")
def assign_spoc(company_id: str, body: AssignIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC")
    c = db.get(Company, company_id)
    if c is None:
        raise not_found("Company")
    spoc = _spoc(db, body.spocId)
    c.assigned_spoc = spoc.email
    log(db, actor, "Company", "SPOC_ASSIGNED", f"{c.name} assigned to SPOC {spoc.name}.")
    db.commit()
    return S.company_out(c)


class ActiveIn(BaseModel):
    active: bool


@router.post("/companies/{company_id}/active")
def set_company_active(company_id: str, body: ActiveIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC")
    c = db.get(Company, company_id)
    if c is None:
        raise not_found("Company")
    c.active = body.active
    if not body.active:
        for d in db.scalars(select(Drive).where(Drive.company_id == c.company_id, Drive.status == "OPEN")):
            d.status = "FROZEN"
    log(db, actor, "Company", "COMPANY_REACTIVATED" if body.active else "COMPANY_DEACTIVATED",
        f"{c.name} {'reactivated' if body.active else 'deactivated; open drives frozen'}.")
    db.commit()
    return S.company_out(c)


# ---------------------------------------------------------------------------
# Drives / JAF
# ---------------------------------------------------------------------------


class CriteriaIn(BaseModel):
    minCgpa: float | None = None
    maxBacklogs: int | None = None
    branches: list[str] = []
    degrees: list[str] = []
    gradYears: list[int] = []
    skills: list[str] = []


class DriveIn(BaseModel):
    id: str | None = None
    companyId: str
    role: str = Field(max_length=160)
    ctc: float
    location: str = Field(default="", max_length=120)
    category: str = Field(default="", max_length=60)
    description: str = Field(default="", max_length=4000)
    deadline: datetime
    status: str = "OPEN"
    criteria: CriteriaIn = CriteriaIn()


def _can_manage_company(actor: Actor, company: Company) -> None:
    if actor.role == "CCPC":
        return
    if actor.role == "SPOC" and company.assigned_spoc == actor.email:
        return
    raise forbidden("You can only manage drives for companies assigned to you.")


@router.post("/drives")
def save_drive(body: DriveIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC", "SPOC")
    company = db.get(Company, body.companyId)
    if company is None:
        raise not_found("Company")
    _can_manage_company(actor, company)
    role = body.role.strip()
    if not role:
        raise bad("Role title is required.")
    if not body.ctc > 0:
        raise bad("CTC must be greater than zero.")
    if body.status not in ("DRAFT", "OPEN", "FROZEN", "CLOSED"):
        raise bad("Unknown drive status.")
    if company.status != "APPROVED":
        raise bad("Company must be approved before a drive can be published.")
    if not company.active and body.status == "OPEN":
        raise bad("Reactivate the company before opening its drive.")
    deadline = body.deadline if body.deadline.tzinfo else body.deadline.replace(tzinfo=timezone.utc)
    if body.status == "OPEN" and deadline <= utcnow():
        raise bad("An open drive needs a deadline in the future.")
    c = body.criteria
    if any(b not in BRANCH_CODES for b in c.branches):
        raise bad("Unknown branch in eligibility criteria.")
    if any(d not in DEGREES for d in c.degrees):
        raise bad("Unknown degree in eligibility criteria.")
    if c.minCgpa is not None and not 0 <= c.minCgpa <= 10:
        raise bad("Minimum CGPA must be between 0 and 10.")
    if c.maxBacklogs is not None and c.maxBacklogs < 0:
        raise bad("Maximum backlogs cannot be negative.")

    fields = dict(
        company_id=company.company_id, role=role, ctc=to_decimal(body.ctc), location=body.location.strip(),
        category=body.category.strip(), description=body.description.strip(), close_at=deadline, status=body.status,
        min_cgpa=to_decimal(c.minCgpa), max_backlogs=c.maxBacklogs, allowed_branches=c.branches, degrees=c.degrees,
        grad_years=c.gradYears, skills=[s.strip() for s in c.skills if s.strip()],
    )
    if body.id:
        d = db.get(Drive, body.id)
        if d is None:
            raise not_found("Drive")
        _can_manage_company(actor, d.company)
        was_open = d.status == "OPEN"
        for k, v in fields.items():
            setattr(d, k, v)
        log(db, actor, "Drive", "DRIVE_UPDATED", f"{company.name} — {role} updated.")
        if d.status == "OPEN" and not was_open:
            notify_all_students(db, f"New drive: {company.name} — {role} ({fmt_ctc(d.ctc)}).", f"/student/opportunities/{d.drive_id}")
    else:
        d = Drive(drive_id=short_id("d"), created_by=actor.name, created_by_email=actor.email, **fields)
        db.add(d)
        db.flush()
        action = "saved as draft" if d.status == "DRAFT" else "published"
        log(db, actor, "Drive", "DRIVE_CREATED", f"{company.name} — {role} {action} ({fmt_ctc(d.ctc)}, closes {fmt_dt(deadline)}).")
        if d.status == "OPEN":
            notify_all_students(db, f"New drive: {company.name} — {role} ({fmt_ctc(d.ctc)}).", f"/student/opportunities/{d.drive_id}")
    db.commit()
    return S.drive_out(d)


class StatusIn(BaseModel):
    status: str


@router.post("/drives/{drive_id}/status")
def set_drive_status(drive_id: str, body: StatusIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    actor.require("CCPC", "SPOC")
    d = db.get(Drive, drive_id)
    if d is None:
        raise not_found("Drive")
    _can_manage_company(actor, d.company)
    if body.status not in ("DRAFT", "OPEN", "FROZEN", "CLOSED"):
        raise bad("Unknown drive status.")
    if body.status == "OPEN" and d.close_at <= utcnow():
        raise bad("Extend the deadline before reopening this drive.")
    if body.status == "OPEN" and not d.company.active:
        raise bad("Reactivate the company before opening its drive.")
    d.status = body.status
    log(db, actor, "Drive", f"DRIVE_{body.status}", f"{drive_name(db, d)} status set to {body.status}.")
    db.commit()
    return S.drive_out(d)


class ExtendIn(BaseModel):
    deadline: datetime
    reason: str = Field(max_length=500)


@router.post("/drives/{drive_id}/extend")
def extend_deadline(drive_id: str, body: ExtendIn, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)):
    """CCPC-only synchronized deadline extension: one stored deadline, every role sees the new countdown."""
    actor.require("CCPC")
    d = db.get(Drive, drive_id, with_for_update=True)
    if d is None:
        raise not_found("Drive")
    new = body.deadline if body.deadline.tzinfo else body.deadline.replace(tzinfo=timezone.utc)
    if new <= utcnow():
        raise bad("New deadline must be in the future.")
    if new <= d.close_at:
        raise bad("New deadline must be later than the current deadline.")
    reason = body.reason.strip()
    if not reason:
        raise bad("A reason is required — it is written to the audit log.")
    prev = d.close_at
    d.close_at = new
    if d.status == "CLOSED":
        d.status = "OPEN"
    name = drive_name(db, d)
    notify_all_students(db, f"Deadline extended: {name} now closes {fmt_dt(new)}.", f"/student/opportunities/{d.drive_id}")
    log(db, actor, "Drive", "DEADLINE_EXTENDED", f"{name}: {fmt_dt(prev)} → {fmt_dt(new)}. Reason: {reason}")
    db.commit()
    return S.drive_out(d)
