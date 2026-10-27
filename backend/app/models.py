"""PlaceMatrix relational schema (PostgreSQL).

Follows the 8 core tables from the project report (users, students, documents, companies,
placement_drives, applications, unfreeze_tickets, audit_logs) and adds three supporting tables:
application_events (stage history), invitations (fee-paid onboarding) and notifications.

String primary keys are used for business entities so ids stay readable in URLs
(e.g. drive "d-01", student roll "2026AIM1028", user email "ccpc@iitrpr.ac.in").
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# ---------------------------------------------------------------------------
# Allowed values (enforced with CHECK constraints)
# ---------------------------------------------------------------------------

ROLES = ("STUDENT", "VERIFIER", "SPOC", "CCPC")
VERIFICATION = ("NOT_SUBMITTED", "PENDING", "VERIFIED", "REVISION", "REJECTED")
PLACEMENT = ("UNPLACED", "PLACED")
DOC_TYPES = ("GRADE_CARD", "CLASS10", "CLASS12", "ID_PROOF", "RESUME", "PORTFOLIO", "CERTIFICATE", "OTHER")
ACADEMIC_DOC_TYPES = ("GRADE_CARD", "CLASS10", "CLASS12")
DOC_STATUS = ("PENDING", "APPROVED", "REVISION", "REJECTED")
COMPANY_STATUS = ("PENDING_APPROVAL", "APPROVED")
DRIVE_STATUS = ("DRAFT", "OPEN", "FROZEN", "CLOSED")
STAGES = ("APPLIED", "UNDER_REVIEW", "SHORTLISTED", "ASSESSMENT", "INTERVIEW", "OFFERED", "REJECTED", "WITHDRAWN")
TICKET_TYPES = ("CORRECTION", "UNFREEZE")
TICKET_STATUS = ("OPEN", "APPROVED", "REJECTED")
INVITE_STATUS = ("NOT_INVITED", "INVITED", "REGISTERED", "DECLINED")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


TS = DateTime(timezone=True)

# ---------------------------------------------------------------------------
# 1. users — every account that can sign in (students and staff)
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(_in("role", ROLES), name="ck_users_role"),
        CheckConstraint("email = lower(email)", name="ck_users_email_lower"),
    )

    email: Mapped[str] = mapped_column(String(254), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(16))
    title: Mapped[str | None] = mapped_column(String(120))
    can_verify: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    password_hash: Mapped[str | None] = mapped_column(String(255))
    # A student SPOC keeps dual context: staff workspace + their own student profile.
    linked_student_roll: Mapped[str | None] = mapped_column(
        ForeignKey("students.roll", use_alter=True, name="fk_users_linked_student", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(TS)


# ---------------------------------------------------------------------------
# 2. students — Profile Audit record (self-submitted, verifier-locked)
# ---------------------------------------------------------------------------


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (
        CheckConstraint(_in("verification", VERIFICATION), name="ck_students_verification"),
        CheckConstraint(_in("placement", PLACEMENT), name="ck_students_placement"),
        CheckConstraint("cgpa IS NULL OR (cgpa >= 0 AND cgpa <= 10)", name="ck_students_cgpa"),
        CheckConstraint("class10 IS NULL OR (class10 >= 0 AND class10 <= 100)", name="ck_students_class10"),
        CheckConstraint("class12 IS NULL OR (class12 >= 0 AND class12 <= 100)", name="ck_students_class12"),
        CheckConstraint("backlogs >= 0", name="ck_students_backlogs"),
        CheckConstraint("NOT (locked AND verification <> 'VERIFIED')", name="ck_students_lock_requires_verified"),
        Index("ix_students_verification", "verification"),
        Index("ix_students_branch", "branch"),
    )

    roll: Mapped[str] = mapped_column(String(16), primary_key=True)
    user_email: Mapped[str] = mapped_column(ForeignKey("users.email", ondelete="RESTRICT"), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(32))
    degree: Mapped[str | None] = mapped_column(String(16))
    branch: Mapped[str | None] = mapped_column(String(8))
    grad_year: Mapped[int | None] = mapped_column(Integer)
    cgpa: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    sem_cgpa: Mapped[list[Decimal]] = mapped_column(ARRAY(Numeric(4, 2)), default=list, server_default=text("'{}'"))
    class10: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    class12: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    backlogs: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    skills: Mapped[list[str]] = mapped_column(ARRAY(String(60)), default=list, server_default=text("'{}'"))
    verification: Mapped[str] = mapped_column(String(16), default="NOT_SUBMITTED", server_default="NOT_SUBMITTED")
    locked: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    verified_by: Mapped[str | None] = mapped_column(String(120))
    verified_by_email: Mapped[str | None] = mapped_column(ForeignKey("users.email", ondelete="SET NULL"))
    verified_at: Mapped[datetime | None] = mapped_column(TS)
    submitted_at: Mapped[datetime | None] = mapped_column(TS)
    revision_reason: Mapped[str | None] = mapped_column(Text)
    placement: Mapped[str] = mapped_column(String(16), default="UNPLACED", server_default="UNPLACED")
    placed_company: Mapped[str | None] = mapped_column(String(120))
    placed_drive_id: Mapped[str | None] = mapped_column(
        ForeignKey("placement_drives.drive_id", use_alter=True, name="fk_students_placed_drive", ondelete="SET NULL")
    )
    # Values the verifier read off the proof documents ("As per proof" column).
    proof: Mapped[dict] = mapped_column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
    default_resume_id: Mapped[str | None] = mapped_column(
        ForeignKey("documents.doc_id", use_alter=True, name="fk_students_default_resume", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=func.now(), onupdate=func.now())

    user: Mapped[User] = relationship(foreign_keys=[user_email])


# ---------------------------------------------------------------------------
# 3. documents — Document Vault (academic proofs) + Resume Repository
# ---------------------------------------------------------------------------


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        CheckConstraint(_in("doc_type", DOC_TYPES), name="ck_documents_type"),
        CheckConstraint(_in("status", DOC_STATUS), name="ck_documents_status"),
        CheckConstraint("size_bytes >= 0", name="ck_documents_size"),
        CheckConstraint("NOT is_default OR doc_type = 'RESUME'", name="ck_documents_default_is_resume"),
        # At most one proof per academic document type per student (a re-upload replaces it).
        Index(
            "uq_documents_one_academic_per_type",
            "roll",
            "doc_type",
            unique=True,
            postgresql_where=text("doc_type IN ('GRADE_CARD', 'CLASS10', 'CLASS12')"),
        ),
        # At most one default resume per student (used by 1-click apply).
        Index("uq_documents_one_default_resume", "roll", unique=True, postgresql_where=text("is_default")),
        Index("ix_documents_status", "status"),
    )

    doc_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    roll: Mapped[str] = mapped_column(ForeignKey("students.roll", ondelete="CASCADE"), index=True)
    doc_type: Mapped[str] = mapped_column(String(16))
    label: Mapped[str | None] = mapped_column(String(120))
    file_name: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    file_path: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="PENDING", server_default="PENDING")
    remarks: Mapped[str] = mapped_column(Text, default="", server_default="")
    claimed_value: Mapped[str | None] = mapped_column(String(64))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    uploaded_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    reviewed_by: Mapped[str | None] = mapped_column(String(120))
    reviewed_at: Mapped[datetime | None] = mapped_column(TS)


# ---------------------------------------------------------------------------
# 4. companies — recruiters approved by CCPC, each managed by one SPOC
# ---------------------------------------------------------------------------


class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (
        CheckConstraint(_in("status", COMPANY_STATUS), name="ck_companies_status"),
        Index("uq_companies_name_ci", func.lower(text("name")), unique=True),
    )

    company_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    industry: Mapped[str | None] = mapped_column(String(120))
    website: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    contact_name: Mapped[str | None] = mapped_column(String(120))
    recruiter_email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str | None] = mapped_column(String(32))
    assigned_spoc: Mapped[str | None] = mapped_column(ForeignKey("users.email", ondelete="SET NULL"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="APPROVED", server_default="APPROVED")
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    approved_at: Mapped[datetime | None] = mapped_column(TS)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())


# ---------------------------------------------------------------------------
# 5. placement_drives — Job Announcement Forms (JAF) with eligibility rules
# ---------------------------------------------------------------------------


class Drive(Base):
    __tablename__ = "placement_drives"
    __table_args__ = (
        CheckConstraint(_in("status", DRIVE_STATUS), name="ck_drives_status"),
        CheckConstraint("ctc > 0", name="ck_drives_ctc_positive"),
        CheckConstraint("min_cgpa IS NULL OR (min_cgpa >= 0 AND min_cgpa <= 10)", name="ck_drives_min_cgpa"),
        CheckConstraint("max_backlogs IS NULL OR max_backlogs >= 0", name="ck_drives_max_backlogs"),
        Index("ix_drives_status_close", "status", "close_at"),
    )

    drive_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.company_id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(160))
    ctc: Mapped[Decimal] = mapped_column(Numeric(7, 2))  # LPA
    location: Mapped[str | None] = mapped_column(String(120))
    category: Mapped[str | None] = mapped_column(String(60))
    description: Mapped[str | None] = mapped_column(Text)
    min_cgpa: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    allowed_branches: Mapped[list[str]] = mapped_column(ARRAY(String(8)), default=list, server_default=text("'{}'"))
    max_backlogs: Mapped[int | None] = mapped_column(Integer)
    grad_years: Mapped[list[int]] = mapped_column(ARRAY(Integer), default=list, server_default=text("'{}'"))
    degrees: Mapped[list[str]] = mapped_column(ARRAY(String(16)), default=list, server_default=text("'{}'"))
    skills: Mapped[list[str]] = mapped_column(ARRAY(String(60)), default=list, server_default=text("'{}'"))
    close_at: Mapped[datetime] = mapped_column(TS)  # single source of truth for the countdown
    status: Mapped[str] = mapped_column(String(10), default="DRAFT", server_default="DRAFT")
    created_by: Mapped[str | None] = mapped_column(String(120))
    created_by_email: Mapped[str | None] = mapped_column(ForeignKey("users.email", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=func.now(), onupdate=func.now())

    company: Mapped[Company] = relationship()


# ---------------------------------------------------------------------------
# 6. applications — student x drive (many-to-many) with a forward-only pipeline
# ---------------------------------------------------------------------------


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        # Database-level guard against duplicate applications to the same drive.
        UniqueConstraint("drive_id", "roll", name="uq_applications_drive_roll"),
        CheckConstraint(_in("stage", STAGES), name="ck_applications_stage"),
        Index("ix_applications_roll_stage", "roll", "stage"),
    )

    application_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    drive_id: Mapped[str] = mapped_column(ForeignKey("placement_drives.drive_id", ondelete="CASCADE"), index=True)
    roll: Mapped[str] = mapped_column(ForeignKey("students.roll", ondelete="CASCADE"))
    resume_doc_id: Mapped[str | None] = mapped_column(ForeignKey("documents.doc_id", ondelete="SET NULL"))
    stage: Mapped[str] = mapped_column(String(16), default="APPLIED", server_default="APPLIED")
    applied_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())

    events: Mapped[list[ApplicationEvent]] = relationship(
        order_by="ApplicationEvent.event_id", cascade="all, delete-orphan", back_populates="application"
    )


class ApplicationEvent(Base):
    """Stage history of an application (timeline shown to students and SPOCs)."""

    __tablename__ = "application_events"
    __table_args__ = (CheckConstraint(_in("stage", STAGES), name="ck_app_events_stage"),)

    event_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    application_id: Mapped[str] = mapped_column(
        ForeignKey("applications.application_id", ondelete="CASCADE"), index=True
    )
    stage: Mapped[str] = mapped_column(String(16))
    at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    actor: Mapped[str | None] = mapped_column(String(120))
    note: Mapped[str] = mapped_column(Text, default="", server_default="")

    application: Mapped[Application] = relationship(back_populates="events")


# ---------------------------------------------------------------------------
# 7. unfreeze_tickets — correction / unfreeze requests governed by CCPC
# ---------------------------------------------------------------------------


class Ticket(Base):
    __tablename__ = "unfreeze_tickets"
    __table_args__ = (
        CheckConstraint(_in("ticket_type", TICKET_TYPES), name="ck_tickets_type"),
        CheckConstraint(_in("status", TICKET_STATUS), name="ck_tickets_status"),
        CheckConstraint("char_length(justification) >= 20", name="ck_tickets_justification_len"),
        # Only one open ticket per student at a time.
        Index("uq_tickets_one_open_per_student", "roll", unique=True, postgresql_where=text("status = 'OPEN'")),
    )

    ticket_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    roll: Mapped[str] = mapped_column(ForeignKey("students.roll", ondelete="CASCADE"), index=True)
    ticket_type: Mapped[str] = mapped_column(String(16))
    field: Mapped[str] = mapped_column(String(32))
    field_label: Mapped[str] = mapped_column(String(60))
    current_value: Mapped[str] = mapped_column(Text, default="")
    requested_value: Mapped[str] = mapped_column(Text, default="")
    justification: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default="OPEN", server_default="OPEN")
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(TS)
    resolved_by: Mapped[str | None] = mapped_column(String(120))
    resolution: Mapped[str] = mapped_column(Text, default="", server_default="")


# ---------------------------------------------------------------------------
# 8. audit_logs — append-only (UPDATE/DELETE blocked by a trigger, see init_db.py)
# ---------------------------------------------------------------------------


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_ts", "ts"), Index("ix_audit_logs_actor_email", "actor_email"))

    log_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    actor: Mapped[str] = mapped_column(String(120))
    actor_email: Mapped[str | None] = mapped_column(String(254))
    actor_role: Mapped[str] = mapped_column(String(16))
    entity: Mapped[str] = mapped_column(String(40))
    action_type: Mapped[str] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(Text)


# ---------------------------------------------------------------------------
# Supporting tables
# ---------------------------------------------------------------------------


class Invitation(Base):
    """Fee-paid student list from the Academic Section and the onboarding invitation state."""

    __tablename__ = "invitations"
    __table_args__ = (CheckConstraint(_in("status", INVITE_STATUS), name="ck_invitations_status"),)

    invitation_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    entry_no: Mapped[str] = mapped_column(String(16), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    branch: Mapped[str | None] = mapped_column(String(8))
    degree: Mapped[str | None] = mapped_column(String(16))
    fee_paid: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    status: Mapped[str] = mapped_column(String(16), default="NOT_INVITED", server_default="NOT_INVITED")
    invite_token: Mapped[str | None] = mapped_column(String(64), unique=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(TS)
    roll: Mapped[str | None] = mapped_column(ForeignKey("students.roll", ondelete="SET NULL"))
    updated_at: Mapped[datetime | None] = mapped_column(TS)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_roll_created", "roll", "created_at"),)

    notification_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    roll: Mapped[str] = mapped_column(ForeignKey("students.roll", ondelete="CASCADE"))
    message: Mapped[str] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(255))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
