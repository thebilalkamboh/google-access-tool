import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';
import { getOAuthClient } from '@/lib/google';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const client = await prisma.client.findUnique({ where: { token }, include: { services: true } });
  if (!client || !client.accessToken) {
    return NextResponse.json({ error: 'Not found or not authenticated' }, { status: 404 });
  }

  const auth = getOAuthClient();
  auth.setCredentials({
    access_token: client.accessToken,
    refresh_token: client.refreshToken ?? undefined,
  });

  const requestedServices = new Set(client.services.map(s => s.service));
  const result: Record<string, any[]> = {};

  // ── Google Analytics ──────────────────────────────────────────────────────
  if (requestedServices.has('GOOGLE_ANALYTICS')) {
    try {
      // Use REST directly to avoid googleapis type issues
      const gaRes = await fetch(
        'https://analyticsadmin.googleapis.com/v1alpha/accounts',
        { headers: { Authorization: `Bearer ${client.accessToken}` } }
      );
      const gaData = await gaRes.json();
      const properties: any[] = [];
      for (const account of gaData.accounts ?? []) {
        const propsRes = await fetch(
          `https://analyticsadmin.googleapis.com/v1alpha/properties?filter=parent:${account.name}`,
          { headers: { Authorization: `Bearer ${client.accessToken}` } }
        );
        const propsData = await propsRes.json();
        for (const property of propsData.properties ?? []) {
          properties.push({
            id: property.name,
            name: `${property.displayName} (${account.displayName})`,
          });
        }
      }
      result.GOOGLE_ANALYTICS = properties;
      if (!gaRes.ok) result._errors = { ...result._errors, GOOGLE_ANALYTICS: JSON.stringify(gaData) };
    } catch (e: any) {
      result.GOOGLE_ANALYTICS = [];
      result._errors = { ...result._errors, GOOGLE_ANALYTICS: e.message };
    }
  }

  // ── Search Console ────────────────────────────────────────────────────────
  if (requestedServices.has('GOOGLE_SEARCH_CONSOLE')) {
    try {
      const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${client.accessToken}` },
      });
      const sitesData = await sitesRes.json();
      result.GOOGLE_SEARCH_CONSOLE = (sitesData.siteEntry ?? []).map((s: any) => ({
        id: s.siteUrl,
        name: s.siteUrl,
      }));
    } catch (e: any) {
      result.GOOGLE_SEARCH_CONSOLE = [];
      result._errors = { ...result._errors, GOOGLE_SEARCH_CONSOLE: e.message };
    }
  }

  // ── Google Ads ────────────────────────────────────────────────────────────
  if (requestedServices.has('GOOGLE_ADS')) {
    try {
      const adsRes = await fetch(
        'https://googleads.googleapis.com/v17/customers:listAccessibleCustomers',
        {
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
          },
        }
      );
      if (adsRes.ok) {
        const adsData = await adsRes.json();
        result.GOOGLE_ADS = (adsData.resourceNames ?? []).map((r: string) => ({
          id: r.replace('customers/', ''),
          name: `Account ${r.replace('customers/', '')}`,
        }));
      } else {
        const errText = await adsRes.text();
        result.GOOGLE_ADS = [];
        result._errors = { ...result._errors, GOOGLE_ADS: errText };
      }
    } catch (e: any) {
      result.GOOGLE_ADS = [];
      result._errors = { ...result._errors, GOOGLE_ADS: e.message };
    }
  }

  // ── Tag Manager ───────────────────────────────────────────────────────────
  if (requestedServices.has('GOOGLE_TAG_MANAGER')) {
    try {
      const tagmanager = google.tagmanager({ version: 'v2', auth }) as any;
      const accountsRes = await tagmanager.accounts.list();
      const containers: any[] = [];
      for (const account of accountsRes.data.account ?? []) {
        const containersRes = await tagmanager.accounts.containers.list({
          parent: account.path,
        });
        for (const container of containersRes.data.container ?? []) {
          containers.push({
            id: container.path,
            name: `${container.name} (${account.name})`,
            accountId: account.accountId,
            accountPath: account.path,
          });
        }
      }
      result.GOOGLE_TAG_MANAGER = containers;
    } catch (e: any) {
      result.GOOGLE_TAG_MANAGER = [];
      result._errors = { ...result._errors, GOOGLE_TAG_MANAGER: e.message };
    }
  }

  // ── Business Profile ──────────────────────────────────────────────────────
  if (requestedServices.has('GOOGLE_BUSINESS_PROFILE')) {
    try {
      const accountsRes = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        { headers: { Authorization: `Bearer ${client.accessToken}` } }
      );
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        result.GOOGLE_BUSINESS_PROFILE = (accountsData.accounts ?? []).map((a: any) => ({
          id: a.name,
          name: a.accountName,
        }));
      } else {
        const errText = await accountsRes.text();
        result.GOOGLE_BUSINESS_PROFILE = [];
        result._errors = { ...result._errors, GOOGLE_BUSINESS_PROFILE: errText };
      }
    } catch (e: any) {
      result.GOOGLE_BUSINESS_PROFILE = [];
      result._errors = { ...result._errors, GOOGLE_BUSINESS_PROFILE: e.message };
    }
  }

  return NextResponse.json(result);
}
