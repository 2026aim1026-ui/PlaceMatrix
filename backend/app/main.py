"""PlaceMatrix API — FastAPI application entry point.

Run (from backend/):  uvicorn app.main:app --reload --port 8000
Interactive API docs: http://localhost:8000/docs
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from .config import settings
from .routers import admin, applications, auth, companies, demo, invitations, profile, state, verification

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    lifespan=lifespan,
    title="PlaceMatrix API",
    version="1.0.0",
    description="In-house placement portal for CDPC, IIT Ropar — students, verifiers, SPOCs and CCPC administrators.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Row-Count"],
)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_: Request, exc: IntegrityError):
    """A database constraint rejected the change (duplicate, one-open-ticket, etc.)."""
    logging.getLogger("placematrix").warning("Integrity error: %s", exc.orig)
    return JSONResponse(status_code=409, content={"detail": "This change conflicts with existing data (a database constraint rejected it)."})


for r in (auth.router, auth.config_router, state.router, profile.router, verification.router, companies.router,
          applications.router, invitations.router, admin.router, demo.router):
    app.include_router(r)


@app.get("/", include_in_schema=False)
def root():
    return {"name": "PlaceMatrix API", "docs": "/docs", "health": "/api/health"}
