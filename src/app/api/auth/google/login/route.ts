import { NextResponse, type NextRequest } from 'next/server'
import { getLoginUrl } from '@/lib/auth/google-oauth'

export const runtime = 'nodejs'

function encodeBase64Url(buffer: Uint8Array): string {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Dynamically construct callback URL from request host.
 * Works across any port/environment without hardcoding.
 *
 * Examples:
 * - localhost:3000/api/auth/google/login → http://localhost:3000/api/auth/google/callback
 * - localhost:3001/api/auth/google/login → http://localhost:3001/api/auth/google/callback
 * - example.com/api/auth/google/login → https://example.com/api/auth/google/callback
 */
function getCallbackUrl(request: NextRequest): string {
  const host = request.headers.get('host')
  if (!host) {
    throw new Error('Missing host header')
  }

  // Determine protocol: use https in production, http in development
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'

  return `${protocol}://${host}/api/auth/google/callback`
}

// Google's OAuth server rejects private-network IPv4 (RFC 1918) as redirect_uri
// without device-flow params. In dev, force the whole flow onto localhost so
// cookies and redirect_uri stay consistent and approved by Google.
function isPrivateIPv4Host(host: string): boolean {
  const hostname = host.split(':')[0]
  return (
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    /^169\.254\./.test(hostname)
  )
}

export async function GET(request: NextRequest) {
  try {
    const host = request.headers.get('host') ?? ''
    if (process.env.NODE_ENV !== 'production' && isPrivateIPv4Host(host)) {
      const port = host.includes(':') ? host.split(':').pop() : '3000'
      const target = `http://localhost:${port}/api/auth/google/login`
      return NextResponse.redirect(target)
    }

    // Generate state and nonce (32 bytes each = 256 bits entropy)
    const state = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)))
    const nonce = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)))

    // Construct callback URL dynamically from request host
    const callbackUrl = getCallbackUrl(request)

    // Get login URL from Google OAuth client with dynamic callback
    const loginUrl = getLoginUrl(state, nonce, callbackUrl)

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
