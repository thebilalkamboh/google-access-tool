# Google Access Tool — Setup Guide

## 1. Install Node.js
Download from https://nodejs.org (LTS version). Restart your terminal after installing.

## 2. Install dependencies
```
cd "D:\Click Track Marketing\google-access-tool"
npm install
```

## 3. Set up the database
```
npm run db:push
npm run db:seed
```

## 4. Configure Google OAuth

### Create a Google Cloud project
1. Go to https://console.cloud.google.com
2. Create a new project (e.g. "Google Access Tool")
3. Go to **APIs & Services → Library** and enable:
   - Google Analytics Admin API
   - Google Search Console API
   - Tag Manager API
   - My Business Account Management API
   - Google Ads API
4. Go to **APIs & Services → OAuth consent screen**
   - Set to **External**, fill in app name and your email
   - Add scopes: all scopes listed in `src/lib/google.ts`
   - Add yourself as a test user while in development
5. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorised redirect URI: `http://localhost:3000/api/google/callback`
   - Copy the **Client ID** and **Client Secret**

### Edit .env.local
```
GOOGLE_CLIENT_ID=paste-your-client-id-here
GOOGLE_CLIENT_SECRET=paste-your-client-secret-here
AGENCY_GOOGLE_EMAIL=your-agency@gmail.com
JWT_SECRET=generate-a-long-random-string-here
```

For Google Ads (optional):
```
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GOOGLE_ADS_MANAGER_ID=your-mcc-customer-id-without-dashes
```

## 5. Run the app
```
npm run dev
```
Open http://localhost:3000

**Default login:** admin@clicktrackmarketing.com / admin123
(Change your password in `prisma/seed.ts` before running seed)

## 6. How to use

1. Sign in to the dashboard
2. Click **+ New request**, enter the client's name/email, select which Google services to request
3. Click **Create** — a unique link is generated
4. Click **Copy link** and send it to your client
5. Client opens the link, clicks **Connect with Google**, signs in, and approves
6. Dashboard updates to show **Connected** for each service
7. For Google Ads, the client will also receive a manager link invitation via email

## Deploying to production

- Change `DATABASE_URL` to a Postgres connection string (update `schema.prisma` provider to `postgresql`)
- Set `NEXTAUTH_URL` to your production domain
- Update the OAuth redirect URI in Google Cloud Console to your production URL
- Use a proper `JWT_SECRET` (32+ random characters)
- Deploy to Vercel, Railway, or any Node.js host
- 
