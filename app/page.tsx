'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

export default function Home() {
  const router = useRouter()
  const { authState } = useAuth()

  useEffect(() => {
    if (authState === 'authenticated') {
      router.push('/dashboard')
    } else if (authState === 'unauthenticated') {
      router.push('/login')
    } else if (authState === 'provisioning_error') {
      router.push('/not-provisioned')
    }
  }, [authState, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-slate-400">Loading...</p>
      </div>
    </div>
  )
}
