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
  /** Returns true if a study (by its upper-cased description) belongs to this category. */
  match: (descUpper: string) => boolean
}

// Matching is driven by the raw exam description, NOT the app's stored modality
// field — that keeps counts correct even for studies imported before a
// classification fix (and independent of any reprocessing step).

// Modality signals read from the description
const hasCT = (d: string) => /\bCT\b|COMPUTED\s+TOMOGRAPH|CAT\s+SCAN/.test(d)
const hasMR = (d: string) => /\bMRI\b|\bMR\s/.test(d)   // excludes MRA/MRV (no boundary/space match)
const hasUS = (d: string) => /\bUS\b|ULTRASOUND|SONOGR|DOPPLER|DUPLEX/.test(d)
const isAngio = (d: string) => /ANGIOGRAPH|ANGIOGRAM|\bCTA\b|\bMRA\b|\bMRV\b/.test(d)

// Anatomy signals
const ABD_PEL = /\bABD\b|ABDOMEN|PELVI|RENAL|KIDNEY|LIVER|GALLBLAD|PANCREA|SPLEEN|AORTA|RETROPERITON|BLADDER|APPENDI/
const SPINE = /SPINE|LUMBAR|CERVICAL|THORACIC|SACR|MYELOGRAM/
const BRAIN = /BRAIN|\bHEAD\b|PITUITARY|\bIAC\b|ORBIT|SELLA/
const LOWER_EXT_JOINT = /KNEE|ANKLE|\bHIP\b|\bFOOT\b|FEMUR|TIBIA|FIBULA|LOWER EXTREMITY|\bLOWER EXT/
const MRI_BODY = /ABDOMEN|\bABD\b|PELVI|MRCP|ENTEROGRAPH|PROSTATE|KIDNEY|RENAL|LIVER|\bCHEST\b|BREAST|\bBODY\b|RECTUM|ADRENAL/
const IMG_GUIDED_PROC = /BIOPSY|\bBX\b|DRAINAGE|\bDRAIN\b|ASPIRAT|\bFNA\b|THORACENTESIS|PARACENTESIS|LOCALIZATION/
const PLAIN_FILM = /\bXR\b|\d+\s*VIEW|AP OR PA|PA\/LAT|\bKUB\b/

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
    match: d =>
      /\bCHEST\b|\bCXR\b/.test(d) && PLAIN_FILM.test(d) &&
      !hasCT(d) && !hasMR(d) && !hasUS(d) && !/\bPET\b|SPECT|\bNM\b|ANGIO/.test(d),
  },
  {
    id: 'cta-mra',
    name: 'CTA / MRA',
    defaultMinimum: 100,
    description: 'CT- and MR-angiography (incl. spelled-out "angiography"); excludes routine CT with rectal contrast.',
    match: d =>
      /\bCTA\b|\bMRA\b|\bMRV\b/.test(d) || ((hasCT(d) || hasMR(d)) && /ANGIOGRAPH|ANGIOGRAM/.test(d)),
  },
  {
    id: 'mammography',
    name: 'Mammography',
    defaultMinimum: 300,
    description: 'Screening and diagnostic mammography (and mammographic procedures).',
    match: d => /MAMMO|\bTOMO\b/.test(d) && !hasMR(d),
  },
  {
    id: 'ct-abd-pel',
    name: 'CT abd/pel',
    defaultMinimum: 600,
    description: 'CT studies that include the abdomen and/or pelvis (angiograms count under CTA/MRA instead).',
    match: d => hasCT(d) && ABD_PEL.test(d) && !isAngio(d),
  },
  {
    id: 'us-abd-pel',
    name: 'US abd/pel',
    defaultMinimum: 350,
    description: 'Ultrasound (incl. Doppler/duplex) of the abdomen and/or pelvis.',
    match: d => hasUS(d) && ABD_PEL.test(d),
  },
  {
    id: 'img-guided-bx-drainage',
    name: 'Image guided bx/drainage',
    defaultMinimum: 25,
    description: 'Image-guided biopsy, aspiration, drainage, para-/thoracentesis, or localization.',
    match: d => IMG_GUIDED_PROC.test(d),
  },
  {
    id: 'mri-lower-ext-joints',
    name: 'MRI lower extremity joints',
    defaultMinimum: 20,
    description: 'MRI of knee, hip, ankle, foot, or other lower-extremity joints (excludes shoulders).',
    match: d => hasMR(d) && !isAngio(d) && LOWER_EXT_JOINT.test(d),
  },
  {
    id: 'mri-brain',
    name: 'MRI brain',
    defaultMinimum: 110,
    description: 'MRI of the brain/head (excludes spine).',
    match: d => hasMR(d) && !isAngio(d) && BRAIN.test(d) && !SPINE.test(d),
  },
  {
    id: 'pet',
    name: 'PET',
    defaultMinimum: 30,
    description: 'PET and PET/CT studies.',
    match: d => /\bPET\b|POSITRON/.test(d),
  },
  {
    id: 'mri-body',
    name: 'MRI body',
    defaultMinimum: 20,
    description: 'MRI of the torso/body (abdomen, pelvis, chest, MRCP, prostate, etc.).',
    match: d => hasMR(d) && !isAngio(d) && MRI_BODY.test(d) && !SPINE.test(d) && !LOWER_EXT_JOINT.test(d),
  },
  {
    id: 'mri-spine',
    name: 'MRI spine',
    defaultMinimum: 60,
    description: 'MRI of the cervical, thoracic, or lumbar spine.',
    match: d => hasMR(d) && !isAngio(d) && SPINE.test(d),
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
    const d = (rec.examDescription || '').toUpperCase()
    for (const result of results) {
      if (result.category.match(d)) {
        result.count++
        result.matched.push(rec)
      }
    }
  }
  return results
}
