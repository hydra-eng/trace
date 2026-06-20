<div align="center">

<img src="https://img.shields.io/badge/STATUS-HACKATHON%20READY-brightgreen?style=for-the-badge&logo=statuspal" />
<img src="https://img.shields.io/badge/PLATFORM-WEB%20%7C%20REST%20API-blue?style=for-the-badge&logo=fastapi" />
<img src="https://img.shields.io/badge/LICENSE-RESTRICTED%20%7C%20LAW%20ENFORCEMENT%20ONLY-red?style=for-the-badge" />

<br /><br />

<img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="Emblem of India" width="90" style="background:#fff; border-radius:50%; padding:8px;" />

<br />

# 🕵️ TRACE
### **T**elecom **R**ecord **A**nalysis for **C**riminal **E**xamination

**Prakasham District Police · Andhra Pradesh**
*A Next-Generation Criminal Intelligence Platform for Cyber Cell Investigators*

---

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%2B%20Python%203.11-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20%7C%20PostgreSQL-003B57?style=flat-square&logo=sqlite)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)

</div>

---

## 📌 Table of Contents

1. [What is TRACE?](#-what-is-trace)
2. [Why TRACE is Different](#-why-trace-is-different--the-competitive-edge)
3. [Platform Gallery](#-platform-gallery)
4. [System Architecture](#️-system-architecture--data-flow)
5. [Analytics Engine Deep-Dive](#-analytics-engine-deep-dive)
6. [Technology Stack](#️-technology-stack)
7. [Quick Start](#-quick-start)
8. [Hackathon Walkthrough](#-guided-hackathon-walkthrough)
9. [API Reference](#-api-reference)
10. [Project Structure](#-project-structure)
11. [Roadmap](#-roadmap)

---

## 🔍 What is TRACE?

> **TRACE** is an **open-source criminal intelligence workbench** built for district-level Cyber Cell investigators. It processes raw **Call Detail Records (CDR)** and **Internet Protocol Detail Records (IPDR)** directly from telecom operators — in their native, unmodified format — and automatically surfaces:

- 📡 **Device Evasion Events** — Suspects swapping SIM cards into new handsets (IMEI Swapping)
- 📍 **Co-Location Meetings** — When two suspects are at the same cell tower sector within a configurable time window
- 🕸️ **Criminal Network Maps** — Interactive suspect-to-handler relationship graphs
- 🔐 **OTT App Fingerprinting** — Detecting WhatsApp, Telegram, Signal usage from IPDR data patterns
- 🤖 **AI Anomaly Scoring** — Isolation Forest ML model scoring suspicious behavioural patterns
- 📄 **Court-Ready PDF Briefs** — Section 65B Indian Evidence Act-compatible reports with SHA-256 Chain of Custody

**TRACE is not another Excel macro or closed-source blackbox.** It is a real-time, investigator-grade web platform built from the ground up for the realities of district policing in India.

---

## 🏆 Why TRACE is Different — The Competitive Edge

### Feature-by-Feature Comparison

| 🔍 Feature Area | ❌ Legacy Methods | ✅ TRACE Advantage |
|:---|:---|:---|
| **Data Ingestion** | Requires pre-formatted templates. Fails on minor header changes from operators | **Zero-Config Operator Mapping** — auto-detects and maps native raw CDR/IPDR headers from BSNL, Jio, Airtel & Vi |
| **IMEI / Device Tracking** | Manually cross-referencing thousands of rows in Excel | **Automatic IMEI Swap Detection** — flags exact timestamp, cell tower & handset where suspect changed device |
| **Co-Location Analysis** | Manual Excel timestamp matching — error-prone and slow | **Geospatial Convergence Engine** — auto-detects when suspects meet at the same tower sector within configurable time windows |
| **Suspect Network** | No visual network; investigators must mentally map relationships | **Live Interactive Network Graph** — React Flow powered, showing suspects, handlers, and communication clusters |
| **AI / Anomaly Detection** | Static rules or blackbox ratings with no explainability | **IsolationForest Behavioural Scorer** — point-by-point breakdown: night calls, OTT bursts, silence gaps, co-location events |
| **OTT / Encrypted Apps** | Invisible — no visibility into WhatsApp/Telegram usage | **IPDR OTT Fingerprinting** — detects app signatures from data session size, timing & endpoint patterns |
| **Geo-Visualization** | No maps; latitude/longitude stays as raw numbers | **Leaflet.js Cell-Tower Map** — interactive pin map of every call's tower location with suspect trails |
| **Evidence Reports** | Manual screenshots and Word documents — inadmissible without certification | **High-Fidelity PDF Briefs** — SHA-256 source-file hash, dynamic case header, Section 65B IE Act compliant |
| **Operator Support** | Vendor-locked to specific format | **Multi-Operator Native Format** — BSNL, Jio, Airtel, Vodafone-Idea templates auto-detected |
| **Deployment** | Expensive server procurement | **Docker Compose One-Command Deploy** — runs on a standard workstation, no cloud required |

### What Makes TRACE Unique at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRACE UNIQUE CAPABILITIES                    │
├─────────────────────────────┬───────────────────────────────────┤
│ Zero-Config Data Ingestion  │ No template prep. Native headers. │
│ IMEI Swap Auto-Detection    │ Device evasion flagged instantly   │
│ Co-Location Engine          │ Meeting detection with GPS sector  │
│ OTT Fingerprinting          │ Encrypted app usage from IPDR      │
│ Explainable AI Scoring      │ Point-by-point anomaly breakdown   │
│ SHA-256 Chain of Custody    │ Court-admissible evidence hashes   │
│ Multi-Operator Support      │ BSNL, Jio, Airtel, Vi — all native │
│ Open Source & Offline       │ No vendor lock-in, runs offline    │
└─────────────────────────────┴───────────────────────────────────┘
```

---

## 📸 Platform Gallery

### 🔒 1. Secure Boot & Authentication

> The platform initializes with a secure bootloader sequence, verifying investigator credentials before establishing an encrypted session.

<table>
<tr>
<td><img src="docs/assets/boot_screen.png" alt="TRACE Secure Boot Screen" width="400"/></td>
<td><img src="docs/assets/login_page.png" alt="TRACE Login Page" width="400"/></td>
</tr>
<tr>
<td align="center"><em>⬅️ TRACE Bootloader Screen</em></td>
<td align="center"><em>Investigator Login Portal ➡️</em></td>
</tr>
</table>

---

### 🗂️ 2. Criminal Intelligence Dashboard

> Centralized case management hub. Create, monitor, and delete investigation case files. View live suspect counts, audit records, and alert summaries at a glance.

![Cases Dashboard](docs/assets/cases_page.png)

---

### 🔬 3. Case Detail & Investigation Hub

> Deep-dive into a specific case. View suspect relationships, behavioral timelines, and co-location events from a single unified interface.

![Case Detail View](docs/assets/case_detail.png)

---

### 🗺️ 4. Geospatial Cell Tower Mapping

> Every CDR record is plotted on an interactive Leaflet.js map. Investigators can visually trace suspect movement, identify home towers, and spot co-location convergence points.

![Geospatial Map](docs/assets/map_geospatial.png)

---

### 🕸️ 5. Interactive Criminal Network Graph

> A React Flow powered, force-directed network graph shows relationships between suspects, their handlers, and shared contacts. Red nodes = high-risk coordinators. Thickness of edges = call frequency.

![Network Graph](docs/assets/network_graph.png)

---

### 👤 6. Suspect Deep-Dive Profile

> Full analytical profile for every suspect: 7×24 hourly call heatmaps, IMEI swap alerts, OTT usage logs, co-location events, and a one-click court-ready PDF download.

![Suspect Profile](docs/assets/suspect_profile.png)

---

### 📖 7. REST API — Live Documentation (Swagger UI)

> Every feature is API-first and fully documented. Field investigators and integrations can automate workflows via the RESTful API.

![Swagger API Documentation](docs/assets/swagger_docs.png)

---

## ⚙️ System Architecture & Data Flow

```mermaid
graph TD
    A["📂 Raw CSV Uploads<br/>(Native Operator Format)"] -->|CDR / IPDR| B

    subgraph B ["🔄 Zero-Config Data Mapper"]
        B1[Header Auto-Detection]
        B2[Operator Template Matching]
        B3[Column Normalization]
        B1 --> B2 --> B3
    end

    B --> C[(🗄️ SQLite / PostgreSQL<br/>Case Database)]

    C --> D

    subgraph D ["🧠 TRACE 5-Layer Analytics Engine"]
        D1["📱 IMEI Swap Detector<br/>(Device Evasion)"]
        D2["📍 Geospatial Convergence<br/>(Co-Location Engine)"]
        D3["🕸️ Shared Contacts Handler<br/>(Network Builder)"]
        D4["🤖 IsolationForest Classifier<br/>(Behavioural Anomalies)"]
        D5["🔐 OTT Fingerprinting<br/>(IPDR Parser)"]
    end

    D --> E["🌐 Interactive Visualization<br/>(React Frontend)"]
    D --> F["📄 Chain of Custody Report<br/>(PDF Generator)"]

    E --> E1["🗺️ Cell-Tower Map<br/>(Leaflet.js)"]
    E --> E2["🕸️ Suspect Network Graph<br/>(React Flow)"]
    E --> E3["🔥 7×24 Call Heatmap<br/>(Hourly Grid)"]

    F --> F1["📋 Court Summons Brief<br/>(ReportLab PDF)"]
    F --> F2["🔑 SHA-256 Evidence Hash<br/>(65B IE Act Compliant)"]

    style D fill:#1a1a2e,color:#e0e0e0,stroke:#6c63ff
    style B fill:#0f3460,color:#e0e0e0,stroke:#e94560
    style F fill:#16213e,color:#e0e0e0,stroke:#0f3460
```

---

## 🧠 Analytics Engine Deep-Dive

### Layer 1 — IMEI Swap Detection

```mermaid
sequenceDiagram
    participant CSV as Raw CDR File
    participant Mapper as Data Mapper
    participant Engine as IMEI Engine
    participant Alert as Alert Generator

    CSV->>Mapper: Upload native operator CSV
    Mapper->>Engine: Normalized records with MSISDN + IMEI + Timestamp
    Engine->>Engine: Group by MSISDN, sort by time
    Engine->>Engine: Detect IMEI change events
    Engine->>Alert: Emit swap event (old IMEI → new IMEI, tower, time)
    Alert->>Alert: Store in suspect profile
```

> **How it works:** Every CDR row has an MSISDN (phone number) and IMEI (handset ID). The engine sorts all records chronologically and flags any row where the IMEI changes — capturing the exact time and cell tower where the swap occurred.

---

### Layer 2 — Co-Location / Geospatial Convergence

```mermaid
flowchart LR
    A["Suspect A CDRs<br/>with Tower + Timestamp"] --> C{Co-Location Engine}
    B["Suspect B CDRs<br/>with Tower + Timestamp"] --> C
    C -->|Same tower, within T minutes| D["⚠️ Meeting Event Detected"]
    C -->|No overlap| E["No Co-Location"]
    D --> F["Add to Case Timeline<br/>+ Alert Investigator"]
```

> **Time window is configurable.** Default is 30 minutes at the same BTS/sector. Results include the tower ID, GPS coordinates, and all suspects present at the convergence point.

---

### Layer 3 — OTT Fingerprinting (IPDR Analysis)

| App | Detection Method |
|:---|:---|
| **WhatsApp** | Data session to Meta/Facebook AS, session size 2–20KB bursts (message), continuous stream (call) |
| **Telegram** | Sessions to Telegram MTProto IPs, distinctive port patterns |
| **Signal** | Sessions to Signal Foundation IP ranges |
| **Generic Encrypted** | TLS sessions with no SNI + non-standard ports |

---

### Layer 4 — Behavioural Anomaly Scoring

```mermaid
graph LR
    F1["🌙 Night Calls<br/>23:00–05:00"] --> Score
    F2["🔇 Silence Gaps<br/>> 24hr blackout"] --> Score
    F3["📱 IMEI Swap<br/>Event Count"] --> Score
    F4["📍 Co-Location<br/>Events"] --> Score
    F5["🔐 OTT Volume<br/>Spikes"] --> Score
    Score["IsolationForest<br/>Anomaly Scorer"] --> Output["Risk Score + Breakdown"]
    Output --> Report["Court-Ready PDF"]
```

**Score Bands:**

| Score Range | Risk Level | Action |
|:---|:---|:---|
| 0–30 | 🟢 Low | Routine monitoring |
| 31–60 | 🟡 Medium | Elevated investigation |
| 61–80 | 🟠 High | Priority surveillance |
| 81–100 | 🔴 Critical | Immediate escalation |

---

## 🛠️ Technology Stack

### Backend
| Component | Technology | Purpose |
|:---|:---|:---|
| API Framework | **FastAPI** (Python 3.11) | High-performance async REST API |
| ORM / DB | **SQLAlchemy** + **SQLite** / **PostgreSQL** | Relational case storage |
| Data Wrangling | **pandas** | CSV ingestion, column mapping, analysis |
| Graph Analysis | **NetworkX** | Suspect relationship graph construction |
| ML / AI | **scikit-learn** (IsolationForest) | Anomaly scoring & outlier detection |
| PDF Engine | **ReportLab** | Court-ready report generation |
| Auth | JWT Tokens | Secure investigator session management |

### Frontend
| Component | Technology | Purpose |
|:---|:---|:---|
| Framework | **React 18** + **TypeScript** | Type-safe component architecture |
| Build Tool | **Vite** | Lightning-fast HMR development |
| UI Styling | **Tailwind CSS** | Utility-first dark theme design |
| Maps | **React-Leaflet** (Leaflet.js) | Interactive cell tower mapping |
| Network Graph | **React Flow** | Force-directed suspect network visualization |
| Charts | **Recharts** | 7×24 heatmaps, call frequency charts |

### Infrastructure
| Component | Technology |
|:---|:---|
| Containerization | **Docker** + **Docker Compose** |
| Development Server | **Uvicorn** (ASGI) |
| API Documentation | **Swagger UI** + **ReDoc** (auto-generated) |

---

## 🚀 Quick Start

### ⚡ Option A: Docker (Recommended — Single Command)

Ensure **Docker Desktop** is running, then:

```bash
# 1. Clone the repository
git clone https://github.com/hydra-eng/trace.git
cd trace

# 2. Launch everything
docker-compose up --build

# 3. Open in browser
#    Frontend Portal:  http://localhost:5173
#    API + Swagger UI: http://localhost:8000/docs
```

---

### 🔧 Option B: Manual Developer Setup

#### Step 1 — Backend

```bash
cd trace-backend

# Create a virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate    # Linux/Mac
.venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt

# Start the API server
python -m uvicorn main:app --reload --port 8000
```

> API Docs available at: [http://localhost:8000/docs](http://localhost:8000/docs)

#### Step 2 — Frontend

```bash
cd trace-frontend

# Install Node dependencies
npm install

# Start development server
npm run dev
```

> Frontend available at: [http://localhost:5173](http://localhost:5173)

#### Step 3 — First Login

```
Credential ID  : investigator
Passphrase     : PrakasamPolice_2026!
```

---

## 🎯 Guided Hackathon Walkthrough

*Complete showcase in under 5 minutes for judges.*

```mermaid
flowchart TD
    A["🔐 Step 1: Secure Login<br/>investigator / PrakasamPolice_2026!"] --> B
    B["📁 Step 2: Create New Case<br/>'Prakasam Gang Robbery Case'"] --> C
    C["📤 Step 3: Upload Operator CSVs<br/>CDR + IPDR for 3 suspects"] --> D
    D["⚡ Step 4: Run Analysis<br/>Click 'Run Analysis' button"] --> E
    E["🔍 Step 5: Explore Intelligence"] --> F
    F["📄 Step 6: Download Court PDF<br/>SHA-256 signed brief"]

    E --> E1["🕸️ Network Graph → Red node<br/>shared handler +91-9912000111"]
    E --> E2["📱 Suspect A → IMEI Swap<br/>Jan 3 — new handset detected"]
    E --> E3["📍 Co-Location → A+B met<br/>Chirala Town tower, Jan 7"]
    E --> E4["🔐 OTT → WhatsApp + Telegram<br/>heavy usage Jan 5-9"]

    style A fill:#1a1a2e,color:#fff
    style F fill:#16213e,color:#fff
```

### Step-by-Step Guide

**1. Authenticate**
Log in with Credential ID `investigator` and passphrase `PrakasamPolice_2026!`.

**2. Create a Case**
Click **New Case** → Enter `"Prakasam Gang Robbery Case"` → Save.

**3. Upload Demo Data**
Navigate to **Upload Records** and upload the sample CSVs from the `demo-data/` folder:

| Suspect | Name | CDR File | IPDR File |
|:---|:---|:---|:---|
| Suspect A | Ravi Kumar | `...CDR_SuspectA.csv` | `...IPDR_SuspectA.csv` |
| Suspect B | Suresh Babu | `...CDR_SuspectB.csv` | `...IPDR_SuspectB.csv` |
| Suspect C | Ramaiah Yadav | `...CDR_SuspectC.csv` | *(not available)* |

**4. Run Analysis**
Click **Run Analysis** — TRACE processes all records and builds full suspect profiles within seconds.

**5. Explore Intelligence**

- **Network Tab** → Point out the red node `+91-9912000111` — *"This shared handler number appeared in the call logs of all three suspects, establishing coordination."*
- **Shared Contacts Panel** → Show the list of shared handler numbers under the Suspects tab.
- **Suspect A Profile** → Demonstrate:
  - 🔄 **IMEI Swap alert** — SIM swapped to a new handset on Jan 3
  - 📍 **Co-Location** — Suspects A & B met at the Chirala Town tower on Jan 7
  - 🔐 **OTT Usage** — Heavy WhatsApp and Telegram data signatures detected

**6. Court-Ready Report**
Click **Download Brief** → Receive a tamper-proof PDF featuring dynamic case number headers, anomaly breakdowns, and the SHA-256 source-file hash block.

---

## 📡 API Reference

All endpoints are available and documented via Swagger UI at `/docs`.

### Core Endpoints

| Method | Endpoint | Description |
|:---|:---|:---|
| `POST` | `/auth/login` | Authenticate investigator → receive JWT |
| `GET` | `/cases/` | List all investigation cases |
| `POST` | `/cases/` | Create a new case |
| `DELETE` | `/cases/{id}` | Delete a case and all associated data |
| `POST` | `/upload/cdr` | Upload CDR CSV (native operator format) |
| `POST` | `/upload/ipdr` | Upload IPDR CSV (native operator format) |
| `POST` | `/analysis/run/{case_id}` | Trigger full 5-layer analysis pipeline |
| `GET` | `/report/pdf/{case_id}` | Generate and download court-ready PDF |
| `GET` | `/suspects/{case_id}` | Get all suspect profiles for a case |
| `GET` | `/network/{case_id}` | Get graph nodes/edges for network visualization |

---

## 📁 Project Structure

```
trace/
├── 📂 trace-backend/              # FastAPI Python Backend
│   ├── main.py                   # Application entry point
│   ├── database.py               # SQLAlchemy models & connection
│   ├── requirements.txt          # Python dependencies
│   └── 📂 routers/
│       ├── auth.py               # JWT authentication
│       ├── cases.py              # Case CRUD operations
│       ├── upload.py             # CDR/IPDR ingestion & mapping
│       ├── analysis.py           # 5-layer analytics engine
│       ├── suspects.py           # Suspect profile endpoints
│       ├── network.py            # Graph data endpoints
│       └── report.py            # PDF report generation
│
├── 📂 trace-frontend/             # React + TypeScript Frontend
│   ├── src/
│   │   ├── 📂 pages/             # Route-level page components
│   │   ├── 📂 components/        # Reusable UI components
│   │   ├── 📂 hooks/             # Custom React hooks
│   │   └── 📂 api/               # Axios API client functions
│   └── vite.config.ts
│
├── 📂 demo-data/                  # Sample CDR/IPDR files for demo
├── 📂 docs/assets/               # Platform screenshots
├── docker-compose.yml            # One-command deployment
└── README.md                     # This file
```

---

## 🗺️ Roadmap

| Phase | Feature | Status |
|:---|:---|:---|
| **v1.0** | CDR Upload + Zero-Config Operator Mapping | ✅ Complete |
| **v1.0** | IMEI Swap Detection | ✅ Complete |
| **v1.0** | Co-Location Engine | ✅ Complete |
| **v1.0** | Suspect Network Graph | ✅ Complete |
| **v1.0** | Cell Tower Map (Leaflet) | ✅ Complete |
| **v1.0** | OTT Fingerprinting via IPDR | ✅ Complete |
| **v1.0** | AI Anomaly Scoring (IsolationForest) | ✅ Complete |
| **v1.0** | Court-Ready PDF with SHA-256 | ✅ Complete |
| **v2.0** | Real-Time Tower Feed Integration | 🔜 Planned |
| **v2.0** | Cross-District Case Federation | 🔜 Planned |
| **v2.0** | Automated FIR Draft Generation | 🔜 Planned |
| **v2.0** | CCTNS / 112 Integration | 🔜 Planned |

---

## 🔐 Security & Compliance Notice

> **RESTRICTED — FOR AUTHORIZED LAW ENFORCEMENT USE ONLY**

- All generated PDF reports include a **SHA-256 hash** of the source CDR/IPDR files, establishing an unbroken Chain of Custody compliant with **Section 65B of the Indian Evidence Act**.
- Session authentication is enforced via **JWT tokens** with configurable expiry.
- No data is transmitted to any external cloud service. TRACE operates **fully offline** on the investigator's workstation.
- Access logs are maintained for all upload and analysis operations.

---

<div align="center">

**Built with ❤️ by the Prakasham District Cyber Cell**

*Empowering investigators with intelligence, not just data.*

---

*© 2026 Prakasham District Police, Andhra Pradesh. All rights reserved.*
*TRACE — Telecom Record Analysis for Criminal Examination*

</div>
