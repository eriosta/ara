// Data processing utilities ported from Python

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

// Body part patterns
const BODY_PART_PATTERNS: Record<string, RegExp> = {
  'Head/Neck': /\b(HEAD|NECK|BRAIN|SKULL|ORBITS|FACIAL|SINUS|TEMPORAL|PITUITARY|CRANIAL|SKULL BASE)\b/i,
  'Chest': /\b(CHEST|LUNG|THORAX)\b/i,
  'Abdomen': /\b(ABDOMEN|ABDOMINAL)\b/i,
  'Pelvis': /\b(PELVIS|PELVIC)\b/i,
  'Spine': /\b(SPINE|LUMBOSACRAL|L SPINE|T SPINE|C SPINE|CERVICAL|THORACIC|LUMBAR|SACRUM|COCCYX)\b/i,
  'Upper Extremity': /\b(SHOULDER|ELBOW|WRIST|HAND|FINGER|HUMERUS|FOREARM|CLAVICLE|ARM)\b/i,
  'Lower Extremity': /\b(HIP|KNEE|ANKLE|FOOT|TOE|FEMUR|TIBIA|FIBULA|THIGH|LEG)\b/i,
  'Breast': /\b(BREAST|MAMMO)\b/i,
  'Renal': /\b(RENAL|KIDNEY)\b/i,
  'Cardiac': /\b(CARDIAC|HEART|ECHO)\b/i,
  'Vascular': /\b(CAROTID|ARTERIAL|VENOUS|VEIN|ARTERY)\b/i,
  'Liver': /\b(LIVER|HEPATOBILIARY|HEPATIC|HIDA)\b/i,
  'Spleen': /\b(SPLEEN)\b/i,
  'Stomach': /\b(STOMACH|GASTRIC|ESOPHAGUS|SWALLOW)\b/i,
  'Whole Body': /\b(WHOLE BODY|BONE SCAN|TUMOR IMAGING|SKULL BASE.*MID THIGH|SKULL BASE.*THIGH)\b/i,
}

export function modalityFromDesc(s: string): string {
  const t = s.toUpperCase()

  // MRI variations
  if (t.includes('MRI') || t.includes('MR ')) {
    if (t.includes('MRA')) return 'MRA'
    if (t.includes('MRV')) return 'MRV'
    return 'MRI'
  }

  // CT variations
  if (t.includes('CT')) {
    if (t.includes('CTA')) return 'CTA'
    return 'CT'
  }

  // Ultrasound variations
  if (t.includes('US ') || t.includes('ULTRASOUND') || t.includes('DUPLEX') || t.includes('DUP ')) {
    if (t.includes('DUPLEX') || t.includes('DUP ')) return 'US - Duplex'
    if (t.includes('OBSTETRICAL') || t.includes('PREGNANCY')) return 'US - Obstetrical'
    if (t.includes('PROCEDURE')) return 'US Procedure'
    return 'US'
  }

  // X-ray variations
  const xrayTerms = ['XR ', 'X-RAY', 'CHEST', 'ABDOMEN', 'KNEE', 'HAND', 'FOOT', 'SHOULDER', 'ELBOW', 
    'ANKLE', 'WRIST', 'HIP', 'FEMUR', 'TIBIA', 'HUMERUS', 'FINGER', 'TOE', 'SPINE', 'PELVIS', 
    'CLAVICLE', 'RIBS', 'SINUS', 'TEMPORAL', 'FACIAL', 'ORBITS', 'SKULL', 'SACRUM', 'COCCYX']
  if (xrayTerms.some(term => t.includes(term))) {
    return 'Radiography'
  }

  // Fluoroscopy variations
  if (t.includes('FL ') || t.includes('FLUORO') || t.includes('BARIUM') || t.includes('LUMBAR PUNCTURE') || t.includes('SP ')) {
    if (t.includes('DYNAMIC')) return 'Fluoroscopy - Dynamic'
    if (t.includes('GUIDANCE')) return 'Fluoroscopy Guidance'
    return 'Fluoroscopy'
  }

  // Mammography variations
  if (t.includes('MAMMO') || t.includes('BREAST')) {
    if (t.includes('PROCEDURE') || t.includes('BIOPSY')) return 'Mammography Procedure'
    return 'Mammography'
  }

  // Echocardiography
  if (t.includes('ECHO')) return 'Echocardiography'

  // PET variations
  if (t.includes('PET') || t.includes('POSITRON')) {
    if (t.includes('PET/CT') || t.includes('PET CT')) return 'PET/CT'
    return 'PET'
  }

  // Nuclear Medicine
  if (t.includes('NM ') || t.includes('NUCLEAR MEDICINE')) {
    return 'Nuclear Medicine'
  }
  const nmTerms = ['HIDA', 'BONE SCAN', 'RENAL SCAN', 'LUNG VENT', 'PERF SCAN', 'GASTRIC EMPTYING', 
    'MAG3', 'LASIX', 'HEPATOBILIARY DUCTAL', 'LIVER AND SPLEEN IMAGING']
  if (nmTerms.some(term => t.includes(term))) {
    if (!['CT', 'MRI', 'MR ', 'US ', 'ULTRASOUND', 'XR ', 'X-RAY'].some(m => t.includes(m))) {
      return 'Nuclear Medicine'
    }
  }

  // Invasive procedures
  if (t.includes('INVASIVE') || t.includes('BIOPSY') || t.includes('PROCEDURE')) {
    return 'Invasive'
  }

  return 'Other'
}

function contrastPhrase(t: string): string {
  if (/WITH( AND)? WITHOUT|W\/.*AND.*W\/O/i.test(t)) return 'w/ and w/o Contrast'
  if (/\bWITHOUT\b|\bW\/O\b/i.test(t)) return 'w/o Contrast'
  if (/\bWITH\b|\bW\/\b/i.test(t)) return 'w/ Contrast'
  return ''
}

function regionCT(t: string): string {
  const has = (w: string) => t.includes(w)
  if (has('CHEST') && (has('ABDOMEN') || has('PELVIS'))) return 'Chest/Abdomen/Pelvis'
  if (has('ABDOMEN') && has('PELVIS')) return 'Abdomen/Pelvis'
  if (has('CHEST')) return 'Chest'
  if (has('ABDOMEN')) return 'Abdomen'
  if (has('PELVIS')) return 'Pelvis'
  return 'Other'
}

export function bodyPartsFromDesc(s: string): string {
  const t = s.toUpperCase()
  const found: string[] = []

  for (const [name, pattern] of Object.entries(BODY_PART_PATTERNS)) {
    if (pattern.test(t)) {
      found.push(name)
    }
  }

  // Special handling for Nuclear Medicine exams
  if (found.length === 0) {
    if (/\bRENAL|KIDNEY|MAG3\b/i.test(t)) found.push('Renal')
    else if (/\bLUNG|VENT|PERF\b/i.test(t)) found.push('Chest')
    else if (/\bBONE SCAN|3 PHASE BONE\b/i.test(t)) found.push('Whole Body')
    else if (/\bHEPATOBILIARY|HIDA|LIVER|SPLEEN\b/i.test(t)) {
      if (t.includes('SPLEEN')) {
        found.push('Liver', 'Spleen')
      } else {
        found.push('Liver')
      }
    }
    else if (/\bGASTRIC EMPTYING|STOMACH\b/i.test(t)) found.push('Stomach')
    else if (/\bBARIUM SWALLOW|ESOPHAGUS\b/i.test(t)) found.push('Stomach')
  }

  // Check for PET scans with ranges
  if (/SKULL.*THIGH|SKULL.*MID/i.test(t) && found.length === 0) {
    found.push('Whole Body')
  }

  // Fallback for CT scans
  if (found.length === 0 && t.includes('CT')) {
    const region = regionCT(t)
    if (region !== 'Other') {
      if (region === 'Chest/Abdomen/Pelvis') found.push('Chest', 'Abdomen', 'Pelvis')
      else if (region === 'Abdomen/Pelvis') found.push('Abdomen', 'Pelvis')
      else found.push(region)
    }
  }

  // Final fallbacks
  if (found.length === 0) {
    if (t.includes('CHEST')) found.push('Chest')
    else if (/\bSCAN\b/.test(t) && (t.includes('WHOLE') || t.includes('BODY'))) found.push('Whole Body')
    else if (t.includes('PORTACATH') || t.includes('ACCESS')) found.push('Vascular')
  }

  // Deduplicate
  return [...new Set(found)].join(', ') || 'Unknown'
}

export function examFromDesc(s: string): string {
  const t = s.toUpperCase().replace(/\s+/g, ' ').trim()
  const mod = modalityFromDesc(t)
  
  let bodyPart = bodyPartsFromDesc(t)
  if (bodyPart === 'Unknown') bodyPart = 'Other'
  
  const con = contrastPhrase(t)
  
  if (['CT', 'CTA', 'MRI', 'MRA', 'MRV', 'PET', 'PET/CT'].includes(mod)) {
    return `${mod} ${bodyPart}${con ? ` ${con}` : ''}`
  }
  if (mod === 'Radiography') return `XR ${bodyPart}`
  
  return `${mod} ${bodyPart}`
}

export function processRawData(rawData: { dictation_datetime: string; exam_description: string; wrvu_estimate: number }[]): RVURecord[] {
  return rawData
    .filter(row => row.dictation_datetime && row.exam_description && !isNaN(row.wrvu_estimate))
    .map(row => {
      const examDesc = row.exam_description
      return {
        dictationDatetime: new Date(row.dictation_datetime),
        examDescription: examDesc,
        wrvuEstimate: Number(row.wrvu_estimate),
        modality: modalityFromDesc(examDesc),
        examType: examFromDesc(examDesc),
        bodyPart: bodyPartsFromDesc(examDesc),
      }
    })
    .filter(record => !isNaN(record.dictationDatetime.getTime()) && !isNaN(record.wrvuEstimate))
}

export function parseCSV(text: string): { dictation_datetime: string; exam_description: string; wrvu_estimate: number }[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(/[,\t]/).map(h => h.trim().toLowerCase())
  
  const dtIdx = headers.findIndex(h => h.includes('dttm') || h.includes('datetime') || h.includes('date'))
  const examIdx = headers.findIndex(h => h.includes('exam') && h.includes('desc'))
  const rvuIdx = headers.findIndex(h => h.includes('wrvu') || h.includes('rvu'))

  if (dtIdx === -1 || examIdx === -1 || rvuIdx === -1) {
    throw new Error('Missing required columns: DICTATION DTTM, EXAM DESC, WRVU ESTIMATE')
  }

  return lines.slice(1).map(line => {
    const cols = line.split(/[,\t]/)
    return {
      dictation_datetime: cols[dtIdx]?.trim() || '',
      exam_description: cols[examIdx]?.trim() || '',
      wrvu_estimate: parseFloat(cols[rvuIdx]?.trim() || '0'),
    }
  }).filter(row => row.dictation_datetime && row.exam_description)
}

