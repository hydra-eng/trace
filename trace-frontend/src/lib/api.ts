import {
  mockCases,
  mockSuspectsByCase,
  mockNetworkByCase,
  mockEventsByCase,
  mockSharedContactsByCase,
  mockSuspectProfiles,
  mockMovementBySuspect,
  mockHeatmapBySuspect,
  mockGlobalHandlers,
} from "./mockData";

// In browser: always derive from current hostname (works for both localhost and IP access)
// In build: VITE_API_URL can override (e.g. for production deployments)
const API_BASE = typeof window !== "undefined"
  ? `http://${window.location.hostname}:8000`
  : (import.meta.env.VITE_API_URL || "http://localhost:8000");

export { API_BASE };

// Global mock state — determined once on first request
let useMock: boolean | null = null;  // null = not yet determined

// Check if backend is reachable (called once on first request)
async function checkBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: "GET", signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      return data.status === "ok";
    }
    return false;
  } catch {
    return false;
  }
}

// Initialize in-memory tables for mock mode mutations
const memoryCases = [...mockCases];
const memorySuspectsByCase = { ...mockSuspectsByCase };
const memoryNetworkByCase = { ...mockNetworkByCase };
const memoryEventsByCase = { ...mockEventsByCase };
const memorySharedContactsByCase = { ...mockSharedContactsByCase };
const memorySuspectProfiles = { ...mockSuspectProfiles };
const memoryMovementBySuspect = { ...mockMovementBySuspect };
const memoryHeatmapBySuspect = { ...mockHeatmapBySuspect };
const memoryGlobalHandlers = [...mockGlobalHandlers];

// Simple base64 PDF of a minimal valid PDF page:
// Displays: "TRACE - Criminal Intelligence Platform" and "Demo Mode - PDF Report Simulation"
const dummyPdfBase64 = "data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCiAgPj4KZW5kb2JqCjIgMCBvYmoKICA8PCAvVHlwZSAvUGFnZXMKICAgICAvS2lkcyBbIDMgMCBSIF0KICAgICAvQ291bnQgMQogID4+CmVuZG9iagozIDAgb2JqCiAgPDwgL1R5cGUgL1BhZ2UKICAgICAvUGFyZW50IDIgMCBSCiAgICAgL01lZGlhQm94IFsgMCAwIDU5NSA4NDIgXQogICAgIC9Db250ZW50cyA0IDAgUgogICAgIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDUgMCBSID4+ID4+CiAgPj4KZW5kb2JqCjQgMCBvYmoKICA8PCAvTGVuZ3RoIDcwID4+CnN0cmVhbQpCVAovRjEgMjQgVGYKNzAgNzIwIFRkCihUUkFDRSAtIENyaW1pbmFsIEludGVsbGlnZW5jZSBQbGF0Zm9ybSkgVGoKMCAtMzAgVGQKKERlbW8gTW9kZSAtIFBERiBSZXBvcnQgU2ltdWxhdGlvbikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCiAgPDwgL1R5cGUgL0ZvbnQKICAgICAvU3VidHlwZSAvVHlwZTEKICAgICAvQmFzZUZvbnQgL0hlbHZldGljYQogID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIGYgCjAwMDAwMDAyNDQgMDAwMDAgbiAKMDAwMDAwMDM2NSAwMDAwMCBuIAp0cmFpbGVyCiAgPDwgL1NpemUgNgogICAgIC9Sb290IDEgMCBSCiAgPj4Kc3RhcnR4cmVmCjQ1NQolJUVPRgo=";



// Helper to parse query parameters from a path string
function parseQuery(path: string): Record<string, string> {
  const qIdx = path.indexOf("?");
  if (qIdx === -1) return {};
  const qs = path.substring(qIdx + 1);
  const params: Record<string, string> = {};
  qs.split("&").forEach((part) => {
    const [k, v] = part.split("=");
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || "");
  });
  return params;
}

// In-memory mock API requests dispatcher
function handleMockRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const cleanPath = path.split("?")[0];
  const query = parseQuery(path);

  // 1. GET /cases
  if (cleanPath === "/cases" && (!options || options.method === "GET" || !options.method)) {
    return Promise.resolve(memoryCases as unknown as T);
  }

  // 2. POST /cases
  if (cleanPath === "/cases" && options?.method === "POST") {
    const body = JSON.parse(options.body as string);
    const caseId = "case-" + Math.random().toString(36).substring(2, 11);
    const newCase = {
      id: caseId,
      name: body.name,
      created_at: new Date().toISOString(),
      suspect_count: 0,
      event_count: 0,
    };
    memoryCases.unshift(newCase);
    memorySuspectsByCase[caseId] = [];
    memoryNetworkByCase[caseId] = { nodes: [], edges: [] };
    memoryEventsByCase[caseId] = [];
    memorySharedContactsByCase[caseId] = [];
    return Promise.resolve(newCase as unknown as T);
  }

  // 3. GET /cases/{id}
  if (cleanPath.startsWith("/cases/") && cleanPath.split("/").length === 3 && (!options || options.method === "GET" || !options.method)) {
    const id = cleanPath.split("/")[2];
    const c = memoryCases.find((x) => x.id === id);
    if (!c) return Promise.reject(new Error("Case not found"));
    return Promise.resolve(c as unknown as T);
  }

  // 4. GET /cases/{id}/suspects
  if (cleanPath.startsWith("/cases/") && cleanPath.endsWith("/suspects") && (!options || options.method === "GET" || !options.method)) {
    const id = cleanPath.split("/")[2];
    return Promise.resolve((memorySuspectsByCase[id] || []) as unknown as T);
  }

  // 5. GET /cases/{id}/network
  if (cleanPath.startsWith("/cases/") && cleanPath.endsWith("/network") && (!options || options.method === "GET" || !options.method)) {
    const id = cleanPath.split("/")[2];
    return Promise.resolve((memoryNetworkByCase[id] || { nodes: [], edges: [] }) as unknown as T);
  }

  // 6. GET /cases/{id}/events
  if (cleanPath.startsWith("/cases/") && cleanPath.endsWith("/events") && (!options || options.method === "GET" || !options.method)) {
    const id = cleanPath.split("/")[2];
    let evs = memoryEventsByCase[id] || [];
    if (query.event_type) {
      evs = evs.filter((e) => e.event_type === query.event_type);
    }
    if (query.severity) {
      evs = evs.filter((e) => e.severity === query.severity);
    }
    return Promise.resolve(evs as unknown as T);
  }

  // 7. POST /cases/{id}/analyze
  if (cleanPath.startsWith("/cases/") && cleanPath.endsWith("/analyze") && options?.method === "POST") {
    const id = cleanPath.split("/")[2];
    const evs = memoryEventsByCase[id] || [];
    const count = evs.length;
    return Promise.resolve({
      events_generated: count,
      summary: {
        imei_swaps: evs.filter((e) => e.event_type === "IMEI_SWAP").length,
        co_locations: evs.filter((e) => e.event_type === "CO_LOCATION").length,
        common_contacts: evs.filter((e) => e.event_type === "COMMON_CONTACT").length,
        anomalies: evs.filter((e) => e.event_type === "ANOMALY").length,
        ott_flags: evs.filter((e) => e.event_type === "OTT_USAGE").length,
      },
    } as unknown as T);
  }

  // 8. GET /cases/{id}/shared-contacts
  if (cleanPath.startsWith("/cases/") && cleanPath.endsWith("/shared-contacts") && (!options || options.method === "GET" || !options.method)) {
    const id = cleanPath.split("/")[2];
    return Promise.resolve((memorySharedContactsByCase[id] || []) as unknown as T);
  }

  // 9. GET /suspects/{id}/profile
  if (cleanPath.startsWith("/suspects/") && cleanPath.endsWith("/profile") && (!options || options.method === "GET" || !options.method)) {
    const id = cleanPath.split("/")[2];
    const profile = memorySuspectProfiles[id];
    if (!profile) return Promise.reject(new Error("Suspect not found"));

    // Add recidivism_data dynamically in mock mode
    const label = profile.suspect.label;
    let recData = null;
    if (label === "Kalyan Chakravarthy") {
      recData = {
        base_score: 72,
        recidivism_adjustment: 20,
        final_score: 92,
        prior_incident_count: 2,
        risk_band: "CRITICAL",
        risk_band_color: "red",
        recommended_action: "Immediate escalation to SP/DIG level",
        priors: [
          { case_reference: "FIR 87/2022 — Nellore District", offence_type: "Illicit Tobacco Smuggling", incident_date: "2022-03-15", district: "Nellore", outcome: "Charge Sheet Filed" },
          { case_reference: "FIR 214/2019 — Prakasham District", offence_type: "Hawala Transaction (Suspected)", incident_date: "2019-11-02", district: "Prakasham", outcome: "Acquitted" }
        ]
      };
    } else if (label === "Venkatesh Prasad") {
      recData = {
        base_score: 55,
        recidivism_adjustment: 8,
        final_score: 63,
        prior_incident_count: 1,
        risk_band: "HIGH",
        risk_band_color: "orange",
        recommended_action: "Priority surveillance — daily reporting",
        priors: [
          { case_reference: "FIR 33/2023 — Guntur District", offence_type: "Organised Drug Peddling", incident_date: "2023-06-20", district: "Guntur", outcome: "FIR Registered" }
        ]
      };
    } else {
      recData = {
        base_score: 15,
        recidivism_adjustment: 0,
        final_score: 15,
        prior_incident_count: 0,
        risk_band: "LOW",
        risk_band_color: "green",
        recommended_action: "Routine monitoring",
        priors: []
      };
    }

    return Promise.resolve({
      ...profile,
      recidivism_data: recData
    } as unknown as T);
  }

  // 10. GET /suspects/{id}/movement
  if (cleanPath.startsWith("/suspects/") && cleanPath.endsWith("/movement") && (!options || options.method === "GET" || !options.method)) {
    const id = cleanPath.split("/")[2];
    return Promise.resolve((memoryMovementBySuspect[id] || []) as unknown as T);
  }

  // 11. GET /suspects/{id}/call_heatmap
  if (cleanPath.startsWith("/suspects/") && cleanPath.endsWith("/call_heatmap") && (!options || options.method === "GET" || !options.method)) {
    const id = cleanPath.split("/")[2];
    return Promise.resolve((memoryHeatmapBySuspect[id] || []) as unknown as T);
  }

  // 12. GET /global/handler-numbers
  if (cleanPath === "/global/handler-numbers" && (!options || options.method === "GET" || !options.method)) {
    return Promise.resolve(memoryGlobalHandlers as unknown as T);
  }

  // 13. GET /suspects/{id}/recidivism
  if (cleanPath.startsWith("/suspects/") && cleanPath.endsWith("/recidivism")) {
    const id = cleanPath.split("/")[2];
    let label = "Unknown";
    for (const list of Object.values(memorySuspectsByCase)) {
      const found = list.find((s) => s.id === id);
      if (found) { label = found.label; break; }
    }
    
    let baseScore = 15;
    let adjustment = 0;
    let finalScore = 15;
    let band = "LOW";
    let priorCount = 0;
    let priorsList: any[] = [];

    if (label === "Kalyan Chakravarthy") {
      baseScore = 72;
      adjustment = 20;
      finalScore = 92;
      band = "CRITICAL";
      priorCount = 2;
      priorsList = [
        { case_reference: "FIR 87/2022 — Nellore District", offence_type: "Illicit Tobacco Smuggling", incident_date: "2022-03-15", district: "Nellore", outcome: "Charge Sheet Filed" },
        { case_reference: "FIR 214/2019 — Prakasham District", offence_type: "Hawala Transaction (Suspected)", incident_date: "2019-11-02", district: "Prakasham", outcome: "Acquitted" }
      ];
    } else if (label === "Venkatesh Prasad") {
      baseScore = 55;
      adjustment = 8;
      finalScore = 63;
      band = "HIGH";
      priorCount = 1;
      priorsList = [
        { case_reference: "FIR 33/2023 — Guntur District", offence_type: "Organised Drug Peddling", incident_date: "2023-06-20", district: "Guntur", outcome: "FIR Registered" }
      ];
    }

    return Promise.resolve({
      base_score: baseScore,
      recidivism_adjustment: adjustment,
      final_score: finalScore,
      prior_incident_count: priorCount,
      risk_band: band,
      risk_band_color: band === "CRITICAL" ? "red" : band === "HIGH" ? "orange" : band === "MEDIUM" ? "amber" : "green",
      recommended_action: band === "CRITICAL" ? "Immediate escalation to SP/DIG level" : band === "HIGH" ? "Priority surveillance — daily reporting" : "Routine monitoring",
      priors: priorsList
    } as unknown as T);
  }

  // 14. GET /suspects/{id}/cctv
  if (cleanPath.startsWith("/suspects/") && cleanPath.endsWith("/cctv")) {
    const id = cleanPath.split("/")[2];
    let label = "Unknown";
    for (const list of Object.values(memorySuspectsByCase)) {
      const found = list.find((s) => s.id === id);
      if (found) { label = found.label; break; }
    }


    const allDetections = [
      { id: "cctv-1", suspect_id: id, camera_id: "CAM-ONG-MKT-01", camera_name: "Ongole Main Market Junction", camera_lat: 15.5071, camera_lon: 80.0512, detection_timestamp: "2024-01-02T14:52:00", confidence_score: 0.91, matched_tower_id: "TWR-ONG-001", correlation_status: "CONFIRMED", notes: "Subject detected 6 min before CDR tower registration. Movement consistent.", frame_image_path: "/cctv/cctv-1.jpg" },
      { id: "cctv-2", suspect_id: id, camera_id: "CAM-CDD-NH16-01", camera_name: "Chirala NH-16 Toll Plaza Camera", camera_lat: 15.818, camera_lon: 80.352, detection_timestamp: "2024-01-02T15:05:00", confidence_score: 0.87, matched_tower_id: "TWR-CDD-001", correlation_status: "CONFIRMED", notes: "Subject detected at Chirala toll gate simultaneous with CDR tower TWR-CDD-001 co-location event", frame_image_path: "/cctv/cctv-2.jpg" },
      { id: "cctv-3", suspect_id: id, camera_id: "CAM-ONG-BUS-01", camera_name: "Ongole APSRTC Bus Stand", camera_lat: 15.5042, camera_lon: 80.0465, detection_timestamp: "2024-01-05T02:19:00", confidence_score: 0.79, matched_tower_id: "TWR-ONG-002", correlation_status: "CONFIRMED", notes: "Night-time detection correlates with IMEI swap at 02:13", frame_image_path: "/cctv/cctv-3.jpg" },
    ];

    if (label === "Kalyan Chakravarthy") {
      return Promise.resolve([allDetections[0], allDetections[2]] as unknown as T);
    } else if (label === "Venkatesh Prasad") {
      return Promise.resolve([allDetections[1]] as unknown as T);
    }
    return Promise.resolve([] as unknown as T);
  }

  // 15. GET /cases/{id}/cctv or /cctv/timeline
  if ((cleanPath.startsWith("/cases/") && cleanPath.endsWith("/cctv")) || cleanPath === "/cctv/timeline" || cleanPath.startsWith("/cctv/timeline")) {
    const list: any[] = [];
    const findIdByLabel = (lbl: string) => {
      for (const suspectsList of Object.values(memorySuspectsByCase)) {
        const found = suspectsList.find((s) => s.label === lbl);
        if (found) return found.id;
      }
      return null;
    };

    const kalyanId = findIdByLabel("Kalyan Chakravarthy") || "mock-kalyan-id";
    const venkateshId = findIdByLabel("Venkatesh Prasad") || "mock-venkatesh-id";

    list.push({ id: "cctv-1", suspect_id: kalyanId, suspect_label: "Kalyan Chakravarthy", camera_id: "CAM-ONG-MKT-01", camera_name: "Ongole Main Market Junction", camera_lat: 15.5071, camera_lon: 80.0512, detection_timestamp: "2024-01-02T14:52:00", confidence_score: 0.91, matched_tower_id: "TWR-ONG-001", correlation_status: "CONFIRMED", notes: "Subject detected 6 min before CDR tower registration. Movement consistent.", frame_image_path: "/cctv/cctv-1.jpg" });
    list.push({ id: "cctv-2", suspect_id: venkateshId, suspect_label: "Venkatesh Prasad", camera_id: "CAM-CDD-NH16-01", camera_name: "Chirala NH-16 Toll Plaza Camera", camera_lat: 15.818, camera_lon: 80.352, detection_timestamp: "2024-01-02T15:05:00", confidence_score: 0.87, matched_tower_id: "TWR-CDD-001", correlation_status: "CONFIRMED", notes: "Subject detected at Chirala toll gate simultaneous with CDR tower TWR-CDD-001 co-location event", frame_image_path: "/cctv/cctv-2.jpg" });
    list.push({ id: "cctv-3", suspect_id: kalyanId, suspect_label: "Kalyan Chakravarthy", camera_id: "CAM-ONG-BUS-01", camera_name: "Ongole APSRTC Bus Stand", camera_lat: 15.5042, camera_lon: 80.0465, detection_timestamp: "2024-01-05T02:19:00", confidence_score: 0.79, matched_tower_id: "TWR-ONG-002", correlation_status: "CONFIRMED", notes: "Night-time detection correlates with IMEI swap at 02:13", frame_image_path: "/cctv/cctv-3.jpg" });

    return Promise.resolve(list as unknown as T);
  }

  // 16. GET /suspects (global registry watchlist)
  if (cleanPath === "/suspects" && (!options || options.method === "GET" || !options.method)) {
    const list: any[] = [];
    for (const [caseId, suspectsList] of Object.entries(memorySuspectsByCase)) {
      const c = memoryCases.find((x) => x.id === caseId);
      const caseName = c ? c.name : "Unknown Case";
      suspectsList.forEach((s) => {
        let baseScore = 15;
        let adjustment = 0;
        let finalScore = 15;
        let band = "LOW";
        let priorCount = 0;
        let cctvCount = 0;

        if (s.label === "Kalyan Chakravarthy") {
          baseScore = 72;
          adjustment = 20;
          finalScore = 92;
          band = "CRITICAL";
          priorCount = 2;
          cctvCount = 2;
        } else if (s.label === "Venkatesh Prasad") {
          baseScore = 55;
          adjustment = 8;
          finalScore = 63;
          band = "HIGH";
          priorCount = 1;
          cctvCount = 1;
        } else if (s.label === "Subba Rao") {
          baseScore = 41;
          adjustment = 0;
          finalScore = 41;
          band = "MEDIUM";
        }

        list.push({
          id: s.id,
          label: s.label,
          primary_msisdn: s.primary_msisdn,
          case_id: caseId,
          case_name: caseName,
          base_score: baseScore,
          adjustment: adjustment,
          final_score: finalScore,
          risk_band: band,
          risk_band_color: band === "CRITICAL" ? "red" : band === "HIGH" ? "orange" : band === "MEDIUM" ? "amber" : "green",
          prior_incidents_count: priorCount,
          cctv_matches_count: cctvCount,
          recommended_action: band === "CRITICAL" ? "Immediate escalation to SP/DIG level" : band === "HIGH" ? "Priority surveillance — daily reporting" : "Routine monitoring"
        });
      });
    }
    list.sort((a, b) => b.final_score - a.final_score);
    return Promise.resolve(list as unknown as T);
  }

  // 17. GET /cases/{id}/summary
  if (cleanPath.startsWith("/cases/") && cleanPath.endsWith("/summary")) {
    const caseId = cleanPath.split("/")[2];
    const c = memoryCases.find((x) => x.id === caseId);
    const name = c ? c.name : "Operation Ongole Tobacco Smuggling Syndicate";
    const suspectsList = memorySuspectsByCase[caseId] || [];
    const susCount = suspectsList.length;
    const narrative = (
      `Case analysis of ${name} identified ${susCount} suspects across 3 districts. ` +
      `Primary coordinator Kalyan Chakravarthy (HIGH RISK, Score: 92) shows 2 prior incidents ` +
      `and was physically confirmed at 3 CCTV locations. A common handler (+91-9888000111) ` +
      `was identified across suspects. Co-location events detected at TWR-ONG-001 (3 suspects) on 02 Jan 2024.`
    );
    return Promise.resolve({ narrative } as unknown as T);
  }

  // 18. GET /audit/logs
  if (cleanPath.startsWith("/audit/logs")) {
    const limit = parseInt(query.limit || "100", 10);
    const actionType = query.action_type || "";
    const now = new Date().toISOString();
    const mockLogs = [
      { id: "log-1", action_type: "ANALYSIS_RUN", entity_type: "Case", entity_id: memoryCases[0]?.id || "", entity_label: memoryCases[0]?.name || "Case 1", officer_ip: "192.168.1.100", officer_host: "localhost", detail: { engines_run: 5, events_generated: 17 }, timestamp: now },
      { id: "log-2", action_type: "CASE_CREATED", entity_type: "Case", entity_id: memoryCases[0]?.id || "", entity_label: memoryCases[0]?.name || "Case 1", officer_ip: "192.168.1.100", officer_host: "localhost", detail: {}, timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: "log-3", action_type: "CDR_UPLOADED", entity_type: "Suspect", entity_id: "", entity_label: "Kalyan Chakravarthy", officer_ip: "192.168.1.100", officer_host: "localhost", detail: { rows_inserted: 75 }, timestamp: new Date(Date.now() - 7200000).toISOString() },
      { id: "log-4", action_type: "IPDR_UPLOADED", entity_type: "Suspect", entity_id: "", entity_label: "Kalyan Chakravarthy", officer_ip: "192.168.1.100", officer_host: "localhost", detail: { rows_inserted: 42 }, timestamp: new Date(Date.now() - 7000000).toISOString() },
      { id: "log-5", action_type: "REPORT_GENERATED", entity_type: "Report", entity_id: "", entity_label: "Kalyan Chakravarthy", officer_ip: "192.168.1.100", officer_host: "localhost", detail: { format: "PDF", pages: 8 }, timestamp: new Date(Date.now() - 10800000).toISOString() },
      { id: "log-6", action_type: "ANALYSIS_RUN", entity_type: "Case", entity_id: memoryCases[1]?.id || "", entity_label: memoryCases[1]?.name || "Case 2", officer_ip: "192.168.1.100", officer_host: "localhost", detail: { engines_run: 5, events_generated: 17 }, timestamp: new Date(Date.now() - 14400000).toISOString() },
      { id: "log-7", action_type: "SUSPECT_ADDED", entity_type: "Suspect", entity_id: "", entity_label: "Ranga Reddy", officer_ip: "192.168.1.100", officer_host: "localhost", detail: {}, timestamp: new Date(Date.now() - 18000000).toISOString() },
    ];
    const filtered = actionType ? mockLogs.filter(l => l.action_type === actionType) : mockLogs;
    return Promise.resolve({ total: filtered.length, offset: 0, limit, logs: filtered.slice(0, limit) } as unknown as T);
  }

  return Promise.reject(new Error(`Endpoint not mock-supported: ${cleanPath}`));
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // On first request, determine if backend is reachable
  if (useMock === null) {
    const reachable = await checkBackend();
    useMock = !reachable;
    if (useMock) {
      console.warn("TRACE Backend not detected. Running in offline Demo Mode.");
    } else {
      console.log("TRACE Backend connected. Running in live mode.");
    }
  }

  if (useMock) {
    return handleMockRequest<T>(path, options);
  }

  // Include JWT token if available
  const token = localStorage.getItem("trace_token");
  const authHeaders = token ? { "Authorization": `Bearer ${token}` } : {};
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...authHeaders, ...options?.headers },
      ...options,
    });
    if (res.status === 401) {
      // Token expired or invalid — clear and redirect to login
      localStorage.removeItem("trace_token");
      localStorage.removeItem("trace_logged_in");
      window.location.reload();
      throw new Error("Session expired. Please login again.");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (e: any) {
    // Only fall back to mock on network errors (not HTTP errors)
    if (
      e.message?.includes("Failed to fetch") ||
      e.message?.includes("Load failed") ||
      e.message?.includes("NetworkError") ||
      e.message?.includes("Failed to connect") ||
      e.message?.includes("Session expired")
    ) {
      throw e; // Don't switch to mock — let the error propagate
    }
    throw e;
  }
}

export const api = {
  // Cases
  getCases: () => request<import("./types").CaseOut[]>("/cases"),
  createCase: (name: string) =>
    request<import("./types").CaseOut>("/cases", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  getCase: (id: string) => request<import("./types").CaseOut>(`/cases/${id}`),
  deleteCase: async (id: string) => {
    if (useMock) {
      const idx = memoryCases.findIndex((x) => x.id === id);
      if (idx !== -1) memoryCases.splice(idx, 1);
      delete memorySuspectsByCase[id];
      delete memoryNetworkByCase[id];
      delete memoryEventsByCase[id];
      delete memorySharedContactsByCase[id];
      return Promise.resolve();
    }
    try {
      const token = localStorage.getItem("trace_token");
      const authHeaders = token ? { "Authorization": `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/cases/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
    } catch (e: any) {
      throw e;
    }
  },

  // Upload
  uploadRecords: async (
    caseId: string,
    suspectLabel: string,
    cdrFile: File,
    ipdrFile?: File
  ): Promise<import("./types").UploadResponse> => {
    if (useMock) {
      const suspectId = "mock-suspect-" + Math.random().toString(36).substring(2, 11);
      const msisdn = "9199" + Math.floor(10000000 + Math.random() * 90000000);
      const newSuspect = {
        id: suspectId,
        case_id: caseId,
        label: suspectLabel,
        primary_msisdn: msisdn,
        anomaly_score: Math.random() * 40 + 35,
        event_count: 3,
      };

      if (!memorySuspectsByCase[caseId]) {
        memorySuspectsByCase[caseId] = [];
      }
      memorySuspectsByCase[caseId].push(newSuspect);

      // Update case stats
      const c = memoryCases.find((x) => x.id === caseId);
      if (c) {
        c.suspect_count = (c.suspect_count || 0) + 1;
        c.event_count = (c.event_count || 0) + 3;
      }

      // Initialize profiles
      memorySuspectProfiles[suspectId] = {
        suspect: newSuspect,
        cdr_summary: {
          total_calls: 38,
          total_sms: 12,
          unique_contacts: 8,
          avg_duration_sec: 132.5,
          night_call_ratio: 0.15,
          burst_score: 2.1,
          anomaly_score: newSuspect.anomaly_score,
        },
        ipdr_summary: {
          total_sessions: 64,
          total_data_kb: 32050.4,
          ott_breakdown: [
            { app: "WhatsApp", session_count: 40, total_data_kb: 21000.2, first_seen: new Date().toISOString(), last_seen: new Date().toISOString() },
            { app: "Signal", session_count: 24, total_data_kb: 11050.2, first_seen: new Date().toISOString(), last_seen: new Date().toISOString() },
          ],
        },
        events: [
          { id: suspectId + "-ev1", case_id: caseId, event_type: "ANOMALY", severity: "HIGH", involved_suspects: [suspectLabel], detail: { anomaly_score: newSuspect.anomaly_score }, occurred_at: new Date().toISOString() },
          { id: suspectId + "-ev2", case_id: caseId, event_type: "IMEI_SWAP", severity: "HIGH", involved_suspects: [suspectLabel], detail: { old_imei: "860124039485712", new_imei: "860124039485999" }, occurred_at: new Date().toISOString() },
          { id: suspectId + "-ev3", case_id: caseId, event_type: "OTT_USAGE", severity: "LOW", involved_suspects: [suspectLabel], detail: { app: "Signal encrypted tunnel" }, occurred_at: new Date().toISOString() },
        ],
        call_heatmap_data: [
          { day_of_week: 1, hour_of_day: 10, call_count: 4 },
          { day_of_week: 2, hour_of_day: 15, call_count: 9 },
          { day_of_week: 4, hour_of_day: 22, call_count: 12 },
        ],
        movement_data: [
          { tower_id: "TWR-ONG-001", lat: 15.5057, lon: 80.0499, timestamp: new Date().toISOString(), co_location: false, co_location_with: [] },
          { tower_id: "TWR-ONG-002", lat: 15.5120, lon: 80.0620, timestamp: new Date().toISOString(), co_location: true, co_location_with: ["Target Handler B"] },
        ],
      };

      memoryMovementBySuspect[suspectId] = memorySuspectProfiles[suspectId].movement_data;
      memoryHeatmapBySuspect[suspectId] = memorySuspectProfiles[suspectId].call_heatmap_data;

      // Update events list
      if (!memoryEventsByCase[caseId]) memoryEventsByCase[caseId] = [];
      memoryEventsByCase[caseId].unshift(...memorySuspectProfiles[suspectId].events);

      // Update network nodes & edges
      if (!memoryNetworkByCase[caseId]) memoryNetworkByCase[caseId] = { nodes: [], edges: [] };
      memoryNetworkByCase[caseId].nodes.push({ id: suspectId, label: suspectLabel, node_type: "suspect", suspect_id: suspectId });
      if (memoryNetworkByCase[caseId].nodes.length > 1) {
        // connect to the first suspect
        const targetId = memoryNetworkByCase[caseId].nodes[0].id;
        if (targetId !== suspectId) {
          memoryNetworkByCase[caseId].edges.push({ source: suspectId, target: targetId, call_count: 5, total_duration_sec: 420 });
        }
      }

      return Promise.resolve({ suspect_id: suspectId, rows_inserted_cdr: 50, rows_inserted_ipdr: 64 });
    }

    const form = new FormData();
    form.append("suspect_label", suspectLabel);
    form.append("cdr_file", cdrFile);
    if (ipdrFile) form.append("ipdr_file", ipdrFile);
    try {
      const token = localStorage.getItem("trace_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/cases/${caseId}/upload`, {
        method: "POST",
        headers,
        body: form,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(e.detail || `HTTP ${res.status}`);
      }
      return res.json() as Promise<import("./types").UploadResponse>;
    } catch (e: any) {
      throw e;
    }
  },

  // Analysis
  runAnalysis: (caseId: string) =>
    request<import("./types").AnalysisSummary>(`/cases/${caseId}/analyze`, {
      method: "POST",
    }),

  // Events
  getEvents: (caseId: string, eventType?: string, severity?: string) => {
    const params = new URLSearchParams();
    if (eventType) params.set("event_type", eventType);
    if (severity) params.set("severity", severity);
    const qs = params.toString() ? `?${params}` : "";
    return request<import("./types").EventOut[]>(`/cases/${caseId}/events${qs}`);
  },

  // Network
  getNetwork: (caseId: string) =>
    request<import("./types").NetworkGraphOut>(`/cases/${caseId}/network`),

  // Suspects
  getSuspects: (caseId: string) =>
    request<import("./types").SuspectOut[]>(`/cases/${caseId}/suspects`),

  getSuspectProfile: (suspectId: string) =>
    request<import("./types").SuspectProfileOut>(`/suspects/${suspectId}/profile`),

  getMovement: (suspectId: string) =>
    request<import("./types").MovementPoint[]>(`/suspects/${suspectId}/movement`),

  getCallHeatmap: (suspectId: string) =>
    request<import("./types").CallHeatmapRow[]>(`/suspects/${suspectId}/call_heatmap`),

  deleteSuspect: async (id: string): Promise<void> => {
    if (useMock) {
      // Find case ID
      let foundCaseId = "";
      for (const [cid, list] of Object.entries(memorySuspectsByCase)) {
        const found = list.find((s) => s.id === id);
        if (found) {
          foundCaseId = cid;
          memorySuspectsByCase[cid] = list.filter((s) => s.id !== id);
          break;
        }
      }

      // Update case stats
      if (foundCaseId) {
        const c = memoryCases.find((x) => x.id === foundCaseId);
        if (c) {
          c.suspect_count = Math.max(0, (c.suspect_count || 0) - 1);
        }
        if (memoryNetworkByCase[foundCaseId]) {
          memoryNetworkByCase[foundCaseId].nodes = memoryNetworkByCase[foundCaseId].nodes.filter((n: any) => n.id !== id);
          memoryNetworkByCase[foundCaseId].edges = memoryNetworkByCase[foundCaseId].edges.filter((e: any) => e.source !== id && e.target !== id);
        }
      }

      delete memorySuspectProfiles[id];
      delete memoryMovementBySuspect[id];
      delete memoryHeatmapBySuspect[id];
      return Promise.resolve();
    }

    try {
      const token = localStorage.getItem("trace_token");
      const authHeaders = token ? { "Authorization": `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/suspects/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
    } catch (e: any) {
      throw e;
    }
  },

  getSharedContacts: (caseId: string) =>
    request<import("./types").SharedContact[]>(`/cases/${caseId}/shared-contacts`),

  getGlobalHandlers: () =>
    request<{ number: string; case_count: number; total_calls: number }[]>("/global/handler-numbers"),

  // Geo Intel — Radial Search
  radialSearch: (
    caseId: string,
    centerLat: number,
    centerLon: number,
    radiusKm: number,
    startTime?: string,
    endTime?: string
  ) => {
    if (useMock) {
      return Promise.resolve({
        query: { center_lat: centerLat, center_lon: centerLon, radius_km: radiusKm },
        hits: [],
        suspects_found: [],
        total_hits: 0,
      });
    }
    return request<{
      query: Record<string, unknown>;
      hits: {
        suspect_id: string;
        suspect_label: string;
        msisdn: string;
        tower_id: string;
        tower_lat: number;
        tower_lon: number;
        distance_km: number;
        timestamp: string;
        call_type: string;
        duration_sec: number | null;
      }[];
      suspects_found: string[];
      total_hits: number;
    }>(`/cases/${caseId}/radial-search`, {
      method: "POST",
      body: JSON.stringify({
        center_lat: centerLat,
        center_lon: centerLon,
        radius_km: radiusKm,
        start_time: startTime || null,
        end_time: endTime || null,
      }),
    });
  },

  // Audit Trail
  getAuditLogs: (limit = 100, actionType?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (actionType) params.set("action_type", actionType);
    return request<{
      total: number;
      offset: number;
      limit: number;
      logs: {
        id: string;
        action_type: string;
        entity_type: string;
        entity_id: string | null;
        entity_label: string | null;
        officer_ip: string | null;
        officer_host: string | null;
        detail: Record<string, unknown>;
        timestamp: string;
      }[];
    }>(`/audit/logs?${params.toString()}`);
  },

  // Report PDF
  getReportUrl: (suspectId: string) => {
    if (useMock) {
      return dummyPdfBase64;
    }
    return `${API_BASE}/suspects/${suspectId}/report.pdf`;
  },

  getRecidivism: (suspectId: string) =>
    request<any>(`/suspects/${suspectId}/recidivism`),

  getSuspectCctv: async (suspectId: string) => {
    const list = await request<any[]>(`/suspects/${suspectId}/cctv`);
    return list.map(d => ({
      ...d,
      frame_image_path: d.frame_image_path ? (d.frame_image_path.startsWith('http') || d.frame_image_path.startsWith('data:') || d.frame_image_path.startsWith('/cctv/') ? d.frame_image_path : `${API_BASE}${d.frame_image_path}`) : null
    }));
  },

  getCaseCctv: async (caseId: string) => {
    const list = await request<any[]>(`/cases/${caseId}/cctv`);
    return list.map(d => ({
      ...d,
      frame_image_path: d.frame_image_path ? (d.frame_image_path.startsWith('http') || d.frame_image_path.startsWith('data:') || d.frame_image_path.startsWith('/cctv/') ? d.frame_image_path : `${API_BASE}${d.frame_image_path}`) : null
    }));
  },

  getCctvTimeline: async (caseId: string) => {
    const list = await request<any[]>(`/cctv/timeline?case_id=${caseId}`);
    return list.map(d => ({
      ...d,
      frame_image_path: d.frame_image_path ? (d.frame_image_path.startsWith('http') || d.frame_image_path.startsWith('data:') || d.frame_image_path.startsWith('/cctv/') ? d.frame_image_path : `${API_BASE}${d.frame_image_path}`) : null
    }));
  },

  listAllSuspects: () =>
    request<any[]>("/suspects"),

  getCaseSummary: (caseId: string) =>
    request<{ narrative: string }>(`/cases/${caseId}/summary`),

  isMockMode: () => useMock,

  // Templates — generate client-side in mock mode, use API when backend available
  getCdrTemplateUrl: () => {
    if (useMock) {
      const csv = "msisdn_a,msisdn_b,imei,tower_id,tower_lat,tower_lon,call_type,duration_sec,timestamp\n";
      return URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    }
    return `${API_BASE}/templates/cdr`;
  },
  getIpdrTemplateUrl: () => {
    if (useMock) {
      const csv = "msisdn,dest_ip,dest_port,data_volume_kb,timestamp\n";
      return URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    }
    return `${API_BASE}/templates/ipdr`;
  },
};
