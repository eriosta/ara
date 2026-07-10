// Attribute-based classification (RadLex/LOINC Playbook model).
//
// Instead of emitting a single modality + body-part string, classifyStudy()
// decomposes an exam description into structured attributes — modality (+subtype),
// coarse region(s), fine anatomic focus, contrast, laterality, procedure/guidance,
// and a confidence flag. Display labels and ACGME case-log categories are then
// derived from these attributes rather than from a second pass over raw text.
//
// Modality/body-part detection reuses the proven, tested rules in
// classificationMaps.ts (via dataProcessing) so this layer adds structure without
// regressing those outputs. See taxonomy.ts for the controlled vocabularies.

import { modalityFromDesc, bodyPartsFromDesc } from './dataProcessing'
import { coarseRegion, BodyRegion } from './taxonomy'

export type Contrast = 'with' | 'without' | 'with-and-without'
export type Laterality = 'left' | 'right' | 'bilateral'
export type Guidance = 'US' | 'CT' | 'fluoro'
export type Procedure = 'biopsy' | 'drainage' | 'aspiration' | 'paracentesis' | 'thoracentesis' | 'localization' | 'fna'
export type Confidence = 'high' | 'low'

export interface StudyAttributes {
  /** Canonical modality (CT, MRI, US, US - Duplex, Radiography, …). */
  modality: string
  /** Modality subtype where applicable (RadLex CT.angio / MR.angio / US.Doppler). */
  subtype?: 'angio' | 'venography' | 'doppler'
  /** Fine anatomic focus labels (the app's existing body-part output). */
  focus: string[]
  /** Coarse Region(s) Imaged, deduped (may be multiple for e.g. CT chest/abd/pel). */
  regions: BodyRegion[]
  contrast?: Contrast
  laterality?: Laterality
  procedure?: Procedure
  guidance?: Guidance
  /** low = unclassified modality or body part → surfaces in the review/quality queue. */
  confidence: Confidence
  /** Upper-cased source description (fine-grained matching / debugging). */
  raw: string
}

const SUBTYPE: Record<string, StudyAttributes['subtype']> = {
  CTA: 'angio',
  MRA: 'angio',
  MRV: 'venography',
  'US - Duplex': 'doppler',
}

function detectContrast(t: string): Contrast | undefined {
  if (/WITH\s*(AND|&)?\s*WITHOUT|W\/?\s*(AND|&)\s*W\/?O|W\s*&\s*W\/?O|\bW\/WO\b/.test(t)) return 'with-and-without'
  if (/\bWITHOUT\b|\bW\/O\b|\bWO\b/.test(t)) return 'without'
  if (/\bWITH\b|W\//.test(t)) return 'with'
  return undefined
}

function detectLaterality(t: string): Laterality | undefined {
  if (/BILATERAL|\bBIL\b/.test(t)) return 'bilateral'
  const left = /\bLEFT\b|\bLT\b/.test(t)
  const right = /\bRIGHT\b|\bRT\b/.test(t)
  if (left && right) return 'bilateral'
  if (left) return 'left'
  if (right) return 'right'
  return undefined
}

function detectProcedure(t: string): Procedure | undefined {
  if (/BIOPSY|\bBX\b/.test(t)) return 'biopsy'
  if (/PARACENTESIS/.test(t)) return 'paracentesis'
  if (/THORACENTESIS/.test(t)) return 'thoracentesis'
  if (/DRAINAGE|\bDRAIN\b/.test(t)) return 'drainage'
  if (/\bFNA\b/.test(t)) return 'fna'
  if (/ASPIRAT/.test(t)) return 'aspiration'
  if (/LOCALIZATION/.test(t)) return 'localization'
  return undefined
}

function detectGuidance(t: string): Guidance | undefined {
  if (!/GUID/.test(t)) return undefined
  if (/\bUS\b|ULTRASOUND|SONO/.test(t)) return 'US'
  if (/\bCT\b/.test(t)) return 'CT'
  if (/FLUORO|\bFL\b/.test(t)) return 'fluoro'
  return undefined
}

// Coarse regions detected directly from the text, so a combined CT chest/abd/pel
// keeps all three regions even when the fine body-part label collapses them.
function detectRegions(t: string, focus: string[]): BodyRegion[] {
  const regions = new Set<BodyRegion>()
  if (/\bCHEST\b|THORAX|\bLUNG/.test(t)) regions.add('Chest')
  if (/ABDOMEN|\bABD\b/.test(t)) regions.add('Abdomen')
  if (/PELVI|\bPEL\b/.test(t)) regions.add('Pelvis')
  if (/BRAIN|\bHEAD\b|\bNECK\b|SKULL|SINUS|ORBIT|FACIAL/.test(t)) regions.add('Head/Neck')
  if (/SPINE|LUMBAR|CERVICAL|THORACIC|MYELOGRAM|SACR/.test(t)) regions.add('Spine')
  if (/BREAST|MAMMO/.test(t)) regions.add('Breast')
  // Fall back to the coarse region of the fine focus labels.
  if (regions.size === 0) {
    for (const f of focus) {
      const r = coarseRegion(f)
      if (r !== 'Unspecified') { regions.add(r); break }
    }
  }
  if (regions.size === 0) regions.add('Unspecified')
  return [...regions]
}

export function classifyStudy(desc: string): StudyAttributes {
  const raw = (desc || '').toUpperCase()
  const modality = modalityFromDesc(desc)
  const focus = bodyPartsFromDesc(desc).split(',').map(s => s.trim()).filter(Boolean)
  const unclassified = modality === 'Unknown' || modality === 'Other' ||
    focus.length === 0 || focus.every(f => f === 'Unknown')

  return {
    modality,
    subtype: SUBTYPE[modality],
    focus,
    regions: detectRegions(raw, focus),
    contrast: detectContrast(raw),
    laterality: detectLaterality(raw),
    procedure: detectProcedure(raw),
    guidance: detectGuidance(raw),
    confidence: unclassified ? 'low' : 'high',
    raw,
  }
}
