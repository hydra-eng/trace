from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import cases, upload, analysis, events, suspects, report

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TRACE — Telecom Record Analysis for Criminal Examination",
    version="1.0.0",
    description="Criminal intelligence platform for CDR/IPDR analysis",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173",
        "http://frontend:4173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cases.router)
app.include_router(upload.router)
app.include_router(analysis.router)
app.include_router(events.router)
app.include_router(suspects.router)
app.include_router(report.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "TRACE Backend"}
