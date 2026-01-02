import io, re, os
from datetime import datetime
import pandas as pd
import numpy as np
import altair as alt
import streamlit as st
from functools import lru_cache

# PDF generation removed

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
    
    df = df_raw.rename(columns=cols_map)
    need = {"DICTATION DTTM", "EXAM DESC", "WRVU ESTIMATE"}
    missing = need - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns: {sorted(missing)}")
    
    df = df[["DICTATION DTTM", "EXAM DESC", "WRVU ESTIMATE"]].copy()
    df["DICTATION DTTM"] = pd.to_datetime(df["DICTATION DTTM"], errors="coerce")
    df["WRVU ESTIMATE"] = pd.to_numeric(df["WRVU ESTIMATE"], errors="coerce")
    df = df.dropna(subset=["DICTATION DTTM", "WRVU ESTIMATE"])
    
    # Enrichment
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

def modality_from_desc(s: str) -> str:
    t = s.upper()
    
    # MRI variations
    if any(x in t for x in ["MRI", "MR "]):
        if "MRA" in t: return "MRA"
        if "MRV" in t: return "MRV"
        return "MRI"
    
    # CT variations
    if "CT" in t:
        if "CTA" in t: return "CTA"
        return "CT"
    
    # Ultrasound variations
    if any(x in t for x in ["US ", "ULTRASOUND", "DUPLEX", "DUP "]):
        if "DUPLEX" in t or "DUP " in t: return "US - Duplex"
        if "OBSTETRICAL" in t or "PREGNANCY" in t: return "US - Obstetrical"
        if "PROCEDURE" in t: return "US Procedure"
        return "US"
    
    # X-ray variations
    if any(x in t for x in ["XR ", "X-RAY", "CHEST", "ABDOMEN", "KNEE", "HAND", "FOOT", "SHOULDER", "ELBOW", "ANKLE", "WRIST", "HIP", "FEMUR", "TIBIA", "HUMERUS", "FINGER", "TOE", "SPINE", "PELVIS", "CLAVICLE", "RIBS", "SINUS", "TEMPORAL", "FACIAL", "ORBITS", "SKULL", "SACRUM", "COCCYX"]):
        return "Radiography"
    
    # Fluoroscopy variations
    if any(x in t for x in ["FL ", "FLUORO", "BARIUM", "LUMBAR PUNCTURE", "SP "]):
        if "DYNAMIC" in t: return "Fluoroscopy - Dynamic"
        if "GUIDANCE" in t: return "Fluoroscopy Guidance"
        return "Fluoroscopy"
    
    # Mammography variations
    if any(x in t for x in ["MAMMO", "BREAST"]):
        if "PROCEDURE" in t or "BIOPSY" in t: return "Mammography Procedure"
        return "Mammography"
    
    # Echocardiography
    if "ECHO" in t: return "Echocardiography"
    
    # PET variations (check before CT to catch PET/CT)
    if any(x in t for x in ["PET", "POSITRON"]):
        if "PET/CT" in t or "PET CT" in t: return "PET/CT"
        return "PET"
    
    # Nuclear Medicine variations (check for specific NM patterns)
    if any(x in t for x in ["NM ", "NUCLEAR MEDICINE"]):
        return "Nuclear Medicine"
    # Check for specific nuclear medicine exam types
    if any(x in t for x in ["HIDA", "BONE SCAN", "RENAL SCAN", "LUNG VENT", "PERF SCAN", "GASTRIC EMPTYING", "MAG3", "LASIX", "HEPATOBILIARY DUCTAL", "LIVER AND SPLEEN IMAGING"]):
        # Exclude if already matched as other modalities (e.g., CT SCAN, MRI SCAN)
        if not any(x in t for x in ["CT", "MRI", "MR ", "US ", "ULTRASOUND", "XR ", "X-RAY"]):
            return "Nuclear Medicine"
    
    # Invasive procedures
    if any(x in t for x in ["INVASIVE", "BIOPSY", "PROCEDURE"]):
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
    t = re.sub(r"\s+", " ", s.upper()).strip()
    mod = modality_from_desc(t)
    
    # Get body part
    body_part = body_parts_from_desc(t)
    if body_part == "Unknown":
        body_part = "Other"
    
    # Get contrast info
    con = contrast_phrase(t)
    
    # Format based on modality
    if mod in ["CT", "CTA"]:
        return f"{mod} {body_part}" + (f" {con}" if con else "")
    elif mod in ["MRI", "MRA", "MRV"]:
        return f"{mod} {body_part}" + (f" {con}" if con else "")
    elif mod == "Radiography":
        return f"XR {body_part}"
    elif mod in ["US", "US - Duplex", "US - Obstetrical", "US Procedure"]:
        return f"{mod} {body_part}"
    elif mod in ["Fluoroscopy", "Fluoroscopy - Dynamic", "Fluoroscopy Guidance"]:
        return f"{mod} {body_part}"
    elif mod in ["Mammography", "Mammography Procedure"]:
        return f"{mod} {body_part}"
    elif mod == "Echocardiography":
        return f"{mod} {body_part}"
    elif mod in ["PET", "PET/CT"]:
        return f"{mod} {body_part}" + (f" {con}" if con else "")
    elif mod == "Nuclear Medicine":
        return f"{mod} {body_part}"
    elif mod == "Invasive":
        return f"{mod} {body_part}"
    else:
        return f"{mod} {body_part}"

def body_parts_from_desc(s: str) -> str:
    t = s.upper()
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
    if not found and "CT" in t:
        region = region_ct(t)
        if region != "Other":
            # Map region_ct results to body part names
            if region == "Chest/Abdomen/Pelvis":
                found = ["Chest", "Abdomen", "Pelvis"]
            elif region == "Abdomen/Pelvis":
                found = ["Abdomen", "Pelvis"]
            elif region == "Chest":
                found = ["Chest"]
            elif region == "Abdomen":
                found = ["Abdomen"]
            elif region == "Pelvis":
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
# --- Minimal text UI ---
APP_NAME = "Resident RVU Dashboard"
TAGLINE = "Compact, actionable RVU analytics for residents."
METHODS = """
**Methods (60 sec)**
- **Data**: DICTATION DTTM, EXAM DESC, WRVU ESTIMATE.
- **Derivations**: Modality/Body part from EXAM DESC; daily/weekly aggregates.
- **KPIs**: RVUs/day, RVUs/case, 7-day MA, trend slope.
- **Assumption**: 8-hour workday for RVUs/hour.
"""

# ======================== SIDEBAR - SECURITY NOTICE ========================
st.sidebar.warning("""
⚠️ **SECURITY NOTICE**

**DO NOT** include PHI or patient identifiers.

Required columns only:
- **DICTATION DTTM** (date/time)
- **EXAM DESC** (exam description)  
- **WRVU ESTIMATE** (work RVU value)
""")

# Move header and methods to sidebar
st.sidebar.title(APP_NAME)
st.sidebar.caption(TAGLINE)

with st.sidebar.expander("Methods"):
    st.markdown(METHODS)

# ======================== SIDEBAR - DATA INPUT ========================
goal_rvu_per_day = st.sidebar.number_input(
    "Goal RVUs per Day",
    min_value=0.0,
    value=15.0,
    step=0.5,
    help="Set your daily RVU target (default: 15 for residents)"
)

up = st.sidebar.file_uploader(
    "Upload CSV File", 
    type=["csv", "txt"], 
    help="File should contain: DICTATION DTTM, EXAM DESC, WRVU ESTIMATE"
)

st.sidebar.markdown("**OR**")
txt = st.sidebar.text_area(
    "Paste CSV/TSV Data", 
    placeholder="DICTATION DTTM,EXAM DESC,WRVU ESTIMATE\n2024-01-01 08:00:00,CT CHEST W/O CONTRAST,1.5", 
    height=120
)

use_paste = st.sidebar.button("🔄 Use Pasted Data", type="primary")

# Load data
df = None
try:
    if up is not None:
        df_raw = pd.read_csv(up)
        df = process_dataframe(df_raw)
        st.sidebar.success(f"✅ File uploaded: {up.name} ({len(df)} rows)")
        # Update session state when new data is loaded
        st.session_state.processed_df = df
    elif use_paste and txt.strip():
        df_raw = parse_csv_data(txt)
        df = process_dataframe(df_raw)
        st.sidebar.success(f"✅ Data pasted: {len(df)} rows")
        # Update session state when new data is loaded
        st.session_state.processed_df = df
    elif 'processed_df' in st.session_state and st.session_state.processed_df is not None:
        # Use existing data from session state
        df = st.session_state.processed_df
except Exception as e:
    st.error(f"❌ Error processing data: {str(e)}")
    st.stop()

if df is None:
    st.stop()

# Store in session state for other pages
st.session_state.processed_df = df
st.session_state.goal_rvu_per_day = goal_rvu_per_day

# Check if data includes time information and show notification
if not check_time_data(df):
    st.toast("💡 **Tip**: Including time data (HH:MM) in your dates adds hourly insights and better efficiency analysis!", icon="⏰")

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

# ======================== OVERVIEW METRICS ========================
st.subheader("📊 Performance Overview")

# Calculate key metrics for resident benchmarking
annual_projection = (total_rvu / days_worked) * 250 if days_worked > 0 else 0
rvu_per_hour = avg_rvu_day / 8 if avg_rvu_day > 0 else 0  # Assuming 8-hour workday

# Resident-specific benchmarks
resident_daily_target = goal_rvu_per_day  # User-defined target
resident_hourly_target = goal_rvu_per_day / 8  # RVUs per hour target (8-hour workday)

# Performance status indicators
daily_status = "🟢 Excellent" if avg_rvu_day >= resident_daily_target else "🟡 Developing" if avg_rvu_day >= resident_daily_target * 0.7 else "🔴 Needs Focus"
hourly_status = "🟢 Excellent" if rvu_per_hour >= resident_hourly_target else "🟡 Developing" if rvu_per_hour >= resident_hourly_target * 0.7 else "🔴 Needs Focus"

# Main performance metrics
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric(
        "Daily RVUs", 
        f"{avg_rvu_day:.1f}", 
        f"Target: {resident_daily_target}",
        help="Daily RVU performance vs your goal"
    )
    st.caption(daily_status)

with col2:
    st.metric(
        "RVUs per Hour", 
        f"{rvu_per_hour:.1f}", 
        f"Target: {resident_hourly_target:.1f}",
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


# ======================== WORKFLOW ANALYSIS ========================
st.divider()
st.subheader("📈 Daily Performance Trend")

# Prepare data for key insights
daily = df.groupby("date", as_index=False)["WRVU ESTIMATE"].sum().rename(columns={"WRVU ESTIMATE": "RVU"}).sort_values("date")
daily["MA7"] = daily["RVU"].rolling(7, min_periods=1).mean()
daily["date_str"] = daily["date"].astype(str)
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
    
    daily_chart = (
        alt.Chart(daily).mark_line(strokeWidth=3, color="#1f77b4").encode(
            x=alt.X("date_str:T", title="Date"),
            y=alt.Y("RVU:Q", title="Daily RVUs", scale=alt.Scale(zero=False)),
            tooltip=["date_str:T", alt.Tooltip("RVU:Q", format=".1f")]
        ) +
        alt.Chart(daily).mark_line(strokeDash=[5, 5], color="orange", strokeWidth=2).encode(
            x="date_str:T", 
            y="MA7:Q",
            tooltip=["date_str:T", alt.Tooltip("MA7:Q", format=".1f", title="7-Day Average")]
        ) +
        alt.Chart(pd.DataFrame({'y': [resident_daily_target]})).mark_rule(
            strokeDash=[3, 3], color="red", strokeWidth=2
        ).encode(y='y:Q') +
        alt.Chart(best_day_data).mark_circle(
            size=100, color="gold", stroke="black", strokeWidth=2
        ).encode(
            x="date_str:T",
            y="RVU:Q",
            tooltip=[
                alt.Tooltip("date_str:T", title="Best Day"),
                alt.Tooltip("RVU:Q", format=".1f", title="RVUs")
            ]
        )
    ).properties(
        title=f"Daily RVU Performance (Target: {resident_daily_target} RVUs/day)", 
        height=300
    )
    
    st.altair_chart(daily_chart, use_container_width=True)

# Performance summary metrics
col1, col2, col3, col4 = st.columns(4)
with col1:
    target_hit_rate = (daily["RVU"] >= resident_daily_target).mean() * 100
    st.metric("Target Hit Rate", f"{target_hit_rate:.0f}%", help="% of days meeting your goal")
with col2:
    st.metric("7-Day Average", f"{daily['MA7'].iloc[-1]:.1f}", help="Recent 7-day moving average")
with col3:
    trend_icon = "📈" if trend_slope > 0 else "📉" if trend_slope < 0 else "➡️"
    st.metric("Trend", f"{trend_icon} {trend_slope:+.2f}/day", help="Daily RVU change trend")
with col4:
    st.metric("Best Day", f"{best_day_date_str}", help=f"Highest single-day RVUs: {best_day_rvu:.1f}")

# ======================== EFFICIENCY ANALYSIS ========================
st.subheader("⏱️ Hourly Efficiency Analysis")
with st.container():
    hourly_data = df.groupby("hour", as_index=False)["WRVU ESTIMATE"].sum().rename(columns={"WRVU ESTIMATE": "RVU"})
    hourly_data["RVU_per_hour"] = hourly_data["RVU"] / len(daily)  # Approximate RVUs per hour
    hourly_data["Efficiency"] = hourly_data["RVU_per_hour"] / resident_hourly_target * 100

    efficiency_chart = alt.Chart(hourly_data).mark_bar().encode(
        x=alt.X("hour:O", title="Hour of Day"),
        y=alt.Y("RVU_per_hour:Q", title="Average RVUs per Hour"),
        color=alt.condition(
            alt.datum.RVU_per_hour >= resident_hourly_target,
            alt.value("#2ca02c"),  # Green for meeting target
            alt.value("#ff7f0e")   # Orange for below target
        ),
        tooltip=["hour:O", alt.Tooltip("RVU_per_hour:Q", format=".2f")]
    ).properties(
        title=f"Hourly Efficiency (Target: {resident_hourly_target} RVUs/hour)", 
        height=250
    )

    st.altair_chart(efficiency_chart, use_container_width=True)

# ======================== CASE MIX ANALYSIS ========================
st.subheader("🔬 Case Mix Analysis")

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
        color=alt.Color("Modality:N", legend=alt.Legend(title="Modality")),
        tooltip=["Label", alt.Tooltip("RVU:Q", format=".1f"), alt.Tooltip("Cases:Q")]
    )

    # Add text labels at the end of bars
    text_layer = bar_chart.mark_text(
        align='left',
        baseline='middle',
        dx=3,  # Nudge text to the right of the bar
        color='white'  # Use white text for better contrast
    ).encode(
        x=alt.X("RVU:Q"),
        y=alt.Y("Label:N", sort=None),
        text=alt.Text("RVU:Q", format=".1f")  # Format RVU to one decimal place
    )

    chart = (bar_chart + text_layer).properties(
        title="Top 5 Modality-Body Part Combinations", 
        height=300
    )
    
    st.altair_chart(chart, use_container_width=True)

with col2:
    # Create pie chart showing total RVUs per modality
    modality_totals = df.groupby("Modality", as_index=False)["WRVU ESTIMATE"].sum().rename(columns={"WRVU ESTIMATE": "RVU"})
    
    # Create pie chart base
    pie_base = alt.Chart(modality_totals).encode(
        theta=alt.Theta("RVU:Q", stack=True)
    )
    
    # Create pie arcs
    pie_arcs = pie_base.mark_arc(outerRadius=120).encode(
        color=alt.Color("Modality:N", legend=alt.Legend(title="Modality")),
        order=alt.Order("RVU:Q", sort="descending"),
        tooltip=["Modality", alt.Tooltip("RVU:Q", format=".1f")]
    )
    
    # Add text labels on pie slices
    pie_text = pie_base.mark_text(radius=140).encode(
        text=alt.Text("RVU:Q", format=".1f"),
        order=alt.Order("RVU:Q", sort="descending"),
        color=alt.value("white")  # Use white text for better contrast
    )
    
    pie_chart = (pie_arcs + pie_text).properties(
        title="Total RVUs by Modality",
        height=300
    )
    
    st.altair_chart(pie_chart, use_container_width=True)

# ======================== SCHEDULE OPTIMIZATION ========================
st.subheader("⏰ Schedule Optimization")
with st.container():
    dow_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    hot = df.groupby(["dow", "hour"], as_index=False)["WRVU ESTIMATE"].sum().rename(columns={"WRVU ESTIMATE": "RVU"})
    hot["dow"] = pd.Categorical(hot["dow"], categories=dow_order, ordered=True)

    heatmap = alt.Chart(hot).mark_rect().encode(
        x=alt.X("hour:O", title="Hour of Day"),
        y=alt.Y("dow:O", title="Day of Week", sort=dow_order),
        color=alt.Color("RVU:Q", scale=alt.Scale(scheme="blues"), title="RVUs"),
        tooltip=["dow", "hour", alt.Tooltip("RVU:Q", format=".1f")]
    ).properties(
        title="Optimal Work Schedule - Schedule Complex Cases During Peak Hours", 
        height=300
    )

    st.altair_chart(heatmap, use_container_width=True)

# Schedule optimization insight
if peak_hour is not None and peak_dow is not None:
    st.success(f"""
    **⏰ Schedule Optimization:**
    - **Peak Performance**: {peak_dow} at {peak_hour}:00
    - **Action**: Schedule your most complex cases during peak hours for maximum efficiency
    """)
