import { useDataStore } from '@/stores/dataStore'
import {
  TrendingUp, TrendingDown, Clock, Activity,
  Zap, Calendar
} from 'lucide-react'
import InfoTooltip from './InfoTooltip'

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
      secondary: `${metrics.targetHitRate.toFixed(0)}% of days on target`,
      tooltip: 'Average RVUs per working day. Compare to your goal — if below target, check hourly efficiency for gaps.',
    },
    {
      title: 'RVUs per Hour',
      value: metrics.rvuPerHour.toFixed(1),
      subtitle: `Target: ${hourlyTarget.toFixed(1)}`,
      icon: Clock,
      secondary: `Trend: ${metrics.trendSlope > 0 ? '+' : ''}${metrics.trendSlope.toFixed(2)}/day`,
      secondaryIcon: metrics.trendSlope > 0 ? TrendingUp : TrendingDown,
      secondaryColor: metrics.trendSlope > 0 ? 'var(--accent-primary)' : 'var(--danger)',
      tooltip: 'Efficiency while working. Higher = more complex or faster reads. The trend shows your improvement direction over time.',
    },
    {
      title: 'Cases per Day',
      value: metrics.avgCasesDay.toFixed(1),
      subtitle: 'Average volume',
      icon: Calendar,
      secondary: `7-day avg: ${metrics.ma7.toFixed(1)} RVUs`,
      tooltip: 'Volume of studies read daily. Combined with RVUs/Case, shows whether productivity is volume-driven or complexity-driven.',
    },
    {
      title: 'RVUs per Case',
      value: metrics.rvuPerCase.toFixed(2),
      subtitle: 'Case complexity',
      icon: Zap,
      secondary: `Best day: ${metrics.bestDayRvu.toFixed(1)} RVUs`,
      tooltip: 'Average case complexity. Higher means more complex studies contributing more RVUs per read.',
    },
  ]

  return (
    <section data-tour="metrics-overview">
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
              <div className="flex items-center gap-1.5">
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
                <InfoTooltip text={card.tooltip} />
              </div>
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
            {/* Merged secondary metric */}
            <div
              className="mt-3 pt-2 flex items-center gap-1.5 text-xs"
              style={{ borderTop: '1px solid var(--border-color)' }}
            >
              {card.secondaryIcon && (
                <card.secondaryIcon className="w-3 h-3" style={{ color: card.secondaryColor }} />
              )}
              <span style={{ color: card.secondaryColor || 'var(--text-muted)' }}>
                {card.secondary}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
