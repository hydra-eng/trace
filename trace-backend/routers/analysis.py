from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Case, Suspect, Event
from schemas import AnalysisSummary
from engines.imei_swap import detect_imei_swaps
from engines.co_location import detect_co_location
from engines.common_contact import detect_common_contacts
from engines.anomaly import detect_anomalies
from engines.ott_fingerprint import fingerprint_ott

router = APIRouter(tags=["analysis"])


@router.post("/cases/{case_id}/analyze", response_model=AnalysisSummary)
def run_analysis(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    suspects = db.query(Suspect).filter(Suspect.case_id == case_id).all()
    if not suspects:
        raise HTTPException(status_code=422, detail="No suspects uploaded for this case")

    # Delete existing events for this case to avoid duplicates on re-analysis
    db.query(Event).filter(Event.case_id == case_id).delete()

    counts = {
        "imei_swaps": 0,
        "co_locations": 0,
        "common_contacts": 0,
        "anomalies": 0,
        "ott_flags": 0,
    }

    # Engine 1: IMEI swap — per suspect
    for suspect in suspects:
        events = detect_imei_swaps(suspect.id, db)
        for ev in events:
            db.add(ev)
        counts["imei_swaps"] += len(events)

    # Engine 2: Co-location — case-wide
    co_events = detect_co_location(case_id, db)
    for ev in co_events:
        db.add(ev)
    counts["co_locations"] = len(co_events)

    # Engine 3: Common contacts — case-wide
    cc_events = detect_common_contacts(case_id, db)
    for ev in cc_events:
        db.add(ev)
    counts["common_contacts"] = len(cc_events)

    # Engine 4: Anomaly detection — case-wide
    anomaly_events = detect_anomalies(case_id, db)
    for ev in anomaly_events:
        db.add(ev)
    counts["anomalies"] = len(anomaly_events)

    # Engine 5: OTT fingerprint — per suspect
    for suspect in suspects:
        ott_events = fingerprint_ott(suspect.id, db)
        for ev in ott_events:
            db.add(ev)
        counts["ott_flags"] += len(ott_events)

    db.commit()

    total = sum(counts.values())
    return AnalysisSummary(events_generated=total, summary=counts)
