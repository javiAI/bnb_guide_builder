import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { decryptSession } from './session-crypto'

const SESSION_CACHE_TTL = 60 * 1000 // 60 seconds
const sessionCache = new Map<
  string,
  {
    data: OperatorContext
    cachedAt: number
  }
>()

export interface OperatorContext {
  userId: string
  workspaceId: string
  user: {
    id: string
    email: string
    name?: string | null
  }
  memberships: Array<{
    workspaceId: string
    role: string
  }>
}

export async function requireOperator(): Promise<OperatorContext> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) {
    throw new Error('Unauthorized: no session cookie')
  }

  const session = decryptSession(sessionCookie)

  if (!session) {
    throw new Error('Unauthorized: invalid or expired session')
  }

  // Check cache
  const cached = sessionCache.get(session.userId)
  if (cached && Date.now() - cached.cachedAt < SESSION_CACHE_TTL) {
    return cached.data
  }

  // Revalidate in DB
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      memberships: {
        where: { workspaceId: session.workspaceId },
        select: { workspaceId: true, role: true },
      },
    },
  })

  if (!user) {
    sessionCache.delete(session.userId)
    throw new Error('Unauthorized: user not found')
  }

  if (!user.memberships.length) {
    sessionCache.delete(session.userId)
    throw new Error('Forbidden: no membership in workspace')
  }

  const context: OperatorContext = {
    userId: session.userId,
    workspaceId: session.workspaceId,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    memberships: user.memberships,
  }

  // Cache result
  sessionCache.set(session.userId, {
    data: context,
    cachedAt: Date.now(),
  })

  return context
}

export function clearOperatorCache(userId: string): void {
  sessionCache.delete(userId)
}
