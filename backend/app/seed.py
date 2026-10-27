"""Seed the database with the PlaceMatrix demo dataset (mirrors the original frontend seed).

    python -m app.seed            # recreate schema + load demo data (destroys existing data)

Deadlines and timestamps are generated relative to "now" so countdowns are always live.
All demo accounts use the password from DEMO_PASSWORD (default: demo123).
"""

from __future__ import annotations

import shutil
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from . import pdfgen
from .config import settings
from .database import SessionLocal, engine
from .models import (
    Application,
    ApplicationEvent,
    AuditLog,
    Company,
    Document,
    Drive,
    Invitation,
    Notification,
    Student,
    Ticket,
    User,
)
from .security import hash_password, new_invite_token

DOMAIN = settings.allowed_email_domain
HOUR = timedelta(hours=1)
DAY = timedelta(days=1)

STAFF = [
    # email, name, role, title, can_verify, linked student
    (f"ccpc@{DOMAIN}", "CCPC Office", "CCPC", "CCPC Administrator · FIC Desk", True, None),
    (f"verifier@{DOMAIN}", "Dr. Subrat Kar", "VERIFIER", "Authorized Faculty Verifier", True, None),
    (f"neha.gupta@{DOMAIN}", "Prof. Neha Gupta", "VERIFIER", "Staff Verifier", True, None),
    (f"staff.office@{DOMAIN}", "Rajesh Kumar", "VERIFIER", "Academic Section Staff (view-only)", False, None),
    (f"spoc@{DOMAIN}", "Ananya Sharma", "SPOC", "Student SPOC", False, "2026CSB1011"),
    (f"simran.kaur@{DOMAIN}", "Simran Kaur", "SPOC", "Student SPOC", False, None),
]
SPOC = {"u-spoc1": f"spoc@{DOMAIN}", "u-spoc2": f"simran.kaur@{DOMAIN}"}

STUDENT_ROWS = [
    # id, roll, name, degree, branch, cgpa, sem, c10, c12, backlogs, verification, extras
    ("s-01", "2026AIM1028", "Rohan Verma", "M.Tech", "AI", 8.42, [8.24, 8.48, 8.54], 91.2, 88.6, 0, "VERIFIED",
     {"skills": ["Python", "PyTorch", "SQL", "Machine Learning", "React"], "phone": "+91 98765 41028"}),
    ("s-02", "2026AIB1026", "Kalki Dang", "B.Tech", "AI", 9.15, [9.02, 9.1, 9.2, 9.21, 9.18, 9.2], 95.8, 95.2, 0, "VERIFIED",
     {"skills": ["Python", "C++", "PyTorch", "Distributed Systems"]}),
    ("s-03", "2026CSB1033", "Karan Mehta", "B.Tech", "CSE", 8.65, [8.4, 8.6, 8.7, 8.72, 8.7, 8.8], 92.4, 90.0, 0, "VERIFIED",
     {"skills": ["Java", "Spring", "SQL", "System Design"]}),
    ("s-04", "2026AIB1007", "Ishita Rao", "B.Tech", "AI", 8.8, [8.6, 8.7, 8.9, 8.85, 8.9, 8.85], 93.6, 92.8, 0, "VERIFIED",
     {"skills": ["Python", "TensorFlow", "SQL", "Tableau"]}),
    ("s-05", "2026EEB1015", "Aman Deep", "B.Tech", "EE", 7.4, [7.1, 7.3, 7.5, 7.4, 7.6, 7.5], 86.0, 82.4, 0, "PENDING",
     {"skills": ["MATLAB", "Verilog", "Python"]}),
    ("s-06", "2026CEB1014", "Tanvi Joshi", "B.Tech", "CE", 8.1, [7.6, 7.8, 7.9, 7.8, 7.9, 7.9], 90.2, 87.0, 0, "PENDING",
     {"skills": ["AutoCAD", "STAAD Pro", "Python"], "proof": {"cgpa": 7.82}}),
    ("s-07", "2026CSB1050", "Nikhil Bansal", "B.Tech", "CSE", 8.2, [8.0, 8.1, 8.3, 8.2, 8.25, 8.3], 89.4, 88.2, 0, "PENDING",
     {"skills": ["JavaScript", "React", "Node.js"]}),
    ("s-08", "2026EEB1031", "Pooja Rathi", "B.Tech", "EE", 7.9, [7.7, 7.8, 8.0, 7.9, 8.0, 8.0], 88.0, 89.4, 0, "REVISION",
     {"skills": ["Power Systems", "MATLAB"], "proof": {"class12": 86.4},
      "revisionReason": "Class 12 marksheet shows 86.40 % — please correct the claimed value or upload the revised marksheet."}),
    ("s-09", "2026MEB1012", "Harsh Vardhan", "B.Tech", "ME", 7.2, [6.9, 7.1, 7.2, 7.3, 7.2, 7.4], 84.6, 78.4, 1, "VERIFIED",
     {"skills": ["SolidWorks", "ANSYS", "Python"]}),
    ("s-10", "2026AIB1020", "Sana Qureshi", "B.Tech", "AI", 8.9, [8.7, 8.8, 9.0, 8.9, 9.0, 8.95], 94.0, 92.0, 0, "NOT_SUBMITTED",
     {"skills": ["Python", "NLP", "SQL"]}),
    ("s-11", "2026ECB1044", "Meera Iyer", "B.Tech", "ECE", 8.55, [8.3, 8.5, 8.6, 8.6, 8.55, 8.6], 92.0, 91.0, 0, "VERIFIED",
     {"skills": ["Python", "Spark", "SQL"], "placement": "PLACED", "placedCompany": "Nova Labs", "placedDrive": "d-09"}),
    ("s-12", "2026CSM1002", "Arjun Nair", "M.Tech", "CSE", 8.95, [8.9, 9.0, 8.95], 93.0, 90.6, 0, "VERIFIED",
     {"skills": ["Python", "PyTorch", "Kubernetes", "Go"]}),
    ("s-13", "2026MCB1019", "Divya Menon", "B.Tech", "MNC", 9.02, [8.9, 9.0, 9.1, 9.0, 9.05, 9.05], 96.2, 94.8, 0, "VERIFIED",
     {"skills": ["C++", "Python", "Statistics", "SQL"]}),
    ("s-14", "2026CSB1011", "Ananya Sharma", "B.Tech", "CSE", 8.7, [8.5, 8.6, 8.8, 8.7, 8.75, 8.8], 93.2, 91.4, 0, "VERIFIED",
     {"skills": ["Python", "Go", "SQL", "Machine Learning"]}),
    ("s-15", "2026CEB1007", "Yash Thakur", "B.Tech", "CE", 6.8, [6.5, 6.7, 6.9, 6.8, 6.9, 6.9], 80.2, 76.0, 2, "VERIFIED",
     {"skills": ["AutoCAD", "Revit"]}),
]

COMPANIES = [
    ("c-01", "Acme Systems", "Enterprise Software", "https://acme-systems.example", "Builds workflow automation and observability platforms for large enterprises.",
     "Priya Raman", "campus.hiring@acme-recruiter.example", "+91 80 4012 3300", "u-spoc1", "APPROVED"),
    ("c-02", "Nova Labs", "Machine Learning Research", "https://novalabs.example", "Applied ML lab building ranking, forecasting and speech models.",
     "Daniel Fernandes", "university@novalabs-recruiter.example", "+91 40 6610 0045", "u-spoc2", "APPROVED"),
    ("c-03", "Orbit Tech", "Consumer Internet", "https://orbittech.example", "Consumer commerce and logistics platform serving 40M monthly users.",
     "Sneha Kulkarni", "campus@orbit-recruiter.example", "+91 80 4455 7788", "u-spoc1", "APPROVED"),
    ("c-04", "Helix AI", "Generative AI", "https://helix-ai.example", "Foundation-model tooling for enterprise document understanding.",
     "Rahul Bhatia", "talent@helix-recruiter.example", "+91 124 470 1200", "u-spoc2", "APPROVED"),
    ("c-05", "Quantum Grid", "Semiconductors", "https://quantumgrid.example", "Mixed-signal chip design for power management and EV charging.",
     "Kavita Menon", "campus@qgrid-recruiter.example", "+91 120 455 9000", "u-spoc2", "APPROVED"),
    ("c-06", "Vertex Analytics", "Analytics & Consulting", "https://vertexanalytics.example", "Decision-science consulting for retail and financial-services clients.",
     "Imran Shaikh", "hiring@vertex-recruiter.example", "+91 20 6720 1100", "u-spoc1", "APPROVED"),
    ("c-07", "Atlas Robotics", "Robotics", "https://atlasrobotics.example", "Warehouse autonomy and robotic picking systems.",
     "Meghna Rao", "campus@atlas-recruiter.example", "+91 80 4920 3311", "u-spoc1", "APPROVED"),
    ("c-08", "Cobalt Fintech", "Financial Technology", "https://cobaltfintech.example", "Payments infrastructure and risk engines for neo-banks.",
     "Aditya Jain", "campus@cobalt-recruiter.example", "+91 22 6110 4400", None, "PENDING_APPROVAL"),
]


def _drives(now: datetime) -> list[dict]:
    at = lambda delta: now + delta  # noqa: E731
    base = dict(degrees=[], skills=[], grad_years=[2026])
    return [
        dict(drive_id="d-01", company_id="c-01", role="Software Engineer", ctc=42, location="Bengaluru", category="Software",
             description="Backend and platform engineering on the Acme automation suite. Two coding rounds followed by system design and HR.",
             min_cgpa=8.0, allowed_branches=["CSE", "AI", "MNC"], max_backlogs=0, close_at=at(2 * DAY + 2 * HOUR + timedelta(minutes=17)),
             status="OPEN", created_by="Ananya Sharma", created_at=at(-6 * DAY), **base),
        dict(drive_id="d-02", company_id="c-02", role="Machine Learning Engineer", ctc=38, location="Hyderabad", category="Data & AI",
             description="Train and ship ranking models. Online assessment on ML fundamentals and Python.",
             min_cgpa=8.5, allowed_branches=["AI", "CSE"], max_backlogs=0, close_at=at(4 * DAY + 5 * HOUR), status="OPEN",
             created_by="Simran Kaur", created_at=at(-5 * DAY), **base),
        dict(drive_id="d-03", company_id="c-03", role="SDE-1", ctc=32, location="Bengaluru", category="Software",
             description="Full-stack development on the commerce platform. DSA round, machine coding and a hiring-manager round.",
             min_cgpa=7.5, allowed_branches=["CSE", "AI", "MNC", "EE"], max_backlogs=1, close_at=at(6 * DAY + 9 * HOUR), status="OPEN",
             created_by="Ananya Sharma", created_at=at(-8 * DAY), **base),
        dict(drive_id="d-04", company_id="c-04", role="Research Engineer — GenAI", ctc=36, location="Gurugram (Hybrid)", category="Data & AI",
             description="Research engineering on document-understanding models. Open to M.Tech students with deep-learning experience.",
             min_cgpa=8.0, allowed_branches=["AI", "CSE"], max_backlogs=0, close_at=at(1 * DAY + 5 * HOUR), status="OPEN",
             created_by="Simran Kaur", created_at=at(-4 * DAY), grad_years=[2026], degrees=["M.Tech"], skills=["Python", "PyTorch"]),
        dict(drive_id="d-05", company_id="c-05", role="Analog Design Engineer", ctc=24, location="Noida", category="Core Engineering",
             description="Analog and mixed-signal IC design. Written test on circuits followed by technical interviews.",
             min_cgpa=7.0, allowed_branches=["EE", "ECE"], max_backlogs=0, close_at=at(5 * DAY + 3 * HOUR), status="OPEN",
             created_by="Simran Kaur", created_at=at(-3 * DAY), **base),
        dict(drive_id="d-06", company_id="c-06", role="Data Analyst", ctc=18, location="Pune", category="Analytics",
             description="Client analytics and dashboarding. Aptitude test, case study and interview.",
             min_cgpa=7.0, allowed_branches=[], max_backlogs=2, close_at=at(8 * DAY + 4 * HOUR), status="OPEN",
             created_by="Ananya Sharma", created_at=at(-2 * DAY), **base),
        dict(drive_id="d-07", company_id="c-03", role="Product Engineer", ctc=22, location="Gurugram", category="Product",
             description="Product engineering for seller tools. Applications frozen while the recruiter revises headcount.",
             min_cgpa=7.0, allowed_branches=["CSE", "AI", "MNC", "EE", "ECE", "CE"], max_backlogs=1, close_at=at(3 * DAY), status="FROZEN",
             created_by="Ananya Sharma", created_at=at(-7 * DAY), **base),
        dict(drive_id="d-08", company_id="c-01", role="Cloud Infrastructure Engineer", ctc=26, location="Bengaluru", category="Software",
             description="Infrastructure automation on Kubernetes. Applications closed; assessments in progress.",
             min_cgpa=7.5, allowed_branches=["CSE", "AI", "MNC", "EE"], max_backlogs=0, close_at=at(-3 * DAY), status="CLOSED",
             created_by="Ananya Sharma", created_at=at(-15 * DAY), **base),
        dict(drive_id="d-09", company_id="c-02", role="Data Engineer", ctc=26, location="Hyderabad", category="Data & AI",
             description="Streaming data pipelines. Process completed.",
             min_cgpa=7.5, allowed_branches=["CSE", "AI", "MNC", "ECE"], max_backlogs=0, close_at=at(-12 * DAY), status="CLOSED",
             created_by="Simran Kaur", created_at=at(-25 * DAY), **base),
        dict(drive_id="d-10", company_id="c-04", role="Platform Engineer", ctc=30, location="Gurugram", category="Software",
             description="Draft JAF awaiting final recruiter confirmation.",
             min_cgpa=7.5, allowed_branches=["CSE", "AI"], max_backlogs=0, close_at=at(10 * DAY), status="DRAFT",
             created_by="Simran Kaur", created_at=at(-1 * DAY), **base),
    ]


APP_ROWS = [
    ("a-01", "s-01", "d-03", "SHORTLISTED", 5), ("a-02", "s-01", "d-08", "ASSESSMENT", 12), ("a-03", "s-02", "d-01", "INTERVIEW", 5),
    ("a-04", "s-03", "d-01", "SHORTLISTED", 5), ("a-05", "s-04", "d-01", "APPLIED", 4), ("a-06", "s-12", "d-01", "APPLIED", 3),
    ("a-07", "s-13", "d-01", "UNDER_REVIEW", 4), ("a-08", "s-14", "d-02", "APPLIED", 2), ("a-09", "s-02", "d-02", "SHORTLISTED", 4),
    ("a-10", "s-04", "d-02", "APPLIED", 3), ("a-11", "s-12", "d-02", "ASSESSMENT", 4), ("a-12", "s-02", "d-03", "APPLIED", 6),
    ("a-13", "s-03", "d-03", "INTERVIEW", 7), ("a-14", "s-09", "d-06", "APPLIED", 1), ("a-15", "s-13", "d-06", "APPLIED", 1),
    ("a-16", "s-12", "d-04", "SHORTLISTED", 3), ("a-17", "s-11", "d-09", "OFFERED", 22), ("a-18", "s-03", "d-08", "REJECTED", 13),
    ("a-19", "s-13", "d-08", "INTERVIEW", 13), ("a-20", "s-14", "d-03", "UNDER_REVIEW", 6), ("a-21", "s-13", "d-03", "SHORTLISTED", 7),
    ("a-22", "s-04", "d-06", "WITHDRAWN", 2), ("a-23", "s-12", "d-09", "REJECTED", 22),
]
PATH = ["APPLIED", "UNDER_REVIEW", "SHORTLISTED", "ASSESSMENT", "INTERVIEW", "OFFERED"]

PENDING_INVITES = [
    ("2026AIB1033", "Nisha Patel", "AI", "B.Tech", "INVITED", -1 * DAY),
    ("2026CSB1045", "Farhan Ali", "CSE", "B.Tech", "NOT_INVITED", None),
    ("2026MEB1018", "Vikram Singh", "ME", "B.Tech", "NOT_INVITED", None),
    ("2026ECB1022", "Riya Sen", "ECE", "B.Tech", "NOT_INVITED", None),
    ("2026EEB1040", "Rahul Gupta", "EE", "B.Tech", "DECLINED", -2 * DAY),
]

AUDIT_ROWS = [
    (-20 * DAY, "CCPC Office", "CCPC", "Invitation", "FEE_LIST_IMPORTED", "15 fee-paid students imported from the Academic Section list."),
    (-19 * DAY, "CCPC Office", "CCPC", "Invitation", "INVITATION_SENT", "Bulk onboarding invitation sent to 15 fee-paid students."),
    (-15 * DAY, "Ananya Sharma", "SPOC", "Drive", "DRIVE_CREATED", "Acme Systems — Cloud Infrastructure Engineer published (₹26 LPA)."),
    (-14 * DAY, "Dr. Subrat Kar", "VERIFIER", "Profile", "PROFILE_VERIFIED", "2026AIM1028 (Rohan Verma) verified and auto-locked."),
    (-12 * DAY, "System Engine", "SYSTEM", "Drive", "DRIVE_CLOSED", "Nova Labs — Data Engineer closed at deadline."),
    (-8 * DAY, "Ananya Sharma", "SPOC", "Drive", "DRIVE_CREATED", "Orbit Tech — SDE-1 published (₹32 LPA)."),
    (-7 * DAY, "Ananya Sharma", "SPOC", "Drive", "DRIVE_FROZEN", "Orbit Tech — Product Engineer frozen pending headcount revision."),
    (-6 * DAY, "Ananya Sharma", "SPOC", "Drive", "DRIVE_CREATED", "Acme Systems — Software Engineer published (₹42 LPA)."),
    (-6 * DAY + 2 * HOUR, "Rohan Verma", "STUDENT", "Ticket", "CORRECTION_REQUESTED", "2026AIM1028 requested a Semester SGPA correction."),
    (-5 * DAY, "CCPC Office", "CCPC", "Ticket", "TICKET_REJECTED", "Correction ticket t-02 for 2026AIM1028 rejected."),
    (-5 * DAY + HOUR, "Simran Kaur", "SPOC", "Drive", "DRIVE_CREATED", "Nova Labs — Machine Learning Engineer published (₹38 LPA)."),
    (-4 * DAY, "Simran Kaur", "SPOC", "Application", "BATCH_SHORTLIST_EXECUTED", "Helix AI: 1 candidate moved to SHORTLISTED (2026CSM1002)."),
    (-3 * DAY, "Prof. Neha Gupta", "VERIFIER", "Profile", "REVISION_REQUESTED", "2026EEB1031 (Pooja Rathi): Class 12 value does not match the marksheet."),
    (-2 * DAY, "CCPC Office", "CCPC", "Drive", "DEADLINE_EXTENDED", "Vertex Analytics — Data Analyst deadline extended by 48 hours."),
    (-2 * DAY + 3 * HOUR, "Ananya Sharma", "SPOC", "Application", "ROSTER_EXPORTED", "Acme Systems — Software Engineer: 5 applicant rows exported as CSV."),
    (-1 * DAY, "CCPC Office", "CCPC", "Invitation", "INVITATION_SENT", "Invitation sent to 2026AIB1033 (Nisha Patel)."),
    (-26 * HOUR, "Harsh Vardhan", "STUDENT", "Ticket", "CORRECTION_REQUESTED", "2026MEB1012 requested a Class 12 % correction."),
    (-20 * HOUR, "Ananya Sharma", "SPOC", "Application", "BATCH_SHORTLIST_EXECUTED", "Orbit Tech — SDE-1: 2 candidates moved to SHORTLISTED (2026AIM1028, 2026MCB1019)."),
    (-9 * HOUR, "Yash Thakur", "STUDENT", "Ticket", "UNFREEZE_REQUESTED", "2026CEB1007 requested profile unfreeze (Active backlogs)."),
    (-3 * HOUR, "Nikhil Bansal", "STUDENT", "Profile", "PROFILE_SUBMITTED", "2026CSB1050 (Nikhil Bansal) submitted profile for verification."),
]
ACTOR_EMAIL = {"CCPC Office": f"ccpc@{DOMAIN}", "Dr. Subrat Kar": f"verifier@{DOMAIN}", "Prof. Neha Gupta": f"neha.gupta@{DOMAIN}",
               "Ananya Sharma": f"spoc@{DOMAIN}", "Simran Kaur": f"simran.kaur@{DOMAIN}", "Rohan Verma": f"2026aim1028@{DOMAIN}",
               "Harsh Vardhan": f"2026meb1012@{DOMAIN}", "Yash Thakur": f"2026ceb1007@{DOMAIN}", "Nikhil Bansal": f"2026csb1050@{DOMAIN}"}


def D(v) -> Decimal | None:
    return None if v is None else Decimal(str(v))


def seed(db: Session, now: datetime | None = None) -> None:
    now = now or datetime.now(timezone.utc)
    pw = hash_password(settings.demo_password)  # one hash reused for all demo accounts (demo data only)
    seed_dir = settings.upload_dir / "seed"
    if seed_dir.exists():
        shutil.rmtree(seed_dir)

    # --- users (staff) -----------------------------------------------------------------------
    for email, name, role, title, can_verify, _ in STAFF:
        db.add(User(email=email, name=name, role=role, title=title, can_verify=can_verify, password_hash=pw, is_active=True))

    # --- students, their accounts and documents ----------------------------------------------
    id_to_roll: dict[str, str] = {}
    student_dicts: dict[str, dict] = {}
    doc_n = 1
    for i, (sid, roll, name, degree, branch, cgpa, sem, c10, c12, backlogs, verification, extra) in enumerate(STUDENT_ROWS):
        id_to_roll[sid] = roll
        email = f"{roll.lower()}@{DOMAIN}"
        db.add(User(email=email, name=name, role="STUDENT", title="Student", password_hash=pw, is_active=True))
        verified = verification == "VERIFIED"
        proof = {"cgpa": cgpa, "class10": c10, "class12": c12, "backlogs": backlogs, "branch": branch, "degree": degree, **extra.get("proof", {})}
        phone = extra.get("phone") or f"+91 98{100 + i * 37:03d} {41000 + i * 113}"
        sdict = {"roll": roll, "name": name, "email": email, "phone": phone, "degree": degree, "branch": branch, "cgpa": cgpa,
                 "semCgpa": sem, "skills": extra.get("skills", []), "proof": proof}
        student_dicts[sid] = sdict
        db.add(Student(
            roll=roll, user_email=email, name=name, phone=phone, degree=degree, branch=branch, grad_year=2026,
            cgpa=D(cgpa), sem_cgpa=[D(x) for x in sem], class10=D(c10), class12=D(c12), backlogs=backlogs,
            skills=extra.get("skills", []), verification=verification, locked=verified,
            verified_by=("Dr. Subrat Kar" if i % 3 == 0 else "Prof. Neha Gupta") if verified else None,
            verified_by_email=(f"verifier@{DOMAIN}" if i % 3 == 0 else f"neha.gupta@{DOMAIN}") if verified else None,
            verified_at=now - (i + 1) * DAY if verified else None,
            submitted_at=None if verification == "NOT_SUBMITTED" else now - (i + 1) * 7 * HOUR - (i + 1) * DAY * (1 if verified else 0),
            revision_reason=extra.get("revisionReason"), placement=extra.get("placement", "UNPLACED"),
            placed_company=extra.get("placedCompany"), proof=proof, created_at=now - 20 * DAY,
        ))
    db.flush()

    default_resume: dict[str, str] = {}
    for i, (sid, roll, *_rest) in enumerate(STUDENT_ROWS):
        verification = _rest[8]
        extra = _rest[9]
        s = student_dicts[sid]
        r = roll.lower()
        status = "APPROVED" if verification == "VERIFIED" else "PENDING"

        def mk(doc_type, file_name, claimed=None, st=status, label=None, remarks="", is_default=False):
            nonlocal doc_n
            doc_id = f"doc-{doc_n:03d}"
            doc_n += 1
            path = seed_dir / roll / f"{doc_id}.pdf"
            pdfgen.make(path, doc_type, s, label)
            db.add(Document(
                doc_id=doc_id, roll=roll, doc_type=doc_type, label=label, file_name=file_name, file_type="application/pdf",
                size_bytes=path.stat().st_size, file_path=str(path.relative_to(settings.upload_dir)), status=st,
                remarks=remarks, claimed_value=claimed, is_default=is_default,
                uploaded_at=now - (i + 2) * DAY - doc_n * HOUR,
                reviewed_by="Dr. Subrat Kar" if st in ("APPROVED", "REVISION") else None,
                reviewed_at=now - (i + 1) * DAY if st in ("APPROVED", "REVISION") else None,
            ))
            return doc_id

        if verification != "NOT_SUBMITTED" or sid == "s-10":
            mk("GRADE_CARD", f"{r}_grade_card.pdf", f"CGPA {s['cgpa']:.2f}")
            mk("CLASS10", f"{r}_10th.pdf", f"{_rest[5]:.2f} %")
            if sid != "s-10":
                mk("CLASS12", f"{r}_12th.pdf", f"{_rest[6]:.2f} %",
                   st="REVISION" if sid == "s-08" else status, remarks=extra.get("revisionReason", "") if sid == "s-08" else "")
        if sid != "s-10":
            default_resume[sid] = mk("RESUME", f"{r}_resume_sde.pdf", label="Software Resume", is_default=True)
        if sid == "s-01":
            mk("RESUME", f"{r}_resume_data.pdf", st="APPROVED", label="Data Resume")
            mk("ID_PROOF", f"{r}_id_masked.pdf", st="APPROVED")
            mk("PORTFOLIO", f"{r}_portfolio.pdf", st="PENDING")
            mk("CERTIFICATE", f"{r}_nptel_deep_learning.pdf", st="APPROVED", label="NPTEL Deep Learning")
        if sid == "s-12":
            mk("RESUME", f"{r}_resume_core_ml.pdf", st="PENDING", label="Core ML Resume")
        if sid == "s-04":
            mk("RESUME", f"{r}_resume_ml.pdf", st="PENDING", label="ML Resume")
    db.flush()
    for sid, doc_id in default_resume.items():
        db.get(Student, id_to_roll[sid]).default_resume_id = doc_id

    # SPOC Ananya is also student 2026CSB1011 (dual-context access).
    for email, *_r, linked in STAFF:
        if linked:
            db.get(User, email).linked_student_roll = linked

    # --- companies & drives --------------------------------------------------------------------
    for cid, name, industry, web, desc, contact, rec, phone, spoc, status in COMPANIES:
        db.add(Company(company_id=cid, name=name, industry=industry, website=web, description=desc, contact_name=contact,
                       recruiter_email=rec, phone=phone, assigned_spoc=SPOC.get(spoc), status=status, active=True,
                       approved_at=None if status == "PENDING_APPROVAL" else now - 10 * DAY, created_at=now - 12 * DAY))
    db.flush()
    creator = {"Ananya Sharma": f"spoc@{DOMAIN}", "Simran Kaur": f"simran.kaur@{DOMAIN}"}
    for d in _drives(now):
        db.add(Drive(**{**d, "ctc": D(d["ctc"]), "min_cgpa": D(d["min_cgpa"]), "created_by_email": creator.get(d["created_by"])}))
    db.flush()
    db.get(Student, "2026ECB1044").placed_drive_id = "d-09"

    # --- applications with stage history ------------------------------------------------------
    for aid, sid, did, stage, days_ago in APP_ROWS:
        roll = id_to_roll[sid]
        applied = now - days_ago * DAY
        steps = ["APPLIED", "UNDER_REVIEW", stage] if stage in ("REJECTED", "WITHDRAWN") else PATH[: PATH.index(stage) + 1]
        span = max(timedelta(hours=1), days_ago * DAY - 2 * HOUR)
        app = Application(application_id=aid, drive_id=did, roll=roll, resume_doc_id=default_resume.get(sid), stage=stage, applied_at=applied)
        for k, st in enumerate(steps):
            app.events.append(ApplicationEvent(
                stage=st, at=applied + span * k / max(1, len(steps)),
                actor="Student" if k == 0 or st == "WITHDRAWN" else "SPOC",
                note="Application submitted with default resume" if k == 0 else ("Not shortlisted after assessment" if st == "REJECTED" else ""),
            ))
        app.updated_at = app.events[-1].at
        db.add(app)

    # --- invitations ----------------------------------------------------------------------------
    for i, (sid, roll, name, degree, branch, *_r) in enumerate(STUDENT_ROWS):
        db.add(Invitation(invitation_id=f"inv-{i + 1:02d}", entry_no=roll, name=name, email=f"{roll.lower()}@{DOMAIN}", branch=branch,
                          degree=degree, fee_paid=True, status="REGISTERED", roll=roll, updated_at=now - (18 - i * 0.5) * DAY,
                          created_at=now - 21 * DAY))
    for j, (roll, name, branch, degree, status, offset) in enumerate(PENDING_INVITES):
        email = f"{roll.lower()}@{DOMAIN}"
        inv = Invitation(invitation_id=f"inv-{len(STUDENT_ROWS) + j + 1:02d}", entry_no=roll, name=name, email=email, branch=branch,
                         degree=degree, fee_paid=True, status=status, updated_at=now + offset if offset is not None else None,
                         created_at=now - 3 * DAY)
        if status == "INVITED":
            inv.invite_token = new_invite_token()
            inv.token_expires_at = now + timedelta(days=settings.invite_ttl_days)
            db.add(User(email=email, name=name, role="STUDENT", title="Student", is_active=True))  # not activated yet
        db.add(inv)

    # --- tickets ------------------------------------------------------------------------------------
    db.add_all([
        Ticket(ticket_id="t-01", roll="2026MEB1012", ticket_type="CORRECTION", field="class12", field_label="Class 12 %",
               current_value="78.4", requested_value="79.4", status="OPEN", created_at=now - 26 * HOUR,
               justification="Re-evaluation result for Physics was published after my profile was verified. Revised marksheet attached in Documents."),
        Ticket(ticket_id="t-02", roll="2026AIM1028", ticket_type="CORRECTION", field="semCgpa", field_label="Semester SGPA",
               current_value="8.24, 8.48, 8.54", requested_value="8.24, 8.48, 8.56", status="REJECTED", created_at=now - 6 * DAY,
               justification="Semester 3 SGPA was rounded incorrectly on the record.", resolved_at=now - 5 * DAY,
               resolved_by="CCPC Office", resolution="Semester 3 grade card shows SGPA 8.54. No change required."),
        Ticket(ticket_id="t-03", roll="2026CEB1007", ticket_type="UNFREEZE", field="backlogs", field_label="Active backlogs",
               current_value="2", requested_value="1", status="OPEN", created_at=now - 9 * HOUR,
               justification="Cleared MA201 in the supplementary examination held in September. Result notification is available on the academic portal."),
    ])

    # --- audit trail & notifications ----------------------------------------------------------------
    for offset, actor, role, entity, action, desc in AUDIT_ROWS:
        db.add(AuditLog(ts=now + offset, actor=actor, actor_email=ACTOR_EMAIL.get(actor), actor_role=role, entity=entity,
                        action_type=action, description=desc))
    db.add_all([
        Notification(roll="2026AIM1028", message="You were shortlisted for Orbit Tech — SDE-1.", created_at=now - 20 * HOUR, link="/student/applications"),
        Notification(roll="2026AIM1028", message="Acme Systems — Software Engineer closes in 2 days.", created_at=now - 4 * HOUR, link="/student/opportunities/d-01"),
        Notification(roll="2026AIM1028", message="Your correction ticket for Semester SGPA was rejected.", created_at=now - 5 * DAY, link="/student/profile", is_read=True),
        Notification(roll="2026EEB1031", message="Revision requested on your Profile Audit: Class 12 value mismatch.", created_at=now - 3 * DAY, link="/student/profile"),
    ])
    db.commit()


TABLES = ["notifications", "audit_logs", "unfreeze_tickets", "application_events", "applications", "invitations",
          "placement_drives", "companies", "documents", "students", "users"]


def reset_and_seed() -> None:
    """Wipe all rows (TRUNCATE is allowed on the append-only audit table) and reload the demo data."""
    with engine.begin() as conn:
        conn.execute(text("UPDATE users SET linked_student_roll = NULL"))
        conn.execute(text(f"TRUNCATE {', '.join(TABLES)} RESTART IDENTITY CASCADE"))
    uploads = settings.upload_dir
    if uploads.exists():
        for child in uploads.iterdir():
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
    with SessionLocal() as db:
        seed(db)


def main() -> None:
    from .init_db import create_schema

    create_schema(drop=True)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    reset_and_seed()
    print(f"Demo data loaded. All demo accounts use the password: {settings.demo_password}")
    print(f"  CCPC admin : ccpc@{DOMAIN}\n  Verifier   : verifier@{DOMAIN}\n  SPOC       : spoc@{DOMAIN}\n  Student    : 2026aim1028@{DOMAIN}")


if __name__ == "__main__":
    main()
