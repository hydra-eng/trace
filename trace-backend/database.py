import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Use SQLite for local development (no PostgreSQL needed)
# In production/Docker, override with DATABASE_URL env var pointing to Postgres
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./trace.db"
)

# SQLite needs check_same_thread=False for FastAPI's async workers
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
