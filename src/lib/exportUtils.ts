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
