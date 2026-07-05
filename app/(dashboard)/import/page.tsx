'use client'

import { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

type ImportState = 'idle' | 'file_selected' | 'preview' | 'validating' | 'validated' | 'importing' | 'done' | 'error'

const SAMPLE_HEADERS = ['name', 'sku', 'price', 'stock', 'category']

export default function ImportPage() {
  const [state, setState] = useState<ImportState>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const [isValidating, setIsValidating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseCSV = useCallback((text: string) => {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length === 0) return
    const h = lines[0].split(',').map(s => s.trim())
    setHeaders(h)
    const rows = lines.slice(1, 6).map(line => line.split(',').map(s => s.trim()))
    setPreviewRows(rows)
  }, [])

  const handleFile = useCallback((selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setMessage('Please select a valid CSV file.')
      setState('error')
      return
    }
    setFile(selectedFile)
    setMessage('')
    setProgress(0)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      parseCSV(text)
      setState('file_selected')
    }
    reader.readAsText(selectedFile)
  }, [parseCSV])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) handleFile(droppedFile)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const handleValidate = () => {
    setIsValidating(true)
    setState('validating')
    setTimeout(() => {
      setIsValidating(false)
      if (headers.length > 0) {
        setMessage(`Found ${headers.length} columns, ${previewRows.length} preview rows. Validation passed.`)
        setState('validated')
      } else {
        setMessage('No data to validate.')
        setState('error')
      }
    }, 800)
  }

  const handleImport = () => {
    setState('importing')
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval)
          setState('done')
          setMessage(`Successfully imported ${file?.name}.`)
          return 100
        }
        return p + 10
      })
    }, 300)
  }

  const handleReset = () => {
    setState('idle')
    setFile(null)
    setPreviewRows([])
    setHeaders([])
    setMessage('')
    setProgress(0)
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Product Import</h1>
        <p className="text-muted-foreground">
          Import products from CSV files
        </p>
      </div>

      <Card
        className={`border-2 border-dashed transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>Upload CSV</CardTitle>
              <CardDescription>
                Drag and drop a CSV file here, or click the button below to select one
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground/60" />
            <div>
              <p className="text-sm text-muted-foreground">
                {file ? file.name : 'No file selected'}
              </p>
              {file && (
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0]
                if (selectedFile) handleFile(selectedFile)
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={state === 'importing'}
            >
              <Upload className="h-4 w-4 mr-2" />
              Select CSV File
            </Button>
            {(state === 'file_selected' || state === 'preview' || state === 'validated') && (
              <Button variant="ghost" onClick={handleReset}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {message && state === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {state === 'importing' && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Importing products...</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{progress}% complete</p>
            </div>
          </CardContent>
        </Card>
      )}

      {state === 'done' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{message}</AlertDescription>
        </Alert>
      )}

      {(state === 'file_selected' || state === 'preview' || state === 'validating' || state === 'validated') && headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Showing first {previewRows.length} of {file?.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className="border-b last:border-0">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 truncate max-w-[160px]">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleValidate} disabled={isValidating}>
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Validate'
                )}
              </Button>
              {state === 'validated' && (
                <Button onClick={handleImport}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Products
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {state === 'validated' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
