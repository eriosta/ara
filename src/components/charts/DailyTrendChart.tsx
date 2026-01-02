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
    <section 
      className="p-5 rounded-xl animate-slide-up" 
      style={{ 
        backgroundColor: 'var(--bg-card)', 
        border: '1px solid var(--border-color)',
        animationDelay: '0.1s' 
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div 
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--accent-muted)' }}
          >
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Daily Performance
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Target: {goalRvuPerDay} RVUs/day
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--accent-primary)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Daily</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-0.5" style={{ backgroundColor: '#f59e0b' }} />
            <span style={{ color: 'var(--text-muted)' }}>7-Day MA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-0.5" style={{ backgroundColor: '#ef4444', opacity: 0.7 }} />
            <span style={{ color: 'var(--text-muted)' }}>Target</span>
          </div>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rvuGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
            <XAxis 
              dataKey="dateFormatted" 
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-color)' }}
            />
            <YAxis 
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-color)' }}
              domain={[0, 'auto']}
              width={35}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
              labelStyle={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}
              itemStyle={{ color: 'var(--text-secondary)', fontSize: '12px' }}
              formatter={(value: number, name: string) => [
                value.toFixed(1),
                name === 'rvu' ? 'Daily RVUs' : '7-Day Average'
              ]}
            />
            <ReferenceLine 
              y={goalRvuPerDay} 
              stroke="#ef4444" 
              strokeDasharray="5 5" 
              strokeWidth={1.5}
              strokeOpacity={0.7}
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
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#22c55e', stroke: 'var(--bg-card)', strokeWidth: 2 }}
            />
            <Line 
              type="monotone" 
              dataKey="ma7" 
              stroke="#f59e0b" 
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Best Day Highlight */}
      {metrics && (
        <div className="mt-4 flex items-center gap-2 text-xs">
          <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--warning)' }} />
          <span style={{ color: 'var(--text-muted)' }}>Best Day:</span>
          <span style={{ color: 'var(--text-primary)' }}>
            {format(new Date(metrics.bestDayDate), 'MMM d, yyyy')}
          </span>
          <span style={{ color: 'var(--accent-primary)' }}>
            {metrics.bestDayRvu.toFixed(1)} RVUs
          </span>
        </div>
      )}
    </section>
  )
}
