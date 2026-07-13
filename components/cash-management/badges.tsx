import { Badge } from '@/components/ui/badge'

/**
 * Badge for cash register / device status (online / offline / maintenance).
 */
export function DeviceStatusBadge({ status }: { status: string | null | undefined }) {
  switch (status) {
    case 'online':
      return <Badge variant="default" className="bg-green-600">Online</Badge>
    case 'offline':
      return <Badge variant="destructive">Offline</Badge>
    case 'maintenance':
      return <Badge variant="secondary">Maintenance</Badge>
    default:
      return <Badge variant="outline">{status || 'Unknown'}</Badge>
  }
}

/**
 * Badge for cash drawer status (open / closed / counted).
 */
export function DrawerStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'open':
      return <Badge className="bg-green-600">Open</Badge>
    case 'closed':
      return <Badge variant="secondary">Closed</Badge>
    case 'counted':
      return <Badge variant="default">Counted</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}
