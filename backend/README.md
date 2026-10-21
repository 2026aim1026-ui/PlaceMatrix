# PlaceMatrix FastAPI backend

## Requirements
- Python 3.11 or newer
- A Google OAuth 2.0 **Web application** client ID
- A matching frontend origin configured in Google Cloud Console

## Setup (Windows PowerShell)
From the `backend` directory:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` and set `GOOGLE_CLIENT_ID` to the same Google Web Client ID used by the frontend. Change `JWT_SECRET` to a long random value. Add actual authorized IIT Ropar staff email addresses to `CCPC_EMAILS`, `VERIFIER_EMAILS`, and `SPOC_EMAILS` (comma-separated). Do not put role lists in frontend code. Everyone else with a verified `@iitrpr.ac.in` Google account receives the `STUDENT` role.

Start API:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Health: http://127.0.0.1:8000/health
- Swagger / interactive API docs: http://127.0.0.1:8000/docs
- OpenAPI schema: http://127.0.0.1:8000/openapi.json

SQLite is used by default and `placematrix.db` is created automatically. For a shared deployment, use PostgreSQL and set `DATABASE_URL` accordingly.

## Google OAuth setup
1. Open Google Cloud Console → APIs & Services → OAuth consent screen. Configure the app and add the appropriate IIT Ropar users as test users if the consent screen is in Testing mode.
2. Credentials → Create credentials → OAuth client ID → Web application.
3. Add `http://localhost:5173` and `http://127.0.0.1:5173` as Authorized JavaScript origins.
4. Copy the client ID to both `backend/.env` (`GOOGLE_CLIENT_ID`) and the project-root `.env` (`VITE_GOOGLE_CLIENT_ID`). They must be the same client ID.
5. Restart both servers after editing `.env` files.

The backend verifies Google's signed ID token against that client ID, checks Google's verified-email and hosted-domain claims, and independently rejects any account outside `@iitrpr.ac.in`. Do not add a development bypass for domain checks.

## API overview
- `GET /health` — server health check
- `POST /api/auth/google` — exchange Google Identity Services credential for PlaceMatrix bearer token
- `GET /api/auth/me` — current signed-in user
- `GET /api/drives` — open drives for students; admins can optionally filter by `status_filter`
- `POST /api/drives` — create a drive (CCPC/SPOC only)
- `PATCH /api/drives/{drive_id}` — update a drive (CCPC/SPOC only)
- `POST /api/applications/{drive_id}` — apply to an open drive (student only; duplicate applications rejected)
- `GET /api/applications/me` — current student's applications
- `GET /api/admin/users` — user directory (CCPC/Verifier)
- `GET /api/admin/audit` — latest 200 audit events (CCPC/Verifier)

Authenticated endpoints require `Authorization: Bearer <access_token>`. The token expires after 12 hours by default. Configure HTTPS, production secrets, backups, rate limiting and deployment settings before public production use.
