import { Activity, Upload, ArrowLeft } from 'lucide-react'

export default function EmptyState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="text-center max-w-md">
        <div 
          className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: 'var(--accent-muted)' }}
        >
          <Activity className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
        </div>
        
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Welcome to RVU Dashboard
        </h2>
        <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
          Upload your productivity data to see insights and analytics.
        </p>

        <div 
          className="flex items-center justify-center gap-3 p-4 rounded-xl"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <ArrowLeft className="w-5 h-5 animate-pulse" style={{ color: 'var(--accent-primary)' }} />
          <div className="text-left">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Get Started
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Click <Upload className="w-3 h-3 inline mx-1" /> 
              <span style={{ color: 'var(--accent-primary)' }}>Upload Data</span> in the sidebar
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
