/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function runCheck(name, callback) {
  try {
    callback()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

runCheck('sales history uses non-blocking void UX', () => {
  const source = read('app/(dashboard)/sales-history/client.tsx')

  assert.ok(source.includes('useToast'))
  assert.ok(source.includes("title: 'Sale voided'"))
  assert.ok(!source.includes('alert('))
  assert.ok(!source.includes('window.location.reload'))
})

runCheck('inventory page no longer exposes production debug branch UI', () => {
  const source = read('app/(dashboard)/inventory/page.tsx')

  assert.ok(source.includes('Branch context required'))
  assert.ok(source.includes('Stock adjustments are limited to owners, admins, and managers.'))
  assert.ok(!source.includes('Auth/Branch Status'))
  assert.ok(!source.includes('DEBUG SECTION'))
})

runCheck('inventory and transfer auth helpers include explicit role guards', () => {
  const source = read('lib/auth-helpers.ts')

  assert.ok(source.includes('authorizeInventoryControlProfile'))
  assert.ok(source.includes('authorizeTransferProfile'))
  assert.ok(source.includes('Only owners, admins, and managers can manage inventory'))
})

runCheck('transfer actions require authenticated transfer authorization', () => {
  const source = read('lib/transfer-actions.ts')

  assert.ok(source.includes('authenticateServerAction'))
  assert.ok(source.includes('authorizeTransferProfile'))
  assert.ok(source.includes('resolveAuthorizedBranchId'))
  assert.ok(source.includes('const effectiveSourceBranchId = branchScope.branchId'))
  assert.ok(source.includes("error: 'Destination branch not found'"))
})

runCheck('transfer dialog locks branch-bound source branch and blocks non-management access', () => {
  const source = read('components/transfers/new-transfer-dialog.tsx')

  assert.ok(source.includes("const canManageTransfers = ['owner', 'admin', 'manager'].includes(profile?.role || '')"))
  assert.ok(source.includes("const sourceBranchLocked = profile?.role !== 'owner'"))
  assert.ok(source.includes('Your account must be assigned to a branch before transfers can be created.'))
  assert.ok(source.includes('disabled={loadingBranches || branches.length === 0 || sourceBranchLocked}'))
})

runCheck('pos receipt close handler still resets pilot checkout state', () => {
  const source = read('app/(dashboard)/pos/page.tsx')

  assert.ok(source.includes('onReceiptClose={() => {'))
  assert.ok(source.includes('setCart([])'))
  assert.ok(source.includes('setSelectedCustomer(null)'))
  assert.ok(source.includes('setCartDiscount(0)'))
  assert.ok(source.includes('setFullSaleData(null)'))
  assert.ok(source.includes('queueBackgroundProductRefresh()'))
})

runCheck('cash checkout reuses authorized sale helpers and trims receipt debug work', () => {
  const paymentAction = read('lib/actions/complete-payment-action.ts')
  const salesActions = read('lib/sales-actions.ts')
  const receiptPreview = read('components/receipt-preview.tsx')

  assert.ok(paymentAction.includes('createSaleWithContext'))
  assert.ok(paymentAction.includes('getSaleByIdForAuthorizedContext'))
  assert.ok(salesActions.includes('export async function createSaleWithContext'))
  assert.ok(salesActions.includes('export async function getSaleByIdForAuthorizedContext'))
  assert.ok(!receiptPreview.includes("console.log('[DEBUG] ReceiptPreview - saleData received:'"))
})

runCheck('recent transactions refresh reacts to completed sales without aggressive polling', () => {
  const source = read('components/pos/recent-transactions.tsx')

  assert.ok(source.includes('window.addEventListener("pos:sale-completed", handleSaleCompleted)'))
  assert.ok(source.includes('void fetchRecentCashSales({ force: true })'))
  assert.ok(source.includes('}, 30000)'))
})

runCheck('cash save path includes timing instrumentation and batched stock work', () => {
  const paymentAction = read('lib/actions/complete-payment-action.ts')
  const salesActions = read('lib/sales-actions.ts')
  const loyaltyActions = read('lib/loyalty-actions.ts')
  const timingHelper = read('lib/cash-save-timing.ts')

  assert.ok(timingHelper.includes('CASH_SAVE_TIMING'))
  assert.ok(paymentAction.includes("createCashSaveTimingTracker"))
  assert.ok(paymentAction.includes("'auth_context_resolution'"))
  assert.ok(paymentAction.includes("'create_sale_total'"))
  assert.ok(paymentAction.includes("'receipt_sale_refetch'"))
  assert.ok(paymentAction.includes("'receipt_payload_build'"))
  assert.ok(salesActions.includes("'stock_validation'"))
  assert.ok(salesActions.includes("'stock_movements_insert'"))
  assert.ok(salesActions.includes('Promise.allSettled'))
  assert.ok(salesActions.includes(".in('product_id', productIds)"))
  assert.ok(loyaltyActions.includes("'settings_fetch'"))
  assert.ok(loyaltyActions.includes("'customer_balance_update'"))
})

runCheck('cash checkout includes db transaction sale path with safe fallback', () => {
  const salesActions = read('lib/sales-actions.ts')
  const migration = read('cash-sale-transaction-migration.sql')

  assert.ok(salesActions.includes("save_cash_sale_transaction"))
  assert.ok(salesActions.includes("db_transaction_rpc"))
  assert.ok(salesActions.includes("Cash transaction RPC missing, falling back to app-side persistence"))
  assert.ok(migration.includes("CREATE OR REPLACE FUNCTION save_cash_sale_transaction"))
  assert.ok(migration.includes("INSERT INTO sales"))
  assert.ok(migration.includes("INSERT INTO sale_items"))
  assert.ok(migration.includes("UPDATE inventory AS i"))
  assert.ok(migration.includes("INSERT INTO stock_movements"))
})
