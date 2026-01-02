import { useDataStore } from '@/stores/dataStore'
import { 
  TrendingUp, TrendingDown, Clock, Activity, 
  Target, Calendar, Award, Zap
} from 'lucide-react'

export default function MetricsOverview() {
  const { metrics, goalRvuPerDay } = useDataStore()

  if (!metrics) return null

  const hourlyTarget = goalRvuPerDay / 8
  const dailyStatus = metrics.avgRvuDay >= goalRvuPerDay 
    ? { label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
    : metrics.avgRvuDay >= goalRvuPerDay * 0.7 
    ? { label: 'Developing', color: 'text-amber-400', bg: 'bg-amber-500/10' }
    : { label: 'Needs Focus', color: 'text-red-400', bg: 'bg-red-500/10' }

  const hourlyStatus = metrics.rvuPerHour >= hourlyTarget
    ? { label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
    : metrics.rvuPerHour >= hourlyTarget * 0.7
    ? { label: 'Developing', color: 'text-amber-400', bg: 'bg-amber-500/10' }
    : { label: 'Needs Focus', color: 'text-red-400', bg: 'bg-red-500/10' }

  const cards = [
    {
      title: 'Daily RVUs',
      value: metrics.avgRvuDay.toFixed(1),
      subtitle: `Target: ${goalRvuPerDay}`,
      status: dailyStatus,
      icon: Activity,
      gradient: 'from-emerald-500/20 to-emerald-600/5',
      delay: '0s',
    },
    {
      title: 'RVUs per Hour',
      value: metrics.rvuPerHour.toFixed(1),
      subtitle: `Target: ${hourlyTarget.toFixed(1)}`,
      status: hourlyStatus,
      icon: Clock,
      gradient: 'from-blue-500/20 to-blue-600/5',
      delay: '0.1s',
    },
    {
      title: 'Cases per Day',
      value: metrics.avgCasesDay.toFixed(1),
      subtitle: 'Average volume',
      icon: Calendar,
      gradient: 'from-violet-500/20 to-violet-600/5',
      delay: '0.2s',
    },
    {
      title: 'RVUs per Case',
      value: metrics.rvuPerCase.toFixed(2),
      subtitle: 'Case complexity',
      icon: Zap,
      gradient: 'from-amber-500/20 to-amber-600/5',
      delay: '0.3s',
    },
  ]

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
          <Target className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h2 className="text-xl font-display font-semibold text-dark-100">Performance Overview</h2>
          <p className="text-sm text-dark-400">Key metrics at a glance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="metric-card animate-slide-up"
            style={{ animationDelay: card.delay }}
          >
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.gradient}`} />
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center">
                  <card.icon className="w-6 h-6 text-primary-400" />
                </div>
                {card.status && (
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${card.status.color} ${card.status.bg}`}>
                    {card.status.label}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-display font-bold text-dark-100">{card.value}</p>
                <p className="text-sm text-dark-400">{card.title}</p>
                <p className="text-xs text-dark-500">{card.subtitle}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
        <div className="p-4 rounded-xl bg-dark-800 border border-dark-700/50">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-primary-400" />
            <span className="text-xs text-dark-400">Target Hit Rate</span>
          </div>
          <p className="text-xl font-semibold text-dark-100">{metrics.targetHitRate.toFixed(0)}%</p>
        </div>
        <div className="p-4 rounded-xl bg-dark-800 border border-dark-700/50">
          <div className="flex items-center gap-2 mb-1">
            {metrics.trendSlope > 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className="text-xs text-dark-400">Trend</span>
          </div>
          <p className="text-xl font-semibold text-dark-100">
            {metrics.trendSlope > 0 ? '+' : ''}{metrics.trendSlope.toFixed(2)}/day
          </p>
        </div>
        <div className="p-4 rounded-xl bg-dark-800 border border-dark-700/50">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-dark-400">7-Day Average</span>
          </div>
          <p className="text-xl font-semibold text-dark-100">{metrics.ma7.toFixed(1)}</p>
        </div>
        <div className="p-4 rounded-xl bg-dark-800 border border-dark-700/50">
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-dark-400">Best Day</span>
          </div>
          <p className="text-xl font-semibold text-dark-100">{metrics.bestDayRvu.toFixed(1)} RVUs</p>
        </div>
      </div>
    </section>
  )
}

