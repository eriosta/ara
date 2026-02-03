import { useDataStore } from '@/stores/dataStore'
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer 
} from 'recharts'
import { PieChart as PieChartIcon } from 'lucide-react'
import InfoTooltip from '../InfoTooltip'

const COLORS = [
  '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899',
  '#06b6d4', '#f97316', '#84cc16', '#6366f1', '#14b8a6'
]

export default function ModalityPieChart() {
  const { modalityData } = useDataStore()

  if (modalityData.length === 0) return null

  const chartData = modalityData.slice(0, 8).map((d, i) => ({
    ...d,
    color: COLORS[i % COLORS.length],
  }))

  const total = chartData.reduce((sum, d) => sum + d.value, 0)

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor="middle" 
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <section 
      className="p-5 rounded-xl animate-slide-up" 
      style={{ 
        backgroundColor: 'var(--bg-card)', 
        border: '1px solid var(--border-color)',
        animationDelay: '0.4s' 
      }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'rgba(236, 72, 153, 0.1)' }}
        >
          <PieChartIcon className="w-5 h-5" style={{ color: '#ec4899' }} />
        </div>
        <div>
          <h3 className="text-lg font-display font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
            RVUs by Modality
            <InfoTooltip text="Work distribution across imaging modalities. Identifies your specialty focus areas." />
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Total: {total.toFixed(1)} RVUs
          </p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={CustomLabel}
              outerRadius={100}
              innerRadius={40}
              dataKey="value"
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color} 
                  stroke="var(--bg-card)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-lg)',
              }}
              labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
              itemStyle={{ color: 'var(--text-secondary)', fontSize: '12px' }}
              formatter={(value: number) => [`${value.toFixed(1)} RVUs`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="truncate" style={{ color: 'var(--text-muted)' }}>
              {entry.name}
            </span>
            <span className="font-medium ml-auto" style={{ color: 'var(--text-secondary)' }}>
              {entry.value.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
