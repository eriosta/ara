import { useDataStore } from '@/stores/dataStore'
import { 
  Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart 
} from 'recharts'
import { TrendingUp, Calendar } from 'lucide-react'
import { format } from 'date-fns'

export default function DailyTrendChart() {
  const { dailyData, goalRvuPerDay, metrics } = useDataStore()

  if (dailyData.length === 0) return null

  const chartData = dailyData.map(d => ({
    ...d,
    dateFormatted: format(new Date(d.date), 'MMM d'),
  }))

  return (
    <section className="chart-container animate-slide-up" style={{ animationDelay: '0.1s' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-display font-semibold text-dark-100">Daily Performance Trend</h3>
            <p className="text-sm text-dark-400">Target: {goalRvuPerDay} RVUs/day</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary-500" />
            <span className="text-dark-400">Daily RVUs</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-amber-400" style={{ borderStyle: 'dashed' }} />
            <span className="text-dark-400">7-Day MA</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-red-400" style={{ borderStyle: 'dashed' }} />
            <span className="text-dark-400">Target</span>
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rvuGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
            <XAxis 
              dataKey="dateFormatted" 
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis 
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              domain={[0, 'auto']}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
              labelStyle={{ color: '#f1f5f9', fontWeight: 600, marginBottom: '4px' }}
              itemStyle={{ color: '#94a3b8', fontSize: '12px' }}
              formatter={(value: number, name: string) => [
                value.toFixed(1),
                name === 'rvu' ? 'Daily RVUs' : '7-Day Average'
              ]}
            />
            <ReferenceLine 
              y={goalRvuPerDay} 
              stroke="#ef4444" 
              strokeDasharray="5 5" 
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="rvu"
              fill="url(#rvuGradient)"
              stroke="transparent"
            />
            <Line 
              type="monotone" 
              dataKey="rvu" 
              stroke="#22c55e" 
              strokeWidth={2.5}
              dot={false}
              activeDot={{ 
                r: 6, 
                fill: '#22c55e', 
                stroke: '#0f172a', 
                strokeWidth: 2 
              }}
            />
            <Line 
              type="monotone" 
              dataKey="ma7" 
              stroke="#f59e0b" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Best Day Highlight */}
      {metrics && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-amber-400" />
          <span className="text-dark-400">Best Day:</span>
          <span className="text-dark-200 font-medium">
            {format(new Date(metrics.bestDayDate), 'MMM d, yyyy')}
          </span>
          <span className="text-primary-400 font-semibold">
            {metrics.bestDayRvu.toFixed(1)} RVUs
          </span>
        </div>
      )}
    </section>
  )
}

