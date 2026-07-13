'use client'

import { FileQuestion, Home } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <EmptyState
        icon={FileQuestion}
        title="Page Not Found"
        description="The page you are looking for does not exist or has been moved."
        actions={[{ label: 'Back to Dashboard', onClick: () => { window.location.href = '/' }, icon: Home }]}
        className="max-w-md"
      />
    </div>
  )
}
