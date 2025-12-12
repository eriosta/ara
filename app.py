import io, re, os
from datetime import datetime
import pandas as pd
import numpy as np
import altair as alt
import streamlit as st
from functools import lru_cache

# PDF generation removed

# ======================== COLOR PALETTE (Modern/Professional) ========================
# Modern, professional color palette
COLORS = {
    'primary': '#1E40AF',      # Deep blue - for primary data points
    'trend': '#059669',        # Professional teal - for trend lines
    'target': '#DC2626',       # Professional red - for targets/warnings
    'highlight': '#D97706',    # Warm amber - for highlights
    'secondary': '#7C3AED',    # Purple - for secondary elements
    'info': '#0284C7',         # Professional blue - for informational elements
    'success': '#059669',      # Professional green - for success states
    'warning': '#D97706',      # Warm amber - for warnings
    'text_light': '#FFFFFF',   # White - for text on dark backgrounds
    'text_dark': '#111827'     # Dark gray - for text on light backgrounds
}

st.set_page_config(page_title="Radiology RVU Productivity Report", layout="wide")

# ======================== CACHING FUNCTIONS ========================
@st.cache_data
def parse_csv_data(text: str) -> pd.DataFrame:
    """Parse CSV data with multiple delimiters"""
    for sep in [None, ",", "\t", r"\s{2,}"]:
        try:
            return pd.read_csv(io.StringIO(text), sep=sep, engine="python")
        except Exception:
            pass
    raise ValueError("Could not parse pasted text.")

def process_excel_file(uploaded_file) -> pd.DataFrame:
    """Process Excel file (PS360 format) to extract pertinent data"""
    try:
        # Read Excel file, skipping the first 8 rows (metadata) and using row 8 as header
        df = pd.read_excel(uploaded_file, header=8, engine='openpyxl')
        
        # Convert all column names to strings (in case some are datetime or other types)
        df.columns = df.columns.astype(str)
        
        # Remove unnamed columns
        df = df.loc[:, ~df.columns.str.contains('^Unnamed', na=False)]
        
        # Remove rows that are completely empty or have NaN in key columns
        # Keep rows that have at least DICTATION DTTM or EXAM DESC
        key_columns = ['DICTATION DTTM', 'EXAM DESC']
        if all(col in df.columns for col in key_columns):
            df = df.dropna(subset=key_columns, how='all')
        else:
            # If columns don't match expected format, try to clean empty rows
            df = df.dropna(how='all')
        
        return df
    except Exception as e:
        raise ValueError(f"Error processing Excel file: {str(e)}")

@st.cache_data
def process_dataframe(df_raw: pd.DataFrame) -> pd.DataFrame:
    """Process and enrich the raw dataframe"""
    # Column normalization
    cols_map = {c: c for c in df_raw.columns}
    for c in df_raw.columns:
        k = c.strip().lower()
        if "dttm" in k: cols_map[c] = "DICTATION DTTM"
        if "exam" in k and "desc" in k: cols_map[c] = "EXAM DESC"
        if "wrvu" in k: cols_map[c] = "WRVU ESTIMATE"
        if "examcode" in k or "exam code" in k: cols_map[c] = "EXAMCODE"
    
    df = df_raw.rename(columns=cols_map)
    need = {"DICTATION DTTM", "EXAM DESC", "WRVU ESTIMATE"}
    missing = need - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns: {sorted(missing)}")
    
    # Include EXAMCODE if available
    base_cols = ["DICTATION DTTM", "EXAM DESC", "WRVU ESTIMATE"]
    if "EXAMCODE" in df.columns:
        base_cols.append("EXAMCODE")
    
    df = df[base_cols].copy()
    df["DICTATION DTTM"] = pd.to_datetime(df["DICTATION DTTM"], errors="coerce")
    df["WRVU ESTIMATE"] = pd.to_numeric(df["WRVU ESTIMATE"], errors="coerce")
    df = df.dropna(subset=["DICTATION DTTM", "WRVU ESTIMATE"])
    
    # Enrichment - use EXAMCODE if available, otherwise fall back to EXAM DESC
    if "EXAMCODE" in df.columns:
        df["Modality"] = df.apply(
            lambda row: modality_from_examcode(row.get("EXAMCODE", ""), str(row.get("EXAM DESC", ""))) 
            if pd.notna(row.get("EXAMCODE")) else modality_from_desc(str(row.get("EXAM DESC", ""))),
            axis=1
        )
        df["Exam"] = df.apply(
            lambda row: exam_from_examcode(row.get("EXAMCODE", ""), str(row.get("EXAM DESC", "")))
            if pd.notna(row.get("EXAMCODE")) else exam_from_desc(str(row.get("EXAM DESC", ""))),
            axis=1
        )
        df["Body Part"] = df.apply(
            lambda row: body_part_from_examcode(row.get("EXAMCODE", ""), str(row.get("EXAM DESC", "")))
            if pd.notna(row.get("EXAMCODE")) else body_parts_from_desc(str(row.get("EXAM DESC", ""))),
            axis=1
        )
    else:
        df["Modality"] = df["EXAM DESC"].astype(str).apply(modality_from_desc)
        df["Exam"] = df["EXAM DESC"].astype(str).apply(exam_from_desc)
        df["Body Part"] = df["EXAM DESC"].astype(str).apply(body_parts_from_desc)
    
    # Time features
    df["date"] = df["DICTATION DTTM"].dt.date
    df["week"] = df["DICTATION DTTM"].dt.to_period("W-MON").apply(lambda r: r.start_time.date())
    df["month"] = df["DICTATION DTTM"].dt.to_period("M").astype(str)
    df["dow"] = df["DICTATION DTTM"].dt.day_name()
    df["hour"] = df["DICTATION DTTM"].dt.hour
    
    return df

def check_time_data(df: pd.DataFrame) -> bool:
    """Check if datetime data includes time information"""
    if df is None or df.empty:
        return False
    
    # Check if any datetime has time component (not just date)
    sample_dates = df["DICTATION DTTM"].dropna().head(10)
    if sample_dates.empty:
        return False
    
    # Check if any date has time component (hour, minute, second not all zero)
    has_time = any(
        dt.hour != 0 or dt.minute != 0 or dt.second != 0 or dt.microsecond != 0
        for dt in sample_dates
    )
    return has_time

# ======================== CLASSIFICATION FUNCTIONS ========================
# Clean regex-based classification patterns

# Modality patterns from exam codes
MODALITY_PATTERNS = {
    r'^XR': 'Radiography',
    r'^AX': 'Radiography',  # Alternative X-ray notation
    r'^RT': 'Radiography',
    r'^CT(?!.*ANG)': 'CT',  # CT but not CTA
    r'^CT.*ANG': 'CTA',  # CT Angiography
    r'^MR(?!.*(?:MRA|MRV))': 'MRI',  # MR but not MRA/MRV
    r'^MR.*MRA': 'MRA',
    r'^MR.*MRV': 'MRV',
    r'^FL': 'Fluoroscopy',
    r'^NM': 'Nuclear Medicine',
    r'^Z.*PET.*CT': 'PET/CT',
    r'^Z.*PET': 'PET',
    r'^Z': 'Nuclear Medicine',  # Default Z codes to NM
}

# Nuclear Medicine keywords for Z code classification
NM_KEYWORDS = [
    r'BONE\s+SCAN', r'HIDA', r'NUCLEAR', r'RENAL\s+SCAN', r'MAG3',
    r'GASTRIC\s+EMPTYING', r'LIVER\s+AND\s+SPLEEN', r'HEPATOBILIARY',
    r'THYROID', r'PARATHYROID', r'SCAN', r'INJECTION', r'RADIOACTIVE',
    r'TECHNETIUM', r'I-131', r'I-123', r'GALLIUM', r'INDIUM',
    r'OCTREOTIDE', r'MUGA', r'MYOCARDIAL', r'PERFUSION', r'VENTILATION',
    r'DMSA', r'DTPA', r'LASIX', r'3\s+PHASE', r'WHOLE\s+BODY', r'SALIVARY'
]

# Head/Neck keywords for NM detection
HEAD_NECK_KEYWORDS = [r'HEAD', r'NECK', r'THYROID', r'PARATHYROID', r'SALIVARY', r'SALIVA']

def modality_from_examcode(examcode: str, exam_desc: str = "") -> str:
    """Classify modality based on EXAMCODE prefix patterns using regex"""
    if pd.isna(examcode) or not examcode:
        return "Other"
    
    code = str(examcode).upper().strip()
    
    # Try regex patterns in order (more specific first)
    for pattern, modality in MODALITY_PATTERNS.items():
        if re.match(pattern, code, re.IGNORECASE):
            # Special handling for Z codes - check description for NM indicators
            if modality == 'Nuclear Medicine' and code.startswith('Z') and exam_desc:
                desc_upper = str(exam_desc).upper()
                
                # Check for NM keywords
                if any(re.search(keyword, desc_upper, re.IGNORECASE) for keyword in NM_KEYWORDS):
                    if not any(x in desc_upper for x in ["CT SCAN", "MRI SCAN", "MR SCAN", "US SCAN", "ULTRASOUND SCAN"]):
                        return "Nuclear Medicine"
                
                # Check for head/neck NM patterns
                if any(re.search(keyword, desc_upper, re.IGNORECASE) for keyword in HEAD_NECK_KEYWORDS):
                    if any(x in desc_upper for x in ["PROCEDURE", "SCAN", "INJECTION", "STUDY", "IMAGING", "RADIOACTIVE"]):
                        if not any(x in desc_upper for x in ["CT", "MRI", "MR ", "US ", "ULTRASOUND", "XR ", "X-RAY", 
                                                              "BIOPSY", "ASPIRATION", "DRAINAGE", "CATHETER", "STENT"]):
                            return "Nuclear Medicine"
            
            return modality
    
    return "Other"

# Body part patterns from exam codes
# IMPORTANT: Order matters! More specific patterns (multiple body parts) must come first
BODY_PART_CODE_PATTERNS = {
    r'^CT.*CH.*AB.*PE': 'Chest, Abdomen, Pelvis',  # Most specific: all three
    r'^CT.*AB.*PE': 'Abdomen, Pelvis',  # Two body parts together
    r'^CT.*CH': 'Chest',  # Single body part
    r'^CT.*PE': 'Pelvis',  # Single body part (check before AB to avoid conflicts)
    r'^CT.*AB(?!.*PE)': 'Abdomen',  # Abdomen but NOT Abdomen Pelvis (negative lookahead)
    r'^CT.*ANG': 'Vascular',
    r'^MR.*KN': 'Lower Extremity',  # Knee
    r'^MR.*SH': 'Upper Extremity',  # Shoulder
    r'^MR.*HI': 'Head/Neck',  # Head
    r'^XR.*CH|^AX.*CH': 'Chest',
    r'^XR.*AB|^AX.*AB': 'Abdomen',
    r'^RT.*CH': 'Chest',
    r'^RT.*(?:HI|HA)': 'Upper Extremity',  # Hand
    r'^RT.*SH': 'Upper Extremity',  # Shoulder
    r'^RT.*EL': 'Upper Extremity',  # Elbow
    r'^RT.*KN': 'Lower Extremity',  # Knee
    r'^RT.*(?:FO|AN)': 'Lower Extremity',  # Foot/Ankle
    r'^RT.*FE': 'Lower Extremity',  # Femur
    r'^RT.*TI': 'Lower Extremity',  # Tibia
    r'^RT.*PE': 'Pelvis',
    r'^RT.*CL': 'Upper Extremity',  # Clavicle
    r'^RT.*LS': 'Spine',  # Lumbar spine
    r'^NM.*HIDA|^NM.*HEPATOBILIARY': 'Liver',
    r'^NM.*(?:KID|RENAL|MAG3)': 'Renal',
    r'^NM.*(?:LUNG|VEN|PERF)': 'Chest',
    r'^NM.*(?:BONE|BJTOT)': 'Whole Body',
    r'^NM.*(?:GES|GASTRIC)': 'Stomach',
}

def body_part_from_examcode(examcode: str, exam_desc: str = "") -> str:
    """Extract body part from EXAMCODE patterns using regex"""
    if pd.isna(examcode) or not examcode:
        return body_parts_from_desc(exam_desc) if exam_desc else "Unknown"
    
    code = str(examcode).upper().strip()
    desc = str(exam_desc).upper() if exam_desc else ""
    
    # For CT studies: ALWAYS check description first for multi-body-part combinations
    # This ensures "CT Abdomen Pelvis" is detected even if code is just "CTABC"
    if code.startswith('CT') and exam_desc:
        region = region_ct(desc)
        if region == "Chest/Abdomen/Pelvis":
            return "Chest, Abdomen, Pelvis"
        elif region == "Abdomen/Pelvis":
            return "Abdomen, Pelvis"
    
    # Try regex patterns in order (more specific first)
    # Convert to list to ensure order is preserved
    for pattern, body_part in list(BODY_PART_CODE_PATTERNS.items()):
        if re.match(pattern, code, re.IGNORECASE):
            # For CT studies, double-check description for combinations
            if code.startswith('CT') and exam_desc:
                region = region_ct(desc)
                if region == "Chest/Abdomen/Pelvis":
                    return "Chest, Abdomen, Pelvis"
                elif region == "Abdomen/Pelvis":
                    return "Abdomen, Pelvis"
            return body_part
    
    # Z code body part detection from description
    if code.startswith('Z') and exam_desc:
        desc_upper = str(exam_desc).upper()
        z_body_patterns = [
            (r'BONE\s+SCAN|3\s+PHASE\s+BONE', 'Whole Body'),
            (r'HIDA|HEPATOBILIARY', 'Liver'),
            (r'RENAL|MAG3', 'Renal'),
            (r'GASTRIC', 'Stomach'),
        ]
        for pattern, body_part in z_body_patterns:
            if re.search(pattern, desc_upper, re.IGNORECASE):
                return body_part
    
    # Fallback to description parsing
    return body_parts_from_desc(exam_desc) if exam_desc else "Unknown"

def is_angiography_or_venogram(modality: str, exam_desc: str) -> bool:
    """
    Determine if study is an angiography or venogram that should retain contrast info.
    These are studies where contrast is clinically essential to the exam definition.
    """
    # Check modality first
    if modality in ["CTA", "MRA", "MRV", "CTV"]:
        return True
    
    # Check description for angiography/venogram keywords
    desc_upper = str(exam_desc).upper()
    angio_keywords = [
        "ANGIOGRAPHY", "ANGIOGRAM", 
        "VENOGRAPHY", "VENOGRAM",
        "ARTERIOGRAPHY", "ARTERIOGRAM"
    ]
    
    return any(keyword in desc_upper for keyword in angio_keywords)

def exam_from_examcode(examcode: str, exam_desc: str = "") -> str:
    """
    Create exam name from EXAMCODE.
    
    NEW LOGIC: Only include contrast for angiography/venogram studies.
    """
    if pd.isna(examcode) or not examcode:
        return exam_from_desc(exam_desc) if exam_desc else "Other"
    
    modality = modality_from_examcode(examcode, exam_desc)
    body_part = body_part_from_examcode(examcode, exam_desc)
    
    # Check if this is an angiography/venogram
    is_angio = is_angiography_or_venogram(modality, exam_desc)
    
    # Get contrast info from description if available
    if is_angio and exam_desc:
        con = contrast_phrase(str(exam_desc).upper())
        if con:
            return f"{modality} {body_part} {con}"
    
    # For non-angio studies, never include contrast
    return f"{modality} {body_part}"

BODY_PART_PATTERNS = {
    "Head/Neck": r"\bHEAD|NECK|BRAIN|SKULL|ORBITS|FACIAL|SINUS|TEMPORAL|PITUITARY|CRANIAL|SKULL BASE\b",
    "Chest": r"\bCHEST|LUNG|THORAX\b",
    "Abdomen": r"\bABDOMEN|ABDOMINAL\b",
    "Pelvis": r"\bPELVIS\b|\bPELVIC\b",
    "Spine": r"\bSPINE|LUMBOSACRAL|L SPINE|T SPINE|C SPINE|CERVICAL|THORACIC|LUMBAR|SACRUM|COCCYX\b",
    "Upper Extremity": r"\bSHOULDER|ELBOW|WRIST|HAND|FINGER|HUMERUS|FOREARM|CLAVICLE|ARM\b",
    "Lower Extremity": r"\bHIP|KNEE|ANKLE|FOOT|TOE|FEMUR|TIBIA|FIBULA|THIGH|LEG\b",
    "Breast": r"\bBREAST|MAMMO\b",
    "Renal": r"\bRENAL|KIDNEY\b",
    "Cardiac": r"\bCARDIAC|HEART|ECHO\b",
    "Vascular": r"\bCAROTID|ARTERIAL|VENOUS|VEIN|ARTERY\b",
    "Liver": r"\bLIVER|HEPATOBILIARY|HEPATIC|HIDA\b",
    "Spleen": r"\bSPLEEN\b",
    "Stomach": r"\bSTOMACH|GASTRIC|ESOPHAGUS|SWALLOW\b",
    "Whole Body": r"\bWHOLE BODY|BONE SCAN|TUMOR IMAGING|SKULL BASE.*MID THIGH|SKULL BASE.*THIGH\b",
}

# Description-based modality patterns (order matters - more specific first)
DESC_MODALITY_PATTERNS = [
    (r'\bPET\s*/\s*CT|PET\s+CT', 'PET/CT'),
    (r'\bPET\b|POSITRON', 'PET'),
    (r'\bMRA\b|ANGIOGRAPHY|ANGIOGRAM', 'MRA'),  # Check before MRI
    (r'\bMRV\b|VENOGRAPHY|VENOGRAM', 'MRV'),  # Check before MRI
    (r'\bMRI\b|MR\s+', 'MRI'),
    (r'\bCTA\b|CT\s+ANGIOGRAPHY|CT\s+ANGIOGRAM', 'CTA'),  # Check before CT
    (r'\bCTV\b|CT\s+VENOGRAPHY|CT\s+VENOGRAM', 'CTV'),  # Check before CT
    (r'\bCT\b', 'CT'),
    (r'\bNM\s+|NUCLEAR\s+MEDICINE', 'Nuclear Medicine'),
    (r'\bUS\s+|ULTRASOUND', 'US'),
    (r'\bXR\s+|X-RAY', 'Radiography'),
    (r'\bFL\s+|FLUORO', 'Fluoroscopy'),
    (r'\bMAMMO|BREAST', 'Mammography'),
    (r'\bECHO\b', 'Echocardiography'),
]

def modality_from_desc(s: str) -> str:
    """Classify modality from description using regex patterns"""
    t = s.upper()
    
    # Try regex patterns in order (more specific first)
    for pattern, modality in DESC_MODALITY_PATTERNS:
        if re.search(pattern, t, re.IGNORECASE):
            return modality
    
    # Nuclear Medicine detection (priority over Invasive)
    # Check for NM keywords
    if any(re.search(keyword, t, re.IGNORECASE) for keyword in NM_KEYWORDS):
        # Exclude if already matched as other modalities
        if not re.search(r'\b(?:CT|MRI|MR\s+|US\s+|ULTRASOUND|XR\s+|X-RAY)\s+SCAN', t, re.IGNORECASE):
            return "Nuclear Medicine"
    
    # NM pattern: INJECTION/RADIOACTIVE + SCAN/PROCEDURE
    if (re.search(r'INJECTION|RADIOACTIVE|RADIONUCLIDE', t, re.IGNORECASE) and
        re.search(r'SCAN|PROCEDURE|STUDY|IMAGING', t, re.IGNORECASE)):
        if not re.search(r'\b(?:CT|MRI|MR\s+|US\s+|ULTRASOUND|XR\s+|X-RAY|BIOPSY|ASPIRATION|DRAINAGE)\b', t, re.IGNORECASE):
            return "Nuclear Medicine"
    
    # Head/Neck NM detection
    if any(re.search(keyword, t, re.IGNORECASE) for keyword in HEAD_NECK_KEYWORDS):
        if re.search(r'PROCEDURE|SCAN|INJECTION|STUDY|IMAGING|RADIOACTIVE', t, re.IGNORECASE):
            if not re.search(r'\b(?:CT|MRI|MR\s+|US\s+|ULTRASOUND|XR\s+|X-RAY|BIOPSY|ASPIRATION|DRAINAGE|CATHETER|STENT)\b', t, re.IGNORECASE):
                return "Nuclear Medicine"
    
    # Fallback: X-ray detection for common body parts
    if re.search(r'\b(?:CHEST|ABDOMEN|KNEE|HAND|FOOT|SHOULDER|ELBOW|ANKLE|WRIST|HIP|FEMUR|TIBIA|HUMERUS|FINGER|TOE|SPINE|PELVIS|CLAVICLE|RIBS|SINUS|TEMPORAL|FACIAL|ORBITS|SKULL|SACRUM|COCCYX)\b', t, re.IGNORECASE):
        return "Radiography"
    
    # Invasive procedures (last resort, very specific)
    invasive_patterns = [r'BIOPSY', r'ASPIRATION', r'DRAINAGE', r'CATHETERIZATION', r'STENT\s+PLACEMENT']
    nm_indicators = [r'SCAN', r'INJECTION', r'RADIOACTIVE', r'RADIONUCLIDE', r'NUCLEAR']
    
    if any(re.search(pattern, t, re.IGNORECASE) for pattern in invasive_patterns):
        if not any(re.search(indicator, t, re.IGNORECASE) for indicator in nm_indicators):
            return "Invasive"
    
    return "Other"

def contrast_phrase(t: str) -> str:
    if re.search(r"WITH( AND)? WITHOUT|W/.*AND.*W/O", t): return "w/ and w/o Contrast"
    if re.search(r"\bWITHOUT\b|\bW/O\b", t): return "w/o Contrast"
    if re.search(r"\bWITH\b|\bW/\b", t): return "w/ Contrast"
    return ""

def region_ct(t: str) -> str:
    has = lambda w: w in t
    if has("CHEST") and (has("ABDOMEN") or has("PELVIS")): return "Chest/Abdomen/Pelvis"
    if has("ABDOMEN") and has("PELVIS"): return "Abdomen/Pelvis"
    if has("CHEST"): return "Chest"
    if has("ABDOMEN"): return "Abdomen"
    if has("PELVIS"): return "Pelvis"
    return "Other"

def exam_from_desc(s: str) -> str:
    """
    Create exam name from description.
    
    NEW LOGIC: Only include contrast for angiography/venogram studies.
    """
    t = re.sub(r"\s+", " ", s.upper()).strip()
    mod = modality_from_desc(t)
    
    # Get body part
    body_part = body_parts_from_desc(t)
    if body_part == "Unknown":
        body_part = "Other"
    
    # Check if this is an angiography/venogram
    is_angio = is_angiography_or_venogram(mod, s)
    
    # Get contrast info
    con = contrast_phrase(t) if is_angio else ""
    
    # Format the exam name
    if mod == "Radiography":
        return f"Radiography {body_part}"
    else:
        # Only add contrast if it's angiography/venogram
        return f"{mod} {body_part}" + (f" {con}" if con else "")

def body_parts_from_desc(s: str) -> str:
    t = s.upper()
    
    # FIRST: Check for multi-body-part combinations (most specific first)
    # This must come before individual body part detection
    # Use region_ct for CT scans to catch all variations
    if "CT" in t:
        region = region_ct(t)
        if region == "Chest/Abdomen/Pelvis":
            return "Chest, Abdomen, Pelvis"
        elif region == "Abdomen/Pelvis":
            return "Abdomen, Pelvis"
    
    # Also check for other modalities with multi-body-part combinations
    if re.search(r'\b(?:CHEST|CH)\b.*\b(?:ABDOMEN|AB)\b.*\b(?:PELVIS|PE)\b', t, re.IGNORECASE) or \
       re.search(r'\b(?:ABDOMEN|AB)\b.*\b(?:PELVIS|PE)\b.*\b(?:CHEST|CH)\b', t, re.IGNORECASE) or \
       re.search(r'\b(?:PELVIS|PE)\b.*\b(?:CHEST|CH)\b.*\b(?:ABDOMEN|AB)\b', t, re.IGNORECASE):
        return "Chest, Abdomen, Pelvis"
    
    if re.search(r'\b(?:ABDOMEN|ABDOMINAL|AB)\b.*\b(?:PELVIS|PELVIC|PE)\b', t, re.IGNORECASE) or \
       re.search(r'\b(?:PELVIS|PELVIC|PE)\b.*\b(?:ABDOMEN|ABDOMINAL|AB)\b', t, re.IGNORECASE):
        return "Abdomen, Pelvis"
    
    # Now check for individual body parts
    found = [name for name, pat in BODY_PART_PATTERNS.items() if re.search(pat, t)]
    
    # Special handling for Nuclear Medicine exams
    if not found:
        # Check for specific NM exam types and infer body parts
        if re.search(r"\bRENAL|KIDNEY|MAG3\b", t):
            found = ["Renal"]
        elif re.search(r"\bLUNG|VENT|PERF\b", t):
            found = ["Chest"]
        elif re.search(r"\bBONE SCAN|3 PHASE BONE\b", t):
            found = ["Whole Body"]
        elif re.search(r"\bHEPATOBILIARY|HIDA|LIVER|SPLEEN\b", t):
            if "SPLEEN" in t:
                found = ["Liver", "Spleen"]
            else:
                found = ["Liver"]
        elif re.search(r"\bGASTRIC EMPTYING|STOMACH\b", t):
            found = ["Stomach"]
        elif re.search(r"\bBARIUM SWALLOW|ESOPHAGUS\b", t):
            found = ["Stomach"]  # Esophagus/Swallow studies
    
    # Check for PET scans with ranges (e.g., "SKULL BASE - MID THIGH")
    if re.search(r"SKULL.*THIGH|SKULL.*MID", t) and not found:
        found = ["Whole Body"]
    
    # Fallback for CT scans: use region detection
    # This should catch "CT Abdomen Pelvis" even if individual patterns matched first
    if "CT" in t:
        region = region_ct(t)
        if region != "Other":
            # Map region_ct results to body part names
            if region == "Chest/Abdomen/Pelvis":
                # Override any previous findings with the correct combination
                return "Chest, Abdomen, Pelvis"
            elif region == "Abdomen/Pelvis":
                # Override any previous findings with the correct combination
                return "Abdomen, Pelvis"
            elif region == "Chest":
                if not found or "Chest" not in [f for f in found]:
                    found = ["Chest"]
            elif region == "Abdomen":
                # Only use if we haven't already found Abdomen, Pelvis combination
                if not any("Pelvis" in f or "Abdomen, Pelvis" in f for f in found):
                    found = ["Abdomen"]
            elif region == "Pelvis":
                # Only use if we haven't already found Abdomen, Pelvis combination
                if not any("Abdomen" in f or "Abdomen, Pelvis" in f for f in found):
                    found = ["Pelvis"]
    
    # Fallback: if still nothing found, check for common terms
    if not found:
        if "CHEST" in t:
            found = ["Chest"]
        elif re.search(r"\bSCAN\b", t) and ("WHOLE" in t or "BODY" in t):
            found = ["Whole Body"]
        elif "PORTACATH" in t or "ACCESS" in t:
            found = ["Vascular"]  # Portacath access is typically vascular
    
    # Deduplicate while preserving order
    seen, out = set(), []
    for p in found:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return ", ".join(out) if out else "Unknown"

# ======================== HEADER ========================
APP_NAME = "Resident RVU Dashboard"
TAGLINE = "Analytics for radiology productivity tracking"

# Sidebar header
st.sidebar.title(APP_NAME)
st.sidebar.caption(TAGLINE)
st.sidebar.markdown("---")

# ======================== SIDEBAR - DATA INPUT ========================
st.sidebar.markdown("### Settings")
goal_rvu_per_day = st.sidebar.number_input(
    "Daily RVU Goal",
    min_value=0.0,
    value=15.0,
    step=0.5,
    help="Set your daily RVU target"
)

st.sidebar.markdown("---")
st.sidebar.markdown("### Upload Data")
st.sidebar.caption("Upload PS360 Resident Dictation Report Excel files")

up = st.sidebar.file_uploader(
    "Upload Data Files", 
    type=["csv", "txt", "xlsx", "xls"], 
    help="Drag and drop or select multiple PS360 Resident Dictation Report.xlsx files (they will be combined)",
    accept_multiple_files=True
)

# Load data
df = None
try:
    # With accept_multiple_files=True, up is always a list (even if empty)
    uploaded_files = up if up is not None else []
    
    if len(uploaded_files) > 0:
        all_dataframes = []
        excel_files = []
        csv_files = []
        
        # Process each uploaded file
        for uploaded_file in uploaded_files:
            file_extension = uploaded_file.name.split('.')[-1].lower() if '.' in uploaded_file.name else ''
            
            if file_extension in ['xlsx', 'xls']:
                # Process Excel file (PS360 format)
                try:
                    df_raw = process_excel_file(uploaded_file)
                    if not df_raw.empty:
                        all_dataframes.append(df_raw)
                        excel_files.append(uploaded_file.name)
                except Exception as e:
                    st.sidebar.warning(f"Error processing {uploaded_file.name}: {str(e)}")
            else:
                # Process CSV/TSV file
                try:
                    df_raw = pd.read_csv(uploaded_file)
                    if not df_raw.empty:
                        all_dataframes.append(df_raw)
                        csv_files.append(uploaded_file.name)
                except Exception as e:
                    st.sidebar.warning(f"Error processing {uploaded_file.name}: {str(e)}")
        
        # Combine all dataframes
        if all_dataframes:
            if len(all_dataframes) == 1:
                df_raw = all_dataframes[0]
            else:
                # Concatenate all dataframes
                df_raw = pd.concat(all_dataframes, ignore_index=True)
                # Remove completely empty rows
                df_raw = df_raw.dropna(how='all')
            
            # Process the combined dataframe
            df = process_dataframe(df_raw)
            
            # Show success message
            file_count = len(excel_files) + len(csv_files)
            if file_count == 1:
                file_name = excel_files[0] if excel_files else csv_files[0]
                st.sidebar.success(f"File uploaded: {file_name} ({len(df)} rows)")
            else:
                excel_count = len(excel_files)
                csv_count = len(csv_files)
                file_info = []
                if excel_count > 0:
                    file_info.append(f"{excel_count} Excel file{'s' if excel_count > 1 else ''}")
                if csv_count > 0:
                    file_info.append(f"{csv_count} CSV file{'s' if csv_count > 1 else ''}")
                st.sidebar.success(f"{len(uploaded_files)} file{'s' if len(uploaded_files) > 1 else ''} uploaded and combined ({len(df)} total rows)")
            
            # Update session state when new data is loaded
            st.session_state.processed_df = df
            # Clear filter session states when new data is loaded
            for key in ['time_filter_selected', 'modality_filter_selected', 'body_part_filter_selected', 'day_filter_selected', 'date_range_selected', 'reset_date_range']:
                if key in st.session_state:
                    del st.session_state[key]
        else:
            st.sidebar.error("No valid data found in uploaded files")
    elif 'processed_df' in st.session_state and st.session_state.processed_df is not None:
        # Use existing data from session state
        df = st.session_state.processed_df
except Exception as e:
    st.error(f"Error processing data: {str(e)}")
    st.stop()

if df is None:
    st.stop()

# Store in session state for other pages
st.session_state.processed_df = df
st.session_state.goal_rvu_per_day = goal_rvu_per_day

# Check if data includes time information and show notification
if not check_time_data(df):
    st.toast("Tip: Including time data (HH:MM) in your dates adds hourly insights and better efficiency analysis")

# ======================== FILTERS ========================
st.sidebar.markdown("---")
st.sidebar.markdown("### Filters")

# Date range filter
min_date = df["date"].min()
max_date = df["date"].max()

# Initialize session state for date range
if 'date_range_selected' not in st.session_state:
    st.session_state.date_range_selected = (min_date, max_date)

# Check if reset button was clicked
if 'reset_date_range' in st.session_state and st.session_state.reset_date_range:
    st.session_state.date_range_selected = (min_date, max_date)
    st.session_state.reset_date_range = False

date_range = st.sidebar.date_input(
    "Date Range",
    value=st.session_state.date_range_selected,
    min_value=min_date,
    max_value=max_date,
    help="Select a date range to filter the data",
    key="date_range_input"
)

# Update session state with current selection
if len(date_range) == 2:
    st.session_state.date_range_selected = date_range
elif len(date_range) == 1:
    st.session_state.date_range_selected = (date_range[0], date_range[0])

# Add button to select all dates
if st.sidebar.button("Select All Dates", key="date_all", use_container_width=True):
    st.session_state.date_range_selected = (min_date, max_date)
    st.session_state.reset_date_range = True
    st.rerun()

# Time of day filter
available_hours = sorted(df["hour"].dropna().unique())
if len(available_hours) > 0:
    # Initialize session state for time filter
    if 'time_filter_selected' not in st.session_state:
        st.session_state.time_filter_selected = available_hours
    
    time_filter = st.sidebar.multiselect(
        "Time of Day (Hour)",
        options=available_hours,
        default=st.session_state.time_filter_selected,
        help="Select specific hours of the day to include",
        key="time_filter"
    )
    
    col_time1, col_time2 = st.sidebar.columns(2)
    with col_time1:
        if st.button("Select All", key="time_all", use_container_width=True):
            st.session_state.time_filter_selected = available_hours
            st.rerun()
    with col_time2:
        if st.button("Clear", key="time_clear", use_container_width=True):
            st.session_state.time_filter_selected = []
            st.rerun()
    
    # Update session state with current selection
    st.session_state.time_filter_selected = time_filter
else:
    time_filter = []

# Modality filter
available_modalities = sorted(df["Modality"].dropna().unique())
if len(available_modalities) > 0:
    # Initialize session state for modality filter
    if 'modality_filter_selected' not in st.session_state:
        st.session_state.modality_filter_selected = available_modalities
    
    modality_filter = st.sidebar.multiselect(
        "Modality",
        options=available_modalities,
        default=st.session_state.modality_filter_selected,
        help="Select imaging modalities to include",
        key="modality_filter"
    )
    
    col_mod1, col_mod2 = st.sidebar.columns(2)
    with col_mod1:
        if st.button("Select All", key="modality_all", use_container_width=True):
            st.session_state.modality_filter_selected = available_modalities
            st.rerun()
    with col_mod2:
        if st.button("Clear", key="modality_clear", use_container_width=True):
            st.session_state.modality_filter_selected = []
            st.rerun()
    
    # Update session state with current selection
    st.session_state.modality_filter_selected = modality_filter
else:
    modality_filter = []

# Body part filter
available_body_parts = sorted(df["Body Part"].dropna().unique())
if len(available_body_parts) > 0:
    # Initialize session state for body part filter
    if 'body_part_filter_selected' not in st.session_state:
        st.session_state.body_part_filter_selected = available_body_parts
    
    body_part_filter = st.sidebar.multiselect(
        "Body Part",
        options=available_body_parts,
        default=st.session_state.body_part_filter_selected,
        help="Select body parts to include",
        key="body_part_filter"
    )
    
    col_bp1, col_bp2 = st.sidebar.columns(2)
    with col_bp1:
        if st.button("Select All", key="body_part_all", use_container_width=True):
            st.session_state.body_part_filter_selected = available_body_parts
            st.rerun()
    with col_bp2:
        if st.button("Clear", key="body_part_clear", use_container_width=True):
            st.session_state.body_part_filter_selected = []
            st.rerun()
    
    # Update session state with current selection
    st.session_state.body_part_filter_selected = body_part_filter
else:
    body_part_filter = []

# Day of week filter
available_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
days_in_data = sorted(df["dow"].dropna().unique())
if len(days_in_data) > 0:
    # Initialize session state for day filter
    if 'day_filter_selected' not in st.session_state:
        st.session_state.day_filter_selected = days_in_data
    
    day_filter = st.sidebar.multiselect(
        "Day of Week",
        options=available_days,
        default=st.session_state.day_filter_selected,
        help="Select days of the week to include",
        key="day_filter"
    )
    
    col_day1, col_day2 = st.sidebar.columns(2)
    with col_day1:
        if st.button("Select All", key="day_all", use_container_width=True):
            st.session_state.day_filter_selected = available_days
            st.rerun()
    with col_day2:
        if st.button("Clear", key="day_clear", use_container_width=True):
            st.session_state.day_filter_selected = []
            st.rerun()
    
    # Update session state with current selection
    st.session_state.day_filter_selected = day_filter
else:
    day_filter = []

# Apply filters
df_filtered = df.copy()

# Date range filter
if len(date_range) == 2:
    start_date, end_date = date_range
    df_filtered = df_filtered[
        (df_filtered["date"] >= start_date) & 
        (df_filtered["date"] <= end_date)
    ]
elif len(date_range) == 1:
    df_filtered = df_filtered[df_filtered["date"] == date_range[0]]

# Time filter
if time_filter:
    df_filtered = df_filtered[df_filtered["hour"].isin(time_filter)]

# Modality filter
if modality_filter:
    df_filtered = df_filtered[df_filtered["Modality"].isin(modality_filter)]

# Body part filter
if body_part_filter:
    df_filtered = df_filtered[df_filtered["Body Part"].isin(body_part_filter)]

# Day of week filter
if day_filter:
    df_filtered = df_filtered[df_filtered["dow"].isin(day_filter)]

# Show filter summary and reset button
original_count = len(df)
filtered_count = len(df_filtered)
filters_active = filtered_count != original_count

if filters_active:
    st.sidebar.markdown("---")
    st.sidebar.caption(f"Showing {filtered_count:,} of {original_count:,} records")
    
    # Reset filters button
    if st.sidebar.button("Reset All Filters", use_container_width=True):
        # Clear all filter session states
        for key in ['time_filter_selected', 'modality_filter_selected', 'body_part_filter_selected', 'day_filter_selected', 'date_range_selected', 'reset_date_range']:
            if key in st.session_state:
                del st.session_state[key]
        st.rerun()

# Check if filtered data is empty
if df_filtered.empty:
    st.warning("No data matches the selected filters. Please adjust your filter criteria.")
    st.stop()

# Use filtered dataframe for all calculations
df = df_filtered

# ======================== MAIN PAGE HEADER ========================
# Title removed

# ======================== COMPUTE METRICS ========================
total_rvu = df["WRVU ESTIMATE"].sum()
cases = len(df)
rvu_per_case = total_rvu / cases if cases else 0
days_worked = df["date"].nunique()
avg_cases_day = cases / days_worked if days_worked else 0
avg_rvu_day = total_rvu / days_worked if days_worked else 0

date_range = (df["date"].max() - df["date"].min()).days + 1
work_efficiency = (days_worked / date_range * 100) if date_range > 0 else 0

peak_hour = int(df.groupby("hour")["WRVU ESTIMATE"].sum().idxmax()) if not df.empty else None
peak_dow = df.groupby("dow")["WRVU ESTIMATE"].sum().idxmax() if not df.empty else None

# Calculate daily data for additional KPIs
daily_for_kpis = df.groupby("date", as_index=False)["WRVU ESTIMATE"].sum().rename(columns={"WRVU ESTIMATE": "RVU"}).sort_values("date")
daily_for_kpis["MA7"] = daily_for_kpis["RVU"].rolling(7, min_periods=1).mean()
trend_slope_kpi = np.polyfit(range(len(daily_for_kpis)), daily_for_kpis["RVU"], 1)[0] if len(daily_for_kpis) > 1 else 0
target_hit_rate_kpi = (daily_for_kpis["RVU"] >= goal_rvu_per_day).mean() * 100
best_day_rvu_kpi = daily_for_kpis['RVU'].max()
best_day_date_kpi = daily_for_kpis.loc[daily_for_kpis['RVU'].idxmax(), 'date']
# Format best day date
if hasattr(best_day_date_kpi, 'strftime'):
    best_day_date_str_kpi = best_day_date_kpi.strftime('%m/%d/%Y')
elif isinstance(best_day_date_kpi, pd.Timestamp):
    best_day_date_str_kpi = best_day_date_kpi.strftime('%m/%d/%Y')
else:
    best_day_date_str_kpi = str(best_day_date_kpi)

# ======================== OVERVIEW METRICS ========================
st.header("Performance Overview")

# Calculate key metrics for resident benchmarking
annual_projection = (total_rvu / days_worked) * 250 if days_worked > 0 else 0
rvu_per_hour = avg_rvu_day / 8 if avg_rvu_day > 0 else 0  # Assuming 8-hour workday

# Resident-specific benchmarks
resident_daily_target = goal_rvu_per_day  # User-defined target
resident_hourly_target = goal_rvu_per_day / 8  # RVUs per hour target (8-hour workday)

# Performance status indicators
daily_status = "Above target" if avg_rvu_day >= resident_daily_target else "Near target" if avg_rvu_day >= resident_daily_target * 0.7 else "Below target"
hourly_status = "Above target" if rvu_per_hour >= resident_hourly_target else "Near target" if rvu_per_hour >= resident_hourly_target * 0.7 else "Below target"

# Main performance metrics
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric(
        "Daily RVUs", 
        f"{avg_rvu_day:.1f}", 
        f"{avg_rvu_day - resident_daily_target:+.1f}",
        help="Daily RVU performance vs your goal"
    )
    st.caption(daily_status)

with col2:
    st.metric(
        "RVUs per Hour", 
        f"{rvu_per_hour:.1f}", 
        f"{rvu_per_hour - resident_hourly_target:+.1f}",
        help="Hourly efficiency based on 8-hour workday"
    )
    st.caption(hourly_status)

with col3:
    st.metric(
        "Cases per Day", 
        f"{avg_cases_day:.1f}", 
        help="Average case volume per day"
    )

with col4:
    st.metric(
        "RVUs per Case", 
        f"{rvu_per_case:.2f}", 
        help="Case complexity (higher = more complex)"
    )

# Additional KPIs row
col5, col6, col7, col8 = st.columns(4)
with col5:
    st.metric(
        "Target Hit Rate",
        f"{target_hit_rate_kpi:.0f}%",
        help="% of days meeting your goal"
    )
with col6:
    st.metric(
        "7-Day Average",
        f"{daily_for_kpis['MA7'].iloc[-1]:.1f}",
        help="Recent 7-day moving average"
    )
with col7:
    trend_direction_kpi = "Increasing" if trend_slope_kpi > 0 else "Decreasing" if trend_slope_kpi < 0 else "Stable"
    st.metric(
        "Trend",
        f"{trend_direction_kpi}",
        f"{trend_slope_kpi:+.2f} RVUs/day",
        help="Daily RVU change trend"
    )
with col8:
    st.metric(
        "Best Day",
        f"{best_day_date_str_kpi}",
        f"{best_day_rvu_kpi:.1f} RVUs",
        help=f"Highest single-day RVUs: {best_day_rvu_kpi:.1f}"
    )

# ======================== WORKFLOW ANALYSIS ========================
st.divider()
st.subheader("Daily Performance Trend")

# Prepare data for key insights
daily = df.groupby("date", as_index=False)["WRVU ESTIMATE"].sum().rename(columns={"WRVU ESTIMATE": "RVU"}).sort_values("date")
daily["MA7"] = daily["RVU"].rolling(7, min_periods=1).mean()
# Convert date to datetime for proper temporal encoding in Altair
daily["date_dt"] = pd.to_datetime(daily["date"])
# Create numeric date for curve fitting (days since first date)
daily["date_num"] = (daily["date_dt"] - daily["date_dt"].min()).dt.days

# Calculate adaptive polynomial degree based on data points
num_data_points = len(daily)
if num_data_points <= 30:
    poly_degree = 2
elif num_data_points <= 90:
    poly_degree = 3
else:
    poly_degree = 4

# Calculate polynomial fit with confidence intervals
if len(daily) > poly_degree:
    z = np.polyfit(daily["date_num"], daily["RVU"], poly_degree)
    p = np.poly1d(z)
    daily["trend_fit"] = p(daily["date_num"])
    
    # Calculate residuals and standard error for confidence intervals
    residuals = daily["RVU"] - daily["trend_fit"]
    mse = np.mean(residuals**2)
    std_error = np.sqrt(mse)
    
    # Calculate 95% confidence intervals (approximately 2 standard errors)
    daily["trend_upper"] = daily["trend_fit"] + 2 * std_error
    daily["trend_lower"] = daily["trend_fit"] - 2 * std_error
else:
    daily["trend_fit"] = daily["RVU"]
    daily["trend_upper"] = daily["RVU"]
    daily["trend_lower"] = daily["RVU"]
daily_avg = daily["RVU"].mean()
trend_slope = np.polyfit(range(len(daily)), daily["RVU"], 1)[0] if len(daily) > 1 else 0

# Calculate best day data for highlighting
best_day_rvu = daily['RVU'].max()
best_day_date = daily.loc[daily['RVU'].idxmax(), 'date']
best_day_date_str = best_day_date.strftime('%m/%d/%Y')

# Daily Performance Trend Chart
with st.container():
    # Create best day highlight data
    best_day_data = daily[daily['date'] == best_day_date].copy()
    # Ensure date_dt is set for best_day_data
    if 'date_dt' not in best_day_data.columns:
        best_day_data['date_dt'] = pd.to_datetime(best_day_data['date'])
    
    # Calculate date range for adaptive x-axis
    date_span = (daily['date'].max() - daily['date'].min()).days
    num_points = len(daily)
    
    # Determine axis configuration based on date range
    if date_span <= 30:
        # Short range: show daily, format as MM/DD
        axis_config = alt.Axis(
            title=None,
            format="%m/%d",
            labelAngle=-45,
            tickCount=min(num_points, 10)
        )
    elif date_span <= 90:
        # Medium range: show weekly, format as MM/DD
        axis_config = alt.Axis(
            title=None,
            format="%m/%d",
            labelAngle=-45,
            tickCount=min(date_span // 7, 12)
        )
    else:
        # Long range: show monthly, format as MM/YYYY
        axis_config = alt.Axis(
            title=None,
            format="%b %Y",
            labelAngle=-45,
            tickCount=min(date_span // 30, 12)
        )
    
    # Create confidence interval area
    confidence_area = alt.Chart(daily).mark_area(
        opacity=0.2,
        color=COLORS['trend']
    ).encode(
        x=alt.X("date_dt:T", axis=axis_config),
        y=alt.Y("trend_lower:Q", title="Daily RVUs"),
        y2=alt.Y2("trend_upper:Q"),
        tooltip=[
            alt.Tooltip("date_dt:T", format="%B %d, %Y"),
            alt.Tooltip("trend_lower:Q", format=".1f", title="Lower CI"),
            alt.Tooltip("trend_upper:Q", format=".1f", title="Upper CI")
        ]
    )
    
    # Create trend line (semi-transparent)
    trend_line = alt.Chart(daily).mark_line(
        strokeWidth=2.5,
        color=COLORS['trend'],
        opacity=0.7
    ).encode(
        x=alt.X("date_dt:T", axis=axis_config),
        y=alt.Y("trend_fit:Q", title="Daily RVUs", scale=alt.Scale(zero=False)),
        tooltip=[alt.Tooltip("date_dt:T", format="%B %d, %Y"), alt.Tooltip("trend_fit:Q", format=".1f", title="Trend")]
    )
    
    # Create scatter dots for daily data
    scatter_dots = alt.Chart(daily).mark_circle(
        size=60,
        color=COLORS['primary'],
        opacity=0.6
    ).encode(
        x=alt.X("date_dt:T", axis=axis_config),
        y=alt.Y("RVU:Q", title="Daily RVUs", scale=alt.Scale(zero=False)),
        tooltip=[alt.Tooltip("date_dt:T", format="%B %d, %Y"), alt.Tooltip("RVU:Q", format=".1f")]
    )
    
    daily_chart = (
        confidence_area +
        trend_line +
        scatter_dots +
        alt.Chart(pd.DataFrame({'y': [resident_daily_target]})).mark_rule(
            strokeDash=[3, 3], color=COLORS['target'], strokeWidth=2
        ).encode(y='y:Q') +
        alt.Chart(best_day_data).mark_circle(
            size=100, color=COLORS['highlight'], stroke=COLORS['text_dark'], strokeWidth=2
        ).encode(
            x=alt.X("date_dt:T", axis=axis_config),
            y="RVU:Q",
            tooltip=[
                alt.Tooltip("date_dt:T", format="%B %d, %Y", title="Best Day"),
                alt.Tooltip("RVU:Q", format=".1f", title="RVUs")
            ]
        )
    ).properties(
        height=300
    )
    
    st.altair_chart(daily_chart, use_container_width=True)
    st.caption(f"This chart shows your daily RVU production over time as scatter points, with a trend curve fit (semi-transparent green line) and 95% confidence intervals (shaded green area). The red line indicates your target, and the highlighted point shows your best performing day.")

# ======================== EFFICIENCY ANALYSIS ========================
st.subheader("Hourly Efficiency Analysis")
with st.container():
    hourly_data = df.groupby("hour", as_index=False)["WRVU ESTIMATE"].sum().rename(columns={"WRVU ESTIMATE": "RVU"})
    # Filter to only show hours >= 8am
    hourly_data = hourly_data[hourly_data["hour"] >= 8]
    hourly_data["RVU_per_hour"] = hourly_data["RVU"] / len(daily)  # Approximate RVUs per hour
    hourly_data["Efficiency"] = hourly_data["RVU_per_hour"] / resident_hourly_target * 100

    efficiency_chart = alt.Chart(hourly_data).mark_bar().encode(
        x=alt.X("hour:O", title="Hour of Day"),
        y=alt.Y("RVU_per_hour:Q", title="Average RVUs per Hour"),
        color=alt.condition(
            alt.datum.RVU_per_hour >= resident_hourly_target,
            alt.value(COLORS['success']),  # Emerald for meeting target
            alt.value(COLORS['warning'])   # Amber for below target
        ),
        tooltip=["hour:O", alt.Tooltip("RVU_per_hour:Q", format=".2f")]
    ).properties(
        height=250
    )

    st.altair_chart(efficiency_chart, use_container_width=True)
    st.caption(f"This chart displays your average RVU production by hour of day. Bars meeting or exceeding your hourly target ({resident_hourly_target:.1f} RVUs/hour) are shown in green, while those below target are in amber.")

# ======================== CASE MIX ANALYSIS ========================
st.subheader("Case Mix Analysis")

# Group by both modality and body part
mix = df.groupby(["Modality", "Body Part"], as_index=False)["WRVU ESTIMATE"].sum().rename(columns={"WRVU ESTIMATE": "RVU"})
mix["Cases"] = df.groupby(["Modality", "Body Part"]).size().values
mix["Label"] = mix["Modality"] + " - " + mix["Body Part"]

# Get top 5 and sort by total RVUs in descending order (highest at top)
mix = mix.nlargest(5, "RVU").sort_values("RVU", ascending=False)

# Create two-column layout for bar chart and pie chart
col1, col2 = st.columns(2)

with col1:
    # Create horizontal bar chart with labels on y-axis
    bar_chart = alt.Chart(mix).mark_bar().encode(
        x=alt.X("RVU:Q", title="Total RVUs"),
        y=alt.Y("Label:N", title="Modality - Body Part", sort=None),
        color=alt.Color("Modality:N", legend=alt.Legend(title="Modality"), scale=alt.Scale(scheme="category10")),
        tooltip=["Label", alt.Tooltip("RVU:Q", format=".1f"), alt.Tooltip("Cases:Q")]
    )

    # Add text labels at the end of bars
    text_layer = bar_chart.mark_text(
        align='left',
        baseline='middle',
        dx=3,  # Nudge text to the right of the bar
        color=COLORS['text_light']  # Use white text for better contrast
    ).encode(
        x=alt.X("RVU:Q"),
        y=alt.Y("Label:N", sort=None),
        text=alt.Text("RVU:Q", format=".1f")  # Format RVU to one decimal place
    )

    chart = (bar_chart + text_layer).properties(
        height=300
    )
    
    st.altair_chart(chart, use_container_width=True)
    st.caption("This chart shows your top 5 modality-body part combinations ranked by total RVUs generated, helping identify your most productive exam types.")

with col2:
    # Create pie chart showing total RVUs per modality
    modality_totals = df.groupby("Modality", as_index=False)["WRVU ESTIMATE"].sum().rename(columns={"WRVU ESTIMATE": "RVU"})
    
    # Create pie chart base
    pie_base = alt.Chart(modality_totals).encode(
        theta=alt.Theta("RVU:Q", stack=True)
    )
    
    # Create pie arcs
    pie_arcs = pie_base.mark_arc(outerRadius=120).encode(
        color=alt.Color("Modality:N", legend=alt.Legend(title="Modality"), scale=alt.Scale(scheme="category10")),
        order=alt.Order("RVU:Q", sort="descending"),
        tooltip=["Modality", alt.Tooltip("RVU:Q", format=".1f")]
    )
    
    # Add text labels on pie slices
    pie_text = pie_base.mark_text(radius=140).encode(
        text=alt.Text("RVU:Q", format=".1f"),
        order=alt.Order("RVU:Q", sort="descending"),
        color=alt.value(COLORS['text_light'])  # Use white text for better contrast
    )
    
    pie_chart = (pie_arcs + pie_text).properties(
        height=300
    )
    
    st.altair_chart(pie_chart, use_container_width=True)
    st.caption("This pie chart shows the distribution of total RVUs across different imaging modalities, revealing which types of studies contribute most to your productivity.")

# ======================== STUDY SUMMARY TABLE ========================
st.divider()
st.subheader("Study Summary Table")

# Calculate total RVU and total cases for percentage calculations
total_rvu_all = df["WRVU ESTIMATE"].sum()
total_cases_all = len(df)

# Group by Exam (regex'd study names) and calculate summary metrics
summary = df.groupby("Exam").agg({
    "WRVU ESTIMATE": [
        ("Total_RVU", "sum"),
        ("Avg_RVU", "mean"),
        ("Count", "count")
    ]
}).reset_index()

# Flatten column names
summary.columns = ["Exam", "Total_RVU", "Avg_RVU", "Count"]

# Calculate percentages
summary["%_of_Total_RVU"] = (summary["Total_RVU"] / total_rvu_all * 100) if total_rvu_all > 0 else 0
summary["%_of_Total_Cases"] = (summary["Count"] / total_cases_all * 100) if total_cases_all > 0 else 0

# Identify unknown/uncategorized studies (those with "Other" or "Unknown" in Exam field)
unknown_mask = summary["Exam"].str.contains("Other|Unknown", case=False, na=False)
unknown_studies = summary[unknown_mask].copy()
known_studies = summary[~unknown_mask].copy()

# Sort known studies by Total RVU descending
known_studies = known_studies.sort_values("Total_RVU", ascending=False).reset_index(drop=True)

# Aggregate unknown/uncategorized studies into a single row
if not unknown_studies.empty:
    unknown_row = pd.DataFrame({
        "Exam": ["Unknown/Uncategorized Studies"],
        "Total_RVU": [unknown_studies["Total_RVU"].sum()],
        "Avg_RVU": [unknown_studies["Total_RVU"].sum() / unknown_studies["Count"].sum() if unknown_studies["Count"].sum() > 0 else 0],
        "Count": [unknown_studies["Count"].sum()],
        "%_of_Total_RVU": [(unknown_studies["Total_RVU"].sum() / total_rvu_all * 100) if total_rvu_all > 0 else 0],
        "%_of_Total_Cases": [(unknown_studies["Count"].sum() / total_cases_all * 100) if total_cases_all > 0 else 0]
    })
    
    # Combine known studies with unknown row at the end
    summary_display = pd.concat([known_studies, unknown_row], ignore_index=True)
else:
    summary_display = known_studies.copy()

# Format the summary table for display
summary_display["Total_RVU"] = summary_display["Total_RVU"].round(2)
summary_display["Avg_RVU"] = summary_display["Avg_RVU"].round(2)
summary_display["%_of_Total_RVU"] = summary_display["%_of_Total_RVU"].round(1)
summary_display["%_of_Total_Cases"] = summary_display["%_of_Total_Cases"].round(1)

# Rename columns for better display
summary_display = summary_display.rename(columns={
    "Exam": "Study Type",
    "Count": "Total Count",
    "Total_RVU": "Total RVU",
    "Avg_RVU": "Avg RVU",
    "%_of_Total_RVU": "% of Total RVU",
    "%_of_Total_Cases": "% of Total Cases"
})

# Display the summary table
st.dataframe(
    summary_display[["Study Type", "Total Count", "Total RVU", "Avg RVU", "% of Total RVU", "% of Total Cases"]],
    use_container_width=True,
    hide_index=True,
    height=400
)

# Display summary statistics
col1, col2, col3 = st.columns(3)
with col1:
    # Count unique study types: known studies + 1 for unknown/uncategorized (if any)
    unique_count = len(known_studies) + (1 if not unknown_studies.empty else 0)
    st.metric("Unique Study Types", unique_count)
with col2:
    st.metric("Total Studies", f"{total_cases_all:,}")
with col3:
    st.metric("Total RVU", f"{total_rvu_all:.1f}")

st.caption("This table summarizes all unique study types (regex'd from exam descriptions) with comprehensive metrics including counts, RVU statistics, and percentage contributions to overall productivity.")

# ======================== SCHEDULE OPTIMIZATION ========================
st.subheader("Schedule Optimization")
with st.container():
    dow_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    hot = df.groupby(["dow", "hour"], as_index=False)["WRVU ESTIMATE"].sum().rename(columns={"WRVU ESTIMATE": "RVU"})
    # Filter to only show hours >= 8am
    hot = hot[hot["hour"] >= 8]
    hot["dow"] = pd.Categorical(hot["dow"], categories=dow_order, ordered=True)

    heatmap = alt.Chart(hot).mark_rect().encode(
        x=alt.X("hour:O", title="Hour of Day"),
        y=alt.Y("dow:O", title="Day of Week", sort=dow_order),
        color=alt.Color("RVU:Q", scale=alt.Scale(scheme="blues"), title="RVUs"),
        tooltip=["dow", "hour", alt.Tooltip("RVU:Q", format=".1f")]
    ).properties(
        height=300
    )

    st.altair_chart(heatmap, use_container_width=True)
    st.caption("This heatmap visualizes your RVU production across days of the week and hours of the day. Darker shades indicate higher productivity periods, helping identify optimal times to schedule complex cases.")

# Schedule optimization insight - show top 3 and bottom 3 performance periods by schedule type
if not hot.empty:
    # Sort by RVU descending
    sorted_hot = hot.sort_values('RVU', ascending=False)
    
    if len(sorted_hot) >= 3:
        # Get top 3 and bottom 3
        top_3 = sorted_hot.head(3)
        bottom_3 = sorted_hot.tail(3).sort_values('RVU', ascending=False)  # Sort descending for bottom 3
        
        # Categorize periods by schedule type
        def categorize_hour(hour):
            """Categorize hour into work schedule, call, or other"""
            if 8 <= hour <= 12:  # 8am-12pm (inclusive)
                return "work"
            elif 13 <= hour < 17:  # 1pm-5pm
                return "work"
            elif 17 <= hour < 23:  # 5pm-11pm
                return "call"
            else:
                return "other"  # Hours outside work/call: before 8am, after 11pm
        
        # Categorize top 3 and bottom 3
        top_work = []
        top_call = []
        top_other = []
        bottom_work = []
        bottom_call = []
        bottom_other = []
        
        for _, row in top_3.iterrows():
            dow = row['dow']
            hour = int(row['hour'])
            rvu = row['RVU']
            category = categorize_hour(hour)
            period_str = f"{dow} at {hour}:00 ({rvu:.1f} RVUs)"
            if category == "work":
                top_work.append(period_str)
            elif category == "call":
                top_call.append(period_str)
            else:
                top_other.append(period_str)
        
        for _, row in bottom_3.iterrows():
            dow = row['dow']
            hour = int(row['hour'])
            rvu = row['RVU']
            category = categorize_hour(hour)
            period_str = f"{dow} at {hour}:00 ({rvu:.1f} RVUs)"
            if category == "work":
                bottom_work.append(period_str)
            elif category == "call":
                bottom_call.append(period_str)
            else:
                bottom_other.append(period_str)
        
        # Build display text
        periods_text = "**Performance Periods**\n\n"
        
        # Top 3 section
        periods_text += "**Top 3**:\n"
        if top_work:
            periods_text += "  **Work Schedule (8am-12pm, 1pm-5pm)**:\n"
            for period in top_work:
                periods_text += f"    • {period}\n"
        else:
            periods_text += "  **Work Schedule (8am-12pm, 1pm-5pm)**:\n    No work hours\n"
        
        periods_text += "  **Call Schedule (5pm-11pm)**:\n"
        if top_call:
            for period in top_call:
                periods_text += f"    • {period}\n"
        else:
            periods_text += "    No call hours\n"
        
        if top_other:
            periods_text += "  **Other Hours** (outside work/call schedule):\n"
            for period in top_other:
                periods_text += f"    • {period}\n"
        
        periods_text += "\n"
        
        # Bottom 3 section
        periods_text += "**Bottom 3**:\n"
        if bottom_work:
            periods_text += "  **Work Schedule (8am-12pm, 1pm-5pm)**:\n"
            for period in bottom_work:
                periods_text += f"    • {period}\n"
        else:
            periods_text += "  **Work Schedule (8am-12pm, 1pm-5pm)**:\n    No work hours\n"
        
        periods_text += "  **Call Schedule (5pm-11pm)**:\n"
        if bottom_call:
            for period in bottom_call:
                periods_text += f"    • {period}\n"
        else:
            periods_text += "    No call hours\n"
        
        if bottom_other:
            periods_text += "  **Other Hours** (outside work/call schedule):\n"
            for period in bottom_other:
                periods_text += f"    • {period}\n"
        
        periods_text += "\nConsider scheduling your most complex cases during the top periods for maximum efficiency."
        st.info(periods_text)
    else:
        # Fallback to single peak if not enough data
        peak_row = hot.loc[hot['RVU'].idxmax()]
        peak_dow_actual = peak_row['dow']
        peak_hour_actual = int(peak_row['hour'])
        st.info(f"**Peak Performance Period**: {peak_dow_actual} at {peak_hour_actual}:00. Consider scheduling your most complex cases during this time for maximum efficiency.")
elif peak_hour is not None and peak_dow is not None:
    st.info(f"**Peak Performance Period**: {peak_dow} at {peak_hour}:00. Consider scheduling your most complex cases during this time for maximum efficiency.")

