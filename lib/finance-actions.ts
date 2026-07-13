'use server'

import { logger } from '@/lib/logger'

import { createClient } from '@supabase/supabase-js'
import { authenticateServerAction } from './auth-helpers'
import { emitEvent } from '@/lib/automation/events'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function requireFinanceRole(profile: { role?: string } | null | undefined) {
  if (!profile) throw new Error('Unauthorized')
  const allowed = ['admin', 'manager', 'super_admin']
  if (!profile.role || !allowed.includes(profile.role)) {
    throw new Error('Insufficient permissions: finance access requires admin or manager role')
  }
}

// ─── Types ─────────────────────────────────────────────────

export interface Account {
  id: string
  account_number: string
  name: string
  description: string | null
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'cogs'
  account_subtype: string | null
  parent_id: string | null
  currency: string
  is_active: boolean
  is_system: boolean
  normal_balance: 'debit' | 'credit' | null
  branch_id: string | null
  created_at: string
  updated_at: string
  subaccounts?: Account[]
  balance?: number
}

export interface JournalEntry {
  id: string
  entry_number: string
  entry_date: string
  description: string
  reference_type: string | null
  reference_id: string | null
  period_id: string | null
  branch_id: string | null
  status: 'draft' | 'posted' | 'voided'
  total_debit: number
  total_credit: number
  posted_by: string | null
  posted_at: string | null
  notes: string | null
  created_at: string
  lines?: JournalEntryLine[]
}

export interface JournalEntryLine {
  id: string
  journal_entry_id: string
  account_id: string
  debit: number
  credit: number
  description: string | null
  line_number: number
  account?: Account
}

export interface FinancialPeriod {
  id: string
  name: string
  period_type: 'year' | 'quarter' | 'month'
  start_date: string
  end_date: string
  status: 'open' | 'closed' | 'locked'
  branch_id: string | null
  created_at: string
}

// ─── Chart of Accounts ─────────────────────────────────────

export async function getAccounts(branchId?: string) {
  const { profile } = await authenticateServerAction()
  requireFinanceRole(profile)

  let query = supabaseAdmin
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .order('account_number')

  if (branchId) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }

  const { data, error } = await query
  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return data as Account[]
}

export async function getAccountsByType(branchId?: string) {
  const accounts = await getAccounts(branchId)

  const grouped: Record<string, Account[]> = {
    asset: [],
    liability: [],
    equity: [],
    revenue: [],
    expense: [],
    cogs: [],
  }

  for (const account of accounts) {
    grouped[account.account_type]?.push(account)
  }

  return grouped
}

export async function createAccount(data: {
  account_number: string
  name: string
  description?: string
  account_type: string
  account_subtype?: string
  parent_id?: string
  normal_balance?: string
  branch_id?: string
}) {
  await authenticateServerAction()

  const { data: account, error } = await supabaseAdmin
    .from('accounts')
    .insert({
      account_number: data.account_number,
      name: data.name,
      description: data.description || null,
      account_type: data.account_type,
      account_subtype: data.account_subtype || null,
      parent_id: data.parent_id || null,
      normal_balance: data.normal_balance || null,
      branch_id: data.branch_id || null,
    })
    .select()
    .single()

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return { success: true, data: account }
}

export async function updateAccount(id: string, data: {
  name?: string
  description?: string
  account_subtype?: string
  is_active?: boolean
}) {
  await authenticateServerAction()

  const { error } = await supabaseAdmin
    .from('accounts')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return { success: true }
}

export async function deleteAccount(id: string) {
  await authenticateServerAction()

  // Check if account is system account
  const { data: account } = await supabaseAdmin
    .from('accounts')
    .select('is_system')
    .eq('id', id)
    .single()

  if (account?.is_system) {
    return { success: false, error: 'Cannot delete system accounts' }
  }

  // Check if account has journal entries
  const { count } = await supabaseAdmin
    .from('journal_entry_lines')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', id)

  if (count && count > 0) {
    return { success: false, error: 'Cannot delete accounts with journal entries' }
  }

  const { error } = await supabaseAdmin
    .from('accounts')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return { success: true }
}

// ─── General Ledger ────────────────────────────────────────

export async function getJournalEntries(params?: {
  branchId?: string
  startDate?: string
  endDate?: string
  status?: string
  limit?: number
  offset?: number
}) {
  const { profile } = await authenticateServerAction()
  requireFinanceRole(profile)

  let query = supabaseAdmin
    .from('journal_entries')
    .select('*, lines:journal_entry_lines(*, account:accounts(id, account_number, name))')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (params?.branchId) {
    query = query.eq('branch_id', params.branchId)
  }
  if (params?.startDate) {
    query = query.gte('entry_date', params.startDate)
  }
  if (params?.endDate) {
    query = query.lte('entry_date', params.endDate)
  }
  if (params?.status) {
    query = query.eq('status', params.status)
  }

  const limit = params?.limit || 50
  const offset = params?.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query
  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return data as JournalEntry[]
}

export async function getJournalEntry(id: string) {
  await authenticateServerAction()

  const { data, error } = await supabaseAdmin
    .from('journal_entries')
    .select('*, lines:journal_entry_lines(*, account:accounts(id, account_number, name, normal_balance))')
    .eq('id', id)
    .single()

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return data as JournalEntry
}

export async function createJournalEntry(data: {
  entry_date: string
  description: string
  branch_id?: string
  notes?: string
  lines: Array<{
    account_id: string
    debit: number
    credit: number
    description?: string
  }>
}) {
  const { profile } = await authenticateServerAction()
  requireFinanceRole(profile)

  // Validate debits = credits
  const totalDebit = data.lines.reduce((sum, l) => sum + (l.debit || 0), 0)
  const totalCredit = data.lines.reduce((sum, l) => sum + (l.credit || 0), 0)

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { success: false, error: 'Debits must equal credits' }
  }

  // Generate entry number
  const { data: seqData } = await supabaseAdmin.rpc('nextval', { seqname: 'journal_entry_number_seq' }).single()
  const entryNumber = `JE-${new Date(data.entry_date).toISOString().slice(0, 7)}-${String(seqData).padStart(6, '0')}`

  // Get current period
  const { data: period } = await supabaseAdmin
    .from('financial_periods')
    .select('id')
    .lte('start_date', data.entry_date)
    .gte('end_date', data.entry_date)
    .eq('status', 'open')
    .limit(1)
    .single()

  // Create entry
  const { data: entry, error: entryError } = await supabaseAdmin
    .from('journal_entries')
    .insert({
      entry_number: entryNumber,
      entry_date: data.entry_date,
      description: data.description,
      period_id: period?.id || null,
      branch_id: data.branch_id || null,
      status: 'posted',
      total_debit: totalDebit,
      total_credit: totalCredit,
      notes: data.notes || null,
      posted_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (entryError) {
      if (entryError) logger.error('Operation failed', { error: entryError })
      throw new Error('Operation failed')
    }

  // Create lines
  const lines = data.lines.map((line, i) => ({
    journal_entry_id: entry.id,
    account_id: line.account_id,
    debit: line.debit || 0,
    credit: line.credit || 0,
    description: line.description || null,
    line_number: i + 1,
  }))

  const { error: linesError } = await supabaseAdmin
    .from('journal_entry_lines')
    .insert(lines)

  if (linesError) {
      if (linesError) logger.error('Operation failed', { error: linesError })
      throw new Error('Operation failed')
    }

  return { success: true, data: entry }
}

export async function voidJournalEntry(id: string, reason: string) {
  await authenticateServerAction()

  const { data: entry } = await supabaseAdmin
    .from('journal_entries')
    .select('status')
    .eq('id', id)
    .single()

  if (entry?.status !== 'posted') {
    return { success: false, error: 'Only posted entries can be voided' }
  }

  const { error } = await supabaseAdmin
    .from('journal_entries')
    .update({
      status: 'voided',
      void_reason: reason,
      voided_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return { success: true }
}

// ─── Account Balances ──────────────────────────────────────

export async function getAccountBalances(branchId?: string) {
  const { profile } = await authenticateServerAction()
  requireFinanceRole(profile)

  // Get all posted journal entry lines with account info
  let query = supabaseAdmin
    .from('journal_entry_lines')
    .select(`
      journal_entry_id,
      account_id,
      debit,
      credit,
      account:accounts(id, account_number, name, account_type, normal_balance)
    `)

  const { data: lines, error } = await query
  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }

  // If branch filtering needed, also get branch-specific entries
  let filteredLines = lines
  if (branchId) {
    const { data: branchEntries } = await supabaseAdmin
      .from('journal_entries')
      .select('id')
      .eq('branch_id', branchId)
      .eq('status', 'posted')

    const entryIds = branchEntries?.map(e => e.id) || []
    filteredLines = lines?.filter(l => entryIds.includes(l.journal_entry_id)) || []
  }

  interface AccountInfo { account_number: string; name: string; account_type: string; normal_balance: string | null }
  const balanceMap = new Map<string, { debit: number; credit: number; account: AccountInfo }>()

  for (const line of filteredLines || []) {
    const acc = line.account as unknown as AccountInfo
    if (!acc) continue

    const existing = balanceMap.get(line.account_id) || { debit: 0, credit: 0, account: acc }
    existing.debit += Number(line.debit)
    existing.credit += Number(line.credit)
    balanceMap.set(line.account_id, existing)
  }

  // Convert to balance array
  const balances = Array.from(balanceMap.entries()).map(([accountId, data]) => {
    const { account } = data
    const isDebitNormal = account.normal_balance === 'debit'
    const balance = isDebitNormal ? data.debit - data.credit : data.credit - data.debit

    return {
      account_id: accountId,
      account_number: account.account_number,
      account_name: account.name,
      account_type: account.account_type,
      normal_balance: account.normal_balance,
      total_debit: data.debit,
      total_credit: data.credit,
      balance,
    }
  })

  return balances.sort((a, b) => a.account_number.localeCompare(b.account_number))
}

// ─── Financial Periods ─────────────────────────────────────

export async function getFinancialPeriods() {
  await authenticateServerAction()

  const { data, error } = await supabaseAdmin
    .from('financial_periods')
    .select('*')
    .order('start_date', { ascending: false })

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return data as FinancialPeriod[]
}

export async function createFinancialPeriod(data: {
  name: string
  period_type: string
  start_date: string
  end_date: string
  branch_id?: string
}) {
  await authenticateServerAction()

  const { data: period, error } = await supabaseAdmin
    .from('financial_periods')
    .insert({
      name: data.name,
      period_type: data.period_type,
      start_date: data.start_date,
      end_date: data.end_date,
      branch_id: data.branch_id || null,
    })
    .select()
    .single()

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return { success: true, data: period }
}

export async function closeFinancialPeriod(id: string) {
  const { profile } = await authenticateServerAction()
  if (!profile) throw new Error('Unauthorized')
  requireFinanceRole(profile)

  // 1. Get the period details
  const { data: period, error: periodErr } = await supabaseAdmin
    .from('financial_periods')
    .select('*')
    .eq('id', id)
    .single()

  if (periodErr || !period) throw new Error('Financial period not found')
  if (period.status === 'closed') throw new Error('Period is already closed')

  // 2. Check for unposted journal entries
  const { data: unposted } = await supabaseAdmin
    .from('journal_entries')
    .select('id')
    .eq('status', 'draft')
    .gte('entry_date', period.start_date)
    .lte('entry_date', period.end_date)

  if (unposted && unposted.length > 0) {
    throw new Error(`Cannot close period: ${unposted.length} journal entries are still in draft status. Post or void them first.`)
  }

  // 3. Verify debits = credits for the period
  const { data: entries } = await supabaseAdmin
    .from('journal_entries')
    .select('id, total_debit, total_credit')
    .eq('status', 'posted')
    .gte('entry_date', period.start_date)
    .lte('entry_date', period.end_date)

  if (entries && entries.length > 0) {
    const totalDebit = entries.reduce((sum, e) => sum + (e.total_debit || 0), 0)
    const totalCredit = entries.reduce((sum, e) => sum + (e.total_credit || 0), 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Cannot close period: Total debits (KSh ${totalDebit}) do not equal total credits (KSh ${totalCredit}). Difference: KSh ${Math.abs(totalDebit - totalCredit).toFixed(2)}`)
    }
  }

  // 4. Create closing journal entries (zero out income/expense accounts)
  // Look up Retained Earnings account dynamically
  const { data: retainedEarnings } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .eq('account_subtype', 'retained_earnings')
    .maybeSingle()

  if (!retainedEarnings) {
    throw new Error('Retained Earnings account not found. Ensure a system account with account_subtype = retained_earnings exists.')
  }
  const retainedEarningsId = retainedEarnings.id

  // Get all income and expense account balances for the period
  // (journal_entry_lines has no entry_date — join through journal_entries)
  const { data: lines } = await supabaseAdmin
    .from('journal_entry_lines')
    .select(`
      account_id,
      debit,
      credit,
      journal_entry:journal_entries!inner(entry_date)
    `)
    .gte('journal_entry.entry_date', period.start_date)
    .lte('journal_entry.entry_date', period.end_date)

  if (lines && lines.length > 0) {
    // Aggregate by account
    const accountBalances = new Map<string, { debit: number; credit: number }>()
    for (const line of lines) {
      const existing = accountBalances.get(line.account_id) || { debit: 0, credit: 0 }
      existing.debit += line.debit || 0
      existing.credit += line.credit || 0
      accountBalances.set(line.account_id, existing)
    }

    // Get account types to identify income/expense
    const accountIds = Array.from(accountBalances.keys())
    const { data: accounts } = await supabaseAdmin
      .from('accounts')
      .select('id, account_type, name')
      .in('id', accountIds)

    const closingLines: Array<{ account_id: string; debit: number; credit: number; description: string }> = []
    let totalClosingDebit = 0
    let totalClosingCredit = 0

    for (const account of accounts || []) {
      const balance = accountBalances.get(account.id)
      if (!balance) continue

      const netBalance = balance.debit - balance.credit

      // Income accounts: close to Retained Earnings
      if (account.account_type === 'revenue' || account.account_type === 'income') {
        if (netBalance !== 0) {
          const amount = Math.abs(netBalance)
          closingLines.push({
            account_id: account.id,
            debit: netBalance > 0 ? amount : 0,   // Debit income to zero it
            credit: netBalance < 0 ? amount : 0,
            description: `Closing: ${account.name}`,
          })
          // Credit/Debit Retained Earnings
          closingLines.push({
            account_id: retainedEarningsId,
            debit: netBalance < 0 ? amount : 0,
            credit: netBalance > 0 ? amount : 0,
            description: `Closing: ${account.name}`,
          })
          totalClosingDebit += amount
          totalClosingCredit += amount
        }
      }

      // Expense accounts: close to Retained Earnings
      if (account.account_type === 'expense') {
        if (netBalance !== 0) {
          const amount = Math.abs(netBalance)
          closingLines.push({
            account_id: account.id,
            debit: netBalance < 0 ? amount : 0,   // Credit expense to zero it
            credit: netBalance > 0 ? amount : 0,
            description: `Closing: ${account.name}`,
          })
          closingLines.push({
            account_id: retainedEarningsId,
            debit: netBalance > 0 ? amount : 0,
            credit: netBalance < 0 ? amount : 0,
            description: `Closing: ${account.name}`,
          })
          totalClosingDebit += amount
          totalClosingCredit += amount
        }
      }
    }

    // Insert closing entries if any
    if (closingLines.length > 0) {
      const closingDate = period.end_date
      const { data: closingEntry, error: closingErr } = await supabaseAdmin
        .from('journal_entries')
        .insert({
          entry_date: closingDate,
          description: `Period Closing: ${period.name}`,
          total_debit: totalClosingDebit,
          total_credit: totalClosingCredit,
          status: 'posted',
          reference_type: 'period_close',
          reference_id: id,
          period_id: period.period_id || id,
          created_by: profile.id,
        })
        .select('id')
        .single()

      if (closingErr) {
      if (closingErr) logger.error('Operation failed', { error: closingErr })
      throw new Error('Operation failed')
    }

      // Insert closing lines
      const linesToInsert = closingLines.map(line => ({
        journal_entry_id: closingEntry.id,
        account_id: line.account_id,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      }))

      await supabaseAdmin.from('journal_entry_lines').insert(linesToInsert)
    }
  }

  // 5. Mark period as closed
  const { error: closeErr } = await supabaseAdmin
    .from('financial_periods')
    .update({
      status: 'closed',
      closed_by: profile.id,
      closed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (closeErr) {
      if (closeErr) logger.error('Operation failed', { error: closeErr })
      throw new Error('Operation failed')
    }

  // Emit period.closed event
  await emitEvent({
    eventType: 'period.closed',
    source: 'finance',
    entityType: 'financial_period',
    entityId: id,
    payload: {
      period_id: id,
      name: period.name,
      start_date: period.start_date,
      end_date: period.end_date,
      entries_created: entries?.length || 0,
    },
  })

  return { success: true, message: `Period "${period.name}" closed successfully${entries?.length ? ` (${entries.length} entries)` : ''}` }
}

// ─── Dashboard Stats ───────────────────────────────────────

export async function getFinanceStats(branchId?: string) {
  await authenticateServerAction()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  // Get journal entries for this month
  let entriesQuery = supabaseAdmin
    .from('journal_entries')
    .select('total_debit, total_credit, description, reference_type')
    .eq('status', 'posted')
    .gte('entry_date', monthStart)
    .lte('entry_date', monthEnd)

  if (branchId) {
    entriesQuery = entriesQuery.eq('branch_id', branchId)
  }

  const { data: entries } = await entriesQuery

  // Get account balances for summary
  const balances = await getAccountBalances(branchId)

  const cashBalance = balances
    .filter(b => ['1000', '1010', '1020', '1030'].includes(b.account_number))
    .reduce((sum, b) => sum + Math.max(0, b.balance), 0)

  const receivableBalance = balances
    .filter(b => b.account_number === '1100')
    .reduce((sum, b) => sum + Math.max(0, b.balance), 0)

  const payableBalance = balances
    .filter(b => b.account_number === '2000')
    .reduce((sum, b) => sum + Math.max(0, b.balance), 0)

  const inventoryBalance = balances
    .filter(b => b.account_number === '1200')
    .reduce((sum, b) => sum + Math.max(0, b.balance), 0)

  const revenue = balances
    .filter(b => b.account_type === 'revenue')
    .reduce((sum, b) => sum + b.balance, 0)

  const expenses = balances
    .filter(b => b.account_type === 'expense' || b.account_type === 'cogs')
    .reduce((sum, b) => sum + Math.abs(b.balance), 0)

  return {
    totalRevenue: revenue,
    totalExpenses: expenses,
    netProfit: revenue - expenses,
    cashPosition: cashBalance,
    accountsReceivable: receivableBalance,
    accountsPayable: payableBalance,
    inventoryValue: inventoryBalance,
    monthlyEntries: entries?.length || 0,
  }
}

// ─── Bank Accounts ────────────────────────────────────────────

export interface BankAccount {
  id: string
  account_id: string
  bank_name: string
  account_name: string
  account_number: string | null
  account_type: string
  current_balance: number
  opening_balance: number
  currency: string
  branch_id: string | null
  is_active: boolean
  last_reconciled_at: string | null
  created_at: string
  updated_at: string
  chart_account?: Account
}

export interface BankTransaction {
  id: string
  bank_account_id: string
  transaction_date: string
  description: string
  transaction_type: string
  amount: number
  balance_after: number | null
  reference_number: string | null
  is_reconciled: boolean
  reconciled_at: string | null
  journal_entry_id: string | null
  branch_id: string | null
  created_at: string
}

export async function getBankAccounts(branchId?: string) {
  const { profile } = await authenticateServerAction()
  requireFinanceRole(profile)

  let query = supabaseAdmin
    .from('bank_accounts')
    .select('*, chart_account:accounts(id, account_number, name)')
    .eq('is_active', true)
    .order('bank_name')

  if (branchId) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }

  const { data, error } = await query
  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return data as BankAccount[]
}

export async function createBankAccount(data: {
  account_id: string
  bank_name: string
  account_name: string
  account_number?: string
  account_type?: string
  opening_balance?: number
  currency?: string
  branch_id?: string
}) {
  await authenticateServerAction()

  const { data: bankAccount, error } = await supabaseAdmin
    .from('bank_accounts')
    .insert({
      account_id: data.account_id,
      bank_name: data.bank_name,
      account_name: data.account_name,
      account_number: data.account_number || null,
      account_type: data.account_type || 'current',
      opening_balance: data.opening_balance || 0,
      current_balance: data.opening_balance || 0,
      currency: data.currency || 'KES',
      branch_id: data.branch_id || null,
    })
    .select()
    .single()

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return { success: true, data: bankAccount }
}

export async function updateBankAccount(id: string, data: {
  bank_name?: string
  account_name?: string
  account_number?: string
  is_active?: boolean
}) {
  await authenticateServerAction()

  const { error } = await supabaseAdmin
    .from('bank_accounts')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return { success: true }
}

export async function deleteBankAccount(id: string) {
  await authenticateServerAction()

  // Check if account has transactions
  const { count } = await supabaseAdmin
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('bank_account_id', id)

  if (count && count > 0) {
    return { success: false, error: 'Cannot delete accounts with transactions' }
  }

  const { error } = await supabaseAdmin
    .from('bank_accounts')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return { success: true }
}

// ─── Bank Transactions ────────────────────────────────────────

export async function getBankTransactions(bankAccountId: string, params?: {
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}) {
  const { profile } = await authenticateServerAction()
  requireFinanceRole(profile)

  let query = supabaseAdmin
    .from('bank_transactions')
    .select('*')
    .eq('bank_account_id', bankAccountId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (params?.startDate) {
    query = query.gte('transaction_date', params.startDate)
  }
  if (params?.endDate) {
    query = query.lte('transaction_date', params.endDate)
  }

  const limit = params?.limit || 100
  const offset = params?.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query
  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return data as BankTransaction[]
}

export async function createBankTransaction(data: {
  bank_account_id: string
  transaction_date: string
  description: string
  transaction_type: string
  amount: number
  reference_number?: string
  branch_id?: string
}) {
  const { profile } = await authenticateServerAction()
  requireFinanceRole(profile)

  // Get current balance
  const { data: bankAccount } = await supabaseAdmin
    .from('bank_accounts')
    .select('current_balance')
    .eq('id', data.bank_account_id)
    .single()

  if (!bankAccount) throw new Error('Bank account not found')

  const currentBalance = Number(bankAccount.current_balance)
  const isDebit = ['withdrawal', 'fee'].includes(data.transaction_type)
    || (data.transaction_type === 'transfer')
    || (data.transaction_type === 'deposit' && data.amount < 0)

  const balanceAfter = isDebit
    ? currentBalance - Math.abs(data.amount)
    : currentBalance + Math.abs(data.amount)

  // Create transaction
  const { data: transaction, error } = await supabaseAdmin
    .from('bank_transactions')
    .insert({
      bank_account_id: data.bank_account_id,
      transaction_date: data.transaction_date,
      description: data.description,
      transaction_type: data.transaction_type,
      amount: isDebit ? -Math.abs(data.amount) : Math.abs(data.amount),
      balance_after: balanceAfter,
      reference_number: data.reference_number || null,
      branch_id: data.branch_id || null,
    })
    .select()
    .single()

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }

  // Update bank account balance with optimistic lock
  const { data: updatedRow, error: updateError } = await supabaseAdmin
    .from('bank_accounts')
    .update({ current_balance: balanceAfter, updated_at: new Date().toISOString() })
    .eq('id', data.bank_account_id)
    .eq('current_balance', currentBalance)
    .select('id')

  if (updateError) {
    logger.error('Operation failed', { error: updateError })
    throw new Error('Operation failed')
  }
  if (!updatedRow || updatedRow.length === 0) {
    throw new Error('Concurrent modification detected — please retry')
  }

  return { success: true, data: transaction }
}

export async function reconcileBankTransaction(id: string) {
  await authenticateServerAction()

  const { error } = await supabaseAdmin
    .from('bank_transactions')
    .update({
      is_reconciled: true,
      reconciled_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return { success: true }
}

export async function getBankStats(branchId?: string) {
  await authenticateServerAction()

  const accounts = await getBankAccounts(branchId)

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0)
  const accountCount = accounts.length

  // Get recent transactions count
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  let txQuery = supabaseAdmin
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .gte('transaction_date', thirtyDaysAgo)

  if (branchId) {
    txQuery = txQuery.eq('branch_id', branchId)
  }

  const { count: recentTransactions } = await txQuery

  // Get unreconciled count
  let reconQuery = supabaseAdmin
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('is_reconciled', false)

  if (branchId) {
    reconQuery = reconQuery.eq('branch_id', branchId)
  }

  const { count: unreconciled } = await reconQuery

  return {
    totalBalance,
    accountCount,
    recentTransactions: recentTransactions || 0,
    unreconciled: unreconciled || 0,
  }
}

// ─── Bank Reconciliation ────────────────────────────────────

export async function getReconciliations(bankAccountId: string) {
  await authenticateServerAction()

  const { data, error } = await supabaseAdmin
    .from('bank_reconciliations')
    .select('*')
    .eq('bank_account_id', bankAccountId)
    .order('reconciliation_date', { ascending: false })

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return data || []
}

export async function getUnreconciledTransactions(bankAccountId: string) {
  await authenticateServerAction()

  // Get transactions not yet matched to a reconciliation
  const { data: transactions, error } = await supabaseAdmin
    .from('bank_transactions')
    .select('*')
    .eq('bank_account_id', bankAccountId)
    .eq('is_reconciled', false)
    .order('transaction_date', { ascending: false })

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return transactions || []
}

export async function getUnmatchedJournalEntries(bankAccountId: string) {
  await authenticateServerAction()

  // Resolve the bank account's linked chart-of-accounts ID first
  const { data: bankAcct } = await supabaseAdmin
    .from('bank_accounts')
    .select('account_id')
    .eq('id', bankAccountId)
    .single()

  if (!bankAcct?.account_id) return []

  // Get journal entry lines that reference this bank's chart account but aren't reconciled
  const { data: entries, error } = await supabaseAdmin
    .from('journal_entry_lines')
    .select(`
      *,
      journal_entry:journal_entries(id, entry_date, description, reference_type, reference_id)
    `)
    .eq('account_id', bankAcct.account_id)
    .order('entry_date', { ascending: false })
    .limit(100)

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return entries || []
}

export async function createReconciliation(data: {
  bank_account_id: string
  reconciliation_date: string
  bank_balance: number
  book_balance: number
  matched_transactions: Array<{ bank_transaction_id: string; journal_entry_id: string }>
  notes?: string
}) {
  const { profile } = await authenticateServerAction()
  if (!profile) throw new Error('Unauthorized')
  requireFinanceRole(profile)

  const difference = data.bank_balance - data.book_balance

  // Create the reconciliation
  const { data: recon, error: reconErr } = await supabaseAdmin
    .from('bank_reconciliations')
    .insert({
      bank_account_id: data.bank_account_id,
      reconciliation_date: data.reconciliation_date,
      bank_balance: data.bank_balance,
      book_balance: data.book_balance,
      difference,
      status: 'draft',
      notes: data.notes || null,
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (reconErr) {
      if (reconErr) logger.error('Operation failed', { error: reconErr })
      throw new Error('Operation failed')
    }

  // Insert matched items
  if (data.matched_transactions.length > 0) {
    const items = data.matched_transactions.map(m => ({
      reconciliation_id: recon.id,
      bank_transaction_id: m.bank_transaction_id,
      journal_entry_id: m.journal_entry_id,
    }))

    await supabaseAdmin.from('bank_reconciliation_items').insert(items)

    // Mark bank transactions as reconciled
    const txIds = data.matched_transactions.map(m => m.bank_transaction_id).filter(Boolean)
    if (txIds.length > 0) {
      await supabaseAdmin
        .from('bank_transactions')
        .update({ is_reconciled: true })
        .in('id', txIds)
    }
  }

  return { success: true, id: recon.id }
}

export async function completeReconciliation(reconciliationId: string) {
  const { profile } = await authenticateServerAction()
  if (!profile) throw new Error('Unauthorized')
  requireFinanceRole(profile)

  const { error } = await supabaseAdmin
    .from('bank_reconciliations')
    .update({
      status: 'completed',
      completed_by: profile.id,
      completed_at: new Date().toISOString(),
    })
    .eq('id', reconciliationId)

  if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
  return { success: true }
}
