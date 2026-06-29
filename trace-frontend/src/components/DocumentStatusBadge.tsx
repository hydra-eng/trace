import { FileWarning, Clock, CheckSquare } from "lucide-react";

type DocumentStatus = "DRAFT" | "PENDING_REVIEW" | "OFFICER_REVIEWED";

interface DocumentStatusBadgeProps {
  status: DocumentStatus | string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  size?: "sm" | "md";
}

const CONFIG: Record<DocumentStatus, {
  label: string;
  icon: React.ElementType;
  pill: string;
  dot: string;
  tooltip: string;
}> = {
  DRAFT: {
    label: "Draft",
    icon: FileWarning,
    pill: "bg-red-50 border border-red-200 text-red-700",
    dot: "bg-red-500",
    tooltip: "Machine-generated draft. Not reviewed or certified by any officer.",
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    icon: Clock,
    pill: "bg-amber-50 border border-amber-200 text-amber-700",
    dot: "bg-amber-500",
    tooltip: "Worksheet has been opened for officer review. Physical review and signing not yet completed.",
  },
  OFFICER_REVIEWED: {
    label: "Officer Reviewed",
    icon: CheckSquare,
    pill: "bg-teal-50 border border-teal-200 text-teal-700",
    dot: "bg-teal-500",
    tooltip: "Officer has marked this as reviewed. Still requires physical signature and seal to be legally certified.",
  },
};

export default function DocumentStatusBadge({
  status,
  reviewedBy,
  reviewedAt,
  size = "md",
}: DocumentStatusBadgeProps) {
  const cfg = CONFIG[status as DocumentStatus] ?? CONFIG["DRAFT"];
  const Icon = cfg.icon;

  const iconSize = size === "sm" ? 11 : 13;
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  const padding   = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";

  return (
    <div className="group relative inline-block">
      <div
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${textSize} ${padding} ${cfg.pill} cursor-help transition-all`}
      >
        {/* Animated pulse dot */}
        <span className="relative flex">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-50 animate-ping ${cfg.dot}`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${cfg.dot}`} />
        </span>
        <Icon size={iconSize} />
        <span>{cfg.label}</span>
      </div>

      {/* Tooltip */}
      <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 w-72 rounded-lg border border-zinc-200 bg-white shadow-xl p-3 text-xs text-zinc-700">
        <p className="font-semibold text-zinc-900 mb-1">Section 65B — {cfg.label}</p>
        <p className="leading-relaxed text-zinc-600">{cfg.tooltip}</p>
        {status === "OFFICER_REVIEWED" && reviewedBy && (
          <p className="mt-2 text-zinc-500">
            Marked by: <span className="font-medium text-zinc-700">{reviewedBy}</span>
            {reviewedAt && (
              <>
                {" "}on{" "}
                <span className="font-medium text-zinc-700">
                  {new Date(reviewedAt).toLocaleString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </>
            )}
          </p>
        )}
        <p className="mt-2 text-[10px] text-zinc-400 italic border-t border-zinc-100 pt-1.5">
          Legal certification requires physical officer signature on printed copy.
        </p>
      </div>
    </div>
  );
}
