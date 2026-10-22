from datetime import datetime, timedelta, timezone
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db
from .models import User

bearer = HTTPBearer(auto_error=False)

def role_for_email(email: str) -> str:
    email = email.lower()
    if email in settings.email_set(settings.ccpc_emails): return "CCPC"
    if email in settings.email_set(settings.verifier_emails): return "VERIFIER"
    if email in settings.email_set(settings.spoc_emails): return "SPOC"
    return "STUDENT"

def verify_google_credential(credential: str) -> dict:
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured. Set GOOGLE_CLIENT_ID in backend/.env.")
    try:
        info = id_token.verify_oauth2_token(credential, requests.Request(), settings.google_client_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Google sign-in token is invalid or expired.")
    email = str(info.get("email", "")).strip().lower()
    if not info.get("email_verified"):
        raise HTTPException(status_code=403, detail="Your Google email must be verified.")
    # Check both the verified email suffix and Google's hosted-domain claim. Never trust frontend-only checks.
    if not email.endswith("@iitrpr.ac.in") or info.get("hd") != "iitrpr.ac.in":
        raise HTTPException(status_code=403, detail="Only verified @iitrpr.ac.in Google accounts can sign in.")
    return {"email": email, "name": info.get("name") or email.split("@")[0], "picture": info.get("picture")}

def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user.id), "email": user.email, "role": user.role,
               "iat": now, "exp": now + timedelta(minutes=settings.token_expiry_minutes)}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Sign in with your IIT Ropar Google account first.")
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Session is invalid or expired. Sign in again.")
    user = db.get(User, user_id)
    if not user or not user.email.endswith("@iitrpr.ac.in"):
        raise HTTPException(status_code=401, detail="Account not found. Sign in again.")
    return user

def require_roles(*roles: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")
        return user
    return dependency
