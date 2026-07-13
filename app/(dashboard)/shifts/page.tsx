'use client'

import { useAuth } from '@/contexts/auth-context'
import { ShiftOperations } from '@/components/shift-operations'
import { ShiftDashboard } from '@/components/shift-dashboard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Clock, BarChart3 } from 'lucide-react'

export default function ShiftsPage() {
  const { profile } = useAuth()
  const isManager = ['super_admin', 'admin', 'manager'].includes(profile?.role || '')

  if (!profile?.branch_id) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState
          title="No branch assigned"
          description="Your profile has no branch assignment. Contact an administrator."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Clock className="h-8 w-8 text-blue-500" />
          Shift Management
        </h1>
        <p className="text-muted-foreground mt-1">Open and close cashier shifts, view shift summaries</p>
      </div>

      {isManager ? (
        <Tabs defaultValue="my-shift">
          <TabsList>
            <TabsTrigger value="my-shift"><Clock className="h-4 w-4 mr-1" /> My Shift</TabsTrigger>
            <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1" /> Dashboard</TabsTrigger>
          </TabsList>
          <TabsContent value="my-shift" className="mt-4">
            <ShiftOperations
              branchId={profile.branch_id}
              cashierId={profile.id}
              cashierName={profile.full_name || 'Cashier'}
            />
          </TabsContent>
          <TabsContent value="dashboard" className="mt-4">
            <ShiftDashboard branchId={profile.branch_id} userId={profile.id} userRole={profile.role} />
          </TabsContent>
        </Tabs>
      ) : (
        <ShiftOperations
          branchId={profile.branch_id}
          cashierId={profile.id}
          cashierName={profile.full_name || 'Cashier'}
        />
      )}
    </div>
  )
}
