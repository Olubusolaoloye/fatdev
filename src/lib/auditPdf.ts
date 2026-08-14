/**
 * auditPdf.ts — renders a branded FatDev audit report as a real downloadable PDF.
 *
 * Uses jsPDF's built-in Helvetica, which has no emoji glyphs — status is drawn
 * as coloured dots and PASS/WARN/FAIL words rather than ✅/⚠️/❌.
 */
import { jsPDF } from 'jspdf'

export type PdfCheck = {
  label: string
  detail: string
  score: number
  max: number
  pass: boolean
  warn?: boolean
}

export type PdfSection = {
  title: string
  checks: PdfCheck[]
}

export type AuditReportData = {
  tokenName: string
  tokenSymbol: string
  contractAddress: string
  chainName: string
  grade: string
  totalScore: number
  maxScore: number
  pct: number
  sections: PdfSection[]
  onChain: { verified: boolean; ownerRenounced: boolean; hasLiquidity: boolean } | null
}

// ── Palette (RGB) ─────────────────────────────────────────────────────────────
const NAVY   : [number, number, number] = [8, 12, 24]
const CYAN   : [number, number, number] = [0, 176, 217]
const GREEN  : [number, number, number] = [0, 168, 89]
const AMBER  : [number, number, number] = [214, 138, 0]
const RED    : [number, number, number] = [214, 48, 48]
const INK    : [number, number, number] = [26, 32, 44]
const MUTED  : [number, number, number] = [113, 128, 150]
const HAIR   : [number, number, number] = [226, 232, 240]

const PAGE_W = 595.28
const PAGE_H = 841.89
const M      = 44                 // page margin
const CONTENT_W = PAGE_W - M * 2

function gradeColor(grade: string): [number, number, number] {
  if (grade === 'A') return GREEN
  if (grade === 'B') return CYAN
  if (grade === 'C') return AMBER
  return RED
}

function checkColor(c: PdfCheck): [number, number, number] {
  if (c.pass) return GREEN
  if (c.warn) return AMBER
  return RED
}

function checkWord(c: PdfCheck): string {
  if (c.pass) return 'PASS'
  if (c.warn) return 'WARN'
  return 'FAIL'
}

export function generateAuditPdf(d: AuditReportData): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const now = new Date()
  const stamp = now.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  // ── Header band ─────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PAGE_W, 104, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(21)
  doc.setTextColor(255, 255, 255)
  doc.text('Fat', M, 46)
  const fatW = doc.getTextWidth('Fat')
  doc.setTextColor(...CYAN)
  doc.text('Dev', M + fatW, 46)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(150, 165, 185)
  doc.text('TOKEN AUDIT REPORT', M, 64)

  doc.setFontSize(8)
  doc.text(`Generated ${stamp}`, PAGE_W - M, 46, { align: 'right' })
  doc.text('fatdev.io', PAGE_W - M, 60, { align: 'right' })

  // Cyan accent rule under the band
  doc.setFillColor(...CYAN)
  doc.rect(0, 104, PAGE_W, 3, 'F')

  let y = 104 + 34

  // ── Score hero ──────────────────────────────────────────────────────────────
  const gc = gradeColor(d.grade)
  const heroH = 108

  doc.setDrawColor(...HAIR)
  doc.setLineWidth(0.8)
  doc.roundedRect(M, y, CONTENT_W, heroH, 8, 8, 'S')

  // Grade block on the left
  doc.setFillColor(gc[0], gc[1], gc[2])
  doc.roundedRect(M + 1, y + 1, 96, heroH - 2, 8, 8, 'F')
  doc.setFillColor(gc[0], gc[1], gc[2])
  doc.rect(M + 80, y + 1, 17, heroH - 2, 'F')   // square off the right edge

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(48)
  doc.setTextColor(255, 255, 255)
  doc.text(d.grade, M + 48, y + 62, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('GRADE', M + 48, y + 80, { align: 'center' })

  // Token identity
  const tx = M + 118
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...INK)
  const nameLine = d.tokenName || 'Unnamed Token'
  doc.text(nameLine.length > 34 ? nameLine.slice(0, 34) + '…' : nameLine, tx, y + 28)

  if (d.tokenSymbol) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(`(${d.tokenSymbol})`, tx + doc.getTextWidth(nameLine.slice(0, 34)) + 8, y + 28)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(gc[0], gc[1], gc[2])
  doc.text(`${d.totalScore} / ${d.maxScore}`, tx, y + 54)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...MUTED)
  doc.text(`${d.pct}%`, tx + doc.getTextWidth(`${d.totalScore} / ${d.maxScore}`) + 10, y + 54)

  // Progress bar
  const barX = tx, barY = y + 66, barW = CONTENT_W - 118 - 24, barH = 7
  doc.setFillColor(...HAIR)
  doc.roundedRect(barX, barY, barW, barH, 3.5, 3.5, 'F')
  if (d.pct > 0) {
    doc.setFillColor(gc[0], gc[1], gc[2])
    doc.roundedRect(barX, barY, Math.max((barW * d.pct) / 100, 7), barH, 3.5, 3.5, 'F')
  }

  // Contract line
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(
    d.contractAddress ? `${d.contractAddress}  ·  ${d.chainName}` : `Wizard configuration  ·  ${d.chainName}`,
    barX, y + 90
  )

  y += heroH + 26

  // ── On-chain status strip ───────────────────────────────────────────────────
  if (d.onChain) {
    const items: [string, boolean][] = [
      ['Source verified',    d.onChain.verified],
      ['Ownership renounced', d.onChain.ownerRenounced],
      ['Liquidity detected', d.onChain.hasLiquidity],
    ]
    const cellW = CONTENT_W / 3

    doc.setDrawColor(...HAIR)
    doc.roundedRect(M, y, CONTENT_W, 42, 6, 6, 'S')

    items.forEach(([label, ok], i) => {
      const cx = M + cellW * i + 16
      const col = ok ? GREEN : AMBER
      doc.setFillColor(col[0], col[1], col[2])
      doc.circle(cx + 4, y + 21, 4, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...INK)
      doc.text(label, cx + 15, y + 18)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(col[0], col[1], col[2])
      doc.text(ok ? 'Yes' : 'No', cx + 15, y + 30)

      if (i < 2) {
        doc.setDrawColor(...HAIR)
        doc.line(M + cellW * (i + 1), y + 8, M + cellW * (i + 1), y + 34)
      }
    })

    y += 42 + 26
  }

  // ── Page-break helper ───────────────────────────────────────────────────────
  function ensure(space: number) {
    if (y + space > PAGE_H - 64) {
      doc.addPage()
      y = M + 12
    }
  }

  // ── Sections ────────────────────────────────────────────────────────────────
  for (const section of d.sections) {
    const secScore = section.checks.reduce((a, c) => a + c.score, 0)
    const secMax   = section.checks.reduce((a, c) => a + c.max, 0)

    ensure(64)

    // Section header
    doc.setFillColor(247, 249, 252)
    doc.setDrawColor(...HAIR)
    doc.roundedRect(M, y, CONTENT_W, 28, 5, 5, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...INK)
    doc.text(section.title, M + 12, y + 18)
    doc.setTextColor(...CYAN)
    doc.setFontSize(10)
    doc.text(`${secScore} / ${secMax}`, PAGE_W - M - 12, y + 18, { align: 'right' })
    y += 28 + 10

    for (const c of section.checks) {
      const col = checkColor(c)
      const detailLines = doc.splitTextToSize(c.detail, CONTENT_W - 108) as string[]
      const rowH = 16 + detailLines.length * 11

      ensure(rowH + 8)

      // Status dot + word
      doc.setFillColor(col[0], col[1], col[2])
      doc.circle(M + 8, y + 5, 3.6, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(col[0], col[1], col[2])
      doc.text(checkWord(c), M + 16, y + 8)

      // Label
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(...INK)
      doc.text(c.label, M + 52, y + 8)

      // Points
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...MUTED)
      doc.text(`${c.score}/${c.max}`, PAGE_W - M - 4, y + 8, { align: 'right' })

      // Detail
      doc.setFontSize(8.5)
      doc.setTextColor(...MUTED)
      doc.text(detailLines, M + 52, y + 20)

      y += rowH

      doc.setDrawColor(240, 243, 247)
      doc.setLineWidth(0.5)
      doc.line(M + 52, y - 2, PAGE_W - M, y - 2)
      y += 6
    }

    y += 14
  }

  // ── Disclaimer ──────────────────────────────────────────────────────────────
  ensure(74)
  doc.setFillColor(255, 250, 240)
  doc.setDrawColor(240, 220, 180)
  doc.roundedRect(M, y, CONTENT_W, 62, 6, 6, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(150, 100, 0)
  doc.text('Important — this is not a professional security audit', M + 12, y + 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 90, 40)
  const disc = doc.splitTextToSize(
    'This report is an automated configuration and on-chain status check. It does not analyse contract ' +
    'bytecode for logic vulnerabilities, hidden mint functions, rug-pull mechanisms, or malicious code paths. ' +
    'A passing grade is not an endorsement or a guarantee of safety. Always do your own research before ' +
    'interacting with any token.',
    CONTENT_W - 24
  ) as string[]
  doc.text(disc, M + 12, y + 32)

  // ── Footer on every page ────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...HAIR)
    doc.setLineWidth(0.5)
    doc.line(M, PAGE_H - 44, PAGE_W - M, PAGE_H - 44)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text('Generated by FatDev — no-code token deployer  ·  fatdev.io', M, PAGE_H - 30)
    doc.text(`Page ${p} of ${pages}`, PAGE_W - M, PAGE_H - 30, { align: 'right' })
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  const slug = (d.tokenSymbol || d.tokenName || 'token')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase() || 'token'
  const dateSlug = now.toISOString().slice(0, 10)
  doc.save(`fatdev-audit-${slug}-${dateSlug}.pdf`)
}
