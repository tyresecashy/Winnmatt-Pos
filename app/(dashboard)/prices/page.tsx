import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { PriceAuditDashboard } from '@/components/prices/price-audit-dashboard'

export default async function PriceAuditPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Price Audit & Protection</h1>
        <p className="text-gray-500 mt-2">
          Review and protect live product prices before large-scale imports. Anomalies are
          automatically detected and flagged for admin review.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">⚠️ Important</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc pl-5">
          <li>
            All prices must be reviewed and approved before CSV imports continue
          </li>
          <li>
            Protected prices (marked &quot;high trust&quot;) cannot be overwritten by imports
          </li>
          <li>
            Critical anomalies (cost &gt; selling, extremely high prices) must be corrected
          </li>
          <li>
            Use [Protect] to mark manually curated prices so imports respect them
          </li>
        </ul>
      </div>

      <PriceAuditDashboard />
    </div>
  )
}
