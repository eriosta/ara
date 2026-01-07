# Classification Reclassification Plan

## Overview
This document outlines all misclassification issues identified and the fixes needed for both the TypeScript processing logic and database records.

## Issues Identified

### 1. Modality Classification Issues

#### 1.1 CT vs CTA
- **Issue**: CT with IV + rectal contrast is being classified as CTA, but should be CT
- **Fix**: Exclude CT studies with rectal contrast from CTA classification
- **Examples**: 
  - "CT ABDOMEN AND PELVIS WITH IV CONTRAST, WITH RECTAL CONTRAST" → CT (not CTA)

#### 1.2 CT Soft Tissue Neck vs CT Head/Brain
- **Issue**: CT soft tissue neck is different from CT head/brain but may be grouped together
- **Fix**: Ensure proper distinction (both are Head/Neck body part, but different exam types)
- **Examples**:
  - "CT SOFT TISSUE NECK WITHOUT CONTRAST" → CT Head/Neck
  - "CT Head w/o Contrast" → CT Head/Neck

#### 1.3 4D CT Classification
- **Issue**: 4D CT is technically a nuclear medicine study
- **Fix**: Classify 4D CT as Nuclear Medicine
- **Examples**:
  - "4D CT SOFT TISSUE NECK WITH AND WITHOUT CONTRAST" → Nuclear Medicine

#### 1.4 Fluoroscopy vs US
- **Issue**: Esophagram studies are being classified as US but should be Fluoroscopy
- **Fix**: Check for "FL Esophagus" or "Esophagus w/Fluoroscopy" patterns before US classification
- **Examples**:
  - "FL Esophagus w/Fluoroscopy" → Fluoroscopy (not US)

#### 1.5 Fluoroscopy vs CT
- **Issue**: Lumbar puncture with fluoroscopy is being classified as CT Spine
- **Fix**: Check for "FL Lumbar Puncture" pattern before CT classification
- **Examples**:
  - "FL Lumbar Puncture w/Pressures" → Fluoroscopy (not CT)

#### 1.6 Nuclear Medicine Treatments/Procedures
- **Issue**: PLUVICTO TREATMENT and THYROGEN INJECTION should be classified as Nuclear Medicine
- **Fix**: Add patterns for NM treatments and procedures
- **Examples**:
  - "PLUVICTO TREATMENT 4" → Nuclear Medicine
  - "THYROGEN INJECTION FOR I-131 CANCER TREATMENT" → Nuclear Medicine

#### 1.7 Radiography vs Other
- **Issue**: Some studies marked as "Other" are actually Radiography
- **Fix**: Improve implicit X-ray pattern detection
- **Examples**:
  - "KNEE, BILATERAL - STANDING" → Radiography
  - "HIPS, BILATERAL AND PELVIS" → Radiography
  - "LUMBOSACRAL SPINE, FLEX AND EXT/BENDING VIEWS ONLY" → Radiography

#### 1.8 FL Access Portacath
- **Issue**: FL Access Portacath and Injection is a fluoroscopy guided procedure, currently classified as CT
- **Fix**: Add pattern for "FL Access" or "FL.*Portacath" before CT classification
- **Examples**:
  - "FL Access Portacath and Injection" → Fluoroscopy (not CT)

### 2. Body Part Classification Issues

#### 2.1 Head/Neck vs Vascular
- **Issue**: "Head/Neck, Vascular" should be merged into just "Head/Neck"
- **Fix**: When both Head/Neck and Vascular are detected, remove Vascular from the result
- **Examples**:
  - "Head/Neck, Vascular" → "Head/Neck"

#### 2.2 Unknown Body Parts - Bilateral Knees
- **Issue**: Bilateral knee studies are being classified as "Unknown"
- **Fix**: Add pattern for "BILATERAL KNEES" to Lower Extremity
- **Examples**:
  - "AP, PA, SUPINE LATERAL, SUNRISE BILATERAL KNEES" → Lower Extremity
  - "KNEES, 3 VIEWS - BILATERAL" → Lower Extremity

#### 2.3 CT Maxillofacial Bones
- **Issue**: CT MAXILLOFACIAL BONES should be classified as Head/Neck
- **Fix**: Add "MAXILLOFACIAL" to Head/Neck patterns
- **Examples**:
  - "CT MAXILLOFACIAL BONES WITH CONTRAST" → Head/Neck

#### 2.4 PET/CT Body Regions
- **Issue**: PET/CT studies are being classified as "Unknown" but should have body regions
- **Fix**: Add logic to determine PET/CT body regions based on exam type
- **Examples**:
  - "PET/CT ER (i)" → Could be Head/Neck, Lower Extremity, or Whole Body (need to infer from context)
  - "PET/CT PSMA (i)" → Could be Whole Body or specific region
  - "PET/CT SSTR (i)" → Could be Whole Body or specific region

#### 2.5 Lower Extremity Subclassification (Optional Enhancement)
- **Issue**: Can we subclassify lower extremity studies?
- **Note**: This is a future enhancement - hips, knees, ankles, feet, toes, thighs, legs, etc.
- **Status**: Deferred for now, but structure can support it

#### 2.6 Upper Extremity Subclassification (Optional Enhancement)
- **Issue**: Can we subclassify upper extremity studies?
- **Note**: This is a future enhancement - shoulder, elbow, wrist, hand, finger, humerus, forearm, clavicle, arm
- **Status**: Deferred for now, but structure can support it

#### 2.7 NM Lymphoscintigraph Body Part
- **Issue**: NM Lymphoscintigraph (Melanoma) should be under Lymphatic body part, not Whole Body
- **Fix**: Ensure lymphoscintigraphy is classified as Lymphatic before Whole Body check
- **Examples**:
  - "NM Lymphoscintigraph (Melanoma)" → Nuclear Medicine, Lymphatic (not Whole Body)

#### 2.8 PET/CT Body Regions
- **Issue**: PET/CT should be classified into specific regions (Head/Neck, Lower Extremity, Whole Body) rather than defaulting to Whole Body
- **Fix**: Allow PET/CT to be classified into multiple regions based on exam description
- **Examples**:
  - "PET/CT ER (i)" → Could be Head/Neck, Lower Extremity, or Whole Body
  - "PET/CT PSMA (i)" → Could be Whole Body or specific region
  - "PET/CT SSTR (i)" → Could be Whole Body or specific region

### 3. Implementation Plan

#### Phase 1: Update TypeScript Processing Logic (`dataProcessing.ts`)
1. Fix modality classification order and patterns
2. Fix body part classification patterns
3. Add special handling for edge cases

#### Phase 2: Create SQL Migration Script
1. Create comprehensive SQL script to reprocess existing records
2. Update modality classifications
3. Update body part classifications
4. Update exam_type based on new classifications

## Detailed Fixes

### Modality Fixes in `modalityFromDesc()`

1. **Before CTA check**: Exclude CT with rectal contrast
   ```typescript
   // CT with IV + rectal contrast should NOT be CTA
   if (t.includes('CT') && t.includes('RECTAL') && t.includes('CONTRAST')) {
     return 'CT' // Not CTA
   }
   ```

2. **4D CT → Nuclear Medicine**: Add before CT check
   ```typescript
   if (t.includes('4D CT') || t.includes('4DCT')) {
     return 'Nuclear Medicine'
   }
   ```

3. **FL Esophagus → Fluoroscopy**: Add before US check
   ```typescript
   if (t.includes('FL ') && (t.includes('ESOPHAG') || t.includes('SWALLOW'))) {
     return 'Fluoroscopy'
   }
   ```

4. **FL Lumbar Puncture → Fluoroscopy**: Add before CT check
   ```typescript
   if (t.includes('FL ') && t.includes('LUMBAR PUNCTURE')) {
     return 'Fluoroscopy'
   }
   ```

5. **NM Treatments**: Add to Nuclear Medicine section
   ```typescript
   if (t.includes('PLUVICTO') || (t.includes('THYROGEN') && t.includes('INJECTION'))) {
     return 'Nuclear Medicine'
   }
   ```

6. **Improve Radiography detection**: Enhance implicit patterns
   ```typescript
   // Add "BILATERAL" + body part patterns
   if (t.includes('BILATERAL') && (t.includes('KNEE') || t.includes('HIP') || t.includes('KNEES'))) {
     if (!['CT', 'MRI', 'US', 'FLUORO'].some(m => t.includes(m))) {
       return 'Radiography'
     }
   }
   ```

### Body Part Fixes in `bodyPartsFromDesc()`

1. **Merge Head/Neck + Vascular**: Remove Vascular when Head/Neck is present
   ```typescript
   // After collecting all found parts
   if (found.includes('Head/Neck') && found.includes('Vascular')) {
     found = found.filter(p => p !== 'Vascular')
   }
   ```

2. **Add MAXILLOFACIAL to Head/Neck pattern**
   ```typescript
   'Head/Neck': /\b(HEAD|NECK|BRAIN|SKULL|ORBITS|FACIAL|SINUS|TEMPORAL|PITUITARY|CRANIAL|SKULL BASE|THYROID|PARATHYROID|DATSCAN|MAXILLOFACIAL)\b/i,
   ```

3. **Add BILATERAL KNEES to Lower Extremity**
   ```typescript
   // Add special handling before final fallback
   if (found.length === 0 && (t.includes('BILATERAL') && t.includes('KNEE'))) {
     found.push('Lower Extremity')
   }
   ```

4. **PET/CT Body Region Detection**
   ```typescript
   // Add after PET detection
   if (found.length === 0 && t.includes('PET')) {
     // Default to Whole Body for PET/CT unless specific region mentioned
     if (!t.includes('BRAIN') && !t.includes('HEAD')) {
       found.push('Whole Body')
     }
   }
   ```

## SQL Migration Script Updates

The SQL script should:
1. Update modalities based on new rules
2. Update body parts based on new patterns
3. Recalculate exam_type based on updated modality and body_part
4. Handle all edge cases identified

## Testing Checklist

- [ ] CT with IV + rectal contrast → CT (not CTA)
- [ ] 4D CT → Nuclear Medicine
- [ ] FL Esophagus → Fluoroscopy (not US)
- [ ] FL Lumbar Puncture → Fluoroscopy (not CT)
- [ ] PLUVICTO TREATMENT → Nuclear Medicine
- [ ] THYROGEN INJECTION → Nuclear Medicine
- [ ] Bilateral knees → Lower Extremity (not Unknown)
- [ ] CT MAXILLOFACIAL → Head/Neck
- [ ] Head/Neck, Vascular → Head/Neck
- [ ] Bilateral knee radiographs → Radiography (not Other)
- [ ] PET/CT → appropriate body region (not Unknown)

