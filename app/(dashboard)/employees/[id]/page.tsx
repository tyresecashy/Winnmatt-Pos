import { createServerActionClient } from '@/lib/supabase-server'
import { getEmployee } from '@/lib/modules/workforce'
import { EmployeeDetailClient, type EmployeeData, type LeaveRequestItem } from './employee-detail-client'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface LeaveRequest {
  id: string
  employee_profile_id: string
  start_date: string
  end_date: string
  status: string
  reason: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
  approved_by_user?: { full_name: string } | null
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerActionClient()

  const employee = await getEmployee(id)
  if (!employee) notFound()

  // Fetch recent clock events for this employee
  const { data: clockEvents } = await supabase
    .from('clock_events')
    .select('*')
    .eq('user_id', employee.user_id)
    .order('timestamp', { ascending: false })
    .limit(20)

  // Fetch leave requests for this employee
  const { data: profile } = await supabase
    .from('employee_profiles')
    .select('id')
    .eq('user_id', employee.user_id)
    .single()

  let leaveRequests: LeaveRequest[] = []
  if (profile) {
    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('*, approved_by_user:users!approved_by(full_name)')
      .eq('employee_profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
    leaveRequests = (leaves || []).map((l) => ({
      ...l,
      approved_by_name: l.approved_by_user?.full_name || null,
    }))
  }

  return (
    <EmployeeDetailClient
      employee={employee as unknown as EmployeeData}
      clockEvents={clockEvents || []}
      leaveRequests={leaveRequests.map(l => ({
        id: l.id,
        leave_type: 'unknown' as const,
        start_date: l.start_date,
        end_date: l.end_date,
        status: l.status,
        reason: l.reason,
        approved_by_name: l.approved_by_user?.full_name || null,
        approved_at: null as string | null,
        created_at: l.created_at,
      })) as unknown as LeaveRequestItem[]}
    />
  )
}
