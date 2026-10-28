#!/usr/bin/env python3
"""PlaceMatrix end-to-end smoke test.

Exercises every module through the real HTTP API (and optionally the database) and prints a
PASS/FAIL line per check. Uses only the Python standard library.

    python scripts/smoke_test.py                       # API at http://localhost:8000
    python scripts/smoke_test.py --api http://host:8000
    python scripts/smoke_test.py --db-check            # also prove audit_logs is append-only (needs psycopg)

The test resets the demo data before and after it runs (DEMO_MODE must be true on the server).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone

API = "http://localhost:8000"
DOMAIN = "iitrpr.ac.in"
PW = "demo123"
RESULTS: list[tuple[str, bool, str]] = []
SECTION = [""]

GREEN, RED, DIM, BOLD, RESET = "\033[32m", "\033[31m", "\033[2m", "\033[1m", "\033[0m"
if not sys.stdout.isatty() or os.name == "nt" and not os.environ.get("WT_SESSION"):
    GREEN = RED = DIM = BOLD = RESET = ""


# ---------------------------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------------------------


class Resp:
    def __init__(self, status: int, body: bytes, headers: dict):
        self.status, self.body, self.headers = status, body, headers

    @property
    def json(self):
        try:
            return json.loads(self.body.decode("utf-8"))
        except Exception:
            return None

    @property
    def detail(self) -> str:
        j = self.json
        if isinstance(j, dict) and "detail" in j:
            return str(j["detail"])
        return self.body[:200].decode("utf-8", "replace")


def call(method: str, path: str, body=None, token: str | None = None, raw: bytes | None = None, ctype: str | None = None) -> Resp:
    headers = {}
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if raw is not None:
        data, headers["Content-Type"] = raw, ctype
    elif body is not None:
        data, headers["Content-Type"] = json.dumps(body).encode(), "application/json"
    req = urllib.request.Request(API + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return Resp(r.status, r.read(), dict(r.headers))
    except urllib.error.HTTPError as e:
        return Resp(e.code, e.read(), dict(e.headers))


def multipart(fields: dict, file_field: str, filename: str, content: bytes, content_type: str) -> tuple[bytes, str]:
    boundary = "----pm" + uuid.uuid4().hex
    parts = []
    for k, v in fields.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'
                 f"Content-Type: {content_type}\r\n\r\n".encode() + content + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def tiny_pdf(text: str = "PlaceMatrix test document") -> bytes:
    stream = f"BT /F1 18 Tf 72 720 Td ({text}) Tj ET".encode()
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def upload(token: str, doc_type: str, label: str | None = None, content: bytes | None = None, filename: str = "doc.pdf",
           content_type: str = "application/pdf") -> Resp:
    fields = {"type": doc_type}
    if label:
        fields["label"] = label
    raw, ctype = multipart(fields, "file", filename, content if content is not None else tiny_pdf(), content_type)
    return call("POST", "/api/documents", raw=raw, ctype=ctype, token=token)


def login(email: str, password: str = PW) -> str:
    r = call("POST", "/api/auth/login", {"email": email, "password": password})
    if r.status != 200:
        raise RuntimeError(f"login {email} failed: {r.status} {r.detail}")
    return r.json["token"]


def state(token: str) -> dict:
    return call("GET", "/api/state", token=token).json["data"]


def section(title: str) -> None:
    SECTION[0] = title
    print(f"\n{BOLD}{title}{RESET}")


def check(name: str, ok: bool, info: str = "") -> bool:
    RESULTS.append((f"{SECTION[0]} › {name}", bool(ok), info))
    mark = f"{GREEN}PASS{RESET}" if ok else f"{RED}FAIL{RESET}"
    print(f"  [{mark}] {name}" + (f" {DIM}— {info}{RESET}" if info and not ok else ""))
    return bool(ok)


def student_by(st: dict, roll: str) -> dict | None:
    return next((s for s in st["students"] if s["roll"] == roll), None)


def audit_actions(token: str) -> set[str]:
    return {e["action"] for e in state(token)["audit"]}


def iso_in(**kw) -> str:
    return (datetime.now(timezone.utc) + timedelta(**kw)).isoformat()


# ---------------------------------------------------------------------------------------------
# The test plan
# ---------------------------------------------------------------------------------------------


def run(db_check: bool) -> None:
    section("0. Server & demo reset")
    r = call("GET", "/api/health")
    check("API is up and connected to PostgreSQL", r.status == 200 and r.json.get("database") == "connected", r.detail)
    cfg = call("GET", "/api/config").json or {}
    check("Demo mode is enabled (needed for this test)", cfg.get("demoMode") is True, str(cfg))
    check("Demo data reset", call("POST", "/api/demo/reset").status == 200)

    # -----------------------------------------------------------------------------------------
    section("1. Authentication & institute domain")
    r = call("POST", "/api/auth/login", {"email": "someone@gmail.com", "password": PW})
    check("Non-@iitrpr.ac.in email is rejected", r.status == 403 and "iitrpr.ac.in" in r.detail, r.detail)
    r = call("POST", "/api/auth/login", {"email": f"2026aim1028@{DOMAIN}", "password": "wrong-pass"})
    check("Wrong password is rejected", r.status == 401, r.detail)
    r = call("POST", "/api/auth/login", {"email": f"2026csb1045@{DOMAIN}", "password": PW})
    check("Fee-paid but not-invited student cannot sign in", r.status == 403 and "not been invited" in r.detail, r.detail)
    r = call("POST", "/api/auth/login", {"email": f"2026aib1033@{DOMAIN}", "password": PW})
    check("Invited student must activate before password login", r.status == 403 and "activat" in r.detail.lower(), r.detail)
    student = login(f"2026aim1028@{DOMAIN}")
    verifier = login(f"verifier@{DOMAIN}")
    viewonly = login(f"staff.office@{DOMAIN}")
    spoc = login(f"spoc@{DOMAIN}")
    spoc2 = login(f"simran.kaur@{DOMAIN}")
    ccpc = login(f"ccpc@{DOMAIN}")
    me = call("GET", "/api/auth/me", token=ccpc).json
    check("All four roles can sign in (Student, Verifier, SPOC, CCPC)", me and me["role"] == "CCPC")
    check("Requests without a token get 401", call("GET", "/api/state").status == 401)

    # -----------------------------------------------------------------------------------------
    section("2. Least-privilege data scoping (RBAC)")
    st = state(student)
    check("Student sees only their own profile", len(st["students"]) == 1 and st["students"][0]["roll"] == "2026AIM1028")
    check("Student never sees draft drives", all(d["status"] != "DRAFT" for d in st["drives"]))
    check("Student sees no audit log or other tickets", st["audit"] == [] and all(t["studentId"] == "2026AIM1028" for t in st["tickets"]))
    sp = state(spoc)
    names = sorted(c["name"] for c in sp["companies"])
    check("SPOC sees only assigned companies", names == ["Acme Systems", "Atlas Robotics", "Orbit Tech", "Vertex Analytics"], str(names))
    check("SPOC sees no tickets / invitations", sp["tickets"] == [] and sp["invitations"] == [])
    vs = state(verifier)
    check("Verifier sees students + documents but no tickets", len(vs["students"]) == 15 and vs["documents"] and vs["tickets"] == [])
    check("Student cannot open analytics (403)", call("GET", "/api/analytics/summary", token=student).status == 403)
    check("SPOC cannot resolve tickets (403)", call("POST", "/api/tickets/t-03/resolve", {"decision": "APPROVED", "resolution": "x"}, token=spoc).status == 403)

    # -----------------------------------------------------------------------------------------
    section("3. Student Profile & Academic Audit")
    sana = login(f"2026aib1020@{DOMAIN}")
    r = call("POST", "/api/students/2026AIB1020/submit", token=sana)
    check("Submission blocked until required docs are uploaded", r.status == 400 and "Class 12" in r.detail, r.detail)
    r = call("PATCH", "/api/students/2026AIB1020/profile", {"patch": {"cgpa": 11}}, token=sana)
    check("Out-of-range CGPA rejected by validation", r.status == 400, r.detail)
    r = call("PATCH", "/api/students/2026AIB1020/profile", {"patch": {"phone": "+91 98111 22334", "skills": ["Python", "NLP", "SQL", "PyTorch"]}}, token=sana)
    check("Contact details & skills saved", r.status == 200 and "PyTorch" in r.json["skills"], r.detail)
    r = call("PATCH", "/api/students/2026AIM1028/profile", {"patch": {"phone": "+91 90000 00000"}}, token=sana)
    check("Student cannot edit someone else's profile (403)", r.status == 403)

    # -----------------------------------------------------------------------------------------
    section("4. Document Vault & Resume Repository")
    r = upload(sana, "CLASS12", content=b"not really a pdf", filename="fake.pdf")
    check("Corrupted / non-PDF file rejected (magic-byte check)", r.status == 400, r.detail)
    r = upload(sana, "CLASS12")
    check("Class 12 marksheet uploaded", r.status == 200 and r.json["status"] == "PENDING", r.detail)
    r = upload(sana, "RESUME")
    check("Resume needs a name", r.status == 400, r.detail)
    r = upload(sana, "RESUME", label="Software Resume")
    sana_resume = r.json["id"] if r.status == 200 else None
    check("First resume becomes default for 1-click apply", r.status == 200 and r.json["isDefault"], r.detail)
    r = call("POST", "/api/students/2026AIB1020/submit", token=sana)
    check("Profile submitted → PENDING verification", r.status == 200 and r.json["verification"] == "PENDING", r.detail)
    r = call("PATCH", "/api/students/2026AIB1020/profile", {"patch": {"cgpa": 9.5}}, token=sana)
    check("Academic edits blocked while under verification", r.status == 400, r.detail)
    r = upload(student, "GRADE_CARD")
    check("Locked (verified) student cannot replace academic proofs", r.status == 400 and "locked" in r.detail.lower(), r.detail)
    r = upload(student, "RESUME", label="ML Research Resume")
    new_resume = r.json["id"] if r.status == 200 else None
    check("Verified student adds a new resume (goes to resume queue)", r.status == 200 and r.json["status"] == "PENDING", r.detail)
    r = call("POST", f"/api/documents/{new_resume}/default", token=student)
    check("Unverified resume cannot be set as default", r.status == 400, r.detail)
    r = call("GET", "/api/documents/doc-001/file", token=student)
    check("Student downloads own proof PDF", r.status == 200 and r.body.startswith(b"%PDF"))
    r = call("GET", "/api/documents/doc-001/file", token=sana)
    check("Student cannot download another student's file (403)", r.status == 403)
    r = call("GET", "/api/documents/doc-001/file", token=spoc)
    check("SPOC cannot open student documents (403)", r.status == 403)
    r = call("GET", "/api/documents/doc-001/file", token=verifier)
    check("Verifier can open uploaded PDFs", r.status == 200 and r.body.startswith(b"%PDF"))

    # -----------------------------------------------------------------------------------------
    section("5. Faculty/Staff Verification Workflow")
    r = call("POST", "/api/verification/2026CEB1014/approve", {"remarks": ""}, token=verifier)
    check("Approval blocked on claimed-vs-proof mismatch (Tanvi CGPA 8.10 vs 7.82)", r.status == 400 and "mismatch" in r.detail.lower(), r.detail)
    r = call("POST", "/api/verification/2026CEB1014/revision", {"reason": "Grade card shows CGPA 7.82 — correct the claimed value."}, token=verifier)
    check("Revision requested with mandatory remarks", r.status == 200 and r.json["verification"] == "REVISION", r.detail)
    r = call("POST", "/api/verification/2026EEB1015/approve", {"remarks": "All proofs match"}, token=viewonly)
    check("Verifier without verification rights is blocked (403)", r.status == 403, r.detail)
    r = call("POST", "/api/verification/2026EEB1015/approve", {"remarks": "All proofs match"}, token=verifier)
    check("Approve → profile VERIFIED and auto-LOCKED", r.status == 200 and r.json["verification"] == "VERIFIED" and r.json["locked"], r.detail)
    r = call("PUT", "/api/verification/2026AIB1020/proof", {"values": {"cgpa": 8.9, "class10": 94, "class12": 92, "backlogs": 0, "branch": "AI", "degree": "B.Tech"}}, token=verifier)
    check("Verifier records 'as per proof' values", r.status == 200 and r.json["proof"]["class12"] == 92, r.detail)
    r = call("POST", "/api/verification/2026AIB1020/approve", {"remarks": ""}, token=verifier)
    check("Newly onboarded student verified end-to-end", r.status == 200 and r.json["locked"], r.detail)
    r = call("POST", f"/api/documents/{new_resume}/review", {"status": "APPROVED"}, token=verifier)
    check("Resume approved from the resume queue", r.status == 200 and r.json["status"] == "APPROVED", r.detail)
    r = call("POST", f"/api/documents/{new_resume}/review", {"status": "REJECTED"}, token=verifier)
    check("Rejecting a document requires a remark", r.status == 400, r.detail)
    r = call("PATCH", "/api/students/2026EEB1015/profile", {"patch": {"cgpa": 9.9}}, token=login(f"2026eeb1015@{DOMAIN}"))
    check("Locked academic record is read-only for the student", r.status == 400 and "locked" in r.detail.lower(), r.detail)

    # -----------------------------------------------------------------------------------------
    section("6. Eligibility engine & 1-click apply")
    el = call("GET", "/api/drives/eligible", token=student).json["drives"]
    nova = next(d for d in el if d["id"] == "d-02")
    check("Ineligible drive shows the exact failed rule", not nova["canApply"] and "Minimum CGPA: 8.50; your CGPA: 8.42" in (nova["reason"] or ""), nova["reason"])
    r = call("POST", "/api/applications/apply", {"driveId": "d-02", "resumeId": "doc-004"}, token=student)
    check("Server refuses an ineligible application", r.status == 400 and "CGPA" in r.detail, r.detail)
    r = call("POST", "/api/applications/apply", {"driveId": "d-01", "resumeId": "doc-004"}, token=student)
    rohan_acme = r.json["id"] if r.status == 200 else None
    check("Eligible student applies in one click", r.status == 200 and r.json["stage"] == "APPLIED", r.detail)
    r = call("POST", "/api/applications/apply", {"driveId": "d-01", "resumeId": "doc-004"}, token=student)
    check("Duplicate application blocked (UNIQUE drive_id, roll)", r.status in (400, 409), r.detail)
    r = call("POST", "/api/applications/apply", {"driveId": "d-07", "resumeId": "doc-004"}, token=student)
    check("Frozen drive does not accept applications", r.status == 400 and "frozen" in r.detail.lower(), r.detail)
    r = call("POST", "/api/applications/apply", {"driveId": "d-06", "resumeId": "doc-004"}, token=login(f"2026ceb1014@{DOMAIN}"))
    check("Unverified profile cannot apply", r.status == 400 and "verified" in r.detail.lower(), r.detail)

    # -----------------------------------------------------------------------------------------
    section("7. SPOC Roster & Bulk Shortlist Parser")
    text = "2026AIM1028, 2026AIB1026\n2026AIM1028 2026EEB1015; XYZ 2026CSB10"
    r = call("POST", "/api/spoc/bulk-shortlist/preview", {"driveId": "d-01", "text": text, "targetStage": "SHORTLISTED"}, token=spoc)
    s = r.json["stats"] if r.status == 200 else {}
    check("Parser classifies ready / skipped / non-applicant / duplicate / invalid",
          s == {"total": 6, "ready": 1, "skipped": 1, "notApplicants": 1, "duplicates": 1, "invalid": 2, "valid": 3}, str(s))
    r = call("POST", "/api/spoc/bulk-shortlist", {"driveId": "d-01", "text": text, "targetStage": "SHORTLISTED"}, token=spoc)
    check("Batch executed: only READY rows move", r.status == 200 and r.json["moved"] == ["2026AIM1028"], r.detail)
    r = call("POST", "/api/spoc/bulk-shortlist/preview", {"driveId": "d-02", "text": text, "targetStage": "SHORTLISTED"}, token=spoc)
    check("SPOC workspace isolation: cannot touch another SPOC's drive (403)", r.status == 403)
    r = call("GET", "/api/drives/d-01/roster.csv", token=spoc)
    body = r.body.decode("utf-8-sig") if r.status == 200 else ""
    check("Roster CSV export: UTF-8 BOM, quoted cells", r.status == 200 and r.body.startswith(b"\xef\xbb\xbf") and body.startswith('"Roll Number"'))
    check("CSV formula-injection guard ('+91…' cells prefixed with ')", "\"'+91" in body)
    r = call("GET", "/api/drives/d-02/roster.csv", token=spoc)
    check("SPOC cannot export another SPOC's roster (403)", r.status == 403)
    r = call("POST", "/api/drives", {"companyId": "c-01", "role": "Backend Intern", "ctc": 12, "deadline": iso_in(days=3), "status": "OPEN",
                                      "criteria": {"minCgpa": 7, "maxBacklogs": 0, "branches": ["CSE", "AI"], "gradYears": [2026]}}, token=spoc)
    check("SPOC publishes a JAF for an assigned company", r.status == 200 and r.json["status"] == "OPEN", r.detail)
    r = call("POST", "/api/drives", {"companyId": "c-02", "role": "Intern", "ctc": 12, "deadline": iso_in(days=3), "status": "OPEN"}, token=spoc)
    check("SPOC cannot create a JAF for an unassigned company (403)", r.status == 403)

    # -----------------------------------------------------------------------------------------
    section("8. One-Offer Policy Lock")
    st = state(spoc)
    orbit_app = next(a for a in st["applications"] if a["driveId"] == "d-03" and a["studentId"] == "2026AIM1028")
    r = call("POST", "/api/applications/stages", {"applicationIds": [orbit_app["id"]], "stage": "OFFERED"}, token=spoc)
    check("SPOC marks candidate OFFERED / Selected", r.status == 200 and r.json["moved"] == ["2026AIM1028"], r.detail)
    st = state(student)
    me_s = st["students"][0]
    others = [a for a in st["applications"] if a["id"] != orbit_app["id"]]
    check("Student becomes PLACED (POLICY_LOCKED state)", me_s["placement"] == "PLACED" and me_s["profileState"] == "POLICY_LOCKED", me_s["profileState"])
    check("All other active applications auto-WITHDRAWN atomically",
          all(a["stage"] in ("WITHDRAWN", "REJECTED", "OFFERED") for a in others) and any(a["id"] == rohan_acme and a["stage"] == "WITHDRAWN" for a in others))
    r = call("POST", "/api/applications/apply", {"driveId": "d-06", "resumeId": "doc-004"}, token=student)
    check("Placed student cannot apply again", r.status == 400 and "one-offer" in r.detail.lower(), r.detail)
    r = call("POST", "/api/applications/stages", {"applicationIds": [orbit_app["id"]], "stage": "REJECTED"}, token=spoc)
    check("Offered application is terminal (cannot be moved)", r.status == 400, r.detail)
    r = call("POST", "/api/applications/stages", {"applicationIds": [orbit_app["id"]], "stage": "SHORTLISTED"}, token=spoc2)
    check("Other SPOC cannot move this applicant (403)", r.status == 403)

    # -----------------------------------------------------------------------------------------
    section("9. Unfreeze Tickets & CCPC governance")
    divya = login(f"2026mcb1019@{DOMAIN}")
    r = call("POST", "/api/tickets", {"type": "UNFREEZE", "field": "cgpa", "requestedValue": "9.10", "justification": "short"}, token=divya)
    check("Justification shorter than 20 chars rejected", r.status == 400, r.detail)
    r = call("POST", "/api/tickets", {"type": "UNFREEZE", "field": "cgpa", "requestedValue": "9.10",
                                       "justification": "Semester 6 re-evaluation raised my CGPA; revised grade card attached."}, token=divya)
    ticket = r.json["id"] if r.status == 200 else None
    check("Verified student raises an unfreeze ticket", r.status == 200 and r.json["status"] == "OPEN", r.detail)
    r = call("POST", "/api/tickets", {"type": "CORRECTION", "field": "class10", "requestedValue": "97",
                                       "justification": "Another request while the first one is still open."}, token=divya)
    check("Only one open ticket per student", r.status == 409, r.detail)
    r = call("POST", "/api/tickets", {"type": "UNFREEZE", "field": "cgpa", "requestedValue": "9",
                                       "justification": "I would like to update my CGPA after placement."}, token=student)
    check("Policy-locked (placed) student cannot raise tickets", r.status == 400, r.detail)
    r = call("POST", f"/api/tickets/{ticket}/resolve", {"decision": "APPROVED", "resolution": "Verified with the academic section."}, token=ccpc)
    check("CCPC approves → profile unfrozen for editing", r.status == 200 and r.json["status"] == "APPROVED", r.detail)
    dv = state(divya)["students"][0]
    check("Profile state is UNFROZEN_EDITING and unlocked", dv["profileState"] == "UNFROZEN_EDITING" and not dv["locked"], dv["profileState"])
    r = call("PATCH", "/api/students/2026MCB1019/profile", {"patch": {"cgpa": 9.1}}, token=divya)
    check("Student saves the corrected value", r.status == 200 and r.json["cgpa"] == 9.1, r.detail)
    r = call("POST", "/api/students/2026MCB1019/submit", token=divya)
    check("Resubmitted → back to PENDING verification", r.status == 200 and r.json["verification"] == "PENDING", r.detail)
    r = call("POST", "/api/tickets/t-03/resolve", {"decision": "REJECTED", "resolution": "Supplementary result not yet notified."}, token=ccpc)
    check("CCPC rejects a ticket with a note", r.status == 200 and r.json["status"] == "REJECTED", r.detail)

    # -----------------------------------------------------------------------------------------
    section("10. Onboarding invitations")
    r = call("POST", "/api/invitations/import", {"rows": [{"entryNo": "2026CSB1061", "name": "Aditi Verma"}, {"entryNo": "BAD123", "name": "X"}]}, token=ccpc)
    check("Fee-paid list imported (invalid entry reported)", r.status == 200 and r.json["added"] == ["2026CSB1061"] and r.json["errors"], r.detail)
    inv = next(i for i in state(ccpc)["invitations"] if i["entryNo"] == "2026CSB1061")
    r = call("POST", "/api/invitations/send", {"ids": [inv["id"]]}, token=ccpc)
    link = r.json["links"][0]["link"] if r.status == 200 else ""
    check("Invitation sent with a one-time activation link", r.status == 200 and "/activate?token=" in link, r.detail)
    token_param = link.split("token=")[-1]
    info = call("GET", f"/api/auth/invite-info?token={token_param}")
    check("Activation link resolves the invitee", info.status == 200 and info.json["entryNo"] == "2026CSB1061", info.detail)
    r = call("POST", "/api/auth/activate", {"token": token_param, "password": "aditi-secret-1"})
    new_tok = r.json.get("token") if r.status == 200 else None
    check("Student activates account and sets a password", r.status == 200 and r.json["inviteId"] == inv["id"], r.detail)
    check("Activation link is single-use", call("POST", "/api/auth/activate", {"token": token_param, "password": "another-pass"}).status == 400)
    r = call("POST", f"/api/invitations/{inv['id']}/accept", token=new_tok)
    check("Invitation accepted → DRAFT profile created", r.status == 200 and r.json["profileState"] == "DRAFT", r.detail)
    check("New student signs in with their own password", login(f"2026csb1061@{DOMAIN}", "aditi-secret-1") is not None)
    farhan = next(i for i in state(ccpc)["invitations"] if i["entryNo"] == "2026CSB1045")
    call("POST", "/api/invitations/send", {"ids": [farhan["id"]]}, token=ccpc)
    ft = call("POST", "/api/auth/demo-login", {"email": f"2026csb1045@{DOMAIN}"}).json["token"]
    r = call("POST", f"/api/invitations/{farhan['id']}/decline", token=ft)
    check("Invited student can decline", r.status == 200 and r.json["status"] == "DECLINED", r.detail)

    # -----------------------------------------------------------------------------------------
    section("11. Companies, drives & synchronized deadlines")
    r = call("POST", "/api/companies/c-08/approve", token=ccpc)
    check("CCPC approves a pending company", r.status == 200 and r.json["status"] == "APPROVED", r.detail)
    r = call("POST", "/api/companies/c-08/assign-spoc", {"spocId": f"simran.kaur@{DOMAIN}"}, token=ccpc)
    check("CCPC assigns a SPOC", r.status == 200 and r.json["spocId"] == f"simran.kaur@{DOMAIN}", r.detail)
    d04 = next(d for d in state(ccpc)["drives"] if d["id"] == "d-04")
    new_deadline = (datetime.fromisoformat(d04["deadline"]) + timedelta(days=2)).isoformat()
    r = call("POST", "/api/drives/d-04/extend", {"deadline": new_deadline, "reason": "x"}, token=spoc)
    check("Only CCPC can extend deadlines (SPOC gets 403)", r.status == 403)
    r = call("POST", "/api/drives/d-04/extend", {"deadline": d04["deadline"], "reason": "Recruiter asked"}, token=ccpc)
    check("New deadline must be later than the current one", r.status == 400, r.detail)
    r = call("POST", "/api/drives/d-04/extend", {"deadline": new_deadline, "reason": "Recruiter requested more applicants"}, token=ccpc)
    check("CCPC extends the deadline", r.status == 200 and r.json["deadline"] != d04["deadline"], r.detail)
    sd = next(d for d in state(student)["drives"] if d["id"] == "d-04")
    check("Every role sees the same stored deadline", sd["deadline"] == r.json["deadline"])
    r = call("POST", "/api/drives", {"companyId": "c-05", "role": "Flash Drive Test", "ctc": 10, "deadline": iso_in(seconds=3), "status": "OPEN",
                                      "criteria": {"minCgpa": 6, "maxBacklogs": 2, "branches": [], "gradYears": [2026]}}, token=ccpc)
    flash = r.json["id"] if r.status == 200 else None
    check("CCPC publishes a drive closing in 3 seconds", r.status == 200, r.detail)
    time.sleep(4)
    call("GET", "/api/sync", token=ccpc)
    fd = next((d for d in state(ccpc)["drives"] if d["id"] == flash), {})
    check("Deadline engine auto-closes the drive at 00:00:00", fd.get("status") == "CLOSED", str(fd.get("status")))
    r = call("POST", "/api/companies/c-07/active", {"active": False}, token=ccpc)
    check("Deactivating a company freezes its open drives", r.status == 200 and not r.json["active"], r.detail)

    # -----------------------------------------------------------------------------------------
    section("12. Users, verifier rights & SPOC dual context")
    r = call("POST", "/api/users", {"email": f"new.verifier@{DOMAIN}", "name": "Dr. Test Verifier", "role": "VERIFIER", "canVerify": False}, token=ccpc)
    check("CCPC creates a staff account", r.status == 200 and r.json["user"]["canVerify"] is False, r.detail)
    r = call("POST", "/api/users", {"email": "outsider@gmail.com", "name": "X", "role": "VERIFIER"}, token=ccpc)
    check("Staff accounts must be @iitrpr.ac.in", r.status == 400, r.detail)
    r = call("PUT", f"/api/users/new.verifier@{DOMAIN}", {"canVerify": True}, token=ccpc)
    check("CCPC grants verification rights", r.status == 200 and r.json["canVerify"] is True, r.detail)
    r = call("POST", "/api/auth/switch-to-student", token=spoc)
    feed = r.json if r.status == 200 else {}
    check("SPOC switches to own candidate feed", r.status == 200 and feed.get("userId") == "2026CSB1011" and feed.get("backTo") == f"spoc@{DOMAIN}", r.detail)
    r = call("POST", "/api/auth/switch-back", token=feed.get("token"))
    check("…and back to the SPOC workspace", r.status == 200 and r.json["role"] == "SPOC", r.detail)
    check("Non-SPOC cannot switch context (403)", call("POST", "/api/auth/switch-to-student", token=verifier).status == 403)

    # -----------------------------------------------------------------------------------------
    section("13. Analytics & audit trail")
    a = call("GET", "/api/analytics/summary", token=ccpc)
    k = a.json["kpis"] if a.status == 200 else {}
    check("Analytics summary computed from the database", a.status == 200 and k.get("placed") == 2 and k.get("offers") == 2, str(k))
    check("Branch-wise and company-wise breakdowns present", a.status == 200 and a.json["byBranch"] and a.json["byCompany"])
    acts = audit_actions(ccpc)
    needed = {"PROFILE_SUBMITTED", "DOCUMENT_UPLOADED", "PROFILE_VERIFIED", "PROFILE_LOCKED", "REVISION_REQUESTED", "APPLICATION_SUBMITTED",
              "BATCH_SHORTLIST_EXECUTED", "ROSTER_EXPORTED", "POLICY_LOCK_TRIGGERED", "UNFREEZE_REQUESTED", "TICKET_APPROVED",
              "PROFILE_UNLOCKED", "INVITATION_SENT", "INVITATION_ACCEPTED", "DEADLINE_EXTENDED", "DRIVE_CLOSED", "SPOC_ASSIGNED", "USER_CREATED"}
    missing = needed - acts
    check("Every governed action is written to the audit trail", not missing, f"missing: {sorted(missing)}")
    r = call("GET", "/api/audit/export.csv", token=ccpc)
    check("Audit trail exports as CSV", r.status == 200 and b"Log ID" in r.body)
    v1 = call("GET", "/api/sync", token=student).json["version"]
    call("PATCH", "/api/students/2026AIB1020/profile", {"patch": {"phone": "+91 98111 22335"}}, token=sana)
    v2 = call("GET", "/api/sync", token=student).json["version"]
    check("Live-sync version advances on every change (no stale views)", v2 > v1, f"{v1} → {v2}")

    if db_check:
        section("14. Database integrity (direct SQL)")
        try:
            import psycopg  # noqa: F401
        except ImportError:
            check("psycopg is installed for --db-check", False, "pip install 'psycopg[binary]'")
        else:
            dsn = os.environ.get("DATABASE_URL", "postgresql://placematrix:placematrix@localhost:5432/placematrix").replace("postgresql+psycopg://", "postgresql://")
            with psycopg.connect(dsn, autocommit=True) as conn:
                for sql, label in (("UPDATE audit_logs SET description = 'tampered' WHERE log_id = 1", "UPDATE"),
                                   ("DELETE FROM audit_logs WHERE log_id = 1", "DELETE")):
                    try:
                        conn.execute(sql)
                        check(f"audit_logs rejects {label} (append-only trigger)", False, "statement succeeded")
                    except Exception as exc:
                        check(f"audit_logs rejects {label} (append-only trigger)", "append-only" in str(exc), str(exc)[:80])
                try:
                    conn.execute("INSERT INTO applications (application_id, drive_id, roll, stage) VALUES ('dup-test', 'd-01', '2026AIB1026', 'APPLIED')")
                    check("UNIQUE(drive_id, roll) enforced by PostgreSQL", False, "duplicate inserted")
                except Exception as exc:
                    check("UNIQUE(drive_id, roll) enforced by PostgreSQL", "uq_applications_drive_roll" in str(exc), str(exc)[:80])
                rows = conn.execute("SELECT profile_state, count(*) FROM v_student_profile_state GROUP BY 1").fetchall()
                check("v_student_profile_state view reports the state machine", any(r[0] == "POLICY_LOCKED" for r in rows), str(rows))


def main() -> int:
    global API
    parser = argparse.ArgumentParser(description="PlaceMatrix end-to-end smoke test")
    parser.add_argument("--api", default=os.environ.get("PLACEMATRIX_API", API))
    parser.add_argument("--db-check", action="store_true", help="also run direct SQL integrity checks (needs psycopg)")
    parser.add_argument("--keep-data", action="store_true", help="do not reset demo data at the end")
    args = parser.parse_args()
    API = args.api.rstrip("/")
    print(f"{BOLD}PlaceMatrix smoke test{RESET} against {API}")
    started = time.time()
    try:
        run(args.db_check)
    except urllib.error.URLError as exc:
        print(f"\n{RED}Cannot reach the API at {API}: {exc}. Is uvicorn running?{RESET}")
        return 2
    except Exception as exc:  # unexpected crash in the test itself
        check("test run finished without crashing", False, repr(exc))
    finally:
        if not args.keep_data:
            try:
                call("POST", "/api/demo/reset")
            except Exception:
                pass
    failed = [r for r in RESULTS if not r[1]]
    print(f"\n{BOLD}{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed{RESET} in {time.time() - started:.1f}s"
          + ("" if args.keep_data else " · demo data restored"))
    for name, _, info in failed:
        print(f"  {RED}✘ {name}{RESET} {DIM}{info}{RESET}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
