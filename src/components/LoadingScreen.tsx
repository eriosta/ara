import { Activity } from 'lucide-react'

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center grid-pattern">
      <div className="text-center animate-fade-in">
        <div className="relative">
          <div className="w-20 h-20 mx-auto mb-6 relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary-500/30 to-primary-600/30 animate-pulse" />
            <div className="absolute inset-2 rounded-xl bg-dark-900 flex items-center justify-center">
              <Activity className="w-8 h-8 text-primary-400 animate-pulse" />
            </div>
          </div>
          <div className="absolute -inset-4 bg-primary-500/20 blur-3xl rounded-full animate-pulse-slow" />
        </div>
        <h2 className="text-xl font-display font-semibold text-dark-100 mb-2">
          Loading RVU Dashboard
        </h2>
        <p className="text-dark-400 text-sm">
          Preparing your analytics...
        </p>
      </div>
    </div>
  )
}

