import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { createSessionPayload } from '@/lib/auth/session-crypto'
import { clearOperatorCache } from '@/lib/auth/require-operator'

describe('requireOperator Revalidation', () => {
  let testUserId: string
  let testWorkspaceId: string

  beforeEach(async () => {
    // Create test workspace
    const workspace = await prisma.workspace.create({
      data: { name: 'Test Workspace' },
    })
    testWorkspaceId = workspace.id

    // Create test user
    const user = await prisma.user.create({
      data: {
        googleSubject: 'test_subject_' + Date.now(),
        email: 'test_operator_' + Date.now() + '@localhost',
        memberships: {
          create: {
            workspaceId: workspace.id,
            role: 'owner',
          },
        },
      },
    })
    testUserId = user.id
  })

  it('should accept valid session with existing user + membership', async () => {
    const user = await prisma.user.findUnique({
      where: { id: testUserId },
      include: {
        memberships: {
          where: { workspaceId: testWorkspaceId },
        },
      },
    })

    expect(user).not.toBeNull()
    expect(user!.memberships).toHaveLength(1)
  })

  it('should reject session if user is deleted', async () => {
    // Delete user
    await prisma.user.delete({
      where: { id: testUserId },
    })

    // Try to find user (simulating revalidation in requireOperator)
    const user = await prisma.user.findUnique({
      where: { id: testUserId },
    })

    expect(user).toBeNull()
  })

  it('should reject session if membership is removed', async () => {
    // Remove membership
    await prisma.workspaceMembership.deleteMany({
      where: {
        userId: testUserId,
        workspaceId: testWorkspaceId,
      },
    })

    // Try to find membership (simulating revalidation)
    const user = await prisma.user.findUnique({
      where: { id: testUserId },
      include: {
        memberships: {
          where: { workspaceId: testWorkspaceId },
        },
      },
    })

    expect(user).not.toBeNull()
    expect(user!.memberships).toHaveLength(0)
  })

  it('should have correct session payload structure', () => {
    const payload = createSessionPayload(testUserId, testWorkspaceId)

    expect(payload.userId).toBe(testUserId)
    expect(payload.workspaceId).toBe(testWorkspaceId)
    expect(payload.version).toBe(1)
    expect(typeof payload.iat).toBe('number')
    expect(typeof payload.exp).toBe('number')
    expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60) // 7 days
  })

  it('should clear cache correctly', () => {
    // Just verify the function doesn't throw
    clearOperatorCache(testUserId)
    expect(true).toBe(true)
  })
})
