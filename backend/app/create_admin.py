"""Create the first CCPC admin on an empty (production) database.

    python -m app.create_admin you@iitrpr.ac.in "Your Name"

Run `python -m app.init_db` first. The password is asked interactively (min 8 characters).
If the admin signs in with Google only, any strong random password is fine.
"""

from __future__ import annotations

import getpass
import sys

from .config import settings
from .database import SessionLocal
from .models import User
from .security import hash_password


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit('Usage: python -m app.create_admin <email> "<Full Name>"')
    email, name = sys.argv[1].strip().lower(), sys.argv[2].strip()
    if not settings.email_allowed(email):
        sys.exit(f"Email must end with @{settings.allowed_email_domain}")
    password = getpass.getpass("Password (min 8 chars): ")
    if len(password) < 8:
        sys.exit("Password must be at least 8 characters.")
    with SessionLocal() as db:
        user = db.get(User, email)
        if user is None:
            user = User(email=email, name=name, role="CCPC", title="CCPC Administrator", can_verify=True, is_active=True)
            db.add(user)
        else:
            user.role, user.can_verify, user.is_active = "CCPC", True, True
        user.password_hash = hash_password(password)
        db.commit()
    print(f"CCPC admin ready: {email}")


if __name__ == "__main__":
    main()
