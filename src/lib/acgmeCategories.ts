// ACGME / program case-log categories.
//
// Each category independently re-counts a resident's uploaded studies using a
// matcher over the raw exam description + the app's own modality classification.
// This lets a resident cross-check the app's count against the number their
// program's case-log system reports and against the required minimum.
//
// Matchers run against the ORIGINAL exam description (upper-cased) plus the
// derived `modality`, which is the most reliable signal. Categories may overlap
// (e.g. a single MRI can count toward more than one MRI category) — that mirrors
// how case-log systems tally, and each category is counted independently.
//
// `defaultMinimum` values are seeded from the program report provided by the
// resident. Both minimums and the "reported" comparison numbers are editable in
// the UI and persisted per-browser, so other programs can adjust them.

import { RVURecord } from './dataProcessing'
import { StudyAttributes, classifyStudy } from './classify'

// The 11 categories and minimums below are confirmed verbatim against the ACGME
// Review Committee for Radiology "Case Log Categories and Required Minimum Numbers"
// (10 aggregate-logged imaging categories + 1 individually-logged procedure).
// Minimums are revised periodically — re-check the source PDF before relying on them.
export const ACGME_CASELOG_SOURCE = {
  label: 'ACGME — Diagnostic Radiology Case Log Categories & Required Minimum Numbers',
  url: 'https://www.acgme.org/globalassets/pfassets/programresources/dr_case_log_categories.pdf',
  revision: '3/2026',
}

// Supplementary ACGME/MQSA guideline numbers (from the DR Program Requirements FAQ)
// that are NOT aggregate case-log categories but are worth surfacing to residents.
export const ACGME_SUPPLEMENTARY = [
  { label: 'Ultrasound — supervised hands-on scans', detail: 'Guideline: 75 hands-on + 150 interpreted exams before graduation', source: 'ACGME DR FAQ (PR 4.5.c)' },
  { label: 'Mammography — MQSA interpretation', detail: 'MQSA: ≥240 mammographic exams in a 6-month period during the last 2 years; Review Committee recommends 300 by graduation', source: 'ACGME DR FAQ (PR 4.11.n)' },
]

export interface AcgmeCategory {
  id: string
  name: string
  /** Required minimum from the program report (editable in UI). */
  defaultMinimum: number
  /** Short explanation of what the app counts for this category. */
  description: string
  /** Returns true if a study (by its structured attributes) belongs to this category. */
  match: (a: StudyAttributes) => boolean
}

// Matching is driven by the study's structured attributes — reliable now that the
// modality classifier is fixed — with fine anatomy read from `a.raw` (the RadLex
// "anatomic focus" tier). Because `modality` is trustworthy, e.g. a CT angiogram
// (modality CTA) is no longer double-counted as a routine CT abd/pel.

// Fine-anatomy signals (RadLex anatomic-focus tier), read from the raw description.
const ABD_PEL = /\bABD\b|ABDOMEN|PELVI|\bPEL\b|RENAL|KIDNEY|LIVER|GALLBLAD|PANCREA|SPLEEN|AORTA|RETROPERITON|BLADDER|APPENDI/
const SPINE = /SPINE|LUMBAR|CERVICAL|THORACIC|SACR|MYELOGRAM/
const BRAIN = /BRAIN|\bHEAD\b|PITUITARY|\bIAC\b|ORBIT|SELLA/
const LOWER_EXT_JOINT = /KNEE|ANKLE|\bHIP\b|\bFOOT\b|FEMUR|TIBIA|FIBULA|LOWER EXTREMITY|\bLOWER EXT/
const MRI_BODY = /ABDOMEN|\bABD\b|PELVI|MRCP|ENTEROGRAPH|PROSTATE|KIDNEY|RENAL|LIVER|\bCHEST\b|BREAST|\bBODY\b|RECTUM|ADRENAL/

const isMRI = (a: StudyAttributes) => a.modality === 'MRI'
const isCT = (a: StudyAttributes) => a.modality === 'CT'
const isUS = (a: StudyAttributes) => a.modality.startsWith('US')

/**
 * The tracked ACGME categories that carry a minimum requirement.
 * (Procedure categories in the source report with a minimum of 0 are omitted
 * from the minimums tracker; they can be added here later if needed.)
 */
export const ACGME_CATEGORIES: AcgmeCategory[] = [
  {
    id: 'chest-xray',
    name: 'Chest x-ray',
    defaultMinimum: 1900,
    description: 'Plain radiographs of the chest (CXR) — excludes CT/US/MR of the chest.',
    match: a => a.modality === 'Radiography' && a.regions.includes('Chest'),
  },
  {
    id: 'cta-mra',
    name: 'CTA / MRA',
    defaultMinimum: 100,
    description: 'CT- and MR-angiography (incl. spelled-out "angiography"); excludes routine CT with rectal contrast.',
    match: a => a.subtype === 'angio' || a.subtype === 'venography',
  },
  {
    id: 'mammography',
    name: 'Mammography',
    defaultMinimum: 300,
    description: 'Screening and diagnostic mammography (and mammographic procedures).',
    match: a => a.modality.startsWith('Mammography'),
  },
  {
    id: 'ct-abd-pel',
    name: 'CT abd/pel',
    defaultMinimum: 600,
    description: 'CT studies that include the abdomen and/or pelvis (angiograms count under CTA/MRA instead).',
    match: a => isCT(a) && ABD_PEL.test(a.raw),
  },
  {
    id: 'us-abd-pel',
    name: 'US abd/pel',
    defaultMinimum: 350,
    description: 'Ultrasound (incl. Doppler/duplex) of the abdomen and/or pelvis.',
    match: a => isUS(a) && ABD_PEL.test(a.raw),
  },
  {
    id: 'img-guided-bx-drainage',
    name: 'Image guided bx/drainage',
    defaultMinimum: 25,
    description: 'Image-guided biopsy, aspiration, drainage, para-/thoracentesis, or localization.',
    match: a => a.procedure !== undefined,
  },
  {
    id: 'mri-lower-ext-joints',
    name: 'MRI lower extremity joints',
    defaultMinimum: 20,
    description: 'MRI of knee, hip, ankle, foot, or other lower-extremity joints (excludes shoulders).',
    match: a => isMRI(a) && LOWER_EXT_JOINT.test(a.raw),
  },
  {
    id: 'mri-brain',
    name: 'MRI brain',
    defaultMinimum: 110,
    description: 'MRI of the brain/head (excludes spine).',
    match: a => isMRI(a) && BRAIN.test(a.raw) && !SPINE.test(a.raw),
  },
  {
    id: 'pet',
    name: 'PET',
    defaultMinimum: 30,
    description: 'PET and PET/CT studies.',
    match: a => a.modality.includes('PET'),
  },
  {
    id: 'mri-body',
    name: 'MRI body',
    defaultMinimum: 20,
    description: 'MRI of the torso/body (abdomen, pelvis, chest, MRCP, prostate, etc.).',
    match: a => isMRI(a) && MRI_BODY.test(a.raw) && !SPINE.test(a.raw) && !LOWER_EXT_JOINT.test(a.raw),
  },
  {
    id: 'mri-spine',
    name: 'MRI spine',
    defaultMinimum: 60,
    description: 'MRI of the cervical, thoracic, or lumbar spine.',
    match: a => isMRI(a) && SPINE.test(a.raw),
  },
]

export interface AcgmeCount {
  category: AcgmeCategory
  count: number
  matched: RVURecord[]
}

/** Counts records into each ACGME category. A record may count in several categories. */
export function countAcgmeCategories(records: RVURecord[]): AcgmeCount[] {
  const results: AcgmeCount[] = ACGME_CATEGORIES.map(category => ({ category, count: 0, matched: [] }))
  for (const rec of records) {
    const attrs = classifyStudy(rec.examDescription)
    for (const result of results) {
      if (result.category.match(attrs)) {
        result.count++
        result.matched.push(rec)
      }
    }
  }
  return results
}
