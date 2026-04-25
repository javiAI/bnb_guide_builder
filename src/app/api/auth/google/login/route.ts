import { NextResponse } from 'next/server'
import { getLoginUrl } from '@/lib/auth/google-oauth'

export const runtime = 'nodejs'

function encodeBase64Url(buffer: Uint8Array): string {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export async function GET() {
  try {
    // Generate state and nonce (32 bytes each = 256 bits entropy)
    const state = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)))
    const nonce = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)))

    // Get login URL from Google OAuth client
    const loginUrl = getLoginUrl(state, nonce)

    // Create response and set secure cookies
    const response = NextResponse.redirect(loginUrl)

    // Set state cookie (server-side only, used for CSRF validation in callback)
    response.cookies.set('oauth_state', state, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    })

    // Set nonce cookie (server-side only, used for token binding in callback)
    response.cookies.set('oauth_nonce', nonce, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    })

    return response
  } catch (error) {
    console.error('OAuth login initiation error:', error)
    return NextResponse.json(
      {
        error: 'login_initiation_failed',
        message: 'Failed to initiate Google login',
      },
      { status: 500 }
    )
  }
}
