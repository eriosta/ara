import { useState, useMemo, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import Sidebar from '@/components/Sidebar'
import { countAcgmeCategories } from '@/lib/acgmeCategories'
import { RVURecord } from '@/lib/dataProcessing'
import { Menu, User, LogOut, ChevronRight, ChevronDown, Target, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'

const MIN_KEY = 'myrvu-acgme-minimums'
const REPORTED_KEY = 'myrvu-acgme-reported'

function loadMap(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

// Collapse matched studies into unique descriptions with counts (most frequent first)
function dedupe(records: RVURecord[]): { desc: string; count: number }[] {
  const map = new Map<string, number>()
  records.forEach(r => map.set(r.examDescription, (map.get(r.examDescription) || 0) + 1))
  return Array.from(map.entries())
    .map(([desc, count]) => ({ desc, count }))
    .sort((a, b) => b.count - a.count)
}

export default function AcgmePage() {
  const { user, profile, signOut } = useAuthStore()
  const { records, fetchRecords, loading } = useDataStore()
  const [initialFetchDone, setInitialFetchDone] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(224)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // User-editable overrides (persisted per browser)
  const [minOverrides, setMinOverrides] = useState<Record<string, string>>(() => loadMap(MIN_KEY))
  const [reported, setReported] = useState<Record<string, string>>(() => loadMap(REPORTED_KEY))

  useEffect(() => { localStorage.setItem(MIN_KEY, JSON.stringify(minOverrides)) }, [minOverrides])
  useEffect(() => { localStorage.setItem(REPORTED_KEY, JSON.stringify(reported)) }, [reported])

  useEffect(() => {
    if (user && !initialFetchDone) {
      setInitialFetchDone(true)
      fetchRecords(user.id)
    }
  }, [user, initialFetchDone, fetchRecords])

  const counts = useMemo(() => countAcgmeCategories(records), [records])

  const rows = useMemo(() => counts.map(({ category, count, matched }) => {
    const minRaw = minOverrides[category.id]
    const minimum = minRaw !== undefined && minRaw !== '' ? Number(minRaw) : category.defaultMinimum
    const reportedRaw = reported[category.id]
    const reportedNum = reportedRaw !== undefined && reportedRaw !== '' ? Number(reportedRaw) : null
    const met = count >= minimum
    const remaining = Math.max(0, minimum - count)
    const pct = minimum > 0 ? Math.min(100, (count / minimum) * 100) : 100
    const discrepancy = reportedNum !== null ? count - reportedNum : null
    return { category, count, matched, minimum, reportedNum, met, remaining, pct, discrepancy }
  }), [counts, minOverrides, reported])

  const metCount = rows.filter(r => r.met).length

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const resetOverrides = () => {
    setMinOverrides({})
    setReported({})
  }

  const hasData = records.length > 0

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
      />

      <div className="flex-1 bg-slate-950 flex flex-col max-lg:!ml-0" style={{ marginLeft: `${sidebarWidth}px` }}>
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg transition-colors bg-slate-800 hover:bg-slate-700"
          >
            <Menu className="w-5 h-5 text-slate-400" />
          </button>
          <h1 className="text-lg font-display font-bold">
            <span className="text-white">ACGME</span>
            <span className="text-emerald-400"> Minimums</span>
          </h1>
          <div className="w-10" />
        </header>

        {/* Toolbar */}
        <div className="sticky top-0 z-30" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="flex items-center gap-2 flex-wrap px-4 lg:px-6 py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>ACGME Minimums</span>
            </div>

            {hasData && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--accent-primary)' }}>
                {metCount}/{rows.length} minimums met
              </span>
            )}

            <div className="flex items-center gap-3 ml-auto shrink-0">
              <button
                onClick={resetOverrides}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-colors hover:bg-white/5"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
                title="Reset minimums and reported numbers to defaults"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
              <div className="w-px h-5 hidden sm:block" style={{ backgroundColor: 'var(--border-color)' }} />
              <div className="flex items-center gap-2 px-1.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <User className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-xs font-medium hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
                  {profile?.full_name || 'Resident'}
                </span>
              </div>
              <button onClick={() => signOut()} className="p-1.5 rounded-lg transition-colors hover:bg-white/5" title="Sign out">
                <LogOut className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {loading && records.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-500">Loading your data...</p>
              </div>
            </div>
          ) : !hasData ? (
            <div className="text-center py-16">
              <Target className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <h2 className="text-xl font-semibold text-white mb-2">No Data Available</h2>
              <p className="text-slate-400">Upload your studies to track progress toward ACGME minimums.</p>
            </div>
          ) : (
            <>
              {/* Explainer */}
              <div className="mb-4 rounded-xl bg-blue-500/5 border border-blue-500/20 px-4 py-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  <span className="text-blue-300 font-medium">App count</span> is myRVU's independent tally from your uploaded studies.
                  Enter your program's <span className="text-slate-300 font-medium">Reported</span> number to spot discrepancies (Δ),
                  and edit <span className="text-slate-300 font-medium">Min</span> if your program's requirement differs.
                  Click a row to see exactly which studies were counted.
                  Counts reflect <span className="text-slate-300 font-medium">all uploaded data</span> ({records.length.toLocaleString()} studies).
                </p>
              </div>

              {/* Header row */}
              <div className="hidden sm:grid grid-cols-[1fr_70px_90px_90px_70px_140px] gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <span>Category</span>
                <span className="text-right">Min</span>
                <span className="text-right">App count</span>
                <span className="text-right">Reported</span>
                <span className="text-right">Δ</span>
                <span>Progress</span>
              </div>

              <div className="space-y-2">
                {rows.map(row => {
                  const isOpen = expanded.has(row.category.id)
                  const minVal = minOverrides[row.category.id] ?? String(row.category.defaultMinimum)
                  const repVal = reported[row.category.id] ?? ''
                  return (
                    <div key={row.category.id} className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden">
                      <div className="grid grid-cols-[1fr_70px_90px_90px_70px_140px] gap-3 items-center px-4 py-3">
                        {/* Category name + toggle */}
                        <button onClick={() => toggle(row.category.id)} className="flex items-center gap-2 text-left min-w-0">
                          <span className="text-slate-500 shrink-0">
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm text-white font-medium truncate">{row.category.name}</div>
                            <div className="text-[10px] text-slate-500 truncate">{row.category.description}</div>
                          </div>
                        </button>

                        {/* Editable minimum */}
                        <input
                          type="number"
                          min={0}
                          value={minVal}
                          onChange={e => setMinOverrides(prev => ({ ...prev, [row.category.id]: e.target.value }))}
                          className="w-full text-right px-2 py-1 rounded-md text-xs outline-none bg-slate-950 border border-slate-700 text-slate-300 focus:border-emerald-500"
                        />

                        {/* App count */}
                        <div className="text-right">
                          <span className={`text-sm font-mono font-semibold ${row.met ? 'text-emerald-400' : 'text-white'}`}>
                            {row.count.toLocaleString()}
                          </span>
                        </div>

                        {/* Editable reported */}
                        <input
                          type="number"
                          min={0}
                          placeholder="—"
                          value={repVal}
                          onChange={e => setReported(prev => ({ ...prev, [row.category.id]: e.target.value }))}
                          className="w-full text-right px-2 py-1 rounded-md text-xs outline-none bg-slate-950 border border-slate-700 text-slate-300 focus:border-emerald-500 placeholder:text-slate-600"
                        />

                        {/* Delta */}
                        <div className="text-right">
                          {row.discrepancy === null ? (
                            <span className="text-xs text-slate-600">—</span>
                          ) : row.discrepancy === 0 ? (
                            <span className="text-xs font-mono text-emerald-400" title="App count matches your program's reported number">
                              0
                            </span>
                          ) : (
                            <span
                              className="text-xs font-mono font-semibold text-amber-400"
                              title="App count differs from your program's reported number"
                            >
                              {row.discrepancy > 0 ? '+' : ''}{row.discrepancy}
                            </span>
                          )}
                        </div>

                        {/* Progress toward minimum */}
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${row.met ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                style={{ width: `${row.pct}%` }}
                              />
                            </div>
                            {row.met ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                          </div>
                          <div className="text-[10px] mt-0.5 text-right">
                            {row.met ? (
                              <span className="text-emerald-400/80">Met</span>
                            ) : (
                              <span className="text-amber-400/80">{row.remaining.toLocaleString()} short</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Drill-down: which studies were counted */}
                      {isOpen && (
                        <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-3">
                          {row.matched.length === 0 ? (
                            <p className="text-xs text-slate-500 py-2">No studies matched this category in your uploaded data.</p>
                          ) : (
                            <>
                              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                                {row.count.toLocaleString()} studies counted · {dedupe(row.matched).length} distinct descriptions
                              </p>
                              <div className="max-h-72 overflow-y-auto space-y-1">
                                {dedupe(row.matched).map(({ desc, count }, i) => (
                                  <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-slate-800/40 text-xs">
                                    <span className="text-slate-300 truncate flex-1">{desc}</span>
                                    <span className="text-slate-500 font-mono whitespace-nowrap">×{count}</span>
                                  </div>
                                ))}
                              </div>
                              <p className="text-[10px] text-slate-600 mt-2">
                                Most recent: {format(
                                  row.matched.reduce((a, b) => (a.dictationDatetime > b.dictationDatetime ? a : b)).dictationDatetime,
                                  'MMM d, yyyy'
                                )}
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <p className="text-[11px] text-slate-600 mt-4 leading-relaxed">
                Note: categories can overlap (a single MRI may count toward more than one MRI category), matching how case-log
                systems tally. If a count looks off, open the row to inspect the exact studies — mismatches usually trace to a
                borderline exam description that the classifier reads differently than your program's system.
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
