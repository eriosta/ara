// Client-side export helpers for study data (CSV + Excel).
// Exports work off the in-memory records already loaded in the data store,
// so they never depend on a second database round-trip (which previously
// could hang silently and make the export button appear to "do nothing").

import * as XLSX from 'xlsx'
import { RVURecord } from './dataProcessing'

export interface ExportRow {
  Date: string
  Time: string
  'Day of Week': string
  'Exam Description': string
  Modality: string
  'Body Part': string
  'Exam Type': string
  wRVU: number
}

/**
 * Maps processed RVU records into flat, human-readable export rows.
 * Sorted chronologically to match the in-app ordering.
 */
export function recordsToExportRows(records: RVURecord[]): ExportRow[] {
  return [...records]
    .sort((a, b) => a.dictationDatetime.getTime() - b.dictationDatetime.getTime())
    .map(r => {
      const d = r.dictationDatetime
      return {
        Date: d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
        Time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        'Day of Week': d.toLocaleDateString('en-US', { weekday: 'long' }),
        'Exam Description': r.examDescription,
        Modality: r.modality || '',
        'Body Part': r.bodyPart || '',
        'Exam Type': r.examType || '',
        wRVU: Number((r.wrvuEstimate || 0).toFixed(2)),
      }
    })
}

/** Escapes a single CSV field (quotes it if it contains a comma, quote, or newline). */
function escapeCSV(value: string | number): string {
  const str = String(value ?? '')
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function rowsToCSV(rows: ExportRow[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0]) as (keyof ExportRow)[]
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map(h => escapeCSV(row[h] as string | number)).join(','))
  }
  return lines.join('\n')
}

/** Triggers a browser download for arbitrary blob content. */
export function downloadBlob(content: BlobPart, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadCSV(rows: ExportRow[], filename: string): void {
  // Prepend a UTF-8 BOM so Excel opens accented characters correctly.
  downloadBlob('﻿' + rowsToCSV(rows), filename, 'text/csv;charset=utf-8;')
}

export function downloadExcel(rows: ExportRow[], filename: string): void {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Studies')
  XLSX.writeFile(wb, filename)
}

// --- ACGME coordinator export (summary + one sheet of studies per category) ---

export interface AcgmeExportCategory {
  category: string
  minimum: number
  appCount: number
  reported: number | null
  matched: RVURecord[]
}

// Excel sheet names: max 31 chars, no \ / ? * [ ] :, and must be unique.
function sanitizeSheetName(name: string, used: Set<string>): string {
  const base = (name.replace(/[\\/?*[\]:]/g, '-').trim() || 'Sheet').slice(0, 28)
  let candidate = base
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base.slice(0, 26)} ${n++}`
  }
  used.add(candidate.toLowerCase())
  return candidate
}

/**
 * Builds a workbook to send to a program coordinator: a Summary tab (each
 * category's app count vs program-reported vs minimum + Δ), then one tab per
 * category listing every individual study counted toward it.
 */
export function downloadAcgmeWorkbook(rows: AcgmeExportCategory[], residentName: string, filename: string): void {
  const wb = XLSX.utils.book_new()

  const summary = rows.map(r => ({
    Category: r.category,
    'ACGME Minimum': r.minimum,
    'App Count': r.appCount,
    'Program Reported': r.reported ?? '',
    'Δ (App − Reported)': r.reported != null ? r.appCount - r.reported : '',
    Status: r.appCount >= r.minimum ? 'Met' : `${(r.minimum - r.appCount).toLocaleString()} short`,
  }))
  const summaryWs = XLSX.utils.aoa_to_sheet([
    ['myRVU — ACGME Minimums'],
    [`Resident: ${residentName}`],
    [],
  ])
  XLSX.utils.sheet_add_json(summaryWs, summary, { origin: 'A4' })
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

  const used = new Set<string>(['summary'])
  for (const r of rows) {
    const studyRows = recordsToExportRows(r.matched)
    const ws = XLSX.utils.json_to_sheet(
      studyRows.length ? studyRows : [{ Note: 'No studies matched this category' }]
    )
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(r.category, used))
  }

  XLSX.writeFile(wb, filename)
}
