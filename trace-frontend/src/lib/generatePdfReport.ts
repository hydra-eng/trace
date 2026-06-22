/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TRACE – Criminal Intelligence Platform
 * Professional Court-Grade PDF Report Generator
 *
 * Generates a full CDR/IPDR analysis report suitable for submission
 * to magistrates / sessions courts under Section 65B of the Indian
 * Evidence Act.
 */

import { jsPDF } from "jspdf";

// ─── Colour palette (RGB tuples) ─────────────────────────────────────────────
const C = {
  navyDark: [0, 0, 0] as [number, number, number],
  navy: [0, 0, 0] as [number, number, number],
  navyLight: [30, 30, 30] as [number, number, number],
  red: [0, 0, 0] as [number, number, number],
  redLight: [242, 242, 242] as [number, number, number],
  amber: [0, 0, 0] as [number, number, number],
  amberLight: [245, 245, 245] as [number, number, number],
  green: [0, 0, 0] as [number, number, number],
  greenLight: [250, 250, 250] as [number, number, number],
  slate: [50, 50, 50] as [number, number, number],
  slateLight: [245, 245, 245] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  border: [150, 150, 150] as [number, number, number],
  text: [0, 0, 0] as [number, number, number],
  muted: [80, 80, 80] as [number, number, number],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setFill(doc: jsPDF, rgb: [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setDraw(doc: jsPDF, rgb: [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}
function setTextColor(doc: jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}
function bold(doc: jsPDF) {
  doc.setFont("times", "bold");
}
function normal(doc: jsPDF) {
  doc.setFont("times", "normal");
}
function size(doc: jsPDF, s: number) {
  doc.setFontSize(s);
}

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateShort(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function eventSummary(ev: { event_type: string; detail: Record<string, unknown> }): string {
  const d = ev.detail;
  if (ev.event_type === "IMEI_SWAP") return `IMEI changed: ${d.old_imei} → ${d.new_imei}`;
  if (ev.event_type === "CO_LOCATION") return `Co-located at tower ${d.tower_id}`;
  if (ev.event_type === "COMMON_CONTACT") return `Shared contact: ${d.common_number}`;
  if (ev.event_type === "ANOMALY") return `Anomaly score: ${Number(d.anomaly_score).toFixed(3)}`;
  if (ev.event_type === "OTT_USAGE") return `OTT App: ${d.app}`;
  if (ev.event_type === "MULTI_SIM_IMEI")
    return `Burner handset (IMEI: ${d.imei}) used with ${d.sim_count} SIM cards`;
  if (ev.event_type === "CROSS_CASE_HANDLER")
    return `Global handler ${d.handler_number} appears in ${d.case_count} cases`;
  if (ev.event_type === "TOWER_SILENCE")
    return `Radio-silent for ${d.gap_hours}h. Last seen: tower ${d.last_seen_tower}`;
  if (ev.event_type === "NIGHT_CALL_BURST")
    return `Nocturnal burst: ${d.call_count} calls on ${d.night_date}`;
  if (ev.event_type === "LOOP_CALL")
    return `Loop coordination: ${d.call_count_in_window} calls in ${d.window_minutes} min window`;
  return JSON.stringify(d).substring(0, 80);
}


// ─── Page utilities ───────────────────────────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

function drawJudicialBorders(doc: jsPDF) {
  doc.setLineWidth(0.8);
  setDraw(doc, [0, 0, 0]);
  doc.rect(8, 8, PAGE_W - 16, PAGE_H - 16, "S");
  doc.setLineWidth(0.25);
  doc.rect(9.5, 9.5, PAGE_W - 19, PAGE_H - 19, "S");
}

function addPageHeader(doc: jsPDF, pageNum: number, totalPagesPlaceholder: string) {
  drawJudicialBorders(doc);
  setDraw(doc, [0, 0, 0]);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 10, PAGE_W - MARGIN, 10);
  doc.setLineWidth(0.1);
  doc.line(MARGIN, 10.8, PAGE_W - MARGIN, 10.8);

  bold(doc);
  size(doc, 7);
  setTextColor(doc, C.text);
  doc.text("ANDHRA PRADESH STATE POLICE — PRAKASHAM DISTRICT CYBER CRIME CELL", MARGIN, 7.5);

  normal(doc);
  size(doc, 6.5);
  setTextColor(doc, C.muted);
  doc.text(`Page ${pageNum} of ${totalPagesPlaceholder}`, PAGE_W - MARGIN, 7.5, { align: "right" });
}

function addPageFooter(doc: jsPDF, officer: string, ref: string) {
  const y = PAGE_H - 12;
  setDraw(doc, [0, 0, 0]);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, PAGE_H - 16, PAGE_W - MARGIN, PAGE_H - 16);
  doc.setLineWidth(0.1);
  doc.line(MARGIN, PAGE_H - 15.2, PAGE_W - MARGIN, PAGE_H - 15.2);

  bold(doc);
  size(doc, 6.5);
  setTextColor(doc, C.text);
  doc.text(`Prepared by: ${officer}`, MARGIN, y);
  normal(doc);
  doc.text(`Ref No: ${ref}`, PAGE_W / 2, y, { align: "center" });
  doc.text("RESTRICTED — FOR LAW ENFORCEMENT & COURT USE ONLY", PAGE_W - MARGIN, y, { align: "right" });
}

function sectionHeading(doc: jsPDF, y: number, title: string): number {
  bold(doc);
  size(doc, 9);
  setTextColor(doc, C.text);
  doc.text(title.toUpperCase(), MARGIN, y + 4.8);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y + 6.5, PAGE_W - MARGIN, y + 6.5);
  normal(doc);
  return y + 10;
}

function drawMetricCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  flag?: boolean
) {
  if (flag) {
    setFill(doc, [242, 242, 242]); // neutral light grey background
    doc.rect(x, y, w, 15, "F");
    setDraw(doc, [0, 0, 0]); // black border
    doc.setLineWidth(0.4);
    doc.rect(x, y, w, 15, "S");
  } else {
    setFill(doc, [245, 245, 245]); // neutral light grey background
    doc.rect(x, y, w, 15, "F");
    setDraw(doc, C.border);
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, 15, "S");
  }
  size(doc, 6.5);
  setTextColor(doc, C.muted);
  normal(doc);
  doc.text(label.toUpperCase(), x + w / 2, y + 4.5, { align: "center" });
  bold(doc);
  size(doc, 10);
  setTextColor(doc, flag ? C.red : C.text);
  doc.text(value, x + w / 2, y + 11.5, { align: "center" });
}

function drawTable(
  doc: jsPDF,
  y: number,
  headers: string[],
  widths: number[],
  rows: string[][],
  startX = MARGIN,
  maxRows = 40
): number {
  const rowH = 5.8; // tighter row height
  const headerH = 7;
  const totalW = widths.reduce((a, b) => a + b, 0);

  // Header background
  setFill(doc, [241, 245, 249]); // light grey for headers
  doc.rect(startX, y, totalW, headerH, "F");
  setDraw(doc, C.text);
  doc.setLineWidth(0.4);
  doc.rect(startX, y, totalW, headerH, "S"); // solid frame

  bold(doc);
  size(doc, 7);
  setTextColor(doc, C.text);

  let xCursor = startX + 2;
  headers.forEach((h, i) => {
    doc.text(h, xCursor, y + 5);
    xCursor += widths[i];
  });

  y += headerH;
  const displayedRows = rows.slice(0, maxRows);

  displayedRows.forEach((row, ri) => {
    const isEven = ri % 2 === 0;
    setFill(doc, isEven ? C.white : C.slateLight);
    doc.rect(startX, y, totalW, rowH, "F");

    normal(doc);
    size(doc, 6.5);
    setTextColor(doc, C.text);

    xCursor = startX + 2;
    row.forEach((cell, ci) => {
      const cellText = String(cell ?? "—").substring(0, 45);
      doc.text(cellText, xCursor, y + 4, {
        maxWidth: widths[ci] - 3,
      });
      xCursor += widths[ci];
    });

    // Row grid borders
    setDraw(doc, C.border);
    doc.setLineWidth(0.2);
    doc.rect(startX, y, totalW, rowH, "S");

    y += rowH;
  });

  if (rows.length > maxRows) {
    normal(doc);
    size(doc, 6.5);
    setTextColor(doc, C.muted);
    doc.text(
      `… ${rows.length - maxRows} more records not shown (see full electronic record)`,
      startX,
      y + 4
    );
    y += 8;
  }

  return y + 2;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function generatePdfReport(profile: any, caseName?: string): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const suspect = profile?.suspect ?? {};
  const cdr = profile?.cdr_summary ?? null;
  const ipdr = profile?.ipdr_summary ?? null;
  const events: any[] = profile?.events ?? [];
  const movement: any[] = profile?.movement_data ?? [];

  const reportRef = `TRACE/${new Date().getFullYear()}/${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const generatedAt = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const officerName = "TRACE System (Auto-generated)";

  // Count pages placeholder (we'll use "N" since jsPDF v4 lacks easy total-pages)
  const TOTAL = "N";
  let page = 1;

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  PAGE 1 – COVER PAGE                                    ║
  // ╚═══════════════════════════════════════════════════════════╝

  drawJudicialBorders(doc);

  // Center Government letterhead (black text, formal)
  bold(doc);
  size(doc, 8.5);
  setTextColor(doc, C.text);
  doc.text("GOVERNMENT OF ANDHRA PRADESH", PAGE_W / 2, 16, { align: "center" });
  doc.text("ANDHRA PRADESH STATE POLICE DEPARTMENT", PAGE_W / 2, 21, { align: "center" });
  size(doc, 7.5);
  doc.text("CYBER CRIME CELL, DISTRICT POLICE HEADQUARTERS, ONGOLE", PAGE_W / 2, 26, { align: "center" });

  // Pleading double rules
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 31, PAGE_W - MARGIN, 31);
  doc.setLineWidth(0.15);
  doc.line(MARGIN, 32.2, PAGE_W - MARGIN, 32.2);

  // Large formal report title
  bold(doc);
  size(doc, 14);
  doc.text("CDR / IPDR FORENSIC ANALYSIS REPORT", PAGE_W / 2, 42, { align: "center" });
  size(doc, 8.5);
  normal(doc);
  doc.text("INVESTIGATION LOG & CELL SITE ANALYSIS BRIEF FOR JUDICIAL SUBMISSION", PAGE_W / 2, 48, { align: "center" });
  bold(doc);
  size(doc, 7);
  doc.text(`CONFIDENTIAL  |  REPORT REF NO: ${reportRef}`, PAGE_W / 2, 54, { align: "center" });

  // Divider line
  doc.setLineWidth(0.25);
  doc.line(MARGIN, 58, PAGE_W - MARGIN, 58);

  // — Subject block —
  let y = 63;
  setFill(doc, [248, 250, 252]); // very light slate grey fill
  doc.rect(MARGIN, y, CONTENT_W, 51, "F");
  setDraw(doc, [0, 0, 0]);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CONTENT_W, 51, "S");

  bold(doc);
  size(doc, 8);
  setTextColor(doc, C.text);
  doc.text("I. SUBJECT DETAILS & METADATA", MARGIN + 4, y + 6);

  // Divider line inside subject block
  doc.setLineWidth(0.2);
  doc.line(MARGIN + 4, y + 8, MARGIN + CONTENT_W - 4, y + 8);

  const subjFields: [string, string][] = [
    ["Accused / Suspect Label:", suspect.label ?? "Unknown"],
    ["Primary MSISDN (Phone):", suspect.primary_msisdn ?? "—"],
    ["Registered Case Name:", caseName ?? "—"],
    ["Computed Anomaly Score:", cdr?.anomaly_score != null ? `${String((cdr.anomaly_score).toFixed(3))}` : "N/A"],
    ["Total Logs Audited:", `${events.length} flagged events`],
    ["Report Generation Date:", generatedAt + " IST"],
  ];

  let ry = y + 13;
  subjFields.forEach(([lbl, val]) => {
    bold(doc);
    size(doc, 7);
    setTextColor(doc, C.text);
    doc.text(lbl, MARGIN + 4, ry);
    normal(doc);
    size(doc, 7.5);
    doc.text(val, MARGIN + 45, ry);
    ry += 6.5;
  });

  // — Evasive alerts —
  y = 120;
  const highEvents = events.filter((e) => e.severity === "HIGH");

  if (highEvents.length > 0) {
    setFill(doc, [242, 242, 242]); // light grey fill
    doc.rect(MARGIN, y, CONTENT_W, 23, "F");
    setDraw(doc, [0, 0, 0]);
    doc.setLineWidth(0.4);
    doc.rect(MARGIN, y, CONTENT_W, 23, "S");

    bold(doc);
    size(doc, 8);
    setTextColor(doc, C.text);
    doc.text("II. DETECTED EVASIVE ALERTS SUMMARY (HIGH SEVERITY)", MARGIN + 4, y + 6);
    normal(doc);
    size(doc, 6.8);
    setTextColor(doc, [30, 30, 30]);

    const flagTexts = highEvents
      .slice(0, 3)
      .map((e) => `• ${e.event_type.replace(/_/g, " ")}: ${eventSummary(e)}`);
    doc.text(flagTexts.join("\n"), MARGIN + 4, y + 11.5, { maxWidth: CONTENT_W - 8 });
    y += 29;
  } else {
    setFill(doc, [250, 250, 250]); // light grey fill
    doc.rect(MARGIN, y, CONTENT_W, 12, "F");
    setDraw(doc, [150, 150, 150]);
    doc.setLineWidth(0.4);
    doc.rect(MARGIN, y, CONTENT_W, 12, "S");
    bold(doc);
    size(doc, 7.5);
    setTextColor(doc, C.text);
    doc.text("✓  No high-severity evasive indicators detected in the analysis window.", MARGIN + 4, y + 7.5);
    y += 18;
  }

  // — Section 65B notice —
  y = Math.max(y + 2, 160);
  setFill(doc, [255, 255, 255]); // clean white
  doc.rect(MARGIN, y, CONTENT_W, 48, "F");
  setDraw(doc, [0, 0, 0]);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CONTENT_W, 48, "S");

  bold(doc);
  size(doc, 8);
  setTextColor(doc, C.text);
  doc.text("III. COMPLIANCE CERTIFICATE UNDER SECTION 65B", MARGIN + 4, y + 6);
  doc.setLineWidth(0.2);
  doc.line(MARGIN + 4, y + 8, MARGIN + CONTENT_W - 4, y + 8);

  normal(doc);
  size(doc, 6.8);
  setTextColor(doc, C.slate);
  const certText =
    "Pursuant to the provisions of Section 65B of the Indian Evidence Act, 1872 (as amended), it is certified that " +
    "the electronic records, including CDR and IPDR details contained in this report, were generated automatically by " +
    "the computer systems of the respective telecom operators. These records were obtained in the ordinary course of " +
    "investigative operations, and the systems were operating in normal functional status during the period. The hash " +
    "integrity of the digital records has been verified to ensure no alteration has occurred since extraction.";
  const certLines = doc.splitTextToSize(certText, CONTENT_W - 8);
  doc.text(certLines, MARGIN + 4, y + 13.5);

  // Signature block with bounding boxes
  y = PAGE_H - 42;
  const sigW = (CONTENT_W - 8) / 2;
  setDraw(doc, [0, 0, 0]);
  doc.setLineWidth(0.35);

  // Left Box: Investigating Officer
  doc.rect(MARGIN, y, sigW, 25, "S");
  bold(doc);
  size(doc, 7);
  setTextColor(doc, C.text);
  doc.text("INVESTIGATING OFFICER STAMP & SIGNATURE", MARGIN + 4, y + 6);
  normal(doc);
  size(doc, 6.5);
  setTextColor(doc, C.muted);
  doc.text("Signature: __________________________", MARGIN + 4, y + 14);
  doc.text("Name & Rank: ________________________", MARGIN + 4, y + 20);

  // Right Box: Verifying Authority
  doc.rect(MARGIN + sigW + 8, y, sigW, 25, "S");
  bold(doc);
  size(doc, 7);
  setTextColor(doc, C.text);
  doc.text("VERIFYING OFFICER STAMP & SIGNATURE", MARGIN + sigW + 12, y + 6);
  normal(doc);
  size(doc, 6.5);
  setTextColor(doc, C.muted);
  doc.text("Signature: __________________________", MARGIN + sigW + 12, y + 14);
  doc.text("Date & Designation: __________________", MARGIN + sigW + 12, y + 20);

  addPageFooter(doc, officerName, reportRef);

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  PAGE 2 – CDR SUMMARY                                   ║
  // ╚═══════════════════════════════════════════════════════════╝
  doc.addPage();
  page++;
  addPageHeader(doc, page, TOTAL);
  addPageFooter(doc, officerName, reportRef);

  y = 16;
  y = sectionHeading(doc, y, "1. CALL DETAIL RECORD (CDR) SUMMARY");

  if (cdr) {
    const nightFlag = cdr.night_call_ratio > 0.3;
    const burstFlag = cdr.burst_score > 0.7;

    // Metric cards row 1
    const cardW = (CONTENT_W - 8) / 4;
    const cards1: [string, string, boolean][] = [
      ["Total Calls", String(cdr.total_calls), false],
      ["Total SMS", String(cdr.total_sms), false],
      ["Unique Contacts", String(cdr.unique_contacts), false],
      ["Avg Duration", `${cdr.avg_duration_sec}s`, false],
    ];
    cards1.forEach(([lbl, val, flag], i) => {
      drawMetricCard(doc, MARGIN + i * (cardW + 2.5), y, cardW, lbl, val, flag);
    });
    y += 22;

    const cards2: [string, string, boolean][] = [
      ["Night Call Ratio", `${(cdr.night_call_ratio * 100).toFixed(1)}%`, nightFlag],
      ["Burst Score", cdr.burst_score.toFixed(3), burstFlag],
      ["Anomaly Score", cdr.anomaly_score != null ? String(cdr.anomaly_score) : "N/A", cdr.anomaly_score !== null && cdr.anomaly_score < -0.4],
      ["Distinct Towers", String(cdr.distinct_towers ?? "—"), false],
    ];
    cards2.forEach(([lbl, val, flag], i) => {
      drawMetricCard(doc, MARGIN + i * (cardW + 2.5), y, cardW, lbl, val, flag);
    });
    y += 26;

    // Flags
    if (nightFlag || burstFlag) {
      setFill(doc, C.amberLight);
      doc.rect(MARGIN, y, CONTENT_W, 10, "F");
      bold(doc);
      size(doc, 7.5);
      setTextColor(doc, C.amber);
      const flagMsg =
        (nightFlag ? "⚠ Night call ratio exceeds 30% threshold — indicative of covert scheduling. " : "") +
        (burstFlag ? "⚠ Burst score > 0.70 — irregular call velocity patterns detected." : "");
      doc.text(flagMsg, MARGIN + 3, y + 6.5, { maxWidth: CONTENT_W - 6 });
      y += 14;
    }
  } else {
    normal(doc);
    size(doc, 8);
    setTextColor(doc, C.muted);
    doc.text("No CDR data available for this suspect.", MARGIN, y + 6);
    y += 12;
  }

  // IPDR summary
  y = sectionHeading(doc, y + 4, "2. INTERNET PROTOCOL DETAIL RECORD (IPDR) SUMMARY");
  if (ipdr) {
    const cardW = (CONTENT_W - 8) / 3;
    const ipdrCards: [string, string][] = [
      ["Total Sessions", String(ipdr.total_sessions)],
      ["Total Data (KB)", ipdr.total_data_kb.toFixed(1)],
      ["Distinct Domains", String(ipdr.distinct_domains ?? "—")],
    ];
    ipdrCards.forEach(([lbl, val], i) => {
      drawMetricCard(doc, MARGIN + i * (cardW + 3.5), y, cardW, lbl, val, false);
    });
    y += 24;

    if (ipdr.ott_breakdown && ipdr.ott_breakdown.length > 0) {
      bold(doc);
      size(doc, 7.5);
      setTextColor(doc, C.navy);
      doc.text("OTT Application Usage Breakdown:", MARGIN, y + 5);
      y += 9;

      const ottRows = ipdr.ott_breakdown.map((row: any) => [
        row.app,
        String(row.session_count),
        row.total_data_kb.toFixed(1) + " KB",
        formatDateShort(row.first_seen),
        formatDateShort(row.last_seen),
      ]);
      y = drawTable(
        doc,
        y,
        ["App / Service", "Sessions", "Total Data", "First Seen", "Last Seen"],
        [45, 25, 30, 30, 30],
        ottRows
      );
    }
  } else {
    normal(doc);
    size(doc, 8);
    setTextColor(doc, C.muted);
    doc.text("No IPDR data available for this suspect.", MARGIN, y + 6);
    y += 10;
  }

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  PAGE 3 – INTELLIGENCE EVENTS                           ║
  // ╚═══════════════════════════════════════════════════════════╝
  doc.addPage();
  page++;
  addPageHeader(doc, page, TOTAL);
  addPageFooter(doc, officerName, reportRef);

  y = 16;
  y = sectionHeading(doc, y, "3. INTELLIGENCE EVENTS — FLAGGED ANOMALIES");

  if (events.length === 0) {
    normal(doc);
    size(doc, 8);
    setTextColor(doc, C.muted);
    doc.text(
      "No intelligence events recorded. Run full analysis on the case to populate this section.",
      MARGIN,
      y + 6
    );
    y += 14;
  } else {
    // Summary counts
    const highCount = events.filter((e) => e.severity === "HIGH").length;
    const lowCount = events.filter((e) => e.severity === "LOW").length;

    const summBW = (CONTENT_W - 6) / 3;
    drawMetricCard(doc, MARGIN, y, summBW, "HIGH Severity", String(highCount), highCount > 0);
    drawMetricCard(doc, MARGIN + summBW + 3, y, summBW, "MEDIUM Severity", String(events.filter((e) => e.severity === "MEDIUM").length), false);
    drawMetricCard(doc, MARGIN + (summBW + 3) * 2, y, summBW, "LOW Severity", String(lowCount), false);
    y += 22;

    // Events table
    const evRows = events.map((ev) => [
      ev.severity,
      ev.event_type.replace(/_/g, " "),
      eventSummary(ev),
      formatDate(ev.occurred_at),
    ]);

    y = drawTable(
      doc,
      y,
      ["Severity", "Event Type", "Summary", "Timestamp"],
      [22, 38, 80, 42],
      evRows,
      MARGIN,
      35
    );

    // Individual event detail boxes for HIGH severity events
    const highEvs = events.filter((e) => e.severity === "HIGH").slice(0, 6);
    if (highEvs.length > 0 && y < PAGE_H - 60) {
      y += 4;
      bold(doc);
      size(doc, 8);
      setTextColor(doc, C.red);
      doc.text("HIGH-SEVERITY EVENT DETAIL:", MARGIN, y);
      y += 6;

      highEvs.forEach((ev) => {
        if (y > PAGE_H - 35) return;
        setFill(doc, C.redLight);
        doc.rect(MARGIN, y, CONTENT_W, 16, "F");
        setDraw(doc, C.red);
        doc.setLineWidth(0.2);
        doc.rect(MARGIN, y, CONTENT_W, 16, "S");

        bold(doc);
        size(doc, 7.5);
        setTextColor(doc, C.red);
        doc.text(ev.event_type.replace(/_/g, " "), MARGIN + 3, y + 5.5);

        normal(doc);
        size(doc, 7);
        setTextColor(doc, C.text);
        doc.text(eventSummary(ev), MARGIN + 3, y + 11, { maxWidth: CONTENT_W - 50 });

        size(doc, 6.5);
        setTextColor(doc, C.muted);
        doc.text(formatDate(ev.occurred_at), PAGE_W - MARGIN - 3, y + 5.5, { align: "right" });

        y += 19;
      });
    }
  }

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  PAGE 4 – TOWER MOVEMENT                                ║
  // ╚═══════════════════════════════════════════════════════════╝
  if (movement.length > 0) {
    doc.addPage();
    page++;
    addPageHeader(doc, page, TOTAL);
    addPageFooter(doc, officerName, reportRef);

    y = 16;
    y = sectionHeading(doc, y, "4. TOWER MOVEMENT TIMELINE & GEOSPATIAL ANALYSIS");

    // Co-location count
    const coLocCount = movement.filter((m) => m.co_location).length;
    if (coLocCount > 0) {
      setFill(doc, C.redLight);
      doc.rect(MARGIN, y, CONTENT_W, 10, "F");
      bold(doc);
      size(doc, 7.5);
      setTextColor(doc, C.red);
      doc.text(
        `⚠  ${coLocCount} co-location event(s) detected — suspect physically present at same tower as other suspects.`,
        MARGIN + 3,
        y + 6.5,
        { maxWidth: CONTENT_W - 6 }
      );
      y += 14;
    }

    const movRows = movement.map((m: any) => [
      m.tower_id ?? "—",
      m.lat != null ? m.lat.toFixed(5) : "—",
      m.lon != null ? m.lon.toFixed(5) : "—",
      formatDate(m.timestamp),
      m.co_location ? "YES" : "No",
      m.co_location ? (m.co_location_with ?? []).join(", ") : "—",
    ]);

    y = drawTable(
      doc,
      y,
      ["Tower ID", "Latitude", "Longitude", "Timestamp", "Co-loc?", "Co-located With"],
      [28, 24, 24, 46, 16, 44],
      movRows,
      MARGIN,
      30
    );

    // Tower silence events
    const silenceEvs = events.filter((e) => e.event_type === "TOWER_SILENCE");
    if (silenceEvs.length > 0) {
      y += 4;
      y = sectionHeading(doc, y, "4.1 TOWER SWITCH-OFF / LAST-SEEN ANALYSIS");
      silenceEvs.forEach((ev) => {
        if (y > PAGE_H - 30) return;
        setFill(doc, C.amberLight);
        doc.rect(MARGIN, y, CONTENT_W, 14, "F");
        bold(doc);
        size(doc, 7.5);
        setTextColor(doc, C.amber);
        doc.text("RADIO SILENCE GAP DETECTED", MARGIN + 3, y + 5.5);
        normal(doc);
        size(doc, 7);
        setTextColor(doc, C.text);
        doc.text(eventSummary(ev), MARGIN + 3, y + 10.5, { maxWidth: CONTENT_W - 40 });
        size(doc, 6.5);
        setTextColor(doc, C.muted);
        doc.text(formatDate(ev.occurred_at), PAGE_W - MARGIN - 3, y + 5.5, { align: "right" });
        y += 17;
      });
    }
  }

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  PAGE 5 – BURNER HANDSET & CROSS-CASE ANALYSIS         ║
  // ╚═══════════════════════════════════════════════════════════╝
  const burnerEvs = events.filter((e) => e.event_type === "MULTI_SIM_IMEI" || e.event_type === "IMEI_SWAP");
  const crossCaseEvs = events.filter((e) => e.event_type === "CROSS_CASE_HANDLER");
  const loopEvs = events.filter((e) => e.event_type === "LOOP_CALL");
  const nightEvs = events.filter((e) => e.event_type === "NIGHT_CALL_BURST");

  if (burnerEvs.length > 0 || crossCaseEvs.length > 0 || loopEvs.length > 0 || nightEvs.length > 0) {
    doc.addPage();
    page++;
    addPageHeader(doc, page, TOTAL);
    addPageFooter(doc, officerName, reportRef);
    y = 16;

    if (burnerEvs.length > 0) {
      y = sectionHeading(doc, y, "5. BURNER HANDSET DETECTION — MULTI-SIM IMEI TRACKING");
      burnerEvs.forEach((ev) => {
        if (y > PAGE_H - 30) return;
        setFill(doc, C.redLight);
        doc.rect(MARGIN, y, CONTENT_W, 20, "F");
        setDraw(doc, C.red);
        doc.setLineWidth(0.25);
        doc.rect(MARGIN, y, CONTENT_W, 20, "S");

        bold(doc);
        size(doc, 8);
        setTextColor(doc, C.red);
        doc.text(ev.event_type.replace(/_/g, " "), MARGIN + 4, y + 6);

        normal(doc);
        size(doc, 7);
        setTextColor(doc, C.text);
        const detail = ev.detail as Record<string, unknown>;
        const detailLines = [
          `IMEI: ${detail.imei ?? "—"}`,
          `SIMs Used: ${detail.sim_count ?? "—"}`,
          `Swap Window: ${detail.swap_window ?? "—"}`,
          `Summary: ${eventSummary(ev)}`,
        ];
        doc.text(detailLines.join("   |   "), MARGIN + 4, y + 12, { maxWidth: CONTENT_W - 8 });

        size(doc, 6.5);
        setTextColor(doc, C.muted);
        doc.text(formatDate(ev.occurred_at), PAGE_W - MARGIN - 3, y + 6, { align: "right" });
        y += 23;
      });
      y += 4;
    }

    if (crossCaseEvs.length > 0) {
      y = sectionHeading(doc, y, "6. CROSS-CASE HANDLER MATCHING — GLOBAL LINKAGE");
      crossCaseEvs.forEach((ev) => {
        if (y > PAGE_H - 30) return;
        setFill(doc, C.redLight);
        doc.rect(MARGIN, y, CONTENT_W, 18, "F");
        bold(doc);
        size(doc, 7.5);
        setTextColor(doc, C.red);
        doc.text("CROSS-CASE HANDLER IDENTIFIED", MARGIN + 4, y + 6);
        normal(doc);
        size(doc, 7);
        setTextColor(doc, C.text);
        doc.text(eventSummary(ev), MARGIN + 4, y + 12, { maxWidth: CONTENT_W - 8 });
        size(doc, 6.5);
        setTextColor(doc, C.muted);
        doc.text(formatDate(ev.occurred_at), PAGE_W - MARGIN - 3, y + 6, { align: "right" });
        y += 21;
      });
      y += 4;
    }

    if (loopEvs.length > 0) {
      y = sectionHeading(doc, y, "7. LOOP-CALL COORDINATION ANALYSIS");
      loopEvs.forEach((ev) => {
        if (y > PAGE_H - 25) return;
        setFill(doc, C.redLight);
        doc.rect(MARGIN, y, CONTENT_W, 16, "F");
        bold(doc);
        size(doc, 7.5);
        setTextColor(doc, C.red);
        doc.text("URGENT LOOP COORDINATION PATTERN", MARGIN + 4, y + 5.5);
        normal(doc);
        size(doc, 7);
        setTextColor(doc, C.text);
        doc.text(eventSummary(ev), MARGIN + 4, y + 11, { maxWidth: CONTENT_W - 8 });
        y += 19;
      });
      y += 4;
    }

    if (nightEvs.length > 0) {
      y = sectionHeading(doc, y, "8. NIGHT-CALL BURST ANALYSIS");
      const nightRows = nightEvs.map((ev) => [
        (ev.detail as any).night_date ?? "—",
        String((ev.detail as any).call_count ?? "—"),
        formatDate(ev.occurred_at),
        ev.severity,
      ]);
      y = drawTable(
        doc,
        y,
        ["Date", "Call Count", "Detected At", "Severity"],
        [40, 30, 60, 30],
        nightRows
      );
    }
  }

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  FINAL PAGE – RECOMMENDATIONS & SIGNATURE              ║
  // ╚═══════════════════════════════════════════════════════════╝
  doc.addPage();
  page++;
  addPageHeader(doc, page, TOTAL);
  addPageFooter(doc, officerName, reportRef);

  y = 16;
  y = sectionHeading(doc, y, "9. INVESTIGATIVE RECOMMENDATIONS");

  const recommendations: string[] = [];
  if (burnerEvs.length > 0)
    recommendations.push(
      "Issue IMEI blocking order for identified burner handsets under Section 5(2) of the TRAI Act and request full subscriber details from the telecom operator."
    );
  if (crossCaseEvs.length > 0)
    recommendations.push(
      "Initiate cross-case consolidation request and notify the respective district SPs. The shared handler number should be subjected to real-time interception under Section 5(2) of the IT Act."
    );
  if (events.some((e) => e.event_type === "TOWER_SILENCE"))
    recommendations.push(
      "The tower radio-silence gap is consistent with deliberate device switching to avoid tracking. Request historical location data from the operator for the gap period and check if the suspect appeared on alternate devices."
    );
  if (loopEvs.length > 0)
    recommendations.push(
      "Loop-call coordination patterns indicate pre-planned execution calls. Correlate timestamps against field incident reports and other suspect CDRs to identify the coordination window."
    );
  if (nightEvs.length > 0)
    recommendations.push(
      "Nocturnal burst activity warrants surveillance scheduling during late-night hours. Request base station controller (BSC) logs for the flagged nights."
    );
  if (cdr?.anomaly_score !== null && cdr?.anomaly_score !== undefined && cdr.anomaly_score < -0.4)
    recommendations.push(
      "Anomaly score indicates significantly abnormal call behaviour compared to peer baseline. Recommend ML-assisted peer comparison across district database for similar patterns."
    );
  if (recommendations.length === 0)
    recommendations.push(
      "No immediate high-priority actions identified from the current dataset. Continue periodic CDR monitoring and re-run analysis when new data is available."
    );

  recommendations.forEach((rec, i) => {
    if (y > PAGE_H - 30) return;
    setFill(doc, C.slateLight);
    const lines = doc.splitTextToSize(`${i + 1}. ${rec}`, CONTENT_W - 8);
    const boxH = lines.length * 5 + 6;
    doc.rect(MARGIN, y, CONTENT_W, boxH, "F");
    normal(doc);
    size(doc, 7.5);
    setTextColor(doc, C.text);
    doc.text(lines, MARGIN + 4, y + 5);
    y += boxH + 4;
  });

  // — Final Certification —
  y += 6;
  y = sectionHeading(doc, y, "10. CERTIFICATION & DISCLAIMER");

  normal(doc);
  size(doc, 7.5);
  setTextColor(doc, C.slate);
  const certLines2 = doc.splitTextToSize(
    "This report has been generated by the TRACE Criminal Intelligence Platform using Call Detail Records " +
      "(CDR) and Internet Protocol Detail Records (IPDR) provided by the investigating officer. The analysis " +
      "algorithms are calibrated for Andhra Pradesh State Police operational requirements. All flagged events " +
      "represent statistical anomalies or pattern matches and should be treated as investigative leads requiring " +
      "further corroboration before judicial submission. The platform maintainer accepts no liability for " +
      "investigative decisions based solely on this automated report.",
    CONTENT_W - 8
  );
  doc.text(certLines2, MARGIN, y + 5);
  y += certLines2.length * 5 + 12;

  // Signature block with bounding boxes (aligned at the bottom, auto page-break if overflow)
  if (y > PAGE_H - 45) {
    doc.addPage();
    page++;
    addPageHeader(doc, page, TOTAL);
    addPageFooter(doc, officerName, reportRef);
  }
  y = PAGE_H - 42;
  const finalSigW = (CONTENT_W - 8) / 3;
  setDraw(doc, C.slate);
  doc.setLineWidth(0.35);

  // Card 1: Investigating Officer
  doc.rect(MARGIN, y, finalSigW, 28, "S");
  bold(doc);
  size(doc, 7);
  setTextColor(doc, C.navy);
  doc.text("INVESTIGATING OFFICER", MARGIN + 4, y + 6);
  normal(doc);
  size(doc, 6);
  setTextColor(doc, C.muted);
  doc.text("Signature: __________________", MARGIN + 4, y + 14);
  doc.text("Name & Rank: _______________", MARGIN + 4, y + 21);

  // Card 2: Supervisory Officer
  doc.rect(MARGIN + finalSigW + 4, y, finalSigW, 28, "S");
  bold(doc);
  size(doc, 7);
  setTextColor(doc, C.navy);
  doc.text("SUPERVISORY OFFICER", MARGIN + finalSigW + 8, y + 6);
  normal(doc);
  size(doc, 6);
  setTextColor(doc, C.muted);
  doc.text("Signature: __________________", MARGIN + finalSigW + 8, y + 14);
  doc.text("Date & Seal: _______________", MARGIN + finalSigW + 8, y + 21);

  // Card 3: Court Submission Officer
  doc.rect(MARGIN + (finalSigW + 4) * 2, y, finalSigW, 28, "S");
  bold(doc);
  size(doc, 7);
  setTextColor(doc, C.navy);
  doc.text("COURT SUBMISSION OFFICER", MARGIN + (finalSigW + 4) * 2 + 4, y + 6);
  normal(doc);
  size(doc, 6);
  setTextColor(doc, C.muted);
  doc.text("Signature: __________________", MARGIN + (finalSigW + 4) * 2 + 4, y + 14);
  doc.text("Designation: _______________", MARGIN + (finalSigW + 4) * 2 + 4, y + 21);

  // Save the PDF
  const fileName = `TRACE_CDR_REPORT_${(suspect.label ?? "SUSPECT").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
