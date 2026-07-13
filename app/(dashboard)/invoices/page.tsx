import { createServerActionClient } from '@/lib/supabase-server'
import { InvoicesClient } from './invoices-client'

export const dynamic = 'force-dynamic'

export default async function InvoicesPage() {
  const supabase = await createServerActionClient()

  const [
    { data: invoices },
    { data: customers },
    { data: branches },
    { data: creditSales },
  ] = await Promise.all([
    supabase.from('invoice_summary').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('customers').select('id, name, phone').order('name'),
    supabase.from('branches').select('id, name').eq('status', 'active'),
    supabase
      .from('sales')
      .select('id, receipt_number, customer_id, total_amount, created_at')
      .eq('payment_method', 'credit')
      .eq('sale_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <InvoicesClient
      initialInvoices={invoices || []}
      customers={customers || []}
      branches={branches || []}
      creditSales={creditSales || []}
    />
  )
}
