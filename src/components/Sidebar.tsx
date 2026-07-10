import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { supabase } from '@/lib/supabase'
import {
  X, Upload,
  FileText, Trash2, ChevronDown,
  FileSpreadsheet, Calendar, Database, RefreshCw,
  LayoutDashboard, Table2, Target, BookOpen
} from 'lucide-react'
import FileUpload from './FileUpload'
import Logo from './Logo'
import { generatePDF } from '@/lib/pdfExport'
import { recordsToExportRows, downloadCSV, downloadExcel } from '@/lib/exportUtils'
import toast from 'react-hot-toast'

interface UploadRecord {
  id: string
  file_name: string
  file_path: string
  records_imported: number | null
  uploaded_at: string
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  width: number
  onWidthChange: (w: number) => void
}

const MIN_WIDTH = 200
const MAX_WIDTH = 400

export default function Sidebar({ isOpen, onClose, width, onWidthChange }: SidebarProps) {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX))
      onWidthChange(clamped)
    }
    const onUp = () => setDragging(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging, onWidthChange])
  const location = useLocation()
  const { user, profile } = useAuthStore()
  const { records, metrics, clearRecords, reprocessRecords, goalRvuPerDay, dailyData, caseMixData, modalityData, loading } = useDataStore()
  const [showUpload, setShowUpload] = useState(false)
  const [showDataModal, setShowDataModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([])

  // Fetch upload history
  const fetchUploadHistory = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('upload_history')
      .select('id, file_name, file_path, records_imported, uploaded_at')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })
      .limit(10)

    if (!error) {
      setUploadHistory(data || [])
    }
  }

  useEffect(() => {
    fetchUploadHistory()
  }, [user, records.length])

  // Delete a single upload record
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDeleteUpload = async (upload: UploadRecord) => {
    if (!user) return

    if (!window.confirm(`Delete "${upload.file_name}"? This will remove it from your upload history.`)) {
      return
    }

    setDeletingId(upload.id)

    try {
      if (upload.file_path) {
        await supabase.storage.from('uploads').remove([upload.file_path])
      }

      const { error: historyError } = await supabase
        .from('upload_history')
        .delete()
        .eq('id', upload.id)

      if (historyError) {
        console.error('Delete error:', historyError)
        toast.error(`Failed to delete: ${historyError.message}`)
        return
      }

      setUploadHistory(prev => prev.filter(u => u.id !== upload.id))
      toast.success('Upload deleted')
    } catch (err) {
      console.error('Delete error:', err)
      toast.error('Failed to delete upload')
    } finally {
      setDeletingId(null)
    }
  }

  const handleClearData = async () => {
    if (!user) return
    if (window.confirm('Are you sure you want to delete all your data? This cannot be undone.')) {
      const { error } = await clearRecords(user.id)
      if (error) {
        toast.error('Failed to clear data')
      } else {
        toast.success('All data cleared')
      }
    }
  }

  // Re-runs modality/body-part/exam-type classification on every stored study
  // using the current rules. Needed after a classification fix so existing data
  // (Study Breakdown, data-quality flags, charts) reflects the updated logic.
  const handleReprocess = async () => {
    if (!user) return
    if (records.length === 0) {
      toast.error('No data to re-classify. Upload some data first.')
      return
    }
    if (!window.confirm(`Re-run classification on all ${records.length.toLocaleString()} studies? This updates modality/body-part labels using the latest rules and can take a moment.`)) {
      return
    }
    setReprocessing(true)
    toast.loading('Re-classifying studies…', { id: 'reprocess' })
    try {
      const { error, count } = await reprocessRecords(user.id)
      if (error) toast.error(`Re-classification failed: ${error.message}`, { id: 'reprocess' })
      else toast.success(`Re-classified ${count.toLocaleString()} studies`, { id: 'reprocess' })
    } catch (error) {
      console.error('Reprocess error:', error)
      toast.error(`Re-classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'reprocess' })
    } finally {
      setReprocessing(false)
    }
  }

  const handleExportPDF = () => {
    if (!metrics) {
      toast.error('No data to export')
      return
    }

    try {
      generatePDF({
        metrics,
        dailyData,
        caseMixData,
        modalityData,
        goalRvuPerDay,
        profileName: profile?.full_name || 'Resident',
      })
      toast.success('PDF downloaded!')
    } catch (error) {
      console.error('PDF export error:', error)
      toast.error(`PDF export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Exports the full in-memory dataset (already loaded by the store) so it works
  // instantly and never hangs on a database round-trip. Any failure is surfaced.
  const handleExport = async (fmt: 'csv' | 'excel') => {
    if (records.length === 0) {
      toast.error('No data to export. Upload some data first.')
      return
    }

    setExporting(true)
    try {
      const rows = recordsToExportRows(records)
      const dateStr = new Date().toISOString().split('T')[0]
      if (fmt === 'csv') {
        downloadCSV(rows, `myRVU_Export_${dateStr}.csv`)
      } else {
        downloadExcel(rows, `myRVU_Export_${dateStr}.xlsx`)
      }
      toast.success(`Exported ${rows.length.toLocaleString()} records to ${fmt === 'csv' ? 'CSV' : 'Excel'}`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50
          transform transition-transform duration-300 ease-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          width: `${width}px`,
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div className="flex flex-col h-full">
          {/* Drag handle */}
          <div
            onMouseDown={() => setDragging(true)}
            className="hidden lg:flex absolute top-0 right-0 w-2 h-full cursor-col-resize items-center justify-center z-10 group hover:bg-emerald-500/10 transition-colors"
          >
            <div className={`w-0.5 h-8 rounded-full transition-colors ${dragging ? 'bg-emerald-400' : 'bg-slate-700 group-hover:bg-emerald-400/50'}`} />
          </div>

          {/* Header */}
          <div className="p-5" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-between">
              <Logo size="md" />
              <button
                onClick={onClose}
                className="lg:hidden p-2 rounded-lg transition-colors hover:bg-slate-800"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Navigation
            </p>
            <nav className="space-y-1" data-tour="sidebar-nav">
              <Link
                to="/dashboard"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname === '/dashboard'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <Link
                to="/breakdown"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname === '/breakdown'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Table2 className="w-4 h-4" />
                <span>Study Breakdown</span>
              </Link>
              <Link
                to="/acgme"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname === '/acgme'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Target className="w-4 h-4" />
                <span>ACGME Minimums</span>
              </Link>
              <Link
                to="/reference"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname === '/reference'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Reference</span>
              </Link>
            </nav>
          </div>

          {/* Actions */}
          <div className="flex-1 p-4 space-y-2 overflow-y-auto">
            {/* Upload Data */}
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors interactive-item"
              data-tour="sidebar-upload"
            >
              <Upload className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Upload Data</span>
              <ChevronDown
                className={`w-4 h-4 ml-auto transition-transform ${showUpload ? 'rotate-180' : ''}`}
                style={{ color: 'var(--text-muted)' }}
              />
            </button>
            {showUpload && (
              <div
                className="p-4 rounded-xl animate-slide-down"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                <FileUpload compact />
              </div>
            )}

            {/* Saved Data summary — opens a roomy modal instead of a cramped scroll */}
            {records.length > 0 && uploadHistory.length > 0 && (
              <button
                onClick={() => setShowDataModal(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors interactive-item"
                title="View and manage your uploaded files"
              >
                <Database className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                <div className="flex-1 min-w-0 text-left">
                  <span className="text-sm font-medium block" style={{ color: 'var(--text-secondary)' }}>Your Saved Data</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {uploadHistory.reduce((sum, u) => sum + (u.records_imported || 0), 0).toLocaleString()} records · {uploadHistory.length} upload{uploadHistory.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 -rotate-90" style={{ color: 'var(--text-muted)' }} />
              </button>
            )}

            {/* Export PDF */}
            <button
              onClick={handleExportPDF}
              disabled={!metrics}
              className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed interactive-item"
              data-tour="sidebar-export"
            >
              <FileText className="w-5 h-5" style={{ color: 'var(--info)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Export PDF Report</span>
            </button>

            {/* Export raw data (Excel) */}
            <button
              onClick={() => handleExport('excel')}
              disabled={exporting || records.length === 0}
              className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed interactive-item"
              title="Download all studies as an Excel (.xlsx) file"
            >
              <FileSpreadsheet className="w-5 h-5" style={{ color: 'var(--info)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Export Excel Data</span>
            </button>

            {/* Re-run classification */}
            {records.length > 0 && (
              <button
                onClick={handleReprocess}
                disabled={reprocessing || loading}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed interactive-item"
                title="Re-classify all stored studies using the latest modality/body-part rules"
              >
                <RefreshCw className={`w-5 h-5 ${reprocessing ? 'animate-spin' : ''}`} style={{ color: 'var(--accent-primary)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {reprocessing ? 'Re-classifying…' : 'Re-run Classification'}
                </span>
              </button>
            )}

            {/* Clear Data */}
            {records.length > 0 && (
              <button
                onClick={handleClearData}
                disabled={loading}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors disabled:opacity-50"
                style={{ color: 'var(--danger)' }}
              >
                <Trash2 className="w-5 h-5" />
                <span className="text-sm font-medium">Clear All Data</span>
              </button>
            )}
          </div>

          {/* Footer */}
          {records.length > 0 && (
            <div className="p-4" style={{ borderTop: '1px solid var(--border-color)' }}>
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                {records.length.toLocaleString()} records loaded
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Saved Data modal — full-size view of uploaded files */}
      {showDataModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowDataModal(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Your Saved Data</h3>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {uploadHistory.reduce((sum, u) => sum + (u.records_imported || 0), 0).toLocaleString()} records across {uploadHistory.length} upload{uploadHistory.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDataModal(false)}
                className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Upload list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {uploadHistory.map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center gap-3 p-3 rounded-xl group"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                >
                  <FileSpreadsheet className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                      {upload.file_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>
                        {upload.records_imported?.toLocaleString() || 0} records
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>•</span>
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <Calendar className="w-3 h-3" />
                        {new Date(upload.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteUpload(upload) }}
                    disabled={deletingId === upload.id}
                    className="p-2 rounded-lg transition-all hover:bg-white/5 disabled:opacity-50"
                    style={{ color: 'var(--danger)' }}
                    title="Delete this upload"
                  >
                    {deletingId === upload.id ? (
                      <div className="w-4 h-4 border border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--danger)' }} />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
