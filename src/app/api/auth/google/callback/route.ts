import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyIdToken } from '@/lib/auth/google-oauth'
import { encryptSession, createSessionPayload } from '@/lib/auth/session-crypto'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const nonce = searchParams.get('nonce')

  if (!code || !state || !nonce) {
    return NextResponse.json(
      { error: 'missing_params', message: 'code, state, and nonce are required' },
      { status: 400 }
    )
  }

  // Verify state (nonce is verified in verifyIdToken)
  const storedState = request.cookies.get('oauth_state')?.value
  if (state !== storedState) {
    return NextResponse.json(
      { error: 'invalid_state', message: 'state parameter mismatch' },
      { status: 403 }
    )
  }

  // Verify ID token
  const idTokenPayload = await verifyIdToken(code, nonce)
  if (!idTokenPayload) {
    return NextResponse.json(
      {
        error: 'token_verification_failed',
        message: 'Failed to verify Google ID token',
      },
      { status: 401 }
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
      // Case 3: User exists + no googleSubject (legacy)
      else if (user.googleSubject === null) {
        return NextResponse.json(
          {
            error: 'email_exists_without_google',
            message: 'Email already exists. Please contact support to link Google account.',
          },
          { status: 409 }
        )
      }
      // Case 4: User exists + different googleSubject
      else {
        return NextResponse.json(
          {
            error: 'email_exists_with_different_google',
            message: 'Email linked to different Google account. Use that account or contact support.',
          },
          { status: 409 }
        )
      }
    } else {
      // Case 1: No user exists (normal case)
      const defaultWorkspace = await prisma.workspace.findFirst({
        orderBy: { createdAt: 'asc' },
      })

      if (!defaultWorkspace) {
        throw new Error('No default workspace found')
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

    // Get workspace (should have at least one from above logic)
    const membership = user.memberships[0]
    if (!membership) {
      throw new Error('User has no workspace membership')
    }

    // Create session
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
