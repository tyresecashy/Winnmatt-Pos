/**
 * CSV Upload Dialog Component
 * Admin component for uploading products via CSV
 */

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface CSVUploadDialogProps {
  onImportComplete?: (batchId: string) => void
}

export function CSVUploadDialog({ onImportComplete }: CSVUploadDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [sourceName, setSourceName] = useState('csv_import')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Only CSV files are supported')
        return
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File too large (max 10MB)')
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('source_name', sourceName)

      const response = await fetch('/api/import/csv', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setResult(data)
      toast({
        title: 'Import started',
        description: `${data.totalRecords} products queued for processing`,
      })

      if (onImportComplete) {
        onImportComplete(data.batchId)
      }

      // Reset form after short delay
      setTimeout(() => {
        setOpen(false)
        setFile(null)
        setResult(null)
      }, 2000)
    } catch (err: any) {
      const message = err.message || 'Upload failed'
      setError(message)
      toast({
        title: 'Import failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Products from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with product data. The file will be processed into
            staging for review before going live.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Import successful! {result.totalRecords} products imported.
              </AlertDescription>
            </Alert>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Batch ID:</strong> {result.batchId}
              </p>
              <p>
                <strong>Total Records:</strong> {result.totalRecords}
              </p>
              <p>
                <strong>Valid Records:</strong> {result.validRecords}
              </p>
              {result.invalidRecords > 0 && (
                <p className="text-amber-600">
                  <strong>Invalid Records:</strong> {result.invalidRecords}
                </p>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Processing may take a few minutes. Check the staging review page.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source">Data Source</Label>
              <Select value={sourceName} onValueChange={setSourceName}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv_import">CSV Import</SelectItem>
                  <SelectItem value="jumia">Jumia Scrape</SelectItem>
                  <SelectItem value="nairobi_wholesalers">Nairobi Wholesalers</SelectItem>
                  <SelectItem value="suppliers">Direct Suppliers</SelectItem>
                  <SelectItem value="other">Other Source</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">CSV File</Label>
              <Input
                id="file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={loading}
              />
              {file && (
                <p className="text-sm text-gray-600">
                  Selected: {file.name} ({(file.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
              <p className="font-semibold mb-1">Required CSV Columns:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>source_name (e.g., "jumia")</li>
                <li>source_product_id (unique ID from source)</li>
                <li>scraped_name (product name)</li>
              </ul>
              <p className="font-semibold mt-2 mb-1">Optional Columns:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>brand, pack_size, unit, category</li>
                <li>listed_price, currency, barcode, image_url</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Import
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
