import logging
from io import BytesIO

import docx
from docx.shared import Pt, RGBColor
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.schemas.handover import EvidenceReference, HandoverReportDetailRead

logger = logging.getLogger(__name__)


class HandoverExporter:
    """Renders handover reports into Markdown, PDF, and DOCX formats with evidence appendices."""

    def export_markdown(self, report: HandoverReportDetailRead) -> str:
        """Exports report to GitHub-Flavored Markdown with footnote citations and Evidence Appendix."""
        lines: list[str] = []

        lines.append(f"# {report.title} (v{report.version})")
        lines.append("")
        lines.append(
            f"> **Status:** `{report.status.value.upper()}` | **Generated:** {report.generated_at.strftime('%Y-%m-%d %H:%M UTC')}"
        )
        if report.approved_at:
            lines.append(f"> **Approved:** {report.approved_at.strftime('%Y-%m-%d %H:%M UTC')}")
        if report.departing_member_name:
            lines.append(f"> **Departing Member:** {report.departing_member_name}")
        if report.focus_area:
            lines.append(f"> **Focus Area:** {report.focus_area}")
        lines.append(
            f"> **Claims Verification:** {report.verified_claims}/{report.total_claims} verified ({round(report.verified_claims / max(report.total_claims, 1) * 100, 1)}%)"
        )
        lines.append("")
        lines.append("---")
        lines.append("")

        # Collect global unique evidence references for footnote indexing
        evidence_index_map: dict[str, int] = {}
        all_evidences: list[EvidenceReference] = []

        for sec in report.sections.values():
            for ev in sec.evidence_references:
                ev_key = str(ev.evidence_id)
                if ev_key not in evidence_index_map:
                    evidence_index_map[ev_key] = len(all_evidences) + 1
                    all_evidences.append(ev)

        # Render Sections
        for sec in report.sections.values():
            lines.append(f"## {sec.title}")
            lines.append("")
            if sec.narrative:
                lines.append(sec.narrative)
                lines.append("")

            if sec.claims:
                for c in sec.claims:
                    badges = []
                    if c.flagged_unverified:
                        badges.append("`[FLAGGED - UNVERIFIED]`")
                    elif c.origin == "explicit_fact":
                        badges.append("`[VERIFIED FACT]`")
                    else:
                        badges.append("`[AI INFERENCE]`")

                    badges.append(f"`[{c.review_status.upper()}]`")

                    # Footnotes
                    fn_refs = []
                    for ev in c.evidence_references:
                        idx = evidence_index_map.get(str(ev.evidence_id))
                        if idx:
                            fn_refs.append(f"[^{idx}]")

                    fn_str = " " + "".join(fn_refs) if fn_refs else ""
                    badge_str = " ".join(badges) + " " if badges else ""
                    lines.append(f"- {badge_str}{c.text}{fn_str}")

                lines.append("")

            lines.append("---")
            lines.append("")

        # Render Evidence Appendix
        lines.append("## Evidence & Grounding Appendix")
        lines.append("")
        lines.append(
            "The following source citations directly back the statements in this handover report:"
        )
        lines.append("")

        if not all_evidences:
            lines.append("_No external evidence references recorded._")
        else:
            for idx, ev in enumerate(all_evidences, start=1):
                doc_name = ev.document_name or "Project Document"
                status_str = f"[{ev.review_status.upper()}]"
                verified_str = "✓ Verified" if ev.verified else "⚠ Unverified"
                lines.append(
                    f"[^{idx}]: **{doc_name}** (`{ev.source_locator}`) — *{status_str} ({verified_str}, conf: {ev.confidence:.2f})*  \n"
                    f'    > "{ev.exact_excerpt}"  \n'
                    f"    *Knowledge Item: {ev.knowledge_item_title}*"
                )

        lines.append("")
        return "\n".join(lines)

    def export_pdf(self, report: HandoverReportDetailRead) -> bytes:
        """Exports report to formatted PDF bytes using ReportLab."""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Title"],
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#1e293b"),
            alignment=0,
            spaceAfter=10,
        )
        h1_style = ParagraphStyle(
            "Heading1_Custom",
            parent=styles["Heading1"],
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=14,
            spaceAfter=6,
            keepWithNext=True,
        )
        body_style = ParagraphStyle(
            "Body_Custom",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#334155"),
            spaceAfter=6,
        )
        bullet_style = ParagraphStyle(
            "Bullet_Custom",
            parent=styles["Normal"],
            fontSize=9.5,
            leading=13.5,
            textColor=colors.HexColor("#1e293b"),
            leftIndent=15,
            spaceAfter=4,
        )
        meta_style = ParagraphStyle(
            "Meta_Custom",
            parent=styles["Italic"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#64748b"),
        )

        story = []

        # Title & Metadata
        story.append(Paragraph(f"{report.title} (v{report.version})", title_style))
        meta_text = (
            f"<b>Status:</b> {report.status.value.upper()} | "
            f"<b>Generated:</b> {report.generated_at.strftime('%Y-%m-%d %H:%M UTC')} | "
            f"<b>Verification:</b> {report.verified_claims}/{report.total_claims} claims verified"
        )
        if report.departing_member_name:
            meta_text += f"<br/><b>Departing Member:</b> {report.departing_member_name}"
        if report.focus_area:
            meta_text += f" | <b>Focus Area:</b> {report.focus_area}"

        story.append(Paragraph(meta_text, meta_style))
        story.append(Spacer(1, 10))
        story.append(
            HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=12)
        )

        # Evidence index map
        evidence_index_map: dict[str, int] = {}
        all_evidences: list[EvidenceReference] = []

        for sec in report.sections.values():
            for ev in sec.evidence_references:
                ev_key = str(ev.evidence_id)
                if ev_key not in evidence_index_map:
                    evidence_index_map[ev_key] = len(all_evidences) + 1
                    all_evidences.append(ev)

        # Sections
        for sec in report.sections.values():
            story.append(Paragraph(sec.title, h1_style))
            if sec.narrative:
                story.append(Paragraph(sec.narrative, body_style))

            if sec.claims:
                for c in sec.claims:
                    fn_refs = [
                        f"[{evidence_index_map[str(ev.evidence_id)]}]"
                        for ev in c.evidence_references
                        if str(ev.evidence_id) in evidence_index_map
                    ]
                    fn_suffix = f" <sup>{', '.join(fn_refs)}</sup>" if fn_refs else ""
                    tag_prefix = (
                        "<b>[UNVERIFIED]</b> "
                        if c.flagged_unverified
                        else f"<b>[{c.review_status.upper()}]</b> "
                    )
                    story.append(Paragraph(f"• {tag_prefix}{c.text}{fn_suffix}", bullet_style))

            story.append(Spacer(1, 8))

        # Appendix
        story.append(
            HRFlowable(
                width="100%",
                thickness=1,
                color=colors.HexColor("#cbd5e1"),
                spaceBefore=10,
                spaceAfter=10,
            )
        )
        story.append(Paragraph("Evidence & Grounding Appendix", h1_style))

        if not all_evidences:
            story.append(Paragraph("No evidence citations recorded.", body_style))
        else:
            table_data = [["Ref", "Document / Locator", "Excerpt", "Status"]]
            for idx, ev in enumerate(all_evidences, start=1):
                doc_name = ev.document_name or "Document"
                table_data.append(
                    [
                        f"[{idx}]",
                        f"{doc_name}\n({ev.source_locator})",
                        ev.exact_excerpt[:150] + ("..." if len(ev.exact_excerpt) > 150 else ""),
                        f"{ev.review_status}\n({'✓' if ev.verified else '⚠'})",
                    ]
                )

            t = Table(table_data, colWidths=[30, 140, 290, 60])
            t.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        (
                            "ROWBACKGROUNDS",
                            (0, 1),
                            (-1, -1),
                            [colors.white, colors.HexColor("#f8fafc")],
                        ),
                    ]
                )
            )
            story.append(t)

        doc.build(story)
        return buffer.getvalue()

    def export_docx(self, report: HandoverReportDetailRead) -> bytes:
        """Exports report to Microsoft Word (.docx) bytes."""
        doc = docx.Document()

        # Document Header
        title_p = doc.add_paragraph()
        title_run = title_p.add_run(f"{report.title} (v{report.version})")
        title_run.font.size = Pt(20)
        title_run.font.bold = True
        title_run.font.color.rgb = RGBColor(15, 23, 42)

        meta_p = doc.add_paragraph()
        meta_run = meta_p.add_run(
            f"Status: {report.status.value.upper()} | "
            f"Generated: {report.generated_at.strftime('%Y-%m-%d %H:%M UTC')} | "
            f"Verification: {report.verified_claims}/{report.total_claims} verified"
        )
        meta_run.font.size = Pt(9.5)
        meta_run.font.italic = True
        meta_run.font.color.rgb = RGBColor(100, 116, 139)

        if report.departing_member_name or report.focus_area:
            extra_p = doc.add_paragraph()
            extra_text = []
            if report.departing_member_name:
                extra_text.append(f"Departing Member: {report.departing_member_name}")
            if report.focus_area:
                extra_text.append(f"Focus Area: {report.focus_area}")
            extra_run = extra_p.add_run(" | ".join(extra_text))
            extra_run.font.size = Pt(9.5)
            extra_run.font.italic = True

        doc.add_paragraph().paragraph_format.space_after = Pt(10)

        # Evidence indexing
        evidence_index_map: dict[str, int] = {}
        all_evidences: list[EvidenceReference] = []

        for sec in report.sections.values():
            for ev in sec.evidence_references:
                ev_key = str(ev.evidence_id)
                if ev_key not in evidence_index_map:
                    evidence_index_map[ev_key] = len(all_evidences) + 1
                    all_evidences.append(ev)

        # Sections
        for sec in report.sections.values():
            h = doc.add_heading(sec.title, level=1)
            h.paragraph_format.space_before = Pt(14)
            h.paragraph_format.space_after = Pt(6)

            if sec.narrative:
                p = doc.add_paragraph(sec.narrative)
                p.paragraph_format.space_after = Pt(6)

            if sec.claims:
                for c in sec.claims:
                    p = doc.add_paragraph(style="List Bullet")
                    tag = (
                        "[UNVERIFIED] " if c.flagged_unverified else f"[{c.review_status.upper()}] "
                    )
                    tag_run = p.add_run(tag)
                    tag_run.font.bold = True
                    tag_run.font.size = Pt(9.5)

                    text_run = p.add_run(c.text)
                    text_run.font.size = Pt(9.5)

                    fn_refs = [
                        f"[{evidence_index_map[str(ev.evidence_id)]}]"
                        for ev in c.evidence_references
                        if str(ev.evidence_id) in evidence_index_map
                    ]
                    if fn_refs:
                        fn_run = p.add_run(f" ({', '.join(fn_refs)})")
                        fn_run.font.size = Pt(8.5)
                        fn_run.font.italic = True
                        fn_run.font.color.rgb = RGBColor(71, 85, 105)

        # Evidence Appendix Table
        doc.add_page_break()
        h_app = doc.add_heading("Evidence & Grounding Appendix", level=1)
        h_app.paragraph_format.space_after = Pt(8)

        if all_evidences:
            table = doc.add_table(rows=1, cols=4)
            table.style = "Table Grid"
            hdr_cells = table.rows[0].cells
            hdr_cells[0].text = "Ref"
            hdr_cells[1].text = "Document / Locator"
            hdr_cells[2].text = "Exact Excerpt"
            hdr_cells[3].text = "Status / Verified"

            for idx, ev in enumerate(all_evidences, start=1):
                row_cells = table.add_row().cells
                row_cells[0].text = f"[{idx}]"
                doc_name = ev.document_name or "Document"
                row_cells[1].text = f"{doc_name}\n({ev.source_locator})"
                row_cells[2].text = ev.exact_excerpt
                row_cells[
                    3
                ].text = f"{ev.review_status}\n({'Verified' if ev.verified else 'Unverified'})"

        buffer = BytesIO()
        doc.save(buffer)
        return buffer.getvalue()


_global_exporter: HandoverExporter | None = None


def get_handover_exporter() -> HandoverExporter:
    global _global_exporter
    if _global_exporter is None:
        _global_exporter = HandoverExporter()
    return _global_exporter
