'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { logger } from '@/lib/logger'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('Global application error', error)
  }, [error])

  return (
    <html lang="en" className={cn('dark', 'font-sans', inter.variable)}>
      <body className="font-sans antialiased min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Unexpected Application Error</CardTitle>
            <CardDescription>
              WinnMatt POS encountered an unexpected error.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error.digest && (
              <p className="text-xs text-muted-foreground text-center font-mono">
                Error ID: {error.digest}
              </p>
            )}
            <p className="text-sm text-muted-foreground text-center">
              Please try again. If the problem persists, contact support.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => window.location.href = '/'}>
                Go Home
              </Button>
              <Button onClick={reset}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </body>
    </html>
  )
}
