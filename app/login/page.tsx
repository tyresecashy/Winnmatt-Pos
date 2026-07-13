'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/auth-context'
import { Loader2, Eye, EyeOff, Lock, Mail, Store } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { signIn, authState } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  useEffect(() => {
    if (authState === 'authenticated') {
      const timer = setTimeout(() => {
        setIsLoading(false)
        router.push('/dashboard')
      })
      return () => clearTimeout(timer)
    } else if (authState === 'provisioning_error') {
      const timer = setTimeout(() => {
        setIsLoading(false)
        setError('Your account is not provisioned. Redirecting...')
        router.push('/not-provisioned')
      })
      return () => clearTimeout(timer)
    }
  }, [authState, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await signIn(email, password)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please check your credentials.'
      setError(message)
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Animated background with brand colors */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[oklch(0.55_0.22_25)] blur-[128px] animate-pulse" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[oklch(0.78_0.14_80)] blur-[128px] animate-pulse [animation-delay:2s]" />
      </div>

      {/* Brand watermark */}
      <div className="fixed top-6 left-6 flex items-center gap-3 z-10">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[oklch(0.55_0.22_25)] shadow-lg shadow-[oklch(0.55_0.22_25)/20%]">
          <Store className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold text-white tracking-tight">WinnMatt</span>
      </div>

      <Card className="relative w-full max-w-md border-zinc-800 bg-zinc-900/80 backdrop-blur-xl shadow-2xl shadow-black/40">
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.55_0.22_25)] to-[oklch(0.45_0.20_25)] shadow-lg shadow-[oklch(0.55_0.22_25)/30%]">
              <Store className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back</h1>
            <p className="text-sm text-zinc-400 mt-1">Sign in to your WinnMatt POS account</p>
          </div>

          {/* Error alert */}
          {error && (
            <Alert className="mb-6 border-red-900/50 bg-red-950/50">
              <AlertDescription className="text-red-200 text-sm flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-800/50">
                  <Lock className="h-3 w-3 text-red-300" />
                </span>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="h-11 pl-10 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[oklch(0.55_0.22_25)] focus:ring-[oklch(0.55_0.22_25)/20%] transition-colors"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-zinc-300">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-11 pl-10 pr-10 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[oklch(0.55_0.22_25)] focus:ring-[oklch(0.55_0.22_25)/20%] transition-colors"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={rememberMe}
                onClick={() => setRememberMe(!rememberMe)}
                className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                  rememberMe
                    ? 'border-[oklch(0.55_0.22_25)] bg-[oklch(0.55_0.22_25)]'
                    : 'border-zinc-600 bg-zinc-800/50'
                }`}
              >
                {rememberMe && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <label className="text-sm text-zinc-400 cursor-pointer select-none" onClick={() => setRememberMe(!rememberMe)}>
                Remember me
              </label>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gradient-to-r from-[oklch(0.55_0.22_25)] to-[oklch(0.50_0.22_25)] hover:from-[oklch(0.50_0.22_25)] hover:to-[oklch(0.45_0.22_25)] text-white font-medium shadow-lg shadow-[oklch(0.55_0.22_25)/20%] transition-all duration-200 active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing In...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-zinc-800">
            <div className="flex items-center gap-3 text-xs text-zinc-600">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800">
                <Lock className="h-3 w-3 text-zinc-500" />
              </div>
              <p>
                Authorised personnel only. All access is logged and monitored.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Footer text */}
      <p className="fixed bottom-6 text-xs text-zinc-700">
        &copy; {new Date().getFullYear()} WinnMatt POS. All rights reserved.
      </p>
    </div>
  )
}
