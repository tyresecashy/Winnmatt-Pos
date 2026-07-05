import { createServerActionClient } from '@/lib/supabase-server'
import { getRegisters, getCashDrawers, getCashSummary } from '@/lib/cash-actions'
import { RegistersClient } from './registers-client'
import { getEmployeeStats } from '@/lib/employee-actions'

export const dynamic = 'force-dynamic'

export default async function RegistersPage() {
  const supabase = await createServerActionClient()

  // Get current user's branch
  const { data: { user } } = await supabase.auth.getUser()
  let userBranchId: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('branch_id')
      .eq('auth_id', user.id)
      .single()
    if (profile) userBranchId = profile.branch_id
  }

  const branchId = userBranchId ?? null

  const [registers, drawers, summary, { data: branches }, { data: cashiers }] = await Promise.all([
    getRegisters(branchId ?? undefined),
    branchId ? getCashDrawers(branchId) : Promise.resolve([]),
    branchId ? getCashSummary(branchId) : Promise.resolve(null),
    supabase.from('branches').select('id, name').eq('status', 'active'),
    supabase.from('users').select('id, full_name, role').in('role', ['admin', 'cashier', 'super_admin']),
  ])

  return (
    <RegistersClient
      initialRegisters={registers}
      initialDrawers={drawers}
      summary={summary}
      branches={branches || []}
      cashiers={cashiers || []}
      currentBranchId={branchId}
    />
  )
}
