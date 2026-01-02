import { Activity, Upload, ArrowLeft } from 'lucide-react'

export default function EmptyState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="text-center max-w-md">
        <div className="relative inline-block mb-8">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 flex items-center justify-center">
            <Activity className="w-12 h-12 text-primary-400" />
          </div>
          <div className="absolute -inset-4 bg-primary-500/10 blur-3xl rounded-full animate-pulse-slow" />
        </div>
        
        <h2 className="text-3xl font-display font-bold text-dark-100 mb-4">
          Welcome to <span className="gradient-text">RVU Dashboard</span>
        </h2>
        <p className="text-lg text-dark-400 mb-8">
          Upload your radiology productivity data to see actionable insights and performance analytics.
        </p>

        <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-dark-800/50 border border-primary-500/20">
          <ArrowLeft className="w-5 h-5 text-primary-400 animate-pulse" />
          <div className="text-left">
            <p className="text-sm font-medium text-dark-200">Get Started</p>
            <p className="text-xs text-dark-400">
              Click <Upload className="w-3 h-3 inline mx-1" /> <span className="text-primary-400">Upload Data</span> in the sidebar
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
