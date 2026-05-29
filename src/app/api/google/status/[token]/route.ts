import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUrl } from '@/lib/google';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await prisma.client.findUnique({
    where: { token },
    include: { services: true },
  });
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const authUrl = getAuthUrl(token);
  return NextResponse.json({ client, authUrl });
}
