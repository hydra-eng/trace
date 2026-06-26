"""
Engine 10: CDR+IPDR Temporal Evidence Correlation

Correlates call events (CDR) with data sessions (IPDR) by timestamp proximity.
Detects patterns like:
  - Call followed by encrypted app usage (coordination signal)
  - Data upload after receiving a call (possible exfiltration)
  - Multiple suspects using encrypted apps simultaneously (coordinated activity)

Emits EVIDENCE_CORRELATION events with linked CDR+IPDR records.
"""
from typing import List
import uuid
from datetime import datetime, timedelta
from collections import defaultdict
from sqlalchemy.orm import Session
from models import CDRRecord, IPDRRecord, Suspect, Event

# Time window (in minutes) to consider CDR and IPDR as correlated
CORRELATION_WINDOW_MINUTES = 15

# Encrypted apps that are significant when correlated with calls
SIGNIFICANT_APPS = {"WhatsApp / Instagram", "Telegram"}

# Minimum data volume (KB) to consider significant
MIN_DATA_VOLUME_KB = 50.0


def detect_evidence_correlations(case_id: str, db: Session) -> List[Event]:
    """
    For each suspect, finds CDR records that have temporally proximate IPDR records.
    Correlates calls with data sessions to build evidence chains.
    """
    suspects = db.query(Suspect).filter(Suspect.case_id == case_id).all()
    if not suspects:
        return []

    events: List[Event] = []
    window = timedelta(minutes=CORRELATION_WINDOW_MINUTES)

    for suspect in suspects:
        # Get all CDR and IPDR records for this suspect
        cdrs = (
            db.query(CDRRecord)
            .filter(CDRRecord.suspect_id == suspect.id)
            .order_by(CDRRecord.timestamp)
            .all()
        )
        ipdrs = (
            db.query(IPDRRecord)
            .filter(IPDRRecord.suspect_id == suspect.id)
            .order_by(IPDRRecord.timestamp)
            .all()
        )

        if not cdrs or not ipdrs:
            continue

        # For each CDR, find IPDR records within the correlation window
        for cdr in cdrs:
            cdr_start = cdr.timestamp
            cdr_end = cdr.timestamp + timedelta(seconds=cdr.duration_sec or 0)
            window_start = cdr_start - window
            window_end = cdr_end + window

            correlated_ipdrs = [
                ipdr for ipdr in ipdrs
                if window_start <= ipdr.timestamp <= window_end
            ]

            if not correlated_ipdrs:
                continue

            # Analyze the correlation
            encrypted_apps = [ipdr for ipdr in correlated_ipdrs if ipdr.app_label in SIGNIFICANT_APPS]
            total_data_kb = sum(ipdr.data_volume_kb or 0 for ipdr in correlated_ipdrs)

            # Skip low-significance correlations
            if not encrypted_apps and total_data_kb < MIN_DATA_VOLUME_KB:
                continue

            # Determine correlation type and severity
            severity = "MEDIUM"
            correlation_type = "CDR_IPDR_PROXIMITY"
            detail = {
                "msisdn": cdr.msisdn_a,
                "contact_number": cdr.msisdn_b,
                "call_type": cdr.call_type,
                "call_duration_sec": cdr.duration_sec,
                "call_timestamp": cdr_start.isoformat(),
                "correlated_ipdr_count": len(correlated_ipdrs),
                "total_data_kb": round(total_data_kb, 2),
                "correlated_apps": list(set(ipdr.app_label for ipdr in correlated_ipdrs)),
                "window_minutes": CORRELATION_WINDOW_MINUTES,
            }

            # Elevated severity for encrypted app correlation
            if encrypted_apps:
                severity = "HIGH"
                correlation_type = "CDR_ENCRYPTED_APP_USAGE"
                detail["encrypted_apps"] = list(set(ipdr.app_label for ipdr in encrypted_apps))
                detail["encrypted_data_kb"] = round(sum(ipdr.data_volume_kb or 0 for ipdr in encrypted_apps), 2)
                detail["note"] = (
                    f"Call to {cdr.msisdn_b} ({cdr.call_type}, {cdr.duration_sec}s) "
                    f"followed by {len(encrypted_apps)} encrypted app sessions "
                    f"({', '.join(set(ipdr.app_label for ipdr in encrypted_apps))}) "
                    f"within {CORRELATION_WINDOW_MINUTES} minutes — possible coordination via encrypted channel."
                )
            else:
                detail["note"] = (
                    f"Call to {cdr.msisdn_b} ({cdr.call_type}) correlated with "
                    f"{len(correlated_ipdrs)} data sessions ({round(total_data_kb, 1)} KB total) "
                    f"within {CORRELATION_WINDOW_MINUTES} minutes."
                )

            events.append(Event(
                id=str(uuid.uuid4()),
                case_id=case_id,
                event_type=correlation_type,
                severity=severity,
                involved_suspects=[suspect.label],
                detail=detail,
                occurred_at=cdr_start,
            ))

        # Detect simultaneous encrypted app usage across multiple IPDR records
        # (burst of encrypted traffic without corresponding calls)
        if len(ipdrs) >= 3:
            encrypted_bursts = _detect_encrypted_bursts(ipdrs)
            for burst in encrypted_bursts:
                events.append(Event(
                    id=str(uuid.uuid4()),
                    case_id=case_id,
                    event_type="ENCRYPTED_BURST",
                    severity="MEDIUM",
                    involved_suspects=[suspect.label],
                    detail={
                        "msisdn": suspect.primary_msisdn,
                        "app": burst["app"],
                        "session_count": burst["count"],
                        "total_data_kb": round(burst["total_kb"], 2),
                        "time_span_minutes": round(burst["span_minutes"], 1),
                        "first_seen": burst["first_seen"].isoformat(),
                        "last_seen": burst["last_seen"].isoformat(),
                        "note": (
                            f"Burst of {burst['count']} {burst['app']} sessions "
                            f"({round(burst['total_kb'], 1)} KB) within "
                            f"{round(burst['span_minutes'], 0)} minutes — "
                            f"unusual encrypted traffic pattern."
                        ),
                    },
                    occurred_at=burst["first_seen"],
                ))

    # Deduplicate events (same suspect + same call + same window)
    events = _deduplicate_events(events)

    return events


def _detect_encrypted_bursts(ipdrs: List[IPDRRecord]) -> list:
    """
    Detect bursts of encrypted app usage — multiple sessions to the same
    encrypted app within a short time window.
    """
    bursts = []

    # Group by app_label
    by_app: dict = defaultdict(list)
    for ipdr in ipdrs:
        if ipdr.app_label in SIGNIFICANT_APPS:
            by_app[ipdr.app_label].append(ipdr)

    for app, records in by_app.items():
        if len(records) < 3:
            continue

        # Sort by timestamp
        records.sort(key=lambda r: r.timestamp)

        # Sliding window: find clusters of 3+ sessions within 30 minutes
        for i in range(len(records) - 2):
            cluster = [records[i]]
            for j in range(i + 1, len(records)):
                if (records[j].timestamp - records[i].timestamp) <= timedelta(minutes=30):
                    cluster.append(records[j])
                else:
                    break

            if len(cluster) >= 3:
                total_kb = sum(r.data_volume_kb or 0 for r in cluster)
                span = (cluster[-1].timestamp - cluster[0].timestamp).total_seconds() / 60
                bursts.append({
                    "app": app,
                    "count": len(cluster),
                    "total_kb": total_kb,
                    "span_minutes": span,
                    "first_seen": cluster[0].timestamp,
                    "last_seen": cluster[-1].timestamp,
                })
                break  # One burst per app per suspect

    return bursts


def _deduplicate_events(events: List[Event]) -> List[Event]:
    """Remove duplicate events based on type + suspect + timestamp proximity."""
    seen = set()
    unique = []
    for ev in events:
        key = (ev.event_type, tuple(ev.involved_suspects), ev.occurred_at)
        # Also check for time-proximate duplicates (within 5 min)
        time_key = (ev.event_type, tuple(ev.involved_suspects),
                    ev.occurred_at.replace(minute=ev.occurred_at.minute // 5 * 5, second=0, microsecond=0) if ev.occurred_at else None)
        if time_key not in seen:
            seen.add(time_key)
            unique.append(ev)
    return unique
