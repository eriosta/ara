import { useState, useMemo } from 'react'
import { useDataStore } from '@/stores/dataStore'
import { ChevronRight, ChevronDown, ArrowLeft, Table2, Filter, X } from 'lucide-react'
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
  studies: StudyRecord[]
}

interface ExpandedState {
  [key: string]: boolean
}

export default function MatrixPage() {
  const { records, filteredRecords } = useDataStore()
  const [expandedRows, setExpandedRows] = useState<ExpandedState>({})
  const [expandedCells, setExpandedCells] = useState<ExpandedState>({})
  const [selectedModality, setSelectedModality] = useState<string | null>(null)
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null)

  // Use filtered records if available, otherwise use all records
  const activeRecords = filteredRecords.length > 0 ? filteredRecords : records

  // Build the matrix data
  const { matrix, modalities, bodyParts, modalityTotals, bodyPartTotals, grandTotal } = useMemo(() => {
    const matrix: Record<string, Record<string, MatrixCell>> = {}
    const modalitySet = new Set<string>()
    const bodyPartSet = new Set<string>()
    const modalityTotals: Record<string, MatrixCell> = {}
    const bodyPartTotals: Record<string, MatrixCell> = {}
    let grandTotal: MatrixCell = { count: 0, totalRvu: 0, studies: [] }

    activeRecords.forEach(record => {
      const modality = record.modality || 'Unknown'
      const bodyPart = record.bodyPart || 'Unknown'

      modalitySet.add(modality)
      bodyPartSet.add(bodyPart)

      // Initialize if needed
      if (!matrix[modality]) matrix[modality] = {}
      if (!matrix[modality][bodyPart]) {
        matrix[modality][bodyPart] = { count: 0, totalRvu: 0, studies: [] }
      }
      if (!modalityTotals[modality]) {
        modalityTotals[modality] = { count: 0, totalRvu: 0, studies: [] }
      }
      if (!bodyPartTotals[bodyPart]) {
        bodyPartTotals[bodyPart] = { count: 0, totalRvu: 0, studies: [] }
      }

      // Add to cell
      matrix[modality][bodyPart].count++
      matrix[modality][bodyPart].totalRvu += record.wrvuEstimate
      matrix[modality][bodyPart].studies.push(record)

      // Add to row total
      modalityTotals[modality].count++
      modalityTotals[modality].totalRvu += record.wrvuEstimate
      modalityTotals[modality].studies.push(record)

      // Add to column total
      bodyPartTotals[bodyPart].count++
      bodyPartTotals[bodyPart].totalRvu += record.wrvuEstimate
      bodyPartTotals[bodyPart].studies.push(record)

      // Add to grand total
      grandTotal.count++
      grandTotal.totalRvu += record.wrvuEstimate
      grandTotal.studies.push(record)
    })

    const modalities = Array.from(modalitySet).sort()
    const bodyParts = Array.from(bodyPartSet).sort()

    return { matrix, modalities, bodyParts, modalityTotals, bodyPartTotals, grandTotal }
  }, [activeRecords])

  // Filter data based on selections
  const filteredModalities = selectedModality ? [selectedModality] : modalities
  const filteredBodyParts = selectedBodyPart ? [selectedBodyPart] : bodyParts

  const toggleRow = (modality: string) => {
    setExpandedRows(prev => ({ ...prev, [modality]: !prev[modality] }))
  }

  const toggleCell = (key: string) => {
    setExpandedCells(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const clearFilters = () => {
    setSelectedModality(null)
    setSelectedBodyPart(null)
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
            <Table2 className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h2 className="text-xl font-semibold text-white mb-2">No Data Available</h2>
            <p className="text-slate-400">Upload some data to see the study breakdown.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 lg:p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link 
              to="/dashboard" 
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <div>
              <h1 className="text-2xl font-display font-bold text-white flex items-center gap-3">
                <Table2 className="w-6 h-6 text-emerald-400" />
                Study Breakdown
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {grandTotal.count.toLocaleString()} studies • {grandTotal.totalRvu.toFixed(1)} total RVUs
              </p>
            </div>
          </div>

          {/* Filter indicators */}
          {(selectedModality || selectedBodyPart) && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              {selectedModality && (
                <span className="px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                  {selectedModality}
                  <button onClick={() => setSelectedModality(null)} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedBodyPart && (
                <span className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400 flex items-center gap-1">
                  {selectedBodyPart}
                  <button onClick={() => setSelectedBodyPart(null)} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button 
                onClick={clearFilters}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Matrix Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="sticky left-0 z-10 bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-slate-300 min-w-[180px]">
                    Modality
                  </th>
                  {filteredBodyParts.map(bodyPart => (
                    <th 
                      key={bodyPart} 
                      className="px-3 py-3 text-center text-sm font-semibold text-slate-300 min-w-[100px] cursor-pointer hover:bg-slate-800/50 transition-colors"
                      onClick={() => setSelectedBodyPart(selectedBodyPart === bodyPart ? null : bodyPart)}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="truncate max-w-[100px]" title={bodyPart}>{bodyPart}</span>
                        <span className="text-xs text-slate-500 font-normal">
                          {bodyPartTotals[bodyPart]?.count || 0}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-sm font-semibold text-emerald-400 bg-slate-800/30 min-w-[100px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredModalities.map((modality, idx) => {
                  const isExpanded = expandedRows[modality]
                  const rowTotal = modalityTotals[modality]

                  return (
                    <>
                      {/* Main row */}
                      <tr 
                        key={modality}
                        className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${
                          idx % 2 === 0 ? 'bg-slate-900/30' : ''
                        }`}
                      >
                        <td className="sticky left-0 z-10 bg-inherit px-4 py-3">
                          <button
                            onClick={() => toggleRow(modality)}
                            className="flex items-center gap-2 text-left w-full group"
                          >
                            <span className="text-slate-400 group-hover:text-emerald-400 transition-colors">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </span>
                            <span 
                              className="font-medium text-white cursor-pointer hover:text-emerald-400"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedModality(selectedModality === modality ? null : modality)
                              }}
                            >
                              {modality}
                            </span>
                          </button>
                        </td>
                        {filteredBodyParts.map(bodyPart => {
                          const cell = matrix[modality]?.[bodyPart]
                          const cellKey = `${modality}-${bodyPart}`

                          return (
                            <td key={bodyPart} className="px-3 py-3 text-center">
                              {cell && cell.count > 0 ? (
                                <button
                                  onClick={() => toggleCell(cellKey)}
                                  className="inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-slate-700/50 transition-colors group"
                                >
                                  <span className="text-white font-medium group-hover:text-emerald-400">
                                    {cell.count}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {cell.totalRvu.toFixed(1)}
                                  </span>
                                </button>
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-center bg-slate-800/20">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-emerald-400 font-semibold">{rowTotal?.count || 0}</span>
                            <span className="text-xs text-slate-500">{rowTotal?.totalRvu.toFixed(1) || '0.0'}</span>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded row - show individual studies */}
                      {isExpanded && (
                        <tr className="bg-slate-950">
                          <td colSpan={filteredBodyParts.length + 2} className="p-0">
                            <div className="px-6 py-4 border-l-2 border-emerald-500/30 ml-4">
                              <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
                                Studies for {modality} ({rowTotal?.count} total)
                              </div>
                              <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-2">
                                {rowTotal?.studies
                                  .sort((a, b) => b.dictationDatetime.getTime() - a.dictationDatetime.getTime())
                                  .slice(0, 100)
                                  .map((study, i) => (
                                    <div 
                                      key={i}
                                      className="flex items-center justify-between gap-4 px-3 py-2 rounded-lg bg-slate-800/50 text-sm"
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-slate-500 text-xs whitespace-nowrap">
                                          {format(study.dictationDatetime, 'MMM d, yyyy h:mm a')}
                                        </span>
                                        <span className="text-white truncate" title={study.examDescription}>
                                          {study.examDescription}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3 flex-shrink-0">
                                        <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
                                          {study.bodyPart}
                                        </span>
                                        <span className="text-emerald-400 font-medium">
                                          {study.wrvuEstimate.toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                {(rowTotal?.count || 0) > 100 && (
                                  <div className="text-center text-slate-500 text-sm py-2">
                                    Showing first 100 of {rowTotal?.count} studies
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Expanded cell details */}
                      {filteredBodyParts.map(bodyPart => {
                        const cellKey = `${modality}-${bodyPart}`
                        const cell = matrix[modality]?.[bodyPart]
                        if (!expandedCells[cellKey] || !cell) return null

                        return (
                          <tr key={`${cellKey}-expanded`} className="bg-slate-950">
                            <td colSpan={filteredBodyParts.length + 2} className="p-0">
                              <div className="px-6 py-4 border-l-2 border-blue-500/30 ml-4">
                                <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
                                  {modality} • {bodyPart} ({cell.count} studies, {cell.totalRvu.toFixed(1)} RVUs)
                                </div>
                                <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2">
                                  {cell.studies
                                    .sort((a, b) => b.dictationDatetime.getTime() - a.dictationDatetime.getTime())
                                    .map((study, i) => (
                                      <div 
                                        key={i}
                                        className="flex items-center justify-between gap-4 px-3 py-2 rounded-lg bg-slate-800/50 text-sm"
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <span className="text-slate-500 text-xs whitespace-nowrap">
                                            {format(study.dictationDatetime, 'MMM d, yyyy h:mm a')}
                                          </span>
                                          <span className="text-white truncate" title={study.examDescription}>
                                            {study.examDescription}
                                          </span>
                                        </div>
                                        <span className="text-emerald-400 font-medium flex-shrink-0">
                                          {study.wrvuEstimate.toFixed(2)} RVU
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </>
                  )
                })}

                {/* Totals row */}
                <tr className="bg-slate-800/50 border-t-2 border-slate-700">
                  <td className="sticky left-0 z-10 bg-slate-800/50 px-4 py-3 font-semibold text-emerald-400">
                    Total
                  </td>
                  {filteredBodyParts.map(bodyPart => {
                    const colTotal = bodyPartTotals[bodyPart]
                    return (
                      <td key={bodyPart} className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-emerald-400 font-semibold">{colTotal?.count || 0}</span>
                          <span className="text-xs text-slate-500">{colTotal?.totalRvu.toFixed(1) || '0.0'}</span>
                        </div>
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center bg-emerald-500/10">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-emerald-400 font-bold text-lg">{grandTotal.count}</span>
                      <span className="text-xs text-emerald-400/70">{grandTotal.totalRvu.toFixed(1)} RVUs</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-3 h-3" />
            <span>Click row chevron to expand all studies for that modality</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-slate-700/50 flex items-center justify-center text-white text-xs">5</span>
            <span>Click any cell to see individual studies</span>
          </div>
        </div>
      </div>
    </div>
  )
}

