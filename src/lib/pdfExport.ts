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
  let yPos = 0

  // Colors - refined palette
  const emerald = [16, 185, 129] as [number, number, number]      // emerald-500
  const emeraldDark = [5, 150, 105] as [number, number, number]   // emerald-600
  const emeraldLight = [209, 250, 229] as [number, number, number] // emerald-100
  const slate900 = [15, 23, 42] as [number, number, number]
  const slate800 = [30, 41, 59] as [number, number, number]
  const slate700 = [51, 65, 85] as [number, number, number]
  const slate600 = [71, 85, 105] as [number, number, number]
  const slate500 = [100, 116, 139] as [number, number, number]
  const slate400 = [148, 163, 184] as [number, number, number]
  const slate300 = [203, 213, 225] as [number, number, number]
  const slate200 = [226, 232, 240] as [number, number, number]
  const slate100 = [241, 245, 249] as [number, number, number]
  const slate50 = [248, 250, 252] as [number, number, number]
  const white = [255, 255, 255] as [number, number, number]
  const amber = [245, 158, 11] as [number, number, number]
  const amberLight = [254, 243, 199] as [number, number, number]
  const red = [239, 68, 68] as [number, number, number]
  const redLight = [254, 226, 226] as [number, number, number]

  // Derive report period from data if not provided
  const periodStart = reportPeriodStart || (dailyData.length > 0 ? dailyData[0].date : '')
  const periodEnd = reportPeriodEnd || (dailyData.length > 0 ? dailyData[dailyData.length - 1].date : '')

  // Helper: Draw rounded rectangle
  const roundedRect = (x: number, y: number, w: number, h: number, r: number, fill?: [number, number, number], stroke?: [number, number, number]) => {
    if (fill) doc.setFillColor(...fill)
    if (stroke) doc.setDrawColor(...stroke)
    doc.roundedRect(x, y, w, h, r, r, fill && stroke ? 'FD' : fill ? 'F' : 'S')
  }

  // Helper: Draw section header with left accent bar
  const sectionHeader = (title: string, y: number): number => {
    doc.setFillColor(...emerald)
    doc.rect(margin, y, 3, 14, 'F')
    doc.setTextColor(...slate900)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin + 8, y + 10)
    return y + 20
  }

  // Helper: Add page with consistent styling
  const addNewPage = () => {
    doc.addPage()
    yPos = margin
  }

  // Helper: Check page overflow
  const checkPageOverflow = (neededHeight: number) => {
    if (yPos + neededHeight > pageHeight - 25) {
      addNewPage()
      return true
    }
    return false
  }

  // Helper: Draw mini header for subsequent pages
  const drawMiniHeader = (subtitle: string) => {
    doc.setFillColor(...slate900)
    doc.rect(0, 0, pageWidth, 22, 'F')
    doc.setFillColor(...emerald)
    doc.rect(0, 22, pageWidth, 1.5, 'F')
    
    doc.setTextColor(...white)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('my', margin, 14)
    doc.setTextColor(...emerald)
    doc.text('RVU', margin + 10, 14)
    doc.setTextColor(...slate400)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(subtitle, margin + 28, 14)
    
    doc.setTextColor(...slate400)
    doc.setFontSize(8)
    doc.text(format(new Date(), 'MMM d, yyyy'), pageWidth - margin, 14, { align: 'right' })
  }

  // ============ PAGE 1: EXECUTIVE SUMMARY ============

  // Header background
  doc.setFillColor(...slate900)
  doc.rect(0, 0, pageWidth, 48, 'F')
  
  // Emerald accent line
  doc.setFillColor(...emerald)
  doc.rect(0, 48, pageWidth, 2, 'F')

  // Logo
  roundedRect(margin, 11, 24, 24, 4, emerald)
  doc.setTextColor(...white)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('R', margin + 8.5, 27)

  // Title
  doc.setTextColor(...white)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('my', margin + 30, 22)
  doc.setTextColor(...emerald)
  doc.text('RVU', margin + 43, 22)
  
  doc.setTextColor(...slate400)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Performance Report', margin + 30, 30)

  // Report period badge
  if (periodStart && periodEnd) {
    const periodText = `${format(new Date(periodStart), 'MMM d')} – ${format(new Date(periodEnd), 'MMM d, yyyy')}`
    doc.setTextColor(...slate500)
    doc.setFontSize(8)
    doc.text(periodText, margin + 30, 38)
  }

  // Name and date on right
  doc.setTextColor(...white)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(profileName, pageWidth - margin, 22, { align: 'right' })
  
  doc.setTextColor(...slate400)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(format(new Date(), 'MMMM d, yyyy'), pageWidth - margin, 30, { align: 'right' })

  yPos = 60

  // ============ KEY METRICS - 4 Cards ============
  const cardWidth = (contentWidth - 9) / 4
  const cardHeight = 42
  const cardY = yPos

  const hourlyTarget = goalRvuPerDay / 8
  
  const keyMetrics = [
    { 
      label: 'Daily RVUs', 
      value: metrics.avgRvuDay.toFixed(1), 
      target: `Goal: ${goalRvuPerDay}`,
      status: metrics.avgRvuDay >= goalRvuPerDay ? 'good' : metrics.avgRvuDay >= goalRvuPerDay * 0.7 ? 'warn' : 'bad'
    },
    { 
      label: 'RVUs per Hour', 
      value: metrics.rvuPerHour.toFixed(1), 
      target: `Goal: ${hourlyTarget.toFixed(1)}`,
      status: metrics.rvuPerHour >= hourlyTarget ? 'good' : metrics.rvuPerHour >= hourlyTarget * 0.7 ? 'warn' : 'bad'
    },
    { 
      label: 'Cases per Day', 
      value: metrics.avgCasesDay.toFixed(1), 
      target: 'Average volume',
      status: 'neutral'
    },
    { 
      label: 'RVUs per Case', 
      value: metrics.rvuPerCase.toFixed(2), 
      target: 'Case complexity',
      status: 'neutral'
    },
  ]

  keyMetrics.forEach((metric, i) => {
    const x = margin + i * (cardWidth + 3)
    
    // Card background with left accent border
    const bgColor = metric.status === 'good' ? emeraldLight : 
                    metric.status === 'warn' ? amberLight : 
                    metric.status === 'bad' ? redLight : slate100
    const accentColor = metric.status === 'good' ? emerald : 
                        metric.status === 'warn' ? amber : 
                        metric.status === 'bad' ? red : slate400
    
    roundedRect(x, cardY, cardWidth, cardHeight, 4, bgColor)
    
    // Left accent bar
    doc.setFillColor(...accentColor)
    doc.rect(x, cardY + 4, 3, cardHeight - 8, 'F')

    // Value
    doc.setTextColor(...slate900)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(metric.value, x + cardWidth / 2 + 2, cardY + 18, { align: 'center' })

    // Label
    doc.setTextColor(...slate600)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(metric.label.toUpperCase(), x + cardWidth / 2 + 2, cardY + 27, { align: 'center' })

    // Target
    doc.setTextColor(...slate500)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(metric.target, x + cardWidth / 2 + 2, cardY + 35, { align: 'center' })
  })

  yPos = cardY + cardHeight + 14

  // ============ SECONDARY METRICS - 3 Cards ============
  const secCardWidth = (contentWidth - 6) / 3
  const secCardHeight = 28

  const secondaryMetrics = [
    { 
      label: 'Target Hit Rate', 
      value: `${metrics.targetHitRate.toFixed(0)}%`, 
      color: metrics.targetHitRate >= 70 ? emerald : metrics.targetHitRate >= 50 ? amber : red
    },
    { 
      label: '7-Day Moving Avg', 
      value: metrics.ma7.toFixed(1), 
      color: emerald
    },
    { 
      label: 'Daily Trend', 
      value: `${metrics.trendSlope > 0 ? '+' : ''}${metrics.trendSlope.toFixed(2)} /day`, 
      color: metrics.trendSlope > 0 ? emerald : metrics.trendSlope < -0.5 ? red : amber
    },
  ]

  secondaryMetrics.forEach((metric, i) => {
    const x = margin + i * (secCardWidth + 3)
    
    roundedRect(x, yPos, secCardWidth, secCardHeight, 3, white, slate300)
    
    // Left accent
    doc.setFillColor(...metric.color)
    doc.rect(x, yPos + 4, 3, secCardHeight - 8, 'F')

    // Value
    doc.setTextColor(...slate900)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(metric.value, x + 14, yPos + 15)

    // Label
    doc.setTextColor(...slate500)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(metric.label, x + 14, yPos + 22)
  })

  yPos += secCardHeight + 16

  // ============ SUMMARY STATISTICS (Consolidated) ============
  yPos = sectionHeader('Summary', yPos)

  // Consolidated summary data - 2 columns, cleaner grouping
  const summaryData = [
    ['Total RVUs', metrics.totalRvu.toFixed(1)],
    ['Total Cases', metrics.cases.toString()],
    ['Days Worked', metrics.daysWorked.toString()],
    ['Work Efficiency', `${metrics.workEfficiency.toFixed(1)}%`],
    ['Best Day', `${metrics.bestDayDate} — ${metrics.bestDayRvu.toFixed(1)} RVUs`],  // Consolidated
    ['Peak Activity', `${metrics.peakDow}s at ${metrics.peakHour}:00`],              // Consolidated
  ]

  const colWidth = contentWidth / 2 - 4
  const rowHeight = 11

  summaryData.forEach((row, i) => {
    const col = i % 2
    const rowNum = Math.floor(i / 2)
    const x = margin + col * (colWidth + 8)
    const y = yPos + rowNum * rowHeight

    doc.setTextColor(...slate600)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(row[0], x, y + 7)

    doc.setTextColor(...slate900)
    doc.setFont('helvetica', 'bold')
    const valueX = x + colWidth
    doc.text(row[1], valueX, y + 7, { align: 'right' })

    // Subtle separator line
    if (rowNum < Math.ceil(summaryData.length / 2) - 1) {
      doc.setDrawColor(...slate200)
      doc.setLineWidth(0.3)
      doc.line(x, y + rowHeight - 1, x + colWidth, y + rowHeight - 1)
    }
  })

  yPos += Math.ceil(summaryData.length / 2) * rowHeight + 18

  // ============ PAGE 2: BREAKDOWN ANALYSIS ============
  addNewPage()
  drawMiniHeader('Breakdown Analysis')
  yPos = 32

  // ============ MODALITY BREAKDOWN ============
  yPos = sectionHeader('RVUs by Modality', yPos)

  if (modalityData.length > 0) {
    const totalModalityRvus = modalityData.reduce((sum, d) => sum + d.value, 0)
    const barMaxWidth = contentWidth - 75
    
    modalityData.slice(0, 7).forEach((mod, i) => {
      const percentage = (mod.value / totalModalityRvus) * 100
      const barWidth = Math.max(2, (mod.value / modalityData[0].value) * barMaxWidth)
      
      // Label (fixed width)
      doc.setTextColor(...slate700)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(mod.name, margin, yPos + 5)
      
      // Bar background
      roundedRect(margin + 42, yPos, barMaxWidth, 8, 2, slate200)
      
      // Bar fill with gradient effect (darker for top items)
      const barColor = i === 0 ? emerald : i < 3 ? emeraldDark : slate600
      roundedRect(margin + 42, yPos, barWidth, 8, 2, barColor)
      
      // Value and percentage
      doc.setTextColor(...slate900)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(mod.value.toFixed(1), pageWidth - margin - 22, yPos + 6, { align: 'right' })
      
      doc.setTextColor(...slate500)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`${percentage.toFixed(0)}%`, pageWidth - margin, yPos + 6, { align: 'right' })
      
      yPos += 13
    })
  }

  yPos += 12

  // ============ CASE MIX TABLE ============
  yPos = sectionHeader('Top Case Mix', yPos)

  if (caseMixData.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Modality & Body Part', 'RVUs', 'Cases', 'RVU/Case']],
      body: caseMixData.slice(0, 8).map(d => [
        d.label, 
        d.rvu.toFixed(1), 
        d.cases.toString(),
        (d.rvu / d.cases).toFixed(2)
      ]),
      theme: 'plain',
      headStyles: { 
        fillColor: slate800, 
        textColor: white,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: slate700,
      },
      alternateRowStyles: {
        fillColor: slate50
      },
      columnStyles: {
        0: { cellWidth: 95 },
        1: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: slate900 },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 28, halign: 'right', textColor: slate600 }
      },
      margin: { left: margin, right: margin },
    })
    yPos = (doc as any).lastAutoTable.finalY + 15
  }

  // ============ PAGE 3: DAILY PERFORMANCE ============
  if (dailyData.length > 0) {
    addNewPage()
    drawMiniHeader('Daily Performance')
    yPos = 32

    yPos = sectionHeader('Recent Performance History', yPos)

    // Performance table with improved formatting
    const recentData = dailyData.slice(-20).reverse()
    
    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'RVUs', '7-Day MA', 'vs Goal', 'Status']],
      body: recentData.map(d => {
        const diff = d.rvu - goalRvuPerDay
        const dateObj = new Date(d.date)
        const shortDate = format(dateObj, 'MMM d') // Shorter date format
        const dayOfWeek = format(dateObj, 'EEE')
        return [
          `${shortDate} (${dayOfWeek})`,
          d.rvu.toFixed(1),
          d.ma7.toFixed(1),
          `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`,
          d.meetsTarget ? '✓ Met' : 'Below'
        ]
      }),
      theme: 'plain',
      headStyles: { 
        fillColor: slate800, 
        textColor: white,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 3.5,
        textColor: slate700,
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: slate900 },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 28, halign: 'center' }
      },
      didParseCell: (data) => {
        // Highlight rows that met target
        if (data.section === 'body') {
          const rowData = recentData[data.row.index]
          if (rowData?.meetsTarget) {
            data.cell.styles.fillColor = emeraldLight
          }
        }
        
        // Color the status column
        if (data.column.index === 4 && data.section === 'body') {
          if (data.cell.raw?.toString().includes('Met')) {
            data.cell.styles.textColor = emeraldDark
            data.cell.styles.fontStyle = 'bold'
          } else {
            data.cell.styles.textColor = red
          }
        }
        // Color the vs Goal column
        if (data.column.index === 3 && data.section === 'body') {
          const val = parseFloat(data.cell.raw?.toString() || '0')
          if (val >= 0) {
            data.cell.styles.textColor = emeraldDark
            data.cell.styles.fontStyle = 'bold'
          } else {
            data.cell.styles.textColor = red
          }
        }
      },
      margin: { left: margin, right: margin },
    })

    yPos = (doc as any).lastAutoTable.finalY + 12

    // Best performance highlight card
    roundedRect(margin, yPos, contentWidth, 28, 5, emeraldLight)
    doc.setFillColor(...emerald)
    doc.rect(margin, yPos, 4, 28, 'F')
    
    doc.setTextColor(...emeraldDark)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Best Performance', margin + 12, yPos + 11)
    
    doc.setTextColor(...slate700)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`${metrics.bestDayDate}  •  ${metrics.bestDayRvu.toFixed(1)} RVUs`, margin + 12, yPos + 20)
    
    const percentOfTarget = ((metrics.bestDayRvu / goalRvuPerDay) * 100).toFixed(0)
    doc.setTextColor(...emeraldDark)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(`${percentOfTarget}%`, pageWidth - margin - 8, yPos + 14, { align: 'right' })
    doc.setTextColor(...slate600)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('of goal', pageWidth - margin - 8, yPos + 22, { align: 'right' })
  }

  // ============ FOOTER ON ALL PAGES ============
  const pageCount = doc.internal.pages.length - 1
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    
    // Footer line
    doc.setDrawColor(...slate300)
    doc.setLineWidth(0.4)
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14)
    
    // Footer text
    doc.setFontSize(7)
    doc.setTextColor(...slate500)
    doc.setFont('helvetica', 'normal')
    doc.text('myRVU  •  Radiology Productivity Analytics', margin, pageHeight - 7)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' })
  }

  // Save the PDF
  const fileName = `myRVU_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`
  doc.save(fileName)
}