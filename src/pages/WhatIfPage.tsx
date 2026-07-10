import { useState, useMemo, useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import Sidebar from '@/components/Sidebar'
import { Menu, User, LogOut, Sparkles, Plus, Minus, Wand2, CheckCircle2, Check, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

interface StudyType {
  key: string
  modality: string
  bodyPart: string
  avgRvu: number
  count: number
}

// Subspecialty rotation presets: each selects the study types that rotation reads.
// Matching is by the app's modality + body-part labels (see taxonomy).
const ROTATIONS: { id: string; label: string; match: (s: StudyType) => boolean }[] = [
  { id: 'neuro', label: 'Neuro', match: s => /Head\/Neck|Spine/.test(s.bodyPart) },
  { id: 'body', label: 'Body / Abd', match: s => /Abdomen|Pelvis|Liver|Renal|Stomach/.test(s.bodyPart) && s.modality !== 'US - Obstetrical' },
  { id: 'chest', label: 'Chest', match: s => /Chest/.test(s.bodyPart) },
  { id: 'msk', label: 'MSK', match: s => /Upper Extremity|Lower Extremity|Musculoskeletal|Axilla/.test(s.bodyPart) },
  { id: 'women', label: "Women's / Breast", match: s => s.modality.startsWith('Mammography') || /Breast/.test(s.bodyPart) || s.modality === 'US - Obstetrical' },
  { id: 'nucs', label: 'Nuclear / PET', match: s => s.modality === 'Nuclear Medicine' || s.modality === 'PET/CT' },
  { id: 'us', label: 'Ultrasound', match: s => s.modality.startsWith('US') },
  { id: 'vascular', label: 'Vascular', match: s => s.bodyPart === 'Vascular' || ['CTA', 'MRA', 'MRV'].includes(s.modality) },
  { id: 'fluoro', label: 'Fluoro', match: s => s.modality.startsWith('Fluoroscopy') },
]

// Distribute a target across a pool of study types, weighted by how often the
// resident reads each — a realistic example mix that ~sums to the target.
function computeMix(pool: StudyType[], target: number): Record<string, number> {
  const totalCount = pool.reduce((s, g) => s + g.count, 0)
  if (!totalCount) return {}
  const weightedAvg = pool.reduce((s, g) => s + g.avgRvu * g.count, 0) / totalCount
  if (weightedAvg <= 0) return {}
  const casesNeeded = target / weightedAvg
  const q: Record<string, number> = {}
  for (const g of pool) q[g.key] = Math.round(casesNeeded * (g.count / totalCount))
  return q
}

export default function WhatIfPage() {
  const { user, profile, signOut } = useAuthStore()
  const { records, goalRvuPerDay, fetchRecords, loading } = useDataStore()
  const [initialFetchDone, setInitialFetchDone] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(224)

  const [mode, setMode] = useState<'hour' | 'day'>('hour')
  const [included, setIncluded] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [modalityFilter, setModalityFilter] = useState<Set<string>>(new Set())
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const didAutoSelect = useRef(false)

  useEffect(() => {
    if (user && !initialFetchDone) {
      setInitialFetchDone(true)
      fetchRecords(user.id)
    }
  }, [user, initialFetchDone, fetchRecords])

  // Study types = modality + body part combos (what defines a rotation's menu),
  // each with the resident's own average wRVU and how many they've read.
  const { studyTypes, modalities } = useMemo(() => {
    const map = new Map<string, { modality: string; bodyPart: string; count: number; totalRvu: number }>()
    for (const r of records) {
      const modality = r.modality || 'Unknown'
      const bodyPart = r.bodyPart || 'Unknown'
      const key = `${modality} · ${bodyPart}`
      const g = map.get(key) || { modality, bodyPart, count: 0, totalRvu: 0 }
      g.count++
      g.totalRvu += r.wrvuEstimate
      map.set(key, g)
    }
    const studyTypes: StudyType[] = Array.from(map.entries())
      .map(([key, g]) => ({ key, modality: g.modality, bodyPart: g.bodyPart, avgRvu: g.totalRvu / g.count, count: g.count }))
      .filter(g => g.avgRvu > 0)
      .sort((a, b) => b.count - a.count)
    const modalities = [...new Set(studyTypes.map(s => s.modality))].sort()
    return { studyTypes, modalities }
  }, [records])

  const hourlyTarget = goalRvuPerDay / 8
  const target = mode === 'hour' ? hourlyTarget : goalRvuPerDay

  const visible = useMemo(
    () => (modalityFilter.size ? studyTypes.filter(s => modalityFilter.has(s.modality)) : studyTypes),
    [studyTypes, modalityFilter]
  )

  const { sum, totalCases, includedCount } = useMemo(() => {
    let sum = 0, totalCases = 0, includedCount = 0
    for (const s of studyTypes) {
      if (!included.has(s.key)) continue
      includedCount++
      const q = quantities[s.key] || 0
      sum += q * s.avgRvu
      totalCases += q
    }
    return { sum, totalCases, includedCount }
  }, [studyTypes, included, quantities])

  const met = sum >= target && sum > 0

  // The selected example mix (highest-RVU first).
  const mix = useMemo(
    () => studyTypes
      .filter(s => included.has(s.key) && (quantities[s.key] || 0) > 0)
      .map(s => ({ ...s, qty: quantities[s.key], subtotal: quantities[s.key] * s.avgRvu }))
      .sort((a, b) => b.subtotal - a.subtotal),
    [studyTypes, included, quantities]
  )

  const headingLabel = activePreset ? (ROTATIONS.find(r => r.id === activePreset)?.label ?? 'mix') : 'custom'

  const toggleInclude = (key: string) => {
    setActivePreset(null)
    setIncluded(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        setQuantities(q => ({ ...q, [key]: 0 }))
      } else {
        next.add(key)
      }
      return next
    })
  }

  const setQty = (key: string, n: number) => {
    setActivePreset(null)
    const q = Math.max(0, n)
    setQuantities(prev => ({ ...prev, [key]: q }))
    if (q > 0) setIncluded(prev => new Set(prev).add(key))
  }

  // Pick a subspecialty rotation: check its study types; the effect below fills
  // an example mix (and rescales it when you toggle per-hour / per-day).
  const applyRotation = (presetId: string) => {
    const preset = ROTATIONS.find(r => r.id === presetId)
    if (!preset) return
    const matched = studyTypes.filter(preset.match)
    if (!matched.length) {
      toast.error(`No ${preset.label} studies in your data yet`)
      return
    }
    setModalityFilter(new Set())
    setIncluded(new Set(matched.map(m => m.key)))
    setActivePreset(presetId)
  }

  // Keep the active rotation's example mix in sync with the current target.
  useEffect(() => {
    if (!activePreset) return
    const preset = ROTATIONS.find(r => r.id === activePreset)
    if (!preset) return
    const matched = studyTypes.filter(preset.match)
    const t = mode === 'hour' ? goalRvuPerDay / 8 : goalRvuPerDay
    setQuantities(computeMix(matched, t))
  }, [activePreset, mode, studyTypes, goalRvuPerDay])

  // On first load, auto-select the resident's dominant rotation so the page
  // shows an answer immediately (demos itself).
  useEffect(() => {
    if (didAutoSelect.current || !studyTypes.length) return
    didAutoSelect.current = true
    let best: string | null = null, bestCount = 0
    for (const r of ROTATIONS) {
      const c = studyTypes.filter(r.match).reduce((s, g) => s + g.count, 0)
      if (c > bestCount) { bestCount = c; best = r.id }
    }
    if (best) {
      setActivePreset(best)
      setIncluded(new Set(studyTypes.filter(ROTATIONS.find(r => r.id === best)!.match).map(m => m.key)))
    }
  }, [studyTypes])

  const toggleModality = (m: string) =>
    setModalityFilter(prev => {
      const next = new Set(prev)
      next.has(m) ? next.delete(m) : next.add(m)
      return next
    })

  // Distribute the target across the SELECTED study types, weighted by how often
  // the resident actually reads each — a realistic mix for this rotation.
  const autoFill = () => {
    const set = studyTypes.filter(s => included.has(s.key))
    const pool = set.length ? set : visible
    if (!pool.length) return
    setActivePreset(null)
    setIncluded(new Set(pool.map(g => g.key)))
    setQuantities({ ...quantities, ...computeMix(pool, target) })
  }

  const clear = () => {
    setActivePreset(null)
    setQuantities({})
    setIncluded(new Set())
  }

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
              {/* Rotation presets — one click selects a subspecialty's studies */}
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                <span className="text-[11px] mr-1 font-medium" style={{ color: 'var(--text-muted)' }}>Rotation:</span>
                {ROTATIONS.map(r => {
                  const on = activePreset === r.id
                  return (
                    <button
                      key={r.id}
                      onClick={() => applyRotation(r.id)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                      style={{
                        backgroundColor: on ? 'var(--accent-primary)' : 'var(--bg-card)',
                        color: on ? 'white' : 'var(--text-secondary)',
                        border: on ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      }}
                    >
                      {r.label}
                    </button>
                  )
                })}
                {(mix.length > 0 || activePreset) && (
                  <button onClick={clear} className="ml-1 text-[11px] px-1.5 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>clear</button>
                )}
              </div>

              {/* Hero: the answer, front and center */}
              <div className="rounded-2xl border border-slate-800 p-5" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="flex items-baseline justify-between gap-3 mb-4">
                  <h2 className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Your <span className="font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>{headingLabel}</span> {mode} ≈
                  </h2>
                  <div className="text-right whitespace-nowrap">
                    <span className="text-xl font-bold" style={{ color: met ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{sum.toFixed(1)}</span>
                    <span className="text-slate-500 text-sm"> / {target.toFixed(1)} RVU</span>
                    {met && <CheckCircle2 className="inline w-4 h-4 ml-1 mb-0.5 text-emerald-400" />}
                    {mix.length > 0 && (
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{totalCases} studies per {mode}</div>
                    )}
                  </div>
                </div>

                {mix.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">Pick a rotation above to see how many of each study you'd read.</p>
                ) : (
                  <div className="space-y-2.5">
                    {mix.map(m => {
                      const widthPct = target > 0 ? Math.min(100, (m.subtotal / target) * 100) : 0
                      return (
                        <div key={m.key} className="flex items-center gap-3">
                          <div className="w-36 sm:w-44 shrink-0 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                            <span style={{ color: 'var(--accent-primary)' }}>{m.modality}</span> · {m.bodyPart}
                          </div>
                          <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <div className="h-full rounded-md" style={{ width: `${widthPct}%`, backgroundColor: 'var(--accent-primary)', opacity: 0.85 }} />
                          </div>
                          <div className="w-9 text-right text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>×{m.qty}</div>
                          <div className="w-11 text-right text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{m.subtotal.toFixed(1)}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Fine-tune expander — the detailed editing lives here */}
              <button
                onClick={() => setShowDetails(v => !v)}
                className="mt-4 flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80"
                style={{ color: 'var(--text-secondary)' }}
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                Fine-tune the mix
              </button>

              {showDetails && (
                <div className="mt-3 animate-slide-down">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <button
                      onClick={autoFill}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white transition-colors"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                      title={includedCount ? 'Distribute the target across your checked study types' : 'Auto-fill across the study types shown'}
                    >
                      <Wand2 className="w-3.5 h-3.5" /> Auto-fill
                    </button>
                    {modalities.length > 1 && (
                      <>
                        <span className="text-[11px] ml-1" style={{ color: 'var(--text-muted)' }}>Filter:</span>
                        {modalities.map(m => {
                          const on = modalityFilter.has(m)
                          return (
                            <button
                              key={m}
                              onClick={() => toggleModality(m)}
                              className="px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors"
                              style={{
                                backgroundColor: on ? 'var(--accent-primary)' : 'transparent',
                                color: on ? 'white' : 'var(--text-muted)',
                                border: on ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                              }}
                            >
                              {m}
                            </button>
                          )
                        })}
                      </>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {visible.map(s => {
                      const on = included.has(s.key)
                      const q = quantities[s.key] || 0
                      const subtotal = q * s.avgRvu
                      return (
                        <div
                          key={s.key}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors"
                          style={{
                            backgroundColor: on ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
                            borderColor: on ? 'rgba(16,185,129,0.3)' : 'var(--border-color)',
                          }}
                        >
                          <button
                            onClick={() => toggleInclude(s.key)}
                            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors"
                            style={{
                              backgroundColor: on ? 'var(--accent-primary)' : 'transparent',
                              border: on ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                            }}
                            title={on ? 'Remove from your rotation' : 'Add to your rotation'}
                          >
                            {on && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                              <span style={{ color: 'var(--accent-primary)' }}>{s.modality}</span>
                              <span className="text-slate-500"> · </span>
                              {s.bodyPart}
                            </div>
                            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              {s.avgRvu.toFixed(2)} RVU avg · you've read {s.count.toLocaleString()}
                            </div>
                          </div>

                          <div className="text-right w-14 shrink-0">
                            {q > 0 && <span className="text-xs font-mono text-emerald-400">{subtotal.toFixed(1)}</span>}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setQty(s.key, q - 1)}
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
                              onChange={e => setQty(s.key, Math.floor(Number(e.target.value) || 0))}
                              className="w-11 text-center py-1 rounded-lg text-sm outline-none bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600"
                            />
                            <button
                              onClick={() => setQty(s.key, q + 1)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
                              style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    {visible.length === 0 && (
                      <p className="text-center text-sm text-slate-500 py-8">No study types match that filter.</p>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-600 mt-4 leading-relaxed">
                    Averages come from your own reads, so the mix reflects your real complexity. This is a planning estimate —
                    actual RVUs vary by exact study and contrast.
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
