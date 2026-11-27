"""Live database sync.

Every PlaceMatrix table has a statement-level trigger that sends `NOTIFY pm_changes, '<table>'` when a
change COMMITS — whether it came from the API, psql, pgAdmin or a script. This module keeps one LISTEN
connection open in a background thread and bumps `pm_sync.version` whenever notifications arrive.
Browsers poll GET /api/sync (cheap) and re-fetch GET /api/state only when that version changes, so direct
database edits appear on the website within a few seconds.
"""

from __future__ import annotations

import logging
import threading
import time

import psycopg
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import engine

logger = logging.getLogger("placematrix.realtime")

_stop = threading.Event()
_thread: threading.Thread | None = None
status = {"listening": False, "last_change": None, "last_tables": [], "error": None}


def _dsn() -> str:
    return engine.url.set(drivername="postgresql").render_as_string(hide_password=False)


def _bump(conn: psycopg.Connection, tables: set[str]) -> None:
    conn.execute(
        "UPDATE pm_sync SET version = version + 1, changed_at = now(), last_tables = %s WHERE id = 1",
        (",".join(sorted(tables))[:500],),
    )
    status["last_change"] = time.time()
    status["last_tables"] = sorted(tables)


def _run() -> None:
    backoff = 1.0
    while not _stop.is_set():
        try:
            with psycopg.connect(_dsn(), autocommit=True) as conn:
                conn.execute("LISTEN pm_changes")
                status.update(listening=True, error=None)
                logger.info("Live sync: listening for database changes")
                backoff = 1.0
                while not _stop.is_set():
                    tables = {n.payload for n in conn.notifies(timeout=1.0)}
                    if tables:
                        _bump(conn, tables)
        except Exception as exc:  # database restarted, network blip...
            status.update(listening=False, error=str(exc)[:200])
            if _stop.is_set():
                break
            logger.warning("Live sync listener stopped (%s); retrying in %.0fs", exc, backoff)
            _stop.wait(backoff)
            backoff = min(backoff * 2, 30)
    status["listening"] = False


def start() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_run, name="pm-live-sync", daemon=True)
    _thread.start()


def stop() -> None:
    _stop.set()


def current_version(db: Session) -> str:
    """Version string compared by the browser. Combines the DB change counter (covers direct SQL edits)
    with the newest audit-log id (covers API writes even if the listener is not running)."""
    try:
        row = db.execute(text(
            "SELECT (SELECT version FROM pm_sync WHERE id = 1), (SELECT coalesce(max(log_id), 0) FROM audit_logs)"
        )).first()
        return f"{row[0] or 0}.{row[1]}"
    except Exception:
        db.rollback()
        audit = db.execute(text("SELECT coalesce(max(log_id), 0) FROM audit_logs")).scalar()
        return f"0.{audit}"
