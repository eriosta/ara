-- Run this ONCE in Supabase SQL Editor to update classifications
-- This uses PostgreSQL pattern matching to update records

-- Update Nuclear Medicine
UPDATE rvu_records SET modality = 'Nuclear Medicine' 
WHERE exam_description ~* '(NM|NUCLEAR|SPECT|HIDA|MAG3|THYROID\s+(UPTAKE|SCAN)|BONE\s+SCAN|GASTRIC\s+EMPTYING|LYMPHOSCINTIGRAPH|VENT/?PERF|RENAL\s+SCAN|LIVER\s+AND\s+SPLEEN|PARATHYROID\s+SCAN)'
AND exam_description !~* '(DATSCAN|I-131|THYROGEN|THYROID\s+(TREATMENT|I123|I-123))';

-- Update DaTscan and Thyroid treatments to Other
UPDATE rvu_records SET modality = 'Other'
WHERE exam_description ~* '(DATSCAN|I-131|THYROGEN|THYROID\s+(TREATMENT|I123|I-123))';

-- Update PET/CT (before CT since PET/CT contains CT)
UPDATE rvu_records SET modality = 'PET/CT'
WHERE exam_description ~* '(PET|POSITRON)'
AND modality != 'Nuclear Medicine' AND modality != 'Other';

-- Update CTA
UPDATE rvu_records SET modality = 'CTA'
WHERE (exam_description ~* 'CT\s*(ANGIO|A\s)' OR exam_description ~* 'WITH\s+IV\s+CONTRAST.*RECTAL')
AND modality NOT IN ('Nuclear Medicine', 'Other', 'PET/CT');

-- Update CT
UPDATE rvu_records SET modality = 'CT'
WHERE (
  exam_description ~* '(CT\s|CT$|COMPUTED|CAT\s+SCAN)'
  OR exam_description ~* '3\s*PHASE\s+BONE\s+SCAN\s+INJECTION'
  OR exam_description ~* 'BONE\s+SCAN\s+INJECTION'
  OR exam_description ~* 'SPECT/CT'
  OR exam_description ~* '4D\s+CT'
  OR exam_description ~* 'PLUVICTO'
  OR exam_description ~* 'INJECTION.*SENTINEL'
  OR exam_description ~* 'LYMPHOSCINTIGRAPHY\s+INJECTION'
  OR exam_description ~* 'LUMBAR\s+PUNCTURE'
)
AND modality NOT IN ('Nuclear Medicine', 'Other', 'PET/CT', 'CTA');

-- Update MRI  
UPDATE rvu_records SET modality = 'MRI'
WHERE exam_description ~* '(MRI|MR\s|MAGNETIC)'
AND modality NOT IN ('Nuclear Medicine', 'Other', 'PET/CT', 'CTA', 'CT');

-- Update US
UPDATE rvu_records SET modality = 'US'
WHERE exam_description ~* '(US\s|ULTRASOUND|SONO|ECHO(?!CARDIOG))'
AND modality NOT IN ('Nuclear Medicine', 'Other', 'PET/CT', 'CTA', 'CT', 'MRI');

-- Update Fluoroscopy
UPDATE rvu_records SET modality = 'Fluoroscopy'
WHERE exam_description ~* '(FL\s|FLUORO|BARIUM|SWALLOW|ESOPHAG)'
AND modality NOT IN ('Nuclear Medicine', 'Other', 'PET/CT', 'CTA', 'CT', 'MRI', 'US');

-- Update Mammography
UPDATE rvu_records SET modality = 'Mammography'
WHERE exam_description ~* '(MAMMO|BREAST\s+IMAGING)'
AND modality NOT IN ('Nuclear Medicine', 'Other', 'PET/CT', 'CTA', 'CT', 'MRI', 'US', 'Fluoroscopy');

-- Update Radiography (X-ray) - most generic
UPDATE rvu_records SET modality = 'Radiography'
WHERE exam_description ~* '(XR\s|X-?RAY|RADIOGRAPH|VIEW|VIEWS)'
AND modality NOT IN ('Nuclear Medicine', 'Other', 'PET/CT', 'CTA', 'CT', 'MRI', 'US', 'Fluoroscopy', 'Mammography');

-- Verify counts
SELECT modality, COUNT(*) as count 
FROM rvu_records 
GROUP BY modality 
ORDER BY count DESC;





