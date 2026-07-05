"use client"
import { logger } from '@/lib/logger';

import Link from "next/link"
import { useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
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
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
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
  { title: "Stock Alerts", url: "/stock-alerts", icon: AlertTriangle, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Stock Count", url: "/stock-count", icon: ClipboardList, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Branch Transfers", url: "/transfers", icon: ArrowRightLeft, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Suppliers", url: "/suppliers", icon: Truck, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Purchases", url: "/purchases", icon: ClipboardCheck, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Purchase Orders", url: "/purchase-orders", icon: ShoppingCart, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Batch Tracking", url: "/batch-tracking", icon: BookOpen, roles: ['super_admin', 'admin', 'manager'] as const },
]

const salesNavItems = [
  { title: "Sales History", url: "/sales-history", icon: History, roles: ['super_admin', 'admin', 'manager'] as const },
  { title: "Returns & Refunds", url: "/returns", icon: RotateCcw },
  { title: "Invoices", url: "/invoices", icon: FileText, roles: ['super_admin', 'admin', 'manager'] as const },
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
  { title: "Financial Analytics", url: "/analytics/financial", icon: DollarSign, roles: ['super_admin', 'admin'] as const },
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

export function AppSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { profile, signOut } = useAuth()
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

  return (
    <Sidebar className="border-r-0">
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
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.filter(canSee).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Inventory
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {inventoryNavItems.filter(canSee).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Sales
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {salesNavItems.filter(canSee).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        {financeNavItems.filter(canSee).length > 0 && (
          <>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Finance
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financeNavItems.filter(canSee).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="bg-sidebar-border" />
          </>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Customers & Loyalty
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {customerNavItems.filter(canSee).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {workforceNavItems.filter(canSee).length > 0 && (
          <>
        <SidebarSeparator className="bg-sidebar-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Workforce
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workforceNavItems.filter(canSee).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
          </>
        )}

        <SidebarSeparator className="bg-sidebar-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Cash & Registers
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {cashNavItems.filter(canSee).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {opsNavItems.filter(canSee).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Analytics & Reports
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analyticsNavItems.filter(canSee).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Enterprise Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {enterpriseNavItems.filter(canSee).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminNavItems.length > 0 && (
          <>
            <SidebarSeparator className="bg-sidebar-border" />

            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
                Administration
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNavItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url}
                        className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
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
