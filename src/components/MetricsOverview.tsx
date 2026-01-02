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
    ? { label: 'On Target', color: 'var(--accent-primary)' }
    : metrics.avgRvuDay >= goalRvuPerDay * 0.7 
    ? { label: 'Developing', color: 'var(--warning)' }
    : { label: 'Needs Focus', color: 'var(--danger)' }

  const cards = [
    {
      title: 'Daily RVUs',
      value: metrics.avgRvuDay.toFixed(1),
      subtitle: `Target: ${goalRvuPerDay}`,
      status: dailyStatus,
      icon: Activity,
    },
    {
      title: 'RVUs per Hour',
      value: metrics.rvuPerHour.toFixed(1),
      subtitle: `Target: ${hourlyTarget.toFixed(1)}`,
      icon: Clock,
    },
    {
      title: 'Cases per Day',
      value: metrics.avgCasesDay.toFixed(1),
      subtitle: 'Average volume',
      icon: Calendar,
    },
    {
      title: 'RVUs per Case',
      value: metrics.rvuPerCase.toFixed(2),
      subtitle: 'Case complexity',
      icon: Zap,
    },
  ]

  return (
    <section>
      {/* Primary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="p-4 rounded-xl transition-all"
            style={{ 
              backgroundColor: 'var(--bg-card)', 
              border: '1px solid var(--border-color)' 
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div 
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent-muted)' }}
              >
                <card.icon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              </div>
              {card.status && (
                <span 
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ 
                    color: card.status.color,
                    backgroundColor: `${card.status.color}15`
                  }}
                >
                  {card.status.label}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {card.value}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {card.title}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {card.subtitle}
            </p>
          </div>
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <div 
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Target Hit Rate</span>
          </div>
          <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {metrics.targetHitRate.toFixed(0)}%
          </p>
        </div>
        
        <div 
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            {metrics.trendSlope > 0 ? (
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            ) : (
              <TrendingDown className="w-4 h-4" style={{ color: 'var(--danger)' }} />
            )}
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Trend</span>
          </div>
          <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {metrics.trendSlope > 0 ? '+' : ''}{metrics.trendSlope.toFixed(2)}/day
          </p>
        </div>
        
        <div 
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4" style={{ color: 'var(--info)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>7-Day Average</span>
          </div>
          <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {metrics.ma7.toFixed(1)}
          </p>
        </div>
        
        <div 
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-4 h-4" style={{ color: 'var(--warning)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Best Day</span>
          </div>
          <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {metrics.bestDayRvu.toFixed(1)} RVUs
          </p>
        </div>
      </div>
    </section>
  )
}
