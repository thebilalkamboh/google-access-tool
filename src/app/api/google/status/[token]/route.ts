import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUrl } from '@/lib/google';

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const client = await prisma.client.findUnique({
    where: { token: params.token },
    include: { services: true },
  });
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const authUrl = getAuthUrl(params.token);
  return NextResponse.json({ client, authUrl });
}
