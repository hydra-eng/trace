"""
Engine 12: Movement Pattern Clustering (DBSCAN)

Clusters suspect cell tower pings into geographic zones using DBSCAN.
Identifies:
  - "Home" zone (most frequent tower cluster)
  - "Work" zone (secondary frequent cluster)
  - "Meeting" zones (where multiple suspects cluster)
  - "Anomaly" zones (unusual locations visited rarely)

Emits MOVEMENT_CLUSTER events with zone classifications.
"""
from typing import List
import uuid
from datetime import datetime
from collections import Counter, defaultdict
from sqlalchemy.orm import Session
from models import CDRRecord, Suspect, Event

try:
    from sklearn.cluster import DBSCAN
    import numpy as np
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

# DBSCAN parameters
EPS_KM = 2.0          # 2 km radius = same zone
MIN_SAMPLES = 2        # Minimum pings to form a cluster


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Quick haversine for distance matrix."""
    import math
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def detect_movement_clusters(case_id: str, db: Session) -> List[Event]:
    """
    Clusters tower pings per suspect into geographic zones using DBSCAN.
    Classifies zones as home/work/meeting/anomaly based on frequency.
    """
    if not SKLEARN_AVAILABLE:
        return []

    suspects = db.query(Suspect).filter(Suspect.case_id == case_id).all()
    if not suspects:
        return []

    events: List[Event] = []

    for suspect in suspects:
        records = (
            db.query(CDRRecord)
            .filter(
                CDRRecord.suspect_id == suspect.id,
                CDRRecord.tower_lat.isnot(None),
                CDRRecord.tower_lon.isnot(None),
            )
            .order_by(CDRRecord.timestamp)
            .all()
        )

        if len(records) < MIN_SAMPLES:
            continue

        # Build coordinate matrix
        coords = np.array([[r.tower_lat, r.tower_lon] for r in records])

        # Convert EPS from km to approximate degrees (1 degree ≈ 111 km)
        eps_degrees = EPS_KM / 111.0

        # Run DBSCAN
        clustering = DBSCAN(eps=eps_degrees, min_samples=MIN_SAMPLES, metric="euclidean")
        labels = clustering.fit_predict(coords)

        # Analyze clusters
        cluster_info = _analyze_clusters(records, labels, suspect)

        # Classify zones
        zones = _classify_zones(cluster_info)

        # Generate events for significant zones
        for zone in zones:
            if zone["type"] == "ANOMALY":
                severity = "MEDIUM"
            elif zone["type"] == "MEETING":
                severity = "HIGH"
            else:
                severity = "LOW"

            events.append(Event(
                id=str(uuid.uuid4()),
                case_id=case_id,
                event_type="MOVEMENT_CLUSTER",
                severity=severity,
                involved_suspects=[suspect.label],
                detail={
                    "msisdn": suspect.primary_msisdn,
                    "zone_type": zone["type"],
                    "zone_label": zone["label"],
                    "center_lat": zone["center_lat"],
                    "center_lon": zone["center_lon"],
                    "ping_count": zone["ping_count"],
                    "tower_ids": zone["tower_ids"],
                    "first_seen": zone["first_seen"].isoformat(),
                    "last_seen": zone["last_seen"].isoformat(),
                    "dominant_tower": zone["dominant_tower"],
                    "note": (
                        f"{zone['type']} zone '{zone['label']}' identified: "
                        f"{zone['ping_count']} pings at tower(s) {', '.join(zone['tower_ids'][:3])} "
                        f"— center ({zone['center_lat']:.4f}, {zone['center_lon']:.4f})"
                    ),
                },
                occurred_at=zone["first_seen"],
            ))

    return events


def _analyze_clusters(records: list, labels, suspect) -> dict:
    """Group records by DBSCAN cluster label and compute stats."""
    clusters = defaultdict(lambda: {
        "records": [],
        "lats": [],
        "lons": [],
        "tower_ids": set(),
        "timestamps": [],
    })

    for i, label in enumerate(labels):
        if label == -1:
            continue  # Noise points (outliers)
        clusters[label]["records"].append(records[i])
        clusters[label]["lats"].append(records[i].tower_lat)
        clusters[label]["lons"].append(records[i].tower_lon)
        if records[i].tower_id:
            clusters[label]["tower_ids"].add(records[i].tower_id)
        clusters[label]["timestamps"].append(records[i].timestamp)

    return clusters


def _classify_zones(cluster_info: dict) -> list:
    """
    Classify clusters into zone types based on visit frequency:
    - HOME: most visited zone
    - WORK: second most visited
    - MEETING: zones with multiple tower IDs (larger area)
    - ANOMALY: zones visited very few times (1-2 pings)
    """
    if not cluster_info:
        return []

    # Sort by ping count (descending)
    sorted_clusters = sorted(
        cluster_info.items(),
        key=lambda x: len(x[1]["records"]),
        reverse=True,
    )

    zones = []
    for idx, (label, info) in enumerate(sorted_clusters):
        ping_count = len(info["records"])
        center_lat = sum(info["lats"]) / len(info["lats"])
        center_lon = sum(info["lons"]) / len(info["lons"])
        tower_ids = sorted(info["tower_ids"])
        first_seen = min(info["timestamps"])
        last_seen = max(info["timestamps"])

        # Dominant tower (most frequent)
        tower_counter = Counter(r.tower_id for r in info["records"] if r.tower_id)
        dominant_tower = tower_counter.most_common(1)[0][0] if tower_counter else "UNKNOWN"

        # Classify zone type
        if ping_count <= 2:
            zone_type = "ANOMALY"
            label_text = f"Rare Location #{idx + 1}"
        elif len(tower_ids) >= 3:
            zone_type = "MEETING"
            label_text = f"Meeting Zone #{idx + 1}"
        elif idx == 0:
            zone_type = "HOME"
            label_text = "Home Zone"
        elif idx == 1:
            zone_type = "WORK"
            label_text = "Work Zone"
        else:
            zone_type = "FREQUENT"
            label_text = f"Frequent Location #{idx + 1}"

        zones.append({
            "type": zone_type,
            "label": label_text,
            "center_lat": round(center_lat, 6),
            "center_lon": round(center_lon, 6),
            "ping_count": ping_count,
            "tower_ids": tower_ids,
            "first_seen": first_seen,
            "last_seen": last_seen,
            "dominant_tower": dominant_tower,
        })

    return zones
