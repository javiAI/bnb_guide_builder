import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session-crypto'
import {
  AUDIT_ACTIONS,
  formatActor,
  writeAudit,
} from '@/lib/services/audit.service'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // Read+verify the session BEFORE clearing the cookie so we can attribute the
  // session.end audit row to the actor. A tampered/expired cookie is treated
  // as no session — we still clear the cookie but skip the audit.
  const sessionCookie = request.cookies.get('session')?.value
  if (sessionCookie) {
    try {
      const session = verifySession(sessionCookie)
      if (session) {
        await writeAudit({
          propertyId: null,
          actor: formatActor({ type: 'user', userId: session.userId }),
          entityType: 'Session',
          entityId: session.userId,
          action: AUDIT_ACTIONS.sessionEnd,
          diff: { workspaceId: session.workspaceId },
        })
      }
    } catch {
      // Tampered/expired cookie OR misconfigured HMAC_KEY — both treated as
      // no session. Logout stays best-effort and still clears the cookie.
    }
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('session', '', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
  })

  return response
}
