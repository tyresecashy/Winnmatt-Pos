import { createServerActionClient } from '@/lib/supabase-server'
import { getLeaves, getLeaveStats } from '@/lib/leave-actions'
import { LeavesClient } from './leaves-client'

export const dynamic = 'force-dynamic'

export default async function LeavesPage() {
  const supabase = await createServerActionClient()

  const [leaves, stats, { data: profiles }] = await Promise.all([
    getLeaves(),
    getLeaveStats(),
    supabase
      .from('employee_profiles')
      .select('id, user_id, photo_url')
      .eq('employment_status', 'active'),
  ])

  // Get employee names
  let employeeNames: Record<string, string> = {}
  if (profiles && profiles.length > 0) {
    const userIds = profiles.map(p => p.user_id)
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', userIds)
    if (users) {
      for (const u of users) {
        const prof = profiles.find(p => p.user_id === u.id)
        if (prof) employeeNames[prof.id] = u.full_name
      }
    }
  }

  return (
    <LeavesClient
      initialLeaves={leaves}
      stats={stats}
      employeeNames={employeeNames}
      profiles={profiles || []}
    />
  )
}
