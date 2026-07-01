'use client'
import { logger } from '@/lib/logger';

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { AlertCircle, TrendingUp, Users, DollarSign, Clock } from 'lucide-react'
import { formatKSh } from '@/lib/currency'
import { getShiftHistory } from '@/lib/shift-actions'
import { Textarea } from '@/components/ui/textarea'
import { reopenShift } from '@/lib/shift-actions'
import { useToast } from '@/hooks/use-toast'

interface ShiftDashboardProps {
  branchId: string
  userId: string
  userRole: string
}

export function ShiftDashboard({ branchId, userId, userRole }: ShiftDashboardProps) {
  const [shifts, setShifts] = useState<any[]>([])
  const [filteredShifts, setFilteredShifts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedShift, setSelectedShift] = useState<any>(null)
  const [dateRange, setDateRange] = useState('7days')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'reopened'>('all')
  const [showReopenDialog, setShowReopenDialog] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const { toast } = useToast()

  const canManageShifts = ['manager', 'admin'].includes(userRole)

  // Load shifts on mount
  useEffect(() => {
    loadShifts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filter shifts when filters change
  useEffect(() => {
    filterShifts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts, dateRange, statusFilter])

  async function loadShifts() {
    try {
      setIsLoading(true)
      const data = await getShiftHistory(branchId, 50)
      setShifts(data)
    } catch (error) {
      logger.error('Error loading shifts:', error)
      toast({
        title: 'Error',
        description: 'Failed to load shifts',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  function filterShifts() {
    let filtered = shifts

    // Filter by date range
    const now = Date.now()
    if (dateRange === '7days') {
      const cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000)
      filtered = filtered.filter((s) => new Date(s.created_at || s.opened_at) >= cutoff)
    } else if (dateRange === '30days') {
      const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000)
      filtered = filtered.filter((s) => new Date(s.created_at || s.opened_at) >= cutoff)
    } else if (dateRange === 'today') {
      const startOfDay = new Date(now)
      startOfDay.setHours(0, 0, 0, 0)
      filtered = filtered.filter((s) => new Date(s.created_at || s.opened_at) >= startOfDay)
    }
    // 'all' = no date filter

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === statusFilter)
    }

    setFilteredShifts(filtered)
  }

  async function handleReopen(shiftId: string) {
    if (!reopenReason.trim()) {
      toast({
        title: 'Required',
        description: 'Please provide a reason for reopening the shift',
        variant: 'destructive',
      })
      return
    }

    try {
      const result = await reopenShift(shiftId, userId, reopenReason)

      if (!result.success) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Success',
        description: result.message,
      })

      setShowReopenDialog(false)
      setReopenReason('')
      loadShifts()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reopen shift',
        variant: 'destructive',
      })
    }
  }

  // Calculate summary metrics
  const totalShifts = shifts.length
  const activeShifts = shifts.filter((s) => s.status === 'open').length
  const closedShifts = shifts.filter((s) => s.status === 'closed').length

  const totalCashSales = shifts.reduce(
    (sum, s) => sum + (s.payment_breakdown?.cash_sales || 0),
    0
  )
  const totalCardSales = shifts.reduce(
    (sum, s) => sum + (s.payment_breakdown?.card_sales || 0),
    0
  )
  const totalMpesaSales = shifts.reduce(
    (sum, s) => sum + (s.payment_breakdown?.mpesa_sales || 0),
    0
  )

  const totalOver = shifts.reduce((sum, s) => {
    const diff = s.payment_breakdown?.difference || 0
    return sum + (diff > 0 ? diff : 0)
  }, 0)

  const totalShort = Math.abs(
    shifts.reduce((sum, s) => {
      const diff = s.payment_breakdown?.difference || 0
      return sum + (diff < 0 ? diff : 0)
    }, 0)
  )

  // Prepare chart data
  const dailyTotals = shifts.reduce((acc: any, shift) => {
    const date = new Date(shift.opened_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    const existing = acc.find((d: any) => d.date === date)

    if (existing) {
      existing.cash += shift.payment_breakdown?.cash_sales || 0
      existing.card += shift.payment_breakdown?.card_sales || 0
      existing.mpesa += shift.payment_breakdown?.mpesa_sales || 0
    } else {
      acc.push({
        date,
        cash: shift.payment_breakdown?.cash_sales || 0,
        card: shift.payment_breakdown?.card_sales || 0,
        mpesa: shift.payment_breakdown?.mpesa_sales || 0,
      })
    }

    return acc
  }, [])

  const paymentMethodData = [
    { name: 'Cash', value: totalCashSales, color: '#059669' },
    { name: 'Card', value: totalCardSales, color: '#3b82f6' },
    { name: 'M-Pesa', value: totalMpesaSales, color: '#a855f7' },
  ].filter((d) => d.value > 0)

  if (isLoading) {
    return <div className="text-slate-400">Loading shift data...</div>
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase">Total Shifts</p>
                <p className="text-2xl font-bold text-slate-100 mt-2">{totalShifts}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase">Active</p>
                <p className="text-2xl font-bold text-emerald-400 mt-2">{activeShifts}</p>
              </div>
              <Users className="h-8 w-8 text-emerald-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase">Total Sales</p>
                <p className="text-lg font-bold text-slate-100 mt-2">
                  {formatKSh(totalCashSales + totalCardSales + totalMpesaSales)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase">Closed Shifts</p>
                <p className="text-2xl font-bold text-slate-100 mt-2">{closedShifts}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Alert */}
      {totalOver > 0 || totalShort > 0 ? (
        <Alert className="bg-amber-950 border-amber-700">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-200">
            Total differences: Over {formatKSh(totalOver)} | Short {formatKSh(totalShort)}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {dailyTotals.length > 0 && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-100">Daily Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyTotals}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    formatter={(value) => formatKSh(value as number)}
                  />
                  <Legend />
                  <Bar dataKey="cash" fill="#059669" name="Cash" />
                  <Bar dataKey="card" fill="#3b82f6" name="Card" />
                  <Bar dataKey="mpesa" fill="#a855f7" name="M-Pesa" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {paymentMethodData.length > 0 && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-100">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value }) => `${name}: ${formatKSh(value)}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentMethodData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatKSh(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Shifts Table */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-100">Shifts</CardTitle>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-24 bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="reopened">Reopened</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-slate-800">
                  <TableHead className="text-slate-300">Shift</TableHead>
                  <TableHead className="text-slate-300">Cashier</TableHead>
                  <TableHead className="text-slate-300">Opened</TableHead>
                  <TableHead className="text-slate-300">Cash</TableHead>
                  <TableHead className="text-slate-300">Card</TableHead>
                  <TableHead className="text-slate-300">M-Pesa</TableHead>
                  <TableHead className="text-slate-300">Over/Short</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShifts.map((shift) => (
                  <TableRow key={shift.id} className="border-slate-700 hover:bg-slate-800">
                    <TableCell className="text-slate-100 font-medium">{shift.shift_number}</TableCell>
                    <TableCell className="text-slate-300">
                      {shift.cashier?.full_name || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {new Date(shift.opened_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-emerald-400">
                      {formatKSh(shift.payment_breakdown?.cash_sales || 0)}
                    </TableCell>
                    <TableCell className="text-blue-400">
                      {formatKSh(shift.payment_breakdown?.card_sales || 0)}
                    </TableCell>
                    <TableCell className="text-purple-400">
                      {formatKSh(shift.payment_breakdown?.mpesa_sales || 0)}
                    </TableCell>
                    <TableCell>
                      {shift.payment_breakdown?.difference === 0 ? (
                        <Badge variant="outline" className="bg-emerald-950 text-emerald-400 border-emerald-700">
                          Perfect
                        </Badge>
                      ) : shift.payment_breakdown?.difference > 0 ? (
                        <Badge variant="outline" className="bg-amber-950 text-amber-400 border-amber-700">
                          +{formatKSh(shift.payment_breakdown?.difference)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-950 text-red-400 border-red-700">
                          -{formatKSh(Math.abs(shift.payment_breakdown?.difference))}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          shift.status === 'open'
                            ? 'default'
                            : shift.status === 'closed'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {shift.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedShift(shift)}
                          className="text-slate-300 border-slate-600 hover:bg-slate-700"
                        >
                          View
                        </Button>

                        {canManageShifts && shift.status === 'closed' && (
                          <Dialog
                            open={showReopenDialog && selectedShift?.id === shift.id}
                            onOpenChange={(open) => {
                              setShowReopenDialog(open)
                              if (open) setSelectedShift(shift)
                              if (!open) {
                                setReopenReason('')
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-400 border-amber-700 hover:bg-amber-950"
                                onClick={() => {
                                  setSelectedShift(shift)
                                  setShowReopenDialog(true)
                                }}
                              >
                                Reopen
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-slate-700" key={shift.id}>
                              <DialogHeader>
                                <DialogTitle className="text-slate-100">Reopen Shift</DialogTitle>
                                <DialogDescription className="text-slate-400">
                                  {shift.shift_number}
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="reopen-reason" className="text-slate-300">
                                    Reason for Reopening *
                                  </Label>
                                  <Textarea
                                    id="reopen-reason"
                                    placeholder="Explain why this shift is being reopened..."
                                    value={reopenReason}
                                    onChange={(e) => setReopenReason(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-slate-100 mt-2 min-h-24"
                                  />
                                </div>

                                <div className="alert bg-amber-950 border-amber-700 p-3 rounded">
                                  <p className="text-xs text-amber-200">
                                    This action will be logged in the audit trail and visible to all
                                    managers.
                                  </p>
                                </div>

                                <Button
                                  onClick={() => handleReopen(shift.id)}
                                  className="w-full bg-amber-600 hover:bg-amber-700"
                                >
                                  Reopen Shift
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredShifts.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                No shifts found for the selected criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Shift Details Modal */}
      {selectedShift && (
        <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-100">{selectedShift.shift_number}</DialogTitle>
              <DialogDescription className="text-slate-400">
                {selectedShift.cashier?.full_name} • {new Date(selectedShift.opened_at).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-slate-800">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800 p-4 rounded border border-slate-700">
                    <p className="text-xs text-slate-400">Opening Float</p>
                    <p className="text-xl font-bold text-emerald-400 mt-1">
                      {formatKSh(selectedShift.opening_float)}
                    </p>
                  </div>
                  <div className="bg-slate-800 p-4 rounded border border-slate-700">
                    <p className="text-xs text-slate-400">Status</p>
                    <Badge className="mt-2" variant="outline">
                      {selectedShift.status}
                    </Badge>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="breakdown" className="space-y-4">
                {selectedShift.payment_breakdown && (
                  <div className="space-y-2">
                    {Object.entries(selectedShift.payment_breakdown).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex justify-between py-2 border-b border-slate-700">
                        <span className="text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-slate-100">{formatKSh(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="audit" className="space-y-4">
                <p className="text-sm text-slate-400">Audit trail for this shift</p>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
