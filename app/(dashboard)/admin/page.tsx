"use client"
import { logger } from '@/lib/logger';

import { useMemo, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Settings,
  Shield,
  Users,
  Store,
  BadgePercent,
  UserCog,
  Building2,
  Bell,
  Activity,
  Terminal,
  Rocket,
  Monitor,
  ClipboardCheck,
  Lock,
  Database,
  RefreshCw,
  ChevronRight,
  Search,
} from "lucide-react"

interface Tile {
  title: string
  description: string
  icon: React.ElementType
  href: string
}

const categories: { title: string; tiles: Tile[] }[] = [
  {
    title: "Business Operations",
    tiles: [
      { title: "Branches", description: "Manage store locations and branches", icon: Store, href: "/branches" },
      { title: "Settings", description: "Configure system-wide settings", icon: Settings, href: "/settings" },
      { title: "Promotions", description: "Create and manage promotions", icon: BadgePercent, href: "/promotions" },
    ],
  },
  {
    title: "User Management",
    tiles: [
      { title: "Users & Roles", description: "Manage user accounts and role assignments", icon: UserCog, href: "/users" },
      { title: "Permissions", description: "Configure role and user permissions", icon: Shield, href: "/permissions" },
      { title: "Employees", description: "Manage employee records", icon: Building2, href: "/employees" },
    ],
  },
  {
    title: "Security & Compliance",
    tiles: [
      { title: "Security Settings", description: "Configure security policies and access controls", icon: Lock, href: "/security" },
      { title: "Launch Readiness", description: "Check launch readiness checklist", icon: Rocket, href: "/launch-readiness" },
      { title: "Operations Center", description: "Monitor system operations and health", icon: Activity, href: "/operations" },
    ],
  },
  {
    title: "System",
    tiles: [
      { title: "Developer Console", description: "Developer tools and API access", icon: Terminal, href: "/developer" },
      { title: "Registers", description: "Manage POS register configurations", icon: Monitor, href: "/registers" },
      { title: "Notifications", description: "Configure notification preferences", icon: Bell, href: "/notifications" },
    ],
  },
]

export default function AdminConsolePage() {
  const { profile } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")

  const isAuthorized = profile?.role === "super_admin" || profile?.role === "admin"

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories

    const lower = searchQuery.toLowerCase()
    return categories
      .map((cat) => ({
        ...cat,
        tiles: cat.tiles.filter(
          (t) =>
            t.title.toLowerCase().includes(lower) ||
            t.description.toLowerCase().includes(lower)
        ),
      }))
      .filter((cat) => cat.tiles.length > 0)
  }, [searchQuery])

  if (!profile) return null

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Shield className="h-16 w-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
          You do not have the required permissions to access the Admin Console. Contact your system administrator.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Admin Console</h1>
        <p className="text-sm text-muted-foreground">
          Manage your business operations, users, and system settings
        </p>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search settings..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredCategories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Search className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm">No settings match your search</p>
          <Button variant="link" className="mt-1" onClick={() => setSearchQuery("")}>
            Clear search
          </Button>
        </div>
      ) : (
        filteredCategories.map((category) => (
          <section key={category.title}>
            <h2 className="text-lg font-semibold tracking-tight mb-3">{category.title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {category.tiles.map((tile) => {
                const Icon = tile.icon
                return (
                  <Link key={tile.href} href={tile.href}>
                    <Card className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-border/50 h-full">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                            <Icon className="h-6 w-6" />
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardTitle className="text-base">{tile.title}</CardTitle>
                        <CardDescription className="mt-1 text-xs leading-relaxed">
                          {tile.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
