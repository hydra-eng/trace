# BUILD PROMPT — Challenge 04: Criminal Investigation & Suspect Tracking
# For: Antigravity IDE / AI Coding Agent
# Mode: Phase-by-phase, no hallucination, minimal UI

---

## STRICT RULES FOR THE AI — READ BEFORE CODING

1. Build ONLY what is listed in the current phase. Do not add unrequested features.
2. After each phase, stop and confirm before moving to the next.
3. Never use placeholder comments like `# TODO` or `# implement later`. Write working code or nothing.
4. All functions must be complete — no stubs, no `pass`, no ellipsis.
5. UI must use Shadcn/ui components with Tailwind CSS. No custom CSS files. No gradients. No animations except subtle transitions. No colored backgrounds except semantic use (red for alert, green for clear).
6. Use only these colors: white, zinc-50 to zinc-900, red-500 for critical alerts, amber-500 for warnings, green-500 for clear. Nothing else.
7. Every piece of data on screen must come from real computed values — no hardcoded display strings that look like data.
8. If you are uncertain about any implementation detail, ask before writing code.

---

## PROJECT OVERVIEW

**Name:** TRACE — Telecom Record Analysis for Criminal Examination
**Stack:**
- Backend: Python 3.11, FastAPI, PostgreSQL, SQLAlchemy, pandas, NetworkX, scikit-learn, ipwhois, reportlab
- Frontend: React 18 + TypeScript, Vite, Tailwind CSS, Shadcn/ui, Recharts, React Flow (for network graph)
- Infrastructure: Docker + docker-compose (single command startup, no internet dependency at runtime)

**What it does:**
Investigators upload CDR (Call Detail Records) and IPDR (Internet Protocol Detail Records) CSV files for multiple suspects. The system automatically surfaces criminal intelligence: coordinator networks, physical meeting events, IMEI swap evasion, communication anomalies, and OTT app usage patterns. Outputs a printable investigation brief per suspect.

**Four challenge focus areas and how each is addressed:**
- Suspect Tracking → IMEI swap detection, tower movement timeline, geospatial path rendering
- Criminal Intelligence Dashboards → Multi-suspect network graph, anomaly scores, meeting events, OTT app usage
- Investigation Support Systems → PDF case report generation, watchlist matching, multi-suspect intersection engine
- Pattern Analysis → Isolation Forest anomaly detection on call behavior, temporal burst detection, co-location event clustering

---

## DATA SCHEMA — Build these PostgreSQL tables in Phase 1. Do not change them later.

```sql
-- One case groups all uploaded files
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- One suspect per uploaded CDR file
CREATE TABLE suspects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id),
  label TEXT NOT NULL, -- e.g. "Suspect A"
  primary_msisdn TEXT NOT NULL
);

-- Raw CDR records
CREATE TABLE cdr_records (
  id BIGSERIAL PRIMARY KEY,
  suspect_id UUID REFERENCES suspects(id),
  msisdn_a TEXT NOT NULL,         -- calling number
  msisdn_b TEXT NOT NULL,         -- called number
  imei TEXT,                      -- handset ID
  tower_id TEXT,                  -- cell tower identifier
  tower_lat DOUBLE PRECISION,
  tower_lon DOUBLE PRECISION,
  call_type TEXT,                 -- CALL / SMS / DATA
  duration_sec INTEGER,
  timestamp TIMESTAMP NOT NULL
);

-- Raw IPDR records
CREATE TABLE ipdr_records (
  id BIGSERIAL PRIMARY KEY,
  suspect_id UUID REFERENCES suspects(id),
  msisdn TEXT NOT NULL,
  dest_ip TEXT NOT NULL,
  dest_port INTEGER,
  data_volume_kb DOUBLE PRECISION,
  app_label TEXT,                 -- resolved OTT label (WhatsApp, Telegram, etc.)
  timestamp TIMESTAMP NOT NULL
);

-- Computed events (written by analysis engine)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id),
  event_type TEXT NOT NULL,       -- IMEI_SWAP | CO_LOCATION | COMMON_CONTACT | ANOMALY | OTT_USAGE
  severity TEXT NOT NULL,         -- HIGH | MEDIUM | LOW
  involved_suspects TEXT[],       -- array of suspect labels
  detail JSONB NOT NULL,
  occurred_at TIMESTAMP
);
```

---

## CSV INPUT FORMAT — Accept exactly these columns. Show a downloadable template on the upload page.

**CDR CSV columns:**
`msisdn_a, msisdn_b, imei, tower_id, tower_lat, tower_lon, call_type, duration_sec, timestamp`

**IPDR CSV columns:**
`msisdn, dest_ip, dest_port, data_volume_kb, timestamp`

---

## PHASE 1 — Project scaffold and database (complete before writing any feature code)

### 1A — Backend scaffold
Create this exact directory structure:
```
trace-backend/
  main.py              # FastAPI app, CORS, router registration
  database.py          # SQLAlchemy engine, session factory, Base
  models.py            # All SQLAlchemy ORM models matching the schema above
  schemas.py           # Pydantic request/response schemas
  routers/
    cases.py           # POST /cases, GET /cases, GET /cases/{id}
    upload.py          # POST /cases/{id}/upload — accepts suspect_label + CDR CSV + IPDR CSV
    analysis.py        # POST /cases/{id}/analyze — runs all analysis engines
    events.py          # GET /cases/{id}/events
    suspects.py        # GET /cases/{id}/suspects, GET /suspects/{id}/profile
    report.py          # GET /suspects/{id}/report.pdf
  engines/
    imei_swap.py
    co_location.py
    common_contact.py
    anomaly.py
    ott_fingerprint.py
  requirements.txt
  Dockerfile
```

### 1B — Frontend scaffold
Create using Vite + React + TypeScript:
```
trace-frontend/
  src/
    pages/
      CasesPage.tsx
      CaseDetailPage.tsx
      UploadPage.tsx
      SuspectProfilePage.tsx
    components/
      NetworkGraph.tsx
      MovementMap.tsx
      EventTimeline.tsx
      CallCalendar.tsx
      SuspectCard.tsx
      FileUploadZone.tsx
      AlertBanner.tsx
    lib/
      api.ts           # all fetch calls to FastAPI
      types.ts         # TypeScript interfaces matching Pydantic schemas
    App.tsx
    main.tsx
  index.html
  tailwind.config.ts
  vite.config.ts
```

### 1C — docker-compose.yml
Single file at root. Services: `db` (postgres:15), `backend` (uvicorn), `frontend` (vite preview). One command: `docker-compose up --build`. No external dependencies at runtime.

### 1D — Seed data generator
Write `seed_data.py` at the backend root. When run, generates synthetic CDR and IPDR CSV files for exactly this scenario:

**The scenario (hardcode this story, do not randomize it):**
- Case name: "Operation Sandstorm"
- 5 suspects: A (kingpin), B (distributor-1), C (distributor-2), D (buyer), E (unrelated — clean profile)
- Suspect A: calls all others, swaps IMEI on day 3 (imei changes from `IMEI-A1` to `IMEI-A2`), high night-call ratio, 60+ calls in 2 days then goes silent (burst pattern)
- Suspects B and C: both appear on Tower-T14 on Day 2 between 14:00–14:30 → physical meeting event
- Suspect A also on Tower-T14 on Day 2 at 14:15 → 3-way meeting
- Common contact: number `+919999000001` appears in A, B, and C's CDR — this is the handler
- Suspect D: only calls B and C, normal call frequency, no IMEI swap, no anomaly
- Suspect E: completely clean — no common contacts, no co-location, normal patterns
- IPDR for A: connections to WhatsApp IP ranges and Telegram ASN → encrypted comms detected
- IPDR for B: only standard browsing — no OTT flags
- Generate 30 days of data. Approximately 500 CDR rows and 300 IPDR rows total.

---

## PHASE 2 — Five analysis engines (write one file at a time, test each before the next)

### Engine 1: `engines/imei_swap.py`
```
Function: detect_imei_swaps(suspect_id, db_session) -> List[Event]
Logic:
  - Query all CDR records for this suspect
  - Group by msisdn_a, then find rows where imei differs across records for the same msisdn
  - If a new IMEI appears after a previous one, compute the exact timestamp of first appearance of new IMEI
  - Return an Event per swap: severity=HIGH, detail={msisdn, old_imei, new_imei, swap_at_timestamp}
```

### Engine 2: `engines/co_location.py`
```
Function: detect_co_location(case_id, db_session, time_window_minutes=30) -> List[Event]
Logic:
  - For each tower_id + time window combination across ALL suspects in this case:
  - Collect all MSISDNs present at that tower within the window
  - If MSISDNs belong to 2 or more different suspects → co-location event
  - Severity: HIGH if 3+ suspects, MEDIUM if 2 suspects
  - Detail: {tower_id, tower_lat, tower_lon, window_start, window_end, suspects_present: [...]}
  - Deduplicate: same suspects + same tower within 2 hours = one event
```

### Engine 3: `engines/common_contact.py`
```
Function: detect_common_contacts(case_id, db_session, min_suspects=2) -> List[Event]
Logic:
  - For each suspect, collect the set of all msisdn_b numbers they called or received
  - Find msisdn_b values that appear in sets of 2+ suspects
  - For each common number, count how many suspects share it
  - Severity: HIGH if in 3+ suspects, MEDIUM if 2
  - Detail: {common_number, found_in_suspects: [...], total_call_count}
  - Sort by number of suspects descending — highest-shared numbers first
```

### Engine 4: `engines/anomaly.py`
```
Function: detect_anomalies(case_id, db_session) -> List[Event]
Logic:
  - For each suspect, compute these features from their CDR:
      calls_per_day (mean), calls_per_day_std, unique_contacts_count,
      night_call_ratio (calls between 23:00–05:00 / total),
      burst_score (max calls in any 6-hour window / avg calls per 6-hour window),
      avg_call_duration_sec, sms_ratio, silence_after_burst (bool: >50% drop in calls day after burst)
  - Stack all suspects' feature vectors into a matrix
  - Run sklearn.ensemble.IsolationForest(contamination=0.2)
  - For each suspect with anomaly_score < -0.1 (outlier), create Event severity=HIGH
  - Detail: {anomaly_score, features_summary, triggered_features: [...]}
  - Note: with only 5 suspects, IsolationForest will still run — just note in the detail that confidence increases with more data
```

### Engine 5: `engines/ott_fingerprint.py`
```
Function: fingerprint_ott(suspect_id, db_session) -> List[Event]
Logic:
  - For each IPDR record, resolve dest_ip to organization using ipwhois (cache results to avoid repeated lookups)
  - Map organization names to OTT labels using this exact mapping:
      contains "META" or "FACEBOOK" → "WhatsApp / Instagram"
      contains "GOOGLE" → "Google Services (Meet / Gmail)"
      contains "TELEGRAM" → "Telegram"
      contains "MICROSOFT" → "Microsoft Teams / Outlook"
      contains "TWITTER" or "X CORP" → "X (Twitter)"
      contains "AMAZON" or "AWS" → "AWS / Cloud Infrastructure"
      anything else → "Unknown / Other"
  - Group by app_label, compute: session_count, total_data_kb, first_seen, last_seen
  - Update ipdr_records.app_label in DB for each resolved record
  - Return Events only for encrypted OTT apps (WhatsApp, Telegram) — severity=MEDIUM
  - Detail: {app, session_count, total_data_kb, date_range}
```

### Analysis runner: `routers/analysis.py`
```
POST /cases/{case_id}/analyze
- Run all 5 engines in sequence for all suspects
- Write all resulting Events to the events table
- Return: {events_generated: N, summary: {imei_swaps: n, co_locations: n, common_contacts: n, anomalies: n, ott_flags: n}}
```

---

## PHASE 3 — API routes (after engines are working)

### Routes to implement:

```
POST   /cases                          — create case {name}
GET    /cases                          — list all cases
GET    /cases/{id}                     — case detail + suspect list + event counts

POST   /cases/{id}/upload              — multipart form: suspect_label (str), cdr_file (CSV), ipdr_file (CSV, optional)
                                         Parse and insert into cdr_records and ipdr_records
                                         Return: {suspect_id, rows_inserted_cdr, rows_inserted_ipdr}

POST   /cases/{id}/analyze             — run all engines, write events
GET    /cases/{id}/events              — list all events, filterable by ?event_type=&severity=
GET    /cases/{id}/network             — return graph data: {nodes: [...], edges: [...]}
                                         Nodes: suspects + common_contact numbers flagged
                                         Edges: call relationships with weight = call count

GET    /suspects/{id}/profile          — full suspect profile:
                                         {suspect, cdr_summary, ipdr_summary, events, call_heatmap_data, movement_data}
GET    /suspects/{id}/movement         — ordered list of {tower_id, lat, lon, timestamp} for map rendering
GET    /suspects/{id}/call_heatmap     — {hour_of_day: 0-23, day_of_week: 0-6, call_count} for calendar heatmap
GET    /suspects/{id}/report.pdf       — generated PDF report (see Phase 5)
```

---

## PHASE 4 — Frontend (build page by page, in this order)

### UI Rules — enforce these without exception:
- Font: Inter (import from Google Fonts in index.html)
- Background: zinc-50 (#FAFAFA) for page, white (#FFFFFF) for cards
- All cards: white background, 1px border zinc-200, border-radius 8px, padding 20px
- Text: zinc-900 for headings, zinc-600 for secondary, zinc-400 for muted
- Severity colors ONLY for event badges: red-100 bg + red-700 text for HIGH, amber-100 + amber-700 for MEDIUM, zinc-100 + zinc-600 for LOW
- No sidebar. Top navigation bar only: white, 1px bottom border zinc-200, logo left, nav links right.
- No icons unless from lucide-react (already in Shadcn). Use sparingly.
- Tables: no zebra striping. Thin 1px zinc-100 row dividers only.
- No modals. Use inline expansion or navigate to a new page.
- Buttons: Shadcn Button component only. variant="default" for primary actions, variant="outline" for secondary.

### Page 1: CasesPage (`/`)
- Header: "TRACE" in zinc-900, 20px, font-weight 600. Subtitle: "Telecom Record Analysis for Criminal Examination" in zinc-500, 13px.
- List of cases as cards in a grid (2 columns). Each card: case name, created date, suspect count, event count. Click → go to CaseDetailPage.
- "New Case" button top right → inline form below header (not modal): text input for case name + create button.

### Page 2: CaseDetailPage (`/cases/:id`)
- Top: case name + created date. "Upload Records" button → UploadPage. "Run Analysis" button → POST analyze, show loading state, refresh on complete.
- Four metric cards in a row: Total Suspects | Total Events | High Severity Events | Unique Common Contacts
- Tabs (Shadcn Tabs): Network | Events | Suspects
  - Network tab: Full-width NetworkGraph component (React Flow). Suspect nodes in zinc-800. Common contact nodes in red-100 border red-700. Edge thickness proportional to call count. Click node → navigate to suspect profile.
  - Events tab: Table of all events. Columns: Severity (badge) | Type | Suspects Involved | Summary | Timestamp. Filterable by severity and type (two Shadcn Select dropdowns above the table).
  - Suspects tab: Grid of SuspectCard components (see below).

### Component: SuspectCard
- White card, 200px wide. Suspect label (e.g. "Suspect A") in zinc-900 14px bold. Primary MSISDN in zinc-500 12px mono.
- Anomaly score bar: thin zinc-200 bar, filled portion in red-400 proportional to score. Label "Anomaly Score" + numeric value.
- Event count badges: small pills for IMEI_SWAP, CO_LOCATION, ANOMALY counts.
- Click → navigate to SuspectProfilePage.

### Page 3: UploadPage (`/cases/:id/upload`)
- Minimal form. Three fields stacked:
  1. Suspect Label (text input, placeholder "e.g. Suspect A")
  2. CDR File (FileUploadZone component — drag/drop or click. Shows filename after selection. Accepts .csv only.)
  3. IPDR File (same, marked "Optional")
- Submit button: "Upload Records"
- After upload: show success state inline (no toast, no modal) — "Suspect A uploaded. 247 CDR rows, 89 IPDR rows ingested." with a link back to the case.
- Below form: "Download CDR template" and "Download IPDR template" links — serve the column-header-only CSV files from the backend.

### Page 4: SuspectProfilePage (`/suspects/:id`)
- Back link: "← Case Name"
- Header row: Suspect label | MSISDN | Anomaly score badge
- Four sections stacked vertically, each in a white card:

  **Section 1 — Call Summary**
  Metric row: Total Calls | Total SMS | Unique Contacts | Avg Duration | Night Call Ratio | Burst Score
  All values computed from API. No hardcoded numbers.

  **Section 2 — Call Heatmap**
  Title: "Call Activity Heatmap"
  7-row × 24-column grid (days × hours). Each cell is a small square (12px × 12px, 2px gap). Color: white (0 calls) → zinc-300 → zinc-600 → zinc-900 (max calls). This is built with a plain div grid, not a chart library. Axis labels: abbreviated day names left, hour numbers 0–23 top.

  **Section 3 — Movement Timeline**
  Title: "Tower Movement"
  MovementMap component: Leaflet.js map (use react-leaflet). Plot suspect's tower visits as markers. Draw polyline connecting them in chronological order. Marker popup shows: tower ID, timestamp, co-location flag if applicable (red marker if co-location event at this tower, otherwise zinc-colored circle).
  Below map: ordered list of movement events as a compact table — Tower ID | Timestamp | Duration at tower | Co-location with (if any)

  **Section 4 — Events for this suspect**
  Same table as CaseDetailPage Events tab but filtered to this suspect. Plus OTT app usage table if IPDR data exists: App | Sessions | Total Data | First Seen | Last Seen.

- Bottom: "Download Investigation Report" button → GET /suspects/{id}/report.pdf

### Component: NetworkGraph (React Flow)
- Import ReactFlow from 'reactflow'
- Nodes: suspects as square nodes (40px), zinc-800 background, white text, suspect label.
- Common contact numbers as smaller round nodes (28px), red-100 background, red-700 text, last 4 digits of number.
- Edges: straight lines, zinc-400, strokeWidth proportional to call_count (min 1, max 5).
- Minimap: enabled, bottom right.
- Controls: zoom + fit — enabled.
- No edge labels. No animated edges.
- On node click: if suspect node → navigate to profile. If contact node → show inline tooltip: full number + which suspects called it.

---

## PHASE 5 — PDF report generator

File: `routers/report.py`
Library: reportlab

**Report layout for GET /suspects/{id}/report.pdf:**

Page 1:
- Header: "INVESTIGATION BRIEF" left-aligned, 10pt, zinc. "TRACE System" right-aligned, 10pt.
- Divider line.
- Suspect label (large, 20pt bold), MSISDN below it (12pt mono).
- Report generated timestamp + Case name.
- Section: "Risk Indicators" — table of all HIGH severity events for this suspect. Columns: Event Type | Detail | Timestamp.
- Section: "Call Behavior Summary" — the same 6 metrics as the UI card, in a 2-column table.
- Section: "IMEI History" — table of all IMEIs observed, first seen, last seen. If >1 IMEI: bold red note "IMEI SWAP DETECTED ON [date]".

Page 2:
- Section: "Communication Network" — table of top 10 contacts by call count. Columns: Number | Call Count | Total Duration | Flag (COMMON CONTACT if flagged).
- Section: "Physical Meeting Events" — table of co-location events. Columns: Date | Tower ID | Location (lat/lon) | Other Suspects Present.
- Section: "OTT Application Usage" — table from IPDR data. If no IPDR data: "No IPDR data uploaded for this suspect."
- Footer: "This report is generated by the TRACE system for law enforcement use only. Verify all data against source records before use in legal proceedings."

Return as a StreamingResponse with content-type application/pdf.

---

## PHASE 6 — Final wiring and validation

1. Confirm docker-compose up --build starts all three services cleanly with no errors.
2. Run seed_data.py → upload the generated CSVs via the UI → run analysis → verify:
   - 1 IMEI swap event detected (Suspect A)
   - 1 co-location event detected (Suspects A, B, C at Tower-T14)
   - 1 common contact event (number +919999000001 in A, B, C)
   - Suspect A flagged as anomaly (IsolationForest)
   - Suspect E has zero events
   - OTT fingerprint shows WhatsApp and Telegram for Suspect A
3. Download PDF for Suspect A. Confirm all 5 sections render with real data.
4. Confirm network graph shows A as central hub node with common contact in red.
5. Confirm movement map shows Tower-T14 in red (co-location event).

---

## WHAT NOT TO BUILD — DO NOT ADD THESE

- No user authentication or login screens (out of scope for hackathon)
- No real-time websocket updates
- No natural language query interface
- No facial recognition or image processing
- No external API calls at runtime (all IP lookups must use cached/local data or ipwhois with try/except fallback)
- No dark mode toggle
- No notification system
- No drag-to-rearrange dashboard
- No export to Excel

---

## FINAL CHECKLIST BEFORE SUBMISSION

- [ ] `docker-compose up --build` works from a clean clone
- [ ] Seed data loads and analysis runs end to end
- [ ] All 4 focus areas demonstrable in the UI
- [ ] PDF report downloads with real data
- [ ] No hardcoded numbers visible in the UI
- [ ] UI uses only the defined color palette
- [ ] All API endpoints return proper HTTP error codes (404, 422, 500) with detail messages
- [ ] README.md: project description, setup instructions (docker-compose up), demo walkthrough, tech stack table

