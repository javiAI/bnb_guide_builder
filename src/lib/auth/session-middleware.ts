import { decryptSession } from './session-crypto'

export interface SessionContext {
  userId: string | null
  workspaceId: string | null
  valid: boolean
}

export function parseSessionFromCookies(cookieHeader: string | null): SessionContext {
  if (!cookieHeader) {
    return { userId: null, workspaceId: null, valid: false }
  }

  try {
    const sessionMatch = cookieHeader.match(/session=([^;]+)/)
    if (!sessionMatch) {
      return { userId: null, workspaceId: null, valid: false }
    }

    const encrypted = decodeURIComponent(sessionMatch[1])
    const session = decryptSession(encrypted)

    if (!session) {
      return { userId: null, workspaceId: null, valid: false }
    }

    return {
      userId: session.userId,
      workspaceId: session.workspaceId,
      valid: true,
    }
  } catch (error) {
    return { userId: null, workspaceId: null, valid: false }
  }
}
