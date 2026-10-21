from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    picture: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="STUDENT")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    applications: Mapped[list["Application"]] = relationship(back_populates="student")

class Drive(Base):
    __tablename__ = "drives"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company: Mapped[str] = mapped_column(String(160), index=True)
    job_title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    package_lpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_cgpa: Mapped[float] = mapped_column(Float, default=0)
    eligible_departments: Mapped[str] = mapped_column(String(500), default="")
    deadline: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", index=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    applications: Mapped[list["Application"]] = relationship(back_populates="drive", cascade="all, delete-orphan")

class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("student_id", "drive_id", name="uq_student_drive_application"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    drive_id: Mapped[int] = mapped_column(ForeignKey("drives.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="APPLIED")
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    student: Mapped[User] = relationship(back_populates="applications")
    drive: Mapped[Drive] = relationship(back_populates="applications")

class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(80))
    details: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
