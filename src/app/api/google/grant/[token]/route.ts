import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';
import { getOAuthClient } from '@/lib/google';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const client = await prisma.client.findUnique({ where: { token }, include: { services: true } });
  if (!client || !client.accessToken) {
    return NextResponse.json({ error: 'Not found or not authenticated' }, { status: 404 });
  }

  // selections: { GOOGLE_ANALYTICS: propertyId, GOOGLE_SEARCH_CONSOLE: siteUrl, ... }
  const selections: Record<string, string> = await req.json();
  const agencyEmail = process.env.AGENCY_GOOGLE_EMAIL ?? '';
  const auth = getOAuthClient();
  auth.setCredentials({
    access_token: client.accessToken,
    refresh_token: client.refreshToken ?? undefined,
  });

  const updates: Record<string, { status: string; resourceId?: string; resourceName?: string; errorMessage?: string }> = {};

  // ── Google Analytics ──────────────────────────────────────────────────────
  if (selections.GOOGLE_ANALYTICS) {
    try {
      const analyticsAdmin = google.analyticsadmin({ version: 'v1alpha' as any, auth }) as any;
      await analyticsAdmin.properties.accessBindings.create({
        parent: selections.GOOGLE_ANALYTICS,
        requestBody: { user: agencyEmail, roles: ['roles/analyst'] },
      });
      updates.GOOGLE_ANALYTICS = {
        status: 'CONNECTED',
        resourceId: selections.GOOGLE_ANALYTICS,
        resourceName: selections.GOOGLE_ANALYTICS,
      };
    } catch (e: any) {
      updates.GOOGLE_ANALYTICS = { status: 'FAILED', errorMessage: e.message };
    }
  }

  // ── Search Console ────────────────────────────────────────────────────────
  if (selections.GOOGLE_SEARCH_CONSOLE) {
    try {
      const encodedUrl = encodeURIComponent(selections.GOOGLE_SEARCH_CONSOLE);
      const res = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodedUrl}/permissions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ permissionLevel: 'siteFullUser', email: agencyEmail }),
        }
      );
      updates.GOOGLE_SEARCH_CONSOLE = res.ok
        ? { status: 'CONNECTED', resourceId: selections.GOOGLE_SEARCH_CONSOLE, resourceName: selections.GOOGLE_SEARCH_CONSOLE }
        : { status: 'FAILED', errorMessage: await res.text() };
    } catch (e: any) {
      updates.GOOGLE_SEARCH_CONSOLE = { status: 'FAILED', errorMessage: e.message };
    }
  }

  // ── Tag Manager ───────────────────────────────────────────────────────────
  if (selections.GOOGLE_TAG_MANAGER) {
    try {
      const tagmanager = google.tagmanager({ version: 'v2', auth }) as any;
      // selections.GOOGLE_TAG_MANAGER is the account path
      await tagmanager.accounts.user_permissions.create({
        parent: selections.GOOGLE_TAG_MANAGER,
        requestBody: {
          emailAddress: agencyEmail,
          accountAccess: { permission: 'editContainers' },
        },
      });
      updates.GOOGLE_TAG_MANAGER = {
        status: 'CONNECTED',
        resourceId: selections.GOOGLE_TAG_MANAGER,
        resourceName: selections.GOOGLE_TAG_MANAGER,
      };
    } catch (e: any) {
      updates.GOOGLE_TAG_MANAGER = { status: 'FAILED', errorMessage: e.message };
    }
  }

  // ── Google Ads ────────────────────────────────────────────────────────────
  if (selections.GOOGLE_ADS) {
    try {
      const managerCustomerId = process.env.GOOGLE_ADS_MANAGER_ID ?? '';
      const res = await fetch(
        `https://googleads.googleapis.com/v17/customers/${managerCustomerId}/customerManagerLinks:mutate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
            'Content-Type': 'application/json',
            'login-customer-id': managerCustomerId,
          },
          body: JSON.stringify({
            operations: [{ create: { clientCustomer: `customers/${selections.GOOGLE_ADS}` } }],
          }),
        }
      );
      updates.GOOGLE_ADS = res.ok
        ? { status: 'INVITED', resourceId: selections.GOOGLE_ADS, resourceName: `Account ${selections.GOOGLE_ADS}` }
        : { status: 'FAILED', errorMessage: await res.text() };
    } catch (e: any) {
      updates.GOOGLE_ADS = { status: 'FAILED', errorMessage: e.message };
    }
  }

  // ── Business Profile ──────────────────────────────────────────────────────
  if (selections.GOOGLE_BUSINESS_PROFILE) {
    try {
      const res = await fetch(
        `https://mybusinessaccountmanagement.googleapis.com/v1/${selections.GOOGLE_BUSINESS_PROFILE}/admins`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admin: { email: agencyEmail, role: 'MANAGER' } }),
        }
      );
      updates.GOOGLE_BUSINESS_PROFILE = res.ok
        ? { status: 'CONNECTED', resourceId: selections.GOOGLE_BUSINESS_PROFILE, resourceName: selections.GOOGLE_BUSINESS_PROFILE }
        : { status: 'FAILED', errorMessage: await res.text() };
    } catch (e: any) {
      updates.GOOGLE_BUSINESS_PROFILE = { status: 'FAILED', errorMessage: e.message };
    }
  }

  // Persist all updates
  for (const [service, data] of Object.entries(updates)) {
    await prisma.serviceAccess.updateMany({
      where: { clientId: client.id, service },
      data: {
        status: data.status,
        resourceId: data.resourceId,
        resourceName: data.resourceName,
        errorMessage: data.errorMessage,
      },
    });
  }

  // Mark client completed
  await prisma.client.update({
    where: { id: client.id },
    data: { completedAt: new Date() },
  });

  return NextResponse.json({ ok: true, updates });
}
