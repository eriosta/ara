import { useDataStore } from '@/stores/dataStore'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, ReferenceLine 
} from 'recharts'
import { Clock } from 'lucide-react'

export default function HourlyEfficiencyChart() {
  const { hourlyData, goalRvuPerDay } = useDataStore()

  if (hourlyData.length === 0) return null

  const hourlyTarget = goalRvuPerDay / 8

  // Filter to reasonable hours (6 AM - 10 PM)
  const filteredData = hourlyData
    .filter(d => d.hour >= 6 && d.hour <= 22)
    .map(d => ({
      ...d,
      hourLabel: `${d.hour % 12 || 12}${d.hour < 12 ? 'a' : 'p'}`,
    }))

  return (
    <section 
      className="p-5 rounded-xl animate-slide-up" 
      style={{ 
        backgroundColor: 'var(--bg-card)', 
        border: '1px solid var(--border-color)',
        animationDelay: '0.2s' 
      }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--info-muted)' }}
        >
          <Clock className="w-5 h-5" style={{ color: 'var(--info)' }} />
        </div>
        <div>
          <h3 className="text-lg font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
            Hourly Efficiency
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Target: {hourlyTarget.toFixed(1)} RVUs/hour
          </p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} vertical={false} />
            <XAxis 
              dataKey="hourLabel" 
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-color)' }}
            />
            <YAxis 
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-color)' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-lg)',
              }}
              labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
              itemStyle={{ color: 'var(--text-secondary)', fontSize: '12px' }}
              formatter={(value: number) => [value.toFixed(2), 'Avg RVUs/hour']}
              labelFormatter={(label) => `${label}`}
            />
            <ReferenceLine 
              y={hourlyTarget} 
              stroke="var(--danger)" 
              strokeDasharray="5 5" 
              strokeWidth={2}
            />
            <Bar 
              dataKey="rvu" 
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            >
              {filteredData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.meetsTarget ? '#22c55e' : '#f59e0b'} 
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }} />
          <span style={{ color: 'var(--text-muted)' }}>Meets Target</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }} />
          <span style={{ color: 'var(--text-muted)' }}>Below Target</span>
        </div>
      </div>
    </section>
  )
}
