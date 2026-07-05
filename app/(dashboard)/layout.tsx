"use client"

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { MapPin, Info, Search } from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/contexts/auth-context"
import { PageTransition } from "@/components/ui/page-transition"
import { GlobalSearch } from "@/components/global-search"
import { useGlobalSearch } from "@/hooks/use-global-search"
import { I18nProvider } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = useAuth()
  const { open, toggle, close } = useGlobalSearch()

  return (
    <ProtectedRoute>
      <I18nProvider>
        <SidebarProvider defaultOpen={false}>
          <AppSidebar />
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-card/95 backdrop-blur-sm px-6">
              <SidebarTrigger className="-ml-2" />
              <Separator orientation="vertical" className="h-6" />

              <div className="flex flex-1 items-center justify-between gap-4">
                  <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {profile?.branch?.name || (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        Branch access unavailable
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[250px]">
                              <p>Your profile is not linked to a branch. Contact your administrator to be assigned to a branch.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.role ? `${profile.role} access` : "Checking access"}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Global Search Trigger */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggle}
                    className="hidden sm:flex items-center gap-2 text-muted-foreground"
                  >
                    <Search className="h-4 w-4" />
                    <span className="text-xs">Search</span>
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                      <span className="text-xs">⌘</span>K
                    </kbd>
                  </Button>

                  {/* Language Switcher */}
                  <LanguageSwitcher />

                  {profile?.branch?.code ? (
                    <Badge variant="outline" className="hidden sm:inline-flex">
                      <MapPin className="mr-1 h-3 w-3" />
                      {profile.branch.code}
                    </Badge>
                  ) : null}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium">
                      {new Date().toLocaleDateString("en-KE", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                      {" "}
                      <span className="text-xs text-muted-foreground font-normal">
                        {new Date().toLocaleTimeString("en-KE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </header>
            <main className="flex-1 overflow-auto bg-muted/30">
              <PageTransition>
                {children}
              </PageTransition>
            </main>
          </SidebarInset>
        </SidebarProvider>
        
        {/* Global Search Dialog */}
        <GlobalSearch open={open} onClose={close} />
      </I18nProvider>
    </ProtectedRoute>
  )
}
