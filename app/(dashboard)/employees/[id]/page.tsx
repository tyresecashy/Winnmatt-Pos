import { createServerActionClient } from '@/lib/supabase-server'
import { getEmployeeById } from '@/lib/employee-actions'
import { EmployeeDetailClient } from './employee-detail-client'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerActionClient()

  const employee = await getEmployeeById(id)
  if (!employee) notFound()

  // Fetch recent clock events for this employee
  const { data: clockEvents } = await supabase
    .from('clock_events')
    .select('*')
    .eq('user_id', (employee as any).user_id)
    .order('timestamp', { ascending: false })
    .limit(20)

  // Fetch leave requests for this employee
  const { data: profile } = await supabase
    .from('employee_profiles')
    .select('id')
    .eq('user_id', (employee as any).user_id)
    .single()

  let leaveRequests: any[] = []
  if (profile) {
    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('*, approved_by_user:users!approved_by(full_name)')
      .eq('employee_profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
    leaveRequests = (leaves || []).map((l: any) => ({
      ...l,
      approved_by_name: l.approved_by_user?.full_name || null,
    }))
  }

  return (
    <EmployeeDetailClient
      employee={employee}
      clockEvents={clockEvents || []}
      leaveRequests={leaveRequests}
    />
  )
}
