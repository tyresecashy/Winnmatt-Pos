import { createServerActionClient } from '@/lib/supabase-server'
import { CreditTransactionsClient } from './credit-transactions-client'

export const dynamic = 'force-dynamic'

export default async function CustomerCreditPage() {
  const supabase = await createServerActionClient()

  // Fetch all data in parallel
  const [
    { data: summaries },
    { data: allPayments },
    { data: customers },
  ] = await Promise.all([
    supabase.from('customer_credit_summary').select('*').order('credit_balance', { ascending: false }),
    supabase
      .from('credit_payments')
      .select(`
        *,
        customer:customers(name),
        recorded_by_user:users!recorded_by(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('customers').select('id, name, phone, credit_limit, credit_balance').order('name'),
  ])

  const creditSummaries = (summaries || []) as any[]
  const payments = (allPayments || []).map((p: any) => ({
    ...p,
    customer_name: p.customer?.name || 'Deleted Customer',
    recorded_by_name: p.recorded_by_user?.full_name || 'Unknown',
  }))

  return (
    <CreditTransactionsClient
      summaries={creditSummaries}
      payments={payments}
      customers={customers || []}
    />
  )
}
