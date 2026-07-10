import { useState, useMemo, useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import Sidebar from '@/components/Sidebar'
import { Menu, User, LogOut, Sparkles, Plus, Minus, Wand2, CheckCircle2, ChevronDown, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'

const ROTATION_KEY = 'myrvu-whatif-rotation'

interface StudyType {
  key: string
  modality: string
  bodyPart: string
  avgRvu: number
  count: number
}

// Nuclear medicine and PET are only read on the nuclear-medicine rotation, so
// they're excluded from every anatomy-based rotation (a V/Q lung scan must not
// land in "Chest", a thyroid scan must not land in "Neuro", etc.).
const NM_MODALITIES = ['Nuclear Medicine', 'PET/CT']
const notNM = (s: StudyType) => !NM_MODALITIES.includes(s.modality)

// Subspecialty rotation presets: each selects the study types that rotation reads.
// Matching is by the app's modality + body-part labels (see taxonomy).
const ROTATIONS: { id: string; label: string; match: (s: StudyType) => boolean }[] = [
  { id: 'neuro', label: 'Neuro', match: s => notNM(s) && /Head\/Neck|Spine/.test(s.bodyPart) },
  { id: 'body', label: 'Body / Abd', match: s => notNM(s) && s.modality !== 'US - Obstetrical' && /Abdomen|Pelvis|Liver|Renal|Stomach/.test(s.bodyPart) },
  { id: 'chest', label: 'Chest', match: s => notNM(s) && /Chest/.test(s.bodyPart) },
  { id: 'msk', label: 'MSK', match: s => notNM(s) && /Upper Extremity|Lower Extremity|Musculoskeletal|Axilla/.test(s.bodyPart) },
  { id: 'women', label: "Women's / Breast", match: s => notNM(s) && (s.modality.startsWith('Mammography') || /Breast/.test(s.bodyPart) || s.modality === 'US - Obstetrical') },
  { id: 'nucs', label: 'Nuclear / PET', match: s => NM_MODALITIES.includes(s.modality) },
  { id: 'us', label: 'Ultrasound', match: s => s.modality.startsWith('US') },
  { id: 'vascular', label: 'Vascular', match: s => notNM(s) && (s.bodyPart === 'Vascular' || ['CTA', 'MRA', 'MRV'].includes(s.modality)) },
  { id: 'fluoro', label: 'Fluoro', match: s => s.modality.startsWith('Fluoroscopy') },
]

// How strongly a "Heavy on" emphasis skews the mix toward a modality/region.
const EMPHASIS_BOOST = 4

// Distribute a target across a pool of study types, weighted by `weightOf`
// (defaults to how often the resident reads each) — a realistic example mix
// that ~sums to the target.
function computeMix(
  pool: StudyType[],
  target: number,
  weightOf: (s: StudyType) => number = s => s.count,
): Record<string, number> {
  const totalW = pool.reduce((s, g) => s + weightOf(g), 0)
  if (!totalW) return {}
  const weightedAvg = pool.reduce((s, g) => s + g.avgRvu * weightOf(g), 0) / totalW
  if (weightedAvg <= 0) return {}
  const casesNeeded = target / weightedAvg
  const q: Record<string, number> = {}
  for (const g of pool) q[g.key] = Math.round(casesNeeded * (weightOf(g) / totalW))
  return q
}

export default function WhatIfPage() {
  const { user, profile, signOut } = useAuthStore()
  const { records, goalRvuPerDay, fetchRecords, loading } = useDataStore()
  const [initialFetchDone, setInitialFetchDone] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(224)

  const [included, setIncluded] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [emphasis, setEmphasis] = useState<Set<string>>(new Set()) // modality/region tokens to weight toward
  const [showDetails, setShowDetails] = useState(false)
  const [search, setSearch] = useState('')
  const didAutoSelect = useRef(false)

  useEffect(() => {
    if (user && !initialFetchDone) {
      setInitialFetchDone(true)
      fetchRecords(user.id)
    }
  }, [user, initialFetchDone, fetchRecords])

  // Study types = modality + body part combos (what defines a rotation's menu),
  // each with the resident's own average wRVU and how many they've read.
  const studyTypes = useMemo<StudyType[]>(() => {
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
    return Array.from(map.entries())
      .map(([key, g]) => ({ key, modality: g.modality, bodyPart: g.bodyPart, avgRvu: g.totalRvu / g.count, count: g.count }))
      .filter(g => g.avgRvu > 0)
      .sort((a, b) => b.count - a.count)
  }, [records])

  const target = goalRvuPerDay

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

  // Fine-tune: the studies currently in the mix, and search matches to add.
  const includedList = useMemo(
    () => studyTypes
      .filter(s => included.has(s.key))
      .sort((a, b) => (quantities[b.key] || 0) - (quantities[a.key] || 0) || b.count - a.count),
    [studyTypes, included, quantities]
  )
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return studyTypes
      .filter(s => !included.has(s.key) && `${s.modality} ${s.bodyPart}`.toLowerCase().includes(q))
      .slice(0, 8)
  }, [search, studyTypes, included])

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
  // an example mix. The choice is remembered for next visit.
  const applyRotation = (presetId: string) => {
    const preset = ROTATIONS.find(r => r.id === presetId)
    if (!preset) return
    const matched = studyTypes.filter(preset.match)
    if (!matched.length) {
      toast.error(`No ${preset.label} studies in your data yet`)
      return
    }
    localStorage.setItem(ROTATION_KEY, presetId)
    setEmphasis(new Set())
    setIncluded(new Set(matched.map(m => m.key)))
    setActivePreset(presetId)
  }

  // Keep the active rotation's example mix in sync with the target + emphasis.
  useEffect(() => {
    if (!activePreset) return
    const preset = ROTATIONS.find(r => r.id === activePreset)
    if (!preset) return
    const matched = studyTypes.filter(preset.match)
    const weightOf = (s: StudyType) =>
      s.count * (emphasis.has(s.modality) ? EMPHASIS_BOOST : 1) * (emphasis.has(s.bodyPart) ? EMPHASIS_BOOST : 1)
    setQuantities(computeMix(matched, goalRvuPerDay, weightOf))
  }, [activePreset, studyTypes, goalRvuPerDay, emphasis])

  // "Heavy on" options for the active rotation: the modalities and regions that
  // actually appear in it (so the choices are always in real rad terminology).
  const facets = useMemo(() => {
    const preset = activePreset ? ROTATIONS.find(r => r.id === activePreset) : null
    if (!preset) return { modalities: [] as string[], regions: [] as string[] }
    const matched = studyTypes.filter(preset.match)
    const modAgg = new Map<string, number>(), regAgg = new Map<string, number>()
    for (const s of matched) {
      modAgg.set(s.modality, (modAgg.get(s.modality) || 0) + s.count)
      regAgg.set(s.bodyPart, (regAgg.get(s.bodyPart) || 0) + s.count)
    }
    const byVol = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])
    return { modalities: byVol(modAgg), regions: byVol(regAgg).slice(0, 6) }
  }, [activePreset, studyTypes])

  const toggleEmphasis = (token: string) =>
    setEmphasis(prev => {
      const next = new Set(prev)
      next.has(token) ? next.delete(token) : next.add(token)
      return next
    })

  // On first load, land on the right rotation with zero clicks: prefer the one
  // the resident last picked, otherwise infer it from their most recent reads.
  useEffect(() => {
    if (didAutoSelect.current || !studyTypes.length) return
    didAutoSelect.current = true

    const saved = localStorage.getItem(ROTATION_KEY)
    const savedValid = !!saved && ROTATIONS.some(r => r.id === saved && studyTypes.some(r.match))
    let best: string | null = savedValid ? saved : null

    if (!best && records.length) {
      // Infer the current rotation from the last ~3 weeks of studies.
      const maxT = Math.max(...records.map(r => r.dictationDatetime.getTime()))
      const recent = records.filter(r => r.dictationDatetime.getTime() >= maxT - 21 * 24 * 3600 * 1000)
      const pool = recent.length ? recent : records
      let bestCount = 0
      for (const rot of ROTATIONS) {
        const c = pool.filter(r => rot.match({ modality: r.modality || 'Unknown', bodyPart: r.bodyPart || 'Unknown', avgRvu: 0, count: 0, key: '' })).length
        if (c > bestCount) { bestCount = c; best = rot.id }
      }
    }
    if (best) {
      setActivePreset(best)
      setIncluded(new Set(studyTypes.filter(ROTATIONS.find(r => r.id === best)!.match).map(m => m.key)))
    }
  }, [studyTypes, records])

  // Add a study type from search into the mix.
  const addStudy = (key: string) => {
    setActivePreset(null)
    setIncluded(prev => new Set(prev).add(key))
    setQuantities(prev => ({ ...prev, [key]: Math.max(1, prev[key] || 0) }))
    setSearch('')
  }

  // Distribute the target across the SELECTED study types, weighted by how often
  // the resident actually reads each — a realistic mix for this rotation.
  const autoFill = () => {
    const set = studyTypes.filter(s => included.has(s.key))
    const pool = set.length ? set : studyTypes
    if (!pool.length) return
    setActivePreset(null)
    setIncluded(new Set(pool.map(g => g.key)))
    setQuantities({ ...quantities, ...computeMix(pool, target) })
  }

  const clear = () => {
    setActivePreset(null)
    setEmphasis(new Set())
    setQuantities({})
    setIncluded(new Set())
    localStorage.removeItem(ROTATION_KEY)
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

              {/* Heavy on — emphasize a modality and/or region within the rotation */}
              {activePreset && (facets.modalities.length > 1 || facets.regions.length > 1) && (
                <div className="flex flex-wrap items-center gap-1.5 mb-4 -mt-1">
                  <span className="text-[11px] mr-1" style={{ color: 'var(--text-muted)' }}>Heavy on:</span>
                  {facets.modalities.length > 1 && facets.modalities.map(m => {
                    const on = emphasis.has(m)
                    return (
                      <button
                        key={`m-${m}`}
                        onClick={() => toggleEmphasis(m)}
                        className="px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors"
                        style={{
                          backgroundColor: on ? 'var(--accent-primary)' : 'transparent',
                          color: on ? 'white' : 'var(--text-secondary)',
                          border: on ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        }}
                      >
                        {m}
                      </button>
                    )
                  })}
                  {facets.modalities.length > 1 && facets.regions.length > 1 && (
                    <span className="w-px h-4 mx-0.5" style={{ backgroundColor: 'var(--border-color)' }} />
                  )}
                  {facets.regions.length > 1 && facets.regions.map(r => {
                    const on = emphasis.has(r)
                    return (
                      <button
                        key={`r-${r}`}
                        onClick={() => toggleEmphasis(r)}
                        className="px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors"
                        style={{
                          backgroundColor: on ? 'var(--accent-primary)' : 'transparent',
                          color: on ? 'white' : 'var(--text-secondary)',
                          border: on ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        }}
                      >
                        {r}
                      </button>
                    )
                  })}
                  {emphasis.size > 0 && (
                    <button onClick={() => setEmphasis(new Set())} className="text-[11px] px-1.5 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>balanced</button>
                  )}
                </div>
              )}

              {/* Hero: the answer, front and center */}
              <div className="rounded-2xl border border-slate-800 p-5" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="flex items-baseline justify-between gap-3 mb-4">
                  <h2 className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    A <span className="font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>{headingLabel}</span> day ≈
                  </h2>
                  <div className="text-right whitespace-nowrap">
                    <span className="text-xl font-bold" style={{ color: met ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{sum.toFixed(1)}</span>
                    <span className="text-slate-500 text-sm"> / {target.toFixed(1)} RVU</span>
                    {met && <CheckCircle2 className="inline w-4 h-4 ml-1 mb-0.5 text-emerald-400" />}
                    {mix.length > 0 && (
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{totalCases} studies/day</div>
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
                  {/* Search to add a study type */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Add a study type — e.g. “MRI knee”, “US abdomen”…"
                      className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    />
                    {searchResults.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg overflow-hidden shadow-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                        {searchResults.map(s => (
                          <button
                            key={s.key}
                            onClick={() => addStudy(s.key)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5"
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                            <span className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
                              <span style={{ color: 'var(--accent-primary)' }}>{s.modality}</span> · {s.bodyPart}
                            </span>
                            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{s.avgRvu.toFixed(2)} RVU</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* In your mix — only the selected studies, editable */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      In your mix ({includedCount})
                    </span>
                    <button
                      onClick={autoFill}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-white transition-colors"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                      title="Recalculate the counts to hit your target"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> Auto-fill
                    </button>
                  </div>

                  {includedList.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">
                      Pick a rotation, or search above to add study types.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {includedList.map(s => {
                        const q = quantities[s.key] || 0
                        return (
                          <div
                            key={s.key}
                            className="flex items-center gap-3 px-3 py-2 rounded-xl border"
                            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                <span style={{ color: 'var(--accent-primary)' }}>{s.modality}</span>
                                <span className="text-slate-500"> · </span>
                                {s.bodyPart}
                              </div>
                              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{s.avgRvu.toFixed(2)} RVU avg</div>
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
                              <button
                                onClick={() => toggleInclude(s.key)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10 ml-1"
                                style={{ color: 'var(--text-muted)' }}
                                title="Remove from your mix"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

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
