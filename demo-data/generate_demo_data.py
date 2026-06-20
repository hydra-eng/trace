"""
TRACE Demo Data Generator
Generates realistic CDR and IPDR CSV files in both:
1. Real-life Telecom Operator / TRAI format (for display/presentation)
2. TRACE App Compatible format (for direct upload/ingestion)
All coordinates are strictly within Prakasam District, Andhra Pradesh.

Narrative: A robbery gang case — Ravi Kumar Reddy (primary suspect) coordinated
with co-accused Suresh Babu Naidu. IMEI swap detected, burst call pattern,
encrypted OTT usage, co-location at Chirala tower.

Run: python generate_demo_data.py
"""

import csv
import random
import os
from datetime import datetime, timedelta

random.seed(42)
OUT = os.path.dirname(os.path.abspath(__file__))

# ── Prakasam District Cell Towers ──────────────────────────────────────────────
# Bounding box is strictly valid for AP/Telangana. All coordinates are Prakasam locations.
TOWERS = [
    {"id": "ONG-CENT-001", "name": "Ongole Central",    "lat": 15.5057, "lon": 80.0499, "lac": 4210},
    {"id": "ONG-EAST-002", "name": "Ongole East",       "lat": 15.5120, "lon": 80.0620, "lac": 4211},
    {"id": "ONG-WEST-003", "name": "Ongole West",       "lat": 15.5000, "lon": 80.0350, "lac": 4212},
    {"id": "CHR-MAIN-004", "name": "Chirala Town",      "lat": 15.8167, "lon": 80.3500, "lac": 4220},
    {"id": "CHR-EAST-005", "name": "Chirala East",      "lat": 15.8240, "lon": 80.3620, "lac": 4221},
    {"id": "MKP-CENT-006", "name": "Markapur Central",  "lat": 15.7333, "lon": 79.2667, "lac": 4230},
    {"id": "MKP-NH-007",   "name": "Markapur NH-67",    "lat": 15.7450, "lon": 79.2800, "lac": 4231},
    {"id": "KDK-MAIN-008", "name": "Kandukur Town",     "lat": 15.2167, "lon": 79.9000, "lac": 4240},
    {"id": "ADK-MAIN-009", "name": "Addanki Junction",  "lat": 15.7500, "lon": 79.9750, "lac": 4250},
    {"id": "DRS-MAIN-010", "name": "Darsi Town",        "lat": 15.7667, "lon": 79.6833, "lac": 4260},
    {"id": "PDL-CENT-011", "name": "Podili Centre",     "lat": 15.4667, "lon": 79.5833, "lac": 4270},
    {"id": "GDL-MAIN-012", "name": "Giddalur Bypass",   "lat": 15.3667, "lon": 78.9333, "lac": 4280},
    {"id": "SNR-MAIN-013", "name": "Singarayakonda",    "lat": 15.2333, "lon": 80.0167, "lac": 4290},
    {"id": "VTM-MAIN-014", "name": "Vetapalem Cross",   "lat": 15.7833, "lon": 80.3167, "lac": 4300},
]

# ── Persons (Telugu Names & Realistic Mobile Numbers) ───────────────────────────
SUSPECT_A = {
    "msisdn": "+91-9441234567", "name": "Ravi Kumar Reddy",
    "imei_old": "356812094523001", "imei_new": "490123456789012",
    "imsi": "404100441234567",
}
SUSPECT_B = {
    "msisdn": "+91-9963456789", "name": "Suresh Babu Naidu",
    "imei": "352098765432100",
    "imsi": "404100996345678",
}
SUSPECT_C = {
    "msisdn": "+91-9849000312", "name": "Ramaiah Yadav",
    "imei": "356001122334455",
    "imsi": "404100984900031",
}

# Known contacts (not suspects, but relevant)
HANDLER_NUMBER = "+91-9912000111"   # Unknown handler — appears in all 3 CDRs
VICTIM_NUMBER  = "+91-8019876543"   # Victim / complaint party
LAWYER_NUMBER  = "+91-9848111222"   # Legal contact of suspect A
MISC_CONTACTS  = [
    "+91-8341567890", "+91-9000112233", "+91-7330198765",
    "+91-9849234567", "+91-8074561234", "+91-9032456789",
    "+91-7032111234", "+91-9177234560",
]

BASE_DATE = datetime(2024, 1, 1, 6, 0, 0)

def rand_time(base: datetime, hour_min=6, hour_max=22) -> datetime:
    offset_days = random.randint(0, 0)
    hour = random.randint(hour_min, hour_max)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return base.replace(hour=hour, minute=minute, second=second) + timedelta(days=offset_days)

def fmt(dt: datetime) -> tuple:
    return dt.strftime("%d/%m/%Y"), dt.strftime("%H:%M:%S")

def call_type():
    return random.choice(["MOC", "MTC", "MOC", "MOC", "SMS-MO", "MOC"])

def duration():
    return random.randint(10, 480)

# ══════════════════════════════════════════════════════════════════════════════
# Headers Definitions
# ══════════════════════════════════════════════════════════════════════════════
CDR_HEADERS = [
    "Sl_No", "A_Party_MSISDN", "B_Party_MSISDN", "Date", "Time",
    "Duration_Sec", "Call_Type", "IMEI", "IMSI",
    "Cell_ID", "LAC", "Tower_Name", "Tower_Latitude", "Tower_Longitude",
    "Telecom_Circle", "Operator", "Roaming_Flag", "Remarks"
]

IPDR_HEADERS = [
    "Sl_No", "MSISDN", "IMSI", "Allocated_IP", "Start_Date", "Start_Time",
    "End_Date", "End_Time", "Duration_Sec", "Upload_KB", "Download_KB",
    "Dest_IP", "Dest_Port", "Protocol", "App_Label",
    "Cell_ID", "Tower_Latitude", "Tower_Longitude", "Telecom_Circle", "Operator"
]

# ══════════════════════════════════════════════════════════════════════════════
# Writers for Operator (TRAI) & TRACE-Compatible Layouts
# ══════════════════════════════════════════════════════════════════════════════
def write_cdr_dataset(filename_prefix: str, rows: list):
    # 1. Operator (TRAI) Format
    op_filename = f"Prakasam_District_Operator_{filename_prefix}.csv"
    op_path = os.path.join(OUT, op_filename)
    with open(op_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(CDR_HEADERS)
        w.writerows(rows)
    print(f"  Written Operator Format: {op_filename} ({len(rows)} records)")

    # 2. TRACE Compatible Format
    # Headers: msisdn_a, msisdn_b, imei, tower_id, tower_lat, tower_lon, call_type, duration_sec, timestamp
    comp_filename = f"COMPATIBLE_Prakasam_District_{filename_prefix}.csv"
    comp_path = os.path.join(OUT, comp_filename)
    comp_rows = []
    for r in rows:
        dt_str = f"{r[3]} {r[4]}"
        try:
            dt = datetime.strptime(dt_str, "%d/%m/%Y %H:%M:%S")
            ts_str = dt.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            ts_str = dt_str
        
        comp_rows.append([
            r[1], # msisdn_a
            r[2], # msisdn_b
            r[7], # imei
            r[9], # tower_id (cell_id)
            r[12], # tower_lat
            r[13], # tower_lon
            r[6], # call_type
            r[5], # duration_sec
            ts_str # timestamp
        ])
    
    with open(comp_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["msisdn_a", "msisdn_b", "imei", "tower_id", "tower_lat", "tower_lon", "call_type", "duration_sec", "timestamp"])
        w.writerows(comp_rows)
    print(f"  Written Compatible Format: {comp_filename} ({len(comp_rows)} records)")

def write_ipdr_dataset(filename_prefix: str, rows: list):
    # 1. Operator (TRAI) Format
    op_filename = f"Prakasam_District_Operator_{filename_prefix}.csv"
    op_path = os.path.join(OUT, op_filename)
    with open(op_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(IPDR_HEADERS)
        w.writerows(rows)
    print(f"  Written Operator Format: {op_filename} ({len(rows)} records)")

    # 2. TRACE Compatible Format
    # Headers: msisdn, dest_ip, dest_port, data_volume_kb, timestamp
    comp_filename = f"COMPATIBLE_Prakasam_District_{filename_prefix}.csv"
    comp_path = os.path.join(OUT, comp_filename)
    comp_rows = []
    for r in rows:
        dt_str = f"{r[4]} {r[5]}"
        try:
            dt = datetime.strptime(dt_str, "%d/%m/%Y %H:%M:%S")
            ts_str = dt.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            ts_str = dt_str
        
        volume = float(r[9]) + float(r[10]) # Upload + Download
        
        comp_rows.append([
            r[1], # msisdn
            r[11], # dest_ip
            r[12], # dest_port
            round(volume, 2), # data_volume_kb
            ts_str # timestamp
        ])
    
    with open(comp_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["msisdn", "dest_ip", "dest_port", "data_volume_kb", "timestamp"])
        w.writerows(comp_rows)
    print(f"  Written Compatible Format: {comp_filename} ({len(comp_rows)} records)")

def make_cdr_row(sl, a_msisdn, b_msisdn, dt, dur, ctype, imei, imsi, tower, remarks=""):
    d, t = fmt(dt)
    return [
        sl, a_msisdn, b_msisdn, d, t, dur, ctype,
        imei, imsi,
        tower["id"], tower["lac"], tower["name"],
        f"{tower['lat']:.4f}", f"{tower['lon']:.4f}",
        "Andhra Pradesh", "BSNL" if "441" in a_msisdn else "Airtel",
        "N", remarks
    ]

# ══════════════════════════════════════════════════════════════════════════════
# DATA GENERATION
# ══════════════════════════════════════════════════════════════════════════════

# ──────────────────────────────────────────────────────────────────────────────
# CDR — SUSPECT A (Ravi Kumar Reddy)
# ──────────────────────────────────────────────────────────────────────────────
rows_a = []
sl = 1

# Jan 1 — Normal day in Ongole
ong = next(t for t in TOWERS if t["id"] == "ONG-CENT-001")
for day in range(2):  # Jan 1–2
    base = BASE_DATE + timedelta(days=day)
    for _ in range(8):
        b = random.choice(MISC_CONTACTS + [HANDLER_NUMBER])
        dt = rand_time(base, 9, 20)
        rows_a.append(make_cdr_row(sl, SUSPECT_A["msisdn"], b, dt, duration(), "MOC", SUSPECT_A["imei_old"], SUSPECT_A["imsi"], ong))
        sl += 1

# Jan 3 — IMEI swap day (morning old IMEI, evening new IMEI)
base3 = BASE_DATE + timedelta(days=2)
for hr in [9, 10, 11]:
    dt = base3.replace(hour=hr, minute=random.randint(0,59))
    rows_a.append(make_cdr_row(sl, SUSPECT_A["msisdn"], HANDLER_NUMBER, dt, duration(), "MOC", SUSPECT_A["imei_old"], SUSPECT_A["imsi"], ong, "Pre-swap activity"))
    sl += 1

# IMEI swap timestamp
swap_dt = base3.replace(hour=18, minute=13, second=43)
for hr in [18, 19, 21, 23]:
    dt = base3.replace(hour=hr, minute=random.randint(5,55))
    b = random.choice([SUSPECT_B["msisdn"], HANDLER_NUMBER, MISC_CONTACTS[0]])
    rows_a.append(make_cdr_row(sl, SUSPECT_A["msisdn"], b, dt, duration(), "MOC", SUSPECT_A["imei_new"], SUSPECT_A["imsi"], ong, "Post-IMEI-swap"))
    sl += 1

# Jan 4 — BURST: 30+ calls (panic mode — pre-crime coordination)
base4 = BASE_DATE + timedelta(days=3)
burst_tower = next(t for t in TOWERS if t["id"] == "ONG-EAST-002")
for i in range(32):
    hr = random.randint(6, 23)
    dt = base4.replace(hour=hr, minute=random.randint(0,59))
    b = random.choice([SUSPECT_B["msisdn"], HANDLER_NUMBER, SUSPECT_C["msisdn"]] + MISC_CONTACTS[:3])
    ctype = "MOC" if i % 7 != 0 else "SMS-MO"
    rows_a.append(make_cdr_row(sl, SUSPECT_A["msisdn"], b, dt, duration() if ctype=="MOC" else 0, ctype, SUSPECT_A["imei_new"], SUSPECT_A["imsi"], burst_tower, "BURST_PERIOD"))
    sl += 1

# Jan 5 — COMPLETE SILENCE (no records — intentional)

# Jan 6 — Movement to Markapur (distant location, ~120 km from Ongole)
base6 = BASE_DATE + timedelta(days=5)
mkp = next(t for t in TOWERS if t["id"] == "MKP-CENT-006")
for i in range(6):
    hr = random.randint(10, 20)
    dt = base6.replace(hour=hr, minute=random.randint(0,59))
    rows_a.append(make_cdr_row(sl, SUSPECT_A["msisdn"], HANDLER_NUMBER, dt, duration(), "MOC", SUSPECT_A["imei_new"], SUSPECT_A["imsi"], mkp, "AT_CRIME_SCENE_AREA"))
    sl += 1

# Jan 7 — CO-LOCATION with Suspect B at Chirala (both at CHR-MAIN-004 14:55–15:30)
base7 = BASE_DATE + timedelta(days=6)
chr_tower = next(t for t in TOWERS if t["id"] == "CHR-MAIN-004")
coloc_hours = [14, 15]  # 14:55–15:30 window
for i, hr in enumerate(coloc_hours * 2):
    dt = base7.replace(hour=hr, minute=random.choice([55,10,20,30]))
    b = SUSPECT_B["msisdn"] if i % 2 == 0 else MISC_CONTACTS[1]
    rows_a.append(make_cdr_row(sl, SUSPECT_A["msisdn"], b, dt, duration(), "MOC", SUSPECT_A["imei_new"], SUSPECT_A["imsi"], chr_tower, "CO-LOCATION_WITH_SUSPECT_B"))
    sl += 1

# Jan 8–10 — Night calls (evasion pattern)
for day_off in range(3):
    base_n = BASE_DATE + timedelta(days=7+day_off)
    for _ in range(5):
        hr = random.randint(23, 23) if random.random() > 0.5 else random.randint(0, 4)
        dt = base_n.replace(hour=hr, minute=random.randint(0,59))
        if hr >= 23:
            dt = base_n.replace(hour=23, minute=random.randint(30,59))
        else:
            dt = (base_n + timedelta(days=1)).replace(hour=random.randint(1,4), minute=random.randint(0,59))
        rows_a.append(make_cdr_row(sl, SUSPECT_A["msisdn"], HANDLER_NUMBER, dt, duration(), "MOC", SUSPECT_A["imei_new"], SUSPECT_A["imsi"], ong, "NIGHT_CALL"))
        sl += 1

# Jan 11–15 — Return to normal, some contact with lawyer
base11 = BASE_DATE + timedelta(days=10)
for day_off in range(5):
    base_n = base11 + timedelta(days=day_off)
    for _ in range(4):
        b = random.choice(MISC_CONTACTS + [LAWYER_NUMBER])
        dt = rand_time(base_n, 9, 18)
        rows_a.append(make_cdr_row(sl, SUSPECT_A["msisdn"], b, dt, duration(), call_type(), SUSPECT_A["imei_new"], SUSPECT_A["imsi"], ong, ""))
        sl += 1

rows_a.sort(key=lambda r: datetime.strptime(f"{r[3]} {r[4]}", "%d/%m/%Y %H:%M:%S"))
for i, r in enumerate(rows_a): r[0] = i + 1


# ──────────────────────────────────────────────────────────────────────────────
# CDR — SUSPECT B (Suresh Babu Naidu)
# ──────────────────────────────────────────────────────────────────────────────
rows_b = []
sl = 1
chirala_tower = next(t for t in TOWERS if t["id"] == "CHR-MAIN-004")
chirala_east  = next(t for t in TOWERS if t["id"] == "CHR-EAST-005")

# Jan 1–3: activity in Chirala area
for day in range(3):
    base = BASE_DATE + timedelta(days=day)
    for _ in range(7):
        b = random.choice(MISC_CONTACTS[3:] + [HANDLER_NUMBER])
        dt = rand_time(base, 8, 21)
        rows_b.append(make_cdr_row(sl, SUSPECT_B["msisdn"], b, dt, duration(), call_type(), SUSPECT_B["imei"], SUSPECT_B["imsi"], chirala_tower))
        sl += 1

# Jan 4 — Burst calls from Chirala coordinating with Suspect A
base4b = BASE_DATE + timedelta(days=3)
for i in range(20):
    hr = random.randint(7, 22)
    dt = base4b.replace(hour=hr, minute=random.randint(0,59))
    b = SUSPECT_A["msisdn"] if i % 3 == 0 else random.choice([HANDLER_NUMBER] + MISC_CONTACTS[2:5])
    rows_b.append(make_cdr_row(sl, SUSPECT_B["msisdn"], b, dt, duration(), "MOC", SUSPECT_B["imei"], SUSPECT_B["imsi"], chirala_tower, "BURST_COORD"))
    sl += 1

# Jan 5 — Silence

# Jan 7 — CO-LOCATION at Chirala with Suspect A (14:55–15:30 window)
base7b = BASE_DATE + timedelta(days=6)
for hr, mn in [(14,55), (15,10), (15,25), (15,30)]:
    dt = base7b.replace(hour=hr, minute=mn, second=random.randint(0,59))
    b = SUSPECT_A["msisdn"] if hr == 14 else random.choice(MISC_CONTACTS)
    rows_b.append(make_cdr_row(sl, SUSPECT_B["msisdn"], b, dt, duration(), "MOC", SUSPECT_B["imei"], SUSPECT_B["imsi"], chirala_tower, "CO-LOCATION_WITH_SUSPECT_A"))
    sl += 1

# Jan 8–15 — Vetapalem (trying to flee district)
vtm = next(t for t in TOWERS if t["id"] == "VTM-MAIN-014")
for day_off in range(8):
    base_n = BASE_DATE + timedelta(days=7+day_off)
    for _ in range(5):
        b = random.choice(MISC_CONTACTS + [HANDLER_NUMBER])
        dt = rand_time(base_n, 8, 20)
        rows_b.append(make_cdr_row(sl, SUSPECT_B["msisdn"], b, dt, duration(), call_type(), SUSPECT_B["imei"], SUSPECT_B["imsi"], vtm, "MOVED_TO_VETAPALEM"))
        sl += 1

rows_b.sort(key=lambda r: datetime.strptime(f"{r[3]} {r[4]}", "%d/%m/%Y %H:%M:%S"))
for i, r in enumerate(rows_b): r[0] = i + 1


# ──────────────────────────────────────────────────────────────────────────────
# CDR — SUSPECT C (Ramaiah Yadav)
# ──────────────────────────────────────────────────────────────────────────────
rows_c = []
sl = 1
kdk = next(t for t in TOWERS if t["id"] == "KDK-MAIN-008")

for day in range(15):
    base = BASE_DATE + timedelta(days=day)
    for _ in range(random.randint(3, 8)):
        b = random.choice([SUSPECT_A["msisdn"], HANDLER_NUMBER] + MISC_CONTACTS)
        dt = rand_time(base, 8, 22)
        rows_c.append(make_cdr_row(sl, SUSPECT_C["msisdn"], b, dt, duration(), call_type(), SUSPECT_C["imei"], SUSPECT_C["imsi"], kdk, ""))
        sl += 1

rows_c.sort(key=lambda r: datetime.strptime(f"{r[3]} {r[4]}", "%d/%m/%Y %H:%M:%S"))
for i, r in enumerate(rows_c): r[0] = i + 1


# ──────────────────────────────────────────────────────────────────────────────
# IPDR — SUSPECT A (Ravi Kumar Reddy)
# ──────────────────────────────────────────────────────────────────────────────
OTT_APPS = [
    ("WhatsApp",  "157.240.241.54",  443, "HTTPS/E2E"),
    ("WhatsApp",  "157.240.241.54",  443, "HTTPS/E2E"),
    ("Telegram",  "149.154.167.91",  443, "HTTPS/E2E"),
    ("Telegram",  "149.154.167.91",  443, "HTTPS/E2E"),
    ("YouTube",   "142.250.76.46",   443, "HTTPS"),
    ("Google",    "142.250.182.46",  443, "HTTPS"),
    ("Instagram", "157.240.241.174", 443, "HTTPS"),
    ("PhonePe",   "52.220.105.26",   443, "HTTPS"),
]

def make_ipdr_row(sl, msisdn, imsi, start_dt, dur_sec, up_kb, dn_kb, app_info, tower):
    end_dt = start_dt + timedelta(seconds=dur_sec)
    sd, st = fmt(start_dt)
    ed, et = fmt(end_dt)
    app_name, dest_ip, dest_port, protocol = app_info
    ip = f"10.{random.randint(100,200)}.{random.randint(1,254)}.{random.randint(1,254)}"
    return [
        sl, msisdn, imsi, ip, sd, st, ed, et, dur_sec,
        up_kb, dn_kb, dest_ip, dest_port, protocol, app_name,
        tower["id"], f"{tower['lat']:.4f}", f"{tower['lon']:.4f}",
        "Andhra Pradesh", "BSNL"
    ]

rows_ipdr_a = []
sl = 1
for day in range(15):
    base = BASE_DATE + timedelta(days=day)
    tower = random.choice([ong, chr_tower, mkp] if day >= 5 else [ong])
    for _ in range(random.randint(4, 12)):
        app = random.choice(OTT_APPS)
        hr = random.randint(6, 23)
        dt = base.replace(hour=hr, minute=random.randint(0,59), second=random.randint(0,59))
        dur = random.randint(30, 3600)
        up = random.randint(50, 2000)
        dn = random.randint(200, 8000)
        rows_ipdr_a.append(make_ipdr_row(sl, SUSPECT_A["msisdn"], SUSPECT_A["imsi"], dt, dur, up, dn, app, tower))
        sl += 1

rows_ipdr_a.sort(key=lambda r: datetime.strptime(f"{r[4]} {r[5]}", "%d/%m/%Y %H:%M:%S"))
for i, r in enumerate(rows_ipdr_a): r[0] = i + 1


# ──────────────────────────────────────────────────────────────────────────────
# IPDR — SUSPECT B (Suresh Babu Naidu)
# ──────────────────────────────────────────────────────────────────────────────
rows_ipdr_b = []
sl = 1
for day in range(15):
    base = BASE_DATE + timedelta(days=day)
    tower = random.choice([chirala_tower, vtm] if day >= 7 else [chirala_tower])
    for _ in range(random.randint(3, 8)):
        app = random.choice(OTT_APPS[4:]) # non-encrypted or standard web apps
        if random.random() < 0.15:
            app = OTT_APPS[0] # WhatsApp occasionally
        hr = random.randint(7, 22)
        dt = base.replace(hour=hr, minute=random.randint(0,59), second=random.randint(0,59))
        dur = random.randint(30, 2000)
        up = random.randint(20, 1000)
        dn = random.randint(100, 5000)
        rows_ipdr_b.append(make_ipdr_row(sl, SUSPECT_B["msisdn"], SUSPECT_B["imsi"], dt, dur, up, dn, app, tower))
        sl += 1

rows_ipdr_b.sort(key=lambda r: datetime.strptime(f"{r[4]} {r[5]}", "%d/%m/%Y %H:%M:%S"))
for i, r in enumerate(rows_ipdr_b): r[0] = i + 1


# ══════════════════════════════════════════════════════════════════════════════
# WRITE FILES
# ══════════════════════════════════════════════════════════════════════════════
print("Generating demo files...")

write_cdr_dataset("CDR_SuspectA_Ravi_Kumar_9441234567", rows_a)
write_cdr_dataset("CDR_SuspectB_Suresh_Babu_9963456789", rows_b)
write_cdr_dataset("CDR_SuspectC_Ramaiah_Yadav_9849000312", rows_c)

write_ipdr_dataset("IPDR_SuspectA_Ravi_Kumar_9441234567", rows_ipdr_a)
write_ipdr_dataset("IPDR_SuspectB_Suresh_Babu_9963456789", rows_ipdr_b)

# ══════════════════════════════════════════════════════════════════════════════
# README for demo-data folder
# ══════════════════════════════════════════════════════════════════════════════
readme = """# TRACE Demo Data — Prakasam District, Andhra Pradesh
# Case: Organised Robbery Gang — January 2024

We generate data in two formats to accommodate your needs during presentation and system testing:
1. **Operator Format (Prakasam_District_Operator_...csv)**: Represents the raw, standard DoT/TRAI layout police receive directly from telecom carriers. Includes realistic operators, circle, cell-ID/LAC details. Use these to display or print as mock authentic files.
2. **Compatible Format (COMPATIBLE_Prakasam_District_...csv)**: Fully compatible with the TRACE system's direct upload parser. Use these to import data into the app!

## Suspect Profiles & Files
- **Suspect A: Ravi Kumar Reddy** (Primary Suspect, Ongole)
  - `Prakasam_District_Operator_CDR_SuspectA_Ravi_Kumar_9441234567.csv`
  - `COMPATIBLE_Prakasam_District_CDR_SuspectA_Ravi_Kumar_9441234567.csv`
  - `Prakasam_District_Operator_IPDR_SuspectA_Ravi_Kumar_9441234567.csv`
  - `COMPATIBLE_Prakasam_District_IPDR_SuspectA_Ravi_Kumar_9441234567.csv`

- **Suspect B: Suresh Babu Naidu** (Co-Accused / Distributor, Chirala)
  - `Prakasam_District_Operator_CDR_SuspectB_Suresh_Babu_9963456789.csv`
  - `COMPATIBLE_Prakasam_District_CDR_SuspectB_Suresh_Babu_9963456789.csv`
  - `Prakasam_District_Operator_IPDR_SuspectB_Suresh_Babu_9963456789.csv`
  - `COMPATIBLE_Prakasam_District_IPDR_SuspectB_Suresh_Babu_9963456789.csv`

- **Suspect C: Ramaiah Yadav** (Facilitator, Kandukur)
  - `Prakasam_District_Operator_CDR_SuspectC_Ramaiah_Yadav_9849000312.csv`
  - `COMPATIBLE_Prakasam_District_CDR_SuspectC_Ramaiah_Yadav_9849000312.csv`

## Columns Reference (Standard vs Compatible)
- **Operator CDR Columns**: Sl_No, A_Party_MSISDN, B_Party_MSISDN, Date, Time, Duration_Sec, Call_Type, IMEI, IMSI, Cell_ID, LAC, Tower_Name, Tower_Latitude, Tower_Longitude, Telecom_Circle, Operator, Roaming_Flag, Remarks
- **Compatible CDR Columns**: msisdn_a, msisdn_b, imei, tower_id, tower_lat, tower_lon, call_type, duration_sec, timestamp
- **Operator IPDR Columns**: Sl_No, MSISDN, IMSI, Allocated_IP, Start_Date, Start_Time, End_Date, End_Time, Duration_Sec, Upload_KB, Download_KB, Dest_IP, Dest_Port, Protocol, App_Label, Cell_ID, Tower_Latitude, Tower_Longitude, Telecom_Circle, Operator
- **Compatible IPDR Columns**: msisdn, dest_ip, dest_port, data_volume_kb, timestamp

## Story Timeline (Prakasam District Robbery Case)
1. **Ravi Kumar Reddy** operates out of **Ongole Central**.
2. **Jan 3: IMEI Swap** — Ravi swaps his phone at 18:13 hrs (old IMEI `356812094523001` -> new IMEI `490123456789012`).
3. **Jan 4: Coordination Burst** — Primary suspect conducts 32 panic calls in one day coordinating with Suresh Babu and handler.
4. **Jan 5: Silence** — Suspects go dark/silent.
5. **Jan 6: Crime Area Movement** — Ravi coordinates from **Markapur** (near the scene of interest).
6. **Jan 7: Co-location Event** — Ravi Kumar Reddy and Suresh Babu Naidu are detected active on the same **Chirala Town** tower between 14:55 and 15:30.
7. **Common Contact** — Both suspects call the same unidentified handler number `+91-9912000111`.

## Uploading to TRACE
1. Create a Case (e.g. "Prakasam Robbery Gang").
2. Click **Upload Records** for Suspect A: Use `COMPATIBLE_Prakasam_District_CDR_SuspectA_Ravi_Kumar_9441234567.csv` and `COMPATIBLE_Prakasam_District_IPDR_SuspectA_Ravi_Kumar_9441234567.csv`. Set name: **Ravi Kumar Reddy**.
3. Upload Suspect B: Use `COMPATIBLE_Prakasam_District_CDR_SuspectB_Suresh_Babu_9963456789.csv` and `COMPATIBLE_Prakasam_District_IPDR_SuspectB_Suresh_Babu_9963456789.csv`. Set name: **Suresh Babu Naidu**.
4. Upload Suspect C: Use `COMPATIBLE_Prakasam_District_CDR_SuspectC_Ramaiah_Yadav_9849000312.csv`. Set name: **Ramaiah Yadav**.
5. Trigger **Analyze** in the Case details. TRACE will automatically flag the IMEI Swapping, Co-Locations at Chirala, Common Handler Contact, and Anomaly scores!
"""

with open(os.path.join(OUT, "README.md"), "w", encoding="utf-8") as f:
    f.write(readme)
print("  Written: README.md")
print("\nDone! All demo data files created.")
