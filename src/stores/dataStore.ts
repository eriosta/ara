import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { processRawData, RVURecord, ProcessedMetrics, DailyData, HourlyData, CaseMixData } from '@/lib/dataProcessing'

interface DataState {
  records: RVURecord[]
  metrics: ProcessedMetrics | null
  dailyData: DailyData[]
  hourlyData: HourlyData[]
  caseMixData: CaseMixData[]
  modalityData: { name: string; value: number }[]
  heatmapData: { dow: string; hour: number; rvu: number }[]
  loading: boolean
  goalRvuPerDay: number
  setGoalRvuPerDay: (goal: number) => void
  fetchRecords: (userId: string) => Promise<void>
  addRecords: (userId: string, rawData: { dictation_datetime: string; exam_description: string; wrvu_estimate: number }[]) => Promise<{ error: Error | null }>
  clearRecords: (userId: string) => Promise<{ error: Error | null }>
  processData: () => void
}

export const useDataStore = create<DataState>((set, get) => ({
  records: [],
  metrics: null,
  dailyData: [],
  hourlyData: [],
  caseMixData: [],
  modalityData: [],
  heatmapData: [],
  loading: false,
  goalRvuPerDay: 15,

  setGoalRvuPerDay: (goal: number) => {
    set({ goalRvuPerDay: goal })
    get().processData()
  },

  fetchRecords: async (userId: string) => {
    set({ loading: true })
    try {
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
      const processedRecords = processRawData(rawData)
      
      const recordsToInsert = processedRecords.map(r => ({
        user_id: userId,
        dictation_datetime: r.dictationDatetime.toISOString(),
        exam_description: r.examDescription,
        wrvu_estimate: r.wrvuEstimate,
        modality: r.modality,
        exam_type: r.examType,
        body_part: r.bodyPart,
      }))

      const { error } = await supabase
        .from('rvu_records')
        .insert(recordsToInsert)

      if (!error) {
        await get().fetchRecords(userId)
      }

      return { error: error as Error | null }
    } finally {
      set({ loading: false })
    }
  },

  clearRecords: async (userId: string) => {
    set({ loading: true })
    try {
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

      if (!error) {
        set({ 
          records: [], 
          metrics: null, 
          dailyData: [], 
          hourlyData: [], 
          caseMixData: [],
          modalityData: [],
          heatmapData: []
        })
      }

      return { error: error as Error | null }
    } finally {
      set({ loading: false })
    }
  },

  processData: () => {
    const { records, goalRvuPerDay } = get()
    if (records.length === 0) {
      set({ metrics: null, dailyData: [], hourlyData: [], caseMixData: [], modalityData: [], heatmapData: [] })
      return
    }

    // Calculate metrics
    const totalRvu = records.reduce((sum, r) => sum + r.wrvuEstimate, 0)
    const cases = records.length
    const rvuPerCase = totalRvu / cases

    const uniqueDates = new Set(records.map(r => r.dictationDatetime.toDateString()))
    const daysWorked = uniqueDates.size
    const avgCasesDay = cases / daysWorked
    const avgRvuDay = totalRvu / daysWorked

    const dates = records.map(r => r.dictationDatetime)
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
    const dateRange = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const workEfficiency = (daysWorked / dateRange) * 100

    const rvuPerHour = avgRvuDay / 8

    // Daily data
    const dailyMap = new Map<string, number>()
    records.forEach(r => {
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
    records.forEach(r => {
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
    records.forEach(r => {
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
    records.forEach(r => {
      modalityMap.set(r.modality, (modalityMap.get(r.modality) || 0) + r.wrvuEstimate)
    })

    const modalityData = Array.from(modalityMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Heatmap data
    const dowOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const heatmapMap = new Map<string, number>()
    records.forEach(r => {
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

    const peakDow = records.reduce((acc, r) => {
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
  },
}))

