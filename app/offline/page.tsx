'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wifi, WifiOff, RefreshCw, ShoppingCart, Package, Users } from 'lucide-react'
import Link from 'next/link'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 bg-yellow-100 rounded-full w-fit">
            <WifiOff className="h-12 w-12 text-yellow-600" />
          </div>
          <CardTitle className="text-2xl">You're Offline</CardTitle>
          <p className="text-muted-foreground">
            No internet connection detected. Some features may be limited.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-medium mb-2">Available Offline:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Point of Sale (cached products)
              </li>
              <li className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                View Inventory (last synced)
              </li>
              <li className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                View Customers (cached)
              </li>
            </ul>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="font-medium text-yellow-800 mb-2">Offline Mode Active</h3>
            <p className="text-sm text-yellow-700">
              Transactions will be queued and synced when you're back online.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Link href="/pos" className="w-full">
              <Button className="w-full">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Go to POS
              </Button>
            </Link>
            <Link href="/" className="w-full">
              <Button variant="outline" className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Connection
              </Button>
            </Link>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Changes will sync automatically when connection is restored.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
