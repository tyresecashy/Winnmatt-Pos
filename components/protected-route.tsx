'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { authState } = useAuth()

  useEffect(() => {
    if (authState === 'unauthenticated') {
      router.push('/login')
    } else if (authState === 'provisioning_error') {
      router.push('/not-provisioned')
    }
  }, [authState, router])

  if (authState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-slate-400">Checking your access...</p>
        </div>
      </div>
    )
  }

  if (authState === 'authenticated') {
    return <>{children}</>
  }

  return null
}
