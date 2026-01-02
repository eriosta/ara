import { useEffect, useState } from 'react'
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
import { Menu } from 'lucide-react'

export default function Dashboard() {
  const { user, profile, fetchProfile } = useAuthStore()
  const { records, metrics, fetchRecords, setGoalRvuPerDay, loading } = useDataStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (user) {
      fetchRecords(user.id)
      fetchProfile()
    }
  }, [user, fetchRecords, fetchProfile])

  useEffect(() => {
    if (profile?.goal_rvu_per_day) {
      setGoalRvuPerDay(profile.goal_rvu_per_day)
    }
  }, [profile, setGoalRvuPerDay])

  const hasData = records.length > 0 && metrics

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 lg:ml-72 bg-slate-950">
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

              {/* Daily Trend Chart */}
              <DailyTrendChart />

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <HourlyEfficiencyChart />
                <HeatmapChart />
              </div>

              {/* Case Mix Analysis */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <CaseMixChart />
                <ModalityPieChart />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
