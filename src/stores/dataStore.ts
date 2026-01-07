import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { processRawData, modalityFromDesc, examFromDesc, bodyPartsFromDesc, RVURecord, ProcessedMetrics, DailyData, HourlyData, CaseMixData } from '@/lib/dataProcessing'
import { DEV_MODE, generateMockRecords } from '@/lib/mockData'

export interface SuggestedGoals {
  conservative: number      // 50th percentile (median)
  moderate: number          // 65th percentile  
  aggressive: number        // 80th percentile
  stretch: number           // 90th percentile
  currentAverage: number    // Current average
  description: string       // Text description of recommendation
}

export interface DateTimeFilters {
  startDate: string | null   // ISO date string YYYY-MM-DD
  endDate: string | null     // ISO date string YYYY-MM-DD
  startHour: number | null   // 0-23
  endHour: number | null     // 0-23
  modalities: string[]       // Selected modalities (empty = all)
  bodyParts: string[]        // Selected body parts (empty = all)
}

interface DataState {
  records: RVURecord[]
  filteredRecords: RVURecord[]
  metrics: ProcessedMetrics | null
  dailyData: DailyData[]
  hourlyData: HourlyData[]
  caseMixData: CaseMixData[]
  modalityData: { name: string; value: number }[]
  heatmapData: { dow: string; hour: number; rvu: number }[]
  loading: boolean
  goalRvuPerDay: number
  suggestedGoals: SuggestedGoals | null
  filters: DateTimeFilters
  availableModalities: string[]
  availableBodyParts: string[]
  setGoalRvuPerDay: (goal: number) => void
  setFilters: (filters: Partial<DateTimeFilters>) => void
  clearFilters: () => void
  fetchRecords: (userId: string) => Promise<void>
  addRecords: (userId: string, rawData: { dictation_datetime: string; exam_description: string; wrvu_estimate: number }[]) => Promise<{ 
    error: Error | null
    insertedCount?: number
    processedCount?: number
    duplicatesSkipped?: number
    filteredOut?: number
    falseDuplicates?: Array<{
      timestamp: string
      existingExam: string
      newExam: string
      existingRvu: number
      newRvu: number
    }>
  }>
  clearRecords: (userId: string) => Promise<{ error: Error | null }>
  reprocessRecords: (userId: string) => Promise<{ error: Error | null; count: number }>
  exportCSVFromDB: (userId: string) => Promise<string | null>
  calculateSuggestedGoals: () => SuggestedGoals | null
  processData: () => void
}

// Helper function to calculate percentile
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

const defaultFilters: DateTimeFilters = {
  startDate: null,
  endDate: null,
  startHour: null,
  endHour: null,
  modalities: [],
  bodyParts: [],
}

export const useDataStore = create<DataState>((set, get) => ({
  records: [],
  filteredRecords: [],
  metrics: null,
  dailyData: [],
  hourlyData: [],
  caseMixData: [],
  modalityData: [],
  heatmapData: [],
  loading: false,
  goalRvuPerDay: 15,
  suggestedGoals: null,
  filters: defaultFilters,
  availableModalities: [],
  availableBodyParts: [],

  setGoalRvuPerDay: (goal: number) => {
    set({ goalRvuPerDay: goal })
    get().processData()
  },

  setFilters: (newFilters: Partial<DateTimeFilters>) => {
    const currentFilters = get().filters
    set({ filters: { ...currentFilters, ...newFilters } })
    get().processData()
  },

  clearFilters: () => {
    set({ filters: defaultFilters })
    get().processData()
  },

  calculateSuggestedGoals: () => {
    const { dailyData, metrics } = get()
    
    if (!dailyData || dailyData.length < 5 || !metrics) {
      return null
    }

    // Get daily RVU values
    const dailyRvus = dailyData.map(d => d.rvu)
    
    // Calculate percentiles
    const p50 = percentile(dailyRvus, 50)  // Median
    const p65 = percentile(dailyRvus, 65)  // Moderate stretch
    const p80 = percentile(dailyRvus, 80)  // Aggressive
    const p90 = percentile(dailyRvus, 90)  // Stretch goal
    
    // Determine recommendation based on current performance
    let description = ''
    const avg = metrics.avgRvuDay
    
    if (avg < p50) {
      description = `Your average (${avg.toFixed(1)}) is below your median day. The "Moderate" goal would help you reach more consistent performance.`
    } else if (avg < p65) {
      description = `You're performing well! The "Moderate" goal (${p65.toFixed(1)}) represents your better days and is achievable with focus.`
    } else if (avg < p80) {
      description = `Strong performance! Consider the "Aggressive" goal (${p80.toFixed(1)}) to push your top-end productivity.`
    } else {
      description = `Excellent! You're already performing at a high level. The "Stretch" goal (${p90.toFixed(1)}) would challenge your best days.`
    }

    const suggestedGoals: SuggestedGoals = {
      conservative: Math.round(p50 * 2) / 2,  // Round to nearest 0.5
      moderate: Math.round(p65 * 2) / 2,
      aggressive: Math.round(p80 * 2) / 2,
      stretch: Math.round(p90 * 2) / 2,
      currentAverage: Math.round(avg * 2) / 2,
      description,
    }

    set({ suggestedGoals })
    return suggestedGoals
  },

  fetchRecords: async (userId: string) => {
    set({ loading: true })
    try {
      // Dev mode: use generated mock data
      if (DEV_MODE) {
        const mockData = generateMockRecords()
        const records: RVURecord[] = mockData.map(r => ({
          id: r.id,
          dictationDatetime: new Date(r.dictation_datetime),
          examDescription: r.exam_description,
          wrvuEstimate: Number(r.wrvu_estimate),
          modality: r.modality || '',
          examType: r.exam_type || '',
          bodyPart: r.body_part || '',
        }))
        set({ records })
        get().processData()
        return
      }

      const { data, error } = await supabase
        .from('rvu_records')
        .select('*')
        .eq('user_id', userId)
        .order('dictation_datetime', { ascending: true })

      if (!error && data) {
        const records: RVURecord[] = data.map(r => ({
          id: r.id,
          dictationDatetime: new Date(r.dictation_datetime),
          examDescription: r.exam_description,
          wrvuEstimate: Number(r.wrvu_estimate),
          modality: r.modality || '',
          examType: r.exam_type || '',
          bodyPart: r.body_part || '',
        }))
        set({ records })
        get().processData()
      }
    } finally {
      set({ loading: false })
    }
  },

  addRecords: async (userId: string, rawData) => {
    set({ loading: true })
    try {
      console.log(`[addRecords] Processing ${rawData.length} raw records...`)
      
      const processedRecords = processRawData(rawData)
      const filteredOut = rawData.length - processedRecords.length
      console.log(`[addRecords] After processing: ${processedRecords.length} valid records (${filteredOut} filtered out due to invalid data)`)
      
      // Check if processing filtered out all records
      if (processedRecords.length === 0 && rawData.length > 0) {
        console.error('[addRecords] All records were filtered out during processing!')
        console.error('[addRecords] Sample raw record:', rawData[0])
        return { 
          error: new Error(`Data processing failed: 0 of ${rawData.length} records were valid. This may be a date format issue.`),
          insertedCount: 0,
          processedCount: 0,
          duplicatesSkipped: 0,
          falseDuplicates: []
        }
      }
      
      const recordsToInsert = processedRecords.map(r => ({
        user_id: userId,
        dictation_datetime: r.dictationDatetime.toISOString(),
        exam_description: r.examDescription,
        wrvu_estimate: r.wrvuEstimate,
        modality: r.modality,
        exam_type: r.examType,
        body_part: r.bodyPart,
      }))

      // Get timestamps we're trying to insert
      const timestamps = recordsToInsert.map(r => r.dictation_datetime)
      
      // Fetch existing records with matching timestamps to detect false duplicates
      const { data: existingRecords } = await supabase
        .from('rvu_records')
        .select('dictation_datetime, exam_description, wrvu_estimate')
        .eq('user_id', userId)
        .in('dictation_datetime', timestamps)

      // Find false duplicates: same timestamp but different exam description
      const falseDuplicates: Array<{
        timestamp: string
        existingExam: string
        newExam: string
        existingRvu: number
        newRvu: number
      }> = []
      
      if (existingRecords) {
        const existingMap = new Map(existingRecords.map(r => [r.dictation_datetime, r]))
        
        for (const newRecord of recordsToInsert) {
          const existing = existingMap.get(newRecord.dictation_datetime)
          if (existing && existing.exam_description !== newRecord.exam_description) {
            falseDuplicates.push({
              timestamp: newRecord.dictation_datetime,
              existingExam: existing.exam_description,
              newExam: newRecord.exam_description,
              existingRvu: existing.wrvu_estimate,
              newRvu: newRecord.wrvu_estimate
            })
          }
        }
      }

      if (falseDuplicates.length > 0) {
        console.warn(`[addRecords] Found ${falseDuplicates.length} FALSE DUPLICATES (same timestamp, different exam):`)
        falseDuplicates.slice(0, 5).forEach(fd => {
          console.warn(`  ${fd.timestamp}: "${fd.existingExam}" vs "${fd.newExam}"`)
        })
      }

      // Get count before insert to calculate duplicates
      const { count: beforeCount } = await supabase
        .from('rvu_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      // Use upsert to avoid duplicates - if same user+datetime exists, skip it
      const { error } = await supabase
        .from('rvu_records')
        .upsert(recordsToInsert, {
          onConflict: 'user_id,dictation_datetime',
          ignoreDuplicates: true
        })

      // Get count after insert
      const { count: afterCount } = await supabase
        .from('rvu_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      const actuallyInserted = (afterCount || 0) - (beforeCount || 0)
      const duplicatesSkipped = processedRecords.length - actuallyInserted

      console.log(`[addRecords] Upsert result: error=${error?.message || 'none'}, attempted=${recordsToInsert.length}, inserted=${actuallyInserted}, duplicates=${duplicatesSkipped}, falseDuplicates=${falseDuplicates.length}`)

      if (!error) {
        await get().fetchRecords(userId)
      }

      return { 
        error: error as Error | null, 
        insertedCount: actuallyInserted,
        processedCount: processedRecords.length,
        duplicatesSkipped,
        filteredOut,
        falseDuplicates
      }
    } finally {
      set({ loading: false })
    }
  },

  clearRecords: async (userId: string) => {
    set({ loading: true })
    try {
      // Clear local state immediately
      set({ 
        records: [], 
        metrics: null, 
        dailyData: [], 
        hourlyData: [], 
        caseMixData: [],
        modalityData: [],
        heatmapData: []
      })

      // Delete all RVU records
      const { error } = await supabase
        .from('rvu_records')
        .delete()
        .eq('user_id', userId)

      // Get all upload history to delete files from storage
      const { data: uploads } = await supabase
        .from('upload_history')
        .select('file_path')
        .eq('user_id', userId)

      // Delete files from storage
      if (uploads && uploads.length > 0) {
        const filePaths = uploads.map(u => u.file_path).filter(Boolean)
        if (filePaths.length > 0) {
          await supabase.storage.from('uploads').remove(filePaths)
        }
      }

      // Delete upload history records
      await supabase
        .from('upload_history')
        .delete()
        .eq('user_id', userId)

      return { error: error as Error | null }
    } finally {
      set({ loading: false })
    }
  },

  // Reprocess all records with updated dataProcessing logic (parallel batches)
  reprocessRecords: async (userId: string) => {
    set({ loading: true })
    try {
      // Fetch all records
      const { data, error: fetchError } = await supabase
        .from('rvu_records')
        .select('id, exam_description')
        .eq('user_id', userId)

      if (fetchError || !data) {
        return { error: fetchError as Error | null, count: 0 }
      }

      // Process in parallel batches of 50
      const batchSize = 50
      let updatedCount = 0

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize)
        
        // Run batch updates in parallel
        const results = await Promise.all(
          batch.map(record => {
            const newModality = modalityFromDesc(record.exam_description)
            const newExamType = examFromDesc(record.exam_description)
            const newBodyPart = bodyPartsFromDesc(record.exam_description)

            return supabase
              .from('rvu_records')
              .update({
                modality: newModality,
                exam_type: newExamType,
                body_part: newBodyPart,
              })
              .eq('id', record.id)
          })
        )

        updatedCount += results.filter(r => !r.error).length
      }

      // Refresh records
      await get().fetchRecords(userId)

      return { error: null, count: updatedCount }
    } finally {
      set({ loading: false })
    }
  },

  // Export CSV directly from database
  exportCSVFromDB: async (userId: string) => {
    const { data, error } = await supabase
      .from('rvu_records')
      .select('dictation_datetime, exam_description, wrvu_estimate, modality, exam_type, body_part')
      .eq('user_id', userId)
      .order('dictation_datetime', { ascending: true })

    if (error || !data) {
      return null
    }

    // Helper to properly escape CSV fields (quote if contains comma, quote, or newline)
    const escapeCSV = (value: string | null | undefined): string => {
      const str = value || ''
      // If the field contains comma, quote, or newline, wrap in quotes and escape internal quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // CSV headers
    const headers = [
      'Date',
      'Time',
      'Day of Week',
      'Exam Description',
      'Modality',
      'Body Part',
      'Exam Type',
      'wRVU'
    ]

    // Convert records to CSV rows
    const rows = data.map(record => {
      const date = new Date(record.dictation_datetime)
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' })
      const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
      const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      
      return [
        dateStr,
        timeStr,
        dayOfWeek,
        escapeCSV(record.exam_description),
        escapeCSV(record.modality),
        escapeCSV(record.body_part),
        escapeCSV(record.exam_type),
        (record.wrvu_estimate || 0).toFixed(2)
      ]
    })

    // Build CSV content
    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')
  },

  processData: () => {
    const { records, goalRvuPerDay, filters } = get()
    if (records.length === 0) {
      set({ metrics: null, dailyData: [], hourlyData: [], caseMixData: [], modalityData: [], heatmapData: [], filteredRecords: [] })
      return
    }

    // Compute available modalities and body parts from all records (for filter dropdowns)
    const allModalities = [...new Set(records.map(r => r.modality).filter(Boolean))].sort()
    const allBodyParts = [...new Set(records.map(r => r.bodyPart).filter(Boolean))].sort()
    set({ availableModalities: allModalities, availableBodyParts: allBodyParts })

    // Apply filters
    let filteredRecords = [...records]
    
    // Date range filter
    if (filters.startDate) {
      const startDate = new Date(filters.startDate)
      startDate.setHours(0, 0, 0, 0)
      filteredRecords = filteredRecords.filter(r => r.dictationDatetime >= startDate)
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate)
      endDate.setHours(23, 59, 59, 999)
      filteredRecords = filteredRecords.filter(r => r.dictationDatetime <= endDate)
    }
    
    // Time range filter
    if (filters.startHour !== null) {
      filteredRecords = filteredRecords.filter(r => r.dictationDatetime.getHours() >= filters.startHour!)
    }
    if (filters.endHour !== null) {
      filteredRecords = filteredRecords.filter(r => r.dictationDatetime.getHours() <= filters.endHour!)
    }

    // Modality filter
    if (filters.modalities.length > 0) {
      filteredRecords = filteredRecords.filter(r => filters.modalities.includes(r.modality))
    }

    // Body part filter
    if (filters.bodyParts.length > 0) {
      filteredRecords = filteredRecords.filter(r => filters.bodyParts.includes(r.bodyPart))
    }

    // Store filtered records
    set({ filteredRecords })

    if (filteredRecords.length === 0) {
      set({ metrics: null, dailyData: [], hourlyData: [], caseMixData: [], modalityData: [], heatmapData: [] })
      return
    }

    // Use filtered records for calculations
    const activeRecords = filteredRecords

    // Calculate metrics
    const totalRvu = activeRecords.reduce((sum, r) => sum + r.wrvuEstimate, 0)
    const cases = activeRecords.length
    const rvuPerCase = totalRvu / cases

    const uniqueDates = new Set(activeRecords.map(r => r.dictationDatetime.toDateString()))
    const daysWorked = uniqueDates.size
    const avgCasesDay = cases / daysWorked
    const avgRvuDay = totalRvu / daysWorked

    const dates = activeRecords.map(r => r.dictationDatetime)
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
    const dateRange = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const workEfficiency = (daysWorked / dateRange) * 100

    const rvuPerHour = avgRvuDay / 8

    // Daily data
    const dailyMap = new Map<string, number>()
    activeRecords.forEach(r => {
      const dateStr = r.dictationDatetime.toDateString()
      dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + r.wrvuEstimate)
    })

    const sortedDates = Array.from(dailyMap.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())

    const dailyData: DailyData[] = sortedDates.map(([date, rvu], i) => {
      const last7 = sortedDates.slice(Math.max(0, i - 6), i + 1)
      const ma7 = last7.reduce((sum, [, r]) => sum + r, 0) / last7.length
      return {
        date,
        rvu,
        ma7,
        meetsTarget: rvu >= goalRvuPerDay,
      }
    })

    // Calculate trend slope
    const xMean = (dailyData.length - 1) / 2
    const yMean = dailyData.reduce((sum, d) => sum + d.rvu, 0) / dailyData.length
    const numerator = dailyData.reduce((sum, d, i) => sum + (i - xMean) * (d.rvu - yMean), 0)
    const denominator = dailyData.reduce((sum, _, i) => sum + Math.pow(i - xMean, 2), 0)
    const trendSlope = denominator !== 0 ? numerator / denominator : 0

    // Target hit rate
    const targetHitRate = (dailyData.filter(d => d.meetsTarget).length / dailyData.length) * 100

    // Best day
    const bestDay = dailyData.reduce((best, curr) => curr.rvu > best.rvu ? curr : best, dailyData[0])

    // Hourly data
    const hourlyMap = new Map<number, number>()
    activeRecords.forEach(r => {
      const hour = r.dictationDatetime.getHours()
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + r.wrvuEstimate)
    })

    const hourlyData: HourlyData[] = Array.from({ length: 24 }, (_, hour) => {
      const totalRvuHour = hourlyMap.get(hour) || 0
      const rvuPerHourAvg = totalRvuHour / daysWorked
      return {
        hour,
        rvu: rvuPerHourAvg,
        meetsTarget: rvuPerHourAvg >= goalRvuPerDay / 8,
      }
    })

    const peakHour = hourlyData.reduce((peak, curr) => curr.rvu > peak.rvu ? curr : peak, hourlyData[0]).hour

    // Case mix data
    const caseMixMap = new Map<string, { rvu: number; cases: number }>()
    activeRecords.forEach(r => {
      const key = `${r.modality} - ${r.bodyPart}`
      const existing = caseMixMap.get(key) || { rvu: 0, cases: 0 }
      caseMixMap.set(key, { rvu: existing.rvu + r.wrvuEstimate, cases: existing.cases + 1 })
    })

    const caseMixData: CaseMixData[] = Array.from(caseMixMap.entries())
      .map(([label, { rvu, cases }]) => ({ label, rvu, cases, modality: label.split(' - ')[0] }))
      .sort((a, b) => b.rvu - a.rvu)
      .slice(0, 5)

    // Modality data
    const modalityMap = new Map<string, number>()
    activeRecords.forEach(r => {
      modalityMap.set(r.modality, (modalityMap.get(r.modality) || 0) + r.wrvuEstimate)
    })

    const modalityData = Array.from(modalityMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Heatmap data
    const dowOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const heatmapMap = new Map<string, number>()
    activeRecords.forEach(r => {
      const dow = dowOrder[r.dictationDatetime.getDay()]
      const hour = r.dictationDatetime.getHours()
      const key = `${dow}-${hour}`
      heatmapMap.set(key, (heatmapMap.get(key) || 0) + r.wrvuEstimate)
    })

    const heatmapData: { dow: string; hour: number; rvu: number }[] = []
    dowOrder.forEach(dow => {
      for (let hour = 0; hour < 24; hour++) {
        heatmapData.push({
          dow,
          hour,
          rvu: heatmapMap.get(`${dow}-${hour}`) || 0,
        })
      }
    })

    const peakDow = activeRecords.reduce((acc, r) => {
      const dow = dowOrder[r.dictationDatetime.getDay()]
      acc[dow] = (acc[dow] || 0) + r.wrvuEstimate
      return acc
    }, {} as Record<string, number>)
    const peakDowName = Object.entries(peakDow).sort((a, b) => b[1] - a[1])[0]?.[0] || ''

    const metrics: ProcessedMetrics = {
      totalRvu,
      cases,
      rvuPerCase,
      daysWorked,
      avgCasesDay,
      avgRvuDay,
      workEfficiency,
      rvuPerHour,
      trendSlope,
      targetHitRate,
      bestDayDate: bestDay?.date || '',
      bestDayRvu: bestDay?.rvu || 0,
      ma7: dailyData[dailyData.length - 1]?.ma7 || 0,
      peakHour,
      peakDow: peakDowName,
      annualProjection: avgRvuDay * 250,
    }

    set({ metrics, dailyData, hourlyData, caseMixData, modalityData, heatmapData })
    
    // Calculate suggested goals after data is processed
    get().calculateSuggestedGoals()
  },
}))

