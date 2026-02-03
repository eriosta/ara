import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import Sidebar from '@/components/Sidebar'
import MetricsOverview from '@/components/MetricsOverview'
import DailyTrendChart from '@/components/charts/DailyTrendChart'
import HourlyEfficiencyChart from '@/components/charts/HourlyEfficiencyChart'
import CaseMixChart from '@/components/charts/CaseMixChart'
import ModalityPieChart from '@/components/charts/ModalityPieChart'
import HeatmapChart from '@/components/charts/HeatmapChart'
import EmptyState from '@/components/EmptyState'
import DashboardToolbar from '@/components/DashboardToolbar'
import ProductTour, { DASHBOARD_STEPS } from '@/components/ProductTour'
import { Menu } from 'lucide-react'

const TOUR_KEY = 'myrvu-tour-completed'

export default function Dashboard() {
  const { user, profile, fetchProfile } = useAuthStore()
  const { records, metrics, fetchRecords, setGoalRvuPerDay, loading } = useDataStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(224)
  const [initialFetchDone, setInitialFetchDone] = useState(false)
  const [tourRunning, setTourRunning] = useState(false)

  // Only fetch once when user is available
  useEffect(() => {
    if (user && !initialFetchDone) {
      setInitialFetchDone(true)
      fetchRecords(user.id)
      fetchProfile()
    }
  }, [user, initialFetchDone, fetchRecords, fetchProfile])

  useEffect(() => {
    if (profile?.goal_rvu_per_day) {
      setGoalRvuPerDay(profile.goal_rvu_per_day)
    }
  }, [profile?.goal_rvu_per_day, setGoalRvuPerDay])

  const hasData = records.length > 0 && metrics

  // Auto-start tour on first visit once data is loaded
  useEffect(() => {
    if (hasData && !localStorage.getItem(TOUR_KEY)) {
      setTourRunning(true)
    }
  }, [hasData])

  const handleTourClose = useCallback(() => {
    setTourRunning(false)
    localStorage.setItem(TOUR_KEY, 'true')
  }, [])

  const handleStartTour = useCallback(() => {
    setTourRunning(true)
  }, [])

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
      />

      {/* Main Content */}
      <div className="flex-1 bg-slate-950 max-lg:!ml-0" style={{ marginLeft: `${sidebarWidth}px` }}>
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-40 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl transition-colors bg-slate-800 hover:bg-slate-700"
            >
              <Menu className="w-6 h-6 text-slate-400" />
            </button>
            <h1 className="text-lg font-display font-bold">
              <span className="text-white">my</span>
              <span className="text-emerald-400">RVU</span>
            </h1>
            <div className="w-10" />
          </div>
        </header>

        {/* Toolbar: goal + filters */}
        {hasData && <DashboardToolbar onStartTour={handleStartTour} />}

        {/* Dashboard Content */}
        <main className="p-4 lg:p-6">
          {loading && records.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-500">Loading your data...</p>
              </div>
            </div>
          ) : !hasData ? (
            <EmptyState />
          ) : (
            <div className="space-y-6 animate-fade-in">
              {/* Metrics Overview */}
              <MetricsOverview />

              {/* Section: Trends */}
              <div className="flex items-center gap-3 pt-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Trends</span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
              </div>
              <div data-tour="chart-daily">
                <DailyTrendChart />
              </div>

              {/* Section: Patterns */}
              <div data-tour="section-patterns">
                <div className="flex items-center gap-3 pt-2 mb-6">
                  <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Patterns</span>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <HourlyEfficiencyChart />
                  <HeatmapChart />
                </div>
              </div>

              {/* Section: Case Analysis */}
              <div data-tour="section-case-analysis">
                <div className="flex items-center gap-3 pt-2 mb-6">
                  <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Case Analysis</span>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <CaseMixChart />
                  <ModalityPieChart />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {hasData && <ProductTour steps={DASHBOARD_STEPS} run={tourRunning} onClose={handleTourClose} />}
    </div>
  )
}
