-- Comprehensive reclassification script to fix misclassifications
-- Run this ONCE in Supabase SQL Editor to update existing records
-- This script addresses all issues identified in the classification review

-- ============================================================================
-- PHASE 1: MODALITY FIXES
-- ============================================================================

-- 1. Nuclear Medicine treatments and procedures (must come first)
UPDATE rvu_records SET modality = 'Nuclear Medicine'
WHERE exam_description ~* '(PLUVICTO|THYROGEN\s+INJECTION)'
AND modality IS NOT NULL;

-- 2. 4D CT is technically a nuclear medicine study
UPDATE rvu_records SET modality = 'Nuclear Medicine'
WHERE exam_description ~* '4D\s+CT'
AND modality IS NOT NULL;

-- 3. SPECT/CT is Nuclear Medicine (not CT)
UPDATE rvu_records SET modality = 'Nuclear Medicine'
WHERE exam_description ~* 'SPECT/CT'
AND modality IS NOT NULL;

-- 4. Nuclear Medicine - comprehensive patterns (before PET/CT)
UPDATE rvu_records SET modality = 'Nuclear Medicine'
WHERE exam_description ~* '(NM\s|NUCLEAR\s+MEDICINE|SPECT|HIDA|MAG3|BONE\s+SCAN|GASTRIC\s+EMPTYING|LYMPHOSCINTIGRAPH|VENT/?PERF|RENAL\s+SCAN|LIVER\s+AND\s+SPLEEN|PARATHYROID\s+SCAN|DATSCAN)'
AND modality IS NOT NULL
AND exam_description !~* 'PET';

-- 5. PET/CT (before CT since PET/CT contains CT)
UPDATE rvu_records SET modality = 'PET/CT'
WHERE exam_description ~* '(PET|POSITRON)'
AND modality IS NOT NULL
AND modality NOT IN ('Nuclear Medicine');

-- 6. FL Lumbar Puncture is Fluoroscopy (not CT)
UPDATE rvu_records SET modality = 'Fluoroscopy'
WHERE exam_description ~* 'FL\s+.*LUMBAR\s+PUNCTURE'
AND modality IS NOT NULL;

-- 7. FL Esophagus/Esophagram is Fluoroscopy (not US)
UPDATE rvu_records SET modality = 'Fluoroscopy'
WHERE exam_description ~* 'FL\s+.*ESOPHAG'
AND modality IS NOT NULL;

-- 7a. FL Access Portacath and Injection is Fluoroscopy guided procedure (not CT)
UPDATE rvu_records SET modality = 'Fluoroscopy'
WHERE exam_description ~* 'FL\s+.*(ACCESS|PORTACATH)'
AND modality IS NOT NULL;

-- 8. CT with IV + rectal contrast should NOT be CTA (fix CTA classification)
-- First, fix CT studies that were incorrectly classified as CTA
UPDATE rvu_records SET modality = 'CT'
WHERE exam_description ~* 'CT.*RECTAL.*CONTRAST'
AND modality = 'CTA';

-- 9. CTA (exclude CT with rectal contrast)
UPDATE rvu_records SET modality = 'CTA'
WHERE exam_description ~* 'CT\s*(ANGIO|A\s)'
AND exam_description !~* 'RECTAL'
AND modality IS NOT NULL
AND modality NOT IN ('Nuclear Medicine', 'PET/CT', 'Fluoroscopy');

-- 10. CT (exclude 4D CT, SPECT/CT, FL procedures, and CTA)
UPDATE rvu_records SET modality = 'CT'
WHERE (
  exam_description ~* '(CT\s|CT$|COMPUTED|CAT\s+SCAN)'
  AND exam_description !~* '(4D\s+CT|SPECT/CT|PET|PLUVICTO|THYROGEN|FL\s+.*(ACCESS|PORTACATH|LUMBAR\s+PUNCTURE|ESOPHAG))'
)
AND modality IS NOT NULL
AND modality NOT IN ('Nuclear Medicine', 'PET/CT', 'CTA', 'Fluoroscopy');

-- 11. MRI
UPDATE rvu_records SET modality = 'MRI'
WHERE exam_description ~* '(MRI|MR\s|MAGNETIC)'
AND modality IS NOT NULL
AND modality NOT IN ('Nuclear Medicine', 'PET/CT', 'CTA', 'CT', 'Fluoroscopy');

-- 12. Fluoroscopy (comprehensive - after FL-specific checks above)
UPDATE rvu_records SET modality = 'Fluoroscopy'
WHERE exam_description ~* '(FL\s|FLUORO|BARIUM|SWALLOW|ESOPHAG|PORTACATH.*INJECTION)'
AND modality IS NOT NULL
AND modality NOT IN ('Nuclear Medicine', 'PET/CT', 'CTA', 'CT', 'MRI');

-- 13. US (exclude FL Esophagus which should be Fluoroscopy)
UPDATE rvu_records SET modality = 'US'
WHERE exam_description ~* '(US\s|ULTRASOUND|SONO|ECHO(?!CARDIOG))'
AND exam_description !~* 'FL\s+.*ESOPHAG'
AND modality IS NOT NULL
AND modality NOT IN ('Nuclear Medicine', 'PET/CT', 'CTA', 'CT', 'MRI', 'Fluoroscopy');

-- 14. Mammography
UPDATE rvu_records SET modality = 'Mammography'
WHERE exam_description ~* '(MAMMO|BREAST\s+IMAGING)'
AND modality IS NOT NULL
AND modality NOT IN ('Nuclear Medicine', 'PET/CT', 'CTA', 'CT', 'MRI', 'US', 'Fluoroscopy');

-- 15. Radiography (X-ray) - improved detection
UPDATE rvu_records SET modality = 'Radiography'
WHERE (
  exam_description ~* '(XR\s|X-?RAY|RADIOGRAPH)'
  OR (exam_description ~* '\d+\s*VIEWS?')
  OR (exam_description ~* '(AP|PA).*(LAT|LATERAL)')
  OR (exam_description ~* 'BILATERAL.*(KNEE|KNEES|HIP|HIPS)')
  OR (exam_description ~* 'STANDING.*(KNEE|HIP|SPINE)')
  OR (exam_description ~* '(FLEX\s+AND\s+EXT|BENDING\s+VIEWS)')
)
AND exam_description !~* '(CT|MRI|US|ULTRASOUND|FLUORO|PET|SPECT|NM\s)'
AND modality IS NOT NULL
AND modality NOT IN ('Nuclear Medicine', 'PET/CT', 'CTA', 'CT', 'MRI', 'US', 'Fluoroscopy', 'Mammography');

-- ============================================================================
-- PHASE 2: BODY PART FIXES
-- ============================================================================

-- 1. CT MAXILLOFACIAL BONES → Head/Neck
UPDATE rvu_records SET body_part = 'Head/Neck'
WHERE exam_description ~* 'MAXILLOFACIAL'
AND body_part IS NOT NULL;

-- 2. Bilateral knees → Lower Extremity
UPDATE rvu_records SET body_part = 'Lower Extremity'
WHERE exam_description ~* 'BILATERAL.*(KNEE|KNEES)'
AND body_part = 'Unknown';

-- 3. Merge Head/Neck + Vascular → Head/Neck
UPDATE rvu_records SET body_part = 'Head/Neck'
WHERE body_part ~* 'Head/Neck.*Vascular|Vascular.*Head/Neck';

-- 4. PET/CT body regions
-- Brain PET → Head/Neck
UPDATE rvu_records SET body_part = 'Head/Neck'
WHERE exam_description ~* 'PET.*(BRAIN|DEMENTIA|AMYLOID)'
AND body_part = 'Unknown';

-- Other PET/CT → Whole Body (default for tumor imaging) or specific regions
-- PET/CT for lower extremity
UPDATE rvu_records SET body_part = 'Lower Extremity'
WHERE exam_description ~* 'PET.*(LOWER\s+EXTREMITY|LEG|THIGH)'
AND body_part = 'Unknown';

-- Other PET/CT → Whole Body (default for tumor imaging)
UPDATE rvu_records SET body_part = 'Whole Body'
WHERE exam_description ~* 'PET'
AND body_part = 'Unknown'
AND exam_description !~* 'BRAIN|DEMENTIA|AMYLOID|LOWER\s+EXTREMITY|LEG|THIGH';

-- 5. SPECT/CT Bone Imaging → Whole Body
UPDATE rvu_records SET body_part = 'Whole Body'
WHERE exam_description ~* 'SPECT/CT.*BONE'
AND body_part = 'Unknown';

-- 6. Nuclear Medicine Lymphoscintigraphy → Lymphatic (not Whole Body)
UPDATE rvu_records SET body_part = 'Lymphatic'
WHERE exam_description ~* 'LYMPHOSCINTIGRAPH'
AND (body_part = 'Unknown' OR body_part = 'Whole Body');

-- 6a. Remove Whole Body from records that have lymphoscintigraphy and clean up
UPDATE rvu_records 
SET body_part = TRIM(REPLACE(REPLACE(REPLACE(body_part, 'Whole Body', ''), ', ,', ','), ',,', ','), ', ')
WHERE exam_description ~* 'LYMPHOSCINTIGRAPH'
AND body_part LIKE '%Whole Body%';

-- 7. NM Shunt Patency → could be Head/Neck or Other (leave as is for now)

-- ============================================================================
-- PHASE 3: RECALCULATE EXAM_TYPE BASED ON UPDATED MODALITY AND BODY_PART
-- ============================================================================

-- This will be handled by the application logic when records are reprocessed
-- Or you can manually update exam_type here if needed

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check modality distribution
SELECT modality, COUNT(*) as count 
FROM rvu_records 
WHERE modality IS NOT NULL
GROUP BY modality 
ORDER BY count DESC;

-- Check body part distribution
SELECT body_part, COUNT(*) as count 
FROM rvu_records 
WHERE body_part IS NOT NULL
GROUP BY body_part 
ORDER BY count DESC;

-- Check for remaining Unknown body parts
SELECT COUNT(*) as unknown_count
FROM rvu_records 
WHERE body_part = 'Unknown' OR body_part IS NULL;

-- Check for remaining Other modality
SELECT COUNT(*) as other_count, 
       STRING_AGG(DISTINCT exam_description, '; ' ORDER BY exam_description LIMIT 10) as sample_descriptions
FROM rvu_records 
WHERE modality = 'Other' OR modality IS NULL
GROUP BY modality;

-- Check specific fixes
SELECT 'CT with rectal contrast' as check_type, COUNT(*) as count
FROM rvu_records 
WHERE exam_description ~* 'CT.*RECTAL.*CONTRAST' AND modality = 'CT'
UNION ALL
SELECT '4D CT as Nuclear Medicine', COUNT(*)
FROM rvu_records 
WHERE exam_description ~* '4D\s+CT' AND modality = 'Nuclear Medicine'
UNION ALL
SELECT 'PLUVICTO as Nuclear Medicine', COUNT(*)
FROM rvu_records 
WHERE exam_description ~* 'PLUVICTO' AND modality = 'Nuclear Medicine'
UNION ALL
SELECT 'FL Lumbar Puncture as Fluoroscopy', COUNT(*)
FROM rvu_records 
WHERE exam_description ~* 'FL\s+.*LUMBAR\s+PUNCTURE' AND modality = 'Fluoroscopy'
UNION ALL
SELECT 'FL Esophagus as Fluoroscopy', COUNT(*)
FROM rvu_records 
WHERE exam_description ~* 'FL\s+.*ESOPHAG' AND modality = 'Fluoroscopy'
UNION ALL
SELECT 'Bilateral knees as Lower Extremity', COUNT(*)
FROM rvu_records 
WHERE exam_description ~* 'BILATERAL.*(KNEE|KNEES)' AND body_part = 'Lower Extremity'
UNION ALL
SELECT 'FL Access Portacath as Fluoroscopy', COUNT(*)
FROM rvu_records 
WHERE exam_description ~* 'FL\s+.*(ACCESS|PORTACATH)' AND modality = 'Fluoroscopy'
UNION ALL
SELECT 'NM Lymphoscintigraph as Lymphatic', COUNT(*)
FROM rvu_records 
WHERE exam_description ~* 'LYMPHOSCINTIGRAPH' AND body_part = 'Lymphatic';

