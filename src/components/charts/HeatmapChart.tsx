import { useDataStore } from '@/stores/dataStore'
import { Calendar, Clock } from 'lucide-react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 6 AM to 10 PM

export default function HeatmapChart() {
  const { heatmapData, metrics } = useDataStore()

  if (heatmapData.length === 0) return null

  // Get max value for color scaling
  const maxRvu = Math.max(...heatmapData.map(d => d.rvu), 1)

  const getColor = (rvu: number) => {
    if (rvu === 0) return 'bg-dark-800/30'
    const intensity = Math.min(rvu / maxRvu, 1)
    if (intensity > 0.75) return 'bg-primary-500'
    if (intensity > 0.5) return 'bg-primary-600/80'
    if (intensity > 0.25) return 'bg-primary-700/60'
    return 'bg-primary-800/40'
  }

  const getOpacity = (rvu: number) => {
    if (rvu === 0) return 0.3
    return 0.5 + (rvu / maxRvu) * 0.5
  }

  // Create a map for quick lookups
  const dataMap = new Map<string, number>()
  heatmapData.forEach(d => {
    const dayAbbrev = d.dow.substring(0, 3)
    dataMap.set(`${dayAbbrev}-${d.hour}`, d.rvu)
  })

  return (
    <section className="chart-container animate-slide-up" style={{ animationDelay: '0.25s' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-display font-semibold text-dark-100">Schedule Optimization</h3>
            <p className="text-sm text-dark-400">Peak hours for complex cases</p>
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
              <div 
                key={hour} 
                className="flex-1 text-center text-xs text-dark-500"
              >
                {hour % 12 || 12}{hour < 12 ? 'a' : 'p'}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {DAYS.map(day => (
            <div key={day} className="flex items-center mb-1">
              <div className="w-10 text-xs text-dark-400 flex-shrink-0">
                {day}
              </div>
              {HOURS.map(hour => {
                const rvu = dataMap.get(`${day}-${hour}`) || 0
                return (
                  <div
                    key={`${day}-${hour}`}
                    className={`flex-1 h-6 mx-0.5 rounded ${getColor(rvu)} transition-all hover:scale-110 cursor-pointer group relative`}
                    style={{ opacity: getOpacity(rvu) }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg bg-dark-900 border border-dark-700 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                      <span className="text-dark-300">{day} {hour}:00</span>
                      <br />
                      <span className="text-primary-400 font-medium">{rvu.toFixed(1)} RVUs</span>
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
        <div className="flex items-center gap-2 text-xs text-dark-400">
          <span>Less</span>
          <div className="flex gap-0.5">
            <div className="w-4 h-4 rounded bg-dark-800/30" />
            <div className="w-4 h-4 rounded bg-primary-800/40" />
            <div className="w-4 h-4 rounded bg-primary-700/60" />
            <div className="w-4 h-4 rounded bg-primary-600/80" />
            <div className="w-4 h-4 rounded bg-primary-500" />
          </div>
          <span>More</span>
        </div>
        
        {metrics && (
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-4 h-4 text-primary-400" />
            <span className="text-dark-400">Peak:</span>
            <span className="text-dark-200 font-medium">
              {metrics.peakDow} at {metrics.peakHour}:00
            </span>
          </div>
        )}
      </div>
    </section>
  )
}

