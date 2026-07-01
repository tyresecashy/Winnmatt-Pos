"use client"
import { logger } from '@/lib/logger';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Search, Phone, Loader2 } from "lucide-react"
import { getCustomersWithStats } from "@/lib/customers-actions"
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog"
import { CustomerDetailsDialog } from "@/components/customers/customer-details-dialog"

function formatKSh(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount)
}

const customerTypeColors: Record<string, string> = {
  retail: "bg-blue-100 text-blue-700",
  wholesale: "bg-green-100 text-green-700",
  business: "bg-purple-100 text-purple-700",
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerEdit, setCustomerEdit] = useState<any>(null)
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const hasCustomersRef = useRef(false)

  useEffect(() => {
    hasCustomersRef.current = customers.length > 0
  }, [customers.length])

  const loadCustomers = useCallback(async (options?: { background?: boolean }) => {
    const shouldShowLoading = !options?.background || !hasCustomersRef.current
    if (shouldShowLoading) {
      setIsLoading(true)
    }
    try {
      const customersData = await getCustomersWithStats()
      setCustomers(customersData || [])
    } catch (error) {
      logger.error("Failed to load customers:", error)
    } finally {
      if (shouldShowLoading) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void loadCustomers())
    return () => clearTimeout(timer)
  }, [loadCustomers])

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase()

    return customers.filter((customer) => {
      const matchesSearch =
        !normalizedSearch ||
        customer.name.toLowerCase().includes(normalizedSearch) ||
        (customer.phone && customer.phone.includes(deferredSearchTerm)) ||
        (customer.email && customer.email.toLowerCase().includes(normalizedSearch))

      const matchesType = typeFilter === "all" || customer.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [customers, deferredSearchTerm, typeFilter])

  const counts = useMemo(() => {
    return customers.reduce(
      (summary, customer) => {
        summary.total += 1
        if (customer.type === "retail") summary.retail += 1
        if (customer.type === "wholesale") summary.wholesale += 1
        if (customer.type === "business") summary.business += 1
        return summary
      },
      { total: 0, retail: 0, wholesale: 0, business: 0 }
    )
  }, [customers])

  const handleAddCustomer = () => {
    setCustomerEdit(null)
    setFormDialogOpen(true)
  }

  const handleEditCustomer = (customer: any) => {
    setCustomerEdit(customer)
    setFormDialogOpen(true)
  }

  const handleViewCustomer = (customer: any) => {
    setSelectedCustomer(customer)
    setDetailsDialogOpen(true)
  }

  const handleFormSave = () => {
    setFormDialogOpen(false)
    void loadCustomers({ background: true })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            Manage customer relationships and purchase history
          </p>
        </div>
        <Button onClick={handleAddCustomer}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Customers</CardDescription>
            <CardTitle className="text-3xl">{counts.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              Retail
            </CardDescription>
            <CardTitle className="text-3xl">{counts.retail}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              Wholesale
            </CardDescription>
            <CardTitle className="text-3xl">{counts.wholesale}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-purple-500"></div>
              Business
            </CardDescription>
            <CardTitle className="text-3xl">{counts.business}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="wholesale">Wholesale</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              Showing {filteredCustomers.length} of {customers.length} customers
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                  <TableHead className="text-center">Purchases</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-muted-foreground">No customers found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {customer.name
                                .split(" ")
                                .map((n: string) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            {customer.email && (
                              <p className="text-xs text-muted-foreground">{customer.email}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.phone ? (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={customerTypeColors[customer.type]}
                        >
                          {customer.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatKSh(customer.total_purchases || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        {customer.purchase_count || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {customer.loyalty_points}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewCustomer(customer)}
                          >
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCustomer(customer)}
                          >
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Customer Form Dialog */}
      <CustomerFormDialog
        isOpen={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        customer={customerEdit}
        onSaveSuccess={handleFormSave}
      />

      {/* Customer Details Dialog */}
      {selectedCustomer && (
        <CustomerDetailsDialog
          isOpen={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          customer={selectedCustomer}
          onEdit={() => {
            setDetailsDialogOpen(false)
            handleEditCustomer(selectedCustomer)
          }}
        />
      )}
    </div>
  )
}
