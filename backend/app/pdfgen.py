"""Generate sample PDF proofs for the seed data so verifiers can review real files side by side.

Every page is clearly watermarked as a sample; the issuing bodies are fictional.
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

INSTITUTE = "PlaceMatrix Demo Institute of Technology"
BOARD = "Sample Board of Secondary Education"
W, H = A4


def _frame(c: canvas.Canvas, title: str, subtitle: str, issuer: str, accent) -> float:
    c.setFillColor(accent)
    c.rect(0, H - 32 * mm, W, 32 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 15)
    c.drawCentredString(W / 2, H - 14 * mm, issuer.upper())
    c.setFont("Helvetica", 9)
    c.drawCentredString(W / 2, H - 20 * mm, "Office of the Controller of Examinations")
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(W / 2, H - 27 * mm, title.upper())
    c.setFillColor(colors.HexColor("#4A5672"))
    c.setFont("Helvetica", 9)
    c.drawCentredString(W / 2, H - 38 * mm, subtitle)
    # Watermark
    c.saveState()
    c.setFillColor(colors.Color(0.85, 0.1, 0.1, alpha=0.08))
    c.setFont("Helvetica-Bold", 54)
    c.translate(W / 2, H / 2)
    c.rotate(35)
    c.drawCentredString(0, 0, "SAMPLE DOCUMENT")
    c.restoreState()
    c.setFillColor(colors.HexColor("#7A879E"))
    c.setFont("Helvetica", 7.5)
    c.drawCentredString(W / 2, 12 * mm, "Generated sample for the PlaceMatrix demo — not an official record.")
    return H - 50 * mm


def _kv(c: canvas.Canvas, y: float, rows: list[tuple[str, str]], x: float = 22 * mm, width: float = W - 44 * mm) -> float:
    c.setFont("Helvetica", 10)
    for k, v in rows:
        c.setFillColor(colors.HexColor("#4A5672"))
        c.drawString(x, y, k)
        c.setFillColor(colors.HexColor("#0E1A33"))
        c.setFont("Helvetica-Bold", 10)
        c.drawRightString(x + width, y, v)
        c.setFont("Helvetica", 10)
        c.setStrokeColor(colors.HexColor("#E4EAF3"))
        c.line(x, y - 2.5 * mm, x + width, y - 2.5 * mm)
        y -= 8 * mm
    return y


def _table(c: canvas.Canvas, y: float, header: list[str], rows: list[list[str]], widths: list[float]) -> float:
    x0 = 22 * mm
    c.setFillColor(colors.HexColor("#EEF2F8"))
    c.rect(x0, y - 2 * mm, sum(widths), 7 * mm, stroke=0, fill=1)
    c.setFillColor(colors.HexColor("#4A5672"))
    c.setFont("Helvetica-Bold", 9)
    x = x0
    for h, w in zip(header, widths):
        c.drawString(x + 2 * mm, y, h)
        x += w
    y -= 8 * mm
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor("#0E1A33"))
    for r in rows:
        x = x0
        for cell, w in zip(r, widths):
            c.drawString(x + 2 * mm, y, cell)
            x += w
        c.setStrokeColor(colors.HexColor("#E4EAF3"))
        c.line(x0, y - 2.5 * mm, x0 + sum(widths), y - 2.5 * mm)
        y -= 7.5 * mm
    return y


def grade_card(path: Path, s: dict) -> None:
    p = s["proof"]
    c = canvas.Canvas(str(path), pagesize=A4)
    y = _frame(c, "Consolidated Grade Card", f"{p.get('degree', s['degree'])} · {p.get('branch', s['branch'])}", INSTITUTE, colors.HexColor("#14213D"))
    y = _kv(c, y, [("Name", s["name"]), ("Entry No.", s["roll"]), ("Programme", p.get("degree", s["degree"])),
                   ("Discipline", p.get("branch", s["branch"]))])
    y -= 4 * mm
    rows = [[f"Semester {i + 1}", str(22 + i % 3), f"{g:.2f}"] for i, g in enumerate(s["semCgpa"])]
    y = _table(c, y, ["Semester", "Credits", "SGPA"], rows, [70 * mm, 40 * mm, 40 * mm])
    y -= 6 * mm
    c.setStrokeColor(colors.HexColor("#14213D"))
    c.roundRect(22 * mm, y - 18 * mm, W - 44 * mm, 22 * mm, 3 * mm)
    _kv(c, y - 4 * mm, [("Cumulative Grade Point Average (CGPA)", f"{p['cgpa']:.2f}"), ("Active backlogs", str(p.get("backlogs", 0)))],
        x=26 * mm, width=W - 52 * mm)
    c.showPage()
    c.save()


def marksheet(path: Path, s: dict, level: int) -> None:
    pct = s["proof"]["class10" if level == 10 else "class12"]
    subjects = (["English", "Hindi", "Mathematics", "Science", "Social Science"] if level == 10
                else ["English", "Physics", "Chemistry", "Mathematics", "Computer Science"])
    c = canvas.Canvas(str(path), pagesize=A4)
    title = "Secondary School Examination" if level == 10 else "Senior School Certificate Examination"
    y = _frame(c, "Marks Statement cum Certificate", title, BOARD, colors.HexColor("#14532D"))
    y = _kv(c, y, [("Candidate", s["name"]), ("Board Roll No.", f"{'1' if level == 10 else '2'}{s['roll'][-6:]}{level}")])
    y -= 4 * mm
    offsets = [1.2, -0.8, 0.6, -1.4, 0.4]
    rows = [[sub, "100", str(min(100, round(pct + offsets[i])))] for i, sub in enumerate(subjects)]
    y = _table(c, y, ["Subject", "Max", "Marks obtained"], rows, [80 * mm, 30 * mm, 40 * mm])
    y -= 6 * mm
    c.setStrokeColor(colors.HexColor("#14532D"))
    c.roundRect(22 * mm, y - 10 * mm, W - 44 * mm, 14 * mm, 3 * mm)
    _kv(c, y - 4 * mm, [("Aggregate percentage", f"{pct:.2f} %")], x=26 * mm, width=W - 52 * mm)
    c.showPage()
    c.save()


def resume(path: Path, s: dict, label: str | None) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setFillColor(colors.HexColor("#0E1A33"))
    c.setFont("Helvetica-Bold", 20)
    c.drawString(22 * mm, H - 28 * mm, s["name"])
    c.setFont("Helvetica", 9.5)
    c.setFillColor(colors.HexColor("#4A5672"))
    c.drawString(22 * mm, H - 35 * mm, f"{s['email']}  ·  {s['phone']}  ·  {s['roll']}")
    c.setStrokeColor(colors.HexColor("#3D5AE8"))
    c.setLineWidth(1.2)
    c.line(22 * mm, H - 39 * mm, W - 22 * mm, H - 39 * mm)
    y = H - 50 * mm
    sections = [
        ("Education", f"{s['degree']}, {s['branch']} — {INSTITUTE} · CGPA {s['cgpa']:.2f}"),
        ("Skills", " · ".join(s["skills"]) or "—"),
        ("Experience", "Software Intern — built internal tooling and data pipelines; reduced report latency by 38%."),
        ("Projects", f"{label or 'Resume'}: placement analytics dashboard, document verification assistant, distributed key-value store."),
        ("Achievements", "Top 5% in a national coding contest; teaching assistant for Data Structures."),
    ]
    for head, body in sections:
        c.setFillColor(colors.HexColor("#3D5AE8"))
        c.setFont("Helvetica-Bold", 10)
        c.drawString(22 * mm, y, head.upper())
        c.setFillColor(colors.HexColor("#0E1A33"))
        c.setFont("Helvetica", 10)
        c.drawString(22 * mm, y - 6 * mm, body[:110])
        y -= 18 * mm
    c.setFillColor(colors.HexColor("#7A879E"))
    c.setFont("Helvetica", 7.5)
    c.drawCentredString(W / 2, 12 * mm, "Sample resume generated for the PlaceMatrix demo.")
    c.showPage()
    c.save()


def generic(path: Path, s: dict, title: str) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    y = _frame(c, title, path.name, INSTITUTE, colors.HexColor("#3D5AE8"))
    _kv(c, y, [("Issued to", s["name"]), ("Reference", s["roll"])])
    c.showPage()
    c.save()


def make(path: Path, doc_type: str, s: dict, label: str | None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if doc_type == "GRADE_CARD":
        grade_card(path, s)
    elif doc_type == "CLASS10":
        marksheet(path, s, 10)
    elif doc_type == "CLASS12":
        marksheet(path, s, 12)
    elif doc_type == "RESUME":
        resume(path, s, label)
    else:
        generic(path, s, label or doc_type.replace("_", " ").title())
