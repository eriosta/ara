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
  const margin = 20
  let yPos = 20

  // Colors
  const primaryColor = [34, 197, 94] as [number, number, number]
  const darkColor = [15, 23, 42] as [number, number, number]
  const grayColor = [100, 116, 139] as [number, number, number]

  // Helper function to add section header
  const addSectionHeader = (title: string) => {
    yPos += 10
    doc.setFillColor(...primaryColor)
    doc.rect(margin, yPos, 4, 8, 'F')
    doc.setFontSize(14)
    doc.setTextColor(...darkColor)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin + 8, yPos + 6)
    yPos += 15
  }

  // Header
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pageWidth, 45, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('RVU Dashboard Report', margin, 25)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')} | ${profileName}`, margin, 35)
  
  yPos = 55

  // Performance Overview Section
  addSectionHeader('Performance Overview')
  
  const hourlyTarget = goalRvuPerDay / 8
  const dailyStatus = metrics.avgRvuDay >= goalRvuPerDay ? 'Excellent' 
    : metrics.avgRvuDay >= goalRvuPerDay * 0.7 ? 'Developing' : 'Needs Focus'
  const hourlyStatus = metrics.rvuPerHour >= hourlyTarget ? 'Excellent'
    : metrics.rvuPerHour >= hourlyTarget * 0.7 ? 'Developing' : 'Needs Focus'

  // Metrics table
  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value', 'Target', 'Status']],
    body: [
      ['Daily RVUs', metrics.avgRvuDay.toFixed(1), goalRvuPerDay.toString(), dailyStatus],
      ['RVUs per Hour', metrics.rvuPerHour.toFixed(1), hourlyTarget.toFixed(1), hourlyStatus],
      ['Cases per Day', metrics.avgCasesDay.toFixed(1), '-', '-'],
      ['RVUs per Case', metrics.rvuPerCase.toFixed(2), '-', '-'],
      ['Target Hit Rate', `${metrics.targetHitRate.toFixed(0)}%`, '-', metrics.targetHitRate >= 70 ? 'Good' : 'Improve'],
      ['7-Day Average', metrics.ma7.toFixed(1), '-', '-'],
      ['Trend', `${metrics.trendSlope > 0 ? '+' : ''}${metrics.trendSlope.toFixed(2)}/day`, '-', metrics.trendSlope > 0 ? '📈 Positive' : '📉 Negative'],
    ],
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
    styles: { fontSize: 10 },
    margin: { left: margin, right: margin },
  })

  yPos = (doc as any).lastAutoTable.finalY + 10

  // Summary Statistics
  addSectionHeader('Summary Statistics')
  
  autoTable(doc, {
    startY: yPos,
    head: [['Statistic', 'Value']],
    body: [
      ['Total RVUs', metrics.totalRvu.toFixed(1)],
      ['Total Cases', metrics.cases.toString()],
      ['Days Worked', metrics.daysWorked.toString()],
      ['Work Efficiency', `${metrics.workEfficiency.toFixed(1)}%`],
      ['Best Day RVUs', metrics.bestDayRvu.toFixed(1)],
      ['Best Day Date', metrics.bestDayDate],
      ['Annual Projection', `${metrics.annualProjection.toFixed(0)} RVUs`],
    ],
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
    styles: { fontSize: 10 },
    margin: { left: margin, right: margin },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 80 } },
  })

  yPos = (doc as any).lastAutoTable.finalY + 10

  // Case Mix Analysis
  if (caseMixData.length > 0) {
    addSectionHeader('Top Case Mix Combinations')
    
    autoTable(doc, {
      startY: yPos,
      head: [['Modality - Body Part', 'Total RVUs', 'Cases']],
      body: caseMixData.map(d => [d.label, d.rvu.toFixed(1), d.cases.toString()]),
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
      styles: { fontSize: 10 },
      margin: { left: margin, right: margin },
    })

    yPos = (doc as any).lastAutoTable.finalY + 10
  }

  // RVUs by Modality
  if (modalityData.length > 0) {
    // Check if we need a new page
    if (yPos > 220) {
      doc.addPage()
      yPos = 20
    }

    addSectionHeader('RVUs by Modality')
    
    const totalModalityRvus = modalityData.reduce((sum, d) => sum + d.value, 0)
    
    autoTable(doc, {
      startY: yPos,
      head: [['Modality', 'RVUs', 'Percentage']],
      body: modalityData.slice(0, 10).map(d => [
        d.name, 
        d.value.toFixed(1), 
        `${((d.value / totalModalityRvus) * 100).toFixed(1)}%`
      ]),
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
      styles: { fontSize: 10 },
      margin: { left: margin, right: margin },
    })

    yPos = (doc as any).lastAutoTable.finalY + 10
  }

  // Schedule Optimization Insights
  addSectionHeader('Schedule Optimization')
  
  doc.setFontSize(10)
  doc.setTextColor(...grayColor)
  doc.setFont('helvetica', 'normal')
  
  const peakInsights = [
    `Peak Performance Day: ${metrics.peakDow}`,
    `Peak Performance Hour: ${metrics.peakHour}:00`,
    ``,
    `Recommendation: Schedule complex, high-RVU cases during peak hours`,
    `(${metrics.peakDow} around ${metrics.peakHour}:00) for maximum efficiency.`,
  ]
  
  peakInsights.forEach(line => {
    doc.text(line, margin, yPos)
    yPos += 6
  })

  // Daily Performance Table (last 10 days)
  if (dailyData.length > 0) {
    yPos += 10
    addSectionHeader('Recent Daily Performance')
    
    const recentDays = dailyData.slice(-10)
    
    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'RVUs', '7-Day MA', 'Met Target']],
      body: recentDays.map(d => [
        d.date,
        d.rvu.toFixed(1),
        d.ma7.toFixed(1),
        d.meetsTarget ? '✓ Yes' : '✗ No'
      ]),
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      margin: { left: margin, right: margin },
    })
  }

  // Footer
  const pageCount = doc.internal.pages.length - 1
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...grayColor)
    doc.text(
      `Page ${i} of ${pageCount} | RVU Dashboard | Confidential`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  // Save the PDF
  const fileName = `RVU_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`
  doc.save(fileName)
}

