import { useState, useEffect } from 'react';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ReceivedRequest {
  id: string;
  status: string;
  createdAt: string;
  user: { id: string; name: string; avatar: string | null };
  trip: { id: string; destination: string; country: string };
}

interface SentRequest {
  id: string;
  status: string;
  createdAt: string;
  trip: {
    id: string;
    destination: string;
    country: string;
    startDate: string;
    coverImage: string | null;
    host: { id: string; name: string; avatar: string | null };
  };
}

type RequestsTab = 'received' | 'sent';

// ── Component ─────────────────────────────────────────────────────────────────
export default function Requests() {
  const [requestTab, setRequestTab] = useState<RequestsTab>('received');
  const [received, setReceived]     = useState<ReceivedRequest[]>([]);
  const [sent, setSent]             = useState<SentRequest[]>([]);
  const [loading, setLoading]       = useState<boolean>(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [receivedRes, sentRes] = await Promise.all([
          api.get<ReceivedRequest[]>('/requests/received'),
          api.get<SentRequest[]>('/requests/sent'),
        ]);
        setReceived(receivedRes.data);
        setSent(sentRes.data);
      } catch (error) {
        console.error('[Requests] fetch failed', error);
      } finally {
        setLoading(false);
      }
    };
    void fetchAll();
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Requests</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your trip requests</p>
      </div>

      {/* Toggle */}
      <div className="bg-slate-100 p-1 rounded-full flex max-w-md mx-auto mb-6">
        <button
          type="button"
          onClick={() => setRequestTab('received')}
          className={`rounded-full flex-1 py-2 text-sm font-medium transition-all ${
            requestTab === 'received'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Received
        </button>
        <button
          type="button"
          onClick={() => setRequestTab('sent')}
          className={`rounded-full flex-1 py-2 text-sm font-medium transition-all ${
            requestTab === 'sent'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Sent
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-4 rounded-xl shadow-sm animate-pulse h-16" />
          ))}
        </div>
      ) : requestTab === 'received' ? (
        received.length === 0 ? (
          <div className="text-center mt-20">
            <p className="text-slate-500 font-medium">No pending requests.</p>
            <p className="text-slate-400 text-sm mt-1">When travelers ask to join your trips, they will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {received.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm mb-3 flex justify-between items-center">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{item.user.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{item.trip.destination}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    type="button"
                    className="text-xs font-semibold px-3.5 py-2 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold px-3.5 py-2 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        sent.length === 0 ? (
          <div className="text-center mt-20">
            <p className="text-slate-500 font-medium">You haven&apos;t requested to join any trips.</p>
            <p className="text-slate-400 text-sm mt-1">Go to the Home feed to find your next adventure.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sent.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm mb-3 flex justify-between items-center">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{item.trip.destination}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{item.trip.country}</p>
                </div>
                <span className="ml-4 shrink-0 text-xs font-semibold px-3.5 py-2 rounded-full bg-slate-100 text-slate-500 border border-slate-200 cursor-default select-none">
                  Pending
                </span>
              </div>
            ))}
          </div>
        )
      )}

    </div>
  );
}
