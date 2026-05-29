import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clients = await prisma.client.findMany({
    where: { userId: session.userId },
    include: { services: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, email, services } = await req.json();
  if (!name || !email || !services?.length) {
    return NextResponse.json({ error: 'name, email and services are required' }, { status: 400 });
  }

  const token = nanoid(32);

  const client = await prisma.client.create({
    data: {
      name,
      email,
      token,
      userId: session.userId,
      services: {
        create: services.map((s: string) => ({ service: s, status: 'PENDING' })),
      },
    },
    include: { services: true },
  });

  return NextResponse.json(client);
}
