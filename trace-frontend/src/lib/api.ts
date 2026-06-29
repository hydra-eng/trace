const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 
      "Content-Type": "application/json", 
      ...authHeaders,
      ...options?.headers 
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
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
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}/cases/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
  },

  // Upload
  uploadRecords: async (
    caseId: string,
    suspectLabel: string,
    cdrFile: File,
    ipdrFile?: File
  ): Promise<import("./types").UploadResponse> => {
    const form = new FormData();
    form.append("suspect_label", suspectLabel);
    form.append("cdr_file", cdrFile);
    if (ipdrFile) form.append("ipdr_file", ipdrFile);
    
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}/cases/${caseId}/upload`, {
      method: "POST",
      body: form,
      headers,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(e.detail || `HTTP ${res.status}`);
    }
    return res.json() as Promise<import("./types").UploadResponse>;
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
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}/suspects/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
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
    const token = localStorage.getItem("token");
    return `${API_BASE}/suspects/${suspectId}/report.pdf${token ? `?token=${token}` : ""}`;
  },

  login: async (username: string, password: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Invalid credentials");
    }
    return res.json();
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

  isMockMode: () => false,

  // Templates
  getCdrTemplateUrl: () => `${API_BASE}/templates/cdr`,
  getIpdrTemplateUrl: () => `${API_BASE}/templates/ipdr`,

  // ── Section 65B Certificate Worksheet ─────────────────────────────────────
  getDocumentStatus: (caseId: string) =>
    request<{
      case_id: string;
      document_status: string;
      reviewed_by_user_id: string | null;
      reviewed_at: string | null;
    }>(`/cases/${caseId}/document-status`),

  markCaseReviewed: (caseId: string) =>
    request<{
      case_id: string;
      document_status: string;
      reviewed_by_user_id: string;
      reviewed_at: string;
      message: string;
    }>(`/cases/${caseId}/mark-reviewed`, { method: "POST" }),

  exportCertWorksheet: async (caseId: string): Promise<Blob> => {
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/cases/${caseId}/export-certificate-worksheet`, {
      method: "POST",
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.blob();
  },
};
