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
  navyDark: [15, 23, 42] as [number, number, number],
  navy: [30, 41, 59] as [number, number, number],
  navyLight: [51, 65, 85] as [number, number, number],
  red: [185, 28, 28] as [number, number, number],
  redLight: [254, 226, 226] as [number, number, number],
  amber: [146, 64, 14] as [number, number, number],
  amberLight: [254, 243, 199] as [number, number, number],
  green: [21, 128, 61] as [number, number, number],
  greenLight: [220, 252, 231] as [number, number, number],
  slate: [71, 85, 105] as [number, number, number],
  slateLight: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  text: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
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
  doc.setFont("helvetica", "bold");
}
function normal(doc: jsPDF) {
  doc.setFont("helvetica", "normal");
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

function addPageHeader(doc: jsPDF, pageNum: number, totalPagesPlaceholder: string) {
  // Top navy stripe
  setFill(doc, C.navyDark);
  doc.rect(0, 0, PAGE_W, 10, "F");

  // Title left
  bold(doc);
  size(doc, 7);
  setTextColor(doc, [200, 210, 230]);
  doc.text("TRACE – CRIMINAL INTELLIGENCE PLATFORM", MARGIN, 6.5);

  // Page number right
  normal(doc);
  size(doc, 6.5);
  setTextColor(doc, [150, 165, 185]);
  doc.text(`Page ${pageNum} of ${totalPagesPlaceholder}`, PAGE_W - MARGIN, 6.5, { align: "right" });

  // Thin amber accent
  setFill(doc, [234, 179, 8]);
  doc.rect(0, 10, PAGE_W, 0.5, "F");
}

function addPageFooter(doc: jsPDF, officer: string, ref: string) {
  const y = PAGE_H - 8;
  setFill(doc, C.navyDark);
  doc.rect(0, PAGE_H - 10, PAGE_W, 10, "F");

  bold(doc);
  size(doc, 6);
  setTextColor(doc, [150, 165, 185]);
  doc.text(`Prepared by: ${officer}`, MARGIN, y);
  normal(doc);
  doc.text(`Ref: ${ref}`, PAGE_W / 2, y, { align: "center" });
  doc.text("CONFIDENTIAL — LAW ENFORCEMENT USE ONLY", PAGE_W - MARGIN, y, { align: "right" });
}

function sectionHeading(doc: jsPDF, y: number, title: string): number {
  setFill(doc, C.navy);
  doc.rect(MARGIN, y, CONTENT_W, 7, "F");
  bold(doc);
  size(doc, 8.5);
  setTextColor(doc, C.white);
  doc.text(title, MARGIN + 3, y + 4.8);
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
  setFill(doc, flag ? C.redLight : C.slateLight);
  doc.roundedRect(x, y, w, 18, 1.5, 1.5, "F");
  if (flag) {
    setDraw(doc, C.red);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, 18, 1.5, 1.5, "S");
  }
  size(doc, 6.5);
  setTextColor(doc, C.muted);
  normal(doc);
  doc.text(label.toUpperCase(), x + w / 2, y + 5.5, { align: "center" });
  bold(doc);
  size(doc, 11);
  setTextColor(doc, flag ? C.red : C.text);
  doc.text(value, x + w / 2, y + 13, { align: "center" });
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
  const rowH = 6.5;
  const headerH = 8;
  const totalW = widths.reduce((a, b) => a + b, 0);

  // Header background
  setFill(doc, C.navyLight);
  doc.rect(startX, y, totalW, headerH, "F");

  bold(doc);
  size(doc, 7);
  setTextColor(doc, C.white);

  let xCursor = startX + 2;
  headers.forEach((h, i) => {
    doc.text(h, xCursor, y + 5.5);
    xCursor += widths[i];
  });

  y += headerH;
  const displayedRows = rows.slice(0, maxRows);

  displayedRows.forEach((row, ri) => {
    const isEven = ri % 2 === 0;
    setFill(doc, isEven ? C.white : C.slateLight);
    doc.rect(startX, y, totalW, rowH, "F");

    normal(doc);
    size(doc, 6.8);
    setTextColor(doc, C.text);

    xCursor = startX + 2;
    row.forEach((cell, ci) => {
      const cellText = String(cell ?? "—").substring(0, 40);
      doc.text(cellText, xCursor, y + 4.5, {
        maxWidth: widths[ci] - 3,
      });
      xCursor += widths[ci];
    });

    // Row bottom border
    setDraw(doc, C.border);
    doc.setLineWidth(0.1);
    doc.line(startX, y + rowH, startX + totalW, y + rowH);

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

  return y + 3;
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

  // Full navy cover header
  setFill(doc, C.navyDark);
  doc.rect(0, 0, PAGE_W, 60, "F");

  // Amber accent stripe
  setFill(doc, [234, 179, 8]);
  doc.rect(0, 60, PAGE_W, 1.5, "F");

  // Government header text
  bold(doc);
  size(doc, 7);
  setTextColor(doc, [200, 210, 230]);
  doc.text("GOVERNMENT OF ANDHRA PRADESH", PAGE_W / 2, 10, { align: "center" });
  doc.text("ANDHRA PRADESH STATE POLICE — CYBERCRIME & CDR ANALYSIS DIVISION", PAGE_W / 2, 15, {
    align: "center",
  });

  // Main title
  bold(doc);
  size(doc, 22);
  setTextColor(doc, C.white);
  doc.text("CDR / IPDR ANALYSIS REPORT", PAGE_W / 2, 32, { align: "center" });

  size(doc, 11);
  setTextColor(doc, [234, 179, 8]);
  doc.text("Criminal Intelligence — Call Detail Record Examination", PAGE_W / 2, 40, {
    align: "center",
  });

  size(doc, 7.5);
  setTextColor(doc, [150, 165, 185]);
  normal(doc);
  doc.text(
    "Generated under Section 65B of the Indian Evidence Act, 1872",
    PAGE_W / 2,
    48,
    { align: "center" }
  );
  doc.text(`Report Reference: ${reportRef}`, PAGE_W / 2, 54, { align: "center" });

  // — Subject block —
  let y = 72;
  setFill(doc, C.slateLight);
  doc.roundedRect(MARGIN, y, CONTENT_W, 52, 2, 2, "F");
  setDraw(doc, C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_W, 52, 2, 2, "S");

  bold(doc);
  size(doc, 8);
  setTextColor(doc, C.muted);
  doc.text("SUBJECT OF ANALYSIS", MARGIN + 4, y + 6);

  // Divider line
  doc.setLineWidth(0.2);
  doc.line(MARGIN + 4, y + 8, MARGIN + CONTENT_W - 4, y + 8);

  const subjFields: [string, string][] = [
    ["Name / Label:", suspect.label ?? "Unknown"],
    ["Primary MSISDN:", suspect.primary_msisdn ?? "—"],
    ["Case Name:", caseName ?? "—"],
    ["Anomaly Score:", cdr?.anomaly_score != null ? String(cdr.anomaly_score) : "N/A"],
    ["Total Events:", String(events.length)],
    ["Report Generated:", generatedAt + " IST"],
  ];

  let ry = y + 13;
  subjFields.forEach(([lbl, val]) => {
    bold(doc);
    size(doc, 7.5);
    setTextColor(doc, C.slate);
    doc.text(lbl, MARGIN + 4, ry);
    normal(doc);
    setTextColor(doc, C.text);
    size(doc, 8);
    doc.text(val, MARGIN + 40, ry);
    ry += 7;
  });

  // — Risk flags —
  y = 132;
  const highEvents = events.filter((e) => e.severity === "HIGH");


  if (highEvents.length > 0) {
    setFill(doc, C.redLight);
    doc.roundedRect(MARGIN, y, CONTENT_W, 22, 2, 2, "F");
    setDraw(doc, C.red);
    doc.setLineWidth(0.4);
    doc.roundedRect(MARGIN, y, CONTENT_W, 22, 2, 2, "S");

    bold(doc);
    size(doc, 8);
    setTextColor(doc, C.red);
    doc.text("⚠  HIGH-RISK FLAGS DETECTED", MARGIN + 4, y + 7);
    normal(doc);
    size(doc, 7);
    setTextColor(doc, [153, 27, 27]);

    const flagTexts = highEvents
      .slice(0, 4)
      .map((e) => `• ${e.event_type.replace(/_/g, " ")} — ${eventSummary(e)}`);
    doc.text(flagTexts.join("\n"), MARGIN + 4, y + 13, { maxWidth: CONTENT_W - 8 });
    y += 28;
  } else {
    setFill(doc, C.greenLight);
    doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, "F");
    bold(doc);
    size(doc, 8);
    setTextColor(doc, C.green);
    doc.text("✓  No high-severity events detected in this analysis window.", MARGIN + 4, y + 8);
    y += 20;
  }

  // — Section 65B notice —
  y = Math.max(y + 4, 170);
  setFill(doc, [248, 250, 252]);
  doc.roundedRect(MARGIN, y, CONTENT_W, 50, 2, 2, "F");
  setDraw(doc, C.border);
  doc.roundedRect(MARGIN, y, CONTENT_W, 50, 2, 2, "S");

  bold(doc);
  size(doc, 8);
  setTextColor(doc, C.navy);
  doc.text("SECTION 65B CERTIFICATE — ELECTRONIC EVIDENCE", MARGIN + 4, y + 7);

  normal(doc);
  size(doc, 7);
  setTextColor(doc, C.slate);
  const certText =
    "I, the authorised officer of TRACE – Criminal Intelligence Platform, do hereby certify that the " +
    "computer-generated Call Detail Records (CDR) and Internet Protocol Detail Records (IPDR) forming " +
    "the basis of this report were produced by a computer system that was in regular use during the " +
    "period in question, was functioning properly, and was not subject to any failure or irregularity " +
    "that could affect the accuracy of the data. This certificate is issued under Section 65B(4) of " +
    "the Indian Evidence Act, 1872 and the relevant provisions of the Information Technology Act, 2000.";
  const certLines = doc.splitTextToSize(certText, CONTENT_W - 8);
  doc.text(certLines, MARGIN + 4, y + 14);

  // Signature block with bounding boxes
  y = PAGE_H - 42;
  const sigW = (CONTENT_W - 8) / 2;
  setDraw(doc, C.slate);
  doc.setLineWidth(0.35);

  // Left Box: Investigating Officer
  doc.roundedRect(MARGIN, y, sigW, 28, 1.5, 1.5, "S");
  bold(doc);
  size(doc, 7.5);
  setTextColor(doc, C.navy);
  doc.text("INVESTIGATING OFFICER", MARGIN + 4, y + 6);
  normal(doc);
  size(doc, 6.5);
  setTextColor(doc, C.muted);
  doc.text("Signature: __________________________", MARGIN + 4, y + 14);
  doc.text("Name & Rank: ________________________", MARGIN + 4, y + 21);

  // Right Box: Verifying Authority
  doc.roundedRect(MARGIN + sigW + 8, y, sigW, 28, 1.5, 1.5, "S");
  bold(doc);
  size(doc, 7.5);
  setTextColor(doc, C.navy);
  doc.text("VERIFYING AUTHORITY / DSP", MARGIN + sigW + 12, y + 6);
  normal(doc);
  size(doc, 6.5);
  setTextColor(doc, C.muted);
  doc.text("Signature: __________________________", MARGIN + sigW + 12, y + 14);
  doc.text("Date & Seal: ________________________", MARGIN + sigW + 12, y + 21);

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
      doc.roundedRect(MARGIN, y, CONTENT_W, 10, 1.5, 1.5, "F");
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
        doc.roundedRect(MARGIN, y, CONTENT_W, 16, 1.5, 1.5, "F");
        setDraw(doc, C.red);
        doc.setLineWidth(0.2);
        doc.roundedRect(MARGIN, y, CONTENT_W, 16, 1.5, 1.5, "S");

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
      doc.roundedRect(MARGIN, y, CONTENT_W, 10, 1.5, 1.5, "F");
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
        doc.roundedRect(MARGIN, y, CONTENT_W, 14, 1.5, 1.5, "F");
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
        doc.roundedRect(MARGIN, y, CONTENT_W, 20, 1.5, 1.5, "F");
        setDraw(doc, C.red);
        doc.setLineWidth(0.25);
        doc.roundedRect(MARGIN, y, CONTENT_W, 20, 1.5, 1.5, "S");

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
        doc.roundedRect(MARGIN, y, CONTENT_W, 18, 1.5, 1.5, "F");
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
        doc.roundedRect(MARGIN, y, CONTENT_W, 16, 1.5, 1.5, "F");
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
    doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 1.5, 1.5, "F");
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
  doc.roundedRect(MARGIN, y, finalSigW, 28, 1.5, 1.5, "S");
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
  doc.roundedRect(MARGIN + finalSigW + 4, y, finalSigW, 28, 1.5, 1.5, "S");
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
  doc.roundedRect(MARGIN + (finalSigW + 4) * 2, y, finalSigW, 28, 1.5, 1.5, "S");
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
