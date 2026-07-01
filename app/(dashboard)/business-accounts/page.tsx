"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Clock, ArrowRight } from "lucide-react"

export default function BusinessAccountsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Business Accounts</h1>
        <p className="text-muted-foreground">
          Manage credit accounts for business customers
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>Coming Soon</CardTitle>
              <CardDescription>
                Business account features are in development
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4 space-y-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-medium">Account Management</h3>
              <p className="text-xs text-muted-foreground">Create and manage credit accounts for business customers</p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-medium">Credit Tracking</h3>
              <p className="text-xs text-muted-foreground">Track credit limits, payment terms, and outstanding balances</p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-medium">Statements</h3>
              <p className="text-xs text-muted-foreground">Generate account statements and payment history</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
