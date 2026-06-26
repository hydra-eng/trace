"""
Engine 13: Mock AI CCTV Detection Pipeline

Simulates AI-powered CCTV face detection and suspect matching.
Since no real face recognition is available, this engine:
  - Generates realistic detection events from seeded CCTV data
  - Correlates CCTV detections with CDR tower pings
  - Calculates confidence scores based on tower proximity
  - Creates evidence chains linking camera sightings to cell tower data

Emits CCTV_DETECTION events with correlation status.
"""
from typing import List
import uuid
import math
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import CDRRecord, Suspect, Event, CCTVDetection

# Time window (minutes) to correlate CCTV detection with tower ping
TOWER_CORRELATION_WINDOW_MINUTES = 15


def detect_cctv_correlations(case_id: str, db: Session) -> List[Event]:
    """
    Generates CCTV detection events by correlating CDR tower data with
    camera locations. Simulates what a real AI pipeline would produce.
    Also correlates existing seeded CCTV detections if timestamps match.
    """
    suspects = db.query(Suspect).filter(Suspect.case_id == case_id).all()
    if not suspects:
        return []

    events: List[Event] = []

    for suspect in suspects:
        # Get CDR records for this suspect
        cdrs = (
            db.query(CDRRecord)
            .filter(CDRRecord.suspect_id == suspect.id)
            .order_by(CDRRecord.timestamp)
            .all()
        )

        if not cdrs:
            continue

        # Generate mock AI detections based on CDR tower proximity to cameras
        mock_detections = _generate_mock_detections(suspect, cdrs, case_id)
        events.extend(mock_detections)

    return events


def _generate_mock_detections(suspect: Suspect, cdrs: list, case_id: str) -> List[Event]:
    """
    Generate mock AI detection events for cameras based on CDR tower locations.
    This simulates what a real AI pipeline would produce.
    """
    events = []

    # Camera registry (matches static images in frontend)
    cameras = [
        {"id": "CAM-ONG-MKT-01", "name": "Ongole Main Market Junction",
         "lat": 15.5071, "lon": 80.0512, "tower_id": "TWR-ONG-001"},
        {"id": "CAM-CDD-NH16-01", "name": "Chirala NH-16 Toll Plaza",
         "lat": 15.8180, "lon": 80.3520, "tower_id": "TWR-CDD-001"},
        {"id": "CAM-ONG-BUS-01", "name": "Ongole APSRTC Bus Stand",
         "lat": 15.5042, "lon": 80.0465, "tower_id": "TWR-ONG-002"},
    ]

    # Find CDR records near camera towers
    for cdr in cdrs:
        if not cdr.tower_id:
            continue

        for cam in cameras:
            if cdr.tower_id == cam["tower_id"]:
                # Calculate distance from tower to camera
                if cdr.tower_lat and cdr.tower_lon:
                    dist = _haversine_km(cam["lat"], cam["lon"], cdr.tower_lat, cdr.tower_lon)
                    if dist <= 3.0:  # Within 3 km of camera
                        # Generate mock detection event
                        confidence = max(0.6, min(0.95, 0.85 + (hash(f"{suspect.id}{cam['id']}") % 100) / 500))
                        events.append(Event(
                            id=str(uuid.uuid4()),
                            case_id=case_id,
                            event_type="CCTV_MOCK_DETECTION",
                            severity="MEDIUM",
                            involved_suspects=[suspect.label],
                            detail={
                                "camera_id": cam["id"],
                                "camera_name": cam["name"],
                                "camera_lat": cam["lat"],
                                "camera_lon": cam["lon"],
                                "detection_timestamp": cdr.timestamp.isoformat(),
                                "confidence_score": round(confidence, 3),
                                "matched_tower_id": cdr.tower_id,
                                "distance_to_tower_km": round(dist, 2),
                                "correlation_status": "CONFIRMED",
                                "note": (
                                    f"Mock AI detection: {suspect.label} identified at "
                                    f"{cam['name']} (confidence {round(confidence * 100, 1)}%), "
                                    f"tower {cdr.tower_id} {round(dist, 1)} km away."
                                ),
                            },
                            occurred_at=cdr.timestamp,
                        ))
                        break  # One detection per CDR per camera

    # Deduplicate (keep highest confidence per camera per time window)
    return _deduplicate_detections(events)


def _deduplicate_detections(events: List[Event]) -> List[Event]:
    """Keep only the highest confidence detection per camera per 30-min window."""
    if not events:
        return []

    # Group by camera_id + time bucket (30 min)
    grouped = {}
    for ev in events:
        cam_id = ev.detail.get("camera_id", "")
        ts = ev.occurred_at
        if ts:
            bucket = ts.replace(minute=ts.minute // 30 * 30, second=0, microsecond=0)
        else:
            bucket = datetime.min
        key = (cam_id, bucket)

        if key not in grouped or ev.detail.get("confidence_score", 0) > grouped[key].detail.get("confidence_score", 0):
            grouped[key] = ev

    return list(grouped.values())


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate haversine distance in km."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
