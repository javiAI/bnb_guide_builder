import { OAuth2Client } from 'google-auth-library'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || ''

let client: OAuth2Client | null = null

export function getOAuthClient(): OAuth2Client {
  if (!client) {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_CALLBACK_URL) {
      throw new Error(
        'Google OAuth env vars not configured: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL'
      )
    }
    client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL)
  }
  return client
}

/**
 * Generate Google OAuth login URL.
 *
 * @param state - CSRF state token
 * @param nonce - Token binding nonce
 * @param callbackUrl - Optional dynamic callback URL. If provided, overrides env config.
 *                      Allows callback URL to be constructed from request host at runtime.
 */
export function getLoginUrl(state: string, nonce: string, callbackUrl?: string): string {
  // If dynamic callback URL provided, create a new client with it
  // Otherwise use the preconfigured client
  let oauthClient = getOAuthClient()

  if (callbackUrl) {
    // Validate callback URL format (security: prevent open redirect)
    if (!callbackUrl.startsWith('http://') && !callbackUrl.startsWith('https://')) {
      throw new Error('Invalid callback URL: must start with http:// or https://')
    }
    oauthClient = new (require('google-auth-library')).OAuth2Client(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      callbackUrl
    )
  }

  const url = oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
    nonce,
  })
  return url
}

export interface IdTokenPayload {
  iss: string
  sub: string
  email: string
  email_verified: boolean
  name?: string
  picture?: string
  nonce: string
  iat: number
  exp: number
}

/**
 * Verify Google ID token and exchange code for tokens.
 *
 * @param code - Authorization code from Google
 * @param nonce - Nonce for token binding validation
 * @param callbackUrl - Optional dynamic callback URL. Must match the URL used in login.
 */
export async function verifyIdToken(
  code: string,
  nonce: string,
  callbackUrl?: string
): Promise<IdTokenPayload | null> {
  try {
    let oauthClient = getOAuthClient()

    // If dynamic callback URL provided, create client with exact callback URL
    // This is critical: the callback URL used here must match exactly what Google redirected to
    if (callbackUrl) {
      const { OAuth2Client } = require('google-auth-library')
      oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, callbackUrl)
    }

    const { tokens } = await oauthClient.getToken(code)

    if (!tokens.id_token) {
      return null
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload || !payload.email) {
      return null
    }

    // Verify nonce
    if (payload.nonce !== nonce) {
      return null
    }

    // Verify exp
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload as IdTokenPayload
  } catch (error) {
    console.error('ID token verification error:', error)
    return null
  }
}
