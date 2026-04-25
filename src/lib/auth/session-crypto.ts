import crypto from 'crypto'

export interface SessionPayload {
  userId: string
  workspaceId: string
  iat: number
  exp: number
  version: 1
}

const HMAC_KEY = process.env.HMAC_KEY || ''
const SESSION_TTL = 7 * 24 * 60 * 60 // 7 days in seconds

export function encryptSession(payload: SessionPayload): string {
  if (!HMAC_KEY) {
    throw new Error('HMAC_KEY env var not set')
  }

  const jsonString = JSON.stringify(payload)
  const payloadB64 = Buffer.from(jsonString).toString('base64url')
  const hmac = crypto.createHmac('sha256', HMAC_KEY)
  hmac.update(payloadB64)
  const signatureB64 = hmac.digest('base64url')

  return `${payloadB64}.${signatureB64}`
}

export function decryptSession(encrypted: string): SessionPayload | null {
  if (!HMAC_KEY) {
    throw new Error('HMAC_KEY env var not set')
  }

  try {
    const [payloadB64, signatureB64] = encrypted.split('.')
    if (!payloadB64 || !signatureB64) return null

    // Verify signature
    const hmac = crypto.createHmac('sha256', HMAC_KEY)
    hmac.update(payloadB64)
    const expectedSignature = hmac.digest('base64url')

    if (signatureB64 !== expectedSignature) {
      return null
    }

    // Decode payload
    const jsonString = Buffer.from(payloadB64, 'base64url').toString('utf-8')
    const payload = JSON.parse(jsonString) as SessionPayload

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload
  } catch (error) {
    return null
  }
}

export function createSessionPayload(
  userId: string,
  workspaceId: string
): SessionPayload {
  const now = Math.floor(Date.now() / 1000)
  return {
    userId,
    workspaceId,
    iat: now,
    exp: now + SESSION_TTL,
    version: 1,
  }
}
