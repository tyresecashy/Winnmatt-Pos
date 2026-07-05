# Phase 6 — Remaining Features Plan

## Overview
Complete the remaining features for WINNMATT POS to deliver a fully functional supermarket management system.

---

## 1. Financial Period Closing
**Goal:** Allow admins to close fiscal periods (month/quarter/year) with automatic balancing checks and balance carry-forward.

### Database
- No new tables needed — `financial_periods` table already exists
- May need a `period_closing_entries` table for carry-forward journal entries

### Server Actions
- `lib/finance-actions.ts` — Add:
  - `getPeriodStatus(periodId)` — Get period with pending entries check
  - `closePeriod(periodId)` — Validate balanced entries, create closing entries, carry forward balances
  - `reopenPeriod(periodId)` — Reopen a closed period (admin only)

### UI
- `app/(dashboard)/financial-periods/page.tsx` — Period list with status indicators
- Period close dialog with validation checks before closing

---

## 2. Bank Reconciliation
**Goal:** Match bank transactions against journal entries to identify discrepancies.

### Database
- `bank_reconciliations` table — Tracks reconciliation sessions
- `bank_reconciliation_items` table — Links bank transactions to journal entries

### Server Actions
- `lib/finance-actions.ts` — Add:
  - `getUnreconciledTransactions(bankAccountId)` — Get unmatched bank transactions
  - `getReconciliationSessions(bankAccountId)` — List past reconciliations
  - `createReconciliation(bankAccountId, matches)` — Create reconciliation with matched items
  - `getReconciliationSummary(bankAccountId)` — Show reconciliation status

### UI
- `app/(dashboard)/bank-reconciliation/page.tsx` — Two-panel layout: bank transactions on left, journal entries on right, match button

---

## 3. Financial Reports
**Goal:** Generate standard financial reports from the Chart of Accounts and journal entries.

### Server Actions
- `lib/finance-reports.ts` — NEW file with:
  - `generateTrialBalance(periodId)` — All accounts with debit/credit totals
  - `generateProfitAndLoss(periodId)` — Revenue vs Expenses
  - `generateBalanceSheet(periodId)` — Assets = Liabilities + Equity
  - `generateCashFlowStatement(periodId)` — Operating/Investing/Financing cash flows
  - `generateAccountStatement(accountId, startDate, endDate)` — Single account ledger

### UI
- `app/(dashboard)/reports/page.tsx` — Report hub with tabs for each report type
- Print-friendly layouts for each report
- Date range and period selectors

---

## 4. Payroll/HR
**Goal:** Calculate employee salaries with Kenyan statutory deductions.

### Database
- `payroll_runs` table — Monthly payroll batches
- `payslips` table — Individual employee payslips
- `payroll_items` table — Earnings and deductions per employee

### Server Actions
- `lib/payroll-actions.ts` — NEW file with:
  - `calculatePAYE(grossSalary)` — Kenyan tax bands (0-24,000: 10%, 24,001-32,333: 25%, 32,334-500,000: 30%, 500,001-800,000: 32%, 800,001+: 35%)
  - `calculateNHIF(grossSalary)` — NHIF rates (6 tiers from KSh 150 to KSh 1,700)
  - `calculateNSSF(grossSalary)` — NSSF Tier I (6% up to KSh 7,000) + Tier II (6% from KSh 7,001 to KSh 36,000)
  - `generatePayslip(employeeId, periodId)` — Calculate all deductions, generate payslip
  - `runPayroll(periodId, employeeIds)` — Batch payroll for all employees

### UI
- `app/(dashboard)/payroll/page.tsx` — Payroll run interface
- `components/payroll/payslip-preview.tsx` — Payslip template with all deductions

---

## 5. Multi-Branch Transfers
**Goal:** Transfer stock between branches with approval workflow.

### Database
- `stock_transfers` table — Transfer header (from_branch, to_branch, status)
- `stock_transfer_items` table — Products and quantities

### Server Actions
- `lib/transfer-actions.ts` — NEW file with:
  - `createTransfer(fromBranch, toBranch, items)` — Create transfer request
  - `approveTransfer(transferId)` — Manager approves
  - `receiveTransfer(transferId, receivedItems)` — Receiving branch confirms
  - `getTransfers(branchId, status)` — List transfers with filters

### UI
- `app/(dashboard)/transfers/page.tsx` — Transfer list with status workflow
- Transfer creation dialog with product search
- Approval and receiving interfaces

---

## 6. Data Export
**Goal:** Export reports, invoices, and statements to PDF/Excel.

### Server Actions
- `lib/export-actions.ts` — NEW file with:
  - `exportToExcel(data, filename)` — Generate Excel file
  - `exportToPDF(html, filename)` — Generate PDF from HTML
  - `exportInvoice(invoiceId)` — Export single invoice
  - `exportSalesReport(startDate, endDate)` — Export sales summary

### UI
- Export buttons on all report pages
- Export dialog with format selection (PDF/Excel/CSV)

---

## 7. Purchase Orders
**Goal:** Manage suppliers, create POs, receive goods.

### Database
- `suppliers` table — Supplier information
- `purchase_orders` table — PO header (supplier, status, total)
- `purchase_order_items` table — Products and quantities
- Update `products` with `supplier_id` foreign key

### Server Actions
- `lib/purchase-order-actions.ts` — NEW file with:
  - CRUD for suppliers
  - `createPO(supplierId, items)` — Create purchase order
  - `receivePO(poId, receivedItems)` — Receive goods, update inventory
  - `getPOs(branchId, status)` — List POs with filters

### UI
- `app/(dashboard)/purchase-orders/page.tsx` — PO list and creation
- `app/(dashboard)/suppliers/page.tsx` — Supplier management

---

## 8. Mobile Optimization
**Goal:** Make POS and key screens work well on tablets and phones.

### Changes
- `app/(dashboard)/pos/page.tsx` — Responsive grid, larger touch targets
- `components/pos/cart.tsx` — Swipeable items, compact mode
- `components/pos/product-grid.tsx` — 2-column on mobile, 4-column on desktop
- Navigation: bottom tab bar on mobile

---

## Execution Order
1. Financial Period Closing (1)
2. Bank Reconciliation (2)
3. Financial Reports (3)
4. Payroll/HR (4)
5. Multi-Branch Transfers (5)
6. Data Export (6)
7. Purchase Orders (7)
8. Mobile Optimization (8)

## Estimated Total Effort
- Items 1-3: Finance completion (~2-3 hours)
- Items 4-5: Operations (~2-3 hours)
- Items 6-8: Polish (~1-2 hours)
- **Total: ~5-8 hours of focused work**
