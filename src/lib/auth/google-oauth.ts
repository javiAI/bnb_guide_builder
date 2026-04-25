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

export function getLoginUrl(state: string, nonce: string): string {
  const oauthClient = getOAuthClient()
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

export async function verifyIdToken(
  code: string,
  nonce: string
): Promise<IdTokenPayload | null> {
  try {
    const oauthClient = getOAuthClient()
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
