# Graph Report - .  (2026-07-14)

## Corpus Check
- Large corpus: 887 files · ~857,259 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2025 nodes · 6715 edges · 178 communities (147 shown, 31 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 61 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Finance & Analytics Pages
- POS & Transaction Components
- Suppliers & Purchasing
- Utility Functions & Formatting
- Purchase Order & AP
- Enterprise Health & System
- Automation & Workflow Engine
- AI Command Palette
- Mobile App Config
- Security & Vulnerability
- TypeScript Config & Typings
- Mobile/Customer App Navigation
- Sidebar & Dashboard Shell
- Cash Management & Drawers
- Notifications & Alerts
- Employee Management
- AI Assistant Chat UI
- Audit Trail
- Banking & Reconciliation
- Dashboard Cards & KPIs
- Customer Management & Payments
- Department Management
- Analytics Pages
- MCP Toolkit Tools
- PowerShell WorkIQ
- shadcn Component Config
- Finance Sub-Pages
- Admin Console Pages
- Permissions & Roles
- Customers Page
- Sidebar Navigation Config
- PWA Manifest & Icons
- Vercel Optimization Scripts
- App Layout & Auth Guards
- Cart & Period Selector
- Backorders & Inventory
- LLM Tool Calling
- Service Worker / PWA
- Agent Output Collection
- Report Rendering
- Mobile POS
- Database Migration Scripts
- Enterprise Overview
- Toast Notifications
- Customer Mobile App
- Device Management
- Mobile POS Wrapper
- Codebase Scanning
- Operations & Health
- Batch Tracking & Banking
- Employee Detail & Clock
- Toast State Management
- Agent Search Tool
- Investigation Pipeline
- M-Pesa API Routes
- AI Center Page
- Product Search
- Form Field Components
- Signal Collection
- Admin Icons
- Schedule & Tasks
- Receipt Dialog & Preview
- Vercel Config
- Supplier Tests
- Repository Test Patterns
- Warehouse & CSV Import
- Root Layout
- Toast Component
- Date Range Context
- Migration Applier
- Docs Library
- Deep Dive Analysis
- Employee Detail Client
- Promotions Page
- Transfer Wizard
- KPI Card Component
- Quick Check Script
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Customer Tests
- Finance Tests
- Repository Tests
- Sales Tests
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 141
- Community 142
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 162
- Community 163
- Community 164
- Community 167
- Community 168
- Community 170

## God Nodes (most connected - your core abstractions)
1. `Button()` - 157 edges
2. `Card()` - 123 edges
3. `CardContent()` - 119 edges
4. `useAuth()` - 117 edges
5. `CardHeader()` - 113 edges
6. `Badge()` - 110 edges
7. `CardTitle()` - 108 edges
8. `Input()` - 94 edges
9. `EmptyState()` - 90 edges
10. `Skeleton()` - 82 edges

## Surprising Connections (you probably didn't know these)
- `AICenterPage()` --calls--> `useToast()`  [EXTRACTED]
  app/(dashboard)/ai-center/page.tsx → components/ui/use-toast.ts
- `AuditTrailPage()` --indirect_call--> `q()`  [INFERRED]
  app/(dashboard)/audit-trail/page.tsx → scripts/verify-db.mjs
- `BatchTrackingPage()` --indirect_call--> `q()`  [INFERRED]
  app/(dashboard)/batch-tracking/page.tsx → scripts/verify-db.mjs
- `BulkOperationsPage()` --indirect_call--> `q()`  [INFERRED]
  app/(dashboard)/bulk-operations/page.tsx → scripts/verify-db.mjs
- `BusinessAccountsPage()` --indirect_call--> `q()`  [INFERRED]
  app/(dashboard)/business-accounts/page.tsx → scripts/verify-db.mjs

## Import Cycles
- None detected.

## Communities (178 total, 31 thin omitted)

### Community 0 - "Finance & Analytics Pages"
Cohesion: 0.10
Nodes (27): FinanceChartContent, SalesChartContent, STATUS_CONFIG, PERIOD_OPTIONS, TYPE_CONFIG, ROLE_BADGES, ImportState, SAMPLE_HEADERS (+19 more)

### Community 1 - "POS & Transaction Components"
Cohesion: 0.08
Nodes (43): DEFAULT_FORM, TIMEZONE_OPTIONS, TYPE_LABELS, TYPE_VARIANTS, AdjustType, BulkOperationsPage(), formatKSh(), PriceMode (+35 more)

### Community 2 - "Suppliers & Purchasing"
Cohesion: 0.09
Nodes (43): SupplierWithAP, ACCOUNT_TYPE_LABELS, BankTransaction, TX_TYPE_COLORS, TX_TYPE_LABELS, ACCOUNT_TYPE_COLORS, ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS (+35 more)

### Community 3 - "Utility Functions & Formatting"
Cohesion: 0.05
Nodes (42): BM25, detect_domain(), _load_csv(), Lowercase, split, remove punctuation, filter short words, Build BM25 index from documents, Score all documents against query, Load CSV and return list of dicts, Core search function using BM25 (+34 more)

### Community 4 - "Purchase Order & AP"
Cohesion: 0.09
Nodes (26): PurchaseOrder, PurchaseOrderItem, SupplierPaymentRecord, ChartContentProps, COLORS, COLORS, Batch, statusColors (+18 more)

### Community 5 - "Enterprise Health & System"
Cohesion: 0.14
Nodes (23): SystemHealth, TableCount, ENTITY_TYPES, SEVERITY_CONFIG, statusConfig, RequisitionDetail, STATUS_COLORS, STATUS_COLORS (+15 more)

### Community 6 - "Automation & Workflow Engine"
Cohesion: 0.11
Nodes (23): ACTION_TYPES, EVENT_TYPES, OPERATORS, AVAILABLE_ROLES, ActivityEntry, defaultTiers, Tier, tierColorClasses (+15 more)

### Community 7 - "AI Command Palette"
Cohesion: 0.08
Nodes (33): AI_COMMANDS, AICommandPaletteProps, NAV_ITEMS, addRecentSearch(), CommandPalette(), CommandPaletteProps, entityConfig, getEntityRoute() (+25 more)

### Community 8 - "Mobile App Config"
Cohesion: 0.05
Nodes (37): backgroundColor, foregroundImage, adaptiveIcon, package, permissions, versionCode, projectId, expo (+29 more)

### Community 9 - "Security & Vulnerability"
Cohesion: 0.09
Nodes (32): create_session(), delete_exploit(), delete_fix(), delete_full_session(), delete_vulnerability(), edit_exploit(), edit_fix(), edit_summary_risk() (+24 more)

### Community 10 - "TypeScript Config & Typings"
Cohesion: 0.06
Nodes (31): dom, dom.iterable, esnext, mobile, .next/dev, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts (+23 more)

### Community 11 - "Mobile/Customer App Navigation"
Cohesion: 0.07
Nodes (18): Stack, Tab, ScannedProduct, styles, Photo, styles, PRIORITY_COLORS, STATUS_COLORS (+10 more)

### Community 12 - "Sidebar & Dashboard Shell"
Cohesion: 0.09
Nodes (16): SidebarBackdrop(), NavGroupMenu(), Sidebar(), SidebarContext, SidebarContextProps, SidebarHeader(), SidebarMenuButton(), sidebarMenuButtonVariants (+8 more)

### Community 13 - "Cash Management & Drawers"
Cohesion: 0.11
Nodes (21): CashDrawerRecord, CashEventRecord, CashSummaryData, RegisterRecord, BranchOption, CreditSale, CustomerOption, Invoice (+13 more)

### Community 14 - "Notifications & Alerts"
Cohesion: 0.08
Nodes (18): tierColors, typeColors, CashDrawer, CashEvent, hwStatusConfig, Register, statusConfig, BRANCH_OVERRIDE_FIELDS (+10 more)

### Community 15 - "Employee Management"
Cohesion: 0.11
Nodes (25): Credentials, EmployeeFormDialog(), EmployeeFormDialogProps, generatePassword(), slugifyName(), Step, createEmployeeSchema, CreateEmployeeValues (+17 more)

### Community 16 - "AI Assistant Chat UI"
Cohesion: 0.11
Nodes (18): AIActionCard(), AIActionResult(), AIAssistantChat(), AIAssistantChatProps, DEFAULT_SUGGESTIONS, SuggestionItem, AICommandPalette(), FloatingAIButton() (+10 more)

### Community 17 - "Audit Trail"
Cohesion: 0.11
Nodes (22): AuditEntry, AuditLogDbRow, AuditTrailPage(), badgeFromEntityType(), DetailsDialog(), ENTITY_BADGE_STYLES, EVENT_TYPES, EventType (+14 more)

### Community 18 - "Banking & Reconciliation"
Cohesion: 0.14
Nodes (15): BankAccount, SaleDetail, SaleRecord, STATUS_COLORS, LocationRow, statusColors, WarehouseRow, CustomerFormDialogProps (+7 more)

### Community 19 - "Dashboard Cards & KPIs"
Cohesion: 0.12
Nodes (19): PaymentBreakdown, BranchComparison(), DashboardStats(), DashboardStatsData, FALLBACK, STAT_DEFS, LowStockAlerts(), PaymentBreakdown() (+11 more)

### Community 20 - "Customer Management & Payments"
Cohesion: 0.11
Nodes (19): SelectedCustomer, CustomerLookupProps, CardPaymentForm(), LoyaltyRedemptionData, LoyaltyRedemptionSection(), LoyaltyRedemptionSectionProps, methods, PaymentMethod (+11 more)

### Community 21 - "Department Management"
Cohesion: 0.13
Nodes (21): CreateDepartmentDialog(), CreateDepartmentDialogProps, DepartmentFormValues, departmentSchema, ProductDialog(), ProductDialogProps, ProductFormProps, productFormSchema (+13 more)

### Community 22 - "Analytics Pages"
Cohesion: 0.11
Nodes (13): COLORS, COLORS, DashboardMetricsData, ChartContentProps, COLORS, AIInsightCard(), AIInsightCardProps, priorityConfig (+5 more)

### Community 23 - "MCP Toolkit Tools"
Cohesion: 0.14
Nodes (22): format_recon_for_llm(), interactive_tool_run(), dig — DNS records: A, MX, NS, TXT     Useful for subdomains, mail servers, SPF/, nikto -h — web server vulnerability scanner     Checks for outdated software, d, Run the standard recon pipeline (everything except nikto).     Returns a dict o, Execute a shell command, return combined stdout + stderr as string.     Never c, Run one tool by its menu key. Used by AI tool dispatch., Flatten the recon results dict into one clean string     to paste into the LLM (+14 more)

### Community 24 - "PowerShell WorkIQ"
Cohesion: 0.28
Nodes (22): Action-AcceptEula(), Action-Agents(), Action-Ask(), Action-CallFunction(), Action-Check(), Action-Create(), Action-Debug(), Action-Delete() (+14 more)

### Community 25 - "shadcn Component Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 26 - "Finance Sub-Pages"
Cohesion: 0.10
Nodes (17): AccountsPayablePage(), AccountsReceivablePage(), BankingPage(), ChartOfAccountsPage(), CustomerCRMDetailPage(), EmployeesPage(), GeneralLedgerPage(), InvoicesClient() (+9 more)

### Community 27 - "Admin Console Pages"
Cohesion: 0.10
Nodes (20): AdminConsolePage(), BranchesPage(), DeveloperPage(), LoyaltyPage(), DashboardNotFound(), PurchaseOrdersPage(), RequisitionsPage(), SalesHistoryPage() (+12 more)

### Community 28 - "Permissions & Roles"
Cohesion: 0.13
Nodes (16): grantTypeColors, grantTypeIcons, PermissionDef, PermissionsPage(), roleLabels, RolePermission, ROLES, UserOption (+8 more)

### Community 29 - "Customers Page"
Cohesion: 0.14
Nodes (13): CustomersPage(), customerTypeColors, formatKSh(), tierColors, CustomerDetailsDialog(), CustomerDetailsDialogProps, customerTypeColors, tierColors (+5 more)

### Community 30 - "Sidebar Navigation Config"
Cohesion: 0.10
Nodes (18): analyticsNavItems, cashNavItems, customerNavItems, enterpriseNavItems, financeNavItems, inventoryNavItems, mainNavItems, NavItem (+10 more)

### Community 31 - "PWA Manifest & Icons"
Cohesion: 0.10
Nodes (19): background_color, categories, description, display, icons, lang, name, orientation (+11 more)

### Community 32 - "Vercel Optimization Scripts"
Cohesion: 0.19
Nodes (18): annotateCodebaseScan(), annotateFinding(), assertObject(), bestRouteSummary(), buildRouteMetricIndex(), exists(), formatRouteSignal(), hasTraffic() (+10 more)

### Community 33 - "App Layout & Auth Guards"
Cohesion: 0.13
Nodes (14): DashboardLayout(), AppSidebar(), LanguageSwitcher(), ProtectedRoute(), PageTransition(), PageTransitionProps, SidebarInset(), AddUserDialogProps (+6 more)

### Community 34 - "Cart & Period Selector"
Cohesion: 0.16
Nodes (10): CartItem, PeriodSelector(), PRESETS, ShoppingCartProps, buttonVariants, Calendar(), Popover(), PopoverContent() (+2 more)

### Community 35 - "Backorders & Inventory"
Cohesion: 0.17
Nodes (10): categories, Tile, formatKSh(), InventoryPage(), AIInsightBanner(), AIInsightBannerProps, BranchData, StockAdjustmentDialog() (+2 more)

### Community 36 - "LLM Tool Calling"
Cohesion: 0.18
Nodes (17): analyse_target(), ask_ollama(), _clean(), extract_tool_calls(), parse_exploits(), parse_risk_level(), parse_summary(), parse_vulnerabilities() (+9 more)

### Community 37 - "Service Worker / PWA"
Cohesion: 0.13
Nodes (7): clearOfflineRequests(), getOfflineRequests(), handleOfflinePost(), installStats, PRECACHE_ASSETS, storeOfflineRequest(), syncOfflineRequests()

### Community 38 - "Agent Output Collection"
Cohesion: 0.24
Nodes (16): collectInputFiles(), escapeRegExp(), extractFenceBlocks(), extractJsonValue(), findBalancedJsonSpans(), inferCandidateRefFromFile(), isRecordObject(), log() (+8 more)

### Community 39 - "Report Rendering"
Cohesion: 0.25
Nodes (16): buildDebugArtifact(), candidateFamily(), candidateMatchesRef(), candidateTarget(), coerceOptionalString(), flattenObservations(), HARD_REGEN_TRIGGERS, log() (+8 more)

### Community 40 - "Mobile POS"
Cohesion: 0.16
Nodes (11): getHeldDuration(), LoyaltyRedemptionState, MobilePOSWrapper, PaymentPanel, POSPage(), POSProduct, PromotionPanel, QuickActionBar() (+3 more)

### Community 41 - "Database Migration Scripts"
Cohesion: 0.33
Nodes (16): get_session(), print_session(), Return everything linked to a sl_no across all tables., banner(), check_db(), confirm(), divider(), edit_delete_menu() (+8 more)

### Community 42 - "Enterprise Overview"
Cohesion: 0.14
Nodes (7): AuditStats, SecurityData, SystemInfo, TestingData, ExecutiveDashboardPage(), formatCompact(), formatNumber()

### Community 43 - "Toast Notifications"
Cohesion: 0.16
Nodes (14): ToastActionElement, ToastProps, Action, ActionType, actionTypes, addToRemoveQueue(), dispatch(), genId() (+6 more)

### Community 44 - "Customer Mobile App"
Cohesion: 0.13
Nodes (6): Stack, Tab, CustomerProfile, LoyaltyReward, RecentOrder, styles

### Community 45 - "Device Management"
Cohesion: 0.19
Nodes (12): DEVICE_ICONS, DevicesPage(), formatDate(), formatTimeAgo(), STATUS_VARIANTS, MonitorIcon(), Column, DataTable() (+4 more)

### Community 46 - "Mobile POS Wrapper"
Cohesion: 0.19
Nodes (11): MobilePOS(), MobileCartItem, MobilePOSWrapper(), MobilePOSWrapperProps, MobileProduct, POSProduct, QuickShiftDialog(), useReceiptSettings() (+3 more)

### Community 47 - "Codebase Scanning"
Cohesion: 0.31
Nodes (12): collectFiles(), enrichRoutesWithWorkspaceImports(), enumerateRoutes(), filterApplicable(), globMatch(), main(), mapFileToRoute(), normalizeRouteFileStem() (+4 more)

### Community 48 - "Operations & Health"
Cohesion: 0.17
Nodes (10): getEntityIcon(), AuditEntry, HealthStatus, OperationsPage(), severityClass, severityVariant, SystemHealthData, ShoppingCart() (+2 more)

### Community 49 - "Batch Tracking & Banking"
Cohesion: 0.17
Nodes (12): BatchTrackingPage(), BusinessAccountsPage(), CashManagementPage(), EVENT_TYPE_OPTIONS, IN_EVENTS, formatCompact(), InventoryAnalyticsPage(), InvoiceMatchingPage() (+4 more)

### Community 50 - "Employee Detail & Clock"
Cohesion: 0.23
Nodes (10): ClockEvent, Department, EmployeeDetailDialog(), EmployeeDetailDialogProps, EmployeePerformanceCard(), EmployeeStatsData, EmployeeDetail, EmployeeStatusBadge() (+2 more)

### Community 51 - "Toast State Management"
Cohesion: 0.19
Nodes (12): Action, ActionType, actionTypes, addToRemoveQueue(), dispatch(), genId(), listeners, memoryState (+4 more)

### Community 52 - "Agent Search Tool"
Cohesion: 0.24
Nodes (12): fetch_page(), handle_search_dispatch(), Called by llm.py when AI writes [SEARCH: something].     Smartly routes to CVE, Search DuckDuckGo and return formatted results.     No API key. No rate limit i, Search for a specific CVE.     Queries DDG then also hits cve.mitre.org directl, Search for known exploits for a service + version combo.     e.g. search_exploi, Search for mitigation/fix for a vulnerability., Fetch a URL and return extracted plain text.     Strips all HTML tags. Truncate (+4 more)

### Community 53 - "Investigation Pipeline"
Cohesion: 0.30
Nodes (11): buildFanoutPlan(), buildManifest(), candidateFamilyKey(), HERE, log(), main(), parseArgs(), pickCodebase() (+3 more)

### Community 54 - "M-Pesa API Routes"
Cohesion: 0.26
Nodes (11): callbackRateMap, checkCallbackRateLimit(), cleanupRateLimitMap(), failPendingMpesaSaleWithRestore(), lastCleanup, notifyPaymentFailure(), notifyPaymentSuccess(), POST() (+3 more)

### Community 55 - "AI Center Page"
Cohesion: 0.18
Nodes (8): AICenterPage(), PRIORITY_COLORS, PRIORITY_ICONS, supabase, AIAssistantInterface(), AIAssistantInterfaceProps, CommandButtonProps, ToggleButtonProps

### Community 56 - "Product Search"
Cohesion: 0.21
Nodes (8): Product, ProductSearchBar, ProductSearchBarProps, formatRelativeTime(), RecentCashSale, RecentTransactions(), RecentTransactionsProps, ScrollArea()

### Community 58 - "Signal Collection"
Cohesion: 0.36
Nodes (10): collectMetrics(), diagnoseObservabilityPlus(), enrichEntry(), firstString(), log(), main(), parseArgs(), sumUsageCosts() (+2 more)

### Community 60 - "Schedule & Tasks"
Cohesion: 0.27
Nodes (8): SchedulePage(), TasksPage(), BranchSwitcher(), Branch, BranchContext, BranchContextType, BranchProvider(), useBranch()

### Community 61 - "Receipt Dialog & Preview"
Cohesion: 0.31
Nodes (8): ReceiptDialog(), ReceiptDialogProps, formatPaymentLabel(), formatStatusLabel(), ReceiptPreview(), ReceiptPreviewProps, SaleDetailsData, SaleItem

### Community 62 - "Vercel Config"
Cohesion: 0.20
Nodes (9): cle1, buildCommand, devCommand, framework, headers, installCommand, regions, rewrites (+1 more)

### Community 63 - "Supplier Tests"
Cohesion: 0.20
Nodes (9): mockCreateSupplier, mockDeleteSupplier, mockGetSupplierById, mockGetSupplierOrders, mockGetSupplierPayments, mockGetSuppliers, mockRecordSupplierPayment, mockSearchSuppliers (+1 more)

### Community 64 - "Repository Test Patterns"
Cohesion: 0.22
Nodes (8): makeClient(), makeQueryBuilder(), MockDbError, sampleAssignments, sampleCategories, sampleTaxGroups, sampleTaxRate, sampleTaxRates

### Community 65 - "Warehouse & CSV Import"
Cohesion: 0.25
Nodes (8): WarehouseLocationsPage(), CSVUploadDialog(), PublishDialog(), StagingReviewTable(), PWARegistration(), ShiftDashboard(), ShiftOperations(), useToast()

### Community 66 - "Root Layout"
Cohesion: 0.25
Nodes (6): inter, metadata, viewport, ThemeProvider(), Toaster(), AuthProvider()

### Community 67 - "Toast Component"
Cohesion: 0.36
Nodes (7): Toast, ToastAction, ToastClose, ToastDescription, ToastTitle, toastVariants, ToastViewport

### Community 68 - "Date Range Context"
Cohesion: 0.28
Nodes (8): DateRange, DateRangeContext, DateRangeContextType, DateRangeProvider(), getDefaultRange(), getRangeForPreset(), PeriodPreset, PRESET_LABELS

### Community 69 - "Migration Applier"
Cohesion: 0.25
Nodes (8): __dirname, env, envContent, envPath, findConnection(), main(), match, root

### Community 70 - "Docs Library"
Cohesion: 0.25
Nodes (7): applicableFrameworksSyntax, lastVerified, ruleSkillRefs, $schema, schemaVersion, urls, version

### Community 71 - "Deep Dive Analysis"
Cohesion: 0.46
Nodes (7): log(), main(), normalizeResponse(), queryKey(), resolveDeepDiveCommandScope(), round4(), tryExtractFromBroadPass()

### Community 72 - "Employee Detail Client"
Cohesion: 0.25
Nodes (7): ClockEvent, EmployeeDocument, EmployeeGoal, employmentTypeLabels, eventTypeLabels, leaveStatusConfig, statusColors

### Community 73 - "Promotions Page"
Cohesion: 0.32
Nodes (7): defaultForm, getPromoStatus(), getPromoSummary(), PromotionsPage(), scopeLabels, typeIcons, typeLabels

### Community 74 - "Transfer Wizard"
Cohesion: 0.25
Nodes (6): Branch, NewTransferWizardDialogProps, Product, STEP_TITLES, WizardFormItem, WizardStep

### Community 75 - "KPI Card Component"
Cohesion: 0.25
Nodes (7): KpiCard(), KpiCardProps, Size, sizeMap, Tone, toneMap, Trend

### Community 76 - "Quick Check Script"
Cohesion: 0.29
Nodes (7): env, envPath, fs, https, main(), path, queryDatabase()

### Community 77 - "Community 77"
Cohesion: 0.29
Nodes (6): makeClient(), makeQueryBuilder(), MockDbError, sampleCategory, sampleExpense, sampleRecurring

### Community 78 - "Community 78"
Cohesion: 0.48
Nodes (6): HERE, main(), REFS, renderCandidates(), renderScanners(), trimTrailingBlankLine()

### Community 79 - "Community 79"
Cohesion: 0.48
Nodes (6): HERE, main(), REFS, renderCandidates(), renderScanners(), trimTrailingBlankLine()

### Community 80 - "Community 80"
Cohesion: 0.29
Nodes (5): CustomerRow, ProductRow, SaleRow, SearchResult, SupplierRow

### Community 81 - "Community 81"
Cohesion: 0.48
Nodes (6): export_html(), export_menu(), export_pdf(), fetch_all_history(), fetch_session(), get_connection()

### Community 82 - "Community 82"
Cohesion: 0.29
Nodes (4): { createClient }, fs, path, supabase

### Community 83 - "Community 83"
Cohesion: 0.29
Nodes (6): fs, migrations, migrationsPath, path, seed, seedPath

### Community 84 - "Community 84"
Cohesion: 0.29
Nodes (5): { createClient }, env, envPath, fs, path

### Community 85 - "Community 85"
Cohesion: 0.29
Nodes (6): mockAdjustStockQuantity, mockGetAllProducts, mockGetInventoryForBranch, mockGetInventoryForProduct, mockGetProductById, mockGetStockMovements

### Community 86 - "Community 86"
Cohesion: 0.29
Nodes (6): mockGetCategoryTaxAssignments, mockGetDefaultTaxRate, mockGetProductCategories, mockGetTaxForCategory, mockGetTaxGroups, mockGetTaxRates

### Community 89 - "Community 89"
Cohesion: 0.60
Nodes (5): attachDisplayRoute(), main(), parseArgs(), resolveBudget(), stableCompare()

### Community 90 - "Community 90"
Cohesion: 0.33
Nodes (4): computeAging(), CreditTransactionsClient(), getStatusColor(), getStatusLabel()

### Community 91 - "Community 91"
Cohesion: 0.33
Nodes (4): EmployeeData, EmployeeDetailClient(), LeaveRequestItem, LeaveRequest

### Community 92 - "Community 92"
Cohesion: 0.40
Nodes (5): BalanceEntry, COLORS, FinanceDashboard(), FinanceStats, formatKSh()

### Community 93 - "Community 93"
Cohesion: 0.47
Nodes (5): CHECKLIST_ITEMS, ChecklistItem, getStatusBadge(), getStatusColor(), LaunchReadinessPage()

### Community 94 - "Community 94"
Cohesion: 0.33
Nodes (5): EmployeeProfile, LeaveRequest, LeaveStats, leaveTypeLabels, statusConfig

### Community 95 - "Community 95"
Cohesion: 0.40
Nodes (5): formatTimestamp(), Notification, NotificationRule, NotificationsPage(), severityConfig

### Community 96 - "Community 96"
Cohesion: 0.33
Nodes (5): Product, PurchaseOrder, PurchaseOrderItemRecord, statusColors, Supplier

### Community 97 - "Community 97"
Cohesion: 0.33
Nodes (3): colors, PaymentSuccessAnimation(), PaymentSuccessAnimationProps

### Community 98 - "Community 98"
Cohesion: 0.60
Nodes (5): Format-MailItem(), Format-MailItemFull(), Get-FolderId(), Get-OutlookNamespace(), Invoke-OutlookAction()

### Community 99 - "Community 99"
Cohesion: 0.40
Nodes (5): executeSQL(), https, fs, main(), path

### Community 100 - "Customer Tests"
Cohesion: 0.33
Nodes (5): mockAwardLoyaltyPoints, mockGetCustomerById, mockGetCustomers, mockGetLoyaltyBalance, mockRedeemLoyaltyPoints

### Community 101 - "Finance Tests"
Cohesion: 0.33
Nodes (5): mockCreateJournalEntry, mockGenerateProfitAndLoss, mockGenerateTrialBalance, mockGetAccounts, mockGetJournalEntries

### Community 102 - "Repository Tests"
Cohesion: 0.40
Nodes (4): makeClient(), makeQueryBuilder(), MockDbError, samplePurchaseOrder

### Community 103 - "Sales Tests"
Cohesion: 0.33
Nodes (5): mockCreateSaleWithContext, mockGetSaleById, mockGetSales, mockReturnSale, mockVoidSale

### Community 104 - "Community 104"
Cohesion: 0.70
Nodes (4): log(), main(), parseArgs(), round4()

### Community 105 - "Community 105"
Cohesion: 0.70
Nodes (4): failPendingMpesaSaleWithRestore(), getMissingMpesaConfig(), POST(), restoreFailedMpesaSaleInventory()

### Community 106 - "Community 106"
Cohesion: 0.40
Nodes (5): AttendancePage(), computeTotalBreakMs(), computeWorkingHours(), formatTime(), getWeekDates()

### Community 107 - "Community 107"
Cohesion: 0.40
Nodes (3): Drawer, Register, RegistersClient()

### Community 108 - "Community 108"
Cohesion: 0.70
Nodes (4): addRecentSearch(), getRecentSearches(), GlobalSearch(), GlobalSearchProps

### Community 109 - "Community 109"
Cohesion: 0.60
Nodes (4): CashPaymentForm(), CashPaymentFormProps, changeBreakdown(), roundUpToNearest()

### Community 110 - "Community 110"
Cohesion: 0.40
Nodes (3): StripeCheckout(), StripeCheckoutFormProps, stripePromise

### Community 111 - "Community 111"
Cohesion: 0.40
Nodes (4): Branch, NewTransferDialogProps, Product, TransferFormItem

### Community 113 - "Community 113"
Cohesion: 0.80
Nodes (4): Get-PageTarget(), Get-Targets(), Invoke-BrowserAction(), Send-CDP()

### Community 114 - "Community 114"
Cohesion: 0.40
Nodes (3): { createClient }, fs, supabase

### Community 115 - "Community 115"
Cohesion: 0.40
Nodes (4): mockGetExpenseById, mockGetExpenseCategories, mockGetExpenses, mockGetRecurringExpenses

### Community 116 - "Community 116"
Cohesion: 0.40
Nodes (3): { mockFrom, mockSupabaseAdmin }, MockQuery, NOTE: The cash/accts order differs from revenue/expense:

### Community 117 - "Community 117"
Cohesion: 0.50
Nodes (4): makeClient(), makeQueryBuilder(), sampleSupplier, sampleSuppliers

### Community 118 - "Community 118"
Cohesion: 0.40
Nodes (4): mockAuthenticateServerAction, mockProfile, QueryBuilder, QueryResult

### Community 119 - "Community 119"
Cohesion: 0.40
Nodes (4): GenericRelationship, GenericSchema, GenericTable, Test

### Community 120 - "Community 120"
Cohesion: 0.50
Nodes (4): fs, https, querySupabase(), runTests()

### Community 121 - "Community 121"
Cohesion: 0.83
Nodes (3): BANNED_STALE_URLS, main(), validateFrameworks()

### Community 122 - "Community 122"
Cohesion: 0.83
Nodes (3): log(), main(), parseArgs()

### Community 126 - "Community 126"
Cohesion: 0.50
Nodes (3): plugin, $schema, .opencode/plugins/graphify.js

### Community 127 - "Community 127"
Cohesion: 0.50
Nodes (3): mockRealEmitEvent, QueryBuilder, QueryResult

### Community 136 - "Community 136"
Cohesion: 0.50
Nodes (3): mockGetEmployeeById, mockGetEmployees, mockProcessPayroll

## Knowledge Gaps
- **672 isolated node(s):** `deploy-codex.sh script`, `deploy.sh script`, `$schema`, `version`, `lastVerified` (+667 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Button()` connect `Backorders & Inventory` to `Finance & Analytics Pages`, `POS & Transaction Components`, `Suppliers & Purchasing`, `Purchase Order & AP`, `Enterprise Health & System`, `Automation & Workflow Engine`, `AI Command Palette`, `Sidebar & Dashboard Shell`, `Cash Management & Drawers`, `Notifications & Alerts`, `Employee Management`, `AI Assistant Chat UI`, `Audit Trail`, `Banking & Reconciliation`, `Dashboard Cards & KPIs`, `Customer Management & Payments`, `Department Management`, `Analytics Pages`, `Permissions & Roles`, `Customers Page`, `Sidebar Navigation Config`, `App Layout & Auth Guards`, `Cart & Period Selector`, `Mobile POS`, `Enterprise Overview`, `Device Management`, `Operations & Health`, `Employee Detail & Clock`, `AI Center Page`, `Product Search`, `Admin Icons`, `Receipt Dialog & Preview`, `Employee Detail Client`, `Promotions Page`, `Transfer Wizard`, `Community 92`, `Community 93`, `Community 94`, `Community 95`, `Community 96`, `Community 97`, `Community 109`, `Community 110`, `Community 111`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Admin Console Pages` to `Finance & Analytics Pages`, `POS & Transaction Components`, `Suppliers & Purchasing`, `Purchase Order & AP`, `Enterprise Health & System`, `Automation & Workflow Engine`, `Cash Management & Drawers`, `Notifications & Alerts`, `Audit Trail`, `Banking & Reconciliation`, `Dashboard Cards & KPIs`, `Finance Sub-Pages`, `Permissions & Roles`, `Sidebar Navigation Config`, `Vercel Optimization Scripts`, `App Layout & Auth Guards`, `Backorders & Inventory`, `Mobile POS`, `Device Management`, `Operations & Health`, `Batch Tracking & Banking`, `Employee Detail & Clock`, `Product Search`, `Admin Icons`, `Schedule & Tasks`, `Warehouse & CSV Import`, `Transfer Wizard`, `Community 93`, `Community 95`, `Community 96`, `Community 106`, `Community 111`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `deploy-codex.sh script`, `deploy.sh script`, `$schema` to the rest of the system?**
  _672 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Finance & Analytics Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.09877085162423178 - nodes in this community are weakly interconnected._
- **Should `POS & Transaction Components` be split into smaller, more focused modules?**
  _Cohesion score 0.08432539682539683 - nodes in this community are weakly interconnected._
- **Should `Suppliers & Purchasing` be split into smaller, more focused modules?**
  _Cohesion score 0.0904283447911158 - nodes in this community are weakly interconnected._
- **Should `Utility Functions & Formatting` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._