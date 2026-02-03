import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import Sidebar from '@/components/Sidebar'
import ProductTour, { BREAKDOWN_STEPS } from '@/components/ProductTour'
import { ChevronRight, ChevronDown, Search, X, Filter, AlertTriangle, Menu, User, HelpCircle, LogOut } from 'lucide-react'
import { format } from 'date-fns'

const BREAKDOWN_TOUR_KEY = 'myrvu-breakdown-tour-completed'

interface StudyRecord {
  id?: string
  dictationDatetime: Date
  examDescription: string
  wrvuEstimate: number
  modality: string
  bodyPart: string
  examType: string
}

interface BodyPartData {
  count: number
  totalRvu: number
  studies: StudyRecord[]
}

interface ModalityData {
  count: number
  totalRvu: number
  byBodyPart: Record<string, BodyPartData>
  studies: StudyRecord[]
}

export default function BreakdownPage() {
  const { user, profile, signOut } = useAuthStore()
  const { records, filteredRecords, fetchRecords, loading } = useDataStore()
  const [initialFetchDone, setInitialFetchDone] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(224)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Filter states
  const [selectedModalities, setSelectedModalities] = useState<Set<string>>(new Set())
  const [selectedBodyParts, setSelectedBodyParts] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')

  // Expansion states
  const [expandedModalities, setExpandedModalities] = useState<Set<string>>(new Set())
  const [expandedBodyParts, setExpandedBodyParts] = useState<Set<string>>(new Set())

  // Data quality view
  const [showDataQuality, setShowDataQuality] = useState(false)

  // Tour
  const [tourRunning, setTourRunning] = useState(false)

  // Fetch records when component mounts
  useEffect(() => {
    if (user && !initialFetchDone) {
      setInitialFetchDone(true)
      fetchRecords(user.id)
    }
  }, [user, initialFetchDone, fetchRecords])

  // Use filtered records if available, otherwise all records
  const activeRecords = filteredRecords.length > 0 ? filteredRecords : records

  // Build hierarchical data structure
  const {
    byModality,
    allModalities,
    allBodyParts,
    dataQualityIssues
  } = useMemo(() => {
    const byModality: Record<string, ModalityData> = {}
    const allModalities = new Set<string>()
    const allBodyParts = new Set<string>()
    let grandTotal = { count: 0, totalRvu: 0 }

    // Track data quality issues
    const unknownModality: StudyRecord[] = []
    const unknownBodyPart: StudyRecord[] = []
    const otherModality: StudyRecord[] = []
    const lowRvu: StudyRecord[] = []
    const highRvu: StudyRecord[] = []

    activeRecords.forEach(record => {
      const modality = record.modality || 'Unknown'
      const bodyPart = record.bodyPart || 'Unknown'

      // Track quality issues
      if (modality === 'Unknown' || !record.modality) unknownModality.push(record)
      else if (modality === 'Other') otherModality.push(record)
      if (bodyPart === 'Unknown' || !record.bodyPart) unknownBodyPart.push(record)
      if (record.wrvuEstimate === 0) lowRvu.push(record)
      if (record.wrvuEstimate > 10) highRvu.push(record)

      allModalities.add(modality)
      allBodyParts.add(bodyPart)

      // Initialize modality if needed
      if (!byModality[modality]) {
        byModality[modality] = { count: 0, totalRvu: 0, byBodyPart: {}, studies: [] }
      }

      // Initialize body part within modality if needed
      if (!byModality[modality].byBodyPart[bodyPart]) {
        byModality[modality].byBodyPart[bodyPart] = { count: 0, totalRvu: 0, studies: [] }
      }

      // Add to modality totals
      byModality[modality].count++
      byModality[modality].totalRvu += record.wrvuEstimate
      byModality[modality].studies.push(record)

      // Add to body part within modality
      byModality[modality].byBodyPart[bodyPart].count++
      byModality[modality].byBodyPart[bodyPart].totalRvu += record.wrvuEstimate
      byModality[modality].byBodyPart[bodyPart].studies.push(record)

      grandTotal.count++
      grandTotal.totalRvu += record.wrvuEstimate
    })

    const dataQualityIssues = {
      unknownModality,
      unknownBodyPart,
      otherModality,
      lowRvu,
      highRvu,
      totalIssues: new Set([...unknownModality, ...otherModality, ...unknownBodyPart]).size
    }

    return {
      byModality,
      allModalities: Array.from(allModalities).sort(),
      allBodyParts: Array.from(allBodyParts).sort(),
      grandTotal,
      dataQualityIssues
    }
  }, [activeRecords])

  // Apply filters to get displayed data
  const filteredData = useMemo(() => {
    let result = { ...byModality }

    // Filter by selected modalities
    if (selectedModalities.size > 0) {
      result = Object.fromEntries(
        Object.entries(result).filter(([mod]) => selectedModalities.has(mod))
      )
    }

    // Filter by selected body parts (within modalities)
    if (selectedBodyParts.size > 0) {
      const filtered: Record<string, ModalityData> = {}
      for (const [mod, data] of Object.entries(result)) {
        const filteredBodyParts = Object.fromEntries(
          Object.entries(data.byBodyPart).filter(([bp]) => selectedBodyParts.has(bp))
        )
        if (Object.keys(filteredBodyParts).length > 0) {
          const filteredStudies = data.studies.filter(s => selectedBodyParts.has(s.bodyPart))
          filtered[mod] = {
            ...data,
            byBodyPart: filteredBodyParts,
            count: filteredStudies.length,
            totalRvu: filteredStudies.reduce((sum, s) => sum + s.wrvuEstimate, 0),
            studies: filteredStudies
          }
        }
      }
      result = filtered
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const filtered: Record<string, ModalityData> = {}
      for (const [mod, data] of Object.entries(result)) {
        const matchingStudies = data.studies.filter(s =>
          s.examDescription.toLowerCase().includes(term) ||
          s.modality.toLowerCase().includes(term) ||
          s.bodyPart.toLowerCase().includes(term)
        )
        if (matchingStudies.length > 0) {
          // Rebuild body part structure from matching studies
          const newByBodyPart: Record<string, BodyPartData> = {}
          matchingStudies.forEach(s => {
            if (!newByBodyPart[s.bodyPart]) {
              newByBodyPart[s.bodyPart] = { count: 0, totalRvu: 0, studies: [] }
            }
            newByBodyPart[s.bodyPart].count++
            newByBodyPart[s.bodyPart].totalRvu += s.wrvuEstimate
            newByBodyPart[s.bodyPart].studies.push(s)
          })
          filtered[mod] = {
            count: matchingStudies.length,
            totalRvu: matchingStudies.reduce((sum, s) => sum + s.wrvuEstimate, 0),
            byBodyPart: newByBodyPart,
            studies: matchingStudies
          }
        }
      }
      result = filtered
    }

    return result
  }, [byModality, selectedModalities, selectedBodyParts, searchTerm])

  // Calculate filtered totals
  const filteredTotals = useMemo(() => {
    let count = 0, totalRvu = 0
    Object.values(filteredData).forEach(mod => {
      count += mod.count
      totalRvu += mod.totalRvu
    })
    return { count, totalRvu }
  }, [filteredData])

  // Toggle functions
  const toggleModality = (mod: string) => {
    setExpandedModalities(prev => {
      const next = new Set(prev)
      if (next.has(mod)) next.delete(mod)
      else next.add(mod)
      return next
    })
  }

  const toggleBodyPart = (key: string) => {
    setExpandedBodyParts(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Filter toggle functions
  const toggleModalityFilter = (mod: string) => {
    setSelectedModalities(prev => {
      const next = new Set(prev)
      if (next.has(mod)) next.delete(mod)
      else next.add(mod)
      return next
    })
  }

  const toggleBodyPartFilter = (bp: string) => {
    setSelectedBodyParts(prev => {
      const next = new Set(prev)
      if (next.has(bp)) next.delete(bp)
      else next.add(bp)
      return next
    })
  }

  const clearFilters = () => {
    setSelectedModalities(new Set())
    setSelectedBodyParts(new Set())
    setSearchTerm('')
  }

  const hasActiveFilters = selectedModalities.size > 0 || selectedBodyParts.size > 0 || searchTerm

  // Auto-start breakdown tour on first visit
  const hasData = activeRecords.length > 0
  useEffect(() => {
    if (hasData && !localStorage.getItem(BREAKDOWN_TOUR_KEY)) {
      setTourRunning(true)
    }
  }, [hasData])

  const handleTourClose = useCallback(() => {
    setTourRunning(false)
    localStorage.setItem(BREAKDOWN_TOUR_KEY, 'true')
  }, [])

  const handleStartTour = useCallback(() => {
    setTourRunning(true)
  }, [])

  // Get color for modality
  const getModalityColor = (modality: string, selected: boolean = false) => {
    const colors: Record<string, { bg: string, text: string, border: string }> = {
      'CT': { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500' },
      'CTA': { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500' },
      'MRI': { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500' },
      'MRA': { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500' },
      'MRV': { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500' },
      'US': { bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500' },
      'Radiography': { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500' },
      'Fluoroscopy': { bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500' },
      'PET/CT': { bg: 'bg-pink-500', text: 'text-pink-400', border: 'border-pink-500' },
      'PET': { bg: 'bg-pink-500', text: 'text-pink-400', border: 'border-pink-500' },
      'Nuclear Medicine': { bg: 'bg-green-500', text: 'text-green-400', border: 'border-green-500' },
      'Mammography': { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500' },
      'Interventional': { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500' },
    }
    const c = colors[modality] || { bg: 'bg-slate-500', text: 'text-slate-400', border: 'border-slate-500' }

    if (selected) {
      return `${c.bg} text-white border-transparent`
    }
    return `bg-transparent ${c.text} ${c.border}`
  }

  // Show loading state
  if (loading && records.length === 0) {
    return (
      <div className="flex min-h-screen bg-slate-950">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
        />
        <div className="flex-1 bg-slate-950 max-lg:!ml-0" style={{ marginLeft: `${sidebarWidth}px` }}>
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-500">Loading your data...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show empty state only if not loading and no data
  if (activeRecords.length === 0 && !loading) {
    return (
      <div className="flex min-h-screen bg-slate-950">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
        />
        <div className="flex-1 bg-slate-950 max-lg:!ml-0" style={{ marginLeft: `${sidebarWidth}px` }}>
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <Filter className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <h2 className="text-xl font-semibold text-white mb-2">No Data Available</h2>
              <p className="text-slate-400">Upload some data to see the study breakdown.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Build filter chips for inline display
  const filterChips: { label: string; type: 'modality' | 'bodypart' | 'search'; value: string }[] = []
  Array.from(selectedModalities).forEach(mod => filterChips.push({ label: mod, type: 'modality', value: mod }))
  Array.from(selectedBodyParts).forEach(bp => filterChips.push({ label: bp, type: 'bodypart', value: bp }))
  if (searchTerm) filterChips.push({ label: `"${searchTerm}"`, type: 'search', value: searchTerm })

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Main Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
      />

      {/* Main Content Area */}
      <div className="flex-1 bg-slate-950 flex flex-col max-lg:!ml-0" style={{ marginLeft: `${sidebarWidth}px` }}>
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg transition-colors bg-slate-800 hover:bg-slate-700"
          >
            <Menu className="w-5 h-5 text-slate-400" />
          </button>
          <h1 className="text-lg font-display font-bold">
            <span className="text-white">Study</span>
            <span className="text-emerald-400"> Breakdown</span>
          </h1>
          <div className="w-10" />
        </header>

        {/* Toolbar */}
        <div
          className="sticky top-0 z-30 lg:top-0"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          {/* Top bar: always visible */}
          <div
            className="flex items-center gap-2 flex-wrap px-4 lg:px-6 py-2"
            style={{ borderBottom: '1px solid var(--border-color)' }}
          >
            {/* Search */}
            <div className="relative" data-tour="breakdown-search">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search studies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 pr-7 py-1.5 rounded-lg text-xs outline-none w-40 sm:w-48"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: searchTerm ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="w-px h-5" style={{ backgroundColor: 'var(--border-color)' }} />

            {/* Filter trigger */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
              style={{
                border: (filtersOpen || hasActiveFilters) ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
              }}
              data-tour="breakdown-filters"
            >
              <Filter className="w-3.5 h-3.5" style={{ color: hasActiveFilters ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
              Filters
              {hasActiveFilters && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}>
                  {filterChips.length}
                </span>
              )}
              <ChevronDown className={`w-3 h-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
            </button>

            {/* Data Quality trigger */}
            {dataQualityIssues.totalIssues > 0 && (
              <>
                <div className="w-px h-5" style={{ backgroundColor: 'var(--border-color)' }} />
                <button
                  onClick={() => setShowDataQuality(!showDataQuality)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
                  style={{
                    border: showDataQuality ? '1px solid rgb(245, 158, 11)' : '1px solid var(--border-color)',
                    color: showDataQuality ? 'rgb(251, 191, 36)' : 'var(--text-secondary)',
                  }}
                >
                  <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'rgb(251, 191, 36)' }} />
                  <span className="hidden sm:inline">Data Quality</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: 'rgb(251, 191, 36)' }}>
                    {dataQualityIssues.totalIssues}
                  </span>
                </button>
              </>
            )}

            {/* Filter chips (inline) */}
            {filterChips.length > 0 && (
              <>
                <div className="w-px h-5 hidden sm:block" style={{ backgroundColor: 'var(--border-color)' }} />
                {filterChips.map((chip, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                      chip.type === 'modality' ? getModalityColor(chip.value, true)
                      : chip.type === 'bodypart' ? 'bg-emerald-500 text-white'
                      : 'bg-slate-600 text-white'
                    }`}
                  >
                    {chip.label}
                    <button
                      onClick={() => {
                        if (chip.type === 'modality') toggleModalityFilter(chip.value)
                        else if (chip.type === 'bodypart') toggleBodyPartFilter(chip.value)
                        else setSearchTerm('')
                      }}
                      className="hover:opacity-70 transition-opacity"
                    >
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
              </>
            )}

            {/* Stats + User actions (right-aligned) */}
            <div className="flex items-center gap-3 ml-auto shrink-0">
              <div className="flex items-center gap-3" data-tour="breakdown-stats">
                <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{filteredTotals.count.toLocaleString()}</span> studies
                </span>
                <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--accent-primary)' }}>{filteredTotals.totalRvu.toFixed(1)}</span> RVUs
                </span>
              </div>
              <div className="w-px h-5 hidden sm:block" style={{ backgroundColor: 'var(--border-color)' }} />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleStartTour}
                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                  title="Start guided tour"
                >
                  <HelpCircle className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
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
                <button
                  onClick={() => signOut()}
                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            </div>
          </div>

          {/* Expandable filter panel */}
          {filtersOpen && (
            <div
              className="px-4 lg:px-6 py-4 animate-slide-down"
              style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
            >
              <div className="flex flex-wrap gap-x-6 gap-y-4">
                {/* Modality */}
                {allModalities.length > 0 && (
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      Modality
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {allModalities.map(mod => {
                        const isSelected = selectedModalities.has(mod)
                        const count = byModality[mod]?.count || 0
                        return (
                          <button
                            key={mod}
                            onClick={() => toggleModalityFilter(mod)}
                            className={`px-2 py-1 rounded-md text-xs font-medium border transition-all ${getModalityColor(mod, isSelected)}`}
                          >
                            {mod}
                            <span className="ml-1 opacity-70">{count}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Body Part */}
                {allBodyParts.length > 0 && (
                  <div className="w-full sm:w-auto">
                    <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      Body Part
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {allBodyParts.map(bp => {
                        const isSelected = selectedBodyParts.has(bp)
                        return (
                          <button
                            key={bp}
                            onClick={() => toggleBodyPartFilter(bp)}
                            className={`px-2 py-1 text-[10px] rounded-md transition-all ${
                              isSelected
                                ? 'bg-emerald-500/30 text-emerald-300'
                                : 'hover:bg-white/5'
                            }`}
                            style={{
                              border: isSelected ? '1px solid rgba(16,185,129,0.5)' : '1px solid var(--border-color)',
                              color: isSelected ? undefined : 'var(--text-muted)',
                            }}
                          >
                            {bp}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {/* Data Quality Panel */}
          {showDataQuality && (
            <div className="mb-6 rounded-xl bg-amber-500/10 border border-amber-500/30 overflow-hidden">
              <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-amber-400">Data Quality Issues</h3>
                </div>
                <button
                  onClick={() => setShowDataQuality(false)}
                  className="text-amber-400/70 hover:text-amber-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                {/* Unknown Modality */}
                {dataQualityIssues.unknownModality.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Unknown Modality ({dataQualityIssues.unknownModality.length})
                    </h4>
                    <div className="max-h-[150px] overflow-y-auto space-y-1">
                      {dataQualityIssues.unknownModality.slice(0, 20).map((s, i) => (
                        <div key={i} className="text-xs px-2 py-1.5 rounded bg-slate-800/50 flex justify-between items-center">
                          <span className="text-slate-300 truncate flex-1 mr-2">{s.examDescription}</span>
                          <span className="text-slate-500 whitespace-nowrap">{s.wrvuEstimate.toFixed(2)} RVU</span>
                        </div>
                      ))}
                      {dataQualityIssues.unknownModality.length > 20 && (
                        <div className="text-xs text-slate-500 text-center py-1">
                          +{dataQualityIssues.unknownModality.length - 20} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Other Modality */}
                {dataQualityIssues.otherModality.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      "Other" Modality - Needs Classification ({dataQualityIssues.otherModality.length})
                    </h4>
                    <div className="max-h-[150px] overflow-y-auto space-y-1">
                      {dataQualityIssues.otherModality.slice(0, 20).map((s, i) => (
                        <div key={i} className="text-xs px-2 py-1.5 rounded bg-slate-800/50 flex justify-between items-center">
                          <span className="text-slate-300 truncate flex-1 mr-2">{s.examDescription}</span>
                          <span className="text-slate-500 whitespace-nowrap">{s.wrvuEstimate.toFixed(2)} RVU</span>
                        </div>
                      ))}
                      {dataQualityIssues.otherModality.length > 20 && (
                        <div className="text-xs text-slate-500 text-center py-1">
                          +{dataQualityIssues.otherModality.length - 20} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Unknown Body Part */}
                {dataQualityIssues.unknownBodyPart.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      Unknown Body Part ({dataQualityIssues.unknownBodyPart.length})
                    </h4>
                    <div className="max-h-[150px] overflow-y-auto space-y-1">
                      {dataQualityIssues.unknownBodyPart.slice(0, 20).map((s, i) => (
                        <div key={i} className="text-xs px-2 py-1.5 rounded bg-slate-800/50 flex justify-between items-center">
                          <span className="text-slate-300 truncate flex-1 mr-2">{s.examDescription}</span>
                          <span className="text-emerald-400 whitespace-nowrap">{s.modality}</span>
                        </div>
                      ))}
                      {dataQualityIssues.unknownBodyPart.length > 20 && (
                        <div className="text-xs text-slate-500 text-center py-1">
                          +{dataQualityIssues.unknownBodyPart.length - 20} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Zero RVU */}
                {dataQualityIssues.lowRvu.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      Zero RVU Studies ({dataQualityIssues.lowRvu.length})
                    </h4>
                    <div className="max-h-[100px] overflow-y-auto space-y-1">
                      {dataQualityIssues.lowRvu.slice(0, 10).map((s, i) => (
                        <div key={i} className="text-xs px-2 py-1.5 rounded bg-slate-800/50 flex justify-between items-center">
                          <span className="text-slate-300 truncate flex-1 mr-2">{s.examDescription}</span>
                          <span className="text-slate-500">{s.modality}</span>
                        </div>
                      ))}
                      {dataQualityIssues.lowRvu.length > 10 && (
                        <div className="text-xs text-slate-500 text-center py-1">
                          +{dataQualityIssues.lowRvu.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hierarchical Tree View */}
          <div className="space-y-2" data-tour="breakdown-tree">
            {Object.entries(filteredData)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([modality, modalityData]) => {
                const isModExpanded = expandedModalities.has(modality)
                const bodyParts = Object.entries(modalityData.byBodyPart).sort((a, b) => b[1].count - a[1].count)

                return (
                  <div key={modality} className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden">
                    {/* Modality Row (Level 1) */}
                    <button
                      onClick={() => toggleModality(modality)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-slate-800/30 transition-colors"
                    >
                      <span className="text-slate-500">
                        {isModExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </span>

                      <span className={`px-2.5 py-1 rounded-md text-sm font-medium border ${getModalityColor(modality, true)}`}>
                        {modality}
                      </span>

                      <span className="text-slate-500 text-sm">
                        {bodyParts.length} body {bodyParts.length === 1 ? 'region' : 'regions'}
                      </span>

                      <div className="flex-1" />

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-white font-semibold">{modalityData.count}</div>
                          <div className="text-xs text-slate-500">studies</div>
                        </div>
                        <div className="text-right min-w-[70px]">
                          <div className="text-emerald-400 font-semibold">{modalityData.totalRvu.toFixed(1)}</div>
                          <div className="text-xs text-slate-500">RVUs</div>
                        </div>
                      </div>
                    </button>

                    {/* Body Parts (Level 2) */}
                    {isModExpanded && (
                      <div className="border-t border-slate-800 bg-slate-950/30">
                        {bodyParts.map(([bodyPart, bpData]) => {
                          const bpKey = `${modality}-${bodyPart}`
                          const isBpExpanded = expandedBodyParts.has(bpKey)

                          return (
                            <div key={bodyPart}>
                              {/* Body Part Row */}
                              <button
                                onClick={() => toggleBodyPart(bpKey)}
                                className="w-full flex items-center gap-3 px-4 py-3 pl-12 hover:bg-slate-800/20 transition-colors border-b border-slate-800/50"
                              >
                                <span className="text-slate-600">
                                  {isBpExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </span>

                                <span className="text-white font-medium">{bodyPart}</span>

                                <div className="flex-1" />

                                <div className="flex items-center gap-6">
                                  <div className="text-right">
                                    <span className="text-slate-300">{bpData.count}</span>
                                  </div>
                                  <div className="text-right min-w-[70px]">
                                    <span className="text-emerald-400">{bpData.totalRvu.toFixed(1)}</span>
                                  </div>
                                </div>
                              </button>

                              {/* Individual Studies (Level 3) */}
                              {isBpExpanded && (
                                <div className="bg-slate-950/50 px-4 py-3 pl-20">
                                  <div className="max-h-[300px] overflow-y-auto space-y-1">
                                    {bpData.studies
                                      .sort((a, b) => b.dictationDatetime.getTime() - a.dictationDatetime.getTime())
                                      .slice(0, 50)
                                      .map((study, i) => (
                                        <div
                                          key={i}
                                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors text-sm"
                                        >
                                          <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <span className="text-slate-500 text-xs font-mono whitespace-nowrap">
                                              {format(study.dictationDatetime, 'MM/dd/yy')}
                                            </span>
                                            <span className="text-white truncate">
                                              {study.examDescription}
                                            </span>
                                          </div>
                                          <span className="text-emerald-400 font-mono font-medium flex-shrink-0">
                                            {study.wrvuEstimate.toFixed(2)}
                                          </span>
                                        </div>
                                      ))}
                                    {bpData.count > 50 && (
                                      <div className="text-center text-slate-500 text-xs py-2">
                                        Showing 50 of {bpData.count} studies
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>

          {Object.keys(filteredData).length === 0 && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-400">No results match your filters</p>
              <button
                onClick={clearFilters}
                className="mt-3 text-emerald-400 hover:text-emerald-300 text-sm"
              >
                Clear all filters
              </button>
            </div>
          )}
        </main>
      </div>

      {hasData && <ProductTour steps={BREAKDOWN_STEPS} run={tourRunning} onClose={handleTourClose} />}
    </div>
  )
}
