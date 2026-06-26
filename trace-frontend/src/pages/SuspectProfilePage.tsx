import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import type { SuspectProfileOut } from "../lib/types";
import CallCalendar from "../components/CallCalendar";
import MovementMap from "../components/MovementMap";
import { Download, AlertTriangle, CheckCircle, Eye, X, Loader2 } from "lucide-react";
import { generatePdfReport } from "../lib/generatePdfReport";

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

function MetricBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-zinc-400 uppercase tracking-wide">{label}</span>
      <span className="text-[15px] font-semibold text-zinc-900">{value}</span>
    </div>
  );
}

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eventSummary(ev: { event_type: string; detail: Record<string, unknown> }): string {
  const d = ev.detail;
  if (ev.event_type === "IMEI_SWAP") return `IMEI changed: ${d.old_imei} → ${d.new_imei}`;
  if (ev.event_type === "CO_LOCATION") return `Tower ${d.tower_id}`;
  if (ev.event_type === "COMMON_CONTACT") return `Shared: ${d.common_number}`;
  if (ev.event_type === "ANOMALY") return `Score: ${Number(d.anomaly_score).toFixed(3)}`;
  if (ev.event_type === "OTT_USAGE") return `${d.app}`;
  if (ev.event_type === "MULTI_SIM_IMEI") return `Burner Handset (IMEI: ${d.imei}) used with ${d.sim_count} SIMs`;
  if (ev.event_type === "CROSS_CASE_HANDLER") return `Global linkage: contact ${d.handler_number} appears in ${d.case_count} cases`;
  if (ev.event_type === "TOWER_SILENCE") return `Radio-silent for ${d.gap_hours} hrs. Last seen tower: ${d.last_seen_tower}`;
  if (ev.event_type === "NIGHT_CALL_BURST") return `Nocturnal burst: ${d.call_count} calls on ${d.night_date}`;
  if (ev.event_type === "LOOP_CALL") return `Urgent loop coordination: ${d.call_count_in_window} calls in ${d.window_minutes} mins`;
  return "—";
}

export default function SuspectProfilePage() {
  const { suspectId } = useParams<{ suspectId: string }>();
  const [profile, setProfile] = useState<SuspectProfileOut | null>(null);
  const [cctvDetections, setCctvDetections] = useState<any[]>([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState("");
  const [selectedCctv, setSelectedCctv] = useState<any | null>(null);

  useEffect(() => {
    if (!suspectId) return;
    setApiLoading(true);
    setMapReady(false);
    Promise.all([
      api.getSuspectProfile(suspectId),
      api.getSuspectCctv(suspectId).catch(() => [])
    ])
      .then(([prof, cctv]) => {
        setProfile(prof);
        setCctvDetections(cctv);
      })
      .catch(() => setError("Failed to load suspect profile."))
      .finally(() => setApiLoading(false));
  }, [suspectId]);

  if (apiLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="text-xs text-zinc-400">← Back to Case</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="w-48 h-6 bg-slate-200 rounded animate-pulse" />
            <div className="w-32 h-3 bg-slate-100 rounded animate-pulse mt-2" />
          </div>
        </div>

        {/* Call Summary Skeleton */}
        <div className="card">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Call Summary</h2>
          <div className="grid grid-cols-6 gap-4 divide-x divide-zinc-100">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={`flex flex-col gap-2 ${i > 1 ? "pl-4" : ""}`}>
                <div className="w-24 h-3 bg-slate-100 rounded animate-pulse" />
                <div className="w-16 h-8 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap Skeleton */}
        <div className="card">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Call Activity Heatmap</h2>
          <div className="bg-slate-100 animate-pulse w-full h-[160px] rounded-lg" />
        </div>

        {/* Map Skeleton */}
        <div className="card">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Tower Movement</h2>
          <div className="bg-slate-100 animate-pulse w-full h-[200px] rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !profile) return <div className="p-8 text-red-600">{error || "Not found."}</div>;

  const { suspect, cdr_summary, ipdr_summary, events, call_heatmap_data, movement_data } = profile;
  const anomalyScore = cdr_summary?.anomaly_score;

  const hasAnomaly = events.some((e) => e.event_type === "ANOMALY");
  const hasImeiSwap = events.some((e) => e.event_type === "IMEI_SWAP");
  const hasMultiSimImei = events.some((e) => e.event_type === "MULTI_SIM_IMEI");
  const hasCrossCaseHandler = events.some((e) => e.event_type === "CROSS_CASE_HANDLER");
  const hasTowerSilence = events.some((e) => e.event_type === "TOWER_SILENCE");
  const hasLoopCall = events.some((e) => e.event_type === "LOOP_CALL");
  const hasNightCallBurst = events.some((e) => e.event_type === "NIGHT_CALL_BURST");

  const hasAnyRisk = hasAnomaly || hasImeiSwap || hasMultiSimImei || hasCrossCaseHandler || hasTowerSilence || hasLoopCall || hasNightCallBurst;

  const handleDownloadReport = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!suspectId) return;
    // In demo/mock mode (no backend), generate the full court-grade PDF client-side.
    // When a live backend is available, fall through to the server-generated PDF.
    const url = api.getReportUrl(suspectId);
    if (url.startsWith("data:")) {
      // Demo mode — generate real PDF using jsPDF
      try {
        // Derive case name from the case_id in the suspect object if possible
        const caseName = suspect.case_id ?? "Unknown Case";
        generatePdfReport(profile, caseName, cctvDetections);
      } catch (err) {
        console.error("Failed to generate PDF report:", err);
      }
    } else {
      // Live backend — stream the server-generated PDF
      window.location.href = url;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Back link */}
      <Link
        to={`/cases/${suspect.case_id}`}
        className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
      >
        ← Back to Case
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-zinc-900">{suspect.label}</h1>
            {profile.recidivism_data && profile.recidivism_data.prior_incident_count > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-red-100 text-red-700 rounded border border-red-200">
                REPEAT OFFENDER
              </span>
            )}
          </div>
          <span className="text-sm font-mono text-zinc-500">{suspect.primary_msisdn}</span>
        </div>
        <div className="flex items-center gap-3">
          {anomalyScore !== null && anomalyScore !== undefined && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${hasAnomaly ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-600"}`}>
              Anomaly {anomalyScore.toFixed(3)}
            </span>
          )}
          <button
            id="btn-download-report"
            onClick={handleDownloadReport}
            className="flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            <Download size={14} />
            Download Report
          </button>
        </div>
      </div>

      {/* Risk flags */}
      <div className="flex gap-3 flex-wrap">
        {hasImeiSwap && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
            <AlertTriangle size={13} />
            IMEI Swap Detected
          </div>
        )}
        {hasMultiSimImei && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
            <AlertTriangle size={13} />
            Burner IMEI / Multi-SIM Flagged
          </div>
        )}
        {hasCrossCaseHandler && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
            <AlertTriangle size={13} />
            Cross-Case Handler Matched
          </div>
        )}
        {hasTowerSilence && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-700">
            <AlertTriangle size={13} />
            Tower Switch-Off Detected
          </div>
        )}
        {hasLoopCall && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
            <AlertTriangle size={13} />
            Loop Coordination Calls
          </div>
        )}
        {hasNightCallBurst && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-700">
            <AlertTriangle size={13} />
            Nocturnal Burst Activity
          </div>
        )}
        {hasAnomaly && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
            <AlertTriangle size={13} />
            Behavioural Anomaly Flagged
          </div>
        )}
        {!hasAnyRisk && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs font-medium text-green-700">
            <CheckCircle size={13} />
            No high-risk events detected
          </div>
        )}
      </div>

      {/* Repeat Offender Risk Assessment Panel */}
      {profile.recidivism_data && (
        <div className="card">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Repeat Offender Risk Assessment</h2>
          <div className="grid grid-cols-1 md:grid-cols-10 gap-6">
            {/* Left Column (60%) */}
            <div className="md:col-span-6 space-y-4 pr-0 md:pr-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Risk Score Breakdown</h3>
              
              <div className="space-y-2 text-sm text-zinc-700">
                <div className="flex justify-between">
                  <span>Base anomaly score:</span>
                  <span className="font-mono font-medium">{profile.recidivism_data.base_score} <span className="text-zinc-400 text-xs">(from current case behaviour)</span></span>
                </div>
                <div className="flex justify-between">
                  <span>Recidivism adjustment:</span>
                  <span className="font-mono font-medium text-red-600">+{profile.recidivism_data.recidivism_adjustment} <span className="text-zinc-400 text-xs">({profile.recidivism_data.prior_incident_count} prior incident{profile.recidivism_data.prior_incident_count !== 1 ? "s" : ""})</span></span>
                </div>
                <div className="border-t border-zinc-150 my-2 pt-2 flex justify-between font-semibold">
                  <span className="text-zinc-900">FINAL COMPOSITE RISK SCORE:</span>
                  <span className="text-lg font-mono text-zinc-900">{profile.recidivism_data.final_score} / 100</span>
                </div>
              </div>

              {/* Risk Score Bar */}
              <div className="space-y-1">
                <div className="h-5 bg-slate-100 rounded overflow-hidden relative flex">
                  {/* Base fill */}
                  <div
                    className="h-full bg-indigo-500/60 transition-all"
                    style={{ width: `${profile.recidivism_data.base_score}%` }}
                  />
                  {/* Adjustment fill */}
                  <div
                    className={`h-full transition-all ${
                      profile.recidivism_data.final_score >= 81
                        ? "bg-red-600"
                        : profile.recidivism_data.final_score >= 61
                        ? "bg-orange-500"
                        : profile.recidivism_data.final_score >= 31
                        ? "bg-amber-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${profile.recidivism_data.recidivism_adjustment}%` }}
                  />

                  {/* Thin divider line at the base_score position */}
                  {profile.recidivism_data.recidivism_adjustment > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                      style={{ left: `${profile.recidivism_data.base_score}%` }}
                    />
                  )}

                  {/* Text overlay labels */}
                  <span className="absolute left-2 top-1 text-[9px] font-bold text-white drop-shadow-sm">
                    Base ({profile.recidivism_data.base_score})
                  </span>
                  {profile.recidivism_data.recidivism_adjustment > 0 && (
                    <span className="absolute right-2 top-1 text-[9px] font-bold text-white drop-shadow-sm">
                      Final (incl. history) ({profile.recidivism_data.final_score})
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-[9px] text-zinc-400 font-mono">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-2">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-zinc-400 font-semibold tracking-wider">Risk Band</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold w-fit mt-0.5 uppercase ${
                    profile.recidivism_data.risk_band === "CRITICAL"
                      ? "bg-red-100 text-red-700 border border-red-200"
                      : profile.recidivism_data.risk_band === "HIGH"
                      ? "bg-orange-100 text-orange-700 border border-orange-200"
                      : profile.recidivism_data.risk_band === "MEDIUM"
                      ? "bg-amber-100 text-amber-700 border border-amber-200"
                      : "bg-green-100 text-green-700 border border-green-200"
                  }`}>
                    {profile.recidivism_data.risk_band}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-zinc-400 font-semibold tracking-wider">Recommended Action</span>
                  <span className="text-xs text-zinc-700 font-medium mt-0.5">
                    {profile.recidivism_data.recommended_action}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column (40%) */}
            <div className="md:col-span-4 border-l border-zinc-150 pl-0 md:pl-6 space-y-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Prior Incident History</h3>
              {profile.recidivism_data.prior_incident_count === 0 ? (
                <div className="flex items-center gap-2 text-green-600 text-xs font-semibold py-4">
                  <CheckCircle size={16} />
                  No prior incidents on record
                </div>
              ) : (
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {profile.recidivism_data.priors.map((prior: any, idx: number) => (
                    <div key={idx} className="border-b border-zinc-50 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-start gap-2">
                        <span className="text-sm mt-0.5">📋</span>
                        <div className="flex-1">
                          <h4 className="text-xs font-semibold text-zinc-800">{prior.case_reference}</h4>
                          <p className="text-[10px] text-zinc-500">
                            {prior.offence_type} · {new Date(prior.incident_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                          <p className={`text-[10px] font-semibold mt-0.5 ${
                            prior.outcome.includes("Convicted") || prior.outcome.includes("Charge Sheet")
                              ? "text-amber-600"
                              : prior.outcome.includes("Acquitted")
                              ? "text-zinc-400"
                              : "text-red-600"
                          }`}>
                            Outcome: {prior.outcome}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Call Summary */}
      <div className="card">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Call Summary</h2>
        {cdr_summary ? (
          <div className="grid grid-cols-6 gap-4 divide-x divide-[rgba(67,56,202,0.08)]">
            <MetricBox label="Total Calls" value={cdr_summary.total_calls} />
            <div className="pl-4"><MetricBox label="Total SMS" value={cdr_summary.total_sms} /></div>
            <div className="pl-4"><MetricBox label="Unique Contacts" value={cdr_summary.unique_contacts} /></div>
            <div className="pl-4"><MetricBox label="Avg Duration" value={`${cdr_summary.avg_duration_sec}s`} /></div>
            <div className="pl-4">
              <MetricBox
                label="Night Call Ratio"
                value={`${(cdr_summary.night_call_ratio * 100).toFixed(1)}%`}
              />
            </div>
            <div className="pl-4">
              <MetricBox label="Burst Score" value={cdr_summary.burst_score.toFixed(2)} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">No CDR data available.</p>
        )}
      </div>

      {/* Section 2: Call Heatmap */}
      <div className="card">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Call Activity Heatmap</h2>
        {call_heatmap_data.length > 0 ? (
          <CallCalendar data={call_heatmap_data} />
        ) : (
          <p className="text-sm text-zinc-400">No call data to display.</p>
        )}
      </div>

      {/* Section 3: Movement Timeline */}
      <div className="card">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Tower Movement</h2>
        {movement_data.length > 0 ? (
          <>
            <div style={{ height: "380px" }} className="mb-4 rounded-lg overflow-hidden border border-zinc-100">
              <MovementMap 
                movements={movement_data} 
                events={events} 
                suspectLabel={suspect.label} 
                onMapLoaded={() => setMapReady(true)} 
              />
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-[rgba(67,56,202,0.08)]">
                  <th className="pb-2 font-medium">Tower ID</th>
                  <th className="pb-2 font-medium">Timestamp</th>
                  <th className="pb-2 font-medium">Co-location With</th>
                </tr>
              </thead>
              <tbody>
                {movement_data.map((m, i) => (
                  <tr key={i} className="table-row-divider">
                    <td className={`py-2 font-mono pr-4 ${m.co_location ? "text-red-700 font-semibold" : "text-zinc-700"}`}>
                      {m.tower_id}
                    </td>
                    <td className="py-2 text-zinc-500 pr-4">{formatDate(m.timestamp)}</td>
                    <td className="py-2 text-zinc-600">
                      {m.co_location ? m.co_location_with.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-sm text-zinc-400">No tower data with coordinates available.</p>
        )}
      </div>

      {/* Section 4: Events */}
      <div className="card">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Intelligence Events</h2>
        {events.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-400 border-b border-[rgba(67,56,202,0.08)]">
                <th className="pb-2 font-medium w-20">Severity</th>
                <th className="pb-2 font-medium w-32">Type</th>
                <th className="pb-2 font-medium">Summary</th>
                <th className="pb-2 font-medium w-36 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="table-row-divider">
                  <td className="py-2.5 pr-3"><SeverityBadge sev={ev.severity} /></td>
                  <td className="py-2.5 pr-3 text-zinc-600 font-mono text-xs">{ev.event_type}</td>
                  <td className="py-2.5 pr-3 text-zinc-700 text-xs">{eventSummary(ev)}</td>
                  <td className="py-2.5 text-zinc-400 text-xs text-right">{formatDate(ev.occurred_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-zinc-400">No events for this suspect. Run analysis on the case first.</p>
        )}

        {/* OTT Usage table */}
        {ipdr_summary && ipdr_summary.ott_breakdown.length > 0 && (
          <div className="mt-6 border-t border-[rgba(67,56,202,0.08)] pt-6">
            <h3 className="text-xs font-semibold text-zinc-700 mb-3 uppercase tracking-wide">OTT Application Usage</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-[rgba(67,56,202,0.08)]">
                  <th className="pb-2 font-medium">App</th>
                  <th className="pb-2 font-medium">Sessions</th>
                  <th className="pb-2 font-medium">Total Data</th>
                  <th className="pb-2 font-medium">First Seen</th>
                  <th className="pb-2 font-medium">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {ipdr_summary.ott_breakdown.map((row, i) => (
                  <tr key={i} className="table-row-divider">
                    <td className="py-2 text-zinc-900 font-medium pr-4">{row.app}</td>
                    <td className="py-2 text-zinc-600 pr-4">{row.session_count}</td>
                    <td className="py-2 text-zinc-600 pr-4">{row.total_data_kb.toFixed(1)} KB</td>
                    <td className="py-2 text-zinc-500 pr-4">{row.first_seen ? new Date(row.first_seen).toLocaleDateString() : "—"}</td>
                    <td className="py-2 text-zinc-500">{row.last_seen ? new Date(row.last_seen).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CCTV Correlation Section */}
      <div className="card">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">CCTV Correlation</h2>
        {cctvDetections.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No CCTV detections recorded for this subject.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cctvDetections.map((d) => (
              <div key={d.id} className="flex gap-4 p-4 border border-zinc-200 rounded-lg hover:shadow-sm transition-shadow">
                {/* CCTV Frame image/placeholder */}
                <div className="w-[160px] h-[120px] shrink-0 rounded-lg overflow-hidden border border-zinc-100 flex items-center justify-center bg-slate-200">
                  {d.frame_image_path ? (
                    <div className="w-full h-full relative group">
                      <img
                        src={d.frame_image_path}
                        alt={`CCTV CAM ${d.camera_id}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLElement).parentElement;
                          if (parent) {
                            const placeholder = document.createElement('div');
                            placeholder.className = "flex items-center justify-center w-full h-full text-zinc-500 font-bold text-xs font-mono";
                            placeholder.innerText = "CCTV FRAME";
                            parent.appendChild(placeholder);
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-zinc-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => setSelectedCctv(d)}
                          className="px-2 py-1 bg-white text-zinc-900 text-[10px] font-bold rounded flex items-center gap-1 shadow cursor-pointer transition-transform hover:scale-105"
                        >
                          <Eye size={10} />
                          View Feed
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-zinc-500 font-bold text-xs font-mono">
                      CCTV FRAME
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 flex flex-col justify-between text-xs">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-zinc-950 truncate">{d.camera_id}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        d.correlation_status === 'CONFIRMED'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : d.correlation_status === 'PROBABLE'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {d.correlation_status}
                      </span>
                    </div>
                    <p className="text-zinc-600 font-semibold truncate mt-0.5">{d.camera_name}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{formatDate(d.detection_timestamp)}</p>

                    <div className="mt-2 space-y-0.5">
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>Face Match Conf:</span>
                        <span className="font-mono font-semibold">{Math.round(d.confidence_score * 100)}%</span>
                      </div>
                      <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${d.confidence_score * 100}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-zinc-100">
                    <span className="text-[10px] uppercase text-zinc-400 font-semibold block">CDR Correlation</span>
                    <p className="text-zinc-700 mt-0.5 leading-tight font-medium">
                      Tower <span className="font-mono">{d.matched_tower_id}</span> hit {d.notes}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                        MATCH: {profile?.suspect.label || "Suspect"} ({Math.round(selectedCctv.confidence_score * 100)}%)
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
                <span className="font-semibold text-zinc-200">{profile?.suspect.label || "Unknown"}</span>
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

      {profile && profile.movement_data.length > 0 && !mapReady && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50/90 backdrop-blur-md font-sans">
          <div className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-100 rounded-xl shadow-lg max-w-sm text-center animate-in fade-in zoom-in-95 duration-200">
            <Loader2 className="size-8 animate-spin text-indigo-600" />
            <div>
              <h3 className="text-xs font-bold text-slate-800">Loading Geospatial Analysis...</h3>
              <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                Initializing digital map layers and plotting suspect movement timelines
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
