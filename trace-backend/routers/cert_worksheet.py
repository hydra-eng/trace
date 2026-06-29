"""
TRACE - Section 65B Certificate Worksheet Router
=================================================
Legal Note (Anvar P.V. v. P.K. Basheer, 2014; Arjun Panditrao Khotkar, 2020):
A Section 65B(4) certificate is a personal sworn statement. This module produces
DRAFT WORKSHEETS only. Every PDF carries a diagonal watermark and explicit blank
certification fields. The app NEVER certifies on an officer's behalf.

Endpoints:
  GET  /cases/{id}/document-status              - current state + reviewer info
  POST /cases/{id}/mark-reviewed                - officer marks worksheet reviewed (audit-logged)
  POST /cases/{id}/export-certificate-worksheet - generate watermarked PDF worksheet
"""

import io
import hashlib
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Case, Suspect, CDRRecord, IPDRRecord
from routers.auth import require_permission
from routers.audit import log_audit
import config

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak,
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfgen import canvas

router = APIRouter(tags=["cert_worksheet"])
pt = 1

C_BLACK  = colors.HexColor("#000000")
C_MUTED  = colors.HexColor("#555555")
C_GHOST  = colors.HexColor("#888888")
C_BORDER = colors.HexColor("#CCCCCC")
C_ALT    = colors.HexColor("#F5F5F5")
C_BLANK  = colors.HexColor("#F8F8F8")

WATERMARK_TEXT = {
    "DRAFT":            "DRAFT - AUTOMATED ANALYSIS, UNVERIFIED",
    "PENDING_REVIEW":   "PENDING OFFICER REVIEW",
    "OFFICER_REVIEWED": "OFFICER REVIEWED - PENDING PHYSICAL SIGNATURE",
}


# ── Two-pass canvas with watermark ───────────────────────────────────────────
class WatermarkedCanvas(canvas.Canvas):
    def __init__(self, *args, watermark_text="DRAFT", report_id="UNKNOWN", **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self.watermark_text = watermark_text
        self.report_id = report_id
        self.generated_at = datetime.utcnow().strftime("%d %b %Y %H:%M UTC")

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_page_chrome(num_pages)
            super().showPage()
        super().save()

    def _draw_page_chrome(self, page_count):
        self.saveState()
        W, H = A4
        # Double legal border
        self.setStrokeColor(C_BLACK)
        self.setLineWidth(1.2)
        self.rect(35, 25, W - 70, H - 50)
        self.setLineWidth(0.4)
        self.rect(38, 28, W - 76, H - 56)
        # Diagonal watermark
        self.saveState()
        self.setFillColor(colors.Color(0, 0, 0, alpha=0.05))
        self.setFont("Helvetica-Bold", 36)
        self.translate(W / 2, H / 2)
        self.rotate(45)
        self.drawCentredString(0, 0, self.watermark_text)
        self.setFont("Helvetica-Bold", 18)
        self.drawCentredString(0, -38, "TRACE INTELLIGENCE PLATFORM")
        self.restoreState()
        if self._pageNumber == 1:
            self.restoreState()
            return
        # Header
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(C_BLACK)
        self.drawCentredString(W / 2, H - 36, "ANDHRA PRADESH STATE POLICE - SECTION 65B CERTIFICATE WORKSHEET")
        self.setFont("Helvetica", 6)
        self.setFillColor(C_GHOST)
        self.drawCentredString(W / 2, H - 44, "DRAFT - FOR OFFICER REVIEW ONLY - NOT A CERTIFIED DOCUMENT")
        self.setLineWidth(0.5)
        self.setStrokeColor(C_BLACK)
        self.line(42, H - 52, W - 42, H - 52)
        # Footer
        self.setLineWidth(0.5)
        self.line(42, 44, W - 42, 44)
        self.setFont("Helvetica", 5.5)
        self.setFillColor(C_GHOST)
        self.drawString(48, 33, f"TRACE Ref: {self.report_id} | Generated: {self.generated_at}")
        self.setFont("Helvetica-Bold", 6)
        self.setFillColor(C_BLACK)
        self.drawCentredString(W / 2, 33, f"Page {self._pageNumber} of {page_count}")
        self.setFont("Helvetica", 5.5)
        self.setFillColor(C_GHOST)
        self.drawRightString(W - 48, 33, "DRAFT WORKSHEET - NOT A LEGALLY BINDING DOCUMENT")
        self.restoreState()


def _make_canvas_factory(watermark_text, report_id):
    class _Canvas(WatermarkedCanvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, watermark_text=watermark_text, report_id=report_id, **kwargs)
    return _Canvas


# ── Data helpers ─────────────────────────────────────────────────────────────
def _compute_case_hash(case_id, db):
    records = (
        db.query(CDRRecord)
        .join(Suspect, CDRRecord.suspect_id == Suspect.id)
        .filter(Suspect.case_id == case_id)
        .order_by(CDRRecord.timestamp)
        .all()
    )
    count = len(records)
    if count == 0:
        return ("N/A - no CDR records loaded", 0, None)
    raw = "|".join(f"{r.msisdn_a}{r.msisdn_b}{r.timestamp}" for r in records)
    h = hashlib.sha256(raw.encode()).hexdigest()
    return (h, count, min(r.timestamp for r in records))


def _compute_ipdr_count(case_id, db):
    return (
        db.query(IPDRRecord)
        .join(Suspect, IPDRRecord.suspect_id == Suspect.id)
        .filter(Suspect.case_id == case_id)
        .count()
    )


def _blank_field(label, hint=""):
    s_lbl = ParagraphStyle("lbl", fontName="Times-Bold", fontSize=8, textColor=C_MUTED)
    s_hnt = ParagraphStyle("hnt", fontName="Times-Italic", fontSize=7, textColor=colors.HexColor("#AAAAAA"))
    left_col = [Paragraph(label, s_lbl)]
    if hint:
        left_col.append(Paragraph(hint, s_hnt))
    tbl = Table([[left_col, Table([[""]], colWidths=[330], rowHeights=[22])]], colWidths=[155, 340])
    tbl.setStyle(TableStyle([
        ("VALIGN",  (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,-1), 2),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
        ("RIGHTPADDING",  (0,0), (-1,-1), 0),
        ("BOX",        (1,0), (1,0), 0.8, C_BORDER),
        ("BACKGROUND", (1,0), (1,0), C_BLANK),
    ]))
    return tbl


# ── Main PDF builder ──────────────────────────────────────────────────────────
def _build_worksheet_pdf(case, db, report_id, document_status):
    buf = io.BytesIO()
    watermark = WATERMARK_TEXT.get(document_status, WATERMARK_TEXT["DRAFT"])

    suspects       = db.query(Suspect).filter(Suspect.case_id == case.id).all()
    data_hash, cdr_count, ingestion_ts = _compute_case_hash(case.id, db)
    ipdr_count     = _compute_ipdr_count(case.id, db)

    all_cdrs = (
        db.query(CDRRecord)
        .join(Suspect, CDRRecord.suspect_id == Suspect.id)
        .filter(Suspect.case_id == case.id)
        .all()
    )
    if all_cdrs:
        dates         = [r.timestamp for r in all_cdrs]
        analysis_from = min(dates).strftime("%d %b %Y")
        analysis_to   = max(dates).strftime("%d %b %Y")
    else:
        analysis_from = analysis_to = "N/A"

    _case_year   = case.created_at.year if case.created_at else datetime.now().year
    case_file_no = f"ONG/CID/{_case_year}/{case.id[:6].upper()}"
    today_long   = datetime.now().strftime("%d %B %Y")
    ingestion_lbl = ingestion_ts.strftime("%d %b %Y %H:%M UTC") if ingestion_ts else "Not yet ingested"

    # Styles
    s_title   = ParagraphStyle("t",  fontName="Times-Bold",   fontSize=13, textColor=C_BLACK, alignment=TA_CENTER, spaceBefore=3, spaceAfter=2)
    s_sub     = ParagraphStyle("su", fontName="Times-Roman",   fontSize=9,  textColor=C_MUTED, alignment=TA_CENTER)
    s_sect    = ParagraphStyle("se", fontName="Times-Bold",   fontSize=9.5,textColor=C_BLACK, spaceBefore=4, spaceAfter=1)
    s_body    = ParagraphStyle("bo", fontName="Times-Roman",   fontSize=8.5,textColor=C_BLACK, leading=11, alignment=TA_JUSTIFY)
    s_statute = ParagraphStyle("st", fontName="Times-Italic",  fontSize=8,  textColor=colors.HexColor("#333333"), leading=11, alignment=TA_JUSTIFY, leftIndent=8, rightIndent=8)
    s_cl      = ParagraphStyle("cl", fontName="Times-Bold",   fontSize=8.5,textColor=C_BLACK)
    s_cv      = ParagraphStyle("cv", fontName="Times-Roman",   fontSize=8.5,textColor=C_BLACK)
    s_pl      = ParagraphStyle("pl", fontName="Times-Bold",   fontSize=8)
    s_pv      = ParagraphStyle("pv", fontName="Courier",       fontSize=7.5,textColor=C_BLACK)

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=58*pt, bottomMargin=52*pt, leftMargin=50*pt, rightMargin=50*pt,
        title=f"Section 65B Worksheet - {case.name}",
        author="TRACE System - Prakasham District CID",
        subject="DRAFT Section 65B Certificate Worksheet - Not a certified document",
        creator="TRACE v2.4.0-stable",
    )
    story = []

    # ── COVER PAGE ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 12))
    for hdr in ["GOVERNMENT OF ANDHRA PRADESH", "ANDHRA PRADESH POLICE - PRAKASHAM DISTRICT CID"]:
        story.append(Paragraph(hdr, ParagraphStyle("cvd", fontName="Times-Bold", fontSize=9,
            textColor=C_BLACK, alignment=TA_CENTER)))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=C_BLACK))
    story.append(Spacer(1, 2))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BLACK))
    story.append(Spacer(1, 10))
    story.append(Paragraph("SECTION 65B CERTIFICATE", s_title))
    story.append(Paragraph("Indian Evidence Act, 1872 - Worksheet for Officer Certification", s_sub))
    story.append(Spacer(1, 6))

    status_color = {
        "DRAFT":            "#CC3300",
        "PENDING_REVIEW":   "#CC7700",
        "OFFICER_REVIEWED": "#007755",
    }.get(document_status, "#CC3300")
    status_label = {
        "DRAFT":            "DRAFT - AUTOMATED ANALYSIS, UNVERIFIED",
        "PENDING_REVIEW":   "PENDING OFFICER REVIEW",
        "OFFICER_REVIEWED": "OFFICER REVIEWED - PENDING PHYSICAL SIGNATURE AND SEAL",
    }.get(document_status, "DRAFT")

    banner = Table([[Paragraph(
        f"WARNING  DOCUMENT STATUS: {status_label}",
        ParagraphStyle("bn", fontName="Helvetica-Bold", fontSize=9,
            textColor=colors.HexColor(status_color), alignment=TA_CENTER),
    )]], colWidths=[495])
    banner.setStyle(TableStyle([
        ("BOX",        (0,0), (-1,-1), 1.5, colors.HexColor(status_color)),
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#FFF8F0")),
        ("TOPPADDING",    (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(banner)
    story.append(Spacer(1, 6))

    notice_para = (
        "IMPORTANT LEGAL NOTICE: This document is a machine-generated DRAFT worksheet. "
        "It has NOT been certified by any officer. It becomes legally effective ONLY after "
        "a responsible officer personally reviews the underlying source data, completes the "
        "blank certification fields below, and physically signs and seals the printed document "
        "outside this application. "
        "Ref: Anvar P.V. v. P.K. Basheer (2014) and Arjun Panditrao Khotkar v. Kailash "
        "Kushanrao Gorantyal (2020)."
    )
    notice = Table([[Paragraph(notice_para, ParagraphStyle("nt", fontName="Times-Roman",
        fontSize=8, textColor=C_BLACK, leading=11, alignment=TA_JUSTIFY))]], colWidths=[495])
    notice.setStyle(TableStyle([
        ("BOX",        (0,0), (-1,-1), 1, C_BORDER),
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#FFFDF0")),
        ("TOPPADDING",    (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("LEFTPADDING",   (0,0), (-1,-1), 10),
        ("RIGHTPADDING",  (0,0), (-1,-1), 10),
    ]))
    story.append(notice)
    story.append(Spacer(1, 8))

    cover_rows = [
        ["Case File No.",       case_file_no],
        ["Case Name",           case.name],
        ["Investigating Unit",  "Cyber Crime Cell, Prakasham District CID, Ongole"],
        ["No. of Subjects",     str(len(suspects))],
        ["Analysis Period",     f"{analysis_from} to {analysis_to}"],
        ["Worksheet Generated", today_long],
        ["Document Status",     document_status],
    ]
    if case.reviewed_at:
        cover_rows.append(["Reviewed At", case.reviewed_at.strftime("%d %b %Y %H:%M UTC")])

    cover_tbl = Table(
        [[Paragraph(f"<b>{r[0]}</b>", s_cl), Paragraph(r[1], s_cv)] for r in cover_rows],
        colWidths=[165, 330],
    )
    cover_tbl.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, C_ALT]),
        ("GRID", (0,0), (-1,-1), 0.4, C_BORDER),
        ("BOX",  (0,0), (-1,-1), 1,   C_BLACK),
        ("TOPPADDING",    (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
        ("RIGHTPADDING",  (0,0), (-1,-1), 6),
    ]))
    story.append(cover_tbl)
    story.append(PageBreak())

    # ── PAGE 2: DATA PROVENANCE ───────────────────────────────────────────────
    story.append(Paragraph("1. DATA PROVENANCE AND INTEGRITY RECORD", s_sect))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BLACK))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "The following information was automatically recorded by the TRACE platform at the time "
        "the electronic records were ingested. The SHA-256 hash allows any officer or court to "
        "verify that the dataset has not changed since ingestion. This hash does NOT verify the "
        "telecom-side integrity of the original file - it only confirms the data has not been "
        "altered within the TRACE system since ingestion.",
        s_body,
    ))
    story.append(Spacer(1, 6))

    prov_rows = [
        ["CDR Records Ingested",      str(cdr_count)],
        ["IPDR Records Ingested",     str(ipdr_count)],
        ["Telecom Operator (assumed)","Airtel / Jio / BSNL - Andhra Pradesh Circle"],
        ["Ingestion Timestamp",        ingestion_lbl],
        ["SHA-256 Hash",               data_hash],
    ]
    prov_tbl = Table(
        [[Paragraph(f"<b>{r[0]}</b>", s_pl), Paragraph(r[1], s_pv)] for r in prov_rows],
        colWidths=[165, 330],
    )
    prov_tbl.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, C_ALT]),
        ("GRID", (0,0), (-1,-1), 0.4, C_BORDER),
        ("BOX",  (0,0), (-1,-1), 1,   C_BLACK),
        ("TOPPADDING",    (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
        ("RIGHTPADDING",  (0,0), (-1,-1), 6),
    ]))
    story.append(prov_tbl)
    story.append(Spacer(1, 6))

    prov_box = Table([[Paragraph(
        f"Hash Provenance: Hash computed by TRACE on {ingestion_lbl} over the CDR/IPDR "
        f"dataset for case {case_file_no}. This hash value covers only the data as stored "
        "within the TRACE database and does not imply TRACE has verified the original "
        "telecom-side file integrity. The certifying officer must independently verify that "
        "this dataset was received through lawful process (e.g., production order, court order, "
        "or authorised interception under CrPC or TRAI regulations) before issuing the certificate.",
        ParagraphStyle("pb", fontName="Times-Roman", fontSize=8, textColor=C_MUTED, leading=10.5),
    )]], colWidths=[495])
    prov_box.setStyle(TableStyle([
        ("BOX",        (0,0), (-1,-1), 0.5, C_BORDER),
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#F0F4FF")),
        ("TOPPADDING",    (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
        ("RIGHTPADDING",  (0,0), (-1,-1), 8),
    ]))
    story.append(prov_box)
    story.append(Spacer(1, 14))

    # ── SECTION 65B(4) STATUTORY REFERENCE ───────────────────────────────────
    story.append(Paragraph("2. SECTION 65B(4) STATUTORY REFERENCE", s_sect))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BLACK))
    story.append(Spacer(1, 4))

    ref_hdr = Table([[Paragraph(
        "FOR OFFICER REVIEW - TO BE PERSONALLY ATTESTED BY THE CERTIFYING OFFICER",
        ParagraphStyle("rh", fontName="Helvetica-Bold", fontSize=8.5,
            textColor=colors.HexColor("#CC3300"), alignment=TA_CENTER),
    )]], colWidths=[495])
    ref_hdr.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#FFF0EC")),
        ("BOX",        (0,0), (-1,-1), 1.5, colors.HexColor("#CC3300")),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]))
    story.append(ref_hdr)
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "The following is the statutory text of Section 65B(4) of the Indian Evidence Act, 1872, "
        "reproduced here for the officer's reference. The certifying officer must read this text, "
        "verify its accuracy against the underlying source data, and personally attest to it by "
        "hand-signing the printed copy. This text block is a reference only and has no legal "
        "effect until personally signed by the responsible officer.",
        s_body,
    ))
    story.append(Spacer(1, 5))
    story.append(Paragraph(
        "I, ___________________________, [Designation] ___________________________, hereby "
        "certify in relation to the electronic records described in this worksheet, that to "
        "the best of my knowledge and belief:",
        s_statute,
    ))
    story.append(Spacer(1, 4))

    clauses = [
        ("(a)", "the computer output was produced by the computer during a period over which the "
                "computer was used regularly to store or process information for the purposes of "
                "any activities regularly carried on over that period by the investigating authority;"),
        ("(b)", "during the said period, information of the kind contained in the electronic record "
                "was regularly fed into the computer in the ordinary course of the said activities;"),
        ("(c)", "throughout the material part of the said period, the computer was operating properly "
                "or, if not, that any respect in which it was not operating properly or was out of "
                "operation during that part of that period was not such as to affect the production "
                "of the document or the accuracy of its contents;"),
        ("(d)", "the information contained in the electronic record reproduces or is derived from "
                "such information fed into the computer in the ordinary course of the said activities."),
    ]
    for marker, txt in clauses:
        ct = Table(
            [[Paragraph(f"<i>{marker}</i>",
                ParagraphStyle("m", fontName="Times-Italic", fontSize=8)),
              Paragraph(txt, s_statute)]],
            colWidths=[18, 477],
        )
        ct.setStyle(TableStyle([
            ("VALIGN",        (0,0), (-1,-1), "TOP"),
            ("TOPPADDING",    (0,0), (-1,-1), 1),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING",   (0,0), (-1,-1), 0),
            ("RIGHTPADDING",  (0,0), (-1,-1), 0),
        ]))
        story.append(ct)
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "The above certificate is issued in respect of the records listed in Section 1 of this worksheet.",
        s_statute,
    ))
    story.append(Spacer(1, 14))

    # ── SECTION 3: BLANK CERTIFICATION FIELDS ────────────────────────────────
    story.append(Paragraph("3. CERTIFICATION FIELDS - TO BE COMPLETED BY OFFICER IN PERSON", s_sect))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BLACK))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "The fields below must be completed by hand after the officer has personally reviewed "
        "the underlying source data. Leave no field blank. Do not ask software or a third "
        "party to complete these fields on your behalf.",
        ParagraphStyle("inst", fontName="Times-Roman", fontSize=8, textColor=C_MUTED, leading=11),
    ))
    story.append(Spacer(1, 8))

    for label, hint in [
        ("Certifying Officer Name:",    "Print full name - not pre-filled by software"),
        ("Designation / Rank:",         "e.g., Sub-Inspector, Inspector, DSP"),
        ("Badge / Payroll No.:",        ""),
        ("Investigating Unit:",         ""),
        ("Date of Certification:",      "dd/mm/yyyy - date officer physically signs"),
        ("Place of Certification:",     "City, District"),
        ("Production Order / LI Ref No.:", "Required to establish lawful basis for CDR/IPDR data"),
    ]:
        story.append(_blank_field(label, hint))
        story.append(Spacer(1, 4))

    story.append(Spacer(1, 12))

    # Signature boxes
    sig_lbl = Paragraph(
        "Signature and Official Seal<br/>"
        "<font size=7>(to be affixed by certifying officer - not generated by software)</font>",
        ParagraphStyle("sl", fontName="Times-Bold", fontSize=8.5, textColor=C_MUTED, alignment=TA_CENTER),
    )
    sig_box = Table([[sig_lbl]], colWidths=[220], rowHeights=[70])
    sig_box.setStyle(TableStyle([
        ("BOX",        (0,0), (-1,-1), 1.2, C_BLACK),
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#FAFAFA")),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("ALIGN",  (0,0), (-1,-1), "CENTER"),
    ]))

    sig2_lbl = Paragraph(
        "Counter-Signature (Supervising Officer)<br/>"
        "<font size=7>(if required by departmental procedure)</font>",
        ParagraphStyle("sl2", fontName="Times-Roman", fontSize=8.5, textColor=C_MUTED, alignment=TA_CENTER),
    )
    sig2_box = Table([[sig2_lbl]], colWidths=[220], rowHeights=[70])
    sig2_box.setStyle(TableStyle([
        ("BOX",        (0,0), (-1,-1), 1.2, C_BORDER),
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#FAFAFA")),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("ALIGN",  (0,0), (-1,-1), "CENTER"),
    ]))

    sig_row = Table([[sig_box, "", sig2_box]], colWidths=[220, 55, 220])
    sig_row.setStyle(TableStyle([
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",    (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
        ("RIGHTPADDING",  (0,0), (-1,-1), 0),
    ]))
    story.append(sig_row)
    story.append(Spacer(1, 10))

    disc = Table([[Paragraph(
        "This worksheet was produced by the TRACE Intelligence Platform (automated analysis). "
        "TRACE is a law enforcement analytical tool and does not constitute an officer of any "
        "court. The computed hash, record counts, and date ranges are system-generated values. "
        "All legal assertions in the Section 65B certificate must be made personally by the "
        "signing officer after their own independent verification.",
        ParagraphStyle("di", fontName="Times-Roman", fontSize=7.5, textColor=C_MUTED,
            leading=10, alignment=TA_JUSTIFY),
    )]], colWidths=[495])
    disc.setStyle(TableStyle([
        ("BOX",        (0,0), (-1,-1), 0.5, C_BORDER),
        ("BACKGROUND", (0,0), (-1,-1), C_ALT),
        ("TOPPADDING",    (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
        ("RIGHTPADDING",  (0,0), (-1,-1), 8),
    ]))
    story.append(disc)

    doc.build(story, canvasmaker=_make_canvas_factory(watermark, report_id))
    return buf.getvalue()


# ── API Endpoints ─────────────────────────────────────────────────────────────

@router.get("/cases/{case_id}/document-status")
def get_document_status(case_id: str, db: Session = Depends(get_db)):
    """Returns current document state machine status for a case."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return {
        "case_id": case_id,
        "document_status": case.document_status or "DRAFT",
        "reviewed_by_user_id": case.reviewed_by_user_id,
        "reviewed_at": case.reviewed_at.isoformat() if case.reviewed_at else None,
    }


@router.post("/cases/{case_id}/mark-reviewed")
def mark_case_reviewed(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("mark_reviewed")),
):
    """
    Officer marks the 65B worksheet as reviewed.
    IMPORTANT: This records the officer review in the audit trail only.
    It does NOT add a signature, seal, or certification text.
    Physical signing remains required for legal validity.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    previous_status = case.document_status or "DRAFT"
    user_id = current_user.get("sub", "unknown")
    now = datetime.utcnow()

    case.document_status = "OFFICER_REVIEWED"
    case.reviewed_by_user_id = user_id
    case.reviewed_at = now
    db.commit()
    db.refresh(case)

    log_audit(
        db=db,
        action_type="CASE_MARKED_REVIEWED",
        entity_type="Case",
        entity_id=case_id,
        entity_label=case.name,
        request=request,
        detail={
            "reviewed_by": user_id,
            "officer_name": current_user.get("name", ""),
            "officer_badge": current_user.get("badge", ""),
            "previous_status": previous_status,
            "new_status": "OFFICER_REVIEWED",
            "reviewed_at": now.isoformat(),
            "legal_note": (
                "This audit entry records that the officer accessed and reviewed the worksheet. "
                "It does NOT constitute a Section 65B certification. The certificate is only "
                "legally valid once physically signed and sealed."
            ),
        },
    )

    return {
        "case_id": case_id,
        "document_status": "OFFICER_REVIEWED",
        "reviewed_by_user_id": user_id,
        "reviewed_at": now.isoformat(),
        "message": (
            "Worksheet marked as reviewed. The PDF will now show "
            "'OFFICER REVIEWED - PENDING PHYSICAL SIGNATURE' watermark. "
            "The legal certificate is only complete after you physically sign and seal the printed copy."
        ),
    }


@router.post("/cases/{case_id}/export-certificate-worksheet")
def export_certificate_worksheet(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("download_pdf")),
):
    """
    Generates the Section 65B draft worksheet PDF.
    Enforces DEMO_MODE guardrail.
    PDF always carries diagonal watermark based on current document_status.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    suspects = db.query(Suspect).filter(Suspect.case_id == case_id).all()

    # DEMO_MODE guardrail
    if config.DEMO_MODE:
        non_compliant = [
            s.label for s in suspects
            if not config.DEMO_SUBJECT_PATTERN.match(s.label)
        ]
        if non_compliant:
            nc_str = ", ".join(non_compliant[:3])
            ellipsis = "..." if len(non_compliant) > 3 else ""
            raise HTTPException(
                status_code=403,
                detail=(
                    f"DEMO_MODE is active. Certificate worksheet export blocked because "
                    f"{len(non_compliant)} suspect name(s) do not match the required "
                    f"fictional placeholder pattern (SUBJECT-NNN): {nc_str}{ellipsis}. "
                    "Set TRACE_DEMO_MODE=false in the backend environment for real case exports."
                ),
            )

    # Advance status from DRAFT -> PENDING_REVIEW on first open
    if (case.document_status or "DRAFT") == "DRAFT":
        case.document_status = "PENDING_REVIEW"
        db.commit()
        db.refresh(case)

    document_status = case.document_status or "DRAFT"
    report_id = str(uuid.uuid4())[:8].upper()
    data_hash, cdr_count, _ = _compute_case_hash(case_id, db)
    ipdr_count = _compute_ipdr_count(case_id, db)
    user_id = current_user.get("sub", "unknown")

    pdf_bytes = _build_worksheet_pdf(case, db, report_id, document_status)

    log_audit(
        db=db,
        action_type="CERT_WORKSHEET_EXPORTED",
        entity_type="Case",
        entity_id=case_id,
        entity_label=case.name,
        request=request,
        detail={
            "exporting_user": user_id,
            "officer_name": current_user.get("name", ""),
            "officer_badge": current_user.get("badge", ""),
            "document_status_at_export": document_status,
            "data_hash_sha256": data_hash,
            "cdr_records": cdr_count,
            "ipdr_records": ipdr_count,
            "report_ref": report_id,
            "legal_note": (
                "This export is a DRAFT WORKSHEET. It has not been certified by any officer. "
                "The hash value records the state of the dataset at time of export."
            ),
        },
    )

    filename = f"TRACE_65B_Worksheet_{case.name.replace(' ', '_')}_{report_id}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
