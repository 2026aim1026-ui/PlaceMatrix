"""Create (or recreate) the PlaceMatrix schema.

    python -m app.init_db            # create missing tables + triggers
    python -m app.init_db --drop     # drop everything first (destroys data)
"""

from __future__ import annotations

import argparse

from sqlalchemy import text

from . import models  # noqa: F401  (registers tables on Base.metadata)
from .database import Base, engine

# The audit trail must be append-only: block UPDATE and DELETE at the database level.
# TRUNCATE (used only by the demo reset) is a statement-level operation and is not affected.
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

# Convenience view for reporting: the report's state machine for each student profile.
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


def create_schema(drop: bool = False) -> None:
    with engine.begin() as conn:
        if drop:
            conn.execute(text("DROP VIEW IF EXISTS v_student_profile_state"))
            Base.metadata.drop_all(conn)
            conn.execute(text("DROP FUNCTION IF EXISTS audit_logs_block_mutation() CASCADE"))
        Base.metadata.create_all(conn)
        conn.execute(text(AUDIT_TRIGGER_SQL))
        conn.execute(text(PROFILE_STATE_VIEW_SQL))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--drop", action="store_true", help="drop all tables first (destroys data)")
    args = parser.parse_args()
    create_schema(drop=args.drop)
    print("Schema ready" + (" (recreated)" if args.drop else "") + ".")


if __name__ == "__main__":
    main()
