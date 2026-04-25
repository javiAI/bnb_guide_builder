import { prisma } from '@/lib/db'

async function main() {
  console.log('🌱 Seeding dev user + workspace...')

  // Check if dev user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: 'dev@localhost' },
  })

  if (existingUser) {
    console.log('✓ Dev user already exists, skipping seed')
    return
  }

  // Create or find default workspace
  let workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: 'asc' },
  })

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'Dev Workspace',
      },
    })
    console.log('✓ Created dev workspace:', workspace.id)
  } else {
    console.log('✓ Using existing workspace:', workspace.id)
  }

  // Create dev user
  const user = await prisma.user.create({
    data: {
      googleSubject: 'dev_google_subject_123',
      email: 'dev@localhost',
      name: 'Dev User',
      memberships: {
        create: {
          workspaceId: workspace.id,
          role: 'owner',
        },
      },
    },
  })

  console.log('✓ Created dev user:', user.id)
  console.log('\n✅ Seed complete!')
  console.log('\nDev credentials:')
  console.log('  Email: dev@localhost')
  console.log('  Google Subject: dev_google_subject_123')
  console.log('  Workspace: ' + workspace.id)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
