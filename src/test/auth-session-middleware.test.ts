import { describe, it, expect } from 'vitest'
import { parseSessionFromCookies } from '@/lib/auth/session-middleware'
import { encryptSession, createSessionPayload } from '@/lib/auth/session-crypto'

describe('Session Middleware', () => {
  it('should parse valid session from cookie header', () => {
    const payload = createSessionPayload('user_123', 'workspace_456')
    const encrypted = encryptSession(payload)
    const cookieHeader = `session=${encrypted}; Path=/; HttpOnly`

    const session = parseSessionFromCookies(cookieHeader)

    expect(session.valid).toBe(true)
    expect(session.userId).toBe('user_123')
    expect(session.workspaceId).toBe('workspace_456')
  })

  it('should return invalid if no session cookie present', () => {
    const cookieHeader = 'other_cookie=value'

    const session = parseSessionFromCookies(cookieHeader)

    expect(session.valid).toBe(false)
    expect(session.userId).toBeNull()
    expect(session.workspaceId).toBeNull()
  })

  it('should return invalid if cookie header is null', () => {
    const session = parseSessionFromCookies(null)

    expect(session.valid).toBe(false)
    expect(session.userId).toBeNull()
    expect(session.workspaceId).toBeNull()
  })

  it('should return invalid if session is tampered', () => {
    const payload = createSessionPayload('user_123', 'workspace_456')
    const encrypted = encryptSession(payload)
    const [payloadB64, _] = encrypted.split('.')

    const tamperedSession = `${payloadB64}.invalidsignature`
    const cookieHeader = `session=${tamperedSession}`

    const session = parseSessionFromCookies(cookieHeader)

    expect(session.valid).toBe(false)
  })

  it('should return invalid if session is expired', () => {
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      userId: 'user_123',
      workspaceId: 'workspace_456',
      iat: now - 1000,
      exp: now - 100, // Expired
      version: 1 as const,
    }

    const encrypted = encryptSession(payload)
    const cookieHeader = `session=${encrypted}`

    const session = parseSessionFromCookies(cookieHeader)

    expect(session.valid).toBe(false)
  })

  it('should parse session with multiple cookies in header', () => {
    const payload = createSessionPayload('user_123', 'workspace_456')
    const encrypted = encryptSession(payload)
    const cookieHeader = `other=value; session=${encrypted}; another=test`

    const session = parseSessionFromCookies(cookieHeader)

    expect(session.valid).toBe(true)
    expect(session.userId).toBe('user_123')
    expect(session.workspaceId).toBe('workspace_456')
  })
})
