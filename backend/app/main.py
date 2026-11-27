"""PlaceMatrix API — FastAPI application entry point.

Run (from backend/):  uvicorn app.main:app --reload --port 8000
Interactive API docs: http://localhost:8000/docs
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from . import realtime
from .config import settings
from .migrations import run_migrations
from .routers import admin, applications, auth, companies, demo, email, invitations, profile, recruitments, state, verification

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    if settings.auto_migrate:
        applied = run_migrations()  # non-destructive; no-op when the schema is current
        if applied:
            logging.getLogger("placematrix").info("Applied database migrations: %s", ", ".join(applied))
    if settings.realtime_sync:
        realtime.start()
    yield
    realtime.stop()


app = FastAPI(
    lifespan=lifespan,
    title="PlaceMatrix API",
    version="1.1.0",
    description="In-house placement portal for CDPC, IIT Ropar — students, verifiers, SPOCs and CDPC administrators.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Row-Count", "X-File-Count"],
)

# Compress responses over 1 KB when the browser accepts gzip (every modern browser does). The role-scoped
# /api/state snapshot shrinks about 7x (e.g. 70 KB -> 9 KB), which matters most on mobile and campus Wi-Fi.
app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=6)


@app.middleware("http")
async def no_store_api_responses(request: Request, call_next):
    """API data must never be served from a browser or proxy cache (the database is the source of truth)."""
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_: Request, exc: IntegrityError):
    """A database constraint rejected the change (duplicate, one-open-ticket, etc.)."""
    logging.getLogger("placematrix").warning("Integrity error: %s", exc.orig)
    return JSONResponse(status_code=409, content={"detail": "This change conflicts with existing data (a database constraint rejected it)."})


for r in (auth.router, auth.config_router, state.router, profile.router, verification.router, companies.router,
          applications.router, invitations.router, admin.router, recruitments.router, email.router, demo.router):
    app.include_router(r)


@app.get("/", include_in_schema=False)
def root():
    return {"name": "PlaceMatrix API", "docs": "/docs", "health": "/api/health"}
