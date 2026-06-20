const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
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
  deleteCase: (id: string) =>
    fetch(`${API_BASE}/cases/${id}`, {
      method: "DELETE",
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
    }),

  // Upload
  uploadRecords: (
    caseId: string,
    suspectLabel: string,
    cdrFile: File,
    ipdrFile?: File
  ) => {
    const form = new FormData();
    form.append("suspect_label", suspectLabel);
    form.append("cdr_file", cdrFile);
    if (ipdrFile) form.append("ipdr_file", ipdrFile);
    return fetch(`${API_BASE}/cases/${caseId}/upload`, {
      method: "POST",
      body: form,
    }).then(async (r) => {
      if (!r.ok) {
        const e = await r.json().catch(() => ({ detail: r.statusText }));
        throw new Error(e.detail || `HTTP ${r.status}`);
      }
      return r.json() as Promise<import("./types").UploadResponse>;
    });
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

  deleteSuspect: (id: string) =>
    fetch(`${API_BASE}/suspects/${id}`, {
      method: "DELETE",
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
    }),

  getSharedContacts: (caseId: string) =>
    request<import("./types").SharedContact[]>(`/cases/${caseId}/shared-contacts`),

  // Report PDF
  getReportUrl: (suspectId: string) => `${API_BASE}/suspects/${suspectId}/report.pdf`,

  // Templates
  getCdrTemplateUrl: () => `${API_BASE}/templates/cdr`,
  getIpdrTemplateUrl: () => `${API_BASE}/templates/ipdr`,
};

