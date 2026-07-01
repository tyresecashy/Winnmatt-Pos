import { logger } from '@/lib/logger';
/**
 * Server-side auth helpers
 *
 * These helpers verify the authenticated Supabase user on the server,
 * then load the matching app profile from the users table.
 */

import {
  createClient,
  getServerActionAccessToken,
  getServerAuthVerifierClient,
  supabaseAdmin,
} from '@/lib/supabase-server'
import type { UserProfile } from '@/contexts/auth-context'

const POS_ALLOWED_ROLES: ReadonlySet<UserProfile['role']> = new Set([
  'owner',
  'admin',
  'manager',
  'cashier',
])

const INVENTORY_CONTROL_ALLOWED_ROLES: ReadonlySet<UserProfile['role']> = new Set([
  'owner',
  'admin',
  'manager',
])

interface AuthenticatedSupabaseIdentity {
  id: string
  email?: string
}

/**
 * Extract optional debug user id from request header.
 * This is never trusted for authentication or authorization.
 */
export function extractDebugUserId(request: Request): string | null {
  try {
    const userId = request.headers.get('X-User-ID')

    if (!userId) {
      return null
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      logger.warn('[AUTH] Ignoring invalid debug X-User-ID header:', { userId })
      return null
    }

    return userId
  } catch (error) {
    logger.error('[AUTH] Error extracting debug user ID:', error)
    return null
  }
}

/**
 * Read the authenticated Supabase user from the server-side session.
 * Uses Supabase auth verification and never trusts caller-provided user ids.
 */
export async function getAuthenticatedSupabaseUser(request: Request): Promise<{
  user: AuthenticatedSupabaseIdentity | null
  error?: string
}> {
  try {
    const supabase = await createClient(request)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      logger.warn('[AUTH] Supabase user verification failed:', { error: error.message })
      return {
        user: null,
        error: 'Unauthorized: Invalid or missing Supabase session',
      }
    }

    if (!user) {
      return {
        user: null,
        error: 'Unauthorized: No authenticated Supabase user',
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email || undefined,
      },
    }
  } catch (error) {
    logger.error('[AUTH] Failed to verify Supabase session:', error)
    return {
      user: null,
      error: 'Unauthorized: Failed to verify Supabase session',
    }
  }
}

/**
 * Load user profile by verified Supabase auth user ID.
 * Returns full profile with branch info, or null if not found.
 */
export async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  const result = await loadUserProfileResult(userId)
  return result.profile
}

export async function loadUserProfileResult(userId: string): Promise<{
  profile: UserProfile | null
  reason?: 'missing' | 'inactive'
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        branch_id,
        status,
        created_at,
        updated_at,
        branch:branches(id, name, code)
      `)
      .eq('id', userId)
      .single()

    if (!error && data) {
      if (data.status === 'inactive') {
        logger.warn('[AUTH] User is inactive:', { email: data.email })
        return {
          profile: null,
          reason: 'inactive',
        }
      }

      return {
        profile: {
          ...data,
          branch: Array.isArray(data.branch) && data.branch.length > 0 ? data.branch[0] : undefined,
        },
      }
    }

    if (error?.code === 'PGRST116') {
      logger.warn('[AUTH] User profile not found for verified user:', { userId })
      return {
        profile: null,
        reason: 'missing',
      }
    }

    if (error?.message?.includes('relation') || error?.message?.includes('branch')) {
      logger.warn('[AUTH] Branch relation failed, retrying profile load without relation')

      const { data: fallbackProfile, error: fallbackError } = await supabaseAdmin
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          branch_id,
          status,
          created_at,
          updated_at
        `)
        .eq('id', userId)
        .single()

      if (fallbackError || !fallbackProfile) {
        logger.warn('[AUTH] Fallback profile load error:', {
          code: fallbackError?.code,
          message: fallbackError?.message,
        })
        return {
          profile: null,
          reason: fallbackError?.code === 'PGRST116' ? 'missing' : undefined,
        }
      }

      if (fallbackProfile.status === 'inactive') {
        logger.warn('[AUTH] User is inactive:', { email: fallbackProfile.email })
        return {
          profile: null,
          reason: 'inactive',
        }
      }

      if (!fallbackProfile.branch_id) {
        return {
          profile: fallbackProfile,
        }
      }

      const { data: branchData, error: branchError } = await supabaseAdmin
        .from('branches')
        .select('id, name, code')
        .eq('id', fallbackProfile.branch_id)
        .single()

      if (branchError) {
        logger.warn('[AUTH] Branch lookup failed during fallback profile load:', { error: branchError.message })
        return {
          profile: fallbackProfile,
        }
      }

      return {
        profile: {
          ...fallbackProfile,
          branch: branchData,
        },
      }
    }

    logger.warn('[AUTH] Profile load error:', { code: error?.code, message: error?.message })
    return {
      profile: null,
    }
  } catch (error) {
    logger.error('[AUTH] Failed to load profile:', error)
    return {
      profile: null,
    }
  }
}

/**
 * Load the lightweight checkout profile needed for live POS auth.
 * This avoids the extra branch relation join in the synchronous cash path.
 */
export async function loadCheckoutUserProfileResult(userId: string): Promise<{
  profile: UserProfile | null
  reason?: 'missing' | 'inactive'
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        branch_id,
        status,
        created_at,
        updated_at
      `)
      .eq('id', userId)
      .single()

    if (!error && data) {
      if (data.status === 'inactive') {
        logger.warn('[AUTH] User is inactive:', { email: data.email })
        return {
          profile: null,
          reason: 'inactive',
        }
      }

      return {
        profile: data,
      }
    }

    if (error?.code === 'PGRST116') {
      logger.warn('[AUTH] User profile not found for verified user:', { userId })
      return {
        profile: null,
        reason: 'missing',
      }
    }

    logger.warn('[AUTH] Checkout profile load error:', { code: error?.code, message: error?.message })
    return {
      profile: null,
    }
  } catch (error) {
    logger.error('[AUTH] Failed to load checkout profile:', error)
    return {
      profile: null,
    }
  }
}

/**
 * Validate request authentication and return the verified Supabase user
 * plus the matching app profile.
 */
export async function authenticateRequest(request: Request): Promise<{
  success: boolean
  user?: AuthenticatedSupabaseIdentity
  profile?: UserProfile
  error?: string
}> {
  const authUserResult = await getAuthenticatedSupabaseUser(request)

  if (!authUserResult.user) {
    return {
      success: false,
      error: authUserResult.error,
    }
  }

  const debugUserId = extractDebugUserId(request)
  if (debugUserId && debugUserId !== authUserResult.user.id) {
    logger.warn('[AUTH] Ignoring mismatched X-User-ID header', {
      debugUserId,
      authenticatedUserId: authUserResult.user.id,
    })
  }

  const profileResult = await loadUserProfileResult(authUserResult.user.id)
  const profile = profileResult.profile

  if (!profile) {
    return {
      success: false,
      error:
        profileResult.reason === 'inactive'
          ? 'Unauthorized: User is inactive'
          : 'Unauthorized: User not found',
    }
  }

  return {
    success: true,
    user: authUserResult.user,
    profile,
  }
}

/**
 * Read the authenticated Supabase user from a server action session.
 * Uses the mirrored Supabase session cookie and never trusts client-provided ids.
 */
export async function getAuthenticatedServerActionUser(): Promise<{
  user: AuthenticatedSupabaseIdentity | null
  error?: string
}> {
  try {
    const accessToken = await getServerActionAccessToken()

    if (!accessToken) {
      return {
        user: null,
        error: 'Unauthorized: Invalid or missing Supabase session',
      }
    }

    const authVerifier = getServerAuthVerifierClient()
    const claimsResult = await authVerifier.auth.getClaims(accessToken)
    const claims = claimsResult.data?.claims
    const claimsUserId = typeof claims?.sub === 'string' ? claims.sub : null

    if (claimsUserId) {
      return {
        user: {
          id: claimsUserId,
          email: typeof claims?.email === 'string' ? claims.email : undefined,
        },
      }
    }

    if (claimsResult.error) {
      logger.warn('[AUTH] Server action JWT claims verification fell back to getUser:', { error: claimsResult.error.message })
    }

    const {
      data: { user },
      error,
    } = await authVerifier.auth.getUser(accessToken)

    if (error) {
      logger.warn('[AUTH] Server action Supabase user verification failed:', { error: error.message })
      return {
        user: null,
        error: 'Unauthorized: Invalid or missing Supabase session',
      }
    }

    if (!user) {
      return {
        user: null,
        error: 'Unauthorized: No authenticated Supabase user',
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email || undefined,
      },
    }
  } catch (error) {
    logger.error('[AUTH] Failed to verify Supabase session for server action:', error)
    return {
      user: null,
      error: 'Unauthorized: Failed to verify Supabase session',
    }
  }
}

/**
 * Validate server action authentication and return the verified Supabase user
 * plus the matching app profile.
 */
export async function authenticateServerAction(): Promise<{
  success: boolean
  user?: AuthenticatedSupabaseIdentity
  profile?: UserProfile
  error?: string
}> {
  const authUserResult = await getAuthenticatedServerActionUser()

  if (!authUserResult.user) {
    return {
      success: false,
      error: authUserResult.error,
    }
  }

  const profileResult = await loadUserProfileResult(authUserResult.user.id)
  const profile = profileResult.profile

  if (!profile) {
    return {
      success: false,
      error:
        profileResult.reason === 'inactive'
          ? 'Unauthorized: User is inactive'
          : 'Unauthorized: User not found',
    }
  }

  return {
    success: true,
    user: authUserResult.user,
    profile,
  }
}

/**
 * Verify a profile is allowed to use the live POS surface.
 */
export function authorizePOSProfile(profile: UserProfile): {
  authorized: boolean
  error?: string
} {
  if (!POS_ALLOWED_ROLES.has(profile.role)) {
    return {
      authorized: false,
      error: 'Access denied: User is not allowed to operate POS',
    }
  }

  if (profile.role !== 'owner' && !profile.branch_id) {
    return {
      authorized: false,
      error: 'Access denied: User must be assigned to a branch',
    }
  }

  return { authorized: true }
}

/**
 * Verify a profile is allowed to manage inventory-adjusting operations.
 */
export function authorizeInventoryControlProfile(profile: UserProfile): {
  authorized: boolean
  error?: string
} {
  const posAccess = authorizePOSProfile(profile)
  if (!posAccess.authorized) {
    return posAccess
  }

  if (!INVENTORY_CONTROL_ALLOWED_ROLES.has(profile.role)) {
    return {
      authorized: false,
      error: 'Access denied: Only owners, admins, and managers can manage inventory',
    }
  }

  return { authorized: true }
}

/**
 * Verify a profile is allowed to manage branch transfers.
 */
export function authorizeTransferProfile(profile: UserProfile): {
  authorized: boolean
  error?: string
} {
  const inventoryAccess = authorizeInventoryControlProfile(profile)
  if (!inventoryAccess.authorized) {
    return inventoryAccess
  }

  return { authorized: true }
}

/**
 * Resolve the effective branch for a POS action.
 * Owners may operate against any explicitly requested branch.
 * Non-owners are locked to their assigned branch.
 */
export function resolveAuthorizedBranchId(
  profile: UserProfile,
  requestedBranchId?: string | null
): {
  authorized: boolean
  branchId?: string
  error?: string
} {
  const posAccess = authorizePOSProfile(profile)
  if (!posAccess.authorized) {
    return posAccess
  }

  if (profile.role === 'owner') {
    const ownerBranchId = requestedBranchId || profile.branch_id || undefined

    if (!ownerBranchId) {
      return {
        authorized: false,
        error: 'Access denied: Owner must choose a branch for POS actions',
      }
    }

    return {
      authorized: true,
      branchId: ownerBranchId,
    }
  }

  if (requestedBranchId && requestedBranchId !== profile.branch_id) {
    logger.warn('[AUTH] Cross-branch POS request denied', {
      userId: profile.id,
      userBranch: profile.branch_id,
      requestedBranchId,
    })
    return {
      authorized: false,
      error: 'Access denied: Branch mismatch',
    }
  }

  return {
    authorized: true,
    branchId: profile.branch_id || undefined,
  }
}

/**
 * Verify user has access to a sale
 * Owner can access all sales
 * Admin/Manager/Cashier can only access sales from their branch
 * Returns { authorized: boolean, error?: string }
 */
export async function verifySaleAccess(
  profile: UserProfile,
  saleId: string
): Promise<{ authorized: boolean; error?: string }> {
  try {
    if (profile.role === 'owner') {
      return { authorized: true }
    }

    if (!profile.branch_id) {
      return {
        authorized: false,
        error: 'User must be assigned to a branch',
      }
    }

    const { data: sale, error } = await supabaseAdmin
      .from('sales')
      .select('id, branch_id')
      .eq('id', saleId)
      .single()

    if (error || !sale) {
      return {
        authorized: false,
        error: 'Sale not found',
      }
    }

    if (sale.branch_id !== profile.branch_id) {
      logger.warn('[AUTH] Cross-branch access attempt', {
        userId: profile.id,
        userBranch: profile.branch_id,
        saleBranch: sale.branch_id,
        saleId,
      })
      return {
        authorized: false,
        error: 'Access denied: Sale belongs to a different branch',
      }
    }

    return { authorized: true }
  } catch (error) {
    logger.error('[AUTH] Error verifying sale access:', error)
    return {
      authorized: false,
      error: 'Internal error',
    }
  }
}

/**
 * Response helper: Return 401 Unauthorized
 */
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Response helper: Return 403 Forbidden
 */
export function forbiddenResponse(message: string = 'Access denied') {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}
