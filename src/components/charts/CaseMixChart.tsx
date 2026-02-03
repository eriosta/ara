import { useDataStore } from '@/stores/dataStore'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell 
} from 'recharts'
import { Layers } from 'lucide-react'
import InfoTooltip from '../InfoTooltip'

const COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899']

export default function CaseMixChart() {
  const { caseMixData } = useDataStore()

  if (caseMixData.length === 0) return null

  const chartData = caseMixData.map((d, i) => ({
    ...d,
    shortLabel: d.label.length > 25 ? d.label.substring(0, 22) + '...' : d.label,
    color: COLORS[i % COLORS.length],
  }))

  return (
    <section 
      className="p-5 rounded-xl animate-slide-up" 
      style={{ 
        backgroundColor: 'var(--bg-card)', 
        border: '1px solid var(--border-color)',
        animationDelay: '0.3s' 
      }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--accent-muted)' }}
        >
          <Layers className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
        </div>
        <div>
          <h3 className="text-lg font-display font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
            Top Case Mix
            <InfoTooltip text="Highest-RVU study type combinations. Shows where most of your productivity comes from." />
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Modality & Body Part combinations
          </p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData} 
            layout="vertical"
            margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} horizontal={true} vertical={false} />
            <XAxis 
              type="number"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-color)' }}
            />
            <YAxis 
              type="category"
              dataKey="shortLabel"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-color)' }}
              width={140}
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
              formatter={(value: number, _name: string, props: any) => [
                `${value.toFixed(1)} RVUs (${props.payload.cases} cases)`,
                ''
              ]}
              labelFormatter={(_label: any, payload: any) => payload?.[0]?.payload?.label || _label}
            />
            <Bar 
              dataKey="rvu" 
              radius={[0, 4, 4, 0]}
              maxBarSize={32}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
