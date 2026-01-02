import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, File } from 'lucide-react'
import toast from 'react-hot-toast'

interface FileUploadProps {
  compact?: boolean
}

interface ProcessedFile {
  name: string
  rows: number
  status: 'pending' | 'processing' | 'done' | 'error'
  error?: string
}

export default function FileUpload({ compact = false }: FileUploadProps) {
  const { user } = useAuthStore()
  const { addRecords, loading } = useDataStore()
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([])
  const [uploading, setUploading] = useState(false)

  const processExcelFile = async (file: File): Promise<{ dictation_datetime: string; exam_description: string; wrvu_estimate: number }[]> => {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Get all data as array of arrays
    const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as (string | number | Date)[][]
    
    if (allData.length < 2) {
      throw new Error('No data found in file')
    }

    // Find the header row by looking for DICTATION DTTM column
    let headerRowIndex = -1
    for (let i = 0; i < Math.min(20, allData.length); i++) {
      const row = allData[i]
      if (!row || !Array.isArray(row)) continue
      
      const hasHeader = row.some(cell => {
        if (cell === null || cell === undefined) return false
        const cellStr = String(cell).toUpperCase()
        return cellStr.includes('DICTATION') || cellStr.includes('DTTM')
      })
      
      if (hasHeader) {
        headerRowIndex = i
        break
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('Could not find header row with DICTATION DTTM column')
    }

    // Get headers from the found row
    const headerRow = allData[headerRowIndex]
    const headers: string[] = headerRow.map(h => 
      h === null || h === undefined ? '' : String(h).toLowerCase().trim()
    )

    // Find column indices
    const dtIdx = headers.findIndex(h => h.includes('dttm') || h.includes('dictation'))
    const examIdx = headers.findIndex(h => h.includes('exam') && h.includes('desc'))
    const rvuIdx = headers.findIndex(h => h.includes('wrvu') || h.includes('rvu'))

    if (dtIdx === -1) {
      throw new Error(`Missing DICTATION DTTM column. Found columns: ${headers.filter(h => h).join(', ')}`)
    }
    if (examIdx === -1) {
      throw new Error(`Missing EXAM DESC column. Found columns: ${headers.filter(h => h).join(', ')}`)
    }
    if (rvuIdx === -1) {
      throw new Error(`Missing WRVU column. Found columns: ${headers.filter(h => h).join(', ')}`)
    }

    // Process data rows (everything after header)
    const dataRows = allData.slice(headerRowIndex + 1)
    
    const data = dataRows
      .filter(row => {
        if (!row || !Array.isArray(row)) return false
        return row[dtIdx] && row[examIdx]
      })
      .map(row => {
        let dateValue = row[dtIdx]
        
        // Handle different date formats
        if (dateValue instanceof Date) {
          // Already a Date object
          dateValue = dateValue.toISOString()
        } else if (typeof dateValue === 'number') {
          // Excel serial date number
          const excelDate = XLSX.SSF.parse_date_code(dateValue)
          if (excelDate) {
            dateValue = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')} ${String(excelDate.H || 0).padStart(2, '0')}:${String(excelDate.M || 0).padStart(2, '0')}:${String(excelDate.S || 0).padStart(2, '0')}`
          }
        }
        
        const rvuValue = row[rvuIdx]
        const wrvu = typeof rvuValue === 'number' ? rvuValue : parseFloat(String(rvuValue)) || 0
        
        return {
          dictation_datetime: String(dateValue),
          exam_description: String(row[examIdx] || ''),
          wrvu_estimate: wrvu,
        }
      })
      .filter(row => row.dictation_datetime && row.exam_description && !isNaN(row.wrvu_estimate))

    if (data.length === 0) {
      throw new Error('No valid data rows found after header')
    }

    return data
  }

  const processAllFiles = async () => {
    if (!user || selectedFiles.length === 0) return

    setUploading(true)
    const allData: { dictation_datetime: string; exam_description: string; wrvu_estimate: number }[] = []
    const fileStatuses: ProcessedFile[] = selectedFiles.map(f => ({
      name: f.name,
      rows: 0,
      status: 'pending' as const
    }))
    setProcessedFiles(fileStatuses)

    // Process each file
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      
      // Update status to processing
      setProcessedFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'processing' } : f
      ))

      try {
        const data = await processExcelFile(file)
        allData.push(...data)
        
        // Update status to done
        setProcessedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'done', rows: data.length } : f
        ))
      } catch (error) {
        // Update status to error
        setProcessedFiles(prev => prev.map((f, idx) => 
          idx === i ? { 
            ...f, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          } : f
        ))
      }
    }

    // Upload combined data to Supabase
    if (allData.length > 0) {
      // Sort by date like the old Python version
      allData.sort((a, b) => 
        new Date(a.dictation_datetime).getTime() - new Date(b.dictation_datetime).getTime()
      )

      const { error } = await addRecords(user.id, allData)
      if (error) {
        toast.error('Failed to upload to database')
      } else {
        toast.success(`Successfully imported ${allData.length.toLocaleString()} records from ${selectedFiles.length} file(s)!`)
        setSelectedFiles([])
        setProcessedFiles([])
      }
    } else {
      toast.error('No valid data found in the uploaded files')
    }

    setUploading(false)
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles(prev => [...prev, ...acceptedFiles])
    setProcessedFiles([])
  }, [])

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    disabled: uploading || loading,
  })

  if (compact) {
    return (
      <div className="space-y-3">
        <div
          {...getRootProps()}
          className={`
            p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all
            ${isDragActive 
              ? 'border-primary-500 bg-primary-500/10' 
              : 'border-dark-600 hover:border-dark-500 hover:bg-dark-800/30'
            }
            ${(uploading || loading) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          <div className="text-center">
            <Upload className="w-6 h-6 mx-auto text-dark-400 mb-2" />
            <p className="text-sm text-dark-300">
              Drop Excel files or click
            </p>
            <p className="text-xs text-dark-500 mt-1">
              Multiple .xlsx files supported
            </p>
          </div>
        </div>

        {/* Selected files list */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            {selectedFiles.map((file, i) => {
              const processed = processedFiles[i]
              return (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-dark-800/50 text-xs">
                  <File className="w-4 h-4 text-primary-400 flex-shrink-0" />
                  <span className="truncate flex-1 text-dark-300">{file.name}</span>
                  {processed?.status === 'done' && (
                    <span className="text-primary-400">{processed.rows} rows</span>
                  )}
                  {processed?.status === 'error' && (
                    <span className="text-red-400">Error</span>
                  )}
                  {!uploading && (
                    <button onClick={() => removeFile(i)} className="p-1 hover:bg-dark-700 rounded">
                      <X className="w-3 h-3 text-dark-400" />
                    </button>
                  )}
                </div>
              )
            })}
            <button
              onClick={processAllFiles}
              disabled={uploading || selectedFiles.length === 0}
              className="w-full py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              {uploading ? 'Processing...' : `Import ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="glass-card p-8 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center">
          <FileSpreadsheet className="w-6 h-6 text-primary-400" />
        </div>
        <div>
          <h3 className="text-xl font-display font-semibold text-dark-100">Upload Your Data</h3>
          <p className="text-sm text-dark-400">Import multiple Excel files - they'll be combined automatically</p>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={`
          p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all
          ${isDragActive 
            ? 'border-primary-500 bg-primary-500/10' 
            : 'border-dark-600 hover:border-primary-500/50 hover:bg-dark-800/30'
          }
          ${(uploading || loading) ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          {uploading ? (
            <>
              <div className="w-12 h-12 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-dark-200">Processing your files...</p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 mx-auto text-dark-400 mb-4" />
              <p className="text-lg text-dark-200 mb-2">
                {isDragActive ? 'Drop your files here' : 'Drag & drop Excel files here'}
              </p>
              <p className="text-sm text-dark-400">
                or click to browse • Multiple .xlsx files supported
              </p>
            </>
          )}
        </div>
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-dark-200 mb-3 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary-400" />
            Selected Files ({selectedFiles.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedFiles.map((file, i) => {
              const processed = processedFiles[i]
              return (
                <div 
                  key={i} 
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    processed?.status === 'error' 
                      ? 'bg-red-500/10 border border-red-500/20' 
                      : processed?.status === 'done'
                      ? 'bg-primary-500/10 border border-primary-500/20'
                      : 'bg-dark-800/50 border border-dark-700/30'
                  }`}
                >
                  <File className={`w-5 h-5 flex-shrink-0 ${
                    processed?.status === 'error' ? 'text-red-400' :
                    processed?.status === 'done' ? 'text-primary-400' :
                    'text-dark-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-dark-200 truncate">{file.name}</p>
                    <p className="text-xs text-dark-500">
                      {processed?.status === 'processing' && 'Processing...'}
                      {processed?.status === 'done' && `${processed.rows.toLocaleString()} records`}
                      {processed?.status === 'error' && (
                        <span className="text-red-400">{processed.error}</span>
                      )}
                      {!processed && `${(file.size / 1024).toFixed(1)} KB`}
                    </p>
                  </div>
                  {processed?.status === 'done' && (
                    <CheckCircle className="w-5 h-5 text-primary-400 flex-shrink-0" />
                  )}
                  {processed?.status === 'processing' && (
                    <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin flex-shrink-0" />
                  )}
                  {!uploading && !processed && (
                    <button 
                      onClick={() => removeFile(i)} 
                      className="p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
                    >
                      <X className="w-4 h-4 text-dark-400" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <button
            onClick={processAllFiles}
            disabled={uploading || selectedFiles.length === 0}
            className="mt-4 btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading 
              ? 'Processing & Uploading...' 
              : `Import ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''} to Database`
            }
          </button>
        </div>
      )}

      {/* Required columns info */}
      <div className="mt-6 p-4 rounded-xl bg-dark-800/50 border border-dark-700">
        <h4 className="text-sm font-semibold text-dark-200 mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          Expected Excel Format
        </h4>
        <p className="text-xs text-dark-400 mb-3">
          Files should be PS360 Resident Dictation Reports (header on row 9)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-dark-200 font-medium">DICTATION DTTM</p>
              <p className="text-dark-500">Date/time column</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-dark-200 font-medium">EXAM DESC</p>
              <p className="text-dark-500">Exam description</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-dark-200 font-medium">WRVU ESTIMATE</p>
              <p className="text-dark-500">Work RVU value</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
