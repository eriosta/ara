// ============================================================================
// MOCK DATA - FOR LOCAL DEVELOPMENT ONLY
// ============================================================================
// This file provides mock data for testing without a Supabase connection.
// It is ONLY activated when VITE_DEV_MODE=true in your local .env.local file.
// 
// IMPORTANT: Never set VITE_DEV_MODE=true in production environments!
// ============================================================================

// DEV_MODE is only true when explicitly set AND not in production
const isProduction = import.meta.env.PROD
const devModeRequested = import.meta.env.VITE_DEV_MODE === 'true'

export const DEV_MODE = !isProduction && devModeRequested

// Log warning if DEV_MODE is active
if (DEV_MODE) {
  console.warn('⚠️ DEV MODE ACTIVE - Using mock data instead of Supabase')
  console.warn('⚠️ This should NEVER appear in production!')
}

// Safety check - if somehow DEV_MODE is true in production, log error
if (isProduction && devModeRequested) {
  console.error('🚨 SECURITY: DEV_MODE was requested in production - IGNORING')
}

export const mockUser = {
  id: 'dev-user-123',
  email: 'dev@myrvu.local',
  app_metadata: {},
  user_metadata: { full_name: 'Dr. Dev User' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as any

export const mockProfile = {
  id: 'dev-user-123',
  email: 'dev@myrvu.local',
  full_name: 'Dr. Dev User',
  goal_rvu_per_day: 15,
  data_sharing_consent: true,
}

// Generate realistic mock RVU records for testing
export function generateMockRecords(): any[] {
  // Return empty if not in DEV_MODE (extra safety)
  if (!DEV_MODE) {
    console.error('generateMockRecords called outside DEV_MODE')
    return []
  }

  const modalities = [
    { name: 'CT', bodyParts: ['Head', 'Chest', 'Abdomen', 'Pelvis', 'Spine'], examTypes: ['Diagnostic', 'Follow-up'], rvuRange: [1.5, 4.5] },
    { name: 'MRI', bodyParts: ['Brain', 'Spine', 'Knee', 'Shoulder', 'Abdomen'], examTypes: ['Diagnostic', 'Follow-up'], rvuRange: [2.0, 6.0] },
    { name: 'X-ray', bodyParts: ['Chest', 'Hand', 'Foot', 'Spine', 'Pelvis'], examTypes: ['Diagnostic', 'Screening'], rvuRange: [0.2, 1.0] },
    { name: 'Ultrasound', bodyParts: ['Abdomen', 'Pelvis', 'Thyroid', 'Breast'], examTypes: ['Diagnostic', 'Follow-up'], rvuRange: [0.8, 2.5] },
    { name: 'Nuclear Medicine', bodyParts: ['Whole Body', 'Thyroid', 'Cardiac', 'Bone'], examTypes: ['Diagnostic', 'Staging'], rvuRange: [2.0, 5.0] },
    { name: 'PET/CT', bodyParts: ['Whole Body', 'Brain', 'Cardiac'], examTypes: ['Oncology', 'Staging'], rvuRange: [4.0, 8.0] },
  ]

  const records: any[] = []
  const now = new Date()
  
  // Generate 30 days of data
  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    const date = new Date(now)
    date.setDate(date.getDate() - dayOffset)
    
    // Skip weekends occasionally
    if (date.getDay() === 0 || date.getDay() === 6) {
      if (Math.random() > 0.3) continue
    }
    
    // Generate 15-35 cases per day
    const casesPerDay = Math.floor(Math.random() * 20) + 15
    
    for (let i = 0; i < casesPerDay; i++) {
      // Random time between 7am and 6pm
      const hour = Math.floor(Math.random() * 11) + 7
      const minute = Math.floor(Math.random() * 60)
      const caseDate = new Date(date)
      caseDate.setHours(hour, minute, 0, 0)
      
      // Pick random modality (weighted towards CT/MRI)
      const rand = Math.random()
      let modality
      if (rand < 0.35) modality = modalities[0] // CT
      else if (rand < 0.6) modality = modalities[1] // MRI
      else if (rand < 0.75) modality = modalities[2] // X-ray
      else if (rand < 0.88) modality = modalities[3] // Ultrasound
      else if (rand < 0.95) modality = modalities[4] // Nuclear Medicine
      else modality = modalities[5] // PET/CT
      
      const bodyPart = modality.bodyParts[Math.floor(Math.random() * modality.bodyParts.length)]
      const examType = modality.examTypes[Math.floor(Math.random() * modality.examTypes.length)]
      const rvu = modality.rvuRange[0] + Math.random() * (modality.rvuRange[1] - modality.rvuRange[0])
      
      records.push({
        id: `mock-${dayOffset}-${i}`,
        dictation_datetime: caseDate.toISOString(),
        exam_description: `${modality.name} ${bodyPart} ${examType}`,
        wrvu_estimate: Number(rvu.toFixed(2)),
        modality: modality.name,
        exam_type: examType,
        body_part: bodyPart,
      })
    }
  }
  
  return records.sort((a, b) => 
    new Date(a.dictation_datetime).getTime() - new Date(b.dictation_datetime).getTime()
  )
}
