import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { 
  Activity, X, LogOut, Upload, Target, 
  FileText, Trash2, ChevronDown, User, AlertCircle
} from 'lucide-react'
import FileUpload from './FileUpload'
import { generatePDF } from '@/lib/pdfExport'
import toast from 'react-hot-toast'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, profile, signOut, updateProfile } = useAuthStore()
  const { records, metrics, clearRecords, goalRvuPerDay, setGoalRvuPerDay, dailyData, caseMixData, modalityData } = useDataStore()
  const [showSettings, setShowSettings] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [localGoal, setLocalGoal] = useState(goalRvuPerDay)

  const handleGoalUpdate = async () => {
    setGoalRvuPerDay(localGoal)
    if (user) {
      await updateProfile({ goal_rvu_per_day: localGoal })
      toast.success('Goal updated')
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
      <aside className={`
        fixed top-0 left-0 h-full w-72 z-50
        glass border-r border-dark-700/50
        transform transition-transform duration-300 ease-out
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-dark-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-display font-semibold gradient-text">RVU Dashboard</h1>
                  <p className="text-xs text-dark-400">Productivity Analytics</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="lg:hidden p-2 rounded-lg hover:bg-dark-800 transition-colors"
              >
                <X className="w-5 h-5 text-dark-400" />
              </button>
            </div>
          </div>

          {/* User Profile */}
          <div className="p-4 border-b border-dark-700/50">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-dark-800/50">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500/20 to-primary-600/20 flex items-center justify-center">
                <User className="w-5 h-5 text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dark-100 truncate">
                  {profile?.full_name || 'Resident'}
                </p>
                <p className="text-xs text-dark-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="px-4 py-3">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-amber-300/90 font-medium">Security Notice</p>
                  <p className="text-xs text-amber-300/60 mt-0.5">
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
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-dark-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-primary-400" />
                  <span className="text-sm font-medium text-dark-200">Daily Goal</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-primary-400">{goalRvuPerDay}</span>
                  <ChevronDown className={`w-4 h-4 text-dark-400 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {showSettings && (
                <div className="mt-2 p-4 rounded-xl bg-dark-800/50 animate-slide-down">
                  <label className="text-xs text-dark-400 block mb-2">RVUs per Day Target</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={localGoal}
                      onChange={(e) => setLocalGoal(Number(e.target.value))}
                      className="flex-1 px-3 py-2 rounded-lg bg-dark-900 border border-dark-600 text-sm text-dark-100 focus:border-primary-500 outline-none"
                      min={0}
                      step={0.5}
                    />
                    <button
                      onClick={handleGoalUpdate}
                      className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Data */}
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-dark-800/50 transition-colors"
            >
              <Upload className="w-5 h-5 text-primary-400" />
              <span className="text-sm font-medium text-dark-200">Upload Data</span>
              <ChevronDown className={`w-4 h-4 text-dark-400 ml-auto transition-transform ${showUpload ? 'rotate-180' : ''}`} />
            </button>
            {showUpload && (
              <div className="p-4 rounded-xl bg-dark-800/50 animate-slide-down">
                <FileUpload compact />
              </div>
            )}

            {/* Export PDF */}
            <button
              onClick={handleExportPDF}
              disabled={!metrics}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-dark-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-5 h-5 text-accent-400" />
              <span className="text-sm font-medium text-dark-200">Export PDF Report</span>
            </button>

            {/* Clear Data */}
            {records.length > 0 && (
              <button
                onClick={handleClearData}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                <span className="text-sm font-medium">Clear All Data</span>
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-dark-700/50">
            <div className="text-xs text-dark-500 mb-3 text-center">
              {records.length > 0 && (
                <span>{records.length.toLocaleString()} records loaded</span>
              )}
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dark-700 hover:bg-dark-800/50 text-dark-300 transition-colors"
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

