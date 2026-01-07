/**
 * Systematic Mapping-Based Classification System
 * 
 * This file contains all classification rules organized by:
 * 1. Priority order (higher priority rules checked first)
 * 2. Modality classification rules
 * 3. Body part classification rules
 * 4. Special handling rules
 * 
 * Rules are applied in order until a match is found.
 */

export interface ClassificationRule {
  /** Priority: lower number = higher priority (checked first) */
  priority: number
  /** Pattern to match (can be string, regex, or function) */
  pattern: string | RegExp | ((text: string) => boolean)
  /** Resulting classification */
  result: string
  /** Optional: conditions that must also be met */
  conditions?: {
    mustInclude?: string[]
    mustNotInclude?: string[]
  }
  /** Optional: description for documentation */
  description?: string
}

/**
 * MODALITY CLASSIFICATION RULES
 * Applied in priority order (lower priority number = checked first)
 */
export const MODALITY_RULES: ClassificationRule[] = [
  // ========== NUCLEAR MEDICINE (Highest Priority) ==========
  {
    priority: 1,
    pattern: /^NM\s| NM\s/i,
    result: 'Nuclear Medicine',
    description: 'NM prefix (e.g., "NM Bone/Joint", "NM Gastric")'
  },
  {
    priority: 2,
    pattern: /SPECT/i,
    result: 'Nuclear Medicine',
    description: 'SPECT studies (including SPECT/CT)'
  },
  {
    priority: 3,
    pattern: /(DATSCAN|DAT\s+SCAN)/i,
    result: 'Nuclear Medicine',
    description: 'DaTscan (dopamine transporter scan)'
  },
  {
    priority: 4,
    pattern: (text: string) => {
      const hasThyroid = /(THYROID|PARATHYROID)/i.test(text)
      const hasNuclear = /(I-123|I123|I-131|I131|UPTAKE|SCAN)/i.test(text)
      const hasUS = /(ULTRASOUND|US\s)/i.test(text)
      return hasThyroid && hasNuclear && !hasUS
    },
    result: 'Nuclear Medicine',
    description: 'Thyroid/Parathyroid nuclear studies (exclude US)'
  },
  {
    priority: 5,
    pattern: /(HIDA|HEPATOBILIARY.*IMAGING)/i,
    result: 'Nuclear Medicine',
    description: 'HIDA / Hepatobiliary scans'
  },
  {
    priority: 6,
    pattern: /(BONE\s+SCAN|3\s+PHASE\s+BONE)/i,
    result: 'Nuclear Medicine',
    description: 'Bone scans (including 3-phase)'
  },
  {
    priority: 7,
    pattern: /GASTRIC\s+EMPTY(ING)?/i,
    result: 'Nuclear Medicine',
    description: 'Gastric emptying studies'
  },
  {
    priority: 8,
    pattern: /(LIVER\s+AND\s+SPLEEN\s+IMAGING|LIVER\s+SPLEEN)/i,
    result: 'Nuclear Medicine',
    description: 'Liver/spleen nuclear imaging'
  },
  {
    priority: 9,
    pattern: /(LYMPHOSCINTIGRAPH|SENTINEL\s+NODE)/i,
    result: 'Nuclear Medicine',
    description: 'Lymphoscintigraphy / Sentinel node'
  },
  {
    priority: 10,
    pattern: /(PLUVICTO|THYROGEN.*INJECTION)/i,
    result: 'Nuclear Medicine',
    description: 'Nuclear Medicine treatments (PLUVICTO, THYROGEN)'
  },
  {
    priority: 11,
    pattern: /4D\s*CT/i,
    result: 'Nuclear Medicine',
    description: '4D CT (technically nuclear medicine)'
  },
  {
    priority: 12,
    pattern: /(RENAL\s+SCAN|MAG3|LASIX\s+RENAL|LUNG\s+VENT|PERF\s+SCAN|VQ\s+SCAN|V\/Q|GALLIUM|TAGGED\s+RBC|BLEEDING\s+SCAN|MECKEL|OCTREOTIDE|MIBG)/i,
    result: 'Nuclear Medicine',
    description: 'Other specific NM terms'
  },

  // ========== PET/CT ==========
  {
    priority: 20,
    pattern: /PET\/CT|PET\s+CT|PET-CT|PET\s+-/i,
    result: 'PET/CT',
    description: 'Explicit PET/CT patterns'
  },
  {
    priority: 21,
    pattern: (text: string) => {
      return /PET/i.test(text) && /(CONCURRENT\s+CT|W\/\s+CT|WITH\s+CT)/i.test(text)
    },
    result: 'PET/CT',
    description: 'PET with concurrent CT'
  },
  {
    priority: 22,
    pattern: (text: string) => {
      return /PET/i.test(text) && /TUMOR\s+IMAGING/i.test(text)
    },
    result: 'PET/CT',
    description: 'PET tumor imaging'
  },
  {
    priority: 23,
    pattern: /(PET|POSITRON)/i,
    result: 'PET/CT',
    description: 'PET alone (defaults to PET/CT)'
  },

  // ========== MRI VARIATIONS ==========
  {
    priority: 30,
    pattern: /MRA/i,
    result: 'MRA',
    description: 'MR Angiography'
  },
  {
    priority: 31,
    pattern: /MRV/i,
    result: 'MRV',
    description: 'MR Venography'
  },
  {
    priority: 32,
    pattern: /(MRI|MR\s|\bMR\b)/i,
    result: 'MRI',
    description: 'MRI / MR'
  },

  // ========== FLUOROSCOPY (Before CT/US) ==========
  {
    priority: 40,
    pattern: (text: string) => {
      return /FL\s/i.test(text) && /LUMBAR\s+PUNCTURE/i.test(text)
    },
    result: 'Fluoroscopy',
    description: 'FL Lumbar Puncture (not CT)'
  },
  {
    priority: 41,
    pattern: (text: string) => {
      return /FL\s/i.test(text) && /(ESOPHAG|SWALLOW)/i.test(text)
    },
    result: 'Fluoroscopy',
    description: 'FL Esophagus/Esophagram (not US)'
  },
  {
    priority: 42,
    pattern: (text: string) => {
      return /FL\s/i.test(text) && /(ACCESS|PORTACATH)/i.test(text)
    },
    result: 'Fluoroscopy',
    description: 'FL Access Portacath (not CT)'
  },
  {
    priority: 43,
    pattern: /(FL\s|FLUORO|BARIUM|SWALLOW)/i,
    result: 'Fluoroscopy',
    description: 'General fluoroscopy patterns'
  },

  // ========== CT VARIATIONS ==========
  {
    priority: 50,
    pattern: (text: string) => {
      return /CT/i.test(text) && /RECTAL/i.test(text) && /CONTRAST/i.test(text)
    },
    result: 'CT',
    description: 'CT with rectal contrast (NOT CTA)',
    conditions: {
      mustNotInclude: ['CTA']
    }
  },
  {
    priority: 51,
    pattern: /CTA/i,
    result: 'CTA',
    description: 'CT Angiography'
  },
  {
    priority: 52,
    pattern: /(CT\s|CT$|COMPUTED|CAT\s+SCAN)/i,
    result: 'CT',
    description: 'General CT'
  },

  // ========== ULTRASOUND ==========
  {
    priority: 60,
    pattern: /(DUPLEX|DUP\s)/i,
    result: 'US - Duplex',
    description: 'Duplex ultrasound'
  },
  {
    priority: 61,
    pattern: /(OBSTETRICAL|PREGNANCY|OB\s)/i,
    result: 'US - Obstetrical',
    description: 'Obstetrical ultrasound'
  },
  {
    priority: 62,
    pattern: /(PROCEDURE|GUIDED)/i,
    result: 'US Procedure',
    description: 'US-guided procedures',
    conditions: {
      mustInclude: ['US', 'ULTRASOUND']
    }
  },
  {
    priority: 63,
    pattern: /(US\s|ULTRASOUND|SONOGRAM|SONO\s)/i,
    result: 'US',
    description: 'General ultrasound'
  },

  // ========== MAMMOGRAPHY ==========
  {
    priority: 70,
    pattern: /(PROCEDURE|BIOPSY|STEREO)/i,
    result: 'Mammography Procedure',
    description: 'Mammography procedures',
    conditions: {
      mustInclude: ['MAMMO', 'BREAST']
    }
  },
  {
    priority: 71,
    pattern: /(MAMMO|BREAST\s+IMAGING)/i,
    result: 'Mammography',
    description: 'Mammography',
    conditions: {
      mustNotInclude: ['MRI']
    }
  },

  // ========== ECHOCARDIOGRAPHY ==========
  {
    priority: 80,
    pattern: (text: string) => {
      return /ECHO/i.test(text) && /(CARDIO|HEART)/i.test(text)
    },
    result: 'Echocardiography',
    description: 'Echocardiography'
  },

  // ========== RADIOGRAPHY ==========
  {
    priority: 90,
    pattern: /(XR\s|X-?RAY|RADIOGRAPH)/i,
    result: 'Radiography',
    description: 'Explicit X-ray terms'
  },
  {
    priority: 91,
    pattern: (text: string) => {
      const hasViews = /\d+\s*VIEWS?/i.test(text) || /(AP|PA).*(LAT|LATERAL)/i.test(text)
      const hasBodyPart = /(CHEST|ABDOMEN|KNEE|HAND|FOOT|SHOULDER|ELBOW|ANKLE|WRIST|HIP|FEMUR|TIBIA|HUMERUS|FINGER|TOE|SPINE|PELVIS|CLAVICLE|RIBS|SINUS|TEMPORAL|FACIAL|ORBITS|SKULL|SACRUM|COCCYX|LUMBOSACRAL|KNEES)/i.test(text)
      const noOtherModality = !/(CT|MRI|US|ULTRASOUND|FLUORO|PET|SPECT|NM\s)/i.test(text)
      return hasViews && hasBodyPart && noOtherModality
    },
    result: 'Radiography',
    description: 'Implicit X-ray patterns (views + body part)'
  },
  {
    priority: 92,
    pattern: (text: string) => {
      const hasBilateral = /BILATERAL/i.test(text)
      const hasExtremity = /(KNEE|KNEES|HIP|HIPS)/i.test(text)
      const noOtherModality = !/(CT|MRI|US|ULTRASOUND|FLUORO|PET|SPECT|NM\s)/i.test(text)
      return hasBilateral && hasExtremity && noOtherModality
    },
    result: 'Radiography',
    description: 'Bilateral extremity studies (usually X-ray)'
  },
  {
    priority: 93,
    pattern: (text: string) => {
      const hasStanding = /STANDING/i.test(text)
      const hasExtremity = /(KNEE|HIP|SPINE)/i.test(text)
      const noOtherModality = !/(CT|MRI|US|ULTRASOUND|FLUORO|PET|SPECT|NM\s)/i.test(text)
      return hasStanding && hasExtremity && noOtherModality
    },
    result: 'Radiography',
    description: 'Standing studies (usually X-ray)'
  },
  {
    priority: 94,
    pattern: /(FLEX\s+AND\s+EXT|BENDING\s+VIEWS)/i,
    result: 'Radiography',
    description: 'Flexion/extension views (X-ray)',
    conditions: {
      mustNotInclude: ['CT', 'MRI', 'US']
    }
  },

  // ========== INVASIVE PROCEDURES ==========
  {
    priority: 100,
    pattern: /(INVASIVE|BIOPSY|DRAINAGE|ASPIRATION|INJECTION\s+PROC)/i,
    result: 'Invasive',
    description: 'Invasive procedures'
  },

  // ========== CATCH-ALL ==========
  {
    priority: 999,
    pattern: /./,
    result: 'Other',
    description: 'Default fallback'
  }
]

/**
 * BODY PART CLASSIFICATION RULES
 * Applied in priority order
 */
export const BODY_PART_RULES: ClassificationRule[] = [
  // ========== SPECIAL HANDLING (Highest Priority) ==========
  {
    priority: 1,
    pattern: /(SENTINEL\s+NODE|LYMPHOSCINTIGRAPH)/i,
    result: 'Lymphatic',
    description: 'Lymphoscintigraphy / Sentinel node (NOT Whole Body)'
  },
  {
    priority: 2,
    pattern: (text: string) => {
      return /(THYROID|PARATHYROID)/i.test(text) && !/(ULTRASOUND|US\s)/i.test(text)
    },
    result: 'Head/Neck',
    description: 'Thyroid/Parathyroid (nuclear, not US)'
  },
  {
    priority: 3,
    pattern: /(DATSCAN|DAT\s+SCAN)/i,
    result: 'Head/Neck',
    description: 'DaTscan (brain imaging)'
  },
  {
    priority: 4,
    pattern: /(RENAL|KIDNEY|MAG3)/i,
    result: 'Renal',
    description: 'Renal scans'
  },
  {
    priority: 5,
    pattern: /(LUNG|VENT|PERF|V\/Q|VQ)/i,
    result: 'Chest',
    description: 'Lung scans'
  },
  {
    priority: 6,
    pattern: /(BONE\s+SCAN|3\s+PHASE\s+BONE)/i,
    result: 'Whole Body',
    description: 'Bone scans (whole body)'
  },
  {
    priority: 7,
    pattern: (text: string) => {
      if (/(HEPATOBILIARY|HIDA|LIVER|SPLEEN)/i.test(text)) {
        return /SPLEEN/i.test(text)
      }
      return false
    },
    result: 'Liver, Spleen',
    description: 'Hepatobiliary with spleen'
  },
  {
    priority: 8,
    pattern: /(HEPATOBILIARY|HIDA|LIVER)/i,
    result: 'Liver',
    description: 'Hepatobiliary/HIDA'
  },
  {
    priority: 9,
    pattern: /(GASTRIC\s+EMPTYING|STOMACH)/i,
    result: 'Stomach',
    description: 'Gastric emptying'
  },
  {
    priority: 10,
    pattern: /(BARIUM\s+SWALLOW|ESOPHAGUS)/i,
    result: 'Stomach',
    description: 'Barium swallow/esophagus'
  },
  {
    priority: 11,
    pattern: /(BONE\/JOINT|BONE\s+JOINT)/i,
    result: 'Musculoskeletal',
    description: 'Bone/Joint limited studies'
  },

  // ========== STANDARD BODY PARTS ==========
  // IMPORTANT: SKULL BASE - MID THIGH must be checked BEFORE general SKULL BASE
  {
    priority: 19,
    pattern: /(SKULL\s+BASE.*(MID\s+)?THIGH|SKULL\s+BASE\s*-\s*MID\s+THIGH)/i,
    result: 'Whole Body',
    description: 'SKULL BASE - MID THIGH → Whole Body (must come before Head/Neck rule)',
    conditions: {
      mustNotInclude: ['LYMPHOSCINTIGRAPH']
    }
  },
  {
    priority: 20,
    pattern: /(HEAD|NECK|BRAIN|SKULL|ORBITS|FACIAL|SINUS|TEMPORAL|PITUITARY|CRANIAL|SKULL\s+BASE|THYROID|PARATHYROID|DATSCAN|MAXILLOFACIAL)/i,
    result: 'Head/Neck',
    description: 'Head/Neck anatomy (excludes SKULL BASE - MID THIGH which is whole body)',
    conditions: {
      mustNotInclude: ['SKULL BASE.*THIGH', 'SKULL BASE.*MID THIGH']
    }
  },
  {
    priority: 21,
    pattern: /(CHEST|LUNG|THORAX|PULMONARY)/i,
    result: 'Chest',
    description: 'Chest anatomy'
  },
  {
    priority: 22,
    pattern: /(ABDOMEN|ABDOMINAL)/i,
    result: 'Abdomen',
    description: 'Abdomen'
  },
  {
    priority: 23,
    pattern: /(PELVIS|PELVIC)/i,
    result: 'Pelvis',
    description: 'Pelvis'
  },
  {
    priority: 24,
    pattern: /(SPINE|LUMBOSACRAL|L\s+SPINE|T\s+SPINE|C\s+SPINE|CERVICAL|THORACIC|LUMBAR|SACRUM|COCCYX)/i,
    result: 'Spine',
    description: 'Spine anatomy'
  },
  {
    priority: 25,
    pattern: /(SHOULDER|ELBOW|WRIST|HAND|FINGER|HUMERUS|FOREARM|CLAVICLE|ARM)/i,
    result: 'Upper Extremity',
    description: 'Upper extremity anatomy'
  },
  {
    priority: 26,
    pattern: /(HIP|KNEE|ANKLE|FOOT|TOE|FEMUR|TIBIA|FIBULA|THIGH|LEG)/i,
    result: 'Lower Extremity',
    description: 'Lower extremity anatomy'
  },
  {
    priority: 27,
    pattern: /(BREAST|MAMMO)/i,
    result: 'Breast',
    description: 'Breast'
  },
  {
    priority: 28,
    pattern: /(CARDIAC|HEART|ECHO)/i,
    result: 'Cardiac',
    description: 'Cardiac'
  },
  {
    priority: 29,
    pattern: /(CAROTID|ARTERIAL|VENOUS|VEIN|ARTERY)/i,
    result: 'Vascular',
    description: 'Vascular'
  },
  {
    priority: 30,
    pattern: /(WHOLE\s+BODY|TUMOR\s+IMAGING|SKULL\s+BASE.*THIGH|3\s+PHASE\s+BONE)/i,
    result: 'Whole Body',
    description: 'Whole body studies',
    conditions: {
      mustNotInclude: ['LYMPHOSCINTIGRAPH']
    }
  },

  // ========== SPECIAL CASES ==========
  {
    priority: 35,
    pattern: /(SKULL\s+BASE.*(MID\s+)?THIGH|SKULL\s+BASE\s*-\s*MID\s+THIGH)/i,
    result: 'Whole Body',
    description: 'SKULL BASE - MID THIGH → Whole Body (not Head/Neck)',
    conditions: {
      mustNotInclude: ['LYMPHOSCINTIGRAPH']
    }
  },
  {
    priority: 36,
    pattern: (text: string) => {
      // PET tumor imaging with SKULL BASE - MID THIGH should be Whole Body
      return /PET/i.test(text) && /TUMOR\s+IMAGING/i.test(text) && /(SKULL\s+BASE.*THIGH|SKULL\s+BASE\s*-\s*MID\s+THIGH)/i.test(text)
    },
    result: 'Whole Body',
    description: 'PET tumor imaging SKULL BASE - MID THIGH → Whole Body'
  },
  {
    priority: 40,
    pattern: (text: string) => {
      return /BILATERAL/i.test(text) && /(KNEE|KNEES)/i.test(text)
    },
    result: 'Lower Extremity',
    description: 'Bilateral knees → Lower Extremity'
  },
  {
    priority: 41,
    pattern: (text: string) => {
      // Brain PET → Head/Neck (but exclude SKULL BASE - MID THIGH which is whole body)
      return /PET/i.test(text) && /(BRAIN|DEMENTIA|AMYLOID)/i.test(text) && !/(SKULL\s+BASE.*THIGH|SKULL\s+BASE\s*-\s*MID\s+THIGH)/i.test(text)
    },
    result: 'Head/Neck',
    description: 'Brain PET → Head/Neck (exclude whole body scans)'
  },
  {
    priority: 42,
    pattern: (text: string) => {
      return /PET/i.test(text) && /(LOWER\s+EXTREMITY|LEG|THIGH)/i.test(text)
    },
    result: 'Lower Extremity',
    description: 'PET/CT for lower extremity'
  },
  {
    priority: 43,
    pattern: /PET/i,
    result: 'Whole Body',
    description: 'PET/CT default (whole body tumor imaging)'
  },
  {
    priority: 44,
    pattern: (text: string) => {
      if (/CT/i.test(text)) {
        if (/(CHEST|ABDOMEN|PELVIS)/i.test(text)) {
          return true // Will be handled by regionCT function in dataProcessing
        }
        if (/(HEAD|BRAIN|NECK|SPINE|LUMBAR|CERVICAL|THORACIC)/i.test(text)) {
          return true
        }
      }
      return false
    },
    result: 'CT Region',
    description: 'CT body region detection (processed separately)'
  },

  // ========== FALLBACKS ==========
  {
    priority: 50,
    pattern: /CHEST/i,
    result: 'Chest',
    description: 'Chest fallback'
  },
  {
    priority: 51,
    pattern: /(SCAN.*WHOLE|SCAN.*BODY)/i,
    result: 'Whole Body',
    description: 'Whole body scan fallback',
    conditions: {
      mustNotInclude: ['LYMPHOSCINTIGRAPH']
    }
  },
  {
    priority: 52,
    pattern: /(PORTACATH|ACCESS)/i,
    result: 'Vascular',
    description: 'Portacath/Access → Vascular'
  },

  // ========== DEFAULT ==========
  {
    priority: 999,
    pattern: /./,
    result: 'Unknown',
    description: 'Default fallback'
  }
]

/**
 * POST-PROCESSING RULES
 * Applied after initial classification to merge/clean up results
 */
export const POST_PROCESSING_RULES: Array<{
  condition: (modality: string, bodyPart: string, originalText: string) => boolean
  action: (modality: string, bodyPart: string) => { modality: string; bodyPart: string }
  description: string
}> = [
  {
    condition: (_mod, bp) => bp.includes('Head/Neck') && bp.includes('Vascular'),
    action: (_mod, bp) => ({
      modality: _mod,
      bodyPart: bp.replace(/,\s*Vascular|Vascular,\s*/g, '').trim()
    }),
    description: 'Merge Head/Neck + Vascular → Head/Neck'
  },
  {
    condition: (mod, bp, text) => mod === 'Nuclear Medicine' && bp === 'Whole Body' && /LYMPHOSCINTIGRAPH/i.test(text),
    action: (_mod, _bp) => ({
      modality: _mod,
      bodyPart: 'Lymphatic'
    }),
    description: 'NM Lymphoscintigraphy → Lymphatic (not Whole Body)'
  }
]

/**
 * Apply classification rules to text
 */
export function applyClassificationRules(
  text: string,
  rules: ClassificationRule[]
): string {
  const upperText = text.toUpperCase()
  
  for (const rule of rules.sort((a, b) => a.priority - b.priority)) {
    let matches = false
    
    // Check pattern
    if (typeof rule.pattern === 'string') {
      matches = new RegExp(rule.pattern, 'i').test(upperText)
    } else if (rule.pattern instanceof RegExp) {
      matches = rule.pattern.test(upperText)
    } else if (typeof rule.pattern === 'function') {
      matches = rule.pattern(upperText)
    }
    
    if (!matches) continue
    
    // Check conditions
    if (rule.conditions) {
      if (rule.conditions.mustInclude) {
        const allPresent = rule.conditions.mustInclude.every(term =>
          new RegExp(term, 'i').test(upperText)
        )
        if (!allPresent) continue
      }
      
      if (rule.conditions.mustNotInclude) {
        const anyPresent = rule.conditions.mustNotInclude.some(term =>
          new RegExp(term, 'i').test(upperText)
        )
        if (anyPresent) continue
      }
    }
    
    return rule.result
  }
  
  return 'Unknown'
}

