"""Business rules shared by the API: eligibility engine, stage transitions, claim comparison,
submission checklist and the zero-drop shortlist parser.

These mirror the frontend utilities (src/utils/eligibility.js, bulkParser.js, profileRules.js) so the
UI can give instant feedback while the server remains the authority.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal

from .models import Application, Document, Drive, Student

STAGE_ORDER = ["APPLIED", "UNDER_REVIEW", "SHORTLISTED", "ASSESSMENT", "INTERVIEW", "OFFERED"]
TERMINAL_STAGES = {"OFFERED", "REJECTED", "WITHDRAWN"}
STAGE_LABELS = {
    "APPLIED": "Applied",
    "UNDER_REVIEW": "Under Review",
    "SHORTLISTED": "Shortlisted",
    "ASSESSMENT": "Assessment",
    "INTERVIEW": "Interview",
    "OFFERED": "Offered",
    "REJECTED": "Rejected",
    "WITHDRAWN": "Withdrawn",
}

DOC_TYPE_META = {
    "GRADE_CARD": {"label": "Grade Card / Transcript", "academic": True},
    "CLASS10": {"label": "Class 10 Marksheet", "academic": True},
    "CLASS12": {"label": "Class 12 Marksheet", "academic": True},
    "ID_PROOF": {"label": "Identity Proof", "academic": False},
    "RESUME": {"label": "Resume", "academic": False},
    "PORTFOLIO": {"label": "Portfolio", "academic": False},
    "CERTIFICATE": {"label": "Certificate", "academic": False},
    "OTHER": {"label": "Other Document", "academic": False},
}

BRANCH_CODES = ["CSE", "AI", "MNC", "EE", "ECE", "ME", "CE"]
DEGREES = ["B.Tech", "M.Tech"]
ROLL_BRANCH = {"CS": "CSE", "AI": "AI", "MC": "MNC", "EE": "EE", "EC": "ECE", "ME": "ME", "CE": "CE"}

# Roll numbers look like 2026CSB1028: year, branch code, degree letter (B/M), 4-digit serial.
ROLL_REGEX = re.compile(r"^(20\d{2})(CS|AI|MC|EE|EC|ME|CE)([BM])(\d{4})$")

ACADEMIC_FIELDS = {"degree", "branch", "gradYear", "cgpa", "semCgpa", "class10", "class12", "backlogs"}
CONTACT_FIELDS = {"phone", "skills"}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def fmt2(value) -> str:
    if value is None or value == "":
        return "—"
    return f"{float(value):.2f}"


def num(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Eligibility engine
# ---------------------------------------------------------------------------


@dataclass
class Check:
    rule: str
    label: str
    passed: bool
    message: str


@dataclass
class Eligibility:
    checks: list[Check] = field(default_factory=list)

    @property
    def reasons(self) -> list[Check]:
        return [c for c in self.checks if not c.passed]

    @property
    def eligible(self) -> bool:
        return not self.reasons

    def as_dict(self) -> dict:
        return {
            "eligible": self.eligible,
            "reasons": [{"rule": c.rule, "message": c.message} for c in self.reasons],
            "checks": [{"rule": c.rule, "label": c.label, "pass": c.passed, "message": c.message} for c in self.checks],
        }


def evaluate_eligibility(student: Student, drive: Drive) -> Eligibility:
    """CGPA >= cutoff AND branch in allowed AND backlogs <= limit AND batch/degree/skills AND verified AND unplaced."""
    e = Eligibility()
    add = lambda rule, label, ok, msg: e.checks.append(Check(rule, label, bool(ok), msg))  # noqa: E731

    if drive.min_cgpa is not None:
        ok = (num(student.cgpa) or 0) >= float(drive.min_cgpa)
        add("cgpa", f"Min CGPA {fmt2(drive.min_cgpa)}", ok,
            f"Minimum CGPA: {fmt2(drive.min_cgpa)}; your CGPA: {fmt2(student.cgpa)}")

    if drive.allowed_branches:
        branches = " / ".join(drive.allowed_branches)
        add("branch", f"Branches: {branches}", student.branch in drive.allowed_branches,
            f"Branch not allowed — requires {branches}; your branch: {student.branch or '—'}")

    if drive.max_backlogs is not None:
        ok = (student.backlogs or 0) <= drive.max_backlogs
        label = "No active backlogs" if drive.max_backlogs == 0 else f"≤ {drive.max_backlogs} backlog(s)"
        add("backlogs", label, ok, f"Maximum active backlogs: {drive.max_backlogs}; you have: {student.backlogs or 0}")

    if drive.grad_years:
        years = " / ".join(str(y) for y in drive.grad_years)
        add("gradYear", f"Batch {years}", student.grad_year in drive.grad_years,
            f"Graduation year must be {years}; yours: {student.grad_year or '—'}")

    if drive.degrees:
        degrees = " / ".join(drive.degrees)
        add("degree", f"{degrees} only", student.degree in drive.degrees,
            f"Degree requirement: {degrees}; your degree: {student.degree or '—'}")

    if drive.skills:
        have = {s.lower() for s in (student.skills or [])}
        missing = [s for s in drive.skills if s.lower() not in have]
        add("skills", f"Skills: {', '.join(drive.skills)}", not missing,
            f"Missing required skill{'s' if len(missing) > 1 else ''}: {', '.join(missing)}")

    add("verified", "Verified profile", student.verification == "VERIFIED",
        "Profile not yet verified — complete your Profile Audit to apply")
    placed_msg = f"Already placed at {student.placed_company}" if student.placed_company else "Already placed"
    add("placement", "One-offer policy", student.placement != "PLACED", f"{placed_msg} (one-offer policy)")
    return e


def can_apply(student: Student, drive: Drive, existing: Application | None, now: datetime | None = None) -> tuple[bool, str]:
    now = now or utcnow()
    if existing is not None and existing.stage != "WITHDRAWN":
        return False, "You have already applied to this drive"
    if drive.status != "OPEN":
        return False, f"Drive is {drive.status.lower()}"
    if drive.close_at <= now:
        return False, "Application deadline has passed"
    elig = evaluate_eligibility(student, drive)
    if not elig.eligible:
        return False, elig.reasons[0].message
    return True, ""


# ---------------------------------------------------------------------------
# Application pipeline
# ---------------------------------------------------------------------------


def check_transition(current: str, target: str) -> tuple[bool, str]:
    """Forward-only pipeline; REJECTED / WITHDRAWN allowed from any non-terminal stage."""
    if target not in STAGE_LABELS:
        return False, f"Unknown stage {target}"
    if current == target:
        return False, f"Already {STAGE_LABELS[current]}"
    if current in TERMINAL_STAGES:
        return False, f"Locked — application is {STAGE_LABELS[current]}"
    if target in ("REJECTED", "WITHDRAWN"):
        return True, ""
    if STAGE_ORDER.index(target) < STAGE_ORDER.index(current):
        return False, f"Cannot move back from {STAGE_LABELS[current]}"
    return True, ""


# ---------------------------------------------------------------------------
# Verification helpers
# ---------------------------------------------------------------------------


def compare_claims(student: Student) -> list[dict]:
    """Compare claimed values with the values the verifier read off the proofs."""
    p = student.proof or {}
    rows = [
        ("cgpa", "Overall CGPA", num(student.cgpa), num(p.get("cgpa")), True),
        ("class10", "Class 10 %", num(student.class10), num(p.get("class10")), True),
        ("class12", "Class 12 %", num(student.class12), num(p.get("class12")), True),
        ("backlogs", "Active backlogs", num(student.backlogs), num(p.get("backlogs")), True),
        ("branch", "Branch / Degree", f"{student.branch} · {student.degree}",
         f"{p['branch']} · {p['degree']}" if p.get("branch") and p.get("degree") else None, False),
    ]
    out = []
    for key, label, claimed, proof, numeric in rows:
        has_proof = proof is not None
        if numeric:
            match = has_proof and claimed is not None and abs(claimed - proof) < 0.005
        else:
            match = has_proof and claimed == proof
        out.append({"key": key, "label": label, "claimed": claimed, "proof": proof, "match": bool(match), "hasProof": has_proof})
    return out


def missing_for_submission(student: Student, documents: list[Document]) -> list[str]:
    missing = []
    for f, value in (("cgpa", student.cgpa), ("class10", student.class10), ("class12", student.class12),
                     ("branch", student.branch), ("degree", student.degree)):
        if value is None or value == "":
            missing.append(f)
    for t in ("GRADE_CARD", "CLASS10", "CLASS12", "RESUME"):
        if not any(d.doc_type == t and d.status != "REJECTED" for d in documents):
            missing.append(DOC_TYPE_META[t]["label"])
    return missing


def claimed_value(doc_type: str, student: Student) -> str | None:
    if doc_type == "GRADE_CARD":
        return f"CGPA {float(student.cgpa or 0):.2f}"
    if doc_type == "CLASS10":
        return f"{float(student.class10 or 0):.2f} %"
    if doc_type == "CLASS12":
        return f"{float(student.class12 or 0):.2f} %"
    return None


def profile_state(student: Student) -> str:
    """The report's profile state machine, derived from the stored columns."""
    if student.placement == "PLACED":
        return "POLICY_LOCKED"
    if student.verification == "VERIFIED" and student.locked:
        return "VERIFIED_LOCKED"
    if student.verification == "PENDING":
        return "PENDING_VERIFICATION"
    if student.verification == "REVISION" and (student.revision_reason or "").startswith("Unfrozen"):
        return "UNFROZEN_EDITING"
    if student.verification in ("REVISION", "REJECTED"):
        return "REVISION_REQUIRED"
    return "DRAFT"


# ---------------------------------------------------------------------------
# Zero-drop shortlist parser
# ---------------------------------------------------------------------------

_SPLIT = re.compile(r"[\s,;|]+")
_STRIP = re.compile(r"^[(\"'\[]+|[)\"'\].]+$")


def tokenize(text: str) -> list[str]:
    """Split pasted recruiter text on commas, whitespace, semicolons, pipes and newlines."""
    tokens = [_STRIP.sub("", t.strip()) for t in _SPLIT.split(text or "")]
    return [t for t in tokens if t]


def parse_roll_numbers(text: str, students_by_roll: dict[str, Student], apps_by_roll: dict[str, Application], target: str) -> dict:
    """Classify every pasted token as READY / SKIPPED / NOT_APPLICANT / DUPLICATE / INVALID."""
    tokens = tokenize(text)
    seen: set[str] = set()
    rows = []
    for index, raw in enumerate(tokens):
        roll = raw.upper()
        row = {"index": index, "raw": raw, "roll": roll, "student": None, "application": None}
        if not ROLL_REGEX.match(roll):
            rows.append({**row, "status": "INVALID", "message": "Bad format — expected e.g. 2026CSB1028"})
            continue
        if roll in seen:
            rows.append({**row, "status": "DUPLICATE", "message": "Duplicate entry — counted once"})
            continue
        seen.add(roll)
        student = students_by_roll.get(roll)
        app = apps_by_roll.get(roll)
        if not student or not app:
            msg = f"{student.name} has not applied to this drive" if student else "Roll number not found in student records"
            rows.append({**row, "student": student, "status": "NOT_APPLICANT", "message": msg})
            continue
        ok, reason = check_transition(app.stage, target)
        rows.append({
            **row, "student": student, "application": app,
            "status": "READY" if ok else "SKIPPED",
            "message": f"{STAGE_LABELS[app.stage]} → {STAGE_LABELS[target]}" if ok else reason,
        })

    def count(s: str) -> int:
        return sum(1 for r in rows if r["status"] == s)

    stats = {
        "total": len(tokens),
        "ready": count("READY"),
        "skipped": count("SKIPPED"),
        "notApplicants": count("NOT_APPLICANT"),
        "duplicates": count("DUPLICATE"),
        "invalid": count("INVALID"),
        "valid": sum(1 for r in rows if r["status"] in ("READY", "SKIPPED", "NOT_APPLICANT")),
    }
    return {"rows": rows, "stats": stats}


def to_decimal(value) -> Decimal | None:
    if value is None or value == "":
        return None
    return Decimal(str(value))
