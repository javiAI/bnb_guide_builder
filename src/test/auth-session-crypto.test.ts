import { describe, it, expect } from 'vitest'
import {
  encryptSession,
  decryptSession,
  createSessionPayload,
} from '@/lib/auth/session-crypto'

describe('Session Crypto', () => {
  it('should encrypt and decrypt session', () => {
    const payload = createSessionPayload('user_123', 'workspace_456')
    const encrypted = encryptSession(payload)

    expect(encrypted).toContain('.')
    expect(encrypted.split('.').length).toBe(2)

    const decrypted = decryptSession(encrypted)
    expect(decrypted).not.toBeNull()
    expect(decrypted?.userId).toBe('user_123')
    expect(decrypted?.workspaceId).toBe('workspace_456')
    expect(decrypted?.version).toBe(1)
  })

  it('should reject tampered signature', () => {
    const payload = createSessionPayload('user_123', 'workspace_456')
    const encrypted = encryptSession(payload)
    const [payloadB64, _] = encrypted.split('.')

    const tampered = `${payloadB64}.invalidsignature`
    const decrypted = decryptSession(tampered)

    expect(decrypted).toBeNull()
  })

  it('should reject expired sessions', () => {
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      userId: 'user_123',
      workspaceId: 'workspace_456',
      iat: now - 1000,
      exp: now - 100, // Expired 100 seconds ago
      version: 1 as const,
    }

    const encrypted = encryptSession(payload)
    const decrypted = decryptSession(encrypted)

    expect(decrypted).toBeNull()
  })

  it('should accept valid sessions within TTL', () => {
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      userId: 'user_123',
      workspaceId: 'workspace_456',
      iat: now,
      exp: now + 1000, // Valid for 1000 seconds
      version: 1 as const,
    }

    const encrypted = encryptSession(payload)
    const decrypted = decryptSession(encrypted)

    expect(decrypted).not.toBeNull()
    expect(decrypted?.userId).toBe('user_123')
  })
})
