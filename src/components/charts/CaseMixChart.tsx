import { useDataStore } from '@/stores/dataStore'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell 
} from 'recharts'
import { Layers } from 'lucide-react'

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
    <section className="chart-container animate-slide-up" style={{ animationDelay: '0.3s' }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <Layers className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-display font-semibold text-dark-100">Top Case Mix</h3>
          <p className="text-sm text-dark-400">Modality & Body Part combinations</p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData} 
            layout="vertical"
            margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} horizontal={true} vertical={false} />
            <XAxis 
              type="number"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis 
              type="category"
              dataKey="shortLabel"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              width={140}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
              labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
              itemStyle={{ color: '#94a3b8', fontSize: '12px' }}
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

