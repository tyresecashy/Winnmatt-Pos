'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  branch_id: string | null
  role: 'owner' | 'admin' | 'manager' | 'cashier'
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  branch?: {
    id: string
    name: string
    code: string
  }
}

/**
 * Auth state machine:
 * - 'unauthenticated': No Supabase auth user
 * - 'loading': Checking auth and profile status
 * - 'authenticated': User is logged in with valid app profile
 * - 'provisioning_error': User logged in but NO app profile in custom users table
 */
export type AuthState = 'unauthenticated' | 'loading' | 'authenticated' | 'provisioning_error'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  authState: AuthState
  provisioningError: string | null
  session: Session | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [provisioningError, setProvisioningError] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  /**
   * Load user profile from custom users table.
   * 
   * STRICT AUTHORIZATION: Does NOT auto-create profiles.
   * If the authenticated Supabase user has no matching row in the custom users table,
   * returns null and sets authState to 'provisioning_error'.
   * 
   * Admin users will need to explicitly provision app profiles via an admin interface.
   */
  const loadUserProfile = async (userId: string, userEmail: string): Promise<boolean> => {
    console.log('[AUTH] loadUserProfile called for:', userEmail, 'userId:', userId)
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'GET',
      })

      console.log('[AUTH] Profile API response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('✅ [AUTH] User profile loaded:', data.profile?.email, data.profile?.role, 'at', data.profile?.branch?.name)
        
        // Check if user is active
        if (data.profile?.status === 'inactive') {
          console.warn('⚠️  [AUTH] User account is inactive:', data.profile?.email)
          setProfile(null)
          setAuthState('provisioning_error')
          setProvisioningError(
            `Your account (${data.profile?.email}) has been deactivated. ` +
            `Please contact your administrator.`
          )
          return false
        }
        
        setProfile(data.profile)
        setAuthState('authenticated')
        setProvisioningError(null)
        return true
      }

      if (response.status === 404) {
        // User is authenticated but not provisioned in app
        console.warn('⚠️  [AUTH] User profile not found (404) for', userEmail)
        console.warn('📋 [AUTH] This user has Supabase auth but no app profile in custom users table')
        console.warn('🔒 [AUTH] Access denied - account not provisioned')
        
        setProfile(null)
        setAuthState('provisioning_error')
        setProvisioningError(
          `Your account (${userEmail}) is not provisioned in the system. ` +
          `Please contact your administrator to grant access.`
        )
        return false
      }

      if (response.status === 403) {
        console.warn('⚠️  [AUTH] User account is inactive:', userEmail)
        setProfile(null)
        setAuthState('provisioning_error')
        setProvisioningError(
          `Your account (${userEmail}) has been deactivated. ` +
          `Please contact your administrator.`
        )
        return false
      }

      if (response.status === 500) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[AUTH] Profile API error (500):', errorData)
      }

      console.error('[AUTH] Unexpected response status:', response.status)
      throw new Error('Failed to load user profile')
    } catch (error) {
      console.error('❌ [AUTH] Error loading profile:', error)
      setProfile(null)
      setAuthState('provisioning_error')
      setProvisioningError('Failed to load your account profile. Please try again.')
      return false
    }
  }

  useEffect(() => {
    // Get initial session and load profile
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        
        if (session?.user) {
          setUser(session.user)
          await loadUserProfile(session.user.id, session.user.email || '')
        } else {
          setUser(null)
          setAuthState('unauthenticated')
          setProfile(null)
          setProvisioningError(null)
        }
      } catch (error) {
        console.error('Error getting session:', error)
        setAuthState('unauthenticated')
      }
    }

    getSession()

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      
      if (session?.user) {
        setUser(session.user)
        // Load profile when auth state changes
        await loadUserProfile(session.user.id, session.user.email || '')
      } else {
        setUser(null)
        setProfile(null)
        setAuthState('unauthenticated')
        setProvisioningError(null)
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    setAuthState('loading')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      
      // Load profile after successful sign in
      if (data.user) {
        await loadUserProfile(data.user.id, data.user.email || '')
      }
    } catch (error) {
      setAuthState('unauthenticated')
      throw error
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    setAuthState('loading')
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })
      if (error) throw error
      
      // After sign up, try to load profile (won't exist until admin provisions)
      if (data.user) {
        await loadUserProfile(data.user.id, data.user.email || '')
      }
    } catch (error) {
      setAuthState('unauthenticated')
      throw error
    }
  }

  const signOut = async () => {
    setAuthState('loading')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Clear all state
      setUser(null)
      setProfile(null)
      setAuthState('unauthenticated')
      setProvisioningError(null)
      setSession(null)
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        authState,
        provisioningError,
        session,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
