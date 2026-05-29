'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NewClientModal from './NewClientModal';

const SERVICE_LABELS: Record<string, string> = {
  GOOGLE_ANALYTICS: 'Analytics',
  GOOGLE_SEARCH_CONSOLE: 'Search Console',
  GOOGLE_ADS: 'Ads',
  GOOGLE_TAG_MANAGER: 'Tag Manager',
  GOOGLE_BUSINESS_PROFILE: 'Business Profile',
};

const STATUS_DOT: Record<string, string> = {
  PENDING: 'bg-yellow-400',
  CONNECTED: 'bg-green-500',
  INVITED: 'bg-blue-400',
  FAILED: 'bg-red-400',
  NOT_APPLICABLE: 'bg-gray-300',
};

interface ServiceAccess {
  service: string;
  status: string;
  resourceName?: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  token: string;
  createdAt: string;
  completedAt: string | null;
  services: ServiceAccess[];
}

export default function DashboardClient({
  initialClients,
  userName,
}: {
  initialClients: Client[];
  userName: string;
}) {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyLink(token: string, id: string) {
    const url = `${window.location.origin}/connect/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function deleteClient(id: string) {
    if (!confirm('Remove this client and all their access records?')) return;
    await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    setClients(c => c.filter(x => x.id !== id));
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  function onClientCreated(client: Client) {
    setClients(c => [client, ...c]);
    setShowModal(false);
  }

  const total = clients.length;
  const connected = clients.filter(c => c.completedAt).length;
  const pending = total - connected;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">G</div>
          <span className="font-semibold text-gray-900">Google Access Tool</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{userName}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-900 transition"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total clients', value: total },
            { label: 'Access granted', value: connected },
            { label: 'Pending', value: pending },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Clients</h2>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            + New request
          </button>
        </div>

        {/* Client table */}
        {clients.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-400 text-sm">No clients yet. Create your first access request.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Client</th>
                  <th className="text-left px-5 py-3 font-medium">Services</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map(client => (
                  <tr key={client.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{client.name}</p>
                      <p className="text-gray-400 text-xs">{client.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {client.services.map(svc => (
                          <span key={svc.service} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[svc.status] ?? 'bg-gray-300'}`} />
                            {SERVICE_LABELS[svc.service] ?? svc.service}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {client.completedAt ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                          Awaiting client
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {new Date(client.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => copyLink(client.token, client.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
                        >
                          {copiedId === client.id ? '✓ Copied' : 'Copy link'}
                        </button>
                        <button
                          onClick={() => deleteClient(client.id)}
                          className="text-xs text-gray-400 hover:text-red-500 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showModal && (
        <NewClientModal onClose={() => setShowModal(false)} onCreated={onClientCreated} />
      )}
    </div>
  );
}
