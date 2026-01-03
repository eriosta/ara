import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { supabase } from '@/lib/supabase'
import { 
  X, LogOut, Upload, Target, 
  FileText, Trash2, ChevronDown, User, AlertCircle,
  FileSpreadsheet, Calendar, Database, Download
} from 'lucide-react'
import FileUpload from './FileUpload'
import Logo from './Logo'
import { generatePDF } from '@/lib/pdfExport'
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
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, profile, signOut, updateProfile } = useAuthStore()
  const { records, metrics, clearRecords, goalRvuPerDay, setGoalRvuPerDay, dailyData, caseMixData, modalityData, exportCSVFromDB, loading } = useDataStore()
  const [showSettings, setShowSettings] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [localGoal, setLocalGoal] = useState(goalRvuPerDay)
  const [savingGoal, setSavingGoal] = useState(false)
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([])

  // Sync localGoal when profile loads or goalRvuPerDay changes
  useEffect(() => {
    setLocalGoal(goalRvuPerDay)
  }, [goalRvuPerDay])

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
  }, [user, records.length]) // Refetch when records count changes

  // Delete a single upload record
  const [deletingId, setDeletingId] = useState<string | null>(null)
  
  const handleDeleteUpload = async (upload: UploadRecord) => {
    if (!user) return
    
    if (!window.confirm(`Delete "${upload.file_name}"? This will remove it from your upload history.`)) {
      return
    }

    setDeletingId(upload.id)
    
    try {
      // Delete from storage if file exists
      if (upload.file_path) {
        await supabase.storage.from('uploads').remove([upload.file_path])
      }

      // Delete from upload_history
      const { error: historyError } = await supabase
        .from('upload_history')
        .delete()
        .eq('id', upload.id)

      if (historyError) {
        console.error('Delete error:', historyError)
        toast.error(`Failed to delete: ${historyError.message}`)
        return
      }

      // Remove from local state immediately
      setUploadHistory(prev => prev.filter(u => u.id !== upload.id))
      toast.success('Upload deleted')
    } catch (err) {
      console.error('Delete error:', err)
      toast.error('Failed to delete upload')
    } finally {
      setDeletingId(null)
    }
  }

  const handleGoalUpdate = async () => {
    if (!user) return
    
    setSavingGoal(true)
    try {
      setGoalRvuPerDay(localGoal)
      const { error } = await updateProfile({ goal_rvu_per_day: localGoal })
      if (error) {
        toast.error('Failed to save goal')
      } else {
        toast.success('Daily goal saved!')
      }
    } finally {
      setSavingGoal(false)
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

  const handleExportPDF = () => {
    if (!metrics) {
      toast.error('No data to export')
      return
    }
    
    generatePDF({
      metrics,
      dailyData,
      caseMixData,
      modalityData,
      goalRvuPerDay,
      profileName: profile?.full_name || 'Resident',
    })
    toast.success('PDF exported!')
  }

  const handleExportCSV = async () => {
    if (!user) {
      toast.error('Please sign in to export data')
      return
    }

    toast.loading('Fetching data from database...', { id: 'export' })

    // Export directly from database
    const csvContent = await exportCSVFromDB(user.id)
    
    if (!csvContent) {
      toast.error('No data found to export', { id: 'export' })
      return
    }

    // Count records (lines minus header)
    const recordCount = csvContent.split('\n').length - 1

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const dateStr = new Date().toISOString().split('T')[0]
    link.download = `myRVU_Export_${dateStr}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    toast.success(`Exported ${recordCount.toLocaleString()} records to CSV`, { id: 'export' })
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
          fixed top-0 left-0 h-full w-72 z-50
          transform transition-all duration-300 ease-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ 
          backgroundColor: 'var(--bg-secondary)', 
          borderRight: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <div className="flex flex-col h-full">
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

          {/* User Profile */}
          <div className="p-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <div 
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50"
            >
              <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <User className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-slate-200">
                  {profile?.full_name || 'Resident'}
                </p>
                <p className="text-xs truncate text-slate-500">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="px-4 py-3">
            <div 
              className="p-3 rounded-xl"
              style={{ 
                backgroundColor: 'var(--warning-muted)', 
                border: '1px solid var(--warning)',
                borderColor: `color-mix(in srgb, var(--warning) 30%, transparent)`
              }}
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--warning)' }}>Security Notice</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Do NOT include PHI or patient identifiers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex-1 p-4 space-y-2 overflow-y-auto">
            {/* Goal Setting */}
            <div className="mb-4">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-full flex items-center justify-between p-3 rounded-xl transition-colors interactive-item"
              >
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Daily Goal</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono" style={{ color: 'var(--accent-primary)' }}>{goalRvuPerDay}</span>
                  <ChevronDown 
                    className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--text-muted)' }}
                  />
                </div>
              </button>
              {showSettings && (
                <div 
                  className="mt-2 p-4 rounded-xl animate-slide-down"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                >
                  <label className="text-xs block mb-2" style={{ color: 'var(--text-muted)' }}>
                    RVUs per Day Target
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={localGoal}
                      onChange={(e) => setLocalGoal(Number(e.target.value))}
                      className="flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-all"
                      style={{ 
                        backgroundColor: 'var(--bg-primary)', 
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)'
                      }}
                      min={0}
                      step={0.5}
                    />
                    <button
                      onClick={handleGoalUpdate}
                      disabled={savingGoal}
                      className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                      {savingGoal ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Data */}
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors interactive-item"
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

            {/* Saved Data / Upload History - only show when there are actual records */}
            {records.length > 0 && uploadHistory.length > 0 && (
              <div 
                className="mt-2 p-3 rounded-xl"
                style={{ 
                  backgroundColor: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)' 
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    Your Saved Data
                  </span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {uploadHistory.map((upload) => (
                    <div 
                      key={upload.id}
                      className="flex items-start gap-2 p-2 rounded-lg group"
                      style={{ 
                        backgroundColor: 'var(--bg-card)', 
                        border: '1px solid var(--border-color)' 
                      }}
                    >
                      <FileSpreadsheet className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-primary)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                          {upload.file_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-medium" style={{ color: 'var(--accent-primary)' }}>
                            {upload.records_imported?.toLocaleString() || 0} records
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>•</span>
                          <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                            <Calendar className="w-3 h-3" />
                            {new Date(upload.uploaded_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteUpload(upload)
                        }}
                        disabled={deletingId === upload.id}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                        style={{ color: 'var(--danger)' }}
                        title="Delete this upload"
                      >
                        {deletingId === upload.id ? (
                          <div 
                            className="w-3 h-3 border border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: 'var(--danger)' }}
                          />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                  <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
                    Total: {uploadHistory.reduce((sum, u) => sum + (u.records_imported || 0), 0).toLocaleString()} records from {uploadHistory.length} upload{uploadHistory.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Export PDF */}
            <button
              onClick={handleExportPDF}
              disabled={!metrics}
              className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed interactive-item"
            >
              <FileText className="w-5 h-5" style={{ color: 'var(--info)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Export PDF Report</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              disabled={loading}
              className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed interactive-item"
            >
              <Download className="w-5 h-5" style={{ color: 'var(--info)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Export CSV Data</span>
            </button>

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
          <div className="p-4" style={{ borderTop: '1px solid var(--border-color)' }}>
            <div className="text-xs text-center mb-3" style={{ color: 'var(--text-muted)' }}>
              {records.length > 0 && (
                <span>{records.length.toLocaleString()} records loaded</span>
              )}
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl transition-colors"
              style={{ 
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)'
              }}
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
