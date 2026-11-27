"""Create (or recreate) the PlaceMatrix schema.

    python -m app.init_db            # create missing tables + triggers (same as python -m app.migrate)
    python -m app.init_db --drop     # drop everything first (DESTROYS DATA — demo/dev only)

For an existing database always use `python -m app.migrate`: it only adds what is missing.
"""

from __future__ import annotations

import argparse

from sqlalchemy import text

from . import models  # noqa: F401  (registers tables on Base.metadata)
from .database import Base, engine
from .migrations import AUDIT_TRIGGER_SQL, PROFILE_STATE_VIEW_SQL, run_migrations  # noqa: F401  (re-exported)


def create_schema(drop: bool = False) -> None:
    if drop:
        with engine.begin() as conn:
            conn.execute(text("DROP VIEW IF EXISTS v_student_profile_state"))
            Base.metadata.drop_all(conn)
            conn.execute(text("DROP TABLE IF EXISTS schema_migrations, pm_sync"))
            conn.execute(text("DROP FUNCTION IF EXISTS audit_logs_block_mutation() CASCADE"))
            conn.execute(text("DROP FUNCTION IF EXISTS pm_notify_change() CASCADE"))
    run_migrations()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--drop", action="store_true", help="drop all tables first (destroys data)")
    args = parser.parse_args()
    create_schema(drop=args.drop)
    print("Schema ready" + (" (recreated)" if args.drop else "") + ".")


if __name__ == "__main__":
    main()
