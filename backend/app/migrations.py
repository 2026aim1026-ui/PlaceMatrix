"""Versioned, non-destructive schema migrations for PlaceMatrix.

    python -m app.migrate            # apply pending migrations (safe to run any number of times)
    python -m app.migrate --status   # show which migrations are applied

Every migration is additive (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS) and runs inside its own
transaction, so existing students, drives, applications and history are preserved. Applied versions are
recorded in the `schema_migrations` table. A PostgreSQL advisory lock stops two processes from migrating at
the same time. The API also applies pending migrations at start-up (AUTO_MIGRATE=true, the default).
"""

from __future__ import annotations

import hashlib
import logging
import shutil
from collections.abc import Callable
from pathlib import Path

from sqlalchemy import Connection, inspect, text

from . import models as M
from .config import settings
from .database import Base, engine

logger = logging.getLogger("placematrix.migrations")
LOCK_KEY = 7_270_2026  # arbitrary constant for pg_advisory_lock

# ---------------------------------------------------------------------------------------------
# SQL building blocks
# ---------------------------------------------------------------------------------------------

AUDIT_TRIGGER_SQL = """
CREATE OR REPLACE FUNCTION audit_logs_block_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON audit_logs;
CREATE TRIGGER trg_audit_logs_append_only
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();
"""

PROFILE_STATE_VIEW_SQL = """
CREATE OR REPLACE VIEW v_student_profile_state AS
SELECT s.roll,
       s.name,
       CASE
           WHEN s.placement = 'PLACED' THEN 'POLICY_LOCKED'
           WHEN s.verification = 'VERIFIED' AND s.locked THEN 'VERIFIED_LOCKED'
           WHEN s.verification = 'PENDING' THEN 'PENDING_VERIFICATION'
           WHEN s.verification = 'REVISION' AND s.revision_reason LIKE 'Unfrozen%' THEN 'UNFROZEN_EDITING'
           WHEN s.verification IN ('REVISION', 'REJECTED') THEN 'REVISION_REQUIRED'
           ELSE 'DRAFT'
       END AS profile_state
FROM students s;
"""

# Tables whose changes must reach open browsers. A statement-level trigger sends a NOTIFY on the
# `pm_changes` channel after every committed INSERT / UPDATE / DELETE / TRUNCATE — including changes made
# directly in psql or pgAdmin. The API listens on that channel and bumps pm_sync.version (see realtime.py).
SYNCED_TABLES = (
    "users", "students", "documents", "companies", "placement_drives", "applications", "application_events",
    "unfreeze_tickets", "audit_logs", "invitations", "notifications", "assignment_history", "email_logs",
)

SYNC_SQL = """
CREATE TABLE IF NOT EXISTS pm_sync (
    id          smallint PRIMARY KEY CHECK (id = 1),
    version     bigint NOT NULL DEFAULT 0,
    changed_at  timestamptz,
    last_tables text
);
INSERT INTO pm_sync (id, version) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION pm_notify_change() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('pm_changes', TG_TABLE_NAME);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
"""


def _install_change_triggers(conn: Connection) -> None:
    conn.execute(text(SYNC_SQL))
    for table in SYNCED_TABLES:
        conn.execute(text(f"DROP TRIGGER IF EXISTS trg_{table}_notify ON {table}"))
        conn.execute(text(
            f"CREATE TRIGGER trg_{table}_notify AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON {table} "
            "FOR EACH STATEMENT EXECUTE FUNCTION pm_notify_change()"
        ))


def _constraint_exists(conn: Connection, name: str) -> bool:
    return conn.execute(text("SELECT 1 FROM pg_constraint WHERE conname = :n"), {"n": name}).first() is not None


# ---------------------------------------------------------------------------------------------
# Resume snapshots (shared with the application code)
# ---------------------------------------------------------------------------------------------


def snapshot_resume_file(source_rel: str | None, application_id: str, file_name: str) -> tuple[str | None, str | None, int | None]:
    """Copy a resume into uploads/submissions/<application_id>/ and return (relative path, sha256, size)."""
    if not source_rel:
        return None, None, None
    src = (settings.upload_dir / source_rel).resolve()
    if settings.upload_dir not in src.parents or not src.exists():
        return None, None, None
    data = src.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    folder = settings.upload_dir / "submissions" / application_id
    folder.mkdir(parents=True, exist_ok=True)
    suffix = Path(file_name).suffix.lower() or src.suffix or ".pdf"
    dest = folder / f"{digest[:16]}{suffix}"
    if not dest.exists():
        shutil.copyfile(src, dest)
    return str(dest.relative_to(settings.upload_dir)), digest, len(data)


# ---------------------------------------------------------------------------------------------
# Migrations
# ---------------------------------------------------------------------------------------------

ORIGINAL_TABLES = [M.User.__table__, M.Student.__table__, M.Document.__table__, M.Company.__table__, M.Drive.__table__,
                   M.Application.__table__, M.ApplicationEvent.__table__, M.Ticket.__table__, M.AuditLog.__table__,
                   M.Invitation.__table__, M.Notification.__table__]


def m0001_baseline(conn: Connection) -> None:
    """The original 11-table schema, append-only audit trigger and profile-state view."""
    Base.metadata.create_all(conn, tables=ORIGINAL_TABLES, checkfirst=True)
    conn.execute(text(AUDIT_TRIGGER_SQL))
    conn.execute(text(PROFILE_STATE_VIEW_SQL))


def m0002_recruitment_email_resumes(conn: Connection) -> None:
    """Recruitment verifier assignment + history, SMTP email logs, resume versions, per-application
    resume snapshots and the live-sync change triggers."""
    Base.metadata.create_all(conn, tables=[M.AssignmentHistory.__table__, M.EmailLog.__table__], checkfirst=True)

    conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS assigned_verifier VARCHAR(254)"))
    if not _constraint_exists(conn, "fk_companies_assigned_verifier"):
        conn.execute(text("ALTER TABLE companies ADD CONSTRAINT fk_companies_assigned_verifier "
                          "FOREIGN KEY (assigned_verifier) REFERENCES users (email) ON DELETE SET NULL"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_companies_assigned_verifier ON companies (assigned_verifier)"))

    conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1"))

    for column, ddl in (("resume_label", "VARCHAR(120)"), ("resume_file_name", "VARCHAR(255)"),
                        ("resume_file_type", "VARCHAR(64)"), ("resume_size", "INTEGER"), ("resume_sha256", "VARCHAR(64)"),
                        ("resume_version", "INTEGER"), ("resume_snapshot_path", "TEXT"),
                        ("resume_submitted_at", "TIMESTAMP WITH TIME ZONE")):
        conn.execute(text(f"ALTER TABLE applications ADD COLUMN IF NOT EXISTS {column} {ddl}"))

    _install_change_triggers(conn)

    # Backfill: give every existing application a frozen copy of the resume it was submitted with.
    rows = conn.execute(text(
        "SELECT a.application_id, a.applied_at, d.label, d.file_name, d.file_type, d.file_path, d.version "
        "FROM applications a JOIN documents d ON d.doc_id = a.resume_doc_id "
        "WHERE a.resume_snapshot_path IS NULL"
    )).all()
    for app_id, applied_at, label, file_name, file_type, file_path, version in rows:
        rel, digest, size = snapshot_resume_file(file_path, app_id, file_name)
        conn.execute(text(
            "UPDATE applications SET resume_label = :label, resume_file_name = :fn, resume_file_type = :ft, "
            "resume_size = :size, resume_sha256 = :sha, resume_version = :ver, resume_snapshot_path = :path, "
            "resume_submitted_at = :at WHERE application_id = :id"
        ), {"label": label, "fn": file_name, "ft": file_type, "size": size, "sha": digest, "ver": version or 1,
            "path": rel, "at": applied_at, "id": app_id})
    if rows:
        logger.info("Backfilled resume snapshots for %d application(s)", len(rows))


def m0003_rename_ccpc_to_cdpc(conn: Connection) -> None:
    """The admin role is CDPC (Career Development & Placement Centre), not CCPC. Rename the stored role value
    and the default title/name text of admin accounts. Email addresses are left untouched (they are real
    accounts), and audit_logs keeps its historical rows as written (the table is append-only)."""
    if _constraint_exists(conn, "ck_users_role"):
        conn.execute(text("ALTER TABLE users DROP CONSTRAINT ck_users_role"))
    conn.execute(text("UPDATE users SET role = 'CDPC' WHERE role = 'CCPC'"))
    conn.execute(text("UPDATE users SET title = replace(title, 'CCPC', 'CDPC') WHERE title LIKE '%CCPC%'"))
    conn.execute(text("UPDATE users SET name = replace(name, 'CCPC', 'CDPC') WHERE name LIKE '%CCPC%'"))
    conn.execute(text("ALTER TABLE users ADD CONSTRAINT ck_users_role "
                      "CHECK (role IN ('STUDENT', 'VERIFIER', 'SPOC', 'CDPC'))"))


MIGRATIONS: list[tuple[str, str, Callable[[Connection], None]]] = [
    ("0001", "baseline schema", m0001_baseline),
    ("0002", "recruitment assignments, email logs, resume snapshots, live sync", m0002_recruitment_email_resumes),
    ("0003", "rename admin role CCPC to CDPC", m0003_rename_ccpc_to_cdpc),
]


# ---------------------------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------------------------


def applied_versions(conn: Connection) -> dict[str, str]:
    if not inspect(conn).has_table("schema_migrations"):
        return {}
    return {v: str(at) for v, at in conn.execute(text("SELECT version, applied_at FROM schema_migrations"))}


def run_migrations() -> list[str]:
    """Apply every pending migration in order. Returns the versions applied now."""
    done: list[str] = []
    with engine.connect() as conn:
        conn.execute(text("SELECT pg_advisory_lock(:k)"), {"k": LOCK_KEY})
        conn.commit()
        try:
            with conn.begin():
                conn.execute(text(
                    "CREATE TABLE IF NOT EXISTS schema_migrations ("
                    " version VARCHAR(16) PRIMARY KEY, name TEXT NOT NULL,"
                    " applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now())"
                ))
            already = applied_versions(conn)
            conn.commit()
            for version, name, fn in MIGRATIONS:
                if version in already:
                    continue
                with conn.begin():
                    fn(conn)
                    conn.execute(text("INSERT INTO schema_migrations (version, name) VALUES (:v, :n)"),
                                 {"v": version, "n": name})
                logger.info("Applied migration %s — %s", version, name)
                done.append(version)
        finally:
            conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_KEY})
            conn.commit()
    return done


def status() -> list[tuple[str, str, str | None]]:
    with engine.connect() as conn:
        applied = applied_versions(conn)
    return [(v, n, applied.get(v)) for v, n, _ in MIGRATIONS]
