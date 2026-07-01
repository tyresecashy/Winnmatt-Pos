'use client'
import { logger } from '@/lib/logger';

import { useEffect, useState, useDeferredValue } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Search, Truck, Phone, Mail, MoreHorizontal, Pencil, Trash2, AlertCircle, Filter, DollarSign } from 'lucide-react'
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, type Supplier } from '@/lib/suppliers-actions'
import { formatKSh } from '@/lib/currency'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'

export default function SuppliersPage() {
  const { toast } = useToast()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    payment_terms: 'Net 30',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null)
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'owed' | 'paid'>('all')

  // Load suppliers on mount
  useEffect(() => {
    async function loadSuppliers() {
      setLoading(true)
      try {
        const data = await getSuppliers()
        setSuppliers(data)
      } catch (error) {
        logger.error('Failed to load suppliers:', error)
        toast({
          title: 'Error',
          description: 'Failed to load suppliers',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    loadSuppliers()
  }, [toast])

  const filteredSuppliers = suppliers.filter((supplier) => {
    const searchLower = deferredSearchTerm.toLowerCase()
    const matchesSearch =
      supplier.name.toLowerCase().includes(searchLower) ||
      supplier.contact_person.toLowerCase().includes(searchLower) ||
      supplier.phone.includes(deferredSearchTerm) ||
      (supplier.email?.toLowerCase() || '').includes(searchLower)

    const matchesBalance =
      balanceFilter === 'all' ||
      (balanceFilter === 'owed' && supplier.balance > 0) ||
      (balanceFilter === 'paid' && supplier.balance === 0)

    return matchesSearch && matchesBalance
  })

  const HIGH_BALANCE_THRESHOLD = 50000 // KES

  const totalOwed = suppliers.reduce((sum, s) => sum + s.balance, 0)

  const handleAddSupplier = async () => {
    if (!formData.name.trim() || !formData.contact_person.trim() || !formData.phone.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const result = await createSupplier(
        formData.name,
        formData.contact_person,
        formData.phone,
        formData.email,
        formData.payment_terms
      )

      if (result.success) {
        setSuppliers([...suppliers, result.supplier as Supplier])
        setShowAddDialog(false)
        setFormData({
          name: '',
          contact_person: '',
          phone: '',
          email: '',
          payment_terms: 'Net 30',
        })
        toast({
          title: 'Success',
          description: result.message,
        })
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create supplier',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditSupplier = async () => {
    if (!editingSupplier) return
    if (!formData.name.trim() || !formData.contact_person.trim() || !formData.phone.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const result = await updateSupplier(editingSupplier.id, {
        name: formData.name,
        contact_person: formData.contact_person,
        phone: formData.phone,
        email: formData.email,
        payment_terms: formData.payment_terms,
      })

      if (result.success) {
        setSuppliers(
          suppliers.map((s) => (s.id === editingSupplier.id ? (result.supplier as Supplier) : s))
        )
        setShowEditDialog(false)
        setEditingSupplier(null)
        setFormData({
          name: '',
          contact_person: '',
          phone: '',
          email: '',
          payment_terms: 'Net 30',
        })
        toast({
          title: 'Success',
          description: result.message,
        })
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update supplier',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person,
      phone: supplier.phone,
      email: supplier.email || '',
      payment_terms: supplier.payment_terms,
    })
    setShowEditDialog(true)
  }

  const openAddDialog = () => {
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      payment_terms: 'Net 30',
    })
    setShowAddDialog(true)
  }

  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return

    try {
      const result = await deleteSupplier(deletingSupplier.id)

      if (result.success) {
        setSuppliers(suppliers.filter((s) => s.id !== deletingSupplier.id))
        setDeletingSupplier(null)
        toast({
          title: 'Deleted',
          description: `Supplier "${deletingSupplier.name}" has been removed`,
        })
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete supplier',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete supplier',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading suppliers...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground">Manage your supplier relationships and payments</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Suppliers</CardDescription>
            <CardTitle className="text-3xl">{suppliers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Payables</CardDescription>
            <CardTitle className="text-2xl text-primary">{formatKSh(totalOwed)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>With Balance Owed</CardDescription>
            <CardTitle className="text-3xl">{suppliers.filter((s) => s.balance > 0).length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search suppliers by name, contact, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="flex rounded-lg border p-0.5">
                <button
                  onClick={() => setBalanceFilter('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    balanceFilter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setBalanceFilter('owed')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    balanceFilter === 'owed' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Balance Owed
                </button>
                <button
                  onClick={() => setBalanceFilter('paid')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    balanceFilter === 'paid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Fully Paid
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              Showing {filteredSuppliers.length} of {suppliers.length} suppliers
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSuppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {suppliers.length === 0 ? 'No suppliers yet. Add one to get started.' : 'No suppliers match your search.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Payment Terms</TableHead>
                  <TableHead className="text-right">Balance Owed</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => {
                  const isHighBalance = supplier.balance >= HIGH_BALANCE_THRESHOLD
                  const hasBalance = supplier.balance > 0
                  return (
                    <TableRow
                      key={supplier.id}
                      className={isHighBalance ? 'bg-red-50/50 dark:bg-red-950/10' : ''}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Truck className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{supplier.name}</p>
                            {supplier.email && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {supplier.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{supplier.contact_person}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {supplier.phone}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          {supplier.payment_terms}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={
                              isHighBalance
                                ? 'text-destructive font-bold'
                                : hasBalance
                                ? 'text-primary font-medium'
                                : 'text-green-600'
                            }
                          >
                            {formatKSh(supplier.balance)}
                          </span>
                          {hasBalance && (
                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isHighBalance ? 'bg-destructive' : 'bg-primary/60'
                                }`}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (supplier.balance / HIGH_BALANCE_THRESHOLD) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(supplier)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeletingSupplier(supplier)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Supplier Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
            <DialogDescription>Create a new supplier in the system</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Supplier Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Kenya Breweries Ltd"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSaving}
              />
            </div>

            <div>
              <Label htmlFor="contact_person">Contact Person *</Label>
              <Input
                id="contact_person"
                placeholder="e.g., Samuel Ndungu"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                disabled={isSaving}
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                placeholder="e.g., 0722111222"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={isSaving}
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="e.g., orders@supplier.co.ke"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isSaving}
              />
            </div>

            <div>
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Input
                id="payment_terms"
                placeholder="e.g., Net 30, Cash on Delivery"
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                disabled={isSaving}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleAddSupplier} disabled={isSaving}>
              {isSaving ? 'Creating...' : 'Create Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>Update supplier information</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_name">Supplier Name *</Label>
              <Input
                id="edit_name"
                placeholder="e.g., Kenya Breweries Ltd"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSaving}
              />
            </div>

            <div>
              <Label htmlFor="edit_contact_person">Contact Person *</Label>
              <Input
                id="edit_contact_person"
                placeholder="e.g., Samuel Ndungu"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                disabled={isSaving}
              />
            </div>

            <div>
              <Label htmlFor="edit_phone">Phone Number *</Label>
              <Input
                id="edit_phone"
                placeholder="e.g., 0722111222"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={isSaving}
              />
            </div>

            <div>
              <Label htmlFor="edit_email">Email</Label>
              <Input
                id="edit_email"
                type="email"
                placeholder="e.g., orders@supplier.co.ke"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isSaving}
              />
            </div>

            <div>
              <Label htmlFor="edit_payment_terms">Payment Terms</Label>
              <Input
                id="edit_payment_terms"
                placeholder="e.g., Net 30, Cash on Delivery"
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                disabled={isSaving}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleEditSupplier} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingSupplier} onOpenChange={(open) => !open && setDeletingSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingSupplier?.name}</strong>?
              This action cannot be undone. Any purchase orders linked to this supplier will remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSupplier}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Supplier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
