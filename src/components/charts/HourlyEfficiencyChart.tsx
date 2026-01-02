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
    <section className="chart-container animate-slide-up" style={{ animationDelay: '0.2s' }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <Clock className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-lg font-display font-semibold text-dark-100">Hourly Efficiency</h3>
          <p className="text-sm text-dark-400">Target: {hourlyTarget.toFixed(1)} RVUs/hour</p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
            <XAxis 
              dataKey="hourLabel" 
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis 
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
              labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
              itemStyle={{ color: '#94a3b8', fontSize: '12px' }}
              formatter={(value: number) => [value.toFixed(2), 'Avg RVUs/hour']}
              labelFormatter={(label) => `${label}`}
            />
            <ReferenceLine 
              y={hourlyTarget} 
              stroke="#ef4444" 
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
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary-500" />
          <span className="text-dark-400">Meets Target</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <span className="text-dark-400">Below Target</span>
        </div>
      </div>
    </section>
  )
}

