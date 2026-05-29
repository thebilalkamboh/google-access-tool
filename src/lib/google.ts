import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/tagmanager.manage.accounts',
  'https://www.googleapis.com/auth/analytics.manage.users',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/google/callback`
  );
}

export function getAuthUrl(state: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
}

// ── Analytics: add agency as editor ──────────────────────────────────────────

export async function grantAnalyticsAccess(
  accessToken: string,
  refreshToken: string,
  agencyEmail: string
): Promise<{ resourceId: string; resourceName: string }[]> {
  const auth = getOAuthClient();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth });
  const { data } = await analyticsAdmin.accounts.list();
  const results: { resourceId: string; resourceName: string }[] = [];

  for (const account of data.accounts ?? []) {
    const propertiesRes = await analyticsAdmin.properties.list({
      filter: `parent:${account.name}`,
    });
    for (const property of propertiesRes.data.properties ?? []) {
      await analyticsAdmin.properties.userLinks.create({
        parent: property.name!,
        requestBody: {
          emailAddress: agencyEmail,
          directRoles: ['predefinedRoles/editor'],
        },
      });
      results.push({
        resourceId: property.name!,
        resourceName: property.displayName ?? property.name!,
      });
    }
  }
  return results;
}

// ── Search Console: add agency as full user ───────────────────────────────────

export async function grantSearchConsoleAccess(
  accessToken: string,
  refreshToken: string,
  agencyEmail: string
): Promise<{ resourceId: string; resourceName: string }[]> {
  const auth = getOAuthClient();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const webmasters = google.webmasters({ version: 'v3', auth });
  const { data } = await webmasters.sites.list();
  const results: { resourceId: string; resourceName: string }[] = [];

  for (const site of data.siteEntry ?? []) {
    if (site.permissionLevel === 'siteOwner' || site.permissionLevel === 'siteFullUser') {
      await webmasters.sitePermissions.add({
        siteUrl: site.siteUrl!,
        requestBody: {
          permissionLevel: 'siteFullUser',
          email: agencyEmail,
        },
      } as any);
      results.push({ resourceId: site.siteUrl!, resourceName: site.siteUrl! });
    }
  }
  return results;
}

// ── Tag Manager: add agency as editor ────────────────────────────────────────

export async function grantTagManagerAccess(
  accessToken: string,
  refreshToken: string,
  agencyEmail: string
): Promise<{ resourceId: string; resourceName: string }[]> {
  const auth = getOAuthClient();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const tagmanager = google.tagmanager({ version: 'v2', auth });
  const { data } = await tagmanager.accounts.list();
  const results: { resourceId: string; resourceName: string }[] = [];

  for (const account of data.account ?? []) {
    await tagmanager.accounts.user_permissions.create({
      parent: account.path!,
      requestBody: {
        emailAddress: agencyEmail,
        accountAccess: { permission: 'editContainers' },
      },
    });
    results.push({ resourceId: account.accountId!, resourceName: account.name! });
  }
  return results;
}

// ── Google Ads: send manager account link invitation ─────────────────────────
// Note: Ads uses a different API (REST) and requires your Google Ads manager
// customer ID (MCC). This sends a link invitation — the client accepts via email.

export async function grantAdsAccess(
  accessToken: string,
  _refreshToken: string,
  managerCustomerId: string
): Promise<{ resourceId: string; resourceName: string }[]> {
  // The Google Ads API requires the google-ads-api client or direct REST calls.
  // We use the REST endpoint here since the googleapis package doesn't fully
  // cover Google Ads link invitations.
  const customersRes = await fetch(
    'https://googleads.googleapis.com/v17/customers:listAccessibleCustomers',
    { headers: { Authorization: `Bearer ${accessToken}`, 'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '' } }
  );
  if (!customersRes.ok) throw new Error('Could not list Google Ads customers');
  const { resourceNames } = await customersRes.json();
  const results: { resourceId: string; resourceName: string }[] = [];

  for (const resourceName of resourceNames ?? []) {
    const customerId = resourceName.replace('customers/', '');
    // Create client link invitation from your MCC to this customer
    const linkRes = await fetch(
      `https://googleads.googleapis.com/v17/customers/${managerCustomerId}/customerManagerLinks:mutate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
          'Content-Type': 'application/json',
          'login-customer-id': managerCustomerId,
        },
        body: JSON.stringify({
          operations: [{
            create: {
              clientCustomer: `customers/${customerId}`,
              managerLinkId: null,
            },
          }],
        }),
      }
    );
    if (linkRes.ok) {
      results.push({ resourceId: customerId, resourceName: `Customer ${customerId}` });
    }
  }
  return results;
}

// ── Google Business Profile: add agency as manager ───────────────────────────

export async function grantBusinessProfileAccess(
  accessToken: string,
  refreshToken: string,
  agencyEmail: string
): Promise<{ resourceId: string; resourceName: string }[]> {
  const auth = getOAuthClient();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  // Business Profile uses the My Business Account Management API
  const accountsRes = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!accountsRes.ok) throw new Error('Could not list Business Profile accounts');
  const { accounts } = await accountsRes.json();
  const results: { resourceId: string; resourceName: string }[] = [];

  for (const account of accounts ?? []) {
    const inviteRes = await fetch(
      `https://mybusinessaccountmanagement.googleapis.com/v1/${account.name}/admins`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin: { email: agencyEmail, role: 'MANAGER' },
        }),
      }
    );
    if (inviteRes.ok) {
      results.push({ resourceId: account.name, resourceName: account.accountName });
    }
  }
  return results;
}
