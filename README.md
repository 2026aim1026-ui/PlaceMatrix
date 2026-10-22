# PlaceMatrix — Campus Placement Management Portal

A frontend-only placement portal with two experiences in one React app:

- **Student portal**: profile audit, documents, opportunity feed with live eligibility, 1-click apply and application tracking.
- **Admin portal**: role-aware desks for the **Faculty Verifier**, **SPOC** (company coordinator) and **CCPC Administrator**. Covers verification, drives, shortlisting, deadlines, invitations and the audit trail.

All data is realistic mock data stored in the browser's `localStorage`. There is no backend.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build
```

Requires Node.js 18+.

## Demo accounts

Every demo account uses the password **`demo123`**. The login page also has one-click **Quick demo login** buttons.

| Role | Email | What you'll see |
|---|---|---|
| Student | `2026aim1028@placematrix.edu` | Rohan Verma: M.Tech AI, CGPA 8.42, verified & locked |
| Faculty Verifier | `verifier@placematrix.edu` | Dr. Subrat Kar: verification queue and document review |
| SPOC | `spoc@placematrix.edu` | Ananya Sharma: assigned companies (Acme, Orbit, Vertex, Atlas), roster, parser |
| CCPC Admin | `admin@placematrix.edu` | CCPC Office: full governance access |

Other accounts you can sign in with:

- **Any seeded student** signs in with `<roll number in lowercase>@placematrix.edu`. Some useful ones:
  - `2026csb1050@placematrix.edu`: profile pending verification.
  - `2026eeb1031@placematrix.edu`: revision requested.
  - `2026aib1020@placematrix.edu`: profile not submitted yet.
- **An invited, not-yet-registered student**: `2026aib1033@placematrix.edu` lands on the invitation page, where they can accept or decline.

### Switching roles

- Click the **Simulated actor** menu (top-right avatar) or the ⇄ icon in the sidebar footer. You can switch to any demo account without logging out.
- A SPOC can also use **Switch to My Candidate Feed** to browse drives as their own student profile.
- **Log out** is in the same menu.

> Mock authentication is for demonstration only. It is **not** production security. Role restrictions are enforced in the UI and router, not on a server.

## Demo walkthrough

1. **Student**: Opportunities → apply to *Acme Systems — Software Engineer* with 1-click. The confirmation page shows the real drive. Nova Labs shows *"Minimum CGPA: 8.50; your CGPA: 8.42"*.
2. **Student**: Profile Audit → *Request correction*. This raises a ticket visible to CCPC.
3. **Verifier**: Verification Queue → open *Tanvi Joshi*. Approval is blocked by a CGPA mismatch, so request a revision. Then open *Aman Deep* → **Approve & Auto-Lock**; his profile becomes read-only in the student portal.
4. **SPOC**: Shortlist Parser → *Load sample* → **Parse**. The parser shows ready, skipped, non-applicant, duplicate and invalid tokens. Apply, then export the roster CSV.
5. **CCPC**: Governance Desk → **Extend Deadline**. The countdown updates everywhere, students are notified and an audit entry is written. Then go to Unfreeze Tickets and approve the student's ticket, which unlocks their profile.
6. **CCPC**: Onboarding Invites → *Simulate this student* on an invited row, then accept the invitation as that student.

## Routes

**Public:** `/login`

**Student**

| Route | Page |
|---|---|
| `/student/dashboard` | Dashboard: profile summary, stats, deadlines, countdown, activity |
| `/student/opportunities` | Opportunity feed: tabs, search, filters, sorting, 1-click apply, "Why?" |
| `/student/opportunities/:id` | Drive detail with an eligibility checklist |
| `/student/profile` | Profile Audit: stepper, academic record, lock, correction/unfreeze tickets |
| `/student/documents` | Academic documents, resume repository, other documents |
| `/student/applications` | My Applications: search, filter, sort, timeline, withdraw |
| `/student/applications/:id/confirmation` | Application confirmation |
| `/student/help` | Help & policy |
| `/student/invitation` | Placement invitation (for invited students only) |

**Admin** (each route is guarded by role)

| Route | Page | Roles |
|---|---|---|
| `/admin/dashboard` | Governance Desk | CCPC |
| `/admin/students` | Student Records / Verified Records | CCPC, Verifier |
| `/admin/companies` | Companies & SPOC assignment | CCPC |
| `/admin/drives` | Placement Drives | CCPC |
| `/admin/verification-queue` | Verification Queue (profiles, resumes) | CCPC, Verifier |
| `/admin/document-review/:id` | Three-column document review | CCPC, Verifier |
| `/admin/correction-requests` | Unfreeze & correction tickets | CCPC |
| `/admin/spoc/companies` | Assigned companies + Create JAF | SPOC, CCPC |
| `/admin/spoc/roster` | Applicant roster, stage management, CSV export | SPOC, CCPC |
| `/admin/spoc/bulk-shortlist` | Bulk roll-number parser | SPOC, CCPC |
| `/admin/invitations` | Onboarding invitations | CCPC |
| `/admin/audit-trail` | Central audit trail | CCPC |

## Project structure

```
src/
  app/            App.jsx (providers), router.jsx (nested routes and guards)
  components/
    layout/       AppLayout, StudentLayout, AdminLayout, Sidebar, Topbar, AccountMenu, GlobalSearch, NotificationBell
    common/       StatusBadge, StatCard, PageHeader, Breadcrumbs, Modal, ConfirmationDialog, EmptyState,
                  LoadingState, ErrorState, Pagination, SearchInput, FilterDropdown, Tabs, Countdown,
                  EligibilityBadge, ProtectedRoute, RoleGuard, ...
    forms/        FormField, FileUpload
    tables/       DataTable (sorting and pagination)
    documents/    DocumentPreview, MockDocument
    student/      OpportunityCard, EligibilityChecklist, ApplicationTimeline, useApply
    admin/        DriveFormModal, ExtendDeadlineModal, StudentDetailModal
  pages/          auth/, student/, admin/
  data/           seedData.js (mock dataset), mockRepository.js (localStorage repository and workflows)
  context/        DataContext, AuthContext, ToastContext
  hooks/          useCurrentUser, useStudentData, useTableState, useNow
  utils/          eligibility.js, bulkParser.js, csvExport.js, validation.js, dateUtils.js, format.js
  constants/      statuses, stages, roles, permissions, navigation
  styles/         index.css (Tailwind and design tokens)
```

**Stack:** React 18, Vite 5, Tailwind CSS 3, React Router 6, Lucide React, Recharts, React Hook Form.

## Data and persistence

- The seed data includes 15 students, 8 companies, 10 drives (open, frozen, closed and draft), 23 applications, documents in every status, tickets, invitations and audit events. Deadlines are generated **relative to first load**, so countdowns are always live.
- On first run the dataset is seeded into `localStorage` (`placematrix.db.v1`). Later reloads keep your changes.
- Every change goes through `src/data/mockRepository.js`. It validates the action, updates related records, appends audit events and notifies the UI, so the student and admin views stay in sync.
- **Reset Demo Data** restores the original dataset. It is in the account menu and on the login page.
- Eligibility is computed from the student's record and each drive's criteria (CGPA, branches, backlogs, graduation year, degree, skills, verification and the one-offer policy). See `src/utils/eligibility.js`.

## Frontend-only limitations

- **No real authentication or authorization.** Roles and permissions are enforced only in the browser.
- **Data is local to one browser.** Changes are not shared across browsers, devices or users. Clearing site data resets everything.
- **Uploaded files never leave the browser.**
  - Small files (under ~300 KB) are kept in `localStorage`.
  - Larger files are kept in memory only for the current session.
  - Seeded documents use a generated mock preview, clearly marked as a demo rendering.
- **The audit log is append-only in the UI only.** It is not tamper-proof.
- **Notifications are simulated.** They appear in-app; no email is sent.
