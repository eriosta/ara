import { Activity, FileSpreadsheet, ArrowRight } from 'lucide-react'

export default function EmptyState() {
  return (
    <div className="text-center py-16 animate-fade-in">
      <div className="relative inline-block mb-8">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 flex items-center justify-center">
          <Activity className="w-12 h-12 text-primary-400" />
        </div>
        <div className="absolute -inset-4 bg-primary-500/10 blur-3xl rounded-full animate-pulse-slow" />
      </div>
      
      <h2 className="text-3xl font-display font-bold text-dark-100 mb-4">
        Welcome to Your <span className="gradient-text">RVU Dashboard</span>
      </h2>
      <p className="text-lg text-dark-400 max-w-md mx-auto mb-8">
        Upload your radiology productivity data to see actionable insights, trends, and performance analytics.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-dark-400">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-primary-400" />
          <span>Upload CSV or Excel file</span>
        </div>
        <ArrowRight className="w-4 h-4 hidden sm:block" />
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary-400" />
          <span>View your analytics</span>
        </div>
      </div>
    </div>
  )
}

