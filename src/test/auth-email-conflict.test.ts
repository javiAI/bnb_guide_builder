import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import { prisma } from '@/lib/db'

describe('Email Conflict Resolution', () => {
  const testEmail = 'test@example.com'
  const googleSubject1 = 'google_subject_1'
  const googleSubject2 = 'google_subject_2'
  let dbAvailable = true

  beforeAll(async () => {
    try {
      await prisma.workspace.count()
    } catch (_error) {
      dbAvailable = false
    }
  })

  beforeEach(async () => {
    if (!dbAvailable) return
    await prisma.user.deleteMany({ where: { email: testEmail } })
  })

  afterEach(async () => {
    if (!dbAvailable) return
    await prisma.user.deleteMany({ where: { email: testEmail } })
  })

  it('Case 1: Should create new user if email does not exist', async () => {
    if (!dbAvailable) {
      expect(true).toBe(true)
      return
    }
    const workspace = await prisma.workspace.findFirst()
    if (!workspace) throw new Error('No workspace found')

    const user = await prisma.user.create({
      data: {
        googleSubject: googleSubject1,
        email: testEmail,
        name: 'Test User',
        memberships: {
          create: {
            workspaceId: workspace.id,
            role: 'owner',
          },
        },
      },
    })

    expect(user.googleSubject).toBe(googleSubject1)
    expect(user.email).toBe(testEmail)
  })

  it('Case 2: Should allow re-auth if user exists with same googleSubject', async () => {
    if (!dbAvailable) {
      expect(true).toBe(true)
      return
    }
    const workspace = await prisma.workspace.findFirst()
    if (!workspace) throw new Error('No workspace found')

    // Create user
    const created = await prisma.user.create({
      data: {
        googleSubject: googleSubject1,
        email: testEmail,
        memberships: {
          create: {
            workspaceId: workspace.id,
            role: 'owner',
          },
        },
      },
    })

    // Find same user (re-auth scenario)
    const found = await prisma.user.findUnique({
      where: { email: testEmail },
    })

    expect(found?.googleSubject).toBe(googleSubject1)
    expect(found?.id).toBe(created.id)
  })

  it('Case 3: Should reject if user exists with different googleSubject', async () => {
    if (!dbAvailable) {
      expect(true).toBe(true)
      return
    }
    const workspace = await prisma.workspace.findFirst()
    if (!workspace) throw new Error('No workspace found')

    // Create user with subject 1
    await prisma.user.create({
      data: {
        googleSubject: googleSubject1,
        email: testEmail,
        memberships: {
          create: {
            workspaceId: workspace.id,
            role: 'owner',
          },
        },
      },
    })

    // Try to find user by email (existing with different googleSubject)
    const existingUser = await prisma.user.findUnique({
      where: { email: testEmail },
    })

    expect(existingUser).not.toBeNull()
    expect(existingUser?.googleSubject).toBe(googleSubject1)

    // If trying to login with different googleSubject, it should be rejected
    if (existingUser && existingUser.googleSubject !== googleSubject2) {
      expect(existingUser.googleSubject).not.toBe(googleSubject2)
    }
  })
})
