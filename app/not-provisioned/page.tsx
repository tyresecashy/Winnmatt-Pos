import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, LogOut } from 'lucide-react'

export default function NotProvisionedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-900/20 border border-red-700 mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Account Not Provisioned</h1>
            <p className="text-slate-400">Access Restricted</p>
          </div>

          <Alert className="mb-6 bg-red-900/10 border-red-700">
            <AlertDescription className="text-red-200">
              Your account is not yet provisioned in the system. You cannot access the application at this time.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="bg-slate-700/50 rounded-lg p-4">
              <p className="text-sm text-slate-300 mb-2">
                <span className="font-semibold">Access status: </span>
                <span className="font-mono break-all">Provisioning required</span>
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Sign-in worked, but this account does not yet have app access.
              </p>
            </div>

            <div className="bg-slate-700/50 rounded-lg p-4">
              <p className="text-sm font-semibold text-white mb-2">What to do:</p>
              <ul className="text-sm text-slate-300 space-y-1 list-inside list-disc">
                <li>Contact your system administrator</li>
                <li>Request access provisioning for this account</li>
                <li>Retry sign-in after provisioning is complete</li>
              </ul>
            </div>

            <Button asChild className="w-full bg-red-600 hover:bg-red-700 text-white">
              <Link href="/login">
                <LogOut className="w-4 h-4 mr-2" />
                Return to Login
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
