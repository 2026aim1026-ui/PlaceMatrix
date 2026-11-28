"""Apply pending database migrations (non-destructive; existing data is kept).

    python -m app.migrate            # apply pending migrations
    python -m app.migrate --status   # list migrations and when each was applied
"""

from __future__ import annotations

import argparse
import logging

from .migrations import run_migrations, status


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--status", action="store_true", help="only show migration status")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    if not args.status:
        applied = run_migrations()
        print(f"Applied: {', '.join(applied)}" if applied else "Database is already up to date.")
    for version, name, at in status():
        print(f"  {version}  {'applied ' + at[:19] if at else 'PENDING':<28}  {name}")


if __name__ == "__main__":
    main()
