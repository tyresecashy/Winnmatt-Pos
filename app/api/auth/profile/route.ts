import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server'
import {
  getAuthenticatedSupabaseUser,
  loadUserProfileResult,
} from '@/lib/auth-helpers'
import { profileUpdateSchema } from '@/lib/api-schemas'
import { badRequest } from '@/lib/api-errors'

/**
 * GET /api/auth/profile
 *
 * Fetches the custom app profile for the authenticated Supabase user.
 */
export async function GET(request: NextRequest) {
  try {
    const authUserResult = await getAuthenticatedSupabaseUser(request)

    if (!authUserResult.user) {
      logger.warn('[PROFILE] Auth failed:', { error: authUserResult.error })
      return NextResponse.json(
        { error: authUserResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const profileResult = await loadUserProfileResult(authUserResult.user.id)

    if (!profileResult.profile) {
      if (profileResult.reason === 'missing') {
        return NextResponse.json(
          { error: 'Profile not provisioned' },
          { status: 404 }
        )
      }

      if (profileResult.reason === 'inactive') {
        return NextResponse.json(
          { error: 'Profile inactive' },
          { status: 403 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    logger.info('[PROFILE] Profile loaded', {
      email: profileResult.profile.email,
      role: profileResult.profile.role,
    })

    return NextResponse.json({ profile: profileResult.profile })
  } catch (error) {
    logger.error('[PROFILE] Unhandled error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/profile
 *
 * DISABLED for user self-service
 *
 * Profile auto-creation is NOT supported. Accounts must be explicitly provisioned
 * by administrators through a dedicated admin interface (to be implemented).
 *
 * This endpoint returns 403 Forbidden for all requests.
 *
 * Future: Will be admin-only for provisioning new app profiles.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return badRequest([{ field: 'body', message: 'Invalid JSON body' }])
    }

    const parsed = profileUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      })))
    }

    return NextResponse.json(
      {
        error: 'User self-service profile creation is not supported.',
        message: 'Your account must be provisioned by an administrator. Please contact support.',
      },
      { status: 403 }
    )
  } catch (error) {
    logger.error('[PROFILE] Unhandled error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
