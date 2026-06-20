import uuid
import json
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Float,
    DateTime, ForeignKey, TypeDecorator, types
)
from sqlalchemy.orm import relationship
from database import Base


def gen_uuid():
    return str(uuid.uuid4())


# ── Cross-DB JSON column (works on both SQLite and PostgreSQL) ─────────────────
class JSONColumn(TypeDecorator):
    """Stores JSON as text on SQLite; uses native JSONB on Postgres."""
    impl = types.Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, (dict, list)):
            return value   # PostgreSQL JSONB already deserialized
        return json.loads(value)


# ── Models ─────────────────────────────────────────────────────────────────────

class Case(Base):
    __tablename__ = "cases"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    suspects = relationship("Suspect", back_populates="case", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="case", cascade="all, delete-orphan")


class Suspect(Base):
    __tablename__ = "suspects"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False)
    label = Column(Text, nullable=False)
    primary_msisdn = Column(Text, nullable=False)

    case = relationship("Case", back_populates="suspects")
    cdr_records = relationship("CDRRecord", back_populates="suspect", cascade="all, delete-orphan")
    ipdr_records = relationship("IPDRRecord", back_populates="suspect", cascade="all, delete-orphan")


class CDRRecord(Base):
    __tablename__ = "cdr_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    suspect_id = Column(String(36), ForeignKey("suspects.id"), nullable=False)
    msisdn_a = Column(Text, nullable=False)
    msisdn_b = Column(Text, nullable=False)
    imei = Column(Text)
    tower_id = Column(Text)
    tower_lat = Column(Float)
    tower_lon = Column(Float)
    call_type = Column(Text)
    duration_sec = Column(Integer)
    timestamp = Column(DateTime, nullable=False)

    suspect = relationship("Suspect", back_populates="cdr_records")


class IPDRRecord(Base):
    __tablename__ = "ipdr_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    suspect_id = Column(String(36), ForeignKey("suspects.id"), nullable=False)
    msisdn = Column(Text, nullable=False)
    dest_ip = Column(Text, nullable=False)
    dest_port = Column(Integer)
    data_volume_kb = Column(Float)
    app_label = Column(Text)
    timestamp = Column(DateTime, nullable=False)

    suspect = relationship("Suspect", back_populates="ipdr_records")


class Event(Base):
    __tablename__ = "events"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False)
    event_type = Column(Text, nullable=False)
    severity = Column(Text, nullable=False)
    # Stored as JSON list ["Suspect A", "Suspect B"]
    involved_suspects = Column(JSONColumn, nullable=False, default=list)
    # Stored as JSON dict
    detail = Column(JSONColumn, nullable=False, default=dict)
    occurred_at = Column(DateTime)

    case = relationship("Case", back_populates="events")
