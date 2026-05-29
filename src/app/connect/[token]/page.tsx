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
  CONNECTED: { label: 'Connected', class: 'bg-green-100 text-green-800' },
  INVITED: { label: 'Invite sent', class: 'bg-blue-100 text-blue-800' },
  FAILED: { label: 'Failed', class: 'bg-red-100 text-red-800' },
  NOT_APPLICABLE: { label: 'No properties', class: 'bg-gray-100 text-gray-600' },
};

interface ServiceAccess {
  service: string;
  status: string;
  resourceName?: string;
  errorMessage?: string;
}

interface ClientData {
  name: string;
  completedAt: string | null;
  services: ServiceAccess[];
}

export default function ConnectPage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const success = searchParams.get('success') === 'true';
  const errorParam = searchParams.get('error');

  const [data, setData] = useState<{ client: ClientData; authUrl: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/google/status/${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) setNotFound(true);
        else setData(d);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
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

  const { client, authUrl } = data!;
  const alreadyConnected = !!client.completedAt;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white text-2xl mb-4">G</div>
          <h1 className="text-2xl font-bold text-gray-900">Google Access Request</h1>
          <p className="text-gray-500 mt-1">
            Your marketing agency is requesting access to your Google properties.
          </p>
        </div>

        {/* Success banner */}
        {(success || alreadyConnected) && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-green-700 font-medium">✅ Access granted successfully!</p>
            <p className="text-green-600 text-sm mt-1">Your agency now has access to the properties below.</p>
          </div>
        )}

        {/* Error banner */}
        {errorParam && !success && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-red-700 font-medium">Something went wrong</p>
            <p className="text-red-600 text-sm mt-1">
              {errorParam === 'access_denied' ? 'You cancelled the authorisation.' : 'Could not complete the connection. Please try again.'}
            </p>
          </div>
        )}

        {/* Client name */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Prepared for</p>
          <p className="text-lg font-semibold text-gray-900">{client.name}</p>
        </div>

        {/* Services list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100 mb-6">
          {client.services.map((svc) => {
            const meta = SERVICE_META[svc.service] ?? { label: svc.service, icon: '⚙️', description: '' };
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
                  <p className="text-gray-500 text-xs mt-0.5">{meta.description}</p>
                  {svc.resourceName && (
                    <p className="text-xs text-gray-400 mt-1 truncate">🔗 {svc.resourceName}</p>
                  )}
                  {svc.service === 'GOOGLE_ADS' && svc.status === 'INVITED' && (
                    <p className="text-xs text-blue-600 mt-1">Check your email to accept the Google Ads manager invitation.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        {!alreadyConnected && !success && (
          <>
            <a
              href={authUrl}
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold py-3 rounded-xl transition text-sm"
            >
              Connect with Google
            </a>
            <p className="text-center text-xs text-gray-400 mt-3">
              You will be redirected to Google to sign in and approve access. You can revoke access at any time in your Google Account settings.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
