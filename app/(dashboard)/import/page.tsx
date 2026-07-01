'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileSpreadsheet, Database } from 'lucide-react'

export default function ImportPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Product Import</h1>
        <p className="text-muted-foreground">
          Import products from CSV files
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Under Maintenance</CardTitle>
          <CardDescription>
            The CSV import feature is being updated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4 space-y-2">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-medium">Bulk Upload</h3>
              <p className="text-xs text-muted-foreground">Upload product catalogs via CSV files with automatic field mapping</p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-medium">Validation</h3>
              <p className="text-xs text-muted-foreground">Preview and validate imported data before committing to the database</p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-medium">Bulk Updates</h3>
              <p className="text-xs text-muted-foreground">Update existing product prices, stock levels, and categories in bulk</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
