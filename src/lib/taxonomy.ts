// Standards-grounded classification vocabulary.
//
// This module is the single source of truth for how myRVU names modalities and
// body regions, aligned to the recognized radiology standards rather than ad-hoc
// keywords:
//   • Modality  → DICOM Modality codes (PS3.3 §C.7.3.1.1.1 / PS3.16 CID 29),
//                 with RadLex / LOINC-RSNA Playbook subtypes (CT.angio, US.Doppler…).
//   • Body part → LOINC/RSNA Playbook two-tier anatomy: a coarse, controlled
//                 "Region Imaged" plus a fine "Anatomic Focus" (organ/structure).
//   • ACGME     → the Review Committee for Radiology case-log categories & minimums.
//
// The regex classifier (classificationMaps.ts) emits the fine labels; this file
// maps them onto the canonical coarse vocabulary and documents provenance. See
// the in-app Reference page (ReferencePage.tsx), which renders directly from here.

export interface Citation {
  id: string
  label: string
  url: string
  kind: 'DICOM' | 'RadLex/LOINC' | 'ACGME' | 'RSNA'
}

export const SOURCES: Citation[] = [
  { id: 'dicom-ps3.3', label: 'DICOM PS3.3 §C.7.3.1.1.1 — Modality (0008,0060)', url: 'https://dicom.nema.org/medical/dicom/current/output/html/part03.html', kind: 'DICOM' },
  { id: 'dicom-cid29', label: 'DICOM PS3.16 CID 29 — Acquisition Modality', url: 'https://dicom.nema.org/medical/dicom/2018a/output/chtml/part16/sect_CID_29.html', kind: 'DICOM' },
  { id: 'loinc-playbook', label: 'LOINC/RSNA Radiology Playbook — User Guide', url: 'https://loinc.org/kb/users-guide/loinc-rsna-radiology-playbook-user-guide/', kind: 'RadLex/LOINC' },
  { id: 'radlex-playbook', label: 'RadLex Playbook 2.5 — User Guide (PDF)', url: 'https://playbook.radlex.org/playbook-user-guide-2_5.pdf', kind: 'RadLex/LOINC' },
  { id: 'rsna-radlex', label: 'RSNA — RadLex Radiology Lexicon', url: 'https://www.rsna.org/practice-tools/data-tools-and-standards/radlex-radiology-lexicon', kind: 'RSNA' },
  { id: 'acgme-caselog', label: 'ACGME — Diagnostic Radiology Case Log Categories & Required Minimums (PDF)', url: 'https://www.acgme.org/globalassets/pfassets/programresources/dr_case_log_categories.pdf', kind: 'ACGME' },
  { id: 'acgme-faq', label: 'ACGME — Diagnostic Radiology Program Requirements FAQ (PDF)', url: 'https://www.acgme.org/globalassets/pdfs/faq/420_diagnosticradiology_faqs.pdf', kind: 'ACGME' },
]

// ---------------------------------------------------------------------------
// MODALITY vocabulary
// ---------------------------------------------------------------------------

export interface ModalityInfo {
  /** The label myRVU emits. */
  name: string
  /** Underlying DICOM Modality code(s) (PS3.3 §C.7.3.1.1.1). */
  dicom: string[]
  /** RadLex / LOINC-RSNA Playbook modality (with subtype where applicable). */
  radlex: string
  /** Plain-English note. */
  note: string
}

export const MODALITIES: ModalityInfo[] = [
  { name: 'Radiography', dicom: ['CR', 'DX'], radlex: 'XR', note: 'Plain-film / digital X-ray' },
  { name: 'CT', dicom: ['CT'], radlex: 'CT', note: 'Computed tomography' },
  { name: 'CTA', dicom: ['CT'], radlex: 'CT.angio', note: 'CT angiography (RadLex CT "angio" subtype)' },
  { name: 'MRI', dicom: ['MR'], radlex: 'MR', note: 'Magnetic resonance imaging' },
  { name: 'MRA', dicom: ['MR'], radlex: 'MR.angio', note: 'MR angiography' },
  { name: 'MRV', dicom: ['MR'], radlex: 'MR.angio', note: 'MR venography' },
  { name: 'US', dicom: ['US'], radlex: 'US', note: 'Ultrasound' },
  { name: 'US - Duplex', dicom: ['US'], radlex: 'US.Doppler', note: 'Doppler / duplex ultrasound' },
  { name: 'US - Obstetrical', dicom: ['US'], radlex: 'US', note: 'Obstetric ultrasound' },
  { name: 'US Procedure', dicom: ['US'], radlex: 'US', note: 'Ultrasound-guided procedure' },
  { name: 'Fluoroscopy', dicom: ['RF', 'XA'], radlex: 'RF', note: 'Radio-fluoroscopy' },
  { name: 'Mammography', dicom: ['MG'], radlex: 'MG', note: 'Mammography' },
  { name: 'Mammography Procedure', dicom: ['MG'], radlex: 'MG', note: 'Mammographic procedure (stereotactic biopsy, localization)' },
  { name: 'Nuclear Medicine', dicom: ['NM'], radlex: 'NM', note: 'Nuclear medicine (incl. SPECT)' },
  { name: 'PET/CT', dicom: ['PT'], radlex: 'PT&CT', note: 'PET / PET-CT' },
  { name: 'Echocardiography', dicom: ['US'], radlex: 'US', note: 'Cardiac ultrasound' },
  { name: 'Invasive', dicom: ['XA', 'RF'], radlex: 'RP', note: 'Interventional / angiographic procedure' },
  { name: 'Other', dicom: ['OT'], radlex: 'OT', note: 'Recognized study without a mapped modality' },
  { name: 'Unknown', dicom: [], radlex: '', note: 'Could not be classified — needs a rule' },
]

// ---------------------------------------------------------------------------
// BODY-REGION vocabulary (two-tier: coarse Region Imaged + fine Anatomic Focus)
// ---------------------------------------------------------------------------

/** Coarse, controlled "Region Imaged" list (LOINC/RSNA Playbook), plus Spine. */
export const BODY_REGIONS = [
  'Head/Neck', 'Chest', 'Breast', 'Abdomen', 'Pelvis', 'Spine',
  'Upper extremity', 'Lower extremity', 'Vascular', 'Whole body', 'Unspecified',
] as const

export type BodyRegion = (typeof BODY_REGIONS)[number]

// Maps each fine label the classifier emits (Anatomic Focus) onto a coarse Region.
export const FOCUS_TO_REGION: Record<string, BodyRegion> = {
  'Head/Neck': 'Head/Neck',
  'Chest': 'Chest',
  'Cardiac': 'Chest',
  'Breast': 'Breast',
  'Abdomen': 'Abdomen',
  'Stomach': 'Abdomen',
  'Liver': 'Abdomen',
  'Liver, Spleen': 'Abdomen',
  'Renal': 'Abdomen',
  'Pelvis': 'Pelvis',
  'Scrotum': 'Pelvis',
  'Groin': 'Pelvis',
  'Spine': 'Spine',
  'Upper Extremity': 'Upper extremity',
  'Axilla': 'Upper extremity',
  'Lower Extremity': 'Lower extremity',
  'Musculoskeletal': 'Unspecified',
  'Soft Tissue': 'Unspecified',
  'Vascular': 'Vascular',
  'Lymphatic': 'Whole body',
  'Whole Body': 'Whole body',
  'Unknown': 'Unspecified',
}

/**
 * Rolls a fine anatomic-focus label (possibly comma-joined, e.g. "Abdomen, Pelvis")
 * up to its coarse Region Imaged. Returns the first mapped region, or 'Unspecified'.
 */
export function coarseRegion(bodyPart: string): BodyRegion {
  if (!bodyPart) return 'Unspecified'
  for (const part of bodyPart.split(',').map(p => p.trim())) {
    const region = FOCUS_TO_REGION[part]
    if (region) return region
  }
  return 'Unspecified'
}
