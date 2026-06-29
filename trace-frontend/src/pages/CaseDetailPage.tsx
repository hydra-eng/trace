import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useRole } from "../lib/auth";
import type { CaseOut, EventOut, SuspectOut } from "../lib/types";
import SuspectCard from "../components/SuspectCard";
import NetworkGraph from "../components/NetworkGraph";
import DocumentStatusBadge from "../components/DocumentStatusBadge";
import CertWorksheetModal from "../components/CertWorksheetModal";
import { Upload, Play, Loader2, AlertTriangle, Users, Activity, Phone, Camera, Eye, X, FileText } from "lucide-react";

type TabType = "network" | "events" | "suspects";

const videoMapping: Record<string, string> = {
  "CAM-ONG-MKT-01": "/cctv/traffic-video-1.mp4",
  "CAM-CDD-NH16-01": "/cctv/traffic-video-2.mp4",
  "CAM-ONG-BUS-01": "/cctv/traffic-video-3.mp4",
};

function SeverityBadge({ sev }: { sev: string }) {
  if (sev === "HIGH") return <span className="badge-high">{sev}</span>;
  if (sev === "MEDIUM") return <span className="badge-medium">{sev}</span>;
  return <span className="badge-low">{sev}</span>;
}

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function eventSummary(ev: EventOut): string {
  const d = ev.detail;
  if (ev.event_type === "IMEI_SWAP") return `IMEI changed: ${d.old_imei} → ${d.new_imei}`;
  if (ev.event_type === "CO_LOCATION") return `Tower ${d.tower_id} — ${(d.suspects_present as string[]).join(", ")}`;
  if (ev.event_type === "COMMON_CONTACT") return `Shared number: ${d.common_number}`;
  if (ev.event_type === "ANOMALY") return `Score ${Number(d.anomaly_score).toFixed(3)} — ${(d.triggered_features as string[]).join(", ")}`;
  if (ev.event_type === "OTT_USAGE") return `${d.app} — ${d.session_count} sessions, ${Number(d.total_data_kb).toFixed(0)} KB`;
  return JSON.stringify(d).slice(0, 80);
}

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const role = useRole();

  const [caseData, setCaseData] = useState<CaseOut | null>(null);
  const [suspects, setSuspects] = useState<SuspectOut[]>([]);
  const [events, setEvents] = useState<EventOut[]>([]);
  const [sharedContacts, setSharedContacts] = useState<import("../lib/types").SharedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState("");
  const [tab, setTab] = useState<TabType>("network");
  const [filterType, setFilterType] = useState("");
  const [filterSev, setFilterSev] = useState("");
  const [error, setError] = useState("");

  const [cctvDetections, setCctvDetections] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<{ narrative: string } | null>(null);
  const [selectedCctv, setSelectedCctv] = useState<any | null>(null);

  // Section 65B document state
  const [docStatus, setDocStatus] = useState<string>("DRAFT");
  const [reviewedBy, setReviewedBy] = useState<string | null>(null);
  const [reviewedAt, setReviewedAt] = useState<string | null>(null);
  const [showWorksheetModal, setShowWorksheetModal] = useState(false);

  const load = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const [c, s, e, sc, cctv, summary] = await Promise.all([
        api.getCase(caseId),
        api.getSuspects(caseId),
        api.getEvents(caseId),
        api.getSharedContacts(caseId).catch(() => []),
        api.getCaseCctv(caseId).catch(() => []),
        api.getCaseSummary(caseId).catch(() => null),
      ]);
      setCaseData(c);
      setSuspects(s);
      setEvents(e);
      setSharedContacts(sc);
      setCctvDetections(cctv);
      setSummaryData(summary);
      // Load document status (may come from getCase or dedicated endpoint)
      setDocStatus(c.document_status ?? "DRAFT");
      setReviewedBy(c.reviewed_by_user_id ?? null);
      setReviewedAt(c.reviewed_at ?? null);
    } catch {
      setError("Failed to load case data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [caseId]);

  const handleAnalyze = async () => {
    if (!caseId) return;
    setAnalyzing(true);
    setAnalyzeMsg("");
    try {
      const res = await api.runAnalysis(caseId);
      setAnalyzeMsg(`Analysis complete. ${res.events_generated} events generated.`);
      load();
    } catch (err: unknown) {
      setAnalyzeMsg(`Error: ${String(err)}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (filterType && ev.event_type !== filterType) return false;
    if (filterSev && ev.severity !== filterSev) return false;
    return true;
  });

  const highCount = events.filter((e) => e.severity === "HIGH").length;
  const commonContacts = sharedContacts.length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500 mb-2" />
        <span className="text-sm text-zinc-500">Loading case details...</span>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3rem)]">
        <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
        <span className="text-sm text-red-500">{error || "Case not found."}</span>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 pr-2">{caseData.name}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Created {new Date(caseData.created_at).toLocaleDateString("en-IN")} · ID: {caseId?.slice(0, 8)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Section 65B document status badge */}
          {caseData && (
            <DocumentStatusBadge
              status={docStatus}
              reviewedBy={reviewedBy}
              reviewedAt={reviewedAt}
            />
          )}

          {role !== "viewer" && (
            <button
              id="btn-export-65b-worksheet"
              onClick={() => setShowWorksheetModal(true)}
              className="flex items-center gap-2 px-3 py-2 border border-indigo-200 bg-indigo-50 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <FileText size={13} />
              65B Worksheet
            </button>
          )}

          {role !== "viewer" && (
            <button
              id="btn-upload-records"
              onClick={() => navigate(`/cases/${caseId}/upload`)}
              className="flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              <Upload size={14} />
              Upload Records
            </button>
          )}
          {role !== "viewer" && (
            <button
              id="btn-run-analysis"
              onClick={handleAnalyze}
              disabled={analyzing || suspects.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 transition-colors ring-1 ring-indigo-700 ring-offset-1"
            >
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {analyzing ? "Analyzing…" : "Run Analysis"}
            </button>
          )}
        </div>
      </div>

      {/* Section 65B Worksheet Modal */}
      {showWorksheetModal && caseData && (
        <CertWorksheetModal
          caseId={caseId!}
          caseName={caseData.name}
          documentStatus={docStatus}
          reviewedBy={reviewedBy}
          reviewedAt={reviewedAt}
          userRole={role}
          onClose={() => setShowWorksheetModal(false)}
          onStatusChange={(newStatus) => {
            setDocStatus(newStatus);
            if (newStatus === "OFFICER_REVIEWED") {
              // Fetch fresh reviewer info from server
              api.getDocumentStatus(caseId!).then((res) => {
                setReviewedBy(res.reviewed_by_user_id);
                setReviewedAt(res.reviewed_at);
              }).catch(() => {});
            }
          }}
        />
      )}

      {analyzeMsg && (
        <div className={`mb-4 p-3 rounded-lg text-sm border ${analyzeMsg.startsWith("Error") ? "bg-red-50 border-red-200 text-red-700" : "bg-zinc-50 border-zinc-200 text-zinc-700"}`}>
          {analyzeMsg}
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Suspects", value: suspects.length, icon: Users, color: "border-l-indigo-600" },
          { label: "Total Events", value: events.length, icon: Activity, color: "border-l-indigo-600" },
          { label: "High Severity", value: highCount, icon: AlertTriangle, alert: highCount > 0, color: "border-l-indigo-600" },
          { label: "Common Contacts", value: commonContacts, icon: Phone, color: "border-l-indigo-600" },
          {
            label: "CCTV Matches",
            value: cctvDetections.filter(d => d.correlation_status === "CONFIRMED").length,
            icon: Camera,
            sub: `${new Set(cctvDetections.filter(d => d.correlation_status === "CONFIRMED").map(d => d.camera_id)).size} cameras · ${new Set(cctvDetections.filter(d => d.correlation_status === "CONFIRMED").map(d => d.suspect_id)).size} suspects`,
            color: cctvDetections.filter(d => d.correlation_status === "CONFIRMED").length > 0 ? "border-l-green-600" : "border-l-zinc-300",
            valueColor: cctvDetections.filter(d => d.correlation_status === "CONFIRMED").length > 0 ? "text-green-700 bg-green-50 px-2 py-0.5 rounded" : "text-zinc-900"
          }
        ].map(({ label, value, icon: Icon, alert, sub, color, valueColor }) => (
          <div key={label} className={`card border-l-2 ${color}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500">{label}</span>
              <Icon size={14} className={alert ? "text-red-500" : "text-zinc-400"} />
            </div>
            <span className={`text-2xl font-semibold ${valueColor || (alert && value > 0 ? "text-red-600 bg-red-50 px-2 py-0.5 rounded" : "text-zinc-900")}`}>
              {value}
            </span>
            {sub && <p className="text-[9px] text-zinc-400 mt-1 font-medium truncate">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Intelligence Summary Narrative */}
      {summaryData && (
        <div className="mb-6 card p-4">
          <span className="text-[11px] uppercase tracking-wide text-zinc-400 font-semibold block mb-1">
            Intelligence Summary
          </span>
          <blockquote className="border-l-[3px] border-indigo-600 bg-indigo-50/30 pl-3 py-1.5 text-xs italic text-slate-600 leading-relaxed rounded-r font-medium">
            {summaryData.narrative}
          </blockquote>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-200 mb-6">
        <div className="flex gap-0">
          {(["network", "events", "suspects"] as TabType[]).map((t) => (
            <button
              key={t}
              id={`tab-${t}`}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                tab === t
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Network tab */}
      {tab === "network" && (
        <div className="card" style={{ height: "520px" }}>
          {caseId && <NetworkGraph caseId={caseId} suspects={suspects} />}
        </div>
      )}

      {/* Events tab */}
      {tab === "events" && (
        <div className="card">
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <select
              id="filter-event-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm text-zinc-700 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
            >
              <option value="">All Types</option>
              {["IMEI_SWAP", "CO_LOCATION", "COMMON_CONTACT", "ANOMALY", "OTT_USAGE"].map((t) => (
                <option key={t} value={t}>{t.replace("_", " ")}</option>
              ))}
            </select>
            <select
              id="filter-severity"
              value={filterSev}
              onChange={(e) => setFilterSev(e.target.value)}
              className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm text-zinc-700 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
            >
              <option value="">All Severities</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
            <span className="text-xs text-zinc-400 self-center ml-auto">{filteredEvents.length} events</span>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-sm">
              {events.length === 0 ? "No events yet. Run analysis to generate intelligence." : "No events match the current filters."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-400 border-b border-zinc-100">
                  <th className="pb-2 font-medium w-24">Severity</th>
                  <th className="pb-2 font-medium w-36">Type</th>
                  <th className="pb-2 font-medium">Suspects</th>
                  <th className="pb-2 font-medium">Summary</th>
                  <th className="pb-2 font-medium w-36 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="table-row-divider">
                    <td className="py-2.5 pr-3"><SeverityBadge sev={ev.severity} /></td>
                    <td className="py-2.5 pr-3 text-zinc-700 font-mono text-xs">{ev.event_type}</td>
                    <td className="py-2.5 pr-3 text-zinc-600 text-xs">{ev.involved_suspects.join(", ")}</td>
                    <td className="py-2.5 pr-3 text-zinc-700 text-xs">{eventSummary(ev)}</td>
                    <td className="py-2.5 text-zinc-400 text-xs text-right">{formatDate(ev.occurred_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* CCTV Detection Timeline */}
          {cctvDetections.length > 0 && (
            <div className="mt-8 border-t border-[rgba(67,56,202,0.08)] pt-6">
              <h3 className="text-xs font-semibold text-zinc-700 mb-4 uppercase tracking-wide flex items-center gap-1.5">
                📷 CCTV Detection Timeline
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-zinc-400 border-b border-[rgba(67,56,202,0.08)]">
                      <th className="pb-2 font-medium w-24">Status</th>
                      <th className="pb-2 font-medium w-36">Suspect</th>
                      <th className="pb-2 font-medium">Camera / Location</th>
                      <th className="pb-2 font-medium">Face Match</th>
                      <th className="pb-2 font-medium">CDR Correlation</th>
                      <th className="pb-2 font-medium w-36 text-right">Timestamp</th>
                      <th className="pb-2 font-medium w-24 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cctvDetections.map((d) => (
                      <tr key={d.id} className="table-row-divider text-xs">
                        <td className="py-2.5 pr-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            d.correlation_status === 'CONFIRMED'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : d.correlation_status === 'PROBABLE'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {d.correlation_status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 font-semibold text-zinc-800">{d.suspect_label}</td>
                        <td className="py-2.5 pr-3 text-zinc-700 font-medium">
                          {d.camera_name} <span className="text-zinc-400 font-mono text-[10px]">({d.camera_id})</span>
                        </td>
                        <td className="py-2.5 pr-3 text-emerald-700 font-semibold">{Math.round(d.confidence_score * 100)}% conf</td>
                        <td className="py-2.5 pr-3 text-zinc-600 font-medium">
                          Tower {d.matched_tower_id} {d.notes ? `(${d.notes.split('—')[1]?.trim() || d.notes.split('before')[1]?.trim() || d.notes})` : ""}
                        </td>
                        <td className="py-2.5 text-zinc-400 text-right">
                          {formatDate(d.detection_timestamp)}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => setSelectedCctv(d)}
                            className="inline-flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-100 transition-colors cursor-pointer font-semibold"
                          >
                            <Eye size={10} />
                            View Frame
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suspects tab */}
      {tab === "suspects" && (
        <div>
          {suspects.length === 0 ? (
            <div className="card text-center py-12 text-zinc-400 text-sm">
              No suspects yet.{" "}
              <button onClick={() => navigate(`/cases/${caseId}/upload`)} className="text-zinc-900 underline">
                Upload records
              </button>{" "}
              to add suspects.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-4">
                {suspects.map((s) => (
                  <SuspectCard
                    key={s.id}
                    suspect={s}
                    events={events}
                    onDelete={(id) => {
                      setSuspects((prev) => prev.filter((item) => item.id !== id));
                      // Re-load case detail to update metrics/graph/events
                      load();
                    }}
                  />
                ))}
              </div>

              {sharedContacts.length > 0 && (
                <div className="mt-8 bg-white border border-zinc-200 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-zinc-900">⚠ Shared Handler Numbers ({sharedContacts.length})</span>
                  </div>
                  <p className="text-xs text-zinc-500 mb-4">
                    Numbers appearing in CDRs of multiple suspects — potential coordinators or handlers.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr className="text-xs text-zinc-400 border-b border-zinc-100 pb-2">
                          <th className="pb-2 font-medium">Number</th>
                          <th className="pb-2 font-medium">Appears In</th>
                          <th className="pb-2 font-medium">Total Calls</th>
                          <th className="pb-2 font-medium text-right">Risk Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sharedContacts.map((c, i) => (
                          <tr key={i} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                            <td className="py-3">
                              <span className="font-mono bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded text-xs">
                                {c.number}
                              </span>
                            </td>
                            <td className="py-3 text-zinc-600 text-xs">{c.suspects.join(', ')}</td>
                            <td className="py-3 text-zinc-600 text-xs">{c.total_calls} calls</td>
                            <td className="py-3 text-right">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                c.suspect_count >= 3
                                  ? 'bg-red-50 text-red-700 ring-1 ring-red-600/10'
                                  : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10'
                              }`}>
                                {c.suspect_count >= 3 ? 'HIGH' : 'MEDIUM'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CCTV Frame Modal */}
      {selectedCctv && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden max-w-lg w-full text-white shadow-2xl relative">
            <button 
              onClick={() => setSelectedCctv(null)} 
              className="absolute top-3 right-3 text-zinc-400 hover:text-white transition-colors cursor-pointer p-1 rounded-full hover:bg-zinc-800"
            >
              <X size={18} />
            </button>
            <div className="p-5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-semibold tracking-wider font-mono text-zinc-100">CCTV FEED CAPTURE</h3>
              </div>
              <p className="text-xs text-zinc-400 mt-1">{selectedCctv.camera_name} ({selectedCctv.camera_id})</p>
            </div>
            <div className="p-6 flex flex-col items-center gap-4 bg-zinc-950">
              <div className="w-[380px] max-w-full aspect-[4/3] rounded-lg overflow-hidden border border-zinc-800 relative bg-zinc-900 flex items-center justify-center">
                {videoMapping[selectedCctv.camera_id] ? (
                  <div className="w-full h-full relative">
                    <video 
                      src={videoMapping[selectedCctv.camera_id]} 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      className="w-full h-full object-cover opacity-85" 
                    />
                    {/* Bounding box on the live video */}
                    <div className="absolute border-2 border-red-500 rounded-sm animate-pulse" style={
                      selectedCctv.camera_id === "CAM-ONG-MKT-01" ? { top: "28%", left: "38%", width: "22%", height: "32%" } :
                      selectedCctv.camera_id === "CAM-CDD-NH16-01" ? { top: "22%", left: "42%", width: "20%", height: "35%" } :
                      { top: "25%", left: "35%", width: "25%", height: "38%" }
                    }>
                      <div className="absolute -top-4 left-0 text-[8px] font-mono font-bold px-1 py-0.2 bg-red-500 text-white whitespace-nowrap shadow">
                        MATCH: {selectedCctv.suspect_label || "Suspect"} ({Math.round(selectedCctv.confidence_score * 100)}%)
                      </div>
                    </div>
                  </div>
                ) : selectedCctv.frame_image_path ? (
                  <img 
                    src={selectedCctv.frame_image_path} 
                    alt="CCTV Capture Frame" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLElement).parentElement;
                      if (parent) {
                        const pl = document.createElement('div');
                        pl.className = "flex items-center justify-center w-full h-full text-zinc-600 font-bold text-xs font-mono";
                        pl.innerText = "CCTV FRAME UNSTABLE";
                        parent.appendChild(pl);
                      }
                    }}
                  />
                ) : (
                  <div className="text-zinc-600 font-bold text-xs font-mono">NO CCTV FRAME SIGNAL</div>
                )}
              </div>
            </div>
            <div className="p-5 space-y-3 text-xs border-t border-zinc-800 bg-zinc-900">
              <div className="flex justify-between">
                <span className="text-zinc-400">Suspect Label</span>
                <span className="font-semibold text-zinc-200">{selectedCctv.suspect_label || "Unknown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Timestamp</span>
                <span className="font-mono text-zinc-200">{formatDate(selectedCctv.detection_timestamp)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Face Match Confidence</span>
                <span className="text-emerald-400 font-bold font-mono">{Math.round(selectedCctv.confidence_score * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Geospatial Coordinates</span>
                <span className="font-mono text-zinc-300">{selectedCctv.camera_lat.toFixed(4)}, {selectedCctv.camera_lon.toFixed(4)}</span>
              </div>
              <div className="pt-2 border-t border-zinc-800">
                <span className="text-zinc-400 block font-semibold mb-1">CDR CORRELATION ANALYSIS</span>
                <p className="text-zinc-300 text-[11px] leading-relaxed">
                  Mapped to cell tower <span className="font-mono text-indigo-400">{selectedCctv.matched_tower_id}</span>. {selectedCctv.notes}
                </p>
              </div>
            </div>
            <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex justify-end">
              <button 
                onClick={() => setSelectedCctv(null)} 
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs transition-colors cursor-pointer"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
