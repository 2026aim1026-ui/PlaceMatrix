# PlaceMatrix — In-house Placement Portal for CDPC, IIT Ropar

A full-stack replacement for the third-party placement SaaS: students sign in with their **@iitrpr.ac.in**
account, submit a Profile Audit backed by PDF proofs, get verified once by a faculty/staff verifier, and then
apply to drives in one click. SPOCs run the companies they brought to campus; CCPC governs everything; every
action lands in an append-only audit trail.

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS, React Router, Recharts (your existing UI, now wired to the API) |
| Backend | Python **FastAPI**, SQLAlchemy 2, JWT sessions, PBKDF2 password hashing |
| Database | **PostgreSQL** (11 tables, CHECK / UNIQUE / partial-unique constraints, append-only trigger, reporting view) |
| Files | Uploaded PDFs/images stored on the server (`backend/uploads/`), streamed only to authorised roles |

```
Browser (React) ──/api──▶ FastAPI (backend/app) ──SQLAlchemy──▶ PostgreSQL
      ▲  polls /api/sync every 4 s                  └─ uploads/  (document vault files)
```

---

## 1. Prerequisites

- **Python 3.10+** (`python --version`)
- **Node.js 18+** (`node --version`)
- **PostgreSQL 14+** — either installed locally, or run it with **Docker** (easiest)

## 2. Set up the database

**Option A — Docker (recommended).** From the project root:

```bash
docker compose up -d db
```

This starts PostgreSQL 16 on port 5432 with database `placematrix`, user `placematrix`, password `placematrix`.

**Option B — your own PostgreSQL.** Open `psql` as the `postgres` superuser and run:

```sql
CREATE USER placematrix WITH PASSWORD 'placematrix';
CREATE DATABASE placematrix OWNER placematrix;
```

(Any other name/password works — just put it in `DATABASE_URL` in step 3.)

## 3. Run the backend (FastAPI)

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate        macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # Windows: copy .env.example .env   (edit DATABASE_URL if needed)

python -m app.seed              # creates all tables + loads the demo data and sample PDF proofs
uvicorn app.main:app --reload --port 8000
```

Check it:

- http://localhost:8000/api/health → `{"status":"ok","database":"connected"}`
- http://localhost:8000/docs → interactive Swagger documentation of every endpoint

> `python -m app.seed` **wipes and recreates** the database. Run it any time you want a clean demo.
> To create empty tables without demo data use `python -m app.init_db`.

## 4. Run the frontend (React)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Vite forwards every `/api` request to the backend on port 8000.

---

## 5. Check that everything works

### 5a. Automated check (about 10 seconds)

With the backend running, in `backend/` (venv active):

```bash
python scripts/smoke_test.py --db-check
```

It drives the real API through every module — authentication, RBAC, profile audit, document vault, verification,
eligibility, 1-click apply, bulk shortlist, CSV export, one-offer policy lock, tickets, invitations, deadlines,
users, analytics, audit trail — and then tries to tamper with the database directly. Expected ending:

```
104/104 checks passed in 7.0s · demo data restored
```

Each line prints `PASS` / `FAIL` with the reason, so a failure points at the exact feature. (It resets the demo
data before and after, so run it on a demo database, not production data.)

### 5b. Demo accounts

All demo accounts use the password **`demo123`**. The login page also has one-click **Quick demo login** buttons,
and the account menu (top right) can switch between them.

| Role | Email | What you'll see |
|---|---|---|
| Student | `2026aim1028@iitrpr.ac.in` | Rohan Verma — M.Tech AI, CGPA 8.42, verified & locked |
| Faculty Verifier | `verifier@iitrpr.ac.in` | Dr. Subrat Kar — verification queue with rights |
| Verifier (view-only) | `staff.office@iitrpr.ac.in` | Rajesh Kumar — can view, cannot approve (until CCPC grants rights) |
| SPOC | `spoc@iitrpr.ac.in` | Ananya Sharma — Acme, Orbit, Vertex, Atlas; linked to student 2026CSB1011 |
| SPOC | `simran.kaur@iitrpr.ac.in` | Simran Kaur — Nova Labs, Helix AI, Quantum Grid |
| CCPC Admin | `ccpc@iitrpr.ac.in` | CCPC Office — full governance access |

Every seeded student signs in with `<roll number>@iitrpr.ac.in`, e.g. `2026csb1050@iitrpr.ac.in` (pending
verification), `2026eeb1031@iitrpr.ac.in` (revision requested), `2026aib1020@iitrpr.ac.in` (not submitted yet).
A non-`@iitrpr.ac.in` email is always rejected.

### 5c. Manual walkthrough — one check per module

Open two browsers (or a normal + private window) signed in as different roles to watch changes appear in the
other window within a few seconds — no refresh needed.

**Student Profile & Academic Audit**
1. Sign in as `2026aib1020@iitrpr.ac.in` (Sana) → **Profile Audit**. *Submit for verification* is disabled and
   lists what is missing (Class 12 marksheet, resume).
2. Edit a value and save; try a CGPA of 11 → rejected by validation.

**Document Vault & Resume Repository**
3. **Documents** → upload the Class 12 marksheet and a resume (any PDF). The progress bar is the real upload.
   Click **View** — the PDF is streamed from the server. The first resume becomes the default for 1-click apply.
4. Back in **Profile Audit**, submit → status becomes *Pending*, academic fields become read-only.
5. As Rohan (`2026aim1028@…`), academic documents show *Locked*; a new resume goes to the verifier's queue.

**Faculty/Staff Verification Workflow**
6. Sign in as `verifier@iitrpr.ac.in` → **Verification Queue** → open **Tanvi Joshi**. Her grade card PDF says
   CGPA 7.82 while she claimed 8.10: the row is red and **Approve & Auto-Lock** is disabled. Write a remark →
   **Request Revision**. Sana's profile (step 4) is now in the queue too.
7. Open **Aman Deep** → **Approve & Auto-Lock**. His profile is verified and locked in the student portal.
8. Sign in as `staff.office@iitrpr.ac.in` → the same screens are view-only.

**SPOC Roster & Bulk Shortlist Parser**
9. Sign in as `spoc@iitrpr.ac.in`. You only see Acme, Orbit, Vertex and Atlas (workspace isolation).
10. **Shortlist Parser** → *Load sample* → **Parse**. Tokens are classified as Ready / Skipped / Not applicant /
    Duplicate / Invalid by the server. **Apply** moves only the ready rows; the roster below updates.
11. **Export Roster (CSV)** downloads a UTF-8 CSV generated by the server (quoted cells, formula-safe).
12. **Assigned Companies** → *Create JAF* publishes a drive; students are notified.
13. *Switch to My Candidate Feed* opens Ananya's own student view; *Back to SPOC workspace* returns.

**One-Offer Policy Lock**
14. As the SPOC, **Applicant Roster** → drive *Orbit Tech — SDE-1* → move **2026AIM1028** to **Offered**.
15. As Rohan: he is *Placed*, every other active application shows *Withdrawn (one-offer policy)*, and applying to
    any other drive is refused.

**Unfreeze Tickets & Onboarding Invites**
16. As a verified student (e.g. `2026mcb1019@…`) → **Profile Audit** → *Request unfreeze* with a justification.
17. As CCPC → **Unfreeze Tickets** → open it → **Approve & unlock**. The student can now edit and resubmit.
18. As CCPC → **Onboarding Invites** → *Add fee-paid students* (e.g. `2026CSB1061, Aditi Verma`) → *Send
    invitation*. The one-time **activation link** is copied to your clipboard (use *Copy link* later).
19. Open the link in a private window → set a password → **Accept & create profile** → the new student lands on
    an empty Profile Audit.

**Analytics & Audit Trail**
20. As CCPC → **Analytics**: placement rate by branch, funnel, CTC bands, company-wise outcomes — computed
    from PostgreSQL. **Audit Trail** lists every action above; *Full export* downloads it as CSV.
21. **Governance Desk** → *Extend Deadline* on a drive: the countdown updates for every role.
22. **Users & Roles**: add a verifier, grant/revoke verification rights, deactivate an account.

### 5d. Look inside the database

```bash
psql postgresql://placematrix:placematrix@localhost:5432/placematrix
```

```sql
\dt                                                     -- the 11 tables
SELECT roll, name, verification, locked, placement FROM students ORDER BY roll;
SELECT * FROM v_student_profile_state;                  -- report's state machine per student
SELECT ts, actor, action_type, description FROM audit_logs ORDER BY log_id DESC LIMIT 15;
SELECT a.roll, d.role, a.stage FROM applications a JOIN placement_drives d USING (drive_id) ORDER BY a.roll;
UPDATE audit_logs SET description = 'x' WHERE log_id = 1;   -- ERROR: audit_logs is append-only
```

---

## 6. Database design (PostgreSQL)

The eight tables from the project report plus three supporting tables. Full DDL: `backend/sql/schema.sql`.

| Table | Key columns | Integrity rules |
|---|---|---|
| `users` | **email** PK, role, can_verify, is_active, password_hash, linked_student_roll | role ∈ {STUDENT, VERIFIER, SPOC, CCPC}; email lower-case |
| `students` | **roll** PK, user_email FK→users, branch, degree, cgpa, sem_cgpa[], class10, class12, backlogs, verification, locked, verified_by, placement, placed_company, proof (JSONB), default_resume_id | CGPA 0–10, % 0–100, backlogs ≥ 0, *locked ⇒ verified* |
| `documents` | **doc_id** PK, roll FK, doc_type, file_path, status, remarks, claimed_value, is_default | one proof per academic type per student; one default resume per student; default must be a resume |
| `companies` | **company_id** PK, name, recruiter_email, assigned_spoc FK→users, status, active, approved_at | case-insensitive unique name |
| `placement_drives` | **drive_id** PK, company_id FK, role, ctc, min_cgpa, allowed_branches[], max_backlogs, grad_years[], degrees[], skills[], close_at, status | ctc > 0; status ∈ {DRAFT, OPEN, FROZEN, CLOSED} |
| `applications` | **application_id** PK, drive_id FK, roll FK, resume_doc_id FK, stage, applied_at | **UNIQUE(drive_id, roll)** — no duplicate applications |
| `application_events` | event_id PK, application_id FK, stage, at, actor, note | stage history / timeline |
| `unfreeze_tickets` | **ticket_id** PK, roll FK, ticket_type, field, justification, status, resolved_by | justification ≥ 20 chars; **one OPEN ticket per student** |
| `audit_logs` | **log_id** PK, ts, actor, actor_email, actor_role, entity, action_type, description | **append-only**: a trigger rejects every UPDATE / DELETE |
| `invitations` | **invitation_id** PK, entry_no UNIQUE, email UNIQUE, status, invite_token, token_expires_at, roll FK | fee-paid list + one-time activation link |
| `notifications` | notification_id PK, roll FK, message, link, is_read | per-student alerts |

**Profile state machine** (exposed as `profileState` in the API and the `v_student_profile_state` view):

| Stored columns | State |
|---|---|
| verification = NOT_SUBMITTED | DRAFT |
| verification = PENDING | PENDING_VERIFICATION |
| verification = VERIFIED and locked | VERIFIED_LOCKED |
| verification = REVISION / REJECTED | REVISION_REQUIRED |
| REVISION after a CCPC-approved ticket | UNFROZEN_EDITING |
| placement = PLACED | POLICY_LOCKED (terminal) |

## 7. Business rules enforced by the server

- **Sign-in**: only `@iitrpr.ac.in`; invited students activate with a one-time link (or Google sign-in when
  configured); fee-paid-but-not-invited and declined students cannot sign in.
- **Least privilege**: `GET /api/state` returns a different slice per role — a student sees only their own
  record; a SPOC only their companies, drives and applicants; a verifier students + documents (no tickets,
  invitations or recruiter contacts); CCPC everything. Every mutation re-checks the role on the server.
- **Verification**: approval is refused while any claimed value differs from the proof value; approval
  auto-locks the record; verifiers need `can_verify` (granted by CCPC).
- **Eligibility**: CGPA ≥ cutoff ∧ branch allowed ∧ backlogs ≤ limit ∧ batch ∧ degree ∧ skills ∧ verified ∧
  not placed; re-checked atomically on apply with the student row locked.
- **Pipeline**: forward-only (Applied → Under Review → Shortlisted → Assessment → Interview → Offered);
  Rejected/Withdrawn from any non-terminal stage; Offered/Rejected/Withdrawn are terminal.
- **One-offer policy lock**: moving a candidate to Offered marks them PLACED and withdraws all their other
  active applications in the same transaction; a second offer is skipped.
- **Deadlines**: one stored `close_at` per drive; only CCPC can extend (must be later, reason required, everyone
  notified); OPEN drives auto-close at the deadline (`DRIVE_CLOSED` by *System Engine*).
- **Exports**: CSVs are UTF-8 with BOM, every cell quoted, and cells starting with `= + - @` are neutralised.
- **Uploads**: PDF/PNG/JPG only (checked by content, not just extension), max 5 MB.

## 8. API overview

Interactive docs with request/response schemas: **http://localhost:8000/docs**.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `/demo-login`, `/google`, `/activate`, `GET /api/auth/invite-info`, `GET /api/auth/me`, `POST /api/auth/switch-to-student`, `/switch-back`, `/change-password` |
| State & sync | `GET /api/state` (role-scoped snapshot), `GET /api/sync`, `GET /api/config`, `GET /api/health`, `POST /api/notifications/read-all` |
| Profile audit | `PATCH /api/students/{roll}/profile`, `POST /api/students/{roll}/submit` |
| Document vault | `POST /api/documents` (multipart), `DELETE /api/documents/{id}`, `POST /api/documents/{id}/default`, `GET /api/documents/{id}/file`, `POST /api/documents/{id}/review` |
| Verification | `PUT /api/verification/{roll}/proof`, `POST /api/verification/{roll}/approve`, `/revision`, `/reject` |
| Tickets | `POST /api/tickets`, `POST /api/tickets/{id}/resolve` |
| Companies & drives | `POST /api/companies`, `/companies/{id}/approve`, `/assign-spoc`, `/active`; `POST /api/drives`, `/drives/{id}/status`, `/drives/{id}/extend`; `GET /api/drives/eligible` |
| Applications | `POST /api/applications/apply`, `/applications/{id}/withdraw`, `/applications/stages` |
| SPOC tools | `POST /api/spoc/bulk-shortlist/preview`, `POST /api/spoc/bulk-shortlist`, `GET /api/drives/{id}/roster.csv` |
| Invitations | `POST /api/invitations/import`, `/send`, `/{id}/link`, `/{id}/accept`, `/{id}/decline` |
| Admin | `POST /api/users`, `PUT /api/users/{email}`, `POST /api/users/{email}/reset-password`, `GET /api/analytics/summary`, `GET /api/audit/export.csv`, `POST /api/audit/export-log` |
| Demo | `POST /api/demo/reset` (only when `DEMO_MODE=true`) |

## 9. Configuration & going to production

All settings live in `backend/.env` (see `.env.example`). Before a real deployment:

- `DEMO_MODE=false` — removes quick logins, account switching and data reset.
- `SECRET_KEY=<long random string>` and a strong database password.
- `GOOGLE_CLIENT_ID=…` to show **Sign in with Google** (restricted to `@iitrpr.ac.in`).
- `SMTP_HOST/USER/PASSWORD` to email activation links; without SMTP, CCPC copies links from *Onboarding Invites*.
- `FRONTEND_URL` / `CORS_ORIGINS` set to the real site address; build the UI with `npm run build` and serve
  `frontend/dist/` behind the same domain as the API (or set `VITE_API_URL`).
- Back up the PostgreSQL database **and** the `backend/uploads/` folder.

## 10. Project structure

```
PlaceMatrix/
├── docker-compose.yml          PostgreSQL 16 for local development
├── backend/
│   ├── app/
│   │   ├── main.py             FastAPI app, CORS, routers
│   │   ├── config.py           settings from .env
│   │   ├── database.py         engine / sessions
│   │   ├── models.py           SQLAlchemy models = the PostgreSQL schema
│   │   ├── init_db.py          create tables + append-only trigger + state view
│   │   ├── seed.py             demo dataset (+ pdfgen.py for sample proof PDFs)
│   │   ├── rules.py            eligibility, transitions, claim comparison, shortlist parser
│   │   ├── security.py         password hashing, JWT
│   │   ├── services.py         actor/RBAC, audit log, notifications, deadline engine
│   │   ├── serializers.py      DB rows → JSON for the UI
│   │   └── routers/            auth, state, profile, verification, companies, applications,
│   │                           invitations, admin (users/analytics/audit), demo
│   ├── scripts/smoke_test.py   end-to-end checker (stdlib only)
│   ├── sql/schema.sql          generated DDL for reference
│   ├── uploads/                stored documents
│   └── requirements.txt
└── frontend/                   React app (see frontend/README.md for the API wiring)
```

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| `connection refused` on port 5432 | PostgreSQL isn't running: `docker compose up -d db` (or start your local service) |
| `password authentication failed` | `DATABASE_URL` in `backend/.env` doesn't match your database user/password |
| UI shows "Could not load PlaceMatrix data" / "Cannot reach the server" | Start the backend on port 8000 (or set `VITE_PROXY_TARGET` before `npm run dev`) |
| `pip install` fails building psycopg | Upgrade pip (`python -m pip install -U pip`) so the binary wheel is used |
| Smoke test says demo mode is off | Set `DEMO_MODE=true` in `backend/.env` and restart uvicorn |
| Want a clean slate | `python -m app.seed` (or *Reset demo data* in the account menu) |
