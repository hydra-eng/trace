# TRACE
### Telecom Record Analysis for Criminal Examination

**Prakasham District Police · Andhra Pradesh, India**

*A criminal intelligence platform that turns raw telecom data (CDR/IPDR) into actionable investigative evidence.*

> [!IMPORTANT]
> ### 🌐 Live Interactive Demo
> 👉 **Aromax - Click this link to try it yourself: [https://trace-prakasham.web.app](https://trace-prakasham.web.app)** 👈
>
> ⚡ **Zero-Config Evaluation:** The hosted application runs in a fully interactive, local-first **Demo Mode** preloaded with realistic investigative seed data representing crime scenarios in Prakasham District, Andhra Pradesh. Try creating cases, exploring graphs, and clicking suspects without any setup!

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
| 1 | **Zero-Config Data Ingestion** | Upload raw CSVs from BSNL, Jio, Airtel, or Vi — TRACE maps the columns automatically |
| 2 | **IMEI Swap Detection** | Exact time, date, and cell tower where a suspect switched to a new handset |
| 3 | **Co-Location Detection** | When two or more suspects were at the same cell tower within a configurable time window |
| 4 | **Criminal Network Graph** | Visual map of who called whom — suspects, handlers, and shared contacts |
| 5 | **OTT App Fingerprinting** | WhatsApp, Telegram, and Signal usage detected from IPDR data patterns |
| 6 | **AI Anomaly Scoring** | A 0–100 risk score per suspect with a point-by-point breakdown |
| 7 | **Court-Ready PDF Reports** | Tamper-proof PDF with SHA-256 file hash — Section 65B IE Act compliant |

---

## Why TRACE is Different

| Area | Legacy Methods | TRACE |
|:-----|:---------------|:------|
| **Data Ingestion** | Fails if operator headers change even slightly | Auto-detects and maps native headers from all operators |
| **Device Evasion** | Spotted only by manually scanning thousands of rows | Automatically flags IMEI swaps with timestamp and tower |
| **Suspect Meetings** | Manual cross-referencing of timestamps in Excel | Geospatial engine detects co-location within minutes |
| **Relationships** | Investigators mentally map who knows whom | Interactive network graph built from actual call data |
| **Encrypted Apps** | Completely invisible to investigators | Detected via IPDR session patterns (size, timing, endpoints) |
| **AI Scoring** | Static risk categories with no explanation | Explainable score: each point justified with call evidence |
| **Evidence** | Manual screenshots pasted into Word documents | PDF with embedded SHA-256 hash for Chain of Custody |
| **Deployment** | Expensive servers or cloud subscriptions | One command on any workstation — fully offline |

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

### API Documentation (Swagger UI)
> Every analytical capability and database transaction exposed as a documented REST endpoint.

![Swagger Docs](docs/assets/swagger_docs.png)

---

## System Architecture

```mermaid
graph TD
    A["Raw CSV Files\n(CDR / IPDR from any operator)"] --> B["Zero-Config Data Mapper\nAuto-detects headers & normalizes columns"]
    B --> C[("Case Database\nSQLite / PostgreSQL")]
    C --> D["TRACE Analytics Engine"]

    subgraph D ["5-Layer Analytics Engine"]
        D1["1. IMEI Swap Detector"]
        D2["2. Co-Location Engine"]
        D3["3. Network Graph Builder"]
        D4["4. AI Anomaly Scorer"]
        D5["5. OTT Fingerprinting"]
    end

    D --> E["React Frontend\nInteractive Web UI"]
    D --> F["PDF Report Generator\nChain of Custody"]

    E --> E1["Cell Tower Map (MapLibre/DeckGL)"]
    E --> E2["Network Graph (React Flow)"]
    E --> E3["7×24 Call Heatmap"]

    F --> F1["Court Brief PDF (ReportLab)"]
    F --> F2["SHA-256 Evidence Hash"]
```

---

## How the Analytics Works

### 1. IMEI Swap Detection

Every CDR row has a phone number (MSISDN) and a handset ID (IMEI). TRACE sorts all records by time and flags any row where the IMEI changes — capturing exactly when and where the suspect switched devices.

```
CDR Row 1: MSISDN 9912345678 | IMEI: 354812XXXXXX | Tower: Chirala North | 01-Jun 10:32
CDR Row 2: MSISDN 9912345678 | IMEI: 490512XXXXXX | Tower: Chirala North | 03-Jun 14:07
                                       ↑ DIFFERENT — IMEI SWAP FLAGGED ↑
```

---

### 2. Co-Location Detection

TRACE compares the call records of all suspects in a case. When two or more suspects connect to the same cell tower within a configurable time window (default: 30 minutes), a meeting event is recorded.

```
Suspect A → Tower: Chirala_Town_BTS01 → 02-Jun 15:00
Suspect B → Tower: Chirala_Town_BTS01 → 02-Jun 15:15
                    Same tower, 15 minutes apart → MEETING DETECTED
```

---

### 3. AI Anomaly Scoring

Each suspect receives a 0–100 risk score based on five behavioural signals:

| Signal | What it Detects |
|:-------|:----------------|
| Night Calls (23:00–05:00) | Unusual communication hours |
| Silence Gaps (>24 hrs) | Deliberate blackout periods |
| IMEI Swap Count | Device evasion attempts |
| Co-Location Events | Physical meetings with other suspects |
| OTT App Volume Spikes | Encrypted communication bursts |

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

## Deployment & Demo Mode

### Firebase Hosting
The frontend is compiled for production and deployed to Firebase Hosting:
* **Production URL:** [https://trace-prakasham.web.app](https://trace-prakasham.web.app)
* **Configuration:** Configured as a Single Page Application (SPA) routing all paths to `/index.html` via `firebase.json` settings.

### In-Browser Demo Mode Fallback
To enable instant testing without requiring a running Python FastAPI backend on your machine, the application features an automatic serverless fallback:
1. **Auto-Detection:** The API client probes `http://127.0.0.1:8000/health`. If it fails to connect, it gracefully flags the session to run in **offline/local mock mode**.
2. **Snapshot Ingestion:** All cases, maps, phone relationships, IMEI changes, and call heatmaps are populated from a static SQLite snapshot stored in [mockData.ts](file:///c:/Users/Acer/Downloads/prakasam%20police/trace-frontend/src/lib/mockData.ts).
3. **Simulated State:** You can create cases, upload records, and delete suspects in-memory. The application updates state dynamically in your browser session.
4. **Mock PDF Reports:** Pressing the report download button generates a mock PDF preview entirely within the browser via a base64 document stream.

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

---

## Security & Compliance

> **RESTRICTED — FOR AUTHORIZED LAW ENFORCEMENT USE ONLY**

- PDF reports include a **SHA-256 hash** of uploaded source files — establishes Chain of Custody compliant with **Section 65B of the Indian Evidence Act**
- All sessions secured via **JWT tokens** with configurable expiry
- TRACE runs **fully offline** — no data leaves the investigator's workstation
- All upload and analysis operations are logged with timestamps
