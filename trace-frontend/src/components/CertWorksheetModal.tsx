import { useState } from "react";
import {
  X, Download, CheckSquare, AlertTriangle, FileWarning,
  Clock, Shield, ChevronRight, Loader2,
} from "lucide-react";
import { api } from "../lib/api";

type DocumentStatus = "DRAFT" | "PENDING_REVIEW" | "OFFICER_REVIEWED";

interface CertWorksheetModalProps {
  caseId: string;
  caseName: string;
  documentStatus: DocumentStatus | string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  userRole: string;
  onClose: () => void;
  onStatusChange: (newStatus: DocumentStatus) => void;
}

/** A compact visual preview of the 65B worksheet appearance */
function WorksheetPreview({ status }: { status: string }) {
  const watermarkText = {
    DRAFT: "DRAFT — AUTOMATED ANALYSIS, UNVERIFIED",
    PENDING_REVIEW: "PENDING OFFICER REVIEW",
    OFFICER_REVIEWED: "OFFICER REVIEWED — PENDING PHYSICAL SIGNATURE",
  }[status] ?? "DRAFT";

  const watermarkColor = {
    DRAFT: "text-red-500/25",
    PENDING_REVIEW: "text-amber-500/25",
    OFFICER_REVIEWED: "text-teal-500/25",
  }[status] ?? "text-red-500/25";

  return (
    <div className="relative border-2 border-zinc-300 rounded bg-white overflow-hidden"
      style={{ aspectRatio: "0.707", width: "100%", maxWidth: "220px" }}
    >
      {/* Outer border lines simulating court paper */}
      <div className="absolute inset-2 border border-zinc-300 pointer-events-none" />
      {/* Diagonal watermark */}
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${watermarkColor}`}>
        <span
          className="font-bold text-center leading-tight select-none"
          style={{
            fontSize: "10px",
            transform: "rotate(45deg)",
            textAlign: "center",
            maxWidth: "140px",
            lineHeight: 1.2,
          }}
        >
          {watermarkText}
        </span>
      </div>

      {/* Simulated content lines */}
      <div className="absolute top-0 left-0 right-0 p-3 pt-10">
        <div className="h-1.5 bg-zinc-200 rounded mb-1 w-3/4 mx-auto" />
        <div className="h-1 bg-zinc-100 rounded mb-3 w-1/2 mx-auto" />
        {[1,0.9,0.95,0.7,0.8,0.85,0.6].map((w, i) => (
          <div key={i} className="h-1 bg-zinc-100 rounded mb-1" style={{ width: `${w * 100}%` }} />
        ))}
        <div className="mt-4 grid grid-cols-2 gap-1">
          <div className="h-6 border border-zinc-200 rounded bg-zinc-50" />
          <div className="h-6 border border-zinc-200 rounded bg-zinc-50" />
        </div>
        <div className="mt-2 h-8 border border-zinc-300 rounded bg-zinc-50" />
      </div>

      {/* Status ribbon at bottom */}
      <div className={`absolute bottom-0 left-0 right-0 py-1 text-center text-[7px] font-bold uppercase tracking-wider ${
        status === "DRAFT"            ? "bg-red-100 text-red-700"
        : status === "PENDING_REVIEW" ? "bg-amber-100 text-amber-700"
        :                               "bg-teal-100 text-teal-700"
      }`}>
        {status.replace("_", " ")}
      </div>
    </div>
  );
}

/** Two-step officer review confirmation */
function MarkReviewedConfirm({
  caseId,
  caseName,
  onConfirmed,
  onCancel,
}: {
  caseId: string;
  caseName: string;
  onConfirmed: () => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (!checked) return;
    setLoading(true);
    setError("");
    try {
      await api.markCaseReviewed(caseId);
      onConfirmed();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Legal explanation */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-2 mb-2">
          <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-amber-800">What "Mark Reviewed" does — and does NOT do</p>
        </div>
        <ul className="text-xs text-amber-700 space-y-1.5 ml-5 list-disc leading-relaxed">
          <li>Records your user ID and the current timestamp in the <strong>immutable audit trail</strong>.</li>
          <li>Changes the watermark on future PDF exports to <em>"OFFICER REVIEWED — PENDING PHYSICAL SIGNATURE"</em>.</li>
          <li>Confirms that you have personally verified the worksheet content.</li>
        </ul>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex gap-2 mb-2">
          <Shield size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-red-800">This action does NOT:</p>
        </div>
        <ul className="text-xs text-red-700 space-y-1.5 ml-5 list-disc leading-relaxed">
          <li>Add your signature or seal to any document.</li>
          <li>Issue a Section 65B certificate — that requires <strong>physical signing and sealing</strong> of the printed worksheet.</li>
          <li>Make any automated assertions about your personal verification of the source data.</li>
        </ul>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 leading-relaxed">
        <p className="font-semibold text-zinc-800 mb-1">Case: {caseName}</p>
        <p>
          After clicking "Confirm", you must print the worksheet, complete all blank
          certification fields personally, and physically sign and seal the document.
          Only the signed physical document constitutes a valid Section 65B certificate.
        </p>
      </div>

      {/* Mandatory acknowledgement checkbox */}
      <label className="flex items-start gap-2.5 cursor-pointer group">
        <input
          type="checkbox"
          id="review-confirm-check"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-zinc-900"
        />
        <span className="text-xs text-zinc-700 group-hover:text-zinc-900 transition-colors leading-relaxed">
          I confirm I have <strong>personally reviewed</strong> the underlying CDR/IPDR source data
          and the automated analysis in this worksheet. I understand this action is logged
          in the audit trail under my officer credentials.
        </span>
      </label>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Cancel
        </button>
        <button
          id="btn-confirm-mark-reviewed"
          onClick={handleConfirm}
          disabled={!checked || loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-medium disabled:opacity-40 hover:bg-teal-800 transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />}
          {loading ? "Confirming…" : "Confirm Review"}
        </button>
      </div>
    </div>
  );
}

/** Main modal */
export default function CertWorksheetModal({
  caseId,
  caseName,
  documentStatus,
  reviewedBy,
  reviewedAt,
  userRole,
  onClose,
  onStatusChange,
}: CertWorksheetModalProps) {
  const [mode, setMode] = useState<"preview" | "mark-reviewed">("preview");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [localStatus, setLocalStatus] = useState(documentStatus);

  const canMarkReviewed = (userRole === "inspector" || userRole === "sp") && localStatus !== "OFFICER_REVIEWED";

  const statusLabel: Record<string, string> = {
    DRAFT: "Draft",
    PENDING_REVIEW: "Pending Review",
    OFFICER_REVIEWED: "Officer Reviewed",
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError("");
    try {
      const blob = await api.exportCertWorksheet(caseId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TRACE_65B_Worksheet_${caseName.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      // Refresh local status after export (first export transitions DRAFT -> PENDING_REVIEW)
      if (localStatus === "DRAFT") {
        setLocalStatus("PENDING_REVIEW");
        onStatusChange("PENDING_REVIEW");
      }
    } catch (e: unknown) {
      setDownloadError(String(e));
    } finally {
      setDownloading(false);
    }
  };

  const handleReviewConfirmed = () => {
    setLocalStatus("OFFICER_REVIEWED");
    onStatusChange("OFFICER_REVIEWED");
    setMode("preview");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-zinc-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-indigo-100">
              <Shield size={15} className="text-indigo-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Section 65B Certificate Worksheet</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {caseName} ·{" "}
                <span className={`font-medium ${
                  localStatus === "OFFICER_REVIEWED" ? "text-teal-600"
                  : localStatus === "PENDING_REVIEW" ? "text-amber-600"
                  : "text-red-600"
                }`}>
                  {statusLabel[localStatus] ?? localStatus}
                </span>
              </p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-2">
            {mode !== "preview" && (
              <button
                onClick={() => setMode("preview")}
                className="text-xs text-zinc-500 hover:text-zinc-800 flex items-center gap-1"
              >
                ← Back to preview
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-200 transition-colors"
              aria-label="Close"
            >
              <X size={15} className="text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {mode === "preview" ? (
            <div className="flex gap-6">
              {/* Left: visual preview */}
              <div className="flex-shrink-0 flex flex-col items-center gap-3">
                <WorksheetPreview status={localStatus as string} />
                <p className="text-[9px] text-zinc-400 text-center max-w-[220px] leading-relaxed">
                  Visual preview of PDF watermark.<br />
                  Actual document contains full statutory text.
                </p>
              </div>

              {/* Right: info + actions */}
              <div className="flex-1 space-y-4">
                {/* Legal summary box */}
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-[11px] font-semibold text-zinc-700 mb-2">What this worksheet contains</p>
                  <ul className="text-xs text-zinc-600 space-y-1 ml-3 list-disc leading-relaxed">
                    <li>Case identifiers and analysis period (auto-filled)</li>
                    <li>CDR/IPDR record counts and SHA-256 integrity hash</li>
                    <li>Section 65B(4) statutory text for officer reference</li>
                    <li><strong>Blank fields</strong> for name, designation, date, place, production order ref</li>
                    <li>Empty signature and seal boxes (officer must complete physically)</li>
                  </ul>
                </div>

                {/* Status-specific guidance */}
                {localStatus === "DRAFT" && (
                  <div className="flex gap-2 rounded-lg border border-red-100 bg-red-50 p-3">
                    <FileWarning size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 leading-relaxed">
                      First export will advance status to <strong>Pending Review</strong>.
                      Download, review the data, complete all blank fields by hand, and sign the printed copy.
                    </p>
                  </div>
                )}
                {localStatus === "PENDING_REVIEW" && (
                  <div className="flex gap-2 rounded-lg border border-amber-100 bg-amber-50 p-3">
                    <Clock size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Worksheet is open for review. Once you have checked the data, use
                      <strong> "Mark Reviewed"</strong> to log your review in the audit trail.
                    </p>
                  </div>
                )}
                {localStatus === "OFFICER_REVIEWED" && (
                  <div className="flex gap-2 rounded-lg border border-teal-100 bg-teal-50 p-3">
                    <CheckSquare size={13} className="text-teal-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-teal-700 font-semibold mb-0.5">Officer review logged</p>
                      {reviewedBy && (
                        <p className="text-xs text-teal-600">
                          By: {reviewedBy}
                          {reviewedAt && ` · ${new Date(reviewedAt).toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}`}
                        </p>
                      )}
                      <p className="text-xs text-teal-600 mt-1 leading-relaxed">
                        Remember to physically sign and seal the printed copy. Until signed,
                        this is not a valid Section 65B certificate.
                      </p>
                    </div>
                  </div>
                )}

                {downloadError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                    {downloadError}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    id="btn-download-65b-worksheet"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-700 text-white text-sm font-medium hover:bg-indigo-800 disabled:opacity-40 transition-colors"
                  >
                    {downloading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    {downloading ? "Generating PDF…" : "Download Worksheet PDF"}
                  </button>

                  {canMarkReviewed && (
                    <button
                      id="btn-mark-reviewed"
                      onClick={() => setMode("mark-reviewed")}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-teal-600 text-teal-700 text-sm font-medium hover:bg-teal-50 transition-colors"
                    >
                      <CheckSquare size={14} />
                      Mark as Reviewed
                      <ChevronRight size={12} className="ml-auto" />
                    </button>
                  )}
                </div>

                {/* Legal footer */}
                <p className="text-[9px] text-zinc-400 leading-relaxed">
                  Ref: Anvar P.V. v. P.K. Basheer (2014) · Arjun Panditrao Khotkar v. Kailash
                  Kushanrao Gorantyal (2020). Every PDF export is logged in the case audit trail.
                </p>
              </div>
            </div>
          ) : (
            <MarkReviewedConfirm
              caseId={caseId}
              caseName={caseName}
              onConfirmed={handleReviewConfirmed}
              onCancel={() => setMode("preview")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
