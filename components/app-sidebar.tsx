"use client"
import { logger } from '@/lib/logger';

import Link from "next/link"
import { useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  Users,
  Truck,
  ClipboardCheck,
  ArrowRightLeft,
  History,
  BarChart3,
  Settings,
  UserCog,
  LogOut,
  Store,
  Building2,
  AlertTriangle,
  BadgePercent,
  RotateCcw,
  ClipboardList,
  IdCard,
  Clock,
  DollarSign,
  Monitor,
  Bell,
  Activity,
  ShieldCheck,
  Terminal,
  Rocket,
  Tags,
  FileText,
  TrendingUp,
  Search,
  BookOpen,
  Receipt,
  CalendarDays,
  Landmark,
  Brain,
  Zap,
  ArrowLeftRight,
  Flag,
  Puzzle,
  Webhook,
  CheckCircle,
  Megaphone,
  FileSpreadsheet,
  MapPin,
  ChevronDown,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"

const mainNavItems = [
  { title: "Executive Dashboard", url: "/executive-dashboard", icon: BarChart3, roles: ['super_admin', 'admin'] as const },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Branch Dashboard", url: "/branch-dashboard", icon: Store, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "POS / Cashier", url: "/pos", icon: ShoppingCart },
]

const inventoryNavItems = [
  { title: "Products", url: "/products", icon: Package },
  { title: "Product Intelligence", url: "/product-intelligence", icon: Search, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Inventory", url: "/inventory", icon: Warehouse, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Inventory Analytics", url: "/inventory-analytics", icon: TrendingUp, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Warehouses", url: "/warehouses", icon: Building2, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Warehouse Locations", url: "/warehouse-locations", icon: MapPin, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Stock Alerts", url: "/stock-alerts", icon: AlertTriangle, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Stock Count", url: "/stock-count", icon: ClipboardList, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Branch Transfers", url: "/transfers", icon: ArrowRightLeft, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Suppliers", url: "/suppliers", icon: Truck, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Purchases", url: "/purchases", icon: ClipboardCheck, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Purchase Orders", url: "/purchase-orders", icon: ShoppingCart, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Goods Received Notes", url: "/goods-received-notes", icon: ClipboardList, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Supplier Invoices", url: "/supplier-invoices", icon: Receipt, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Supplier Returns", url: "/supplier-returns", icon: RotateCcw, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Backorders", url: "/backorders", icon: ArrowLeftRight, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Batch Tracking", url: "/batch-tracking", icon: BookOpen, roles: ['super_admin', 'admin', 'manager'] as const },
]

const salesNavItems = [
  { title: "Sales History", url: "/sales-history", icon: History, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Returns & Refunds", url: "/returns", icon: RotateCcw },
  { title: "Invoices", url: "/invoices", icon: FileText, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Invoice Matching", url: "/invoice-matching", icon: FileSpreadsheet, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ['super_admin', 'admin', 'manager'] as const },
]

const workforceNavItems = [
  { title: "Employees", url: "/employees", icon: IdCard, roles: ['super_admin', 'admin'] as const },
  { title: "Attendance", url: "/attendance", icon: Clock, roles: ['super_admin', 'admin'] as const },
  { title: "Schedule", url: "/schedule", icon: CalendarDays, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Task Management", url: "/tasks", icon: ClipboardCheck, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Leave Requests", url: "/leaves", icon: CalendarDays, roles: ['super_admin', 'admin'] as const },
  { title: "Payroll", url: "/payroll", icon: DollarSign, roles: ['super_admin', 'admin'] as const },
]

const cashNavItems = [
  { title: "Cash Management", url: "/cash-management", icon: DollarSign },
  { title: "Registers", url: "/registers", icon: Monitor, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Shifts", url: "/shifts", icon: Clock },
]

const financeNavItems = [
  { title: "Chart of Accounts", url: "/chart-of-accounts", icon: BookOpen, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "General Ledger", url: "/general-ledger", icon: FileText, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Accounts Receivable", url: "/accounts-receivable", icon: Users, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Accounts Payable", url: "/accounts-payable", icon: Truck, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Banking", url: "/banking", icon: Landmark, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Bank Reconciliation", url: "/bank-reconciliation", icon: ArrowLeftRight, roles: ['super_admin', 'admin'] as const },
  { title: "Financial Periods", url: "/financial-periods", icon: CalendarDays, roles: ['super_admin', 'admin'] as const },
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ['super_admin', 'admin'] as const },
]

const customerNavItems = [
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Customer Credit", url: "/customer-credit", icon: DollarSign, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Loyalty", url: "/loyalty", icon: BadgePercent },
  { title: "Campaigns", url: "/campaigns", icon: Megaphone, roles: ['super_admin', 'admin', 'manager'] as const },
]

const opsNavItems = [
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Operations Center", url: "/operations", icon: Activity, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Task Management", url: "/tasks", icon: ClipboardCheck, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Expenses", url: "/expenses", icon: Receipt, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Transfers", url: "/transfers", icon: ArrowRightLeft, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Webhooks", url: "/webhooks", icon: Webhook, roles: ['super_admin', 'admin'] as const },
  { title: "Feature Flags", url: "/feature-flags", icon: Flag, roles: ['super_admin', 'admin'] as const },
  { title: "Plugins", url: "/plugins", icon: Puzzle, roles: ['super_admin', 'admin'] as const },
  { title: "Automation", url: "/automation", icon: Zap, roles: ['super_admin', 'admin'] as const },
]

const analyticsNavItems = [
  { title: "Analytics Dashboard", url: "/analytics", icon: BarChart3, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Sales Analytics", url: "/analytics/sales", icon: TrendingUp, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Inventory Analytics", url: "/analytics/inventory", icon: Package, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Customer Analytics", url: "/analytics/customers", icon: Users, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Workforce Analytics", url: "/analytics/workforce", icon: Clock, roles: ['super_admin', 'admin'] as const },
  { title: "Financial Analytics", url: "/analytics/finance", icon: DollarSign, roles: ['super_admin', 'admin'] as const },
  { title: "Report Builder", url: "/analytics/reports", icon: FileText, roles: ['super_admin', 'admin'] as const },
]

const enterpriseNavItems = [
  { title: "Command Center", url: "/command-center", icon: Activity, roles: ['super_admin', 'admin'] as const },
  { title: "Test Center", url: "/enterprise/testing", icon: CheckCircle, roles: ['super_admin', 'admin'] as const },
  { title: "Deployments", url: "/enterprise/deployments", icon: Rocket, roles: ['super_admin', 'admin'] as const },
  { title: "Releases", url: "/enterprise/releases", icon: Package, roles: ['super_admin', 'admin'] as const },
  { title: "Incidents", url: "/enterprise/incidents", icon: AlertTriangle, roles: ['super_admin', 'admin'] as const },
  { title: "Security", url: "/enterprise/security", icon: ShieldCheck, roles: ['super_admin', 'admin'] as const },
  { title: "Audit Log", url: "/enterprise/audit", icon: FileText, roles: ['super_admin', 'admin'] as const },
  { title: "Configuration", url: "/enterprise/config", icon: Settings, roles: ['super_admin', 'admin'] as const },
]

interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  roles?: readonly string[]
}

/** Render a group of sidebar items inside a collapsible section. */
function NavGroupMenu({
  items,
  pathname,
}: {
  items: NavItem[]
  pathname: string
}) {
  const { setOpen } = useSidebar()

  return (
    <SidebarGroupContent>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.url}
              className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
            >
              <Link href={item.url} onClick={() => setOpen(false)}>
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  )
}

/** A sidebar group with collapsible header (chevron toggle). */
function SidebarCollapsibleGroup({
  label,
  open,
  onOpenChange,
  children,
}: {
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <SidebarGroup>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <div className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs uppercase tracking-wider text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground select-none">
            {label}
            <ChevronDown className="h-3 w-3 transition-transform duration-200 data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {children}
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  )
}

export function AppSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { profile, signOut } = useAuth()

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    main: false,
    inventory: false,
    sales: false,
    finance: false,
    customers: false,
    workforce: false,
    cash: false,
    operations: false,
    analytics: false,
    enterprise: false,
    admin: false,
  })

  const toggleSection = (key: string) => (value: boolean) => {
    setOpenSections((prev) => ({ ...prev, [key]: value }))
  }

  const adminNavItems = [
    ...(["super_admin", "admin"].includes(profile?.role || "")
      ? [{ title: "Admin Console", url: "/admin", icon: Settings }]
      : []),
    ...(profile?.role === "admin"
      ? [{ title: "Users & Roles", url: "/users", icon: UserCog }]
      : []),
    ...(["super_admin", "admin"].includes(profile?.role || "")
      ? [{ title: "Branches", url: "/branches", icon: Store }]
      : []),
    ...(["super_admin", "admin"].includes(profile?.role || "")
      ? [{ title: "Promotions", url: "/promotions", icon: BadgePercent }]
      : []),
    ...(["super_admin", "admin"].includes(profile?.role || "")
      ? [{ title: "Tax Configuration", url: "/tax-config", icon: BadgePercent }]
      : []),
    ...(["super_admin", "admin"].includes(profile?.role || "")
      ? [{ title: "Permissions", url: "/permissions", icon: ShieldCheck }]
      : []),
    ...(["super_admin", "admin"].includes(profile?.role || "")
      ? [{ title: "Security", url: "/security", icon: ShieldCheck }]
      : []),
    ...(["super_admin", "admin"].includes(profile?.role || "")
      ? [{ title: "Launch Readiness", url: "/launch-readiness", icon: Rocket }]
      : []),
    ...(["super_admin", "admin"].includes(profile?.role || "")
      ? [{ title: "Developer", url: "/developer", icon: Terminal }]
      : []),
    ...(["super_admin", "admin"].includes(profile?.role || "")
      ? [{ title: "AI Center", url: "/ai-center", icon: Brain }]
      : []),
    ...(["super_admin", "admin"].includes(profile?.role || "")
      ? [{ title: "Bulk Operations", url: "/bulk-operations", icon: Tags }]
      : []),
    ...(["super_admin", "admin"].includes(profile?.role || "")
      ? [{ title: "Audit Trail", url: "/audit-trail", icon: FileText }]
      : []),
    ...(["super_admin", "admin"].includes(profile?.role || "")
      ? [{ title: "Settings", url: "/settings", icon: Settings }]
      : []),
  ]

  const handleLogout = async () => {
    try {
      await signOut()
      router.push('/login')
    } catch (error) {
      logger.error('Logout failed:', error)
    }
  }

  // Filter nav items by user role
  const canSee = (item: { roles?: readonly string[] }) => {
    if (!item.roles || item.roles.length === 0) return true
    return item.roles.includes(profile?.role || '')
  }

  const financeVisible = financeNavItems.filter(canSee).length > 0
  const workforceVisible = workforceNavItems.filter(canSee).length > 0

  return (
    <Sidebar className="border-r-0" data-overlay="true">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Store className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
              WINNMATT
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              Supermarket POS
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* ── Main ──────────────────────────────────────────── */}
        <SidebarCollapsibleGroup
          label="Main"
          open={openSections.main}
          onOpenChange={toggleSection('main')}
        >
          <NavGroupMenu items={mainNavItems.filter(canSee)} pathname={pathname} />
        </SidebarCollapsibleGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        {/* ── Inventory ──────────────────────────────────────── */}
        <SidebarCollapsibleGroup
          label="Inventory"
          open={openSections.inventory}
          onOpenChange={toggleSection('inventory')}
        >
          <NavGroupMenu items={inventoryNavItems.filter(canSee)} pathname={pathname} />
        </SidebarCollapsibleGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        {/* ── Sales ──────────────────────────────────────────── */}
        <SidebarCollapsibleGroup
          label="Sales"
          open={openSections.sales}
          onOpenChange={toggleSection('sales')}
        >
          <NavGroupMenu items={salesNavItems.filter(canSee)} pathname={pathname} />
        </SidebarCollapsibleGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        {/* ── Finance (conditional) ──────────────────────────── */}
        {financeVisible && (
          <>
            <SidebarCollapsibleGroup
              label="Finance"
              open={openSections.finance}
              onOpenChange={toggleSection('finance')}
            >
              <NavGroupMenu items={financeNavItems.filter(canSee)} pathname={pathname} />
            </SidebarCollapsibleGroup>

            <SidebarSeparator className="bg-sidebar-border" />
          </>
        )}

        {/* ── Customers & Loyalty ─────────────────────────────── */}
        <SidebarCollapsibleGroup
          label="Customers & Loyalty"
          open={openSections.customers}
          onOpenChange={toggleSection('customers')}
        >
          <NavGroupMenu items={customerNavItems.filter(canSee)} pathname={pathname} />
        </SidebarCollapsibleGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        {/* ── Workforce (conditional) ─────────────────────────── */}
        {workforceVisible && (
          <>
            <SidebarCollapsibleGroup
              label="Workforce"
              open={openSections.workforce}
              onOpenChange={toggleSection('workforce')}
            >
              <NavGroupMenu items={workforceNavItems.filter(canSee)} pathname={pathname} />
            </SidebarCollapsibleGroup>

            <SidebarSeparator className="bg-sidebar-border" />
          </>
        )}

        {/* ── Cash & Registers ────────────────────────────────── */}
        <SidebarCollapsibleGroup
          label="Cash & Registers"
          open={openSections.cash}
          onOpenChange={toggleSection('cash')}
        >
          <NavGroupMenu items={cashNavItems.filter(canSee)} pathname={pathname} />
        </SidebarCollapsibleGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        {/* ── Operations ──────────────────────────────────────── */}
        <SidebarCollapsibleGroup
          label="Operations"
          open={openSections.operations}
          onOpenChange={toggleSection('operations')}
        >
          <NavGroupMenu items={opsNavItems.filter(canSee)} pathname={pathname} />
        </SidebarCollapsibleGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        {/* ── Analytics & Reports ─────────────────────────────── */}
        <SidebarCollapsibleGroup
          label="Analytics & Reports"
          open={openSections.analytics}
          onOpenChange={toggleSection('analytics')}
        >
          <NavGroupMenu items={analyticsNavItems.filter(canSee)} pathname={pathname} />
        </SidebarCollapsibleGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        {/* ── Enterprise Operations ───────────────────────────── */}
        <SidebarCollapsibleGroup
          label="Enterprise Operations"
          open={openSections.enterprise}
          onOpenChange={toggleSection('enterprise')}
        >
          <NavGroupMenu items={enterpriseNavItems.filter(canSee)} pathname={pathname} />
        </SidebarCollapsibleGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        {/* ── Administration (conditional) ────────────────────── */}
        {adminNavItems.length > 0 && (
          <>
            <SidebarCollapsibleGroup
              label="Administration"
              open={openSections.admin}
              onOpenChange={toggleSection('admin')}
            >
              <NavGroupMenu items={adminNavItems} pathname={pathname} />
            </SidebarCollapsibleGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {profile?.full_name
                ?.split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.full_name || 'User'}
            </span>
            <span className="text-xs text-sidebar-foreground/60 truncate">
              {profile?.branch?.name || 'Loading...'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title="Sign Out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
