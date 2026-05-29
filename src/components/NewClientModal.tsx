'use client';

import { useState } from 'react';

const ALL_SERVICES = [
  { id: 'GOOGLE_ANALYTICS', label: 'Google Analytics', icon: '📊' },
  { id: 'GOOGLE_SEARCH_CONSOLE', label: 'Google Search Console', icon: '🔍' },
  { id: 'GOOGLE_ADS', label: 'Google Ads', icon: '📢' },
  { id: 'GOOGLE_TAG_MANAGER', label: 'Google Tag Manager', icon: '🏷️' },
  { id: 'GOOGLE_BUSINESS_PROFILE', label: 'Google Business Profile', icon: '🏢' },
];

interface Props {
  onClose: () => void;
  onCreated: (client: any) => void;
}

export default function NewClientModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [services, setServices] = useState<string[]>(ALL_SERVICES.map(s => s.id));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleService(id: string) {
    setServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (services.length === 0) { setError('Select at least one service'); return; }
    setLoading(true);
    setError('');
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, services }),
    });
    if (res.ok) {
      const client = await res.json();
      onCreated(client);
    } else {
      const d = await res.json();
      setError(d.error ?? 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">New access request</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Acme Ltd"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="client@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Services to request access to</label>
            <div className="space-y-2">
              {ALL_SERVICES.map(svc => (
                <label key={svc.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition">
                  <input
                    type="checkbox"
                    checked={services.includes(svc.id)}
                    onChange={() => toggleService(svc.id)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-lg">{svc.icon}</span>
                  <span className="text-sm text-gray-800">{svc.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? 'Creating...' : 'Create & copy link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
