# PlaceMatrix — In-house Placement Portal for CDPC, IIT Ropar

A full-stack replacement for the third-party placement SaaS: students sign in with their **@iitrpr.ac.in**
account, submit a Profile Audit backed by PDF proofs, get verified once by a faculty/staff verifier, and then
apply to drives in one click. SPOCs run the companies they brought to campus; CCPC governs everything; every
action lands in an append-only audit trail.

> **New in version 1.1** — CCPC can change the SPOC and verifier of any recruitment (even while its drives are
> running), Admin and SPOCs can email students through your own SMTP server (placement invitations and custom
> emails), students keep a library of several resumes and pick one for every application (a frozen copy is stored
> with the application), and direct database edits appear on open pages within about 3 seconds.
> **Beginner step-by-step setup (database, migrations, Gmail SMTP, how to use each feature):
> [`PLACEMATRIX_FEATURE_SETUP_GUIDE.txt`](PLACEMATRIX_FEATURE_SETUP_GUIDE.txt).**

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS, React Router, Recharts (your existing UI, now wired to the API) |
| Backend | Python **FastAPI**, SQLAlchemy 2, JWT sessions, PBKDF2 password hashing |
| Database | **PostgreSQL** (15 tables, CHECK / UNIQUE / partial-unique constraints, append-only trigger, reporting view, change-notification triggers, versioned migrations) |
| Email | Python `smtplib` through **your** SMTP server (Gmail, Outlook, institute relay) — configured only via `backend/.env` |
| Files | Uploaded PDFs/images stored on the server (`backend/uploads/`), streamed only to authorised roles; a frozen copy of the resume submitted with each application in `uploads/submissions/` |

```
Browser (React) ──/api──▶ FastAPI (backend/app) ──SQLAlchemy──▶ PostgreSQL
      ▲  polls /api/sync every 3 s       │  ▲          (triggers → NOTIFY pm_changes on every table)
      │                                  │  └── LISTEN thread bumps the sync version on any change,
      │                                  │      including edits made directly in psql / pgAdmin
      └──────── emails ◀── SMTP server ◀─┘      uploads/  (document vault + submitted resume copies)
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

python -m app.seed              # FIRST TIME ONLY: creates all tables + loads demo data and sample PDFs
uvicorn app.main:app --reload --port 8000
```

**Already have a PlaceMatrix database with data you want to keep?** Do *not* run the seed. Upgrade it instead:

```bash
python -m app.migrate --status   # shows which schema versions are applied
python -m app.migrate            # applies the missing ones (adds tables/columns only — never deletes data)
```

The backend also applies pending migrations automatically at start-up (`AUTO_MIGRATE=true`), so simply
restarting uvicorn upgrades the schema too.

Check it:

- http://localhost:8000/api/health → `{"status":"ok","database":"connected"}`
- http://localhost:8000/docs → interactive Swagger documentation of every endpoint

> `python -m app.seed` **wipes and recreates** the database. Run it any time you want a clean demo.
> To create empty tables without demo data use `python -m app.init_db` (also destructive).
> To enable email, fill in the `SMTP_*` values in `backend/.env` (part C of the setup guide) and restart.

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
users, analytics, audit trail, **multiple resumes, resume choice per application and the frozen submitted copy,
access to submitted resumes, SPOC/verifier reassignment of running recruitments, email authorization and
sending, and direct SQL edits reaching the API** — and then tries to tamper with the database directly.
Expected ending:

```
167/167 checks passed in 12.0s · demo data restored
```

The email checks only *send* when the backend has SMTP configured. To test email without a real mailbox, run the
included local SMTP server in a third terminal and start the backend against it:

```bash
python scripts/dev_smtp_server.py                     # listens on 127.0.0.1:1025, saves every email to backend/sent_emails/
# start the backend with:  SMTP_HOST=127.0.0.1  SMTP_PORT=1025  SMTP_SECURITY=none  (in backend/.env)
```

Each line prints `PASS` / `FAIL` with the reason, so a failure points at the exact feature. (It resets the demo
data before and after, so run it on a demo database, not production data.)

### 5b. Demo accounts

All demo accounts use the password **`demo123`**. The login page also has one-click **Quick demo login** buttons,
and the account menu (top right) can switch between them.

| Role | Email | What you'll see |
|---|---|---|
| Student | `2026aim1028@iitrpr.ac.in` | Rohan Verma — M.Tech AI, CGPA 8.42, verified & locked |
| Faculty Verifier | `verifier@iitrpr.ac.in` | Dr. Subrat Kar — verification queue with rights; assigned verifier of Acme, Orbit, Vertex, Atlas |
| Staff Verifier | `neha.gupta@iitrpr.ac.in` | Prof. Neha Gupta — assigned verifier of Nova Labs, Helix AI, Quantum Grid |
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

**Multiple resumes & resume choice (new)**
23. As Ishita (`2026aib1007@…`) → **Documents** → *Add resume* twice (any PDFs). Use *Rename*, *New version* and
    *Set default*; a non-PDF is refused. Approve the new resumes as `verifier@…` (Verification Desk).
24. **Opportunities** → *Apply — choose resume* on Orbit SDE-1 → pick one, *Preview*, submit. Apply to another
    drive with a different resume. **My Applications** shows which resume went with each application and
    *View submitted copy* opens the frozen file — it stays the same even if you delete or replace the resume.

**Change SPOC / verifier of a running recruitment (new)**
25. As CCPC → **Recruitments** → *Change* next to the SPOC of Acme Systems → choose Simran Kaur (and a new
    verifier), add a reason → *Save assignment*. The history icon shows the change; the new assignees get an
    email (when SMTP is configured).
26. Sign in as `spoc@…`: Acme is gone from Assigned Companies; as `simran.kaur@…` it appears, with its applicants.

**Email students (new — needs SMTP, see the setup guide)**
27. As CCPC → **Email Center** → *Test* sends a test email and shows the exact error if the SMTP settings are wrong.
28. **Recruitments** → *Invite* on a recruitment with an open drive → select students → edit subject/body
    (placeholders such as `{first_name}`, `{company}`, `{link}`) → *Send invitation* → per-student sent/failed
    results; every email is listed in **Email Center**.
29. As a SPOC → **Applicant Roster** → tick applicants → *Email selected*. A SPOC can only email students of the
    recruitments assigned to them; the server refuses anything else.

**Live database sync (new)**
30. Keep any page open, then in `psql` run e.g.
    `UPDATE companies SET name = 'Acme Systems Pvt Ltd' WHERE company_id = 'c-01';` — the page shows the new name
    within ~3 seconds without reloading.

### 5d. Look inside the database

```bash
psql postgresql://placematrix:placematrix@localhost:5432/placematrix
```

```sql
\dt                                                     -- the 15 tables
SELECT roll, name, verification, locked, placement FROM students ORDER BY roll;
SELECT * FROM v_student_profile_state;                  -- report's state machine per student
SELECT ts, actor, action_type, description FROM audit_logs ORDER BY log_id DESC LIMIT 15;
SELECT a.roll, d.role, a.stage FROM applications a JOIN placement_drives d USING (drive_id) ORDER BY a.roll;
UPDATE audit_logs SET description = 'x' WHERE log_id = 1;   -- ERROR: audit_logs is append-only
SELECT * FROM schema_migrations;                         -- applied schema versions
SELECT company_id, assigned_spoc, assigned_verifier FROM companies;
SELECT company_id, assignment_role, previous_email, new_email, reason, changed_at FROM assignment_history;
SELECT created_at, kind, status, recipient_email, subject, error FROM email_logs ORDER BY created_at DESC;
SELECT application_id, roll, resume_label, resume_file_name, resume_version, resume_sha256 FROM applications;
```

---

## 6. Database design (PostgreSQL)

The eight tables from the project report plus supporting tables. Full DDL: `backend/sql/schema.sql`.
Schema changes are versioned migrations in `backend/app/migrations.py` (recorded in `schema_migrations`).

| Table | Key columns | Integrity rules |
|---|---|---|
| `users` | **email** PK, role, can_verify, is_active, password_hash, linked_student_roll | role ∈ {STUDENT, VERIFIER, SPOC, CCPC}; email lower-case |
| `students` | **roll** PK, user_email FK→users, branch, degree, cgpa, sem_cgpa[], class10, class12, backlogs, verification, locked, verified_by, placement, placed_company, proof (JSONB), default_resume_id | CGPA 0–10, % 0–100, backlogs ≥ 0, *locked ⇒ verified* |
| `documents` | **doc_id** PK, roll FK, doc_type, label, file_path, version, status, remarks, claimed_value, is_default | one proof per academic type per student; one default resume per student; default must be a resume; up to `MAX_RESUMES` resumes |
| `companies` | **company_id** PK, name, recruiter_email, assigned_spoc FK→users, **assigned_verifier** FK→users, status, active, approved_at | case-insensitive unique name |
| `placement_drives` | **drive_id** PK, company_id FK, role, ctc, min_cgpa, allowed_branches[], max_backlogs, grad_years[], degrees[], skills[], close_at, status | ctc > 0; status ∈ {DRAFT, OPEN, FROZEN, CLOSED} |
| `applications` | **application_id** PK, drive_id FK, roll FK, resume_doc_id FK, stage, applied_at, **resume snapshot**: resume_label, resume_file_name, resume_file_type, resume_size, resume_sha256, resume_version, resume_snapshot_path, resume_submitted_at | **UNIQUE(drive_id, roll)** — no duplicate applications; the snapshot is never changed by later resume edits |
| `application_events` | event_id PK, application_id FK, stage, at, actor, note | stage history / timeline |
| `unfreeze_tickets` | **ticket_id** PK, roll FK, ticket_type, field, justification, status, resolved_by | justification ≥ 20 chars; **one OPEN ticket per student** |
| `audit_logs` | **log_id** PK, ts, actor, actor_email, actor_role, entity, action_type, description | **append-only**: a trigger rejects every UPDATE / DELETE |
| `invitations` | **invitation_id** PK, entry_no UNIQUE, email UNIQUE, status, invite_token, token_expires_at, roll FK | fee-paid list + one-time activation link |
| `notifications` | notification_id PK, roll FK, message, link, is_read | per-student alerts |
| `assignment_history` | history_id PK, company_id FK, assignment_role (SPOC/VERIFIER), previous_email, new_email, reason, changed_by, changed_at | who changed which recruitment assignment, when and why |
| `email_logs` | email_id PK, batch_id, kind (INVITATION/CUSTOM/TEST/ASSIGNMENT/ONBOARDING), status (SENT/FAILED), error, sender_email, recipient_email, recipient_roll FK, company_id FK, drive_id FK, subject, body, created_at | one row per recipient of every email sent |
| `schema_migrations` | version PK, name, applied_at | applied migration versions |
| `pm_sync` | id PK, version | bumped on every data change (live refresh) |

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
- **Uploads**: PDF/PNG/JPG only (checked by content, not just extension), max 5 MB; resumes must be real PDFs
  (header and end marker checked, embedded JavaScript / launch actions refused); file names are sanitised.
- **Recruitment assignments**: only CCPC changes a recruitment's SPOC or verifier (`assignment_history` + audit
  log). Access follows the *current* assignment on every request: the previous SPOC/verifier loses access to that
  recruitment immediately, the new one gains it; applications, stages and history are untouched.
- **Resumes per application**: a student can only apply with one of their own resumes; the file is copied into
  `uploads/submissions/<application>/` with its SHA-256 and metadata, so editing, re-versioning or deleting the
  resume later never changes what the recruiter sees. Submitted copies are visible to the student, CCPC, and the
  recruitment's current SPOC and verifier only.
- **Email**: CCPC can email any student; a SPOC only students who applied to, or are eligible for, a drive of a
  recruitment assigned to them; students and verifiers cannot send. Invitations require an open drive. Every
  recipient's result (sent / failed + reason) is stored in `email_logs`. SMTP credentials are read only from the
  environment and are never returned by the API.

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
| Applications | `POST /api/applications/apply` (with `resumeId`), `/applications/{id}/withdraw`, `/applications/stages`; `GET /api/applications/{id}/resume` (submitted copy); `GET /api/drives/{id}/resumes.zip` |
| Resumes | `PATCH /api/documents/{id}` (rename), `POST /api/documents/{id}/version` (upload new version) |
| Recruitments | `PUT /api/recruitments/{companyId}/assignment` (change SPOC / verifier), `GET /api/recruitments/{companyId}/history` |
| Email | `GET /api/email/status`, `POST /api/email/test`, `GET /api/email/recipients`, `POST /api/email/send`, `GET /api/email/logs` |
| SPOC tools | `POST /api/spoc/bulk-shortlist/preview`, `POST /api/spoc/bulk-shortlist`, `GET /api/drives/{id}/roster.csv` |
| Invitations | `POST /api/invitations/import`, `/send`, `/{id}/link`, `/{id}/accept`, `/{id}/decline` |
| Admin | `POST /api/users`, `PUT /api/users/{email}`, `POST /api/users/{email}/reset-password`, `GET /api/analytics/summary`, `GET /api/audit/export.csv`, `POST /api/audit/export-log` |
| Demo | `POST /api/demo/reset` (only when `DEMO_MODE=true`) |

## 9. Configuration & going to production

All settings live in `backend/.env` (see `.env.example`). Before a real deployment:

- `DEMO_MODE=false` — removes quick logins, account switching and data reset.
- `SECRET_KEY=<long random string>` and a strong database password.
- `GOOGLE_CLIENT_ID=…` to show **Sign in with Google** (restricted to `@iitrpr.ac.in`).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`
  to send email (invitations, custom emails, activation links, assignment notices). Gmail walkthrough with App
  Password: `PLACEMATRIX_FEATURE_SETUP_GUIDE.txt`, part C. Without SMTP, email features show "Not configured" and
  CCPC copies activation links from *Onboarding Invites*.
- `MAX_RESUMES` (default 10), `EMAIL_MAX_RECIPIENTS` (200), `AUTO_MIGRATE` (true), `REALTIME_SYNC` (true).
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
│   │   ├── init_db.py          drop & recreate the schema (runs every migration)
│   │   ├── migrations.py       versioned, non-destructive schema migrations
│   │   ├── migrate.py          `python -m app.migrate [--status]`
│   │   ├── realtime.py         LISTEN thread: direct DB edits → live refresh
│   │   ├── emailer.py          SMTP client, templates, friendly error messages
│   │   ├── seed.py             demo dataset (+ pdfgen.py for sample proof PDFs)
│   │   ├── rules.py            eligibility, transitions, claim comparison, shortlist parser
│   │   ├── security.py         password hashing, JWT
│   │   ├── services.py         actor/RBAC, audit log, notifications, deadline engine
│   │   ├── serializers.py      DB rows → JSON for the UI
│   │   └── routers/            auth, state, profile, verification, companies, applications,
│   │                           recruitments, email, invitations, admin (users/analytics/audit), demo
│   ├── scripts/smoke_test.py   end-to-end checker (stdlib only)
│   ├── scripts/dev_smtp_server.py  local test SMTP server that saves emails as .eml files
│   ├── sql/schema.sql          generated DDL for reference
│   ├── uploads/                stored documents
│   └── requirements.txt
├── frontend/                   React app (see frontend/README.md for the API wiring)
└── PLACEMATRIX_FEATURE_SETUP_GUIDE.txt   beginner guide: setup, migrations, SMTP, admin & student use
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
| Email Center says *Not configured* | Fill in `SMTP_HOST` (and the other `SMTP_*` values) in `backend/.env`, then restart uvicorn |
| *SMTP login failed* / `535` | Gmail needs a 16-character **App Password** (2-Step Verification must be on), not your normal password |
| *Connection refused* / timeout to the SMTP server | Check `SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURITY` (587 + starttls or 465 + ssl); some networks block outgoing SMTP |
| Column/table "does not exist" after updating the code | Run `python -m app.migrate` in `backend/` (or restart the backend with `AUTO_MIGRATE=true`) |
| *Apply* has no resume to choose | Upload a PDF resume in **Documents**; only resumes a verifier has **approved** can be submitted |
| Full guide | `PLACEMATRIX_FEATURE_SETUP_GUIDE.txt`, part F |
