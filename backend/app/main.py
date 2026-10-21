from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .config import settings
from .database import Base, engine, get_db
from .models import Application, AuditEvent, Drive, User
from .schemas import ApplicationOut, AuthOut, DriveCreate, DriveOut, GoogleCredential, UserOut
from .security import create_access_token, get_current_user, require_roles, verify_google_credential, role_for_email

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="PlaceMatrix API", version="1.0.0", description="Campus placement portal API with IIT Ropar Google authentication.", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_credentials=True, allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "service": "placematrix-api"}

@app.post("/api/auth/google", response_model=AuthOut, tags=["Authentication"])
def google_login(body: GoogleCredential, db: Session = Depends(get_db)):
    identity = verify_google_credential(body.credential)
    user = db.scalar(select(User).where(User.email == identity["email"]))
    expected_role = role_for_email(identity["email"])
    if user is None:
        user = User(email=identity["email"], name=identity["name"], picture=identity["picture"], role=expected_role)
        db.add(user)
    else:
        user.name = identity["name"]
        user.picture = identity["picture"]
        # Role is sourced from server-side allowlists, never from a client request.
        user.role = expected_role
    db.commit(); db.refresh(user)
    return {"access_token": create_access_token(user), "user": user}

@app.get("/api/auth/me", response_model=UserOut, tags=["Authentication"])
def who_am_i(user: User = Depends(get_current_user)):
    return user

@app.get("/api/drives", response_model=list[DriveOut], tags=["Drives"])
def list_drives(status_filter: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Drive)
    if user.role == "STUDENT":
        query = query.where(Drive.status == "OPEN")
    elif status_filter:
        if status_filter not in {"DRAFT", "OPEN", "FROZEN", "CLOSED"}:
            raise HTTPException(status_code=400, detail="Invalid drive status filter.")
        query = query.where(Drive.status == status_filter)
    drives = db.scalars(query.order_by(Drive.created_at.desc())).all()
    return [{**{c.name: getattr(d, c.name) for c in d.__table__.columns}, "eligible_departments": [x for x in d.eligible_departments.split(",") if x]} for d in drives]

@app.post("/api/drives", response_model=DriveOut, status_code=status.HTTP_201_CREATED, tags=["Drives"])
def create_drive(body: DriveCreate, db: Session = Depends(get_db), user: User = Depends(require_roles("CCPC", "SPOC"))):
    drive = Drive(company=body.company.strip(), job_title=body.job_title.strip(), description=body.description,
        package_lpa=body.package_lpa, min_cgpa=body.min_cgpa, eligible_departments=",".join(body.eligible_departments),
        deadline=body.deadline, status=body.status, created_by_id=user.id)
    db.add(drive); db.flush()
    db.add(AuditEvent(actor_id=user.id, action="DRIVE_CREATED", entity_type="drive", entity_id=str(drive.id), details=json.dumps({"company": drive.company, "job_title": drive.job_title})))
    db.commit(); db.refresh(drive)
    return {**{c.name: getattr(drive, c.name) for c in drive.__table__.columns}, "eligible_departments": [x for x in drive.eligible_departments.split(",") if x]}

@app.patch("/api/drives/{drive_id}", response_model=DriveOut, tags=["Drives"])
def update_drive(drive_id: int, body: DriveCreate, db: Session = Depends(get_db), user: User = Depends(require_roles("CCPC", "SPOC"))):
    drive = db.get(Drive, drive_id)
    if not drive: raise HTTPException(status_code=404, detail="Placement drive not found.")
    for field in ("company", "job_title", "description", "package_lpa", "min_cgpa", "deadline", "status"):
        setattr(drive, field, getattr(body, field))
    drive.eligible_departments = ",".join(body.eligible_departments)
    db.add(AuditEvent(actor_id=user.id, action="DRIVE_UPDATED", entity_type="drive", entity_id=str(drive.id), details="Drive fields updated"))
    db.commit(); db.refresh(drive)
    return {**{c.name: getattr(drive, c.name) for c in drive.__table__.columns}, "eligible_departments": [x for x in drive.eligible_departments.split(",") if x]}

@app.post("/api/applications/{drive_id}", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED, tags=["Applications"])
def apply_to_drive(drive_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles("STUDENT"))):
    drive = db.get(Drive, drive_id)
    if not drive or drive.status != "OPEN": raise HTTPException(status_code=404, detail="This placement drive is not open.")
    if datetime.now(timezone.utc).date().isoformat() > (drive.deadline or "9999-12-31")[:10]:
        raise HTTPException(status_code=400, detail="The application deadline has passed.")
    existing = db.scalar(select(Application).where(Application.student_id == user.id, Application.drive_id == drive.id))
    if existing: raise HTTPException(status_code=409, detail="You have already applied to this drive.")
    application = Application(student_id=user.id, drive_id=drive.id)
    db.add(application); db.flush()
    db.add(AuditEvent(actor_id=user.id, action="APPLICATION_SUBMITTED", entity_type="application", entity_id=str(application.id), details=json.dumps({"drive_id": drive.id})))
    try: db.commit()
    except IntegrityError:
        db.rollback(); raise HTTPException(status_code=409, detail="You have already applied to this drive.")
    db.refresh(application)
    return {"id": application.id, "student_id": application.student_id, "drive_id": application.drive_id, "status": application.status, "applied_at": application.applied_at.isoformat(), "company": drive.company, "job_title": drive.job_title}

@app.get("/api/applications/me", response_model=list[ApplicationOut], tags=["Applications"])
def my_applications(db: Session = Depends(get_db), user: User = Depends(require_roles("STUDENT"))):
    rows = db.scalars(select(Application).where(Application.student_id == user.id).order_by(Application.applied_at.desc())).all()
    return [{"id": a.id, "student_id": a.student_id, "drive_id": a.drive_id, "status": a.status, "applied_at": a.applied_at.isoformat(), "company": a.drive.company, "job_title": a.drive.job_title} for a in rows]

@app.get("/api/admin/users", response_model=list[UserOut], tags=["Administration"])
def list_users(db: Session = Depends(get_db), user: User = Depends(require_roles("CCPC", "VERIFIER"))):
    return db.scalars(select(User).order_by(User.name)).all()

@app.get("/api/admin/audit", tags=["Administration"])
def audit_log(db: Session = Depends(get_db), user: User = Depends(require_roles("CCPC", "VERIFIER"))):
    events = db.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(200)).all()
    return [{"id": e.id, "actor_id": e.actor_id, "action": e.action, "entity_type": e.entity_type, "entity_id": e.entity_id, "details": e.details, "created_at": e.created_at.isoformat()} for e in events]
