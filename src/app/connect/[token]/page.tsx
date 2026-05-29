'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

const SERVICE_META: Record<string, { label: string; icon: string; description: string }> = {
  GOOGLE_ANALYTICS: {
    label: 'Google Analytics',
    icon: '📊',
    description: 'View website traffic, audience data and conversion reports',
  },
  GOOGLE_SEARCH_CONSOLE: {
    label: 'Google Search Console',
    icon: '🔍',
    description: 'Monitor search performance and fix indexing issues',
  },
  GOOGLE_ADS: {
    label: 'Google Ads',
    icon: '📢',
    description: 'Manage and optimise your paid search campaigns',
  },
  GOOGLE_TAG_MANAGER: {
    label: 'Google Tag Manager',
    icon: '🏷️',
    description: 'Manage tracking tags and scripts without code changes',
  },
  GOOGLE_BUSINESS_PROFILE: {
    label: 'Google Business Profile',
    icon: '🏢',
    description: 'Manage your business listing on Google Maps and Search',
  },
};

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  PENDING: { label: 'Pending', class: 'bg-yellow-100 text-yellow-800' },
  CONNECTED: { label: 'Connected ✓', class: 'bg-green-100 text-green-800' },
  INVITED: { label: 'Invite sent', class: 'bg-blue-100 text-blue-800' },
  FAILED: { label: 'Failed', class: 'bg-red-100 text-red-800' },
  NOT_APPLICABLE: { label: 'No properties', class: 'bg-gray-100 text-gray-600' },
};

interface ServiceAccess { service: string; status: string; resourceName?: string; }
interface ClientData { name: string; completedAt: string | null; services: ServiceAccess[]; }
interface PropertyOption { id: string; name: string; }

export default function ConnectPage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const step = searchParams.get('step');
  const errorParam = searchParams.get('error');

  const [clientData, setClientData] = useState<{ client: ClientData; authUrl: string } | null>(null);
  const [properties, setProperties] = useState<Record<string, PropertyOption[]> | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState(false);
  const [granted, setGranted] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/google/status/${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { setNotFound(true); setLoading(false); return; }
        setClientData(d);
        if (step === 'select') {
          // Fetch available properties
          fetch(`/api/google/properties/${token}`)
            .then(r => r.json())
            .then(p => {
              setProperties(p);
              setLoading(false);
            });
        } else {
          setLoading(false);
        }
      });
  }, [token, step]);

  async function handleGrant() {
    setGranting(true);
    const res = await fetch(`/api/google/grant/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selections),
    });
    if (res.ok) {
      setGranted(true);
      // Refresh client data
      const d = await fetch(`/api/google/status/${token}`).then(r => r.json());
      setClientData(d);
    }
    setGranting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-500">{step === 'select' ? 'Loading your Google properties…' : 'Loading…'}</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl mb-2">❌</p>
          <h1 className="text-xl font-semibold text-gray-900">Invalid link</h1>
          <p className="text-gray-500 mt-1 text-sm">This access request link is not valid or has expired.</p>
        </div>
      </div>
    );
  }

  const { client, authUrl } = clientData!;
  const alreadyCompleted = !!client.completedAt;

  // ── Step 2: Property Selection ────────────────────────────────────────────
  if (step === 'select' && !granted && !alreadyCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white text-2xl mb-4">G</div>
            <h1 className="text-2xl font-bold text-gray-900">Select Your Properties</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Choose which account or property to grant access to for each service.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Prepared for</p>
            <p className="text-lg font-semibold text-gray-900">{client.name}</p>
          </div>

          <div className="space-y-3 mb-6">
            {client.services.map(svc => {
              const meta = SERVICE_META[svc.service];
              const options = properties?.[svc.service] ?? [];
              return (
                <div key={svc.service} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{meta.icon}</span>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{meta.label}</p>
                      <p className="text-gray-400 text-xs">{meta.description}</p>
                    </div>
                  </div>
                  {options.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-400">
                      No properties found under your Google account for this service.
                    </div>
                  ) : (
                    <select
                      value={selections[svc.service] ?? ''}
                      onChange={e => setSelections(prev => ({ ...prev, [svc.service]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">— Select {meta.label} property —</option>
                      {options.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleGrant}
            disabled={granting || Object.keys(selections).length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-sm"
          >
            {granting ? 'Granting access…' : 'Grant Access'}
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            Only the properties you select above will be shared. You can revoke access at any time in your Google Account settings.
          </p>
        </div>
      </div>
    );
  }

  // ── Step 3: Success ───────────────────────────────────────────────────────
  if (granted || alreadyCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500 text-white text-2xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-gray-900">Access Granted!</h1>
            <p className="text-gray-500 mt-1 text-sm">Your agency now has access to the properties below.</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-6">
            {client.services.map(svc => {
              const meta = SERVICE_META[svc.service];
              const badge = STATUS_BADGE[svc.status] ?? STATUS_BADGE.PENDING;
              return (
                <div key={svc.service} className="flex items-start gap-4 p-4">
                  <span className="text-2xl">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-gray-900 text-sm">{meta.label}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${badge.class}`}>
                        {badge.label}
                      </span>
                    </div>
                    {svc.resourceName && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">🔗 {svc.resourceName}</p>
                    )}
                    {svc.service === 'GOOGLE_ADS' && svc.status === 'INVITED' && (
                      <p className="text-xs text-blue-600 mt-1">Check your email to accept the Google Ads manager invitation.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Landing page ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white text-2xl mb-4">G</div>
          <h1 className="text-2xl font-bold text-gray-900">Google Access Request</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Your marketing agency is requesting access to your Google properties.
          </p>
        </div>

        {errorParam && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-red-700 font-medium">Something went wrong</p>
            <p className="text-red-600 text-sm mt-1">
              {errorParam === 'access_denied' ? 'You cancelled the authorisation.' : 'Could not complete the connection. Please try again.'}
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Prepared for</p>
          <p className="text-lg font-semibold text-gray-900">{client.name}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100 mb-6">
          {client.services.map(svc => {
            const meta = SERVICE_META[svc.service] ?? { label: svc.service, icon: '⚙️', description: '' };
            return (
              <div key={svc.service} className="flex items-center gap-4 p-4">
                <span className="text-2xl">{meta.icon}</span>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{meta.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{meta.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <a
          href={authUrl}
          className="flex items-center justify-center gap-3 w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition text-sm shadow-sm"
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Connect with Google
        </a>
        <p className="text-center text-xs text-gray-400 mt-3">
          You will be redirected to Google to sign in. You can revoke access at any time in your Google Account settings.
        </p>
      </div>
    </div>
  );
}
