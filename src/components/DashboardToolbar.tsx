import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { Target, Filter, Calendar, Clock, ChevronDown, X, User, HelpCircle, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

interface DashboardToolbarProps {
  onStartTour?: () => void
}

export default function DashboardToolbar({ onStartTour }: DashboardToolbarProps) {
  const { user, profile, updateProfile, signOut } = useAuthStore()
  const {
    goalRvuPerDay, setGoalRvuPerDay, suggestedGoals,
    filters, setFilters, clearFilters,
    availableModalities, availableBodyParts,
    filteredRecords, records,
  } = useDataStore()

  const [goalOpen, setGoalOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [localGoal, setLocalGoal] = useState(goalRvuPerDay)
  const [savingGoal, setSavingGoal] = useState(false)

  useEffect(() => { setLocalGoal(goalRvuPerDay) }, [goalRvuPerDay])

  const hasActiveFilters =
    filters.startDate || filters.endDate ||
    filters.startHour !== null || filters.endHour !== null ||
    filters.modalities.length > 0 || filters.bodyParts.length > 0

  const toggleModality = (m: string) => {
    const cur = filters.modalities
    setFilters({ modalities: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m] })
  }

  const toggleBodyPart = (bp: string) => {
    const cur = filters.bodyParts
    setFilters({ bodyParts: cur.includes(bp) ? cur.filter(x => x !== bp) : [...cur, bp] })
  }

  const handleGoalUpdate = async () => {
    if (!user) return
    setSavingGoal(true)
    try {
      setGoalRvuPerDay(localGoal)
      const { error } = await updateProfile({ goal_rvu_per_day: localGoal })
      if (error) toast.error('Failed to save goal')
      else toast.success('Daily goal saved!')
    } finally {
      setSavingGoal(false)
    }
  }

  const formatHour = (h: number) =>
    h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`

  // Build filter chips
  const chips: { label: string; onRemove: () => void }[] = []
  if (filters.startDate && filters.endDate) {
    chips.push({ label: `${filters.startDate} – ${filters.endDate}`, onRemove: () => setFilters({ startDate: null, endDate: null }) })
  } else if (filters.startDate) {
    chips.push({ label: `From ${filters.startDate}`, onRemove: () => setFilters({ startDate: null }) })
  } else if (filters.endDate) {
    chips.push({ label: `Until ${filters.endDate}`, onRemove: () => setFilters({ endDate: null }) })
  }
  if (filters.startHour !== null || filters.endHour !== null) {
    chips.push({
      label: `${filters.startHour !== null ? formatHour(filters.startHour) : 'Any'} – ${filters.endHour !== null ? formatHour(filters.endHour) : 'Any'}`,
      onRemove: () => setFilters({ startHour: null, endHour: null }),
    })
  }
  filters.modalities.forEach(m => chips.push({ label: m, onRemove: () => setFilters({ modalities: filters.modalities.filter(x => x !== m) }) }))
  filters.bodyParts.forEach(bp => chips.push({ label: bp, onRemove: () => setFilters({ bodyParts: filters.bodyParts.filter(x => x !== bp) }) }))

  return (
    <div
      className="sticky top-0 z-30 lg:top-0"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Top bar: always visible */}
      <div
        className="flex items-center gap-2 flex-wrap px-4 lg:px-6 py-2"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        {/* Goal trigger */}
        <button
          onClick={() => { setGoalOpen(!goalOpen); if (!goalOpen) setFiltersOpen(false) }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
          style={{
            border: goalOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
          }}
          data-tour="toolbar-goal"
        >
          <Target className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
          <span className="font-mono" style={{ color: 'var(--accent-primary)' }}>{goalRvuPerDay}</span>
          <span className="hidden sm:inline">RVU/day</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${goalOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
        </button>

        <div className="w-px h-5" style={{ backgroundColor: 'var(--border-color)' }} />

        {/* Filter trigger */}
        <button
          onClick={() => { setFiltersOpen(!filtersOpen); if (!filtersOpen) setGoalOpen(false) }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
          style={{
            border: (filtersOpen || hasActiveFilters) ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
          }}
          data-tour="toolbar-filters"
        >
          <Filter className="w-3.5 h-3.5" style={{ color: hasActiveFilters ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
          Filters
          {hasActiveFilters && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}>
              {chips.length}
            </span>
          )}
          <ChevronDown className={`w-3 h-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* Filter chips (inline) */}
        {chips.length > 0 && (
          <>
            <div className="w-px h-5 hidden sm:block" style={{ backgroundColor: 'var(--border-color)' }} />
            {chips.map((chip, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px]"
                style={{
                  backgroundColor: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  color: 'var(--accent-primary)',
                }}
              >
                {chip.label}
                <button onClick={chip.onRemove} className="hover:opacity-70 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={clearFilters}
              className="text-[11px] px-2 py-0.5 rounded-md transition-colors hover:bg-white/5 shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              Clear all
            </button>
            <span className="text-[11px] shrink-0" style={{ color: 'var(--text-muted)' }}>
              {filteredRecords.length} of {records.length}
            </span>
          </>
        )}

        {/* User actions (right-aligned) */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {onStartTour && (
            <button
              onClick={onStartTour}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
              title="Start guided tour"
            >
              <HelpCircle className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
          <div className="w-px h-5 hidden sm:block" style={{ backgroundColor: 'var(--border-color)' }} />
          <div className="flex items-center gap-2 px-1.5">
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <User className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-xs font-medium hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
              {profile?.full_name || 'Resident'}
            </span>
          </div>
          <button
            onClick={() => signOut()}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      </div>

      {/* Goal panel */}
      {goalOpen && (
        <div
          className="px-4 lg:px-6 py-4 animate-slide-down"
          style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="shrink-0">
              <label className="text-xs block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                RVUs per Day Target
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={localGoal}
                  onChange={(e) => setLocalGoal(Number(e.target.value))}
                  className="w-20 px-2.5 py-1.5 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  min={0}
                  step={0.5}
                />
                <button
                  onClick={handleGoalUpdate}
                  disabled={savingGoal}
                  className="px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                >
                  {savingGoal ? '...' : 'Save'}
                </button>
              </div>
            </div>
            {suggestedGoals && (
              <div className="flex-1">
                <label className="text-xs block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Suggested (based on your data)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Conservative', value: suggestedGoals.conservative, pct: '50th' },
                    { label: 'Moderate', value: suggestedGoals.moderate, pct: '65th' },
                    { label: 'Aggressive', value: suggestedGoals.aggressive, pct: '80th' },
                    { label: 'Stretch', value: suggestedGoals.stretch, pct: '90th' },
                  ].map(g => (
                    <button
                      key={g.label}
                      onClick={() => setLocalGoal(g.value)}
                      className="p-2 rounded-lg text-left transition-all hover:scale-[1.02]"
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        border: localGoal === g.value ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      }}
                    >
                      <div className="text-[10px]" style={{ color: g.label === 'Moderate' ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                        {g.label}{g.label === 'Moderate' ? ' ✓' : ''}
                      </div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{g.value}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{g.pct} %ile</div>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  Your average: <span style={{ color: 'var(--accent-primary)' }}>{suggestedGoals.currentAverage}</span> RVUs/day
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter panel */}
      {filtersOpen && (
        <div
          className="px-4 lg:px-6 py-4 animate-slide-down"
          style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
        >
          <div className="flex flex-wrap gap-x-6 gap-y-4">
            {/* Date Range */}
            <div>
              <label className="text-xs flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-muted)' }}>
                <Calendar className="w-3 h-3" /> Date Range
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => setFilters({ startDate: e.target.value || null })}
                  className="px-2 py-1.5 rounded-lg text-xs outline-none"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters({ endDate: e.target.value || null })}
                  className="px-2 py-1.5 rounded-lg text-xs outline-none"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {/* Time Range */}
            <div>
              <label className="text-xs flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-muted)' }}>
                <Clock className="w-3 h-3" /> Time Range
              </label>
              <div className="flex gap-2">
                <select
                  value={filters.startHour ?? ''}
                  onChange={(e) => setFilters({ startHour: e.target.value ? parseInt(e.target.value) : null })}
                  className="px-2 py-1.5 rounded-lg text-xs outline-none"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">Any</option>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{formatHour(i)}</option>
                  ))}
                </select>
                <select
                  value={filters.endHour ?? ''}
                  onChange={(e) => setFilters({ endHour: e.target.value ? parseInt(e.target.value) : null })}
                  className="px-2 py-1.5 rounded-lg text-xs outline-none"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">Any</option>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{formatHour(i)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modality */}
            {availableModalities.length > 0 && (
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Modality
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableModalities.map(m => (
                    <button
                      key={m}
                      onClick={() => toggleModality(m)}
                      className={`px-2 py-1 text-[10px] rounded-md transition-all ${
                        filters.modalities.includes(m)
                          ? 'bg-blue-500/30 text-blue-300'
                          : 'hover:bg-white/5'
                      }`}
                      style={{
                        border: filters.modalities.includes(m) ? '1px solid rgba(59,130,246,0.5)' : '1px solid var(--border-color)',
                        color: filters.modalities.includes(m) ? undefined : 'var(--text-muted)',
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Body Part */}
            {availableBodyParts.length > 0 && (
              <div className="w-full sm:w-auto">
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Body Part
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {availableBodyParts.map(bp => (
                    <button
                      key={bp}
                      onClick={() => toggleBodyPart(bp)}
                      className={`px-2 py-1 text-[10px] rounded-md transition-all ${
                        filters.bodyParts.includes(bp)
                          ? 'bg-emerald-500/30 text-emerald-300'
                          : 'hover:bg-white/5'
                      }`}
                      style={{
                        border: filters.bodyParts.includes(bp) ? '1px solid rgba(16,185,129,0.5)' : '1px solid var(--border-color)',
                        color: filters.bodyParts.includes(bp) ? undefined : 'var(--text-muted)',
                      }}
                    >
                      {bp}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
