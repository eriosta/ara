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
}

export function generatePDF(options: PDFExportOptions): void {
  const { metrics, dailyData, caseMixData, modalityData, goalRvuPerDay, profileName } = options
  
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let yPos = 0

  // Colors
  const emerald = [34, 197, 94] as [number, number, number]
  const emeraldDark = [22, 163, 74] as [number, number, number]
  const slate900 = [15, 23, 42] as [number, number, number]
  const slate800 = [30, 41, 59] as [number, number, number]
  const slate700 = [51, 65, 85] as [number, number, number]
  const slate500 = [100, 116, 139] as [number, number, number]
  const slate400 = [148, 163, 184] as [number, number, number]
  const slate300 = [203, 213, 225] as [number, number, number]
  const white = [255, 255, 255] as [number, number, number]
  const amber = [245, 158, 11] as [number, number, number]
  const red = [239, 68, 68] as [number, number, number]

  // Helper: Draw rounded rectangle
  const roundedRect = (x: number, y: number, w: number, h: number, r: number, fill?: [number, number, number], stroke?: [number, number, number]) => {
    if (fill) doc.setFillColor(...fill)
    if (stroke) doc.setDrawColor(...stroke)
    doc.roundedRect(x, y, w, h, r, r, fill && stroke ? 'FD' : fill ? 'F' : 'S')
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

  // ============ HEADER ============
  // Dark header background
  doc.setFillColor(...slate900)
  doc.rect(0, 0, pageWidth, 50, 'F')
  
  // Emerald accent line
  doc.setFillColor(...emerald)
  doc.rect(0, 50, pageWidth, 2, 'F')

  // Logo area
  roundedRect(margin, 12, 26, 26, 4, emerald)
  doc.setTextColor(...white)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('R', margin + 9.5, 29)

  // Title
  doc.setTextColor(...white)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('my', margin + 32, 24)
  doc.setTextColor(...emerald)
  doc.text('RVU', margin + 46, 24)
  
  doc.setTextColor(...slate400)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Performance Report', margin + 32, 32)

  // Date and name on right
  doc.setTextColor(...slate400)
  doc.setFontSize(9)
  doc.text(format(new Date(), 'MMMM d, yyyy'), pageWidth - margin, 20, { align: 'right' })
  doc.setTextColor(...white)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(profileName, pageWidth - margin, 28, { align: 'right' })

  yPos = 62

  // ============ KEY METRICS CARDS ============
  const cardWidth = (contentWidth - 8) / 4
  const cardHeight = 38
  const cardY = yPos

  const hourlyTarget = goalRvuPerDay / 8
  
  const keyMetrics = [
    { 
      label: 'Daily RVUs', 
      value: metrics.avgRvuDay.toFixed(1), 
      target: `Target: ${goalRvuPerDay}`,
      status: metrics.avgRvuDay >= goalRvuPerDay ? 'good' : metrics.avgRvuDay >= goalRvuPerDay * 0.7 ? 'warn' : 'bad'
    },
    { 
      label: 'RVUs/Hour', 
      value: metrics.rvuPerHour.toFixed(1), 
      target: `Target: ${hourlyTarget.toFixed(1)}`,
      status: metrics.rvuPerHour >= hourlyTarget ? 'good' : metrics.rvuPerHour >= hourlyTarget * 0.7 ? 'warn' : 'bad'
    },
    { 
      label: 'Cases/Day', 
      value: metrics.avgCasesDay.toFixed(1), 
      target: 'Avg volume',
      status: 'neutral'
    },
    { 
      label: 'RVUs/Case', 
      value: metrics.rvuPerCase.toFixed(2), 
      target: 'Complexity',
      status: 'neutral'
    },
  ]

  keyMetrics.forEach((metric, i) => {
    const x = margin + i * (cardWidth + 2.5)
    
    // Card background
    roundedRect(x, cardY, cardWidth, cardHeight, 3, slate800)
    
    // Status indicator bar
    const statusColor = metric.status === 'good' ? emerald : metric.status === 'warn' ? amber : metric.status === 'bad' ? red : slate700
    doc.setFillColor(...statusColor)
    doc.rect(x, cardY, cardWidth, 3, 'F')
    // Round top corners
    doc.setFillColor(...slate800)
    doc.circle(x + 3, cardY + 3, 3, 'F')
    doc.circle(x + cardWidth - 3, cardY + 3, 3, 'F')
    doc.setFillColor(...statusColor)
    doc.rect(x + 3, cardY, cardWidth - 6, 3, 'F')

    // Value
    doc.setTextColor(...white)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(metric.value, x + cardWidth / 2, cardY + 18, { align: 'center' })

    // Label
    doc.setTextColor(...slate400)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(metric.label, x + cardWidth / 2, cardY + 26, { align: 'center' })

    // Target/subtitle
    doc.setTextColor(...slate500)
    doc.setFontSize(7)
    doc.text(metric.target, x + cardWidth / 2, cardY + 33, { align: 'center' })
  })

  yPos = cardY + cardHeight + 12

  // ============ SECONDARY METRICS ROW ============
  const secCardWidth = (contentWidth - 6) / 3
  const secCardHeight = 32

  const secondaryMetrics = [
    { 
      label: 'Target Hit Rate', 
      value: `${metrics.targetHitRate.toFixed(0)}%`, 
      icon: metrics.targetHitRate >= 50 ? '●' : '○',
      color: metrics.targetHitRate >= 70 ? emerald : metrics.targetHitRate >= 50 ? amber : red
    },
    { 
      label: '7-Day Moving Avg', 
      value: metrics.ma7.toFixed(1), 
      icon: '◆',
      color: emerald
    },
    { 
      label: 'Daily Trend', 
      value: `${metrics.trendSlope > 0 ? '+' : ''}${metrics.trendSlope.toFixed(2)}/day`, 
      icon: metrics.trendSlope > 0 ? '▲' : '▼',
      color: metrics.trendSlope > 0 ? emerald : red
    },
  ]

  secondaryMetrics.forEach((metric, i) => {
    const x = margin + i * (secCardWidth + 3)
    
    roundedRect(x, yPos, secCardWidth, secCardHeight, 3, slate800)
    
    // Icon
    doc.setTextColor(...metric.color)
    doc.setFontSize(12)
    doc.text(metric.icon, x + 10, yPos + 18)

    // Value
    doc.setTextColor(...white)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(metric.value, x + 22, yPos + 17)

    // Label
    doc.setTextColor(...slate400)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(metric.label, x + 22, yPos + 25)
  })

  yPos += secCardHeight + 15

  // ============ SUMMARY SECTION ============
  // Section header
  doc.setFillColor(...emerald)
  doc.rect(margin, yPos, 3, 12, 'F')
  doc.setTextColor(...slate900)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary Statistics', margin + 8, yPos + 9)
  yPos += 18

  // Summary grid (2 columns)
  const summaryData = [
    ['Total RVUs', metrics.totalRvu.toFixed(1)],
    ['Total Cases', metrics.cases.toString()],
    ['Days Worked', metrics.daysWorked.toString()],
    ['Work Efficiency', `${metrics.workEfficiency.toFixed(1)}%`],
    ['Best Day', `${metrics.bestDayRvu.toFixed(1)} RVUs`],
    ['Best Date', metrics.bestDayDate],
    ['Peak Day', metrics.peakDow],
    ['Peak Hour', `${metrics.peakHour}:00`],
  ]

  const colWidth = contentWidth / 2 - 2
  const rowHeight = 10

  summaryData.forEach((row, i) => {
    const col = i % 2
    const rowNum = Math.floor(i / 2)
    const x = margin + col * (colWidth + 4)
    const y = yPos + rowNum * rowHeight

    doc.setTextColor(...slate500)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(row[0], x, y + 7)

    doc.setTextColor(...slate900)
    doc.setFont('helvetica', 'bold')
    doc.text(row[1], x + colWidth - 5, y + 7, { align: 'right' })

    // Subtle separator
    if (i < summaryData.length - 2) {
      doc.setDrawColor(...slate300)
      doc.setLineWidth(0.2)
      doc.line(x, y + rowHeight - 1, x + colWidth - 5, y + rowHeight - 1)
    }
  })

  yPos += Math.ceil(summaryData.length / 2) * rowHeight + 15

  // ============ MODALITY BREAKDOWN ============
  checkPageOverflow(80)

  doc.setFillColor(...emerald)
  doc.rect(margin, yPos, 3, 12, 'F')
  doc.setTextColor(...slate900)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('RVUs by Modality', margin + 8, yPos + 9)
  yPos += 18

  if (modalityData.length > 0) {
    const totalModalityRvus = modalityData.reduce((sum, d) => sum + d.value, 0)
    const barMaxWidth = contentWidth - 80
    
    modalityData.slice(0, 6).forEach((mod, i) => {
      const percentage = (mod.value / totalModalityRvus) * 100
      const barWidth = (mod.value / modalityData[0].value) * barMaxWidth
      
      // Label
      doc.setTextColor(...slate700)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(mod.name, margin, yPos + 5)
      
      // Bar background
      roundedRect(margin + 45, yPos, barMaxWidth, 7, 1, slate300)
      
      // Bar fill
      if (barWidth > 2) {
        roundedRect(margin + 45, yPos, barWidth, 7, 1, i === 0 ? emerald : emeraldDark)
      }
      
      // Value
      doc.setTextColor(...slate900)
      doc.setFont('helvetica', 'bold')
      doc.text(`${mod.value.toFixed(1)}`, pageWidth - margin - 25, yPos + 5)
      
      doc.setTextColor(...slate500)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`${percentage.toFixed(1)}%`, pageWidth - margin, yPos + 5, { align: 'right' })
      
      yPos += 11
    })
  }

  yPos += 10

  // ============ CASE MIX TABLE ============
  checkPageOverflow(70)

  doc.setFillColor(...emerald)
  doc.rect(margin, yPos, 3, 12, 'F')
  doc.setTextColor(...slate900)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Top Case Mix', margin + 8, yPos + 9)
  yPos += 15

  if (caseMixData.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Modality & Body Part', 'RVUs', 'Cases']],
      body: caseMixData.slice(0, 5).map(d => [d.label, d.rvu.toFixed(1), d.cases.toString()]),
      theme: 'plain',
      headStyles: { 
        fillColor: slate800, 
        textColor: white,
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: slate700,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: slate900 },
        2: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: margin, right: margin },
    })
    yPos = (doc as any).lastAutoTable.finalY + 15
  }

  // ============ PAGE 2: DAILY PERFORMANCE ============
  if (dailyData.length > 0) {
    addNewPage()
    
    // Mini header
    doc.setFillColor(...slate900)
    doc.rect(0, 0, pageWidth, 25, 'F')
    doc.setFillColor(...emerald)
    doc.rect(0, 25, pageWidth, 1.5, 'F')
    
    doc.setTextColor(...white)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('my', margin, 16)
    doc.setTextColor(...emerald)
    doc.text('RVU', margin + 12, 16)
    doc.setTextColor(...slate400)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Daily Performance', margin + 32, 16)
    
    doc.setTextColor(...slate400)
    doc.setFontSize(9)
    doc.text(format(new Date(), 'MMMM d, yyyy'), pageWidth - margin, 16, { align: 'right' })

    yPos = 35

    doc.setFillColor(...emerald)
    doc.rect(margin, yPos, 3, 12, 'F')
    doc.setTextColor(...slate900)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Recent Performance History', margin + 8, yPos + 9)
    yPos += 18

    // Performance table
    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Day', 'RVUs', '7-Day MA', 'vs Target', 'Status']],
      body: dailyData.slice(-15).reverse().map(d => {
        const diff = d.rvu - goalRvuPerDay
        return [
          d.date,
          d.dow.substring(0, 3),
          d.rvu.toFixed(1),
          d.ma7.toFixed(1),
          `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`,
          d.meetsTarget ? '✓ Met' : '✗ Below'
        ]
      }),
      theme: 'plain',
      headStyles: { 
        fillColor: slate800, 
        textColor: white,
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 3.5,
        textColor: slate700,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 20 },
        2: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: slate900 },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 25, halign: 'center' }
      },
      didParseCell: (data) => {
        // Color the status column
        if (data.column.index === 5 && data.section === 'body') {
          if (data.cell.raw?.toString().includes('✓')) {
            data.cell.styles.textColor = emerald
            data.cell.styles.fontStyle = 'bold'
          } else {
            data.cell.styles.textColor = red
          }
        }
        // Color the vs Target column
        if (data.column.index === 4 && data.section === 'body') {
          const val = parseFloat(data.cell.raw?.toString() || '0')
          if (val >= 0) {
            data.cell.styles.textColor = emerald
          } else {
            data.cell.styles.textColor = red
          }
        }
      },
      margin: { left: margin, right: margin },
    })

    yPos = (doc as any).lastAutoTable.finalY + 15

    // Best day highlight
    roundedRect(margin, yPos, contentWidth, 25, 4, [236, 253, 245]) // emerald-50
    doc.setFillColor(...emerald)
    doc.rect(margin, yPos, 4, 25, 'F')
    
    doc.setTextColor(...emeraldDark)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('🏆  Best Performance', margin + 10, yPos + 10)
    
    doc.setTextColor(...slate700)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`${metrics.bestDayDate}  •  ${metrics.bestDayRvu.toFixed(1)} RVUs`, margin + 10, yPos + 18)
    
    doc.setTextColor(...emerald)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`${((metrics.bestDayRvu / goalRvuPerDay) * 100).toFixed(0)}%`, pageWidth - margin - 5, yPos + 14, { align: 'right' })
    doc.setTextColor(...slate500)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('of target', pageWidth - margin - 5, yPos + 20, { align: 'right' })
  }

  // ============ FOOTER ON ALL PAGES ============
  const pageCount = doc.internal.pages.length - 1
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    
    // Footer line
    doc.setDrawColor(...slate300)
    doc.setLineWidth(0.3)
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)
    
    // Footer text
    doc.setFontSize(8)
    doc.setTextColor(...slate500)
    doc.setFont('helvetica', 'normal')
    doc.text('myRVU  •  Radiology Productivity Analytics', margin, pageHeight - 8)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }

  // Save the PDF
  const fileName = `myRVU_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`
  doc.save(fileName)
}
