// Data processing utilities - IMPROVED VERSION
// Fixed modality detection order and added comprehensive patterns

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

// Body part patterns - EXPANDED with thyroid, parathyroid, lymphatic
const BODY_PART_PATTERNS: Record<string, RegExp> = {
  'Head/Neck': /\b(HEAD|NECK|BRAIN|SKULL|ORBITS|FACIAL|SINUS|TEMPORAL|PITUITARY|CRANIAL|SKULL BASE|THYROID|PARATHYROID|DATSCAN)\b/i,
  'Chest': /\b(CHEST|LUNG|THORAX|PULMONARY)\b/i,
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
  'Whole Body': /\b(WHOLE BODY|BONE SCAN|TUMOR IMAGING|SKULL BASE.*MID THIGH|SKULL BASE.*THIGH|3 PHASE BONE|LYMPHOSCINTIGRAPH)\b/i,
  'Musculoskeletal': /\b(BONE\/JOINT|BONE JOINT|JOINT)\b/i,
  'Lymphatic': /\b(SENTINEL NODE|LYMPH|LYMPHATIC)\b/i,
}

/**
 * Determines the imaging modality from exam description
 * IMPORTANT: Order matters! More specific patterns must come before general ones
 */
export function modalityFromDesc(s: string): string {
  const t = s.toUpperCase()

  // ========== NUCLEAR MEDICINE FIRST (highest priority) ==========
  // NM prefix - catches "NM Bone/Joint", "NM Gastric", "NM Hida", "NM Injection", etc.
  if (t.startsWith('NM ') || t.includes(' NM ')) {
    return 'Nuclear Medicine'
  }

  // SPECT studies (before CT check since SPECT/CT should be NM)
  if (t.includes('SPECT')) {
    return 'Nuclear Medicine'
  }

  // DaTscan (dopamine transporter scan) - Nuclear Medicine
  if (t.includes('DATSCAN') || t.includes('DAT SCAN')) {
    return 'Nuclear Medicine'
  }

  // Thyroid nuclear studies (I-123, I-131, Tc-99m)
  if ((t.includes('THYROID') || t.includes('PARATHYROID')) && 
      (t.includes('I-123') || t.includes('I123') || t.includes('I-131') || 
       t.includes('I131') || t.includes('UPTAKE') || t.includes('SCAN'))) {
    // Check if it's actually an ultrasound
    if (t.includes('ULTRASOUND') || t.includes('US ')) {
      return 'US'
    }
    return 'Nuclear Medicine'
  }

  // HIDA / Hepatobiliary scans (before CT/CTA check)
  if (t.includes('HIDA') || (t.includes('HEPATOBILIARY') && t.includes('IMAGING'))) {
    return 'Nuclear Medicine'
  }

  // Bone scans (including injection, 3-phase) - before CT check
  if (t.includes('BONE SCAN') || t.includes('3 PHASE BONE')) {
    return 'Nuclear Medicine'
  }

  // Gastric emptying studies
  if (t.includes('GASTRIC EMPTYING') || t.includes('GASTRIC EMPTY')) {
    return 'Nuclear Medicine'
  }

  // Liver/spleen imaging (nuclear)
  if (t.includes('LIVER AND SPLEEN IMAGING') || t.includes('LIVER SPLEEN')) {
    return 'Nuclear Medicine'
  }

  // Lymphoscintigraphy
  if (t.includes('LYMPHOSCINTIGRAPH') || t.includes('SENTINEL NODE')) {
    return 'Nuclear Medicine'
  }

  // Other specific NM terms
  const nmTerms = ['RENAL SCAN', 'MAG3', 'LASIX RENAL', 'LUNG VENT', 'PERF SCAN', 
    'VQ SCAN', 'V/Q', 'GALLIUM', 'TAGGED RBC', 'BLEEDING SCAN', 'MECKEL',
    'OCTREOTIDE', 'MIBG', 'TUMOR IMAGING']
  if (nmTerms.some(term => t.includes(term))) {
    return 'Nuclear Medicine'
  }

  // ========== PET IMAGING ==========
  // PET/CT must come before CT check
  if (t.includes('PET/CT') || t.includes('PET CT') || t.includes('PET-CT')) {
    return 'PET/CT'
  }

  // PET alone
  if (t.includes('PET') || t.includes('POSITRON')) {
    return 'PET'
  }

  // ========== MRI VARIATIONS ==========
  if (t.includes('MRI') || t.includes('MR ') || /\bMR\b/.test(t)) {
    if (t.includes('MRA')) return 'MRA'
    if (t.includes('MRV')) return 'MRV'
    return 'MRI'
  }

  // ========== CT VARIATIONS ==========
  if (t.includes('CT') || t.includes('CAT SCAN')) {
    if (t.includes('CTA')) return 'CTA'
    return 'CT'
  }

  // ========== ULTRASOUND VARIATIONS ==========
  if (t.includes('US ') || t.includes('ULTRASOUND') || t.includes('DUPLEX') || 
      t.includes('DUP ') || t.includes('SONOGRAM') || t.includes('SONO ')) {
    if (t.includes('DUPLEX') || t.includes('DUP ')) return 'US - Duplex'
    if (t.includes('OBSTETRICAL') || t.includes('PREGNANCY') || t.includes('OB ')) return 'US - Obstetrical'
    if (t.includes('PROCEDURE') || t.includes('GUIDED')) return 'US Procedure'
    return 'US'
  }

  // ========== FLUOROSCOPY ==========
  if (t.includes('FL ') || t.includes('FLUORO') || t.includes('BARIUM') || 
      t.includes('LUMBAR PUNCTURE') || t.includes('SP ') || t.includes('SWALLOW')) {
    if (t.includes('DYNAMIC')) return 'Fluoroscopy - Dynamic'
    if (t.includes('GUIDANCE')) return 'Fluoroscopy Guidance'
    return 'Fluoroscopy'
  }

  // ========== MAMMOGRAPHY ==========
  if (t.includes('MAMMO') || (t.includes('BREAST') && !t.includes('MRI'))) {
    if (t.includes('PROCEDURE') || t.includes('BIOPSY') || t.includes('STEREO')) return 'Mammography Procedure'
    return 'Mammography'
  }

  // ========== ECHOCARDIOGRAPHY ==========
  if (t.includes('ECHO') && (t.includes('CARDIO') || t.includes('HEART'))) {
    return 'Echocardiography'
  }

  // ========== X-RAY / RADIOGRAPHY ==========
  const xrayTerms = ['XR ', 'X-RAY', 'XRAY', 'RADIOGRAPH']
  if (xrayTerms.some(term => t.includes(term))) {
    return 'Radiography'
  }

  // Implicit X-ray patterns (body part + views, no other modality specified)
  const implicitXrayPatterns = [
    /\b\d+\s*VIEWS?\b/i,  // "2 VIEWS", "3 VIEW"
    /\bAP\b.*\b(LAT|LATERAL)\b/i,  // "AP LAT", "AP LATERAL"
    /\b(PA|AP)\s*(AND|\/)\s*(LAT|LATERAL)\b/i,  // "PA/LAT", "AP AND LATERAL"
    /\bPORTABLE\b/i,  // Portable studies are usually X-rays
    /\b(SUNRISE|MERCHANT|TUNNEL)\b.*KNEE/i,  // Special knee views
  ]
  
  const bodyPartXrayTerms = ['CHEST', 'ABDOMEN', 'KNEE', 'HAND', 'FOOT', 'SHOULDER', 'ELBOW', 
    'ANKLE', 'WRIST', 'HIP', 'FEMUR', 'TIBIA', 'HUMERUS', 'FINGER', 'TOE', 'SPINE', 'PELVIS', 
    'CLAVICLE', 'RIBS', 'SINUS', 'TEMPORAL', 'FACIAL', 'ORBITS', 'SKULL', 'SACRUM', 'COCCYX']
  
  // Check for implicit X-ray patterns
  if (implicitXrayPatterns.some(pattern => pattern.test(t))) {
    // Make sure it's not explicitly another modality
    if (!['CT', 'MRI', 'MR ', 'US ', 'ULTRASOUND', 'FLUORO', 'PET', 'SPECT', 'NM '].some(m => t.includes(m))) {
      if (bodyPartXrayTerms.some(term => t.includes(term))) {
        return 'Radiography'
      }
    }
  }

  // ========== INVASIVE PROCEDURES ==========
  if (t.includes('INVASIVE') || t.includes('BIOPSY') || t.includes('DRAINAGE') || 
      t.includes('ASPIRATION') || t.includes('INJECTION PROC')) {
    return 'Invasive'
  }

  // ========== CATCH-ALL NUCLEAR MEDICINE ==========
  // Final check for any remaining NM patterns
  if (t.includes('NUCLEAR MEDICINE') || t.includes('NUCLEAR MED')) {
    return 'Nuclear Medicine'
  }

  return 'Other'
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
 */
export function bodyPartsFromDesc(s: string): string {
  const t = s.toUpperCase()
  const found: string[] = []

  // Check all patterns
  for (const [name, pattern] of Object.entries(BODY_PART_PATTERNS)) {
    if (pattern.test(t)) {
      found.push(name)
    }
  }

  // ========== SPECIAL HANDLING FOR NUCLEAR MEDICINE ==========
  
  // Thyroid/Parathyroid studies
  if (found.length === 0 && (t.includes('THYROID') || t.includes('PARATHYROID'))) {
    found.push('Head/Neck')
  }

  // DaTscan - brain imaging
  if (found.length === 0 && (t.includes('DATSCAN') || t.includes('DAT SCAN'))) {
    found.push('Head/Neck')
  }

  // Renal scans
  if (found.length === 0 && /\bRENAL|KIDNEY|MAG3\b/i.test(t)) {
    found.push('Renal')
  }

  // Lung scans
  if (found.length === 0 && /\bLUNG|VENT|PERF|V\/Q|VQ\b/i.test(t)) {
    found.push('Chest')
  }

  // Bone scans - whole body
  if (found.length === 0 && /\bBONE SCAN|3 PHASE BONE\b/i.test(t)) {
    found.push('Whole Body')
  }

  // Hepatobiliary/HIDA
  if (found.length === 0 && /\bHEPATOBILIARY|HIDA|LIVER|SPLEEN\b/i.test(t)) {
    if (t.includes('SPLEEN')) {
      found.push('Liver', 'Spleen')
    } else {
      found.push('Liver')
    }
  }

  // Gastric emptying
  if (found.length === 0 && /\bGASTRIC EMPTYING|STOMACH\b/i.test(t)) {
    found.push('Stomach')
  }

  // Barium swallow/esophagus
  if (found.length === 0 && /\bBARIUM SWALLOW|ESOPHAGUS\b/i.test(t)) {
    found.push('Stomach')
  }

  // Sentinel node / lymphoscintigraphy - can be multiple locations
  if (found.length === 0 && /\bSENTINEL NODE|LYMPHOSCINTIGRAPH\b/i.test(t)) {
    found.push('Lymphatic')
  }

  // Bone/Joint limited studies
  if (found.length === 0 && /\bBONE\/JOINT|BONE JOINT\b/i.test(t)) {
    found.push('Musculoskeletal')
  }

  // ========== PET SCAN RANGES ==========
  if (/SKULL.*THIGH|SKULL.*MID|WHOLE BODY/i.test(t) && found.length === 0) {
    found.push('Whole Body')
  }

  // Brain PET
  if (found.length === 0 && t.includes('PET') && (t.includes('BRAIN') || t.includes('DEMENTIA') || t.includes('AMYLOID'))) {
    found.push('Head/Neck')
  }

  // ========== CT FALLBACK ==========
  if (found.length === 0 && t.includes('CT')) {
    const region = regionCT(t)
    if (region !== 'Other') {
      if (region === 'Chest/Abdomen/Pelvis') found.push('Chest', 'Abdomen', 'Pelvis')
      else if (region === 'Abdomen/Pelvis') found.push('Abdomen', 'Pelvis')
      else found.push(region)
    }
  }

  // ========== FINAL FALLBACKS ==========
  if (found.length === 0) {
    if (t.includes('CHEST')) found.push('Chest')
    else if (/\bSCAN\b/.test(t) && (t.includes('WHOLE') || t.includes('BODY'))) found.push('Whole Body')
    else if (t.includes('PORTACATH') || t.includes('ACCESS')) found.push('Vascular')
  }

  // Deduplicate and return
  const unique = [...new Set(found)]
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
