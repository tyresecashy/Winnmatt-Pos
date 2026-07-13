'use client'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, User, FileText, Phone, Calendar, Target } from 'lucide-react'
import { EmployeeStatusBadge } from './status-badge'
import type { EmployeeDetail } from './employee-schema'

interface EmployeeDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeDetail | null
  loading: boolean
  onEdit: () => void
}

export function EmployeeDetailDialog({
  open,
  onOpenChange,
  employee,
  loading,
  onEdit,
}: EmployeeDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Employee Details</DialogTitle>
          <DialogDescription>Full profile information</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : employee ? (
          <div className="space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Basic Info */}
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-medium text-primary">
                  {employee.user?.full_name?.charAt(0) || '?'}
                </div>
                <div>
                  <h3 className="font-semibold">{employee.user?.full_name || 'Unknown'}</h3>
                  <p className="text-sm text-muted-foreground">{employee.position || 'No position'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Department:</span>
                  <span>{employee.department?.name || '-'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Employee ID:</span>
                  <span className="font-mono">{employee.employee_id || '-'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Staff No:</span>
                  <span className="font-mono">{employee.staff_number || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                {employee.employment_status && (
                  <EmployeeStatusBadge status={employee.employment_status} />
                )}
                </div>
              </div>
            </div>

            {/* Statutory Information */}
            <div>
              <h4 className="mb-2 text-sm font-medium flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Statutory Information
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border p-2.5">
                  <span className="text-xs text-muted-foreground">National ID</span>
                  <p className="font-mono">{employee.national_id || '-'}</p>
                </div>
                <div className="rounded-md border p-2.5">
                  <span className="text-xs text-muted-foreground">KRA PIN</span>
                  <p className="font-mono">{employee.kra_pin || '-'}</p>
                </div>
                <div className="rounded-md border p-2.5">
                  <span className="text-xs text-muted-foreground">NHIF Number</span>
                  <p className="font-mono">{employee.nhif_number || '-'}</p>
                </div>
                <div className="rounded-md border p-2.5">
                  <span className="text-xs text-muted-foreground">NSSF Number</span>
                  <p className="font-mono">{employee.nssf_number || '-'}</p>
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div>
              <h4 className="mb-2 text-sm font-medium flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Emergency Contact
              </h4>
              <div className="rounded-md border p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-muted-foreground">Name</span>
                    <p>{employee.emergency_contact_name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Phone</span>
                    <p>{employee.emergency_contact_phone || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground">Relation</span>
                    <p>{employee.emergency_contact_relation || '-'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Employment Details */}
            <div>
              <h4 className="mb-2 text-sm font-medium flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Employment Details
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border p-2.5">
                  <span className="text-xs text-muted-foreground">Type</span>
                  <p className="capitalize">{employee.employment_type?.replace('_', ' ') || '-'}</p>
                </div>
                <div className="rounded-md border p-2.5">
                  <span className="text-xs text-muted-foreground">Hire Date</span>
                  <p>
                    {employee.hire_date
                      ? new Date(employee.hire_date).toLocaleDateString('en-KE', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Documents */}
            {employee.documents && employee.documents.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Documents ({employee.documents.length})
                </h4>
                <div className="space-y-1.5">
                  {employee.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                      <span>{doc.document_type || 'Document'}</span>
                      <Badge variant="outline">{doc.status || 'pending'}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Goals */}
            {employee.goals && employee.goals.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  Goals ({employee.goals.length})
                </h4>
                <div className="space-y-1.5">
                  {employee.goals.map((goal) => (
                    <div key={goal.id} className="rounded-md border p-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{goal.title || 'Goal'}</span>
                        <Badge
                          variant={
                            goal.status === 'completed'
                              ? 'default'
                              : goal.status === 'in_progress'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {goal.status?.replace('_', ' ') || 'pending'}
                        </Badge>
                      </div>
                      {goal.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{goal.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Could not load employee details</p>
        )}

        <DialogFooter>
          {employee && (
            <Button variant="outline" onClick={onEdit}>
              Edit Profile
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
