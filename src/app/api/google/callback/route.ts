import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOAuthClient } from '@/lib/google';
import {
  grantAnalyticsAccess,
  grantSearchConsoleAccess,
  grantTagManagerAccess,
  grantAdsAccess,
  grantBusinessProfileAccess,
} from '@/lib/google';

// state param is the client token
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

  const client = await prisma.client.findUnique({
    where: { token: state },
    include: { services: true },
  });

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

  const accessToken = tokens.access_token ?? '';
  const refreshToken = tokens.refresh_token ?? '';
  const agencyEmail = process.env.AGENCY_GOOGLE_EMAIL ?? '';
  const adsManagerId = process.env.GOOGLE_ADS_MANAGER_ID ?? '';

  const requestedServices = new Set(client.services.map(s => s.service));

  // Process each service in parallel, capture results per service
  const results = await Promise.allSettled([
    requestedServices.has('GOOGLE_ANALYTICS')
      ? grantAnalyticsAccess(accessToken, refreshToken, agencyEmail).then(r => ({ service: 'GOOGLE_ANALYTICS', results: r }))
      : Promise.resolve(null),
    requestedServices.has('GOOGLE_SEARCH_CONSOLE')
      ? grantSearchConsoleAccess(accessToken, refreshToken, agencyEmail).then(r => ({ service: 'GOOGLE_SEARCH_CONSOLE', results: r }))
      : Promise.resolve(null),
    requestedServices.has('GOOGLE_TAG_MANAGER')
      ? grantTagManagerAccess(accessToken, refreshToken, agencyEmail).then(r => ({ service: 'GOOGLE_TAG_MANAGER', results: r }))
      : Promise.resolve(null),
    requestedServices.has('GOOGLE_ADS')
      ? grantAdsAccess(accessToken, refreshToken, adsManagerId).then(r => ({ service: 'GOOGLE_ADS', results: r }))
      : Promise.resolve(null),
    requestedServices.has('GOOGLE_BUSINESS_PROFILE')
      ? grantBusinessProfileAccess(accessToken, refreshToken, agencyEmail).then(r => ({ service: 'GOOGLE_BUSINESS_PROFILE', results: r }))
      : Promise.resolve(null),
  ]);

  // Update each service record based on outcome
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      const { service, results: serviceResults } = result.value;
      if (serviceResults.length > 0) {
        await prisma.serviceAccess.update({
          where: { clientId_service: { clientId: client.id, service: service as any } },
          data: {
            status: service === 'GOOGLE_ADS' ? 'INVITED' : 'CONNECTED',
            resourceId: serviceResults[0].resourceId,
            resourceName: serviceResults.map(r => r.resourceName).join(', '),
          },
        });
      } else {
        // Service was requested but client has no resources under it
        await prisma.serviceAccess.update({
          where: { clientId_service: { clientId: client.id, service: service as any } },
          data: { status: 'NOT_APPLICABLE', errorMessage: 'No accessible properties found' },
        });
      }
    } else if (result.status === 'rejected') {
      // We can't easily know which service threw here, so we log it
      console.error('Service grant failed:', result.reason);
    }
  }

  // Mark client as completed
  await prisma.client.update({
    where: { id: client.id },
    data: { completedAt: new Date() },
  });

  return NextResponse.redirect(
    new URL(`/connect/${state}?success=true`, req.url)
  );
}
