# PlaceMatrix — Frontend (React + Vite)

The React single-page app for PlaceMatrix. It talks to the FastAPI backend in `../backend`;
PostgreSQL is the source of truth (there is no localStorage data store any more).

**Full setup, demo accounts and the verification walkthrough are in the root [`README.md`](../README.md).**

```bash
npm install
npm run dev        # http://localhost:5173  (proxies /api → http://localhost:8000)
npm run build      # production build into dist/
```

Requires Node.js 18+ and the backend running on port 8000 (change with `VITE_PROXY_TARGET`).

## How the frontend uses the API

| File | Role |
|---|---|
| `src/api/client.js` | `fetch` wrapper: bearer token, error messages from `{"detail": …}`, upload progress, file downloads |
| `src/data/repository.js` | All actions (apply, verify, shortlist, invite…) as API calls; holds the role-scoped snapshot from `GET /api/state` and polls `GET /api/sync` every 4 s so every open browser stays in step |
| `src/context/AuthContext.jsx` | Sign-in (`@iitrpr.ac.in` only), demo login, invitation activation, Google sign-in, SPOC ⇄ candidate-feed switch |
| `src/context/DataContext.jsx` | Loads the snapshot for the signed-in user before rendering routes |
| `src/utils/profileRules.js` | Claimed-vs-proof comparison and submission checklist for instant UI feedback (the server re-checks) |

New pages: `/activate` (invitation activation), `/admin/analytics` and `/admin/users` (CCPC).
