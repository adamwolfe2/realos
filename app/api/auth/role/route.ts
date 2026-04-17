import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ role: null }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  }).catch(() => null)

  return NextResponse.json({ role: user?.role ?? null })
}
