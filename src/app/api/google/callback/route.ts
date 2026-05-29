import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOAuthClient } from '@/lib/google';

export async function GET(req: NextRequest, _ctx?: unknown) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // client token
  const error = searchParams.get('error');

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL(`/connect/${state}?error=access_denied`, req.url)
    );
  }

  const client = await prisma.client.findUnique({ where: { token: state } });
  if (!client) {
    return NextResponse.redirect(new URL('/connect/invalid', req.url));
  }

  // Exchange code for tokens
  const oauth = getOAuthClient();
  let tokens: { access_token?: string | null; refresh_token?: string | null };
  try {
    const { tokens: t } = await oauth.getToken(code);
    tokens = t;
  } catch {
    return NextResponse.redirect(
      new URL(`/connect/${state}?error=token_exchange_failed`, req.url)
    );
  }

  // Store tokens on the client record so the selection page can use them
  await prisma.client.update({
    where: { id: client.id },
    data: {
      accessToken: tokens.access_token ?? null,
      refreshToken: tokens.refresh_token ?? null,
    },
  });

  // Redirect to the property selection step
  return NextResponse.redirect(
    new URL(`/connect/${state}?step=select`, req.url)
  );
}
