// Data processing utilities - MAPPING-BASED CLASSIFICATION SYSTEM
// Uses systematic rule-based classification from classificationMaps.ts

import { 
  MODALITY_RULES, 
  BODY_PART_RULES, 
  POST_PROCESSING_RULES,
  applyClassificationRules 
} from './classificationMaps'

export interface RVURecord {
  id?: string
  dictationDatetime: Date
  examDescription: string
  wrvuEstimate: number
  modality: string
  examType: string
  bodyPart: string
}

export interface ProcessedMetrics {
  totalRvu: number
  cases: number
  rvuPerCase: number
  daysWorked: number
  avgCasesDay: number
  avgRvuDay: number
  workEfficiency: number
  rvuPerHour: number
  trendSlope: number
  targetHitRate: number
  bestDayDate: string
  bestDayRvu: number
  ma7: number
  peakHour: number
  peakDow: string
  annualProjection: number
}

export interface DailyData {
  date: string
  rvu: number
  ma7: number
  meetsTarget: boolean
}

export interface HourlyData {
  hour: number
  rvu: number
  meetsTarget: boolean
}

export interface CaseMixData {
  label: string
  rvu: number
  cases: number
  modality: string
}

/**
 * Determines the imaging modality from exam description
 * Uses systematic mapping-based classification rules
 */
export function modalityFromDesc(s: string): string {
  return applyClassificationRules(s, MODALITY_RULES)
}

/**
 * Extracts contrast information from exam description
 */
function contrastPhrase(t: string): string {
  if (/WITH\s*(AND|&)?\s*WITHOUT|W\/.*AND.*W\/O|W\s*&\s*W\/O/i.test(t)) return 'w/ and w/o Contrast'
  if (/\bWITHOUT\b|\bW\/O\b|\bWO\b/i.test(t)) return 'w/o Contrast'
  if (/\bWITH\b|\bW\/\b/i.test(t)) return 'w/ Contrast'
  return ''
}

/**
 * Determines CT body region from description
 */
function regionCT(t: string): string {
  const has = (w: string) => t.includes(w)
  if (has('CHEST') && (has('ABDOMEN') || has('PELVIS'))) return 'Chest/Abdomen/Pelvis'
  if (has('ABDOMEN') && has('PELVIS')) return 'Abdomen/Pelvis'
  if (has('CHEST')) return 'Chest'
  if (has('ABDOMEN')) return 'Abdomen'
  if (has('PELVIS')) return 'Pelvis'
  if (has('HEAD') || has('BRAIN')) return 'Head'
  if (has('NECK')) return 'Neck'
  if (has('SPINE') || has('LUMBAR') || has('CERVICAL') || has('THORACIC')) return 'Spine'
  return 'Other'
}

/**
 * Extracts body parts from exam description
 * Uses systematic mapping-based classification rules
 */
export function bodyPartsFromDesc(s: string): string {
  let result = applyClassificationRules(s, BODY_PART_RULES)
  
  // Handle special CT region detection
  const t = s.toUpperCase()
  if (result === 'CT Region' && t.includes('CT')) {
    const region = regionCT(t)
    if (region !== 'Other') {
      if (region === 'Chest/Abdomen/Pelvis') result = 'Chest, Abdomen, Pelvis'
      else if (region === 'Abdomen/Pelvis') result = 'Abdomen, Pelvis'
      else result = region
    } else {
      result = 'Unknown'
    }
  }
  
  // Handle multiple body parts (e.g., "Liver, Spleen")
  let bodyParts = result.split(',').map(bp => bp.trim()).filter(Boolean)
  
  // Apply post-processing rules
  const modality = modalityFromDesc(s)
  for (const rule of POST_PROCESSING_RULES) {
    if (rule.condition(modality, result, s)) {
      const updated = rule.action(modality, result)
      result = updated.bodyPart
      bodyParts = result.split(',').map(bp => bp.trim()).filter(Boolean)
    }
  }
  
  // Merge Head/Neck + Vascular → Head/Neck
  if (bodyParts.includes('Head/Neck') && bodyParts.includes('Vascular')) {
    bodyParts = bodyParts.filter(p => p !== 'Vascular')
  }
  
  // Deduplicate and return
  const unique = [...new Set(bodyParts)]
  return unique.length > 0 ? unique.join(', ') : 'Unknown'
}

/**
 * Creates a standardized exam type label from description
 */
export function examFromDesc(s: string): string {
  const t = s.toUpperCase().replace(/\s+/g, ' ').trim()
  const mod = modalityFromDesc(t)
  
  let bodyPart = bodyPartsFromDesc(t)
  if (bodyPart === 'Unknown') bodyPart = 'Other'
  
  const con = contrastPhrase(t)
  
  // Format based on modality type
  if (['CT', 'CTA', 'MRI', 'MRA', 'MRV', 'PET', 'PET/CT'].includes(mod)) {
    return `${mod} ${bodyPart}${con ? ` ${con}` : ''}`
  }
  
  if (mod === 'Radiography') {
    return `XR ${bodyPart}`
  }
  
  if (mod === 'Nuclear Medicine') {
    return `NM ${bodyPart}`
  }
  
  if (mod === 'US' || mod === 'US - Duplex' || mod === 'US - Obstetrical' || mod === 'US Procedure') {
    return `${mod} ${bodyPart}`
  }
  
  if (mod === 'Fluoroscopy' || mod === 'Fluoroscopy - Dynamic' || mod === 'Fluoroscopy Guidance') {
    return `${mod} ${bodyPart}`
  }
  
  return `${mod} ${bodyPart}`
}

/**
 * Parses date strings in various formats, including "MM/DD/YYYY HH:MM:SS AM/PM"
 * Safari and some mobile browsers are strict and don't support this format natively
 */
function parseDateTime(dateStr: string): Date {
  if (!dateStr) return new Date(NaN)
  
  // Handle "MM/DD/YYYY HH:MM:SS AM/PM" format first (most common from Excel)
  const amPmMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i)
  if (amPmMatch) {
    const [, month, day, year, hourStr, min, sec, ampm] = amPmMatch
    let hour = parseInt(hourStr, 10)
    
    if (ampm) {
      const isPM = ampm.toUpperCase() === 'PM'
      if (isPM && hour !== 12) hour += 12
      if (!isPM && hour === 12) hour = 0
    }
    
    return new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      hour,
      parseInt(min, 10),
      parseInt(sec, 10)
    )
  }
  
  // Handle "MM/DD/YYYY HH:MM AM/PM" format (without seconds)
  const amPmNoSecMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (amPmNoSecMatch) {
    const [, month, day, year, hourStr, min, ampm] = amPmNoSecMatch
    let hour = parseInt(hourStr, 10)
    
    if (ampm) {
      const isPM = ampm.toUpperCase() === 'PM'
      if (isPM && hour !== 12) hour += 12
      if (!isPM && hour === 12) hour = 0
    }
    
    return new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      hour,
      parseInt(min, 10),
      0
    )
  }
  
  // Handle ISO-ish format "YYYY-MM-DD HH:MM:SS"
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day, hour, min, sec] = isoMatch
    return new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(min, 10),
      parseInt(sec, 10)
    )
  }
  
  // Try native parsing as fallback (works in Chrome, Firefox, Node.js)
  const nativeDate = new Date(dateStr)
  if (!isNaN(nativeDate.getTime())) {
    return nativeDate
  }
  
  return new Date(NaN)
}

/**
 * Processes raw CSV data into structured RVU records
 */
export function processRawData(rawData: { dictation_datetime: string; exam_description: string; wrvu_estimate: number }[]): RVURecord[] {
  return rawData
    .filter(row => row.dictation_datetime && row.exam_description && !isNaN(row.wrvu_estimate))
    .map(row => {
      const examDesc = row.exam_description
      const parsedDate = parseDateTime(row.dictation_datetime)
      
      return {
        dictationDatetime: parsedDate,
        examDescription: examDesc,
        wrvuEstimate: Number(row.wrvu_estimate),
        modality: modalityFromDesc(examDesc),
        examType: examFromDesc(examDesc),
        bodyPart: bodyPartsFromDesc(examDesc),
      }
    })
    .filter(record => !isNaN(record.dictationDatetime.getTime()) && !isNaN(record.wrvuEstimate))
}
