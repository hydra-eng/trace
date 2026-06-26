"""
preload_db.py
Preloads Case 1, Case 2, and Case 3 from demo-data/ CSV files directly into the SQLite database.
Runs the analytical engines for each case to pre-populate all intelligence events.

Usage:
    python preload_db.py
"""

import os
import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session

# Setup python path to import local modules correctly
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base
from models import Case, Suspect, CDRRecord, IPDRRecord, Event, PriorIncident, CCTVDetection
from engines.imei_swap import detect_imei_swaps, detect_multi_sim_imei
from engines.co_location import detect_co_location
from engines.common_contact import detect_common_contacts
from engines.anomaly import detect_anomalies
from engines.ott_fingerprint import fingerprint_ott
from engines.cross_case import detect_cross_case_handlers
from engines.tower_silence import detect_tower_silence
from engines.night_loop import detect_night_and_loop_calls
from engines.evidence_correlation import detect_evidence_correlations
from engines.movement_clustering import detect_movement_clusters
from engines.cctv_pipeline import detect_cctv_correlations

DEMO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "demo-data")

def parse_datetime(val):
    val_str = str(val).strip()
    for fmt in ("%d/%m/%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d-%m-%Y %H:%M:%S"):
        try:
            return pd.to_datetime(val_str, format=fmt)
        except:
            continue
    return pd.to_datetime(val_str, errors="coerce")

def preload_suspect(db: Session, case_id: str, label: str, cdr_filename: str, ipdr_filename: str = None):
    cdr_path = os.path.join(DEMO_DIR, cdr_filename)
    if not os.path.exists(cdr_path):
        print(f"  Warning: CDR file {cdr_filename} not found, skipping suspect {label}")
        return None

    cdr_df = pd.read_csv(cdr_path)
    cdr_df["timestamp"] = cdr_df["timestamp"].apply(parse_datetime)
    cdr_df["timestamp"] = cdr_df["timestamp"].fillna(datetime.utcnow())
    cdr_df["duration_sec"] = pd.to_numeric(cdr_df["duration_sec"], errors="coerce").fillna(0).astype(int)
    cdr_df["tower_lat"] = pd.to_numeric(cdr_df["tower_lat"], errors="coerce")
    cdr_df["tower_lon"] = pd.to_numeric(cdr_df["tower_lon"], errors="coerce")

    # Primary MSISDN
    primary_msisdn = str(cdr_df["msisdn_a"].mode().iloc[0]) if not cdr_df.empty else "UNKNOWN"

    suspect = Suspect(case_id=case_id, label=label, primary_msisdn=primary_msisdn)
    db.add(suspect)
    db.flush()

    # CDR
    cdr_rows = []
    for _, row in cdr_df.iterrows():
        cdr_rows.append(CDRRecord(
            suspect_id=suspect.id,
            msisdn_a=str(row["msisdn_a"]),
            msisdn_b=str(row["msisdn_b"]),
            imei=str(row["imei"]) if pd.notna(row["imei"]) else None,
            tower_id=str(row["tower_id"]) if pd.notna(row["tower_id"]) else None,
            tower_lat=float(row["tower_lat"]) if pd.notna(row["tower_lat"]) else None,
            tower_lon=float(row["tower_lon"]) if pd.notna(row["tower_lon"]) else None,
            call_type=str(row["call_type"]) if pd.notna(row["call_type"]) else None,
            duration_sec=int(row["duration_sec"]),
            timestamp=row["timestamp"].to_pydatetime(),
        ))
    db.add_all(cdr_rows)

    # IPDR
    if ipdr_filename:
        ipdr_path = os.path.join(DEMO_DIR, ipdr_filename)
        if os.path.exists(ipdr_path):
            ipdr_df = pd.read_csv(ipdr_path)
            ipdr_df["timestamp"] = ipdr_df["timestamp"].apply(parse_datetime)
            ipdr_df["timestamp"] = ipdr_df["timestamp"].fillna(datetime.utcnow())
            ipdr_df["data_volume_kb"] = pd.to_numeric(ipdr_df["data_volume_kb"], errors="coerce").fillna(0)
            ipdr_df["dest_port"] = pd.to_numeric(ipdr_df["dest_port"], errors="coerce").fillna(0).astype(int)

            ipdr_rows = []
            for _, row in ipdr_df.iterrows():
                ipdr_rows.append(IPDRRecord(
                    suspect_id=suspect.id,
                    msisdn=str(row["msisdn"]),
                    dest_ip=str(row["dest_ip"]),
                    dest_port=int(row["dest_port"]),
                    data_volume_kb=float(row["data_volume_kb"]),
                    app_label="Unknown",
                    timestamp=row["timestamp"].to_pydatetime(),
                ))
            db.add_all(ipdr_rows)

    db.commit()
    db.refresh(suspect)
    print(f"  Ingested suspect: {label} ({len(cdr_rows)} CDR records, {ipdr_filename and 'with IPDR' or 'no IPDR'})")
    return suspect

def run_analysis_for_case(db: Session, case_id: str):
    suspects = db.query(Suspect).filter(Suspect.case_id == case_id).all()
    if not suspects:
        return

    # Clear old events
    db.query(Event).filter(Event.case_id == case_id).delete()

    event_counts = {
        "imei_swaps": 0,
        "multi_sim_imei": 0,
        "co_locations": 0,
        "common_contacts": 0,
        "anomalies": 0,
        "ott_flags": 0,
        "cross_case_handlers": 0,
        "tower_silence": 0,
        "night_call_bursts": 0,
        "loop_calls": 0,
        "evidence_correlations": 0,
        "movement_clusters": 0,
        "cctv_correlations": 0,
    }

    # IMEI swaps (per suspect)
    for suspect in suspects:
        events = detect_imei_swaps(suspect.id, db)
        for ev in events:
            db.add(ev)
        event_counts["imei_swaps"] += len(events)

    # Multi-SIM / Burner phone (case-wide)
    multi_sim_events = detect_multi_sim_imei(case_id, db)
    for ev in multi_sim_events:
        db.add(ev)
    event_counts["multi_sim_imei"] = len(multi_sim_events)

    # Co-location
    co_events = detect_co_location(case_id, db)
    for ev in co_events:
        db.add(ev)
    event_counts["co_locations"] = len(co_events)

    # Common contacts
    cc_events = detect_common_contacts(case_id, db)
    for ev in cc_events:
        db.add(ev)
    event_counts["common_contacts"] = len(cc_events)

    # Anomaly detection
    anomaly_events = detect_anomalies(case_id, db)
    for ev in anomaly_events:
        db.add(ev)
    event_counts["anomalies"] = len(anomaly_events)

    # OTT usage
    for suspect in suspects:
        ott_events = fingerprint_ott(suspect.id, db)
        for ev in ott_events:
            db.add(ev)
        event_counts["ott_flags"] += len(ott_events)

    # Cross-case handler matcher
    xcase_events = detect_cross_case_handlers(case_id, db)
    for ev in xcase_events:
        db.add(ev)
    event_counts["cross_case_handlers"] = len(xcase_events)

    # Tower silence / last-seen
    silence_events = detect_tower_silence(case_id, db)
    for ev in silence_events:
        db.add(ev)
    event_counts["tower_silence"] = len(silence_events)

    # Night-call burst + loop calls
    night_loop_events = detect_night_and_loop_calls(case_id, db)
    for ev in night_loop_events:
        db.add(ev)
        if ev.event_type == "NIGHT_CALL_BURST":
            event_counts["night_call_bursts"] += 1
        elif ev.event_type == "LOOP_CALL":
            event_counts["loop_calls"] += 1

    # Evidence correlation
    evidence_events = detect_evidence_correlations(case_id, db)
    for ev in evidence_events:
        db.add(ev)
    event_counts["evidence_correlations"] = len(evidence_events)

    # Movement clustering
    cluster_events = detect_movement_clusters(case_id, db)
    for ev in cluster_events:
        db.add(ev)
    event_counts["movement_clusters"] = len(cluster_events)

    # CCTV detection pipeline
    cctv_events = detect_cctv_correlations(case_id, db)
    for ev in cctv_events:
        db.add(ev)
    event_counts["cctv_correlations"] = len(cctv_events)

    db.commit()
    total = sum(event_counts.values())
    print(f"  Analysis ran: {total} events generated ({event_counts})")

def main():
    print("Initializing database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    print("Clearing existing cases...")
    db.query(Event).delete()
    db.query(CDRRecord).delete()
    db.query(IPDRRecord).delete()
    db.query(CCTVDetection).delete()
    db.query(PriorIncident).delete()
    db.query(Suspect).delete()
    db.query(Case).delete()
    db.commit()

    # ══════════════════════════════════════════════════════════════════════════
    # CASE 1: Ongole Tobacco Smuggling Syndicate (FIR 124/2026)
    # ══════════════════════════════════════════════════════════════════════════
    print("\nPreloading Case 1: Ongole Tobacco Smuggling Syndicate (FIR 124/2026)")
    case1 = Case(name="Ongole Tobacco Smuggling Syndicate (FIR 124/2026)")
    db.add(case1)
    db.commit()
    db.refresh(case1)

    preload_suspect(db, case1.id, "Kalyan Chakravarthy", 
                    "Case1_Ongole_Tobacco_Smuggling_CDR_Kalyan_Chakravarthy.csv", 
                    "Case1_Ongole_Tobacco_Smuggling_IPDR_Kalyan_Chakravarthy.csv")
    preload_suspect(db, case1.id, "Venkatesh Prasad", 
                    "Case1_Ongole_Tobacco_Smuggling_CDR_Venkatesh_Prasad.csv", 
                    "Case1_Ongole_Tobacco_Smuggling_IPDR_Venkatesh_Prasad.csv")
    preload_suspect(db, case1.id, "Subba Rao", 
                    "Case1_Ongole_Tobacco_Smuggling_CDR_Subba_Rao.csv")
    preload_suspect(db, case1.id, "Ananthakrishna", 
                    "Case1_Ongole_Tobacco_Smuggling_CDR_Ananthakrishna.csv")
    preload_suspect(db, case1.id, "Anjali Devi", 
                    "Case1_Ongole_Tobacco_Smuggling_CDR_Anjali_Devi.csv")

    run_analysis_for_case(db, case1.id)

    # Seed prior incidents and CCTV detections
    kalyan = db.query(Suspect).filter(Suspect.label == "Kalyan Chakravarthy").first()
    venkatesh = db.query(Suspect).filter(Suspect.label == "Venkatesh Prasad").first()

    kalyan_id = kalyan.id if kalyan else None
    venkatesh_id = venkatesh.id if venkatesh else None

    PRIOR_INCIDENTS = [
        {
            "msisdn": "919000100001",  # Kalyan Chakravarthy (kingpin)
            "case_reference": "FIR 87/2022 — Nellore District",
            "offence_type": "Illicit Tobacco Smuggling",
            "incident_date": datetime(2022, 3, 15),
            "district": "Nellore",
            "outcome": "Charge Sheet Filed"
        },
        {
            "msisdn": "919000100001",  # second prior for same suspect
            "case_reference": "FIR 214/2019 — Prakasham District",
            "offence_type": "Hawala Transaction (Suspected)",
            "incident_date": datetime(2019, 11, 2),
            "district": "Prakasham",
            "outcome": "Acquitted — Insufficient Evidence"
        },
        {
            "msisdn": "919000100002",  # Venkatesh Prasad (coordinator)
            "case_reference": "FIR 33/2023 — Guntur District",
            "offence_type": "Organised Drug Peddling",
            "incident_date": datetime(2023, 6, 20),
            "district": "Guntur",
            "outcome": "FIR Registered — Under Investigation"
        },
    ]

    for p in PRIOR_INCIDENTS:
        db.add(PriorIncident(**p))
    db.commit()

    CCTV_DETECTIONS = [
        {
            "suspect_id": kalyan_id,
            "camera_id": "CAM-ONG-MKT-01",
            "camera_name": "Ongole Main Market Junction",
            "camera_lat": 15.5071,
            "camera_lon": 80.0512,
            "detection_timestamp": datetime(2024, 1, 2, 14, 52, 0),
            "confidence_score": 0.91,
            "frame_image_path": "/static/cctv/frame_kalyan_ong_01.jpg",
            "matched_tower_id": "TWR-ONG-001",
            "correlation_status": "CONFIRMED",
            "notes": "Subject detected at Ongole Main Market 6 min before CDR tower TWR-ONG-001 registration"
        },
        {
            "suspect_id": venkatesh_id,
            "camera_id": "CAM-CDD-NH16-01",
            "camera_name": "Chirala NH-16 Toll Plaza Camera",
            "camera_lat": 15.8180,
            "camera_lon": 80.3520,
            "detection_timestamp": datetime(2024, 1, 2, 15, 5, 0),
            "confidence_score": 0.87,
            "frame_image_path": "/static/cctv/frame_venkatesh_cdd_01.jpg",
            "matched_tower_id": "TWR-CDD-001",
            "correlation_status": "CONFIRMED",
            "notes": "Subject detected at Chirala toll gate simultaneous with CDR tower TWR-CDD-001 co-location event"
        },
        {
            "suspect_id": kalyan_id,
            "camera_id": "CAM-ONG-BUS-01",
            "camera_name": "Ongole APSRTC Bus Stand",
            "camera_lat": 15.5042,
            "camera_lon": 80.0465,
            "detection_timestamp": datetime(2024, 1, 5, 2, 19, 0),
            "confidence_score": 0.79,
            "frame_image_path": "/static/cctv/frame_kalyan_bus_01.jpg",
            "matched_tower_id": "TWR-ONG-002",
            "correlation_status": "CONFIRMED",
            "notes": "Night-time detection at 02:19 hrs — correlates with CDR IMEI swap event at 02:13 hrs same night"
        },
    ]

    for c in CCTV_DETECTIONS:
        db.add(CCTVDetection(**c))
    db.commit()

    # Generate CCTV placeholder images using PIL
    from PIL import Image, ImageDraw
    static_cctv_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "cctv")
    os.makedirs(static_cctv_dir, exist_ok=True)

    def draw_and_save_frame(camera_id, timestamp_str, conf_score, filename):
        img = Image.new('RGB', (320, 240), color=(30, 30, 30))
        draw = ImageDraw.Draw(img)
        # Draw simple face bounding box
        draw.rectangle([100, 60, 220, 180], outline=(0, 255, 0), width=2)
        draw.text((105, 62), "PERSON", fill=(0, 255, 0))
        # Draw camera info
        draw.text((8, 8), camera_id, fill=(255, 255, 255))
        draw.text((8, 22), timestamp_str, fill=(200, 200, 200))
        draw.text((8, 210), f"Face Match Conf: {conf_score}", fill=(0, 255, 0))
        img.save(os.path.join(static_cctv_dir, filename))

    draw_and_save_frame("CAM-ONG-MKT-01", "2024-01-02 14:52:00", "0.91", "frame_kalyan_ong_01.jpg")
    draw_and_save_frame("CAM-CDD-NH16-01", "2024-01-02 15:05:00", "0.87", "frame_venkatesh_cdd_01.jpg")
    draw_and_save_frame("CAM-ONG-BUS-01", "2024-01-05 02:19:00", "0.79", "frame_kalyan_bus_01.jpg")
    print("  Seeded prior incidents, CCTV records, and generated placeholder images.")

    # ══════════════════════════════════════════════════════════════════════════
    # CASE 2: Hyderabad–Guntur Cyber Fraud Network (FIR 135/2026)
    # ══════════════════════════════════════════════════════════════════════════
    print("\nPreloading Case 2: Hyderabad–Guntur Cyber Fraud Network (FIR 135/2026)")
    case2 = Case(name="Hyderabad–Guntur Cyber Fraud Network (FIR 135/2026)")
    db.add(case2)
    db.commit()
    db.refresh(case2)

    preload_suspect(db, case2.id, "Ranga Reddy", 
                    "Case2_Hyd_Gnt_Cyber_Fraud_CDR_Ranga_Reddy.csv", 
                    "Case2_Hyd_Gnt_Cyber_Fraud_IPDR_Ranga_Reddy.csv")
    preload_suspect(db, case2.id, "Srinivas Rao", 
                    "Case2_Hyd_Gnt_Cyber_Fraud_CDR_Srinivas_Rao.csv", 
                    "Case2_Hyd_Gnt_Cyber_Fraud_IPDR_Srinivas_Rao.csv")
    preload_suspect(db, case2.id, "Venkateswara Rao", 
                    "Case2_Hyd_Gnt_Cyber_Fraud_CDR_Venkateswara_Rao.csv")
    preload_suspect(db, case2.id, "Lalitha Prasad", 
                    "Case2_Hyd_Gnt_Cyber_Fraud_CDR_Lalitha_Prasad.csv")

    run_analysis_for_case(db, case2.id)

    # ══════════════════════════════════════════════════════════════════════════
    # CASE 3: Visakhapatnam Port Contraband Ring (FIR 201/2026)
    # ══════════════════════════════════════════════════════════════════════════
    print("\nPreloading Case 3: Visakhapatnam Port Contraband Ring (FIR 201/2026)")
    case3 = Case(name="Visakhapatnam Port Contraband Ring (FIR 201/2026)")
    db.add(case3)
    db.commit()
    db.refresh(case3)

    preload_suspect(db, case3.id, "Tirupati Naidu", 
                    "Case3_Vizag_Contraband_Cartel_CDR_Tirupati_Naidu.csv", 
                    "Case3_Vizag_Contraband_Cartel_IPDR_Tirupati_Naidu.csv")
    preload_suspect(db, case3.id, "Madhav Prasad", 
                    "Case3_Vizag_Contraband_Cartel_CDR_Madhav_Prasad.csv", 
                    "Case3_Vizag_Contraband_Cartel_IPDR_Madhav_Prasad.csv")
    preload_suspect(db, case3.id, "Satyanarayana", 
                    "Case3_Vizag_Contraband_Cartel_CDR_Satyanarayana.csv")

    run_analysis_for_case(db, case3.id)

    db.close()
    print("\nDatabase fully preloaded with three legit cases and analysis!")

if __name__ == "__main__":
    main()
