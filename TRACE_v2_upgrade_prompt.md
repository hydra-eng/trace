# TRACE v2 — Upgrade Prompt
# Three focused upgrades: Network Graph + Map + Prakasham Police Branding + AP/Telangana Data
# Model: claude-sonnet-4-6

---

## UPGRADE 1 — PRAKASHAM DISTRICT POLICE BRANDING

### Where to apply (all locations, consistently):

**Loading screen:**
- Replace generic crest with Prakasham District Police logo/text.
- Layout: Logo centered (80px) → "PRAKASHAM DISTRICT POLICE" 14px font-semibold tracking-widest text-slate-700 → "Andhra Pradesh" 11px text-slate-400 → divider → "TRACE Investigation System" 18px font-bold text-slate-900 → loading bar → "Initializing secure session…" mono 10px.

**Top nav bar:**
- After "TRACE" wordmark, add a small divider then "Prakasham District Police, AP" 10px text-slate-400 uppercase tracking-wide. Always visible.

**Cases page hero:**
- Below "Investigation Cases" heading: add a row with the Prakasham emblem (img src="/prakasham-police.png", h-8, object-contain, opacity-80) + "Prakasham District Police — Criminal Intelligence Division" text-12px text-slate-500.

**Sidebar footer (bottom of sidebar, fixed):**
- Small block: border-top 1px #E2E8F0, p-3.
- "PRAKASHAM DIST. POLICE" 9px font-mono font-semibold text-slate-400 uppercase.
- "AP Criminal Investigation Dept." 9px text-slate-300.

**PDF report header (every page):**
- Left of header strip: "PRAKASHAM DISTRICT POLICE — ANDHRA PRADESH" 7pt Helvetica-Bold.
- Right: "TRACE System — RESTRICTED" 7pt.
- Add district seal image top-right of page 1 (40×40pt, if PNG available at /public/prakasham-police.png, else skip silently).

**Image path:** `/public/prakasham-police.png` — add a comment in code: `/* Place Prakasham District Police logo at /public/prakasham-police.png */`. All img tags must have a graceful fallback (show text if image missing).

---

## UPGRADE 2 — ANDHRA PRADESH / TELANGANA SIMULATION DATA

Replace the generic seed_data.py with a new AP/Telangana-specific scenario.

### File: `seed_data_ap.py` (replaces seed_data.py)

**Case name:** "Operation Godavari — Prakasham District"

**Geographic seed data — use these real AP/Telangana tower locations:**
```python
TOWERS = [
    {"id": "TWR-ONG-001", "name": "Ongole Central",       "lat": 15.5057, "lon": 80.0499},
    {"id": "TWR-ONG-002", "name": "Ongole Bus Stand",     "lat": 15.5100, "lon": 80.0450},
    {"id": "TWR-KNL-001", "name": "Kurnool City",         "lat": 15.8281, "lon": 78.0373},
    {"id": "TWR-GNT-001", "name": "Guntur Junction",      "lat": 16.3067, "lon": 80.4365},
    {"id": "TWR-VJA-001", "name": "Vijayawada Central",   "lat": 16.5062, "lon": 80.6480},
    {"id": "TWR-HYD-001", "name": "Hyderabad Secunderabad","lat": 17.4399, "lon": 78.4983},
    {"id": "TWR-HYD-002", "name": "LB Nagar Hyderabad",   "lat": 17.3453, "lon": 78.5479},
    {"id": "TWR-NLR-001", "name": "Nellore Town",         "lat": 14.4426, "lon": 79.9865},
    {"id": "TWR-MRT-001", "name": "Markapur Prakasham",   "lat": 15.7333, "lon": 79.2667},
    {"id": "TWR-CDD-001", "name": "Chirala Prakasham",    "lat": 15.8167, "lon": 80.3500},
]
```

**Suspect MSISDNs (Indian format +91-9XXXXXXXXX, AP numbers):**
```python
SUSPECTS = [
    {"label": "Suspect A", "msisdn": "919000100001", "role": "kingpin"},
    {"label": "Suspect B", "msisdn": "919000100002", "role": "distributor"},
    {"label": "Suspect C", "msisdn": "919000100003", "role": "distributor"},
    {"label": "Suspect D", "msisdn": "919000100004", "role": "buyer"},
    {"label": "Suspect E", "msisdn": "919000100005", "role": "clean"},
]
HANDLER_NUMBER = "919888000001"  # common coordinator
```

**Story — generate data to tell this exact story:**
- Suspect A (kingpin): Based in Ongole (TWR-ONG-001). Makes 60+ calls in first 3 days (burst). Goes silent Day 4-5. IMEI swap on Day 3 at 02:30. Calls all others. Uses WhatsApp (Meta IPs) and Telegram heavily in IPDR. Night call ratio >70%.
- Suspect B: Moves Ongole → Guntur → Vijayawada (drug route along NH-16). Meets A at TWR-ONG-001 on Day 2 at 15:00.
- Suspect C: Based in Hyderabad (TWR-HYD-001). Travels to Ongole on Day 2. Appears at TWR-ONG-002 at 15:15 — co-location with A and B.
- Suspect D: Only calls B and C. Stays in Nellore. Normal call pattern. No IMEI swap.
- Suspect E: Calls only family numbers not in suspect list. Completely clean. Serves as negative control.
- Handler (919888000001): Appears in CDR of A, B, and C. Never appears in D or E. This is the common contact.

**Generate:**
- 30 days of CDR data (~600 rows total across all suspects).
- 400 rows of IPDR for A and B only.
- Output: `data/cdr_suspectA.csv`, `data/cdr_suspectB.csv` … × 5, `data/ipdr_suspectA.csv`, `data/ipdr_suspectB.csv`.
- Print "Seed data generated: Operation Godavari scenario (AP/Telangana)" on completion.

---

## UPGRADE 3 — NETWORK GRAPH (deep redesign)

### Library: Keep ReactFlow. Add these capabilities.

**Node types — define 4 custom node types:**

```
SuspectNode:   40×40px square, bg #1E3A8A (navy), white text, font-mono 10px.
               Bottom: thin colored bar showing anomaly score (red/amber/green, 4px height).
               Badge top-right: event count in red circle if > 0.
               On hover: expand to show MSISDN below label (tooltip-style inline).

HandlerNode:   32px circle, bg #FEF2F2, border 2px #EF4444, text #B91C1C, font-mono 9px.
               Pulsing ring animation: box-shadow 0 0 0 0 rgba(239,68,68,0.4) → 0 0 0 8px transparent, 1.5s infinite.
               Label below node: "HANDLER" 8px text-red-600 uppercase.

ClearNode:     30px circle, bg #F0FDF4, border 1.5px #16A34A, text #166534, 10px.

TowerNode:     28px diamond shape (CSS rotate 45deg square), bg #DBEAFE, border 1.5px #3B82F6, no text.
               Show only when "Show towers" toggle is ON.
               Tooltip on hover: tower name + location.
```

**Edge types:**
```
CallEdge:      Gray #94A3B8, strokeWidth = Math.max(1, callCount/20), opacity 0.7.
               Animated dash flow for edges with callCount > 30 (ReactFlow animated: true).

HandlerEdge:   Color #EF4444, strokeWidth 2, dashed (strokeDasharray: "5,3").

CoLocEdge:     Color #8B5CF6, strokeWidth 1.5, label showing "Met: Day 2 15:00" (ReactFlow EdgeLabel).
               Only renders when "Show meetings" toggle ON.
```

**Toolbar (absolute top-left of graph panel, bg-white border rounded-lg p-2 flex gap-2):**
- Toggle "Show towers" — Shadcn Switch + label 10px. When ON: add tower nodes for each tower in suspect movement data.
- Toggle "Show meetings" — Shadcn Switch + label 10px. When ON: purple co-location edges appear.
- Toggle "Call weight" — Shadcn Switch + label 10px. When ON: edge strokeWidth scales with call count.
- Button "Fit view" — variant="outline" size="sm", Maximize2 icon.
- Select "Suspect filter" — multiselect checkboxes dropdown. Filter which suspects show. Default: all.

**Legend (absolute bottom-left, bg-white border rounded-lg p-2.5):**
Four rows, each 9px text-slate-500:
- Navy square + "Suspect node"
- Red circle (pulsing) + "Handler / coordinator"  
- Green circle + "Clear (no events)"
- Blue diamond + "Cell tower"
Then: "Edge thickness = call volume" in italic 8px text-slate-400.

**Graph layout:** Use ReactFlow's dagre layout (import from '@dagrejs/dagre'). Direction: LR (left to right). Rank suspects left → handler right. This gives a clear hierarchy instead of random placement.

**On node click (SuspectNode):**
Show an inline side panel (right side of graph container, w-64, bg-white border-l border-slate-200, absolute right-0 top-0 bottom-0, z-10).
Panel content: suspect label + MSISDN + anomaly score bar + top 3 events as mini badges + "View full profile →" link.
Close button (X) top-right of panel.

---

## UPGRADE 4 — MOVEMENT MAP (deep redesign)

### Library: Replace basic react-leaflet with react-leaflet + custom layers. Keep Leaflet under the hood.

**Map tiles:** Use CartoDB Positron tiles (clean, minimal, good for data overlays):
```
url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
attribution="© OpenStreetMap © CARTO"
```
This gives a clean light-gray basemap perfect for overlaying colored paths and markers.

**Center and zoom:** Default center on Prakasham District — `[15.5057, 80.0499]`, zoom 8. This shows the full AP corridor from Nellore to Vijayawada.

**Per-suspect movement paths:**
Each suspect gets a distinct Polyline color:
- Suspect A: #3B82F6 (blue), weight 3
- Suspect B: #8B5CF6 (violet), weight 3
- Suspect C: #10B981 (emerald), weight 3
- Suspect D: #F59E0B (amber), weight 2
- Suspect E: #6B7280 (slate), weight 2, dashed (dashArray: "4 4")

Each tower visit = one point on the polyline. Connect in chronological order.

**Tower markers:**
For each unique tower in suspect movement data, render a CircleMarker:
- Default: radius 6, fillColor white, color #475569, fillOpacity 1, weight 2.
- Co-location tower (2+ suspects present in same 30min window): radius 10, fillColor #FEF2F2, color #EF4444, weight 2.5. Add a pulsing effect using a second CircleMarker beneath (radius 16, color #EF4444, opacity 0.15, weight 0, fillOpacity 0.15).

**Tower popup (on click):**
White popup, no default Leaflet styling overrides needed:
```
Tower: TWR-ONG-001
Name: Ongole Central
Location: 15.5057°N, 80.0499°E

Visits:
Suspect A — Day 2 14:58 → Day 2 15:22 (24 min)
Suspect B — Day 2 14:55 → Day 2 15:18 (23 min)  ← highlight these in amber if co-location
Suspect C — Day 2 15:02 → Day 2 15:30 (28 min)

⚠ CO-LOCATION EVENT DETECTED
3 suspects within 30-minute window
```

**Timeline scrubber (below map, full width):**
A horizontal input[type=range], min=1, max=30 (days). Thumb moves day by day.
As scrubber moves: show only tower visits up to that day on the map (filter polyline points by day).
Label above scrubber: "Day {N} of 30 — {date string}".
Play button (Play icon, variant="outline" size="sm") auto-advances the scrubber day by day at 800ms intervals. Pause button replaces it while playing.

**Legend overlay (top-right of map, bg-white border rounded-lg p-2.5, absolute, z-400):**
Per-suspect colored line + label. Checkbox per suspect to toggle their path visibility.
Red pulsing circle + "Co-location event" label.

**Suspect filter toggles (above map, flex row):**
Five small toggle buttons, one per suspect. Active = filled with suspect color, inactive = outline.
On toggle: show/hide that suspect's polyline and markers on map.

---

## UPGRADE 5 — PDF REPORT — AP/TELANGANA SPECIFIC IMPROVEMENTS

Add these to the existing reportlab PDF (patch on top of Patch 6 from previous prompt):

**Page 1 — after suspect header:**
Add a "Geographic Profile" section:
- Table: 3 columns — Tower Name | Location | Visit Count | First Visit | Last Visit.
- Sorted by visit count desc. Shows all towers suspect visited.
- Color co-location tower rows: bg #FEF2F2 with red left border indicator.

**Page 1 — movement summary paragraph (auto-generated):**
Use Python string templating (NOT an LLM call) to generate this text:
```python
movement_summary = f"""
{suspect.label} operated primarily in the {primary_tower_name} area 
({primary_tower_lat:.4f}°N, {primary_tower_lon:.4f}°E), consistent with 
{district_name} district. Movement was recorded across {unique_tower_count} 
cell towers spanning approximately {distance_km:.0f} km. 
{'A co-location event was detected at ' + coloc_tower + ' on ' + coloc_date + '.' if has_colocation else ''}
"""
```
Render as a Paragraph in Helvetica 9pt #374151 with italic style.

**Page 2 — add AP/Telangana geography note in footer:**
"All tower coordinates verified against AP/Telangana cell tower registry. Data pertains to Prakasham District jurisdiction unless otherwise noted."
Helvetica 7pt italic #94A3B8.

---

## FILES TO CREATE / MODIFY

Create:
- `seed_data_ap.py` — AP/Telangana scenario generator (Upgrade 2)

Modify:
- `src/components/NetworkGraph.tsx` — full redesign (Upgrade 3)
- `src/components/MovementMap.tsx` — full redesign (Upgrade 4)  
- `src/components/TopBar.tsx` — add Prakasham branding (Upgrade 1)
- `src/components/Sidebar.tsx` — add Prakasham footer (Upgrade 1)
- `src/pages/CasesPage.tsx` — add Prakasham hero line (Upgrade 1)
- `src/components/LoadingScreen.tsx` — update branding (Upgrade 1)
- `routers/report.py` — add geographic profile section (Upgrade 5)

Add to /public:
- `prakasham-police.png` — add comment in all img tags: `/* Place Prakasham District Police logo here */`

---

## DO NOT TOUCH

- Backend engine logic (IMEI swap, co-location, anomaly, OTT fingerprint)
- Database schema
- All other pages (Upload, Events, Reports list)
- Heatmap component
- Routing

