import { Activity } from 'lucide-react'

export default function LoadingScreen() {
  return (
    <div 
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="text-center animate-fade-in">
        <div 
          className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          <Activity className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          RVU Dashboard
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading...
        </p>
      </div>
    </div>
  )
}
