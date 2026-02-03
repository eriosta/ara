import { useDataStore } from '@/stores/dataStore'
import { Calendar, Clock } from 'lucide-react'
import InfoTooltip from '../InfoTooltip'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 6 AM to 10 PM

export default function HeatmapChart() {
  const { heatmapData, metrics } = useDataStore()

  if (heatmapData.length === 0) return null

  // Get max value for color scaling
  const maxRvu = Math.max(...heatmapData.map(d => d.rvu), 1)

  // Color scale for dark mode
  const getColor = (rvu: number) => {
    if (rvu === 0) return 'rgba(51, 65, 85, 0.3)'
    const intensity = Math.min(rvu / maxRvu, 1)
    if (intensity > 0.75) return '#22c55e'
    if (intensity > 0.5) return 'rgba(34, 197, 94, 0.8)'
    if (intensity > 0.25) return 'rgba(34, 197, 94, 0.6)'
    return 'rgba(34, 197, 94, 0.4)'
  }

  // Create a map for quick lookups
  const dataMap = new Map<string, number>()
  heatmapData.forEach(d => {
    const dayAbbrev = d.dow.substring(0, 3)
    dataMap.set(`${dayAbbrev}-${d.hour}`, d.rvu)
  })

  return (
    <section className="p-5 rounded-xl animate-slide-up bg-slate-900 border border-slate-800" style={{ animationDelay: '0.25s' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-500/10">
            <Calendar className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-display font-semibold text-slate-100 flex items-center gap-1.5">
              Schedule Optimization
              <InfoTooltip text="RVU output by day and hour. Darker cells = more productive. Identifies your best time slots for complex cases." />
            </h3>
            <p className="text-sm text-slate-500">
              Peak hours for complex cases
            </p>
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Hours header */}
          <div className="flex mb-1">
            <div className="w-10 flex-shrink-0" />
            {HOURS.map(hour => (
              <div key={hour} className="flex-1 text-center text-xs text-slate-500">
                {hour % 12 || 12}{hour < 12 ? 'a' : 'p'}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {DAYS.map(day => (
            <div key={day} className="flex items-center mb-1">
              <div className="w-10 text-xs flex-shrink-0 text-slate-500">
                {day}
              </div>
              {HOURS.map(hour => {
                const rvu = dataMap.get(`${day}-${hour}`) || 0
                return (
                  <div
                    key={`${day}-${hour}`}
                    className="flex-1 h-6 mx-0.5 rounded transition-all hover:scale-110 cursor-pointer group relative"
                    style={{ backgroundColor: getColor(rvu) }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none bg-slate-800 border border-slate-700 shadow-lg">
                      <span className="text-slate-300">{day} {hour}:00</span>
                      <br />
                      <span className="font-medium text-emerald-400">
                        {rvu.toFixed(1)} RVUs
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Less</span>
          <div className="flex gap-0.5">
            <div className="w-4 h-4 rounded bg-slate-700/30" />
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.4)' }} />
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.6)' }} />
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.8)' }} />
            <div className="w-4 h-4 rounded bg-emerald-500" />
          </div>
          <span>More</span>
        </div>
        
        {metrics && (
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-500">Peak:</span>
            <span className="font-medium text-slate-200">
              {metrics.peakDow} at {metrics.peakHour}:00
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
