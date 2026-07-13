"use client"

import { SidebarProvider, SidebarInset, SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/contexts/auth-context"
import { PageTransition } from "@/components/ui/page-transition"
import { CommandPalette } from "@/components/command-palette"
import { useGlobalSearch } from "@/hooks/use-global-search"
import { I18nProvider } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"
import { BranchSwitcher } from "@/components/branch-switcher"
import { FloatingAIButton } from "@/components/ai/floating-ai-button"

/** Backdrop overlay — closes sidebar when clicking outside (desktop only). */
function SidebarBackdrop() {
  const { open, setOpen, isMobile } = useSidebar()
  if (!open || isMobile) return null
  return (
    <div
      className="fixed inset-0 z-[5] bg-transparent"
      onClick={() => setOpen(false)}
    />
  )
}

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
          <SidebarBackdrop />
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-card/95 backdrop-blur-sm px-6">
              <SidebarTrigger className="-ml-2" />
              <Separator orientation="vertical" className="h-6" />

              <div className="flex flex-1 items-center justify-between gap-4">
                  <div className="min-w-0 flex items-center gap-4">
                  <BranchSwitcher />
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
        
        {/* Command Palette */}
        <CommandPalette open={open} onClose={close} />

        {/* Floating AI Assistant */}
        <FloatingAIButton />
      </I18nProvider>
    </ProtectedRoute>
  )
}
