import { useEffect, useRef, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import AuthPage from '@/pages/AuthPage'
import Dashboard from '@/pages/Dashboard'
import BreakdownPage from '@/pages/BreakdownPage'
import LoadingScreen from '@/components/LoadingScreen'
import toast from 'react-hot-toast'

// Hook to check for new versions
function useVersionCheck() {
  const hasShownToast = useRef(false)

  const checkForUpdate = useCallback(async () => {
    try {
      // Fetch index.html with cache-busting query param
      const response = await fetch(`/?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
      const html = await response.text()
      
      // Look for the main JS bundle - if filename changed, there's a new version
      const scriptMatch = html.match(/src="\/assets\/index-([^"]+)\.js"/)
      if (scriptMatch) {
        const currentScript = document.querySelector('script[src*="/assets/index-"]')
        const currentSrc = currentScript?.getAttribute('src') || ''
        
        if (currentSrc && !currentSrc.includes(scriptMatch[1]) && !hasShownToast.current) {
          hasShownToast.current = true
          toast(
            (t) => (
              <div className="flex items-center gap-3">
                <span>A new version is available!</span>
                <button
                  onClick={() => {
                    toast.dismiss(t.id)
                    window.location.reload()
                  }}
                  className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600"
                >
                  Refresh
                </button>
              </div>
            ),
            { duration: Infinity, position: 'bottom-center' }
          )
        }
      }
    } catch {
      // Silently fail - don't disrupt the user
    }
  }, [])

  useEffect(() => {
    // Check for updates every 5 minutes
    const interval = setInterval(checkForUpdate, 5 * 60 * 1000)
    
    // Also check when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkForUpdate])
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore()

  if (!initialized) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore()

  if (!initialized) {
    return <LoadingScreen />
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export default function App() {
  const { initialize } = useAuthStore()

  // Check for new versions periodically
  useVersionCheck()

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <div className="min-h-screen bg-slate-950">
      <Routes>
        <Route
          path="/auth"
          element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/breakdown"
          element={
            <ProtectedRoute>
              <BreakdownPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  )
}
