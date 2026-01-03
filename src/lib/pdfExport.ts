import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ProcessedMetrics, DailyData, CaseMixData } from './dataProcessing'
import { format } from 'date-fns'

interface PDFExportOptions {
  metrics: ProcessedMetrics
  dailyData: DailyData[]
  caseMixData: CaseMixData[]
  modalityData: { name: string; value: number }[]
  goalRvuPerDay: number
  profileName: string
  reportPeriodStart?: string
  reportPeriodEnd?: string
}

// Helper function to calculate insights from data
function calculateInsights(dailyData: DailyData[], caseMixData: CaseMixData[], metrics: ProcessedMetrics, goalRvuPerDay: number) {
  // Current streak of meeting target
  let currentStreak = 0
  for (let i = dailyData.length - 1; i >= 0; i--) {
    if (dailyData[i].meetsTarget) {
      currentStreak++
    } else {
      break
    }
  }

  // Longest streak
  let longestStreak = 0
  let tempStreak = 0
  for (const day of dailyData) {
    if (day.meetsTarget) {
      tempStreak++
      longestStreak = Math.max(longestStreak, tempStreak)
    } else {
      tempStreak = 0
    }
  }

  // Week over week comparison
  const last7 = dailyData.slice(-7)
  const prev7 = dailyData.slice(-14, -7)
  const last7Total = last7.reduce((sum, d) => sum + d.rvu, 0)
  const prev7Total = prev7.length > 0 ? prev7.reduce((sum, d) => sum + d.rvu, 0) : 0
  const weekOverWeekChange = prev7Total > 0 ? ((last7Total - prev7Total) / prev7Total) * 100 : 0

  // Day of week analysis
  const dowTotals: Record<string, { rvu: number; count: number }> = {}
  for (const day of dailyData) {
    const dow = format(new Date(day.date), 'EEEE')
    if (!dowTotals[dow]) dowTotals[dow] = { rvu: 0, count: 0 }
    dowTotals[dow].rvu += day.rvu
    dowTotals[dow].count++
  }
  
  const dowAverages = Object.entries(dowTotals)
    .map(([dow, data]) => ({ dow, avg: data.rvu / data.count }))
    .sort((a, b) => b.avg - a.avg)
  
  const bestDow = dowAverages[0]
  const worstDow = dowAverages[dowAverages.length - 1]

  // Highest RVU/case procedure
  const sortedByEfficiency = [...caseMixData].sort((a, b) => (b.rvu / b.cases) - (a.rvu / a.cases))
  const mostEfficient = sortedByEfficiency[0]

  // Annual projection (250 working days)
  const annualProjection = metrics.avgRvuDay * 250

  // Pace assessment
  const onPace = metrics.avgRvuDay >= goalRvuPerDay
  const paceGap = ((metrics.avgRvuDay - goalRvuPerDay) / goalRvuPerDay) * 100

  return {
    currentStreak,
    longestStreak,
    last7Total,
    prev7Total,
    weekOverWeekChange,
    bestDow,
    worstDow,
    mostEfficient,
    annualProjection,
    onPace,
    paceGap,
  }
}

export function generatePDF(options: PDFExportOptions): void {
  const { 
    metrics, 
    dailyData, 
    caseMixData, 
    modalityData, 
    goalRvuPerDay, 
    profileName,
    reportPeriodStart,
    reportPeriodEnd 
  } = options
  
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let yPos = margin

  // Calculate insights
  const insights = calculateInsights(dailyData, caseMixData, metrics, goalRvuPerDay)

  // ============ COLOR PALETTE ============
  const darkNavy = [26, 39, 68] as [number, number, number]
  const slate = [74, 85, 104] as [number, number, number]
  const mediumGray = [113, 128, 150] as [number, number, number]
  const lightGray = [160, 174, 192] as [number, number, number]
  const veryLightGray = [226, 232, 240] as [number, number, number]
  const backgroundGray = [247, 250, 252] as [number, number, number]
  const white = [255, 255, 255] as [number, number, number]
  const teal = [49, 151, 149] as [number, number, number]
  const green = [56, 161, 105] as [number, number, number]
  const amber = [214, 158, 46] as [number, number, number]

  // Report period
  const periodStart = reportPeriodStart || (dailyData.length > 0 ? dailyData[0].date : '')
  const periodEnd = reportPeriodEnd || (dailyData.length > 0 ? dailyData[dailyData.length - 1].date : '')

  // ============ HEADER ============
  doc.setTextColor(...darkNavy)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Productivity Report', margin, yPos + 8)

  doc.setTextColor(...mediumGray)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(format(new Date(), 'MMMM d, yyyy'), pageWidth - margin, yPos + 6, { align: 'right' })

  yPos += 14

  doc.text(profileName, margin, yPos)

  if (periodStart && periodEnd) {
    doc.text(
      `Period: ${format(new Date(periodStart), 'MMM d, yyyy')} - ${format(new Date(periodEnd), 'MMM d, yyyy')}`,
      pageWidth - margin, yPos, { align: 'right' }
    )
  }

  yPos += 8

  doc.setDrawColor(...veryLightGray)
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 12

  // ============ PRIMARY KPI CARDS ============
  const primaryKpis = [
    { label: 'Total RVUs', value: metrics.totalRvu.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) },
    { label: 'Total Cases', value: metrics.cases.toLocaleString() },
    { label: 'Days Worked', value: metrics.daysWorked.toString() },
    { label: 'Target Hit Rate', value: `${metrics.targetHitRate.toFixed(0)}%` },
  ]

  const cardWidth = (contentWidth - 6) / 4
  const cardHeight = 22

  primaryKpis.forEach((kpi, index) => {
    const xPos = margin + (cardWidth + 2) * index
    
    doc.setFillColor(...backgroundGray)
    doc.setDrawColor(...veryLightGray)
    doc.roundedRect(xPos, yPos, cardWidth, cardHeight, 1, 1, 'FD')
    
    doc.setTextColor(...mediumGray)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(kpi.label, xPos + 4, yPos + 6)
    
    doc.setTextColor(...darkNavy)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(kpi.value, xPos + 4, yPos + 16)
  })

  yPos += cardHeight + 10

  // ============ KEY INSIGHTS (combined table) ============
  doc.setTextColor(...darkNavy)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Key Insights', margin, yPos)
  yPos += 6

  // Format values for insights
  const trendValue = `${metrics.trendSlope >= 0 ? '+' : ''}${metrics.trendSlope.toFixed(2)}/day`
  const paceText = insights.onPace 
    ? `On track (+${Math.abs(insights.paceGap).toFixed(0)}% above goal)`
    : `Behind (${insights.paceGap.toFixed(0)}% below goal)`
  
  const wowText = `${insights.weekOverWeekChange >= 0 ? '+' : ''}${insights.weekOverWeekChange.toFixed(1)}%`
  
  const peakHourFormatted = metrics.peakHour >= 12 
    ? `${metrics.peakHour === 12 ? 12 : metrics.peakHour - 12}:00 PM` 
    : `${metrics.peakHour === 0 ? 12 : metrics.peakHour}:00 AM`

  const bestDayPct = ((metrics.bestDayRvu / goalRvuPerDay) * 100).toFixed(0)

  const insightsData = [
    // Performance metrics row
    ['Avg RVUs/Day', metrics.avgRvuDay.toFixed(1), 'Avg Cases/Day', metrics.avgCasesDay.toFixed(1)],
    ['RVUs/Hour', metrics.rvuPerHour.toFixed(1), 'RVUs/Case', metrics.rvuPerCase.toFixed(2)],
    ['Daily Goal', goalRvuPerDay.toString(), 'Trend', trendValue],
    // Divider row handled by styling
    ['Pace Status', paceText, 'Best Day', insights.bestDow ? `${insights.bestDow.dow}s (${insights.bestDow.avg.toFixed(1)} avg)` : '-'],
    ['Week vs Prior', `${wowText} (${insights.last7Total.toFixed(0)} vs ${insights.prev7Total.toFixed(0)})`, 'Slowest Day', insights.worstDow ? `${insights.worstDow.dow}s (${insights.worstDow.avg.toFixed(1)} avg)` : '-'],
    ['Current Streak', `${insights.currentStreak} days (best: ${insights.longestStreak})`, 'Peak Hour', peakHourFormatted],
    ['Annual Projection', `${insights.annualProjection.toLocaleString(undefined, { maximumFractionDigits: 0 })} RVUs`, 'Top Efficiency', insights.mostEfficient ? `${insights.mostEfficient.label.substring(0, 18)} (${(insights.mostEfficient.rvu / insights.mostEfficient.cases).toFixed(2)})` : '-'],
    ['Peak Performance', `${metrics.bestDayDate} - ${metrics.bestDayRvu.toFixed(1)} RVUs (${bestDayPct}% of goal)`, '', ''],
  ]

  autoTable(doc, {
    startY: yPos,
    body: insightsData,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 38, textColor: mediumGray },
      1: { cellWidth: 52, textColor: darkNavy, fontStyle: 'bold' },
      2: { cellWidth: 36, textColor: mediumGray },
      3: { cellWidth: 52, textColor: darkNavy, fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: backgroundGray,
    },
    didParseCell: (data) => {
      // Color the Trend value
      if (data.row.index === 2 && data.column.index === 3) {
        data.cell.styles.textColor = metrics.trendSlope >= 0 ? green : amber
      }
      // Color Peak Performance row
      if (data.row.index === 7 && data.column.index === 1) {
        data.cell.styles.textColor = teal
      }
    },
    margin: { left: margin, right: margin },
  })

  yPos = (doc as any).lastAutoTable.finalY + 12

  // ============ MODALITY BREAKDOWN ============
  doc.setTextColor(...darkNavy)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('RVUs by Modality', margin, yPos)
  yPos += 6

  if (modalityData.length > 0) {
    const totalRvus = modalityData.reduce((sum, d) => sum + d.value, 0)
    const maxPct = Math.max(...modalityData.map(d => (d.value / totalRvus) * 100))
    
    autoTable(doc, {
      startY: yPos,
      head: [['Modality', 'RVUs', 'Share', 'Distribution']],
      body: modalityData.slice(0, 6).map(d => {
        const pct = (d.value / totalRvus) * 100
        const barLength = Math.round((pct / maxPct) * 20)
        const bar = '|'.repeat(barLength)
        return [
          d.name,
          d.value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
          `${pct.toFixed(1)}%`,
          bar
        ]
      }),
      theme: 'plain',
      headStyles: {
        fillColor: darkNavy,
        textColor: white,
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: slate,
        cellPadding: 2.5,
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 28, halign: 'right' },
        2: { cellWidth: 20, halign: 'right', textColor: mediumGray },
        3: { cellWidth: 55, halign: 'left', textColor: teal, fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: backgroundGray,
      },
      margin: { left: margin, right: margin },
    })

    yPos = (doc as any).lastAutoTable.finalY + 10
  }

  // ============ CASE MIX ============
  doc.setTextColor(...darkNavy)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Top Case Types', margin, yPos)
  yPos += 6

  if (caseMixData.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Procedure', 'Total RVUs', 'Volume', 'RVU/Case']],
      body: caseMixData.slice(0, 6).map(d => [
        d.label,
        d.rvu.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        d.cases.toString(),
        (d.rvu / d.cases).toFixed(2)
      ]),
      theme: 'plain',
      headStyles: {
        fillColor: darkNavy,
        textColor: white,
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: slate,
        cellPadding: 2.5,
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 30, halign: 'right' },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
      },
      alternateRowStyles: {
        fillColor: backgroundGray,
      },
      margin: { left: margin, right: margin },
    })
  }

  // ============ FOOTER ============
  doc.setDrawColor(...veryLightGray)
  doc.setLineWidth(0.3)
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
  
  doc.setFontSize(8)
  doc.setTextColor(...lightGray)
  doc.text('myRVU', margin, pageHeight - 6)
  doc.text('Page 1 of 1', pageWidth - margin, pageHeight - 6, { align: 'right' })

  // Save
  const fileName = `myRVU_Report_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.pdf`
  doc.save(fileName)
}
