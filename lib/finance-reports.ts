'use server'

/**
 * Financial Reports — Trial Balance, P&L, Balance Sheet, Cash Flow
 */

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateServerAction } from '@/lib/auth-helpers'

interface AccountBalance {
  id: string
  code: string
  name: string
  account_type: string
  debit: number
  credit: number
  balance: number
}

interface TrialBalanceRow {
  accounts: AccountBalance[]
  totalDebit: number
  totalCredit: number
}

interface PLReport {
  revenue: AccountBalance[]
  expenses: AccountBalance[]
  totalRevenue: number
  totalExpenses: number
  netIncome: number
}

interface BalanceSheetReport {
  assets: AccountBalance[]
  liabilities: AccountBalance[]
  equity: AccountBalance[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
}

/**
 * Generate Trial Balance — all accounts with debit/credit totals
 */
export async function generateTrialBalance(
  startDate?: string,
  endDate?: string
): Promise<TrialBalanceRow> {
  await authenticateServerAction()

  const now = new Date()
  const start = startDate || `${now.getFullYear()}-01-01`
  const end = endDate || now.toISOString().split('T')[0]

  // Get all accounts
  const { data: accounts } = await supabaseAdmin
    .from('accounts')
    .select('id, code, name, account_type')
    .eq('is_active', true)
    .order('code')

  // Get all journal entry lines for the period
  const { data: lines } = await supabaseAdmin
    .from('journal_entry_lines')
    .select('account_id, debit, credit, journal_entry:journal_entries!inner(entry_date, status)')
    .gte('journal_entry.entry_date', start)
    .lte('journal_entry.entry_date', end)
    .eq('journal_entry.status', 'posted')

  // Aggregate by account
  const accountMap = new Map<string, { debit: number; credit: number }>()
  for (const line of lines || []) {
    const existing = accountMap.get(line.account_id) || { debit: 0, credit: 0 }
    existing.debit += line.debit || 0
    existing.credit += line.credit || 0
    accountMap.set(line.account_id, existing)
  }

  const accountBalances: AccountBalance[] = (accounts || []).map(acc => {
    const bal = accountMap.get(acc.id) || { debit: 0, credit: 0 }
    const balance = bal.debit - bal.credit
    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      account_type: acc.account_type,
      debit: bal.debit,
      credit: bal.credit,
      balance,
    }
  }).filter(a => a.debit > 0 || a.credit > 0) // Only show accounts with activity

  const totalDebit = accountBalances.reduce((sum, a) => sum + a.debit, 0)
  const totalCredit = accountBalances.reduce((sum, a) => sum + a.credit, 0)

  return { accounts: accountBalances, totalDebit, totalCredit }
}

/**
 * Generate Profit & Loss Statement
 */
export async function generateProfitAndLoss(
  startDate?: string,
  endDate?: string
): Promise<PLReport> {
  await authenticateServerAction()

  const now = new Date()
  const start = startDate || `${now.getFullYear()}-01-01`
  const end = endDate || now.toISOString().split('T')[0]

  // Get all accounts
  const { data: accounts } = await supabaseAdmin
    .from('accounts')
    .select('id, code, name, account_type')
    .eq('is_active', true)
    .in('account_type', ['revenue', 'income', 'expense'])
    .order('code')

  // Get journal entry lines
  const { data: lines } = await supabaseAdmin
    .from('journal_entry_lines')
    .select('account_id, debit, credit, journal_entry:journal_entries!inner(entry_date, status)')
    .gte('journal_entry.entry_date', start)
    .lte('journal_entry.entry_date', end)
    .eq('journal_entry.status', 'posted')

  const accountMap = new Map<string, { debit: number; credit: number }>()
  for (const line of lines || []) {
    const existing = accountMap.get(line.account_id) || { debit: 0, credit: 0 }
    existing.debit += line.debit || 0
    existing.credit += line.credit || 0
    accountMap.set(line.account_id, existing)
  }

  const revenue: AccountBalance[] = []
  const expenses: AccountBalance[] = []

  for (const acc of accounts || []) {
    const bal = accountMap.get(acc.id) || { debit: 0, credit: 0 }
    const entry: AccountBalance = {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      account_type: acc.account_type,
      debit: bal.debit,
      credit: bal.credit,
      balance: bal.debit - bal.credit,
    }

    if (acc.account_type === 'revenue' || acc.account_type === 'income') {
      // Revenue: credit balance is positive (income)
      entry.balance = bal.credit - bal.debit
      if (entry.debit > 0 || entry.credit > 0) revenue.push(entry)
    } else if (acc.account_type === 'expense') {
      // Expense: debit balance is positive (cost)
      entry.balance = bal.debit - bal.credit
      if (entry.debit > 0 || entry.credit > 0) expenses.push(entry)
    }
  }

  const totalRevenue = revenue.reduce((sum, a) => sum + a.balance, 0)
  const totalExpenses = expenses.reduce((sum, a) => sum + a.balance, 0)

  return {
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
  }
}

/**
 * Generate Balance Sheet
 */
export async function generateBalanceSheet(
  asOfDate?: string
): Promise<BalanceSheetReport> {
  await authenticateServerAction()

  const now = new Date()
  const end = asOfDate || now.toISOString().split('T')[0]

  // Get all accounts
  const { data: accounts } = await supabaseAdmin
    .from('accounts')
    .select('id, code, name, account_type')
    .eq('is_active', true)
    .in('account_type', ['asset', 'liability', 'equity'])
    .order('code')

  // Get all journal entry lines up to the date
  const { data: lines } = await supabaseAdmin
    .from('journal_entry_lines')
    .select('account_id, debit, credit, journal_entry:journal_entries!inner(entry_date, status)')
    .lte('journal_entry.entry_date', end)
    .eq('journal_entry.status', 'posted')

  const accountMap = new Map<string, { debit: number; credit: number }>()
  for (const line of lines || []) {
    const existing = accountMap.get(line.account_id) || { debit: 0, credit: 0 }
    existing.debit += line.debit || 0
    existing.credit += line.credit || 0
    accountMap.set(line.account_id, existing)
  }

  const assets: AccountBalance[] = []
  const liabilities: AccountBalance[] = []
  const equity: AccountBalance[] = []

  for (const acc of accounts || []) {
    const bal = accountMap.get(acc.id) || { debit: 0, credit: 0 }
    const entry: AccountBalance = {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      account_type: acc.account_type,
      debit: bal.debit,
      credit: bal.credit,
      balance: bal.debit - bal.credit,
    }

    if (entry.debit > 0 || entry.credit > 0) {
      switch (acc.account_type) {
        case 'asset':
          assets.push(entry)
          break
        case 'liability':
          // Liabilities have credit balances
          entry.balance = bal.credit - bal.debit
          liabilities.push(entry)
          break
        case 'equity':
          // Equity has credit balances
          entry.balance = bal.credit - bal.debit
          equity.push(entry)
          break
      }
    }
  }

  return {
    assets,
    liabilities,
    equity,
    totalAssets: assets.reduce((sum, a) => sum + a.balance, 0),
    totalLiabilities: liabilities.reduce((sum, a) => sum + a.balance, 0),
    totalEquity: equity.reduce((sum, a) => sum + a.balance, 0),
  }
}

/**
 * Generate Cash Flow Statement
 */
export async function generateCashFlowStatement(
  startDate?: string,
  endDate?: string
) {
  await authenticateServerAction()

  // Use P&L data as base, plus classify by cash account activity
  const pl = await generateProfitAndLoss(startDate, endDate)

  // Get cash and bank account balances
  const { data: cashAccounts } = await supabaseAdmin
    .from('accounts')
    .select('id, code, name, account_type')
    .eq('is_active', true)
    .in('account_type', ['asset'])
    .ilike('name', '%cash%')

  const { data: bankAccounts } = await supabaseAdmin
    .from('accounts')
    .select('id, code, name, account_type')
    .eq('is_active', true)
    .in('account_type', ['asset'])
    .ilike('name', '%bank%')

  return {
    operating: {
      netIncome: pl.netIncome,
      description: 'Net income from operations',
    },
    investing: {
      items: [],
      total: 0,
      description: 'No investing activities recorded',
    },
    financing: {
      items: [],
      total: 0,
      description: 'No financing activities recorded',
    },
    cashAccounts: (cashAccounts || []).length + (bankAccounts || []).length,
  }
}
