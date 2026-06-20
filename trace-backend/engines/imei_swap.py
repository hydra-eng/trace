"""
Engine 1: IMEI Swap Detection
Detects when a suspect's MSISDN appears with a different IMEI over time.
"""
from typing import List
from datetime import datetime
import uuid
from sqlalchemy.orm import Session
from models import CDRRecord, Event, Suspect


def detect_imei_swaps(suspect_id: str, db: Session) -> List[Event]:
    suspect = db.query(Suspect).filter(Suspect.id == suspect_id).first()
    if not suspect:
        return []

    records = (
        db.query(CDRRecord)
        .filter(CDRRecord.suspect_id == suspect_id, CDRRecord.imei.isnot(None))
        .order_by(CDRRecord.msisdn_a, CDRRecord.timestamp)
        .all()
    )

    events: List[Event] = []

    # Group by msisdn_a
    from itertools import groupby
    keyfn = lambda r: r.msisdn_a
    for msisdn, group in groupby(records, key=keyfn):
        recs = list(group)
        seen_imeis: List[tuple] = []  # (imei, first_seen)

        for rec in recs:
            imei = rec.imei.strip()
            if not imei:
                continue
            existing = [s for s in seen_imeis if s[0] == imei]
            if not existing:
                seen_imeis.append((imei, rec.timestamp))

            # Check swap: new imei after a previous one
            if len(seen_imeis) >= 2:
                # Each new imei after the first is a swap
                for i in range(1, len(seen_imeis)):
                    old_imei, _ = seen_imeis[i - 1]
                    new_imei, swap_ts = seen_imeis[i]
                    if old_imei != new_imei:
                        # Check if this swap event was already recorded
                        already = any(
                            e.detail.get("new_imei") == new_imei and e.detail.get("msisdn") == msisdn
                            for e in events
                        )
                        if not already:
                            events.append(Event(
                                id=str(uuid.uuid4()),
                                case_id=suspect.case_id,
                                event_type="IMEI_SWAP",
                                severity="HIGH",
                                involved_suspects=[suspect.label],
                                detail={
                                    "msisdn": msisdn,
                                    "old_imei": old_imei,
                                    "new_imei": new_imei,
                                    "swap_at_timestamp": swap_ts.isoformat(),
                                },
                                occurred_at=swap_ts,
                            ))
                seen_imeis = list(dict.fromkeys([s[0] for s in seen_imeis]))
                seen_imeis = [(imei, ts) for imei, ts in
                              [(s, next(r.timestamp for r in recs if r.imei == s)) for s in seen_imeis]]

    return events
