import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, File, Copy, XCircle, AlertTriangle } from 'lucide-react'
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

interface UploadError {
  message: string
  details: string
  timestamp: string
}

interface FalseDuplicate {
  timestamp: string
  existingExam: string
  newExam: string
  existingRvu: number
  newRvu: number
}

export default function FileUpload({ compact = false }: FileUploadProps) {
  const { user } = useAuthStore()
  const { addRecords, loading } = useDataStore()
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<UploadError | null>(null)
  const [falseDuplicates, setFalseDuplicates] = useState<FalseDuplicate[]>([])

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

  // Upload original file to Supabase Storage
  const uploadFileToStorage = async (file: File, userId: string): Promise<string | null> => {
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${userId}/${timestamp}_${sanitizedName}`

    const { error } = await supabase.storage
      .from('uploads')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Storage upload error:', error)
      return null
    }

    return filePath
  }

  // Save upload history to database
  const saveUploadHistory = async (
    userId: string,
    fileName: string,
    filePath: string,
    fileSize: number,
    recordsImported: number
  ) => {
    await supabase.from('upload_history').insert({
      user_id: userId,
      file_name: fileName,
      file_path: filePath,
      file_size: fileSize,
      records_imported: recordsImported,
    })
  }

  const processAllFiles = async () => {
    if (!user || selectedFiles.length === 0) return

    setUploading(true)
    setUploadError(null) // Clear previous errors
    const allData: { dictation_datetime: string; exam_description: string; wrvu_estimate: number }[] = []
    const fileStatuses: ProcessedFile[] = selectedFiles.map(f => ({
      name: f.name,
      rows: 0,
      status: 'pending' as const
    }))
    setProcessedFiles(fileStatuses)

    const fileErrors: string[] = []

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

        // Upload original file to storage
        const filePath = await uploadFileToStorage(file, user.id)
        if (filePath) {
          await saveUploadHistory(user.id, file.name, filePath, file.size, data.length)
        }
        
        // Update status to done
        setProcessedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'done', rows: data.length } : f
        ))
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        fileErrors.push(`${file.name}: ${errorMsg}`)
        // Update status to error
        setProcessedFiles(prev => prev.map((f, idx) => 
          idx === i ? { 
            ...f, 
            status: 'error', 
            error: errorMsg 
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

      const result = await addRecords(user.id, allData)
      if (result.error) {
        console.error('Upload error:', result.error)
        const errorDetails = [
          `User: ${user.email || user.id}`,
          `Files: ${selectedFiles.map(f => f.name).join(', ')}`,
          `Raw records parsed: ${allData.length}`,
          `Error: ${result.error.message || 'Unknown database error'}`,
          `Browser: ${navigator.userAgent}`,
        ].join('\n')
        
        setUploadError({
          message: 'Failed to save records to database',
          details: errorDetails,
          timestamp: new Date().toISOString()
        })
        toast.error('Upload failed - see error details below')
      } else {
        // Build detailed success message
        const inserted = result.insertedCount || 0
        const duplicates = result.duplicatesSkipped || 0
        const filtered = result.filteredOut || 0
        const falseDups = result.falseDuplicates || []
        
        let message = `Added ${inserted.toLocaleString()} new records`
        const notes: string[] = []
        if (duplicates > 0) notes.push(`${duplicates} duplicates skipped`)
        if (filtered > 0) notes.push(`${filtered} invalid rows filtered`)
        
        if (notes.length > 0) {
          message += ` (${notes.join(', ')})`
        }
        
        // Save false duplicates for display
        if (falseDups.length > 0) {
          setFalseDuplicates(falseDups)
          toast(`⚠️ ${falseDups.length} potential conflicts found - different studies with same timestamp`, { 
            duration: 8000,
            icon: '⚠️'
          })
        } else {
          setFalseDuplicates([])
        }
        
        toast.success(message, { duration: 5000 })
        setSelectedFiles([])
        setProcessedFiles([])
        setUploadError(null)
      }
    } else {
      const errorDetails = [
        `User: ${user.email || user.id}`,
        `Files: ${selectedFiles.map(f => f.name).join(', ')}`,
        `File parsing errors: ${fileErrors.length > 0 ? fileErrors.join('; ') : 'None'}`,
        `Browser: ${navigator.userAgent}`,
      ].join('\n')
      
      setUploadError({
        message: 'No valid data found in uploaded files',
        details: errorDetails,
        timestamp: new Date().toISOString()
      })
      toast.error('No valid data found - see error details below')
    }

    setUploading(false)
  }

  const copyErrorToClipboard = () => {
    if (!uploadError) return
    const errorText = `
=== myRVU Upload Error Report ===
Time: ${uploadError.timestamp}
Error: ${uploadError.message}

Details:
${uploadError.details}
================================
`.trim()
    navigator.clipboard.writeText(errorText)
    toast.success('Error details copied to clipboard!')
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles(prev => [...prev, ...acceptedFiles])
    setProcessedFiles([])
    setUploadError(null) // Clear errors when new files are added
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
            ${(uploading || loading) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          style={{
            borderColor: isDragActive ? 'var(--accent-primary)' : 'var(--border-color)',
            backgroundColor: isDragActive ? 'var(--accent-muted)' : 'transparent'
          }}
        >
          <input {...getInputProps()} />
          <div className="text-center">
            <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Drop Excel files or click
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
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
                <div 
                  key={i} 
                  className="flex items-center gap-2 p-2 rounded-lg text-xs"
                  style={{ backgroundColor: 'var(--bg-hover)' }}
                >
                  <File className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                  <span className="truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{file.name}</span>
                  {processed?.status === 'done' && (
                    <span style={{ color: 'var(--accent-primary)' }}>{processed.rows} rows</span>
                  )}
                  {processed?.status === 'error' && (
                    <span style={{ color: 'var(--danger)' }}>Error</span>
                  )}
                  {!uploading && (
                    <button onClick={() => removeFile(i)} className="p-1 rounded interactive-item">
                      <X className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                    </button>
                  )}
                </div>
              )
            })}
            <button
              onClick={processAllFiles}
              disabled={uploading || selectedFiles.length === 0}
              className="w-full py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {uploading ? 'Processing...' : `Import ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {/* Error Display */}
        {uploadError && (
          <div 
            className="mt-3 p-3 rounded-xl text-xs"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)' }}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--danger)' }} />
                <span className="font-semibold" style={{ color: 'var(--danger)' }}>{uploadError.message}</span>
              </div>
              <button
                onClick={() => setUploadError(null)}
                className="p-1 rounded hover:bg-red-500/20"
              >
                <X className="w-3 h-3" style={{ color: 'var(--danger)' }} />
              </button>
            </div>
            <pre 
              className="p-2 rounded text-[10px] overflow-x-auto whitespace-pre-wrap break-all"
              style={{ backgroundColor: 'rgba(0,0,0,0.2)', color: 'var(--text-secondary)' }}
            >
              {uploadError.details}
            </pre>
            <button
              onClick={copyErrorToClipboard}
              className="mt-2 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors hover:bg-red-500/20"
              style={{ color: 'var(--danger)' }}
            >
              <Copy className="w-3 h-3" />
              Copy Error Details
            </button>
          </div>
        )}

        {/* False Duplicates Warning */}
        {falseDuplicates.length > 0 && (
          <div 
            className="mt-3 p-3 rounded-xl text-xs"
            style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgb(245, 158, 11)' }}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                <span className="font-semibold text-amber-500">
                  {falseDuplicates.length} Potential Conflicts
                </span>
              </div>
              <button
                onClick={() => setFalseDuplicates([])}
                className="p-1 rounded hover:bg-amber-500/20"
              >
                <X className="w-3 h-3 text-amber-500" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mb-2">
              These records have the same timestamp as existing records but different descriptions. The new ones were skipped:
            </p>
            <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
              {falseDuplicates.slice(0, 10).map((fd, i) => (
                <div key={i} className="p-2 rounded bg-slate-800/50 space-y-1">
                  <div className="text-[10px] text-slate-500">
                    {new Date(fd.timestamp).toLocaleString()}
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="text-[9px] px-1 rounded bg-green-500/20 text-green-400">KEPT</span>
                    <span className="text-slate-300 flex-1">{fd.existingExam}</span>
                    <span className="text-emerald-400">{fd.existingRvu.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="text-[9px] px-1 rounded bg-red-500/20 text-red-400">SKIP</span>
                    <span className="text-slate-400 flex-1">{fd.newExam}</span>
                    <span className="text-slate-500">{fd.newRvu.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              {falseDuplicates.length > 10 && (
                <div className="text-center text-slate-500 text-[10px] py-1">
                  +{falseDuplicates.length - 10} more conflicts
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div 
      className="p-8 rounded-xl animate-slide-up"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--accent-muted)' }}
        >
          <FileSpreadsheet className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
        </div>
        <div>
          <h3 className="text-xl font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
            Upload Your Data
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Import multiple Excel files - they'll be combined automatically
          </p>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={`
          p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all
          ${(uploading || loading) ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        style={{
          borderColor: isDragActive ? 'var(--accent-primary)' : 'var(--border-color)',
          backgroundColor: isDragActive ? 'var(--accent-muted)' : 'transparent'
        }}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          {uploading ? (
            <>
              <div 
                className="w-12 h-12 border-2 rounded-full animate-spin mx-auto mb-4"
                style={{ borderColor: 'var(--accent-muted)', borderTopColor: 'var(--accent-primary)' }}
              />
              <p style={{ color: 'var(--text-secondary)' }}>Processing your files...</p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
              <p className="text-lg mb-2" style={{ color: 'var(--text-secondary)' }}>
                {isDragActive ? 'Drop your files here' : 'Drag & drop Excel files here'}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                or click to browse • Multiple .xlsx files supported
              </p>
            </>
          )}
        </div>
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="mt-6">
          <h4 
            className="text-sm font-semibold mb-3 flex items-center gap-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            <FileSpreadsheet className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            Selected Files ({selectedFiles.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedFiles.map((file, i) => {
              const processed = processedFiles[i]
              return (
                <div 
                  key={i} 
                  className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                  style={{ 
                    backgroundColor: processed?.status === 'error' 
                      ? 'var(--danger-muted)' 
                      : processed?.status === 'done'
                      ? 'var(--accent-muted)'
                      : 'var(--bg-tertiary)',
                    border: `1px solid ${processed?.status === 'error' 
                      ? 'var(--danger)' 
                      : processed?.status === 'done'
                      ? 'var(--accent-primary)'
                      : 'var(--border-color)'}`,
                    borderColor: processed?.status === 'error' 
                      ? 'color-mix(in srgb, var(--danger) 30%, transparent)' 
                      : processed?.status === 'done'
                      ? 'color-mix(in srgb, var(--accent-primary) 30%, transparent)'
                      : 'var(--border-color)'
                  }}
                >
                  <File 
                    className="w-5 h-5 flex-shrink-0" 
                    style={{ 
                      color: processed?.status === 'error' ? 'var(--danger)' :
                        processed?.status === 'done' ? 'var(--accent-primary)' :
                        'var(--text-muted)'
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{file.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {processed?.status === 'processing' && 'Processing...'}
                      {processed?.status === 'done' && `${processed.rows.toLocaleString()} records`}
                      {processed?.status === 'error' && (
                        <span style={{ color: 'var(--danger)' }}>{processed.error}</span>
                      )}
                      {!processed && `${(file.size / 1024).toFixed(1)} KB`}
                    </p>
                  </div>
                  {processed?.status === 'done' && (
                    <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                  )}
                  {processed?.status === 'processing' && (
                    <div 
                      className="w-5 h-5 border-2 rounded-full animate-spin flex-shrink-0"
                      style={{ borderColor: 'var(--accent-muted)', borderTopColor: 'var(--accent-primary)' }}
                    />
                  )}
                  {!uploading && !processed && (
                    <button 
                      onClick={() => removeFile(i)} 
                      className="p-1.5 rounded-lg transition-colors interactive-item"
                    >
                      <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <button
            onClick={processAllFiles}
            disabled={uploading || selectedFiles.length === 0}
            className="mt-4 w-full py-2.5 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            {uploading 
              ? 'Processing & Uploading...' 
              : `Import ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''} to Database`
            }
          </button>
        </div>
      )}

      {/* Error Display */}
      {uploadError && (
        <div 
          className="mt-6 p-4 rounded-xl"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)' }}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--danger)' }} />
              <span className="font-semibold" style={{ color: 'var(--danger)' }}>{uploadError.message}</span>
            </div>
            <button
              onClick={() => setUploadError(null)}
              className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              <X className="w-4 h-4" style={{ color: 'var(--danger)' }} />
            </button>
          </div>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            Please copy the error details below and send them to support:
          </p>
          <pre 
            className="p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap break-all"
            style={{ backgroundColor: 'rgba(0,0,0,0.3)', color: 'var(--text-secondary)' }}
          >
            {uploadError.details}
          </pre>
          <button
            onClick={copyErrorToClipboard}
            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-red-500/20"
            style={{ color: 'var(--danger)', border: '1px solid var(--danger)' }}
          >
            <Copy className="w-4 h-4" />
            Copy Error Details to Clipboard
          </button>
        </div>
      )}

      {/* False Duplicates Warning */}
      {falseDuplicates.length > 0 && (
        <div 
          className="mt-6 p-4 rounded-xl"
          style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgb(245, 158, 11)' }}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
              <span className="font-semibold text-amber-500">
                {falseDuplicates.length} Potential Timestamp Conflicts
              </span>
            </div>
            <button
              onClick={() => setFalseDuplicates([])}
              className="p-1.5 rounded-lg hover:bg-amber-500/20 transition-colors"
            >
              <X className="w-4 h-4 text-amber-500" />
            </button>
          </div>
          <p className="text-sm text-slate-400 mb-3">
            These records have the same timestamp as existing records but different exam descriptions. 
            The new records were skipped to avoid overwriting existing data.
          </p>
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {falseDuplicates.map((fd, i) => (
              <div key={i} className="p-3 rounded-lg bg-slate-800/50 space-y-2">
                <div className="text-xs text-slate-500 font-mono">
                  📅 {new Date(fd.timestamp).toLocaleString()}
                </div>
                <div className="flex gap-2 items-start text-sm">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 flex-shrink-0">KEPT</span>
                  <span className="text-slate-300 flex-1">{fd.existingExam}</span>
                  <span className="text-emerald-400 font-mono">{fd.existingRvu.toFixed(2)} RVU</span>
                </div>
                <div className="flex gap-2 items-start text-sm">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 flex-shrink-0">SKIP</span>
                  <span className="text-slate-400 flex-1">{fd.newExam}</span>
                  <span className="text-slate-500 font-mono">{fd.newRvu.toFixed(2)} RVU</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            💡 This usually happens when multiple studies are dictated at the exact same second. 
            Consider checking if these studies should be added separately.
          </p>
        </div>
      )}

      {/* Required columns info */}
      <div 
        className="mt-6 p-4 rounded-xl"
        style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
      >
        <h4 
          className="text-sm font-semibold mb-3 flex items-center gap-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          <AlertCircle className="w-4 h-4" style={{ color: 'var(--warning)' }} />
          Expected Excel Format
        </h4>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          Files should be PS360 Resident Dictation Reports (header on row 9)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-primary)' }} />
            <div>
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>DICTATION DTTM</p>
              <p style={{ color: 'var(--text-muted)' }}>Date/time column</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-primary)' }} />
            <div>
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>EXAM DESC</p>
              <p style={{ color: 'var(--text-muted)' }}>Exam description</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-primary)' }} />
            <div>
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>WRVU ESTIMATE</p>
              <p style={{ color: 'var(--text-muted)' }}>Work RVU value</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
