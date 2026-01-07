import { useState, useMemo, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { ChevronRight, ChevronDown, ArrowLeft, Search, X, Filter, RotateCcw, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'

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
  const { user } = useAuthStore()
  const { records, filteredRecords, fetchRecords } = useDataStore()
  const [initialFetchDone, setInitialFetchDone] = useState(false)
  
  // Filter states
  const [selectedModalities, setSelectedModalities] = useState<Set<string>>(new Set())
  const [selectedBodyParts, setSelectedBodyParts] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  
  // Expansion states
  const [expandedModalities, setExpandedModalities] = useState<Set<string>>(new Set())
  const [expandedBodyParts, setExpandedBodyParts] = useState<Set<string>>(new Set())
  
  // Data quality view
  const [showDataQuality, setShowDataQuality] = useState(false)

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
    grandTotal,
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

  if (activeRecords.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <Link 
            to="/dashboard" 
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="text-center py-20">
            <Filter className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h2 className="text-xl font-semibold text-white mb-2">No Data Available</h2>
            <p className="text-slate-400">Upload some data to see the study breakdown.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left Sidebar - Filters */}
      <div className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900/50 p-4 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </h2>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-slate-500 hover:text-white flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-8 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-emerald-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modality Filters */}
        <div className="mb-6">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Modality
          </h3>
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

        {/* Body Part Filters */}
        <div className="mb-6">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Body Part
          </h3>
          <div className="flex flex-wrap gap-1.5 max-h-[300px] overflow-y-auto">
            {allBodyParts.map(bp => {
              const isSelected = selectedBodyParts.has(bp)
              return (
                <button
                  key={bp}
                  onClick={() => toggleBodyPartFilter(bp)}
                  className={`px-2 py-1 rounded-md text-xs font-medium border transition-all ${
                    isSelected 
                      ? 'bg-emerald-500 text-white border-transparent' 
                      : 'bg-transparent text-slate-400 border-slate-600 hover:border-slate-500'
                  }`}
                >
                  {bp}
                </button>
              )
            })}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="pt-4 border-t border-slate-800">
          <div className="text-xs text-slate-500 mb-2">
            {hasActiveFilters ? 'Filtered' : 'Total'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-800/50 rounded-lg p-2">
              <div className="text-lg font-bold text-white">{filteredTotals.count.toLocaleString()}</div>
              <div className="text-xs text-slate-500">studies</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2">
              <div className="text-lg font-bold text-emerald-400">{filteredTotals.totalRvu.toFixed(1)}</div>
              <div className="text-xs text-slate-500">RVUs</div>
            </div>
          </div>
        </div>

        {/* Data Quality */}
        {dataQualityIssues.totalIssues > 0 && (
          <div className="pt-4 mt-4 border-t border-slate-800">
            <button
              onClick={() => setShowDataQuality(!showDataQuality)}
              className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                showDataQuality ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800/50 text-slate-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-medium">Data Quality</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs">{dataQualityIssues.totalIssues}</span>
                {showDataQuality ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </div>
            </button>
          </div>
        )}

      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
            <Link 
              to="/dashboard" 
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
            <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
            <h1 className="text-2xl font-display font-bold text-white">Study Breakdown</h1>
            <p className="text-sm text-slate-400">
              {hasActiveFilters 
                ? `Showing ${filteredTotals.count} of ${grandTotal.count} studies`
                : `${grandTotal.count} total studies`
              }
              </p>
            </div>
          </div>

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

        {/* Active filters display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg bg-slate-800/30 border border-slate-700">
            <span className="text-xs text-slate-500">Active filters:</span>
            {Array.from(selectedModalities).map(mod => (
              <span 
                key={mod}
                className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${getModalityColor(mod, true)}`}
              >
                {mod}
                <button onClick={() => toggleModalityFilter(mod)} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
                            </span>
            ))}
            {Array.from(selectedBodyParts).map(bp => (
                            <span 
                key={bp}
                className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500 text-white flex items-center gap-1"
              >
                {bp}
                <button onClick={() => toggleBodyPartFilter(bp)} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
                            </span>
            ))}
            {searchTerm && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-600 text-white flex items-center gap-1">
                "{searchTerm}"
                <button onClick={() => setSearchTerm('')} className="hover:text-white">
                  <X className="w-3 h-3" />
                          </button>
              </span>
            )}
          </div>
        )}

        {/* Hierarchical Tree View */}
        <div className="space-y-2">
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
      </div>
    </div>
  )
}
