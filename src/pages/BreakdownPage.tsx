import { useState, useMemo } from 'react'
import { useDataStore } from '@/stores/dataStore'
import { ChevronRight, ChevronDown, ArrowLeft, Search, X, BarChart3, Activity, Zap, Calendar } from 'lucide-react'
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

interface MatrixCell {
  count: number
  totalRvu: number
  avgRvu: number
  studies: StudyRecord[]
}

interface ExpandedState {
  [key: string]: boolean
}

export default function BreakdownPage() {
  const { records, filteredRecords } = useDataStore()
  const [expandedModalities, setExpandedModalities] = useState<ExpandedState>({})
  const [expandedBodyParts, setExpandedBodyParts] = useState<ExpandedState>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'modality' | 'bodypart'>('modality')

  // Use filtered records if available, otherwise use all records
  const activeRecords = filteredRecords.length > 0 ? filteredRecords : records

  // Build breakdown data
  const { 
    byModality, 
    byBodyPart, 
    grandTotal,
    topModality,
    topBodyPart,
    avgRvuPerStudy
  } = useMemo(() => {
    const byModality: Record<string, MatrixCell> = {}
    const byBodyPart: Record<string, MatrixCell> = {}
    let grandTotal = { count: 0, totalRvu: 0 }

    activeRecords.forEach(record => {
      const modality = record.modality || 'Unknown'
      const bodyPart = record.bodyPart || 'Unknown'

      // By modality
      if (!byModality[modality]) {
        byModality[modality] = { count: 0, totalRvu: 0, avgRvu: 0, studies: [] }
      }
      byModality[modality].count++
      byModality[modality].totalRvu += record.wrvuEstimate
      byModality[modality].studies.push(record)

      // By body part
      if (!byBodyPart[bodyPart]) {
        byBodyPart[bodyPart] = { count: 0, totalRvu: 0, avgRvu: 0, studies: [] }
      }
      byBodyPart[bodyPart].count++
      byBodyPart[bodyPart].totalRvu += record.wrvuEstimate
      byBodyPart[bodyPart].studies.push(record)

      grandTotal.count++
      grandTotal.totalRvu += record.wrvuEstimate
    })

    // Calculate averages
    Object.values(byModality).forEach(m => m.avgRvu = m.totalRvu / m.count)
    Object.values(byBodyPart).forEach(b => b.avgRvu = b.totalRvu / b.count)

    // Find top performers
    const sortedModalities = Object.entries(byModality).sort((a, b) => b[1].count - a[1].count)
    const sortedBodyParts = Object.entries(byBodyPart).sort((a, b) => b[1].count - a[1].count)

    return {
      byModality,
      byBodyPart,
      grandTotal,
      topModality: sortedModalities[0],
      topBodyPart: sortedBodyParts[0],
      avgRvuPerStudy: grandTotal.count > 0 ? grandTotal.totalRvu / grandTotal.count : 0
    }
  }, [activeRecords])

  // Filter and sort data based on view mode and search
  const displayData = useMemo(() => {
    const data = viewMode === 'modality' ? byModality : byBodyPart
    let entries = Object.entries(data)

    // Filter by search
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      entries = entries.filter(([name, cell]) => 
        name.toLowerCase().includes(term) ||
        cell.studies.some(s => s.examDescription.toLowerCase().includes(term))
      )
    }

    // Sort by count (descending)
    return entries.sort((a, b) => b[1].count - a[1].count)
  }, [viewMode, byModality, byBodyPart, searchTerm])

  const toggleExpand = (key: string) => {
    if (viewMode === 'modality') {
      setExpandedModalities(prev => ({ ...prev, [key]: !prev[key] }))
    } else {
      setExpandedBodyParts(prev => ({ ...prev, [key]: !prev[key] }))
    }
  }

  const isExpanded = (key: string) => {
    return viewMode === 'modality' ? expandedModalities[key] : expandedBodyParts[key]
  }

  // Get color for modality
  const getModalityColor = (modality: string) => {
    const colors: Record<string, string> = {
      'CT': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'CTA': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'MRI': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'MRA': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'US': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'Radiography': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      'XR': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      'Fluoroscopy': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'PET/CT': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      'PET': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      'Nuclear Medicine': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Mammography': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    }
    return colors[modality] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
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
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h2 className="text-xl font-semibold text-white mb-2">No Data Available</h2>
            <p className="text-slate-400">Upload some data to see the study breakdown.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link 
            to="/dashboard" 
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">
              Study Breakdown
            </h1>
            <p className="text-sm text-slate-400">
              Drill down into your cases by category
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Activity className="w-3.5 h-3.5" />
              Total Studies
            </div>
            <div className="text-2xl font-bold text-white">{grandTotal.count.toLocaleString()}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Zap className="w-3.5 h-3.5" />
              Total RVUs
            </div>
            <div className="text-2xl font-bold text-emerald-400">{grandTotal.totalRvu.toFixed(1)}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <BarChart3 className="w-3.5 h-3.5" />
              Avg RVU/Study
            </div>
            <div className="text-2xl font-bold text-white">{avgRvuPerStudy.toFixed(2)}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Calendar className="w-3.5 h-3.5" />
              Top {viewMode === 'modality' ? 'Modality' : 'Body Part'}
            </div>
            <div className="text-lg font-bold text-white truncate">
              {viewMode === 'modality' ? topModality?.[0] : topBodyPart?.[0]}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* View Toggle */}
          <div className="flex rounded-lg bg-slate-800/50 p-1">
            <button
              onClick={() => setViewMode('modality')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'modality' 
                  ? 'bg-emerald-500 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              By Modality
            </button>
            <button
              onClick={() => setViewMode('bodypart')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'bodypart' 
                  ? 'bg-emerald-500 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              By Body Part
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search studies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-slate-500 mb-3">
          Showing {displayData.length} {viewMode === 'modality' ? 'modalities' : 'body parts'}
          {searchTerm && ` matching "${searchTerm}"`}
        </div>

        {/* Breakdown List */}
        <div className="space-y-2">
          {displayData.map(([name, data]) => {
            const expanded = isExpanded(name)
            const percentage = ((data.count / grandTotal.count) * 100).toFixed(1)
            
            return (
              <div key={name} className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden">
                {/* Header Row */}
                <button
                  onClick={() => toggleExpand(name)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-800/30 transition-colors"
                >
                  <span className="text-slate-500">
                    {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </span>
                  
                  {/* Name & Badge */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {viewMode === 'modality' && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getModalityColor(name)}`}>
                        {name}
                      </span>
                    )}
                    {viewMode === 'bodypart' && (
                      <span className="font-medium text-white">{name}</span>
                    )}
                    {viewMode === 'modality' && (
                      <span className="text-slate-400 text-sm hidden sm:block">
                        {data.studies.length > 0 && data.studies[0].examDescription.substring(0, 40)}...
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 sm:gap-6">
                    {/* Progress bar */}
                    <div className="hidden sm:block w-32">
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="text-right min-w-[60px]">
                      <div className="text-white font-semibold">{data.count}</div>
                      <div className="text-xs text-slate-500">studies</div>
                    </div>
                    
                    <div className="text-right min-w-[60px]">
                      <div className="text-emerald-400 font-semibold">{data.totalRvu.toFixed(1)}</div>
                      <div className="text-xs text-slate-500">RVUs</div>
                    </div>
                    
                    <div className="text-right min-w-[50px] hidden sm:block">
                      <div className="text-slate-300">{data.avgRvu.toFixed(2)}</div>
                      <div className="text-xs text-slate-500">avg</div>
                    </div>
                  </div>
                </button>

                {/* Expanded Studies List */}
                {expanded && (
                  <div className="border-t border-slate-800 bg-slate-950/50">
                    <div className="p-4 max-h-[400px] overflow-y-auto">
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                        Individual Studies ({data.count})
                      </div>
                      <div className="space-y-1">
                        {data.studies
                          .sort((a, b) => b.dictationDatetime.getTime() - a.dictationDatetime.getTime())
                          .slice(0, 100)
                          .map((study, i) => (
                            <div 
                              key={i}
                              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors group"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="text-slate-500 text-xs whitespace-nowrap font-mono">
                                  {format(study.dictationDatetime, 'MM/dd/yy')}
                                </span>
                                <span className="text-white text-sm truncate group-hover:text-emerald-400 transition-colors">
                                  {study.examDescription}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                {viewMode === 'modality' && (
                                  <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
                                    {study.bodyPart}
                                  </span>
                                )}
                                {viewMode === 'bodypart' && (
                                  <span className={`px-2 py-0.5 rounded text-xs border ${getModalityColor(study.modality)}`}>
                                    {study.modality}
                                  </span>
                                )}
                                <span className="text-emerald-400 font-mono text-sm font-medium min-w-[50px] text-right">
                                  {study.wrvuEstimate.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ))}
                        {data.count > 100 && (
                          <div className="text-center text-slate-500 text-sm py-3 border-t border-slate-800 mt-2">
                            Showing first 100 of {data.count} studies
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {displayData.length === 0 && searchTerm && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-400">No results found for "{searchTerm}"</p>
          </div>
        )}
      </div>
    </div>
  )
}
