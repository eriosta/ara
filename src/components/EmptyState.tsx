import { Upload, ArrowLeft } from 'lucide-react'
import Logo from './Logo'

export default function EmptyState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <Logo size="lg" showText={false} />
        </div>
        
        <h2 className="text-2xl font-bold mb-2 text-white">
          Welcome to <span className="text-emerald-400">myRVU</span>
        </h2>
        <p className="mb-6 text-slate-400">
          Upload your productivity data to see insights and analytics.
        </p>

        <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
          <ArrowLeft className="w-5 h-5 animate-pulse text-emerald-400" />
          <div className="text-left">
            <p className="text-sm font-medium text-slate-200">
              Get Started
            </p>
            <p className="text-xs text-slate-500">
              Click <Upload className="w-3 h-3 inline mx-1" /> 
              <span className="text-emerald-400">Upload Data</span> in the sidebar
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
