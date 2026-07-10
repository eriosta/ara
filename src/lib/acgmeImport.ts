// Parses an ACGME "Defined Category by Year" export (the program's case-log
// report) and maps its rows onto our tracked ACGME categories, so a resident can
// upload the file instead of typing their program-reported numbers by hand.
//
// The export (xls/xlsx/csv) has a few metadata rows, then a header row like
//   Examinations | Year 1 | Total | Minimum
// followed by one row per category. We locate columns by their header labels
// (not fixed positions) to stay robust to layout changes.

import * as XLSX from 'xlsx'
import { ACGME_CATEGORIES } from './acgmeCategories'

export interface ParsedReportRow {
  name: string
  total: number | null
  minimum: number | null
}

function toNum(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function parseAcgmeReport(data: ArrayBuffer): ParsedReportRow[] {
  const wb = XLSX.read(data, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' })

  // Locate the header row + the columns we care about.
  let headerIdx = -1, cName = -1, cTotal = -1, cMin = -1
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map(c => String(c).trim().toLowerCase())
    const ni = cells.findIndex(c => c.startsWith('examination'))
    const mi = cells.findIndex(c => c === 'minimum')
    if (ni !== -1 && mi !== -1) {
      headerIdx = i
      cName = ni
      cMin = mi
      cTotal = cells.findIndex(c => c === 'total')
      break
    }
  }
  if (headerIdx === -1) return []

  const out: ParsedReportRow[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const name = String(row[cName] ?? '').trim()
    if (!name) continue
    out.push({
      name,
      total: cTotal !== -1 ? toNum(row[cTotal]) : null,
      minimum: cMin !== -1 ? toNum(row[cMin]) : null,
    })
  }
  return out
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export interface AppliedReport {
  /** category id -> minimum (only where the report gives a positive minimum). */
  minimums: Record<string, string>
  /** category id -> program-reported total. */
  reported: Record<string, string>
  /** display names of categories matched in the report. */
  matched: string[]
  /** tracked categories NOT found in the report. */
  unmatched: string[]
}

/** Matches parsed report rows to our tracked categories by normalized name. */
export function applyReportToCategories(rows: ParsedReportRow[]): AppliedReport {
  const byNorm = new Map(rows.map(r => [norm(r.name), r]))
  const minimums: Record<string, string> = {}
  const reported: Record<string, string> = {}
  const matched: string[] = []
  const unmatched: string[] = []

  for (const cat of ACGME_CATEGORIES) {
    const r = byNorm.get(norm(cat.name))
    if (r) {
      matched.push(cat.name)
      if (r.total != null) reported[cat.id] = String(r.total)
      if (r.minimum != null && r.minimum > 0) minimums[cat.id] = String(r.minimum)
    } else {
      unmatched.push(cat.name)
    }
  }
  return { minimums, reported, matched, unmatched }
}
