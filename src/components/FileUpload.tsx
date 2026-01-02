import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { parseCSV } from '@/lib/dataProcessing'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface FileUploadProps {
  compact?: boolean
}

export default function FileUpload({ compact = false }: FileUploadProps) {
  const { user } = useAuthStore()
  const { addRecords, loading } = useDataStore()
  const [pastedData, setPastedData] = useState('')
  const [uploading, setUploading] = useState(false)

  const processFile = useCallback(async (file: File) => {
    if (!user) return

    setUploading(true)
    try {
      let data: { dictation_datetime: string; exam_description: string; wrvu_estimate: number }[] = []

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // Excel file
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // Skip first 8 rows (metadata) like the Python version
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 8 }) as string[][]
        
        if (jsonData.length < 2) {
          throw new Error('No data found in file')
        }

        const headerRow = jsonData[0].map(h => String(h).toLowerCase())
        const dtIdx = headerRow.findIndex(h => h.includes('dttm') || h.includes('datetime') || h.includes('date'))
        const examIdx = headerRow.findIndex(h => h.includes('exam') && h.includes('desc'))
        const rvuIdx = headerRow.findIndex(h => h.includes('wrvu') || h.includes('rvu'))

        if (dtIdx === -1 || examIdx === -1 || rvuIdx === -1) {
          throw new Error('Missing required columns: DICTATION DTTM, EXAM DESC, WRVU ESTIMATE')
        }

        data = jsonData.slice(1)
          .filter(row => row[dtIdx] && row[examIdx])
          .map(row => ({
            dictation_datetime: String(row[dtIdx]),
            exam_description: String(row[examIdx]),
            wrvu_estimate: parseFloat(String(row[rvuIdx])) || 0,
          }))

      } else {
        // CSV file
        const text = await file.text()
        const result = Papa.parse(text, { header: true, skipEmptyLines: true })
        
        if (result.errors.length > 0) {
          console.warn('CSV parsing warnings:', result.errors)
        }

        const dtKey = Object.keys(result.data[0] || {}).find(h => 
          h.toLowerCase().includes('dttm') || h.toLowerCase().includes('datetime') || h.toLowerCase().includes('date')
        )
        const examKey = Object.keys(result.data[0] || {}).find(h => 
          h.toLowerCase().includes('exam') && h.toLowerCase().includes('desc')
        )
        const rvuKey = Object.keys(result.data[0] || {}).find(h => 
          h.toLowerCase().includes('wrvu') || h.toLowerCase().includes('rvu')
        )

        if (!dtKey || !examKey || !rvuKey) {
          throw new Error('Missing required columns: DICTATION DTTM, EXAM DESC, WRVU ESTIMATE')
        }

        data = (result.data as Record<string, string>[])
          .filter(row => row[dtKey] && row[examKey])
          .map(row => ({
            dictation_datetime: row[dtKey],
            exam_description: row[examKey],
            wrvu_estimate: parseFloat(row[rvuKey]) || 0,
          }))
      }

      if (data.length === 0) {
        throw new Error('No valid data found in file')
      }

      const { error } = await addRecords(user.id, data)
      if (error) {
        throw error
      }

      toast.success(`Imported ${data.length} records!`)
    } catch (error) {
      console.error('File processing error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to process file')
    } finally {
      setUploading(false)
    }
  }, [user, addRecords])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      processFile(acceptedFiles[0])
    }
  }, [processFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    disabled: uploading || loading,
  })

  const handlePastedData = async () => {
    if (!user || !pastedData.trim()) return

    setUploading(true)
    try {
      const data = parseCSV(pastedData)
      if (data.length === 0) {
        throw new Error('No valid data found')
      }

      const { error } = await addRecords(user.id, data)
      if (error) {
        throw error
      }

      toast.success(`Imported ${data.length} records!`)
      setPastedData('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process data')
    } finally {
      setUploading(false)
    }
  }

  if (compact) {
    return (
      <div className="space-y-4">
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
              Drop file or click
            </p>
            <p className="text-xs text-dark-500 mt-1">
              CSV, XLSX
            </p>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={pastedData}
            onChange={(e) => setPastedData(e.target.value)}
            placeholder="Or paste CSV data here..."
            className="w-full h-20 px-3 py-2 text-xs rounded-lg bg-dark-900 border border-dark-600 text-dark-200 placeholder-dark-500 resize-none focus:border-primary-500 outline-none"
          />
          {pastedData && (
            <button
              onClick={handlePastedData}
              disabled={uploading}
              className="absolute bottom-2 right-2 px-3 py-1 text-xs rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              Import
            </button>
          )}
        </div>
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
          <p className="text-sm text-dark-400">Import CSV or Excel files with your RVU data</p>
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
              <p className="text-dark-200">Processing your data...</p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 mx-auto text-dark-400 mb-4" />
              <p className="text-lg text-dark-200 mb-2">
                {isDragActive ? 'Drop your file here' : 'Drag & drop your file here'}
              </p>
              <p className="text-sm text-dark-400">
                or click to browse • CSV, XLSX supported
              </p>
            </>
          )}
        </div>
      </div>

      <div className="my-6 flex items-center gap-4">
        <div className="flex-1 h-px bg-dark-700" />
        <span className="text-sm text-dark-500">OR</span>
        <div className="flex-1 h-px bg-dark-700" />
      </div>

      <div>
        <label className="text-sm text-dark-300 mb-2 block">Paste CSV Data</label>
        <textarea
          value={pastedData}
          onChange={(e) => setPastedData(e.target.value)}
          placeholder="DICTATION DTTM,EXAM DESC,WRVU ESTIMATE&#10;2024-01-01 08:00:00,CT CHEST W/O CONTRAST,1.5&#10;..."
          className="w-full h-32 px-4 py-3 rounded-xl bg-dark-900 border border-dark-600 text-dark-200 placeholder-dark-500 resize-none focus:border-primary-500 outline-none font-mono text-sm"
        />
        <button
          onClick={handlePastedData}
          disabled={uploading || !pastedData.trim()}
          className="mt-3 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Import Pasted Data
        </button>
      </div>

      {/* Required columns info */}
      <div className="mt-6 p-4 rounded-xl bg-dark-800/50 border border-dark-700">
        <h4 className="text-sm font-semibold text-dark-200 mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          Required Columns
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-dark-200 font-medium">DICTATION DTTM</p>
              <p className="text-dark-500">Date/time of dictation</p>
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

