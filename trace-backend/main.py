import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import cases, upload, analysis, events, suspects, report, geo, audit
from routers import auth

# Load .env from project root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# ── Configuration ────────────────────────────────────────────
TRACE_HOST = os.getenv("TRACE_HOST", "0.0.0.0")
TRACE_PORT = int(os.getenv("TRACE_PORT", "8000"))
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "*")
JWT_SECRET = os.getenv("JWT_SECRET", "trace-...")

# Parse CORS origins
if CORS_ORIGINS_RAW.strip() == "*":
    CORS_ORIGINS = ["*"]
else:
    CORS_ORIGINS = [o.strip() for o in CORS_ORIGINS_RAW.split(",") if o.strip()]

# Create all tables on startup (including new AuditLog)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TRACE — Telecom Record Analysis for Criminal Examination",
    version="1.0.0",
    description="Criminal intelligence platform for CDR/IPDR analysis",
)

from fastapi.staticfiles import StaticFiles

# ── CORS ─────────────────────────────────────────────────────
if CORS_ORIGINS == ["*"]:
    # Allow all origins (development mode)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(upload.router)
app.include_router(analysis.router)
app.include_router(events.router)
app.include_router(suspects.router)
app.include_router(report.router)
app.include_router(geo.router)
app.include_router(audit.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "TRACE Backend", "version": "1.0.0"}
