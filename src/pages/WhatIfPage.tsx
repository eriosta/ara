import { useState, useMemo, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import Sidebar from '@/components/Sidebar'
import { Menu, User, LogOut, Sparkles, Plus, Minus, Wand2, RotateCcw, CheckCircle2 } from 'lucide-react'

export default function WhatIfPage() {
  const { user, profile, signOut } = useAuthStore()
  const { records, goalRvuPerDay, fetchRecords, loading } = useDataStore()
  const [initialFetchDone, setInitialFetchDone] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(224)

  const [mode, setMode] = useState<'hour' | 'day'>('hour')
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  useEffect(() => {
    if (user && !initialFetchDone) {
      setInitialFetchDone(true)
      fetchRecords(user.id)
    }
  }, [user, initialFetchDone, fetchRecords])

  // Per-body-part average wRVU + volume from the resident's own reads.
  const { groups, avgPerCase } = useMemo(() => {
    const map = new Map<string, { count: number; totalRvu: number }>()
    let totalRvu = 0
    for (const r of records) {
      const bp = r.bodyPart || 'Unknown'
      const g = map.get(bp) || { count: 0, totalRvu: 0 }
      g.count++
      g.totalRvu += r.wrvuEstimate
      map.set(bp, g)
      totalRvu += r.wrvuEstimate
    }
    const groups = Array.from(map.entries())
      .map(([bodyPart, g]) => ({
        bodyPart,
        count: g.count,
        avgRvu: g.totalRvu / g.count,
        share: records.length ? g.count / records.length : 0,
      }))
      .filter(g => g.avgRvu > 0) // a 0-RVU group can never contribute to a target
      .sort((a, b) => b.count - a.count)
    return { groups, avgPerCase: records.length ? totalRvu / records.length : 0 }
  }, [records])

  const hourlyTarget = goalRvuPerDay / 8
  const target = mode === 'hour' ? hourlyTarget : goalRvuPerDay

  const { sum, totalCases } = useMemo(() => {
    let sum = 0, totalCases = 0
    for (const g of groups) {
      const q = quantities[g.bodyPart] || 0
      sum += q * g.avgRvu
      totalCases += q
    }
    return { sum, totalCases }
  }, [groups, quantities])

  const pct = target > 0 ? Math.min(100, (sum / target) * 100) : 0
  const met = sum >= target && sum > 0
  const remaining = Math.max(0, target - sum)

  const setQty = (bp: string, n: number) =>
    setQuantities(prev => ({ ...prev, [bp]: Math.max(0, n) }))

  // Fill quantities from the resident's historical case-mix, scaled to the target.
  const autoFill = () => {
    if (avgPerCase <= 0) return
    const casesNeeded = target / avgPerCase
    const next: Record<string, number> = {}
    for (const g of groups) {
      const n = Math.round(casesNeeded * g.share)
      if (n > 0) next[g.bodyPart] = n
    }
    setQuantities(next)
  }

  const clear = () => setQuantities({})

  const hasData = records.length > 0

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} width={sidebarWidth} onWidthChange={setSidebarWidth} />

      <div className="flex-1 bg-slate-950 flex flex-col max-lg:!ml-0" style={{ marginLeft: `${sidebarWidth}px` }}>
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700">
            <Menu className="w-5 h-5 text-slate-400" />
          </button>
          <h1 className="text-lg font-display font-bold"><span className="text-white">What</span><span className="text-emerald-400">-If</span></h1>
          <div className="w-10" />
        </header>

        {/* Toolbar */}
        <div className="sticky top-0 z-30" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="flex items-center gap-2 flex-wrap px-4 lg:px-6 py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>What-If</span>
            </div>

            {/* Per hour / Per day toggle */}
            {hasData && (
              <div className="flex items-center rounded-lg overflow-hidden ml-2" style={{ border: '1px solid var(--border-color)' }}>
                {(['hour', 'day'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className="px-2.5 py-1 text-[11px] font-medium transition-colors"
                    style={{
                      backgroundColor: mode === m ? 'var(--accent-primary)' : 'transparent',
                      color: mode === m ? 'white' : 'var(--text-muted)',
                    }}
                  >
                    Per {m}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 ml-auto shrink-0">
              <div className="flex items-center gap-2 px-1.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <User className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-xs font-medium hidden sm:block" style={{ color: 'var(--text-secondary)' }}>{profile?.full_name || 'Resident'}</span>
              </div>
              <button onClick={() => signOut()} className="p-1.5 rounded-lg hover:bg-white/5" title="Sign out">
                <LogOut className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-3xl">
          {loading && records.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-10 h-10 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin" />
            </div>
          ) : !hasData ? (
            <div className="text-center py-16">
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <h2 className="text-xl font-semibold text-white mb-2">No Data Available</h2>
              <p className="text-slate-400">Upload your studies to plan how to hit your RVU target.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-xl bg-blue-500/5 border border-blue-500/20 px-4 py-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Build a mix of studies that hits your target. Each row uses <span className="text-slate-300 font-medium">your own average wRVU</span> for that
                  body part. Set how many of each you'd read and watch the total — or hit <span className="text-slate-300 font-medium">Auto-fill</span> to
                  see a realistic mix based on how you actually read.
                </p>
              </div>

              {/* Target progress card */}
              <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-5 mb-5 sticky top-[52px] z-10" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="text-xs text-slate-500">Target · per {mode}</div>
                    <div className="text-2xl font-bold" style={{ color: met ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {sum.toFixed(1)} <span className="text-slate-500 text-lg font-normal">/ {target.toFixed(1)} RVU</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: met ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                      {met ? (
                        <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Target met with {totalCases} stud{totalCases === 1 ? 'y' : 'ies'}</span>
                      ) : (
                        `${remaining.toFixed(1)} RVU to go · ${totalCases} selected`
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={autoFill}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white transition-colors"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                      title="Fill quantities from your historical case-mix, scaled to the target"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> Auto-fill
                    </button>
                    <button
                      onClick={clear}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] transition-colors hover:bg-white/5"
                      style={{ color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
                      title="Clear all quantities"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Clear
                    </button>
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${met ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Body-part rows */}
              <div className="space-y-1.5">
                {groups.map(g => {
                  const q = quantities[g.bodyPart] || 0
                  const subtotal = q * g.avgRvu
                  const active = q > 0
                  return (
                    <div
                      key={g.bodyPart}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors"
                      style={{
                        backgroundColor: active ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
                        borderColor: active ? 'rgba(16,185,129,0.3)' : 'var(--border-color)',
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{g.bodyPart}</div>
                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {g.avgRvu.toFixed(2)} RVU avg · you've read {g.count.toLocaleString()}
                        </div>
                      </div>

                      {/* subtotal */}
                      <div className="text-right w-16 shrink-0">
                        {active && <span className="text-xs font-mono text-emerald-400">{subtotal.toFixed(1)}</span>}
                      </div>

                      {/* stepper */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setQty(g.bodyPart, q - 1)}
                          disabled={q === 0}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5 disabled:opacity-30"
                          style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={q === 0 ? '' : q}
                          placeholder="0"
                          onChange={e => setQty(g.bodyPart, Math.floor(Number(e.target.value) || 0))}
                          className="w-11 text-center py-1 rounded-lg text-sm outline-none bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600"
                        />
                        <button
                          onClick={() => setQty(g.bodyPart, q + 1)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
                          style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="text-[11px] text-slate-600 mt-4 leading-relaxed">
                Averages come from your own reads, so the mix reflects your real complexity. This is a planning estimate — actual
                RVUs vary by exact study and contrast.
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
