import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import type { Trip } from '../types';
import api from '../services/api';
import { MapPin, Calendar, Wallet, Users } from 'lucide-react';
import { Avatar, cn, tagColor, formatDateRange, formatBudget } from './ui-bits';

interface TripCardProps {
  trip: Trip;
  currentUserId: string;
}

export default function TripCard({ trip, currentUserId }: TripCardProps) {
  const isHost = currentUserId === trip.hostId;
  const coverUrl =
    trip.coverImage ||
    `https://loremflickr.com/800/600/${encodeURIComponent(trip.destination.split(',')[0]?.trim() ?? 'travel')}/travel`;
  const tag = trip.tags[0];
  // Host occupies a spot, so filled = approved members + 1.
  const spotsFilled = (trip._count?.requests ?? 0) + 1;
  const spotsTotal = trip.maxGuests;
  const hostFirstName = trip.host.name.split(' ')[0];

  // ── State ────────────────────────────────────────────────────────────────────
  const [requestStatus, setRequestStatus] = useState<'idle' | 'loading' | 'pending'>('idle');
  const [pitchMessage, setPitchMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Modal open state lives in the URL (?modal=askToJoin&tripId=…) so the hardware
  // back button closes it. Only the card matching tripId renders its modal.
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isModalOpen = searchParams.get('modal') === 'askToJoin' && searchParams.get('tripId') === trip.id;

  // Lock background scroll while the modal is open.
  useEffect(() => {
    if (!isModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isModalOpen]);

  const openModal = () => {
    setPitchMessage('');
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('modal', 'askToJoin');
      p.set('tripId', trip.id);
      return p;
    });
  };

  // Close mirrors the hardware back button when possible (cleaner history).
  const closeModal = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      navigate(-1);
    } else {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete('modal');
          p.delete('tripId');
          return p;
        },
        { replace: true },
      );
    }
  };

  // ── Submit join request (now carries the pitch message) ──────────────────────
  const submitRequest = async (): Promise<void> => {
    setRequestStatus('loading');
    try {
      await api.post('/requests', {
        tripId: trip.id,
        message: pitchMessage.trim() || undefined,
      });
      setRequestStatus('pending');
      setPitchMessage('');
      closeModal();
      setShowToast(true);
      window.setTimeout(() => setShowToast(false), 2500);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        // Already requested — treat as pending and close.
        setRequestStatus('pending');
        closeModal();
      } else {
        console.error(error);
        setRequestStatus('idle');
      }
    }
  };

  return (
    <div className="bg-white rounded-[24px] border border-[#E2E8F0] overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_36px_rgba(15,23,42,0.10)] transition-shadow">
      {/* Cover */}
      <div className="relative">
        <div className="aspect-[16/10] bg-[#F1F5F9]">
          <img src={coverUrl} alt={trip.destination} className="w-full h-full object-cover" loading="lazy" />
        </div>
        {tag && (
          <span
            className={cn('absolute top-3 left-3 text-white rounded-full px-3 py-1 backdrop-blur-sm', tagColor(tag))}
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            {tag}
          </span>
        )}
        <span
          className="absolute top-3 right-3 bg-white/95 text-[#0F172A] rounded-full px-3 py-1 flex items-center gap-1"
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          <Users size={12} className="text-[#2563EB]" />
          {spotsFilled}/{spotsTotal}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-center gap-1.5 text-[#0F172A] mb-1">
          <MapPin size={16} className="text-[#2563EB] shrink-0" />
          <span className="truncate" style={{ fontSize: 17, fontWeight: 700 }}>
            {trip.destination}
          </span>
        </div>
        <p className="text-[#94A3B8] mb-3" style={{ fontSize: 13 }}>
          {trip.country}
        </p>
        <div className="flex items-center gap-4 text-[#64748B] mb-4" style={{ fontSize: 13 }}>
          <span className="flex items-center gap-1.5">
            <Calendar size={14} /> {formatDateRange(trip.startDate, trip.endDate)}
          </span>
          <span className="flex items-center gap-1.5">
            <Wallet size={14} /> {formatBudget(trip.budget)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar src={trip.host.avatar} name={trip.host.name} size={28} />
            <span className="text-[#64748B] truncate" style={{ fontSize: 13 }}>
              Hosted by{' '}
              <span className="text-[#0F172A]" style={{ fontWeight: 600 }}>
                {hostFirstName}
              </span>
            </span>
          </div>

          {/* CTA */}
          {isHost ? (
            <span
              className="shrink-0 rounded-full px-4 py-2 bg-[#F1F5F9] text-[#64748B] select-none"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              Your trip
            </span>
          ) : requestStatus === 'pending' ? (
            <span
              className="shrink-0 rounded-full px-4 py-2 bg-[#EFF6FF] text-[#2563EB] select-none"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              Pending
            </span>
          ) : (
            <button
              type="button"
              onClick={openModal}
              className="shrink-0 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full px-5 py-2 transition-colors"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              Join
            </button>
          )}
        </div>
      </div>

      {/* ── Pitch modal ──────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/50" onClick={closeModal} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900">Ask to Join {trip.destination}</h3>
            <p className="text-slate-500 text-sm mt-1">
              Send a quick note to {hostFirstName} — a good pitch helps your chances.
            </p>

            <textarea
              value={pitchMessage}
              onChange={(e) => setPitchMessage(e.target.value)}
              rows={4}
              maxLength={300}
              placeholder="Add a message for the host (optional) — e.g., 'Hey! I have a DSLR and would love to join this trek!'"
              className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 resize-none"
            />

            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={closeModal}
                disabled={requestStatus === 'loading'}
                className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRequest}
                disabled={requestStatus === 'loading'}
                className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {requestStatus === 'loading' ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success toast ────────────────────────────────────────────────────── */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg">
          Request sent to {hostFirstName} 🎒
        </div>
      )}
    </div>
  );
}
