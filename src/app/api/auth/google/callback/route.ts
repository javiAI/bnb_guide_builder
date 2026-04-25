import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyIdToken } from '@/lib/auth/google-oauth'
import { encryptSession, createSessionPayload } from '@/lib/auth/session-crypto'

export const runtime = 'nodejs'

function createOAuthErrorResponse(
  body: { error: string; message: string },
  status: number
) {
  const response = NextResponse.json(body, { status })
  response.cookies.delete('oauth_state')
  response.cookies.delete('oauth_nonce')
  return response
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    return createOAuthErrorResponse(
      { error: 'missing_params', message: 'code and state are required' },
      400
    )
  }

  // Verify state and use the stored nonce for ID token verification
  const storedState = request.cookies.get('oauth_state')?.value
  const storedNonce = request.cookies.get('oauth_nonce')?.value
  if (state !== storedState) {
    return createOAuthErrorResponse(
      { error: 'invalid_state', message: 'state parameter mismatch' },
      403
    )
  }

  if (!storedNonce) {
    return createOAuthErrorResponse(
      { error: 'invalid_nonce', message: 'nonce cookie missing or invalid' },
      403
    )
  }

  // Verify ID token against the nonce value originally stored by the server
  const idTokenPayload = await verifyIdToken(code, storedNonce)
  if (!idTokenPayload) {
    return createOAuthErrorResponse(
      {
        error: 'token_verification_failed',
        message: 'Failed to verify Google ID token',
      },
      401
    )
  }

  // Require verified email for operator account creation
  if (!idTokenPayload.email_verified) {
    return createOAuthErrorResponse(
      {
        error: 'email_not_verified',
        message: 'Email must be verified with Google to create an operator account',
      },
      403
    )
  }

  try {
    // Lookup or create user
    let user = await prisma.user.findUnique({
      where: { email: idTokenPayload.email },
      include: { memberships: true },
    })

    if (user) {
      // Case 2: User exists + same googleSubject (re-auth)
      if (user.googleSubject === idTokenPayload.sub) {
        // Re-auth, session refreshes
      }
      // Case 3: User exists + different googleSubject
      else {
        return createOAuthErrorResponse(
          {
            error: 'email_exists_with_different_google',
            message: 'Email linked to different Google account. Use that account or contact support.',
          },
          409
        )
      }
    } else {
      // Case 1: No user exists (normal case)
      const defaultWorkspace = await prisma.workspace.findFirst({
        orderBy: { createdAt: 'asc' },
      })

      if (!defaultWorkspace) {
        return createOAuthErrorResponse(
          {
            error: 'workspace_bootstrap_required',
            message:
              'No workspace exists yet. Initialize the application by creating a workspace before signing in.',
          },
          503
        )
      }

      user = await prisma.user.create({
        data: {
          googleSubject: idTokenPayload.sub,
          email: idTokenPayload.email,
          name: idTokenPayload.name || null,
          memberships: {
            create: {
              workspaceId: defaultWorkspace.id,
              role: 'owner',
            },
          },
        },
        include: { memberships: true },
      })
    }

    // Get workspace membership deterministically
    let membership = null

    if (user.memberships.length === 0) {
      return NextResponse.json(
        {
          error: 'no_workspace_membership',
          message: 'User has no workspace membership. Contact administrator.',
        },
        { status: 403 }
      )
    }

    if (user.memberships.length === 1) {
      membership = user.memberships[0]
    } else {
      // Multiple memberships: select for default workspace
      const defaultWorkspace = await prisma.workspace.findFirst({
        orderBy: { createdAt: 'asc' },
      })

      if (!defaultWorkspace) {
        return createOAuthErrorResponse(
          {
            error: 'no_default_workspace',
            message: 'Default workspace not found.',
          },
          500
        )
      }

      membership =
        user.memberships.find(
          (candidateMembership) =>
            candidateMembership.workspaceId === defaultWorkspace.id
        ) ?? null

      if (!membership) {
        return createOAuthErrorResponse(
          {
            error: 'user_not_in_default_workspace',
            message: 'User is not a member of the default workspace.',
          },
          403
        )
      }
    }

    // Create session with selected workspace
    const sessionPayload = createSessionPayload(user.id, membership.workspaceId)
    const encryptedSession = encryptSession(sessionPayload)

    // Set response
    const response = NextResponse.redirect(new URL('/properties', request.url))
    response.cookies.set('session', encryptedSession, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

    // Clear OAuth cookies
    response.cookies.delete('oauth_state')
    response.cookies.delete('oauth_nonce')

    return response
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.json(
      { error: 'oauth_callback_error', message: 'Failed to process OAuth callback' },
      { status: 500 }
    )
  }
}
