# TRACE
### Telecom Record Analysis for Criminal Examination

**Prakasham District Police · Andhra Pradesh, India**

*A criminal intelligence platform that turns raw telecom data (CDR/IPDR) into actionable investigative evidence.*

> [!IMPORTANT]
> ### 🌐 Live Application
> 👉 **Aromax - Click this link to try it yourself: [https://trace-prakasham.web.app](https://trace-prakasham.web.app)** 👈
>
> ⚡ **Online Mode:** The hosted application runs fully online, connecting to the secure TRACE API backend hosted on Google Cloud Run and communicating via Firebase Hosting.

<br />

<div align="center">

![Status](https://img.shields.io/badge/Status-Hackathon%20Ready-brightgreen?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20REST%20API-0066cc?style=for-the-badge)
![License](https://img.shields.io/badge/License-Law%20Enforcement%20Only-cc0000?style=for-the-badge)

<br />

[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React%2018-TypeScript-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20%2F%20PostgreSQL-003B57?style=flat-square&logo=sqlite)](https://www.sqlite.org/)

</div>

---

## What is TRACE?

TRACE is a **web-based criminal intelligence workbench** built for district Cyber Cell investigators. It takes raw **Call Detail Records (CDR)** and **Internet Protocol Detail Records (IPDR)** — exactly as received from telecom operators — and automatically extracts intelligence that would otherwise take days of manual work.

No templates. No formatting. No Excel macros. Just upload and analyze.

### What TRACE Does Automatically

| # | Capability | What the Investigator Sees |
|:--|:-----------|:--------------------------|
| 1 | **Zero-Config Data Ingestion** | Upload raw CSVs from BSNL, Jio, Airtel, or Vi — TRACE maps columns automatically |
| 2 | **IMEI Swap Detection** | Exact time, date, and cell tower where a suspect switched to a new handset |
| 3 | **Handset Burner Detection** | Tracks when the same IMEI/handset is used with multiple SIM cards ( burner tracking) |
| 4 | **Co-Location Detection** | Overlaps suspect cell tower logs to find meetings within a configurable time buffer |
| 5 | **Cross-Case Handler Matcher** | Performs global linkage analysis to find common coordinators/handlers across distinct cases |
| 6 | **Tower Switch-Off / Last-Seen** | Automatically flags radio-silence gaps (e.g. >6h) and records coordinates before switch-off |
| 7 | **Night-Call & Loop-Call Aggregation** | Detects repetitive loop coordination call pairs and high-ratio nocturnal bursts (23:00–05:00) |
| 8 | **Radial Search & Buffer Zones** | Maps crime scene lat/lon and returns all suspects present within a configurable radius |
| 9 | **Auto-Populated Sec 65B Certificate** | Pre-fills and generates Indian Evidence Act Sec 65B electronic record authenticity certificates |
| 10 | **Activity Audit Trail** | Pages recording officer actions, timestamps, and terminal IP coordinates for chain-of-custody |
| 11 | **Live CCTV Surveillance Grid** | RTSP-connected IP camera feeds with real-time AI suspect-match overlays and bounding boxes |
| 12 | **Geo-Intel Buffer Scan** | Crime-scene Haversine radius query to identify all suspects present near the incident location |

---

## 🚀 Key Upgrades & Professional Features (v1.1)

TRACE has been upgraded to a **production-grade enterprise structure** supporting real-world deployment while maintaining legal compliance under Indian evidence law.

### 1. Online Production Deployment (Firebase)
- **Firebase Hosting:** The web client is compiled for production and deployed on Firebase Hosting at **[https://trace-prakasham.web.app](https://trace-prakasham.web.app)**.
- **Online Architecture:** Removed all local mock database engines (`mockData.ts` and `mockRoutes.ts`), resulting in a **98% bundle size reduction**. All operations now communicate with the real backend.
- **VITE_API_URL Support:** The API client dynamically reads `import.meta.env.VITE_API_URL` to point to your hosted backend (e.g. on Cloud Run) or fallback to `http://localhost:8000` for seamless local developer testing.

### 2. Section 65B Attestation & Draft Worksheets
- **Draft Watermarking:** Implements a dynamic, state-aware diagonal watermark (`DRAFT - UNVERIFIED`, `PENDING REVIEW`, or `OFFICER REVIEWED`) across all generated PDFs.
- **Judicial Compliance:** Generates courtbrief Section 65B(4) draft worksheets with blank attested signing fields, official signature boxes for IO, Supervisor, and Court Submission Officers. No false statements are pre-signed.
- **Two-Step Audited Certification:** Marking a case "Reviewed" requires a two-step dialog with a **mandatory checkbox confirmation** before logging the action to the audit trail.
- **Demo Guardrails:** In `DEMO_MODE=true` (backend config), exporting worksheets is strictly blocked unless suspect labels follow the redacted `SUBJECT-NNN` pattern.

### 3. Chain-of-Custody Audit Trails
- **Tamper-Proof Activity Logs:** Secure database logging capturing the officer's credential ID, action type (e.g. `CERT_WORKSHEET_EXPORTED`), timestamp, details, and terminal IP coordinates.
- **Audit Registry Page:** Sleek settings page detailing connection health and serverless checks.

### 4. Interactive Fullscreen Network Graphs
- **Lab-Scale Visualization:** One-click fullscreen workspace for the React Flow network graph, keeping all detail panels, legends, search bars, and filter toggles fully z-indexed and responsive for control-room operations.

---

## Why TRACE is Different

| Area | Legacy Methods | TRACE |
|:-----|:---------------|:------|
| **Data Ingestion** | Fails if operator headers change even slightly | Auto-detects and maps native headers from all operators |
| **Device Evasion** | Spotted only by manually scanning thousands of rows | Automatically flags IMEI swaps and multi-SIM burner handsets |
| **Suspect Meetings** | Manual cross-referencing of timestamps in Excel | Geospatial engine detects co-locations and radial scene buffer hits |
| **Relationships** | Investigators mentally map who knows whom | Interactive network graph + global linkage cross-case matching |
| **Nocturnal/Urgent Calls** | Hard to isolate repeating call loops visually | Automatic aggregation of night bursts and rapid loop call alerts |
| **Evidence Compliance** | Manual screenshots pasted into Word documents | Official court-ready PDF with auto-filled Section 65B Certificates |
| **Activity Logging** | Excel files shared without logging modification trails | Tamper-proof, case-specific activity audit logs tracking officer IPs |
| **Deployment** | Expensive servers or cloud subscriptions | One command on any workstation — fully offline |
| **CCTV Surveillance** | Cameras monitored on separate standalone DVR systems | Unified CCTV grid with RTSP integration and live AI suspect-matching overlays |
| **Scene-Radius Search** | Manual tower-by-tower CDR filtering in spreadsheets | Automated Haversine buffer scan — enter coordinates, get suspects instantly |

---

## Platform Screenshots

### Secure Boot loader
> Safe system bootloader displaying initialization steps, table validations, and security configuration checks.

![Boot Screen](docs/assets/boot_screen.png)

---

### Secure Login Portal
> Investigators authenticate with a Credential ID and secure passphrase. All sessions are JWT-secured.

![Login Page](docs/assets/login_page.png)

---

### Case Management Dashboard
> Create and manage investigation cases. View suspect counts and active alerts per case at a glance.

![Cases Dashboard](docs/assets/cases_page.png)

---

### Case Detail View
> The main investigation workspace. Tabs for suspects, co-location events, shared contacts, and network graph.

![Case Detail](docs/assets/case_detail.png)

---

### Geospatial Cell Tower Map
> Every CDR record plotted on an interactive MapLibre map. Trace suspect movement and spot meetings visually. Supports standard vectors and Esri Satellite views.

![Map View](docs/assets/map_geospatial.png)

---

### Interactive Criminal Network Graph
> Force-directed graph of suspects and their contacts using ReactFlow. Red nodes represent high-risk handlers, and dashed nodes represent common contacts.

![Network Graph](docs/assets/network_graph.png)

---

### Fullscreen Network Graph Workspace
> Native HTML5 fullscreen mode for the network graph. Perfect for large-screen cyber labs, keeping all search, filter, legend, and detail controls fully interactive and z-indexed.

![Network Graph Fullscreen](docs/assets/network_graph_fullscreen.png)

---

### Suspect Deep-Dive Profile
> Comprehensive suspect profile: 7×24 hourly activity heatmap, IMEI swap alerts, OTT application usage session breakdown, and court-ready PDF download.

![Suspect Profile](docs/assets/suspect_profile.png)

---

### Court-Ready PDF Forensic Report (Unique Feature)
> Automatically generated multi-page, court-grade investigation briefs. Contains all ingested CDR/IPDR metrics, maps, timeline analyses, and an auto-populated Section 65B Certificate of authenticity under the Indian Evidence Act, 1872. Features professional, eye-catching signature cards with bounding boxes for the Investigating Officer, Supervisory Officer, and Court Submission Officer to ensure judicial compliance.

📂 **[Download & View Real Sample Forensic Report PDF](docs/sample_court_report.pdf)**

*Note: GitHub automatically provides a full-featured, interactive PDF preview viewer when you click the PDF link above!*

---

### API Documentation (Swagger UI)
> Every analytical capability and database transaction exposed as a documented REST endpoint.

![Swagger Docs](docs/assets/swagger_docs.png)

---

### 🎥 Live Surveillance Grid — CCTV Plugin Dashboard
> A dedicated RTSP Stream Integration & AI Video Analytics module. Connects to physical CCTV cameras deployed across Prakasham District via DVR/NVR IP addresses. Each feed displays live video with AI-powered bounding box overlays that automatically detect and match suspects from the active case roster in real time.

![CCTV Plugin Dashboard](docs/assets/cctv_plugin_dashboard.png)

**Key CCTV Features:**
- **AI Detect Active** — Real-time vehicle and person detection with confidence scores (e.g., `MATCH: Kalyan C. (91%)`)
- **Multi-Camera Grid** — Side-by-side 1080p 30fps live feeds from multiple city cameras simultaneously
- **Geo-Tagged Feeds** — Each camera card shows exact GPS coordinates and last-ping latency
- **RTSP Stream Connector** — One-click `+ CONNECT STREAM` button to pair any IP camera, DVR, or NVR into the grid
- **Sync Status** — Live `SYNCHRONIZED` badge confirms the camera feed is actively tied to the case database
- **Camera Registry** — Cameras include: Ongole Main Market Junction (`CAM-ONG-MKT-01`), Chirala NH-16 Toll Plaza (`CAM-CDD-NH16-01`), Ongole APSRTC Bus Stand (`CAM-ONG-BUS-01`)

---

### 🗺️ Geo-Intel — Radial Search & Tower Buffer Zones
> Crime-scene radius analysis engine. Enter coordinates and a radius in kilometres; TRACE performs a Haversine-formula buffer query to surface all suspects whose CDR tower pings fall within the defined zone — filterable by time window.

![Geo-Intel Radial Search](docs/assets/geo_intel_page.png)

**Key Geo-Intel Features:**
- **Crime Scene Buffer Scan** — Input lat/lon and radius (km) to return suspects present at the scene
- **Case-Scoped Query** — Scope the search to a specific case (e.g., FIR 124/2026 Tobacco Syndicate)
- **Time-Window Filtering** — Optionally narrow results to a specific date/time range
- **Haversine Engine** — Accurate great-circle distance calculation for Indian geographic coordinates
- **Execute Buffer Scan** — One-click scan integrates with the full suspect CDR database

---

## System Architecture

```mermaid
graph TD
    A["Raw CSV Files\n(CDR / IPDR from any operator)"] --> B["Zero-Config Data Mapper\nAuto-detects headers & normalizes columns"]
    B --> C[("Case Database\nSQLite / PostgreSQL")]
    C --> D["TRACE Analytics Engine"]

    subgraph D ["TRACE Analytics Suite"]
        D1["1. IMEI Swap Detector"]
        D2["2. Handset Burner Tracker"]
        D3["3. Co-Location Engine"]
        D4["4. Network Graph Builder"]
        D5["5. Cross-Case Linkage"]
        D6["6. Tower Silence Analysis"]
        D7["7. Night / Loop Burst Engine"]
        D8["8. Radial Search Buffer Engine"]
        D9["9. AI Anomaly Scorer"]
        D10["10. OTT App Fingerprinting"]
        D11["11. Activity Audit Logger"]
    end

    D --> E["React Frontend\nInteractive Web UI"]
    D --> F["PDF Report Generator\nChain of Custody"]

    E --> E1["Geospatial Map (MapLibre/DeckGL)"]
    E --> E2["Network Graph (React Flow)"]
    E --> E3["Radial Search & Audit Views"]

    F --> F1["Court Brief PDF (ReportLab)"]
    F --> F2["Section 65B Compliance Certificate"]
    F --> F3["SHA-256 Evidence Hash"]
```

---

## How the Analytics Works

### 1. IMEI Swap & Burner Handset Detection

Every CDR row has a phone number (MSISDN) and a handset ID (IMEI). 
* **IMEI Swap:** TRACE sorts records by time per MSISDN and flags any row where the IMEI changes, capturing when and where device evasion took place.
* **Burner Handset:** The system scans all records globally and flags when a single IMEI appears with multiple distinct phone numbers — a key signature of burner/shared handsets.

---

### 2. Co-Location & Radial Buffer Searching

* **Co-Location:** TRACE compares suspect CDRs to identify when multiple suspects were registered at the same cell tower within a tight time window (e.g. 30 minutes), flagging physical meetings.
* **Radial Buffer Search:** Investigators can input a crime scene's coordinate (lat/lon) and a radius (in km), and the system uses the Haversine formula to return all suspects registered within that buffer zone.

---

### 3. Loop-Call & Night Burst Aggregation

TRACE aggregates call frequencies to flag network coordination:
* **Night-Call Burst:** Flags suspects making 5+ calls between 23:00 and 05:00 on a single day.
* **Loop-Call:** Flags rapid call cycles where the same A→B pair calls each other 3+ times within 30 minutes (urgent communication patterns).

---

### 4. Cross-Case Global Handler Matching

Compares contacts globally across *all* active cases in the database. If a non-suspect contact number appears in the logs of suspects in two or more distinct cases, it is flagged as a high-risk global coordinator/handler.

---

### 5. Tower Switch-Off & Silence Tracking

Flags when a suspect's phone goes completely dark (no CDR pings) for a period exceeding 6 hours. It isolates the exact time and cell tower coordinates of the last ping before switch-off and the first ping when re-established.

---

### 6. Explainable AI Anomaly Scoring

Each suspect receives a 0–100 risk score based on weighted behavioural signals:

| Signal | Metric Checked |
|:-------|:----------------|
| Night Calls Ratio | Percentage of nocturnal communication |
| Tower Silence Gaps | Number of switch-off windows |
| IMEI Swap Count | Handset evasion cycles |
| Co-Locations | Physical meetings with other suspects |
| OTT App Usage | Volume spikes on encrypted services |

**Risk Bands:**

| Score | Level | Recommended Action |
|:------|:------|:-------------------|
| 0 – 30 | Low | Routine monitoring |
| 31 – 60 | Medium | Elevated investigation |
| 61 – 80 | High | Priority surveillance |
| 81 – 100 | Critical | Immediate escalation |

---

## Technology Stack

### Backend
| Technology | Role |
|:-----------|:-----|
| **FastAPI** (Python 3.11) | REST API framework |
| **SQLAlchemy** + SQLite / PostgreSQL | Database ORM and storage |
| **pandas** | CSV ingestion and column mapping |
| **NetworkX** | Suspect graph construction |
| **scikit-learn** (IsolationForest) | AI anomaly scoring |
| **ReportLab** | Court-ready PDF generation |
| **JWT** | Investigator authentication |

### Frontend
| Technology | Role |
|:-----------|:-----|
| **React 18** + TypeScript | Web application framework |
| **Vite** | Fast build and dev server |
| **Tailwind CSS** | UI styling |
| **MapLibre GL** + **DeckGL** | High-performance interactive geospatial maps |
| **React Flow** | Suspect network graph |
| **Recharts** | Heatmaps and call charts |

### Infrastructure
| Technology | Role |
|:-----------|:-----|
| **Docker Compose** | One-command deployment |
| **Uvicorn** | ASGI server for FastAPI |
| **Swagger UI** | Auto-generated API docs |
---

## Deployment & Firebase Architecture

### Firebase Hosting
The frontend is compiled for production and deployed to Firebase Hosting:
* **Production URL:** [https://trace-prakasham.web.app](https://trace-prakasham.web.app)
* **Configuration:** Configured as a Single Page Application (SPA) routing all paths to `/index.html` via `firebase.json` settings.

### Backend Routing (Cloud Run)
The application operates entirely online:
* **API Requests:** All API calls are directed to the relative path `/api`.
* **Routing:** Firebase Hosting rewrites route all `/api/**` traffic to the backend server deployed on GCP Cloud Run.

---

## Quick Start

### Option A — Docker (Recommended)

```bash
git clone https://github.com/hydra-eng/trace.git
cd trace
docker-compose up --build
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option B — Manual Setup

**Backend:**
```bash
cd trace-backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd trace-frontend
npm install
npm run dev
```

**Default Login Credentials:**
```
Credential ID : investigator
Access Passphrase : PrakasamPolice_2026!
```

---

## Demo Walkthrough & Seed Scenarios (5 Minutes)

We provide preloaded case records based in **Prakasham District, Andhra Pradesh** and the **AP/Telangana corridor**.

### Case 1: Ongole Tobacco Smuggling Syndicate (FIR 124/2026)
* **Narrative:** Smuggling group operating across Ongole, Chirala, Markapur, and Kandukur.
* **Suspect Files (located in `demo-data/`):**
  * Kalyan Chakravarthy (Kingpin): `Case1_Ongole_Tobacco_Smuggling_CDR_Kalyan_Chakravarthy.csv` and `Case1_Ongole_Tobacco_Smuggling_IPDR_Kalyan_Chakravarthy.csv`
  * Venkatesh Prasad (Coordinator): `Case1_Ongole_Tobacco_Smuggling_CDR_Venkatesh_Prasad.csv` and `Case1_Ongole_Tobacco_Smuggling_IPDR_Venkatesh_Prasad.csv`
  * Subba Rao (Local dealer): `Case1_Ongole_Tobacco_Smuggling_CDR_Subba_Rao.csv`
  * Ananthakrishna (Associate): `Case1_Ongole_Tobacco_Smuggling_CDR_Ananthakrishna.csv`
  * Anjali Devi (Control subject): `Case1_Ongole_Tobacco_Smuggling_CDR_Anjali_Devi.csv`

### Step-by-Step Walkthrough

```mermaid
flowchart LR
    A[Login] --> B[Create Case]
    B --> C[Upload CDR + IPDR]
    B --> D[Use Preloaded Seed Case]
    C & D --> E[Run Analysis]
    E --> F[Explore Network / Maps]
    F --> G[Download Court Brief]
```

1. **Login:** Enter `investigator` and `PrakasamPolice_2026!` at the secure gateway.
2. **Select Case:** Select the seeded `Operation Sandstorm TEST` case or click **New Case** to create one.
3. **Upload Records:** Click **Upload Records** and upload the CDR and IPDR CSV files from `demo-data/` for Kalyan Chakravarthy and his associates.
4. **Run Analysis:** Click **Run Analysis**. TRACE normalizes and parses the CSV data in seconds.
5. **Inspect Findings:**
   - **Network Graph** -> Open **Network Graph** and toggle **Fullscreen**. Observe the red Node `919888000111` (common handler Venkata Ramana) connecting the suspects.
   - **Suspect Profile** -> Click Kalyan Chakravarthy. Observe the IMEI swap flagged on June 3rd, the co-location at Chirala Prakasham tower (`TWR-CDD-001`) with Subba Rao and Venkatesh, and WhatsApp/Telegram usage sessions parsed from IPDR.
6. **Download Report:** Click **Download Report** to export the court-ready PDF containing the SHA-256 hash validation header.

---

## API Reference

Full docs available at [http://localhost:8000/docs](http://localhost:8000/docs)

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/cases` | List all cases |
| `POST` | `/cases` | Create a new case |
| `POST` | `/upload/cdr` | Ingest CDR records |
| `POST` | `/upload/ipdr` | Ingest IPDR records |
| `POST` | `/analysis/run/{case_id}` | Execute 5-layer analysis |
| `GET` | `/suspects/{suspect_id}/profile` | Retrieve suspect profile, heatmap, and movement |
| `GET` | `/cases/{case_id}/network` | Retrieve ReactFlow graph structure |
| `GET` | `/report/pdf/{suspect_id}` | Export Section 65B IE Act PDF Brief |
| `GET` | `/cctv/timeline/{case_id}` | Retrieve CCTV event timeline for a case |
| `GET` | `/cctv/detections/{suspect_id}` | Get AI detection events linked to a suspect |
| `POST` | `/geo/buffer-scan` | Execute Haversine radial search around crime scene coordinates |

---

## Security & Compliance

> **RESTRICTED — FOR AUTHORIZED LAW ENFORCEMENT USE ONLY**

- PDF reports include a **SHA-256 hash** of uploaded source files — establishes Chain of Custody compliant with **Section 65B of the Indian Evidence Act**
- All sessions secured via **JWT tokens** with configurable expiry
- TRACE runs **fully offline** — no data leaves the investigator's workstation
- All upload and analysis operations are logged with timestamps
