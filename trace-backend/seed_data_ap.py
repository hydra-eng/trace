"""
seed_data_ap.py — Operation Godavari scenario (Prakasham District, AP/Telangana)
Generates 30 days of CDR + IPDR data for 5 suspects and 1 handler.

Usage:
    python seed_data_ap.py

Outputs:
    data/cdr_suspectA.csv
    data/cdr_suspectB.csv
    data/cdr_suspectC.csv
    data/cdr_suspectD.csv
    data/cdr_suspectE.csv
    data/ipdr_suspectA.csv
    data/ipdr_suspectB.csv
"""

import csv
import os
import random
from datetime import datetime, timedelta

# STRICT GEOGRAPHIC BOUNDS — all towers MUST be within this bounding box
# Andhra Pradesh + Telangana bounding box:
# Lat: 12.6 to 19.9 (south to north)
# Lon: 76.7 to 84.8 (west to east)
# DO NOT generate any coordinate outside this box.

TOWERS = [
    # Prakasham District (primary jurisdiction)
    {"id": "TWR-ONG-001", "name": "Ongole Central",     "lat": 15.5057, "lon": 80.0499, "district": "Prakasham"},
    {"id": "TWR-ONG-002", "name": "Ongole East",        "lat": 15.5120, "lon": 80.0620, "district": "Prakasham"},
    {"id": "TWR-MRT-001", "name": "Markapur",           "lat": 15.7333, "lon": 79.2667, "district": "Prakasham"},
    {"id": "TWR-CDD-001", "name": "Chirala",            "lat": 15.8167, "lon": 80.3500, "district": "Prakasham"},
    {"id": "TWR-KAN-001", "name": "Kandukur",           "lat": 15.2167, "lon": 79.9000, "district": "Prakasham"},
    # Neighboring AP districts
    {"id": "TWR-GNT-001", "name": "Guntur Junction",   "lat": 16.3067, "lon": 80.4365, "district": "Guntur"},
    {"id": "TWR-VJA-001", "name": "Vijayawada Central","lat": 16.5062, "lon": 80.6480, "district": "Krishna"},
    {"id": "TWR-NLR-001", "name": "Nellore Town",      "lat": 14.4426, "lon": 79.9865, "district": "Nellore"},
    # Telangana (bordering)
    {"id": "TWR-HYD-001", "name": "Hyderabad Secunderabad","lat": 17.4399, "lon": 78.4983, "district": "Hyderabad"},
    {"id": "TWR-HYD-002", "name": "LB Nagar",          "lat": 17.3453, "lon": 78.5479, "district": "Hyderabad"},
]

TOWER_MAP = {t["id"]: t for t in TOWERS}

# VALIDATION — add this check before writing any CSV row:
def validate_coord(lat, lon):
    assert 12.6 <= lat <= 19.9, f"Lat {lat} outside AP/Telangana bounds"
    assert 76.7 <= lon <= 84.8, f"Lon {lon} outside AP/Telangana bounds"
    return True

# ── Suspect Registry ──────────────────────────────────────────────────────────
SUSPECTS = [
    {"label": "Suspect A", "msisdn": "919000100001", "role": "kingpin"},
    {"label": "Suspect B", "msisdn": "919000100002", "role": "distributor"},
    {"label": "Suspect C", "msisdn": "919000100003", "role": "distributor"},
    {"label": "Suspect D", "msisdn": "919000100004", "role": "buyer"},
    {"label": "Suspect E", "msisdn": "919000100005", "role": "clean"},
]
HANDLER_NUMBER = "919888000001"  # common coordinator

# IMEI pool per suspect
IMEI_POOL = {
    "919000100001": ["351234567890001", "351234567890099"],  # A swaps on Day 3
    "919000100002": ["351234567890002"],
    "919000100003": ["351234567890003"],
    "919000100004": ["351234567890004"],
    "919000100005": ["351234567890005"],
}

# Family numbers (for Suspect E — fully clean calls)
FAMILY_NUMBERS = [
    "919177001001", "919177001002", "919177001003", "919177001004",
]

START_DATE = datetime(2024, 1, 1, 0, 0, 0)

random.seed(42)  # reproducible


def rand_ts(day: int, hour_min: int = 0, hour_max: int = 23) -> datetime:
    """Random timestamp within a day, within hour bounds."""
    base = START_DATE + timedelta(days=day - 1)
    h = random.randint(hour_min, hour_max)
    m = random.randint(0, 59)
    s = random.randint(0, 59)
    return base.replace(hour=h, minute=m, second=s)


def fmt_ts(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


# Movement routes — realistic NH-16 drug route corridor
SUSPECT_ROUTES = {
    'Suspect A': ['TWR-ONG-001', 'TWR-ONG-002', 'TWR-CDD-001', 'TWR-ONG-001', 'TWR-MRT-001'],
    'Suspect B': ['TWR-ONG-001', 'TWR-GNT-001', 'TWR-VJA-001', 'TWR-GNT-001'],
    'Suspect C': ['TWR-HYD-001', 'TWR-HYD-002', 'TWR-ONG-002', 'TWR-HYD-001'],
    'Suspect D': ['TWR-NLR-001', 'TWR-KAN-001', 'TWR-NLR-001'],
    'Suspect E': ['TWR-GNT-001', 'TWR-GNT-001'],  # stays local, clean
}

def tower_for(suspect_msisdn: str, day: int) -> dict:
    """Return the tower a suspect is at on a given day, based on the story."""
    msisdn_to_label = {
        "919000100001": "Suspect A",
        "919000100002": "Suspect B",
        "919000100003": "Suspect C",
        "919000100004": "Suspect D",
        "919000100005": "Suspect E",
    }
    label = msisdn_to_label.get(suspect_msisdn, "Suspect E")
    route = SUSPECT_ROUTES[label]
    idx = min((day - 1) // 7, len(route) - 1)
    tower_id = route[idx]
    return TOWER_MAP[tower_id]


# ── CDR Generation ────────────────────────────────────────────────────────────

CDR_HEADER = [
    "msisdn_a", "msisdn_b", "call_type", "timestamp", "duration_sec",
    "tower_id", "tower_lat", "tower_lon", "imei", "call_direction",
]


def generate_cdr_a() -> list[list]:
    """Suspect A — kingpin: 60+ calls in Days 1-3, burst, IMEI swap Day 3 02:30, calls all, handler. Night ratio >70%."""
    rows = []
    targets = [s["msisdn"] for s in SUSPECTS if s["msisdn"] != "919000100001"] + [HANDLER_NUMBER]

    for day in range(1, 31):
        tower = tower_for("919000100001", day)
        # IMEI: swap on Day 3 at 02:30
        if day < 3:
            imei = IMEI_POOL["919000100001"][0]
        else:
            imei = IMEI_POOL["919000100001"][1]

        # Silent on Days 4-5
        if day in (4, 5):
            continue

        # Burst in Days 1-3: 20 calls/day; Days 6-30: 3-5 calls/day
        n_calls = 20 if day <= 3 else random.randint(3, 6)

        for _ in range(n_calls):
            # Night call ratio >70%
            if random.random() < 0.72:
                ts = rand_ts(day, 21, 23) if random.random() < 0.5 else rand_ts(day, 0, 4)
            else:
                ts = rand_ts(day, 6, 20)

            msisdn_b = random.choice(targets)
            direction = random.choice(["MO", "MT"])
            dur = random.randint(30, 420)

            rows.append([
                "919000100001", msisdn_b, "CALL", fmt_ts(ts), dur,
                tower["id"], tower["lat"], tower["lon"], imei, direction,
            ])

        # Add 3-5 SMS per day too
        for _ in range(random.randint(3, 5)):
            ts = rand_ts(day)
            rows.append([
                "919000100001", random.choice(targets), "SMS", fmt_ts(ts), 0,
                tower["id"], tower["lat"], tower["lon"], imei, "MO",
            ])

    return rows


def generate_cdr_b() -> list[list]:
    """Suspect B — distributor: moves ONG→GNT→VJA. Meets A at TWR-ONG-001 Day 2 15:00. Calls A,C,D,Handler."""
    rows = []
    targets_b = ["919000100001", "919000100003", "919000100004", HANDLER_NUMBER]
    imei = IMEI_POOL["919000100002"][0]

    for day in range(1, 31):
        tower = tower_for("919000100002", day)
        n_calls = random.randint(4, 10)

        for _ in range(n_calls):
            ts = rand_ts(day)
            msisdn_b = random.choice(targets_b)
            rows.append([
                "919000100002", msisdn_b, "CALL", fmt_ts(ts), random.randint(20, 360),
                tower["id"], tower["lat"], tower["lon"], imei, "MO",
            ])

        # Day 2 15:00 — at TWR-ONG-001, call A
        if day == 2:
            co_ts = START_DATE + timedelta(days=1, hours=15, minutes=0)
            tower = TOWER_MAP["TWR-ONG-001"]
            rows.append([
                "919000100002", "919000100001", "CALL", fmt_ts(co_ts), 180,
                "TWR-ONG-001", tower["lat"], tower["lon"], imei, "MO",
            ])

    return rows


def generate_cdr_c() -> list[list]:
    """Suspect C — Hyderabad→Ongole Day2 15:15 (co-location). Calls A,B,Handler."""
    rows = []
    targets_c = ["919000100001", "919000100002", HANDLER_NUMBER]
    imei = IMEI_POOL["919000100003"][0]

    for day in range(1, 31):
        tower = tower_for("919000100003", day)
        n_calls = random.randint(3, 8)

        for _ in range(n_calls):
            ts = rand_ts(day)
            msisdn_b = random.choice(targets_c)
            rows.append([
                "919000100003", msisdn_b, "CALL", fmt_ts(ts), random.randint(15, 300),
                tower["id"], tower["lat"], tower["lon"], imei, "MO",
            ])

        # Day 2 15:15 — at TWR-ONG-002, with A and B (co-location event)
        if day == 2:
            co_ts = START_DATE + timedelta(days=1, hours=15, minutes=15)
            tower = TOWER_MAP["TWR-ONG-002"]
            rows.append([
                "919000100003", "919000100001", "CALL", fmt_ts(co_ts), 240,
                "TWR-ONG-002", tower["lat"], tower["lon"], imei, "MT",
            ])

    return rows


def generate_cdr_d() -> list[list]:
    """Suspect D — buyer: only calls B and C. Stays Nellore. Normal pattern. No IMEI swap."""
    rows = []
    targets_d = ["919000100002", "919000100003"]
    imei = IMEI_POOL["919000100004"][0]

    for day in range(1, 31):
        tower = tower_for("919000100004", day)
        n_calls = random.randint(1, 4)
        for _ in range(n_calls):
            ts = rand_ts(day, 8, 20)  # business hours only
            msisdn_b = random.choice(targets_d)
            rows.append([
                "919000100004", msisdn_b, "CALL", fmt_ts(ts), random.randint(30, 180),
                tower["id"], tower["lat"], tower["lon"], imei, "MO",
            ])

    return rows


def generate_cdr_e() -> list[list]:
    """Suspect E — clean: only calls family numbers. Negative control."""
    rows = []
    imei = IMEI_POOL["919000100005"][0]

    for day in range(1, 31):
        tower = tower_for("919000100005", day)
        n_calls = random.randint(2, 5)
        for _ in range(n_calls):
            ts = rand_ts(day, 7, 22)
            msisdn_b = random.choice(FAMILY_NUMBERS)
            rows.append([
                "919000100005", msisdn_b, "CALL", fmt_ts(ts), random.randint(20, 600),
                tower["id"], tower["lat"], tower["lon"], imei, "MO",
            ])

    return rows


# ── IPDR Generation ───────────────────────────────────────────────────────────

IPDR_HEADER = [
    "msisdn", "dest_ip", "dest_port", "data_volume_kb", "timestamp"
]

OTT_APPS = [
    ("WhatsApp", "157.240.198.35", 443, "HTTPS", "Meta"),
    ("Telegram", "149.154.167.91", 443, "HTTPS", "Telegram"),
    ("WhatsApp", "157.240.198.35", 443, "HTTPS", "Meta"),
    ("Signal", "76.223.92.165", 443, "HTTPS", "Signal"),
    ("WhatsApp", "157.240.198.35", 443, "HTTPS", "Meta"),
]


def make_ip() -> str:
    return f"{random.randint(1,254)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"


def generate_ipdr(msisdn: str, days: int = 30, sessions_per_day: int = 14) -> list[list]:
    rows = []
    for day in range(1, days + 1):
        n_sessions = random.randint(sessions_per_day // 2, sessions_per_day)
        for _ in range(n_sessions):
            ts = rand_ts(day)
            app_info = random.choice(OTT_APPS)
            app_name, dst_ip, dst_port, proto, _ = app_info
            volume = round(random.uniform(10, 2500), 1)
            rows.append([
                msisdn, dst_ip, dst_port, volume, fmt_ts(ts)
            ])
    return rows


# ── Write CSVs ────────────────────────────────────────────────────────────────

def write_csv(path: str, header: list, rows: list):
    # Validate each row's coordinates
    lat_idx = -1
    lon_idx = -1
    if "tower_lat" in header:
        lat_idx = header.index("tower_lat")
    if "tower_lon" in header:
        lon_idx = header.index("tower_lon")
        
    for r in rows:
        if lat_idx != -1 and lon_idx != -1:
            lat = float(r[lat_idx])
            lon = float(r[lon_idx])
            validate_coord(lat, lon)

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"  Written {len(rows):>4} rows -> {path}")


if __name__ == "__main__":
    print("Generating seed data: Operation Godavari scenario (AP/Telangana)...")

    # Outputs for data/
    write_csv("data/cdr_suspectA.csv", CDR_HEADER, generate_cdr_a())
    write_csv("data/cdr_suspectB.csv", CDR_HEADER, generate_cdr_b())
    write_csv("data/cdr_suspectC.csv", CDR_HEADER, generate_cdr_c())
    write_csv("data/cdr_suspectD.csv", CDR_HEADER, generate_cdr_d())
    write_csv("data/cdr_suspectE.csv", CDR_HEADER, generate_cdr_e())

    write_csv("data/ipdr_suspectA.csv", IPDR_HEADER, generate_ipdr("919000100001", sessions_per_day=14))
    write_csv("data/ipdr_suspectB.csv", IPDR_HEADER, generate_ipdr("919000100002", sessions_per_day=10))

    # Outputs for seed_csvs/ (overwrite so tests/UI use correct AP data)
    write_csv("seed_csvs/suspect_a_cdr.csv", CDR_HEADER, generate_cdr_a())
    write_csv("seed_csvs/suspect_b_cdr.csv", CDR_HEADER, generate_cdr_b())
    write_csv("seed_csvs/suspect_c_cdr.csv", CDR_HEADER, generate_cdr_c())
    write_csv("seed_csvs/suspect_d_cdr.csv", CDR_HEADER, generate_cdr_d())
    write_csv("seed_csvs/suspect_e_cdr.csv", CDR_HEADER, generate_cdr_e())

    write_csv("seed_csvs/suspect_a_ipdr.csv", IPDR_HEADER, generate_ipdr("919000100001", sessions_per_day=14))
    write_csv("seed_csvs/suspect_b_ipdr.csv", IPDR_HEADER, generate_ipdr("919000100002", sessions_per_day=10))

    print("\nSeed data generated: Operation Godavari scenario (AP/Telangana)")
    print("Case: Operation Godavari - Prakasham District")
    print("Towers: 10 AP/Telangana locations (Ongole, Guntur, Vijayawada, Hyderabad, Nellore...)")
    print("Story: Suspect A (kingpin/Ongole) -> B (distributor/route NH-16) -> C (Hyderabad)")
    print("       Co-location event: TWR-ONG-002 on Day 2 at 15:00-15:30")
    print("       IMEI swap: Suspect A on Day 3 at ~02:30")
    print("       Handler: 919888000001 appears in A, B, C CDR only")
