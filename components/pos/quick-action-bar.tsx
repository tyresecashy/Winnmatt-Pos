'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Pause, Copy, FileText,
  Printer, Mail, MessageSquare, Ban, ShieldCheck, MoreHorizontal,
} from 'lucide-react'

interface QuickActionBarProps {
  cartEmpty: boolean
  hasCustomer: boolean
  isSupervisor: boolean
  onHold: () => void
  onDuplicate: () => void
  onConvertToQuote: () => void
  onVoid: () => void
  onEmailReceipt: () => void
  onSMSReceipt: () => void
  onReprint: () => void
  onManagerApproval: () => void
}

export function QuickActionBar({
  cartEmpty,
  hasCustomer,
  isSupervisor,
  onHold,
  onDuplicate,
  onConvertToQuote,
  onVoid,
  onEmailReceipt,
  onSMSReceipt,
  onReprint,
  onManagerApproval,
}: QuickActionBarProps) {
  return (
    <div className="flex items-center gap-1">
      {/* Primary actions — always visible when cart has items */}
      <Button
        variant="outline"
        size="sm"
        disabled={cartEmpty}
        onClick={onHold}
        title="Park / Hold Sale"
      >
        <Pause className="h-3.5 w-3.5 mr-1" />
        Hold
      </Button>

      <Button
        variant="outline"
        size="sm"
        disabled={cartEmpty}
        onClick={onReprint}
        title="Reprint last receipt"
      >
        <Printer className="h-3.5 w-3.5 mr-1" />
        Reprint
      </Button>

      {/* Overflow actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={cartEmpty}>
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onDuplicate} disabled={cartEmpty}>
            <Copy className="h-4 w-4 mr-2" /> Duplicate Cart
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onConvertToQuote} disabled={cartEmpty || !hasCustomer}>
            <FileText className="h-4 w-4 mr-2" /> Convert to Quote
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onEmailReceipt} disabled={!hasCustomer}>
            <Mail className="h-4 w-4 mr-2" /> Email Receipt
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSMSReceipt} disabled={!hasCustomer}>
            <MessageSquare className="h-4 w-4 mr-2" /> SMS Receipt
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onReprint}>
            <Printer className="h-4 w-4 mr-2" /> Reprint Receipt
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onVoid} disabled={cartEmpty} className="text-destructive">
            <Ban className="h-4 w-4 mr-2" /> Void Sale
          </DropdownMenuItem>
          {isSupervisor && (
            <DropdownMenuItem onClick={onManagerApproval} disabled={cartEmpty}>
              <ShieldCheck className="h-4 w-4 mr-2" /> Manager Approval
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
