import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import type { Trip } from '../types';
import api, { apiErrorMessage } from '../services/api';
import { Users } from 'lucide-react';
import { Avatar, CoverImg, cn, TAG_STYLE, tripPath, TripMeta, TEXT_STRONG, TEXT_SOFT, CARD_FRAME_BASE, CARD_IMG } from './ui-bits';
import { useAuth } from '../context/AuthContext';

interface TripCardProps {
  trip: Trip;
  currentUserId: string;
  priority?: boolean; // first cards on the page: load their photo straight away
}

export default function TripCard({ trip, currentUserId, priority }: TripCardProps) {
  const { user } = useAuth();
  const isHost = currentUserId === trip.hostId;
  const canJoinWomenOnly = !trip.womenOnly || user?.gender === 'Woman';
  const tag = trip.tags[0];
  // Host occupies a spot, so filled = approved members + 1.
  const spotsFilled = (trip._count?.requests ?? 0) + 1;
  const spotsTotal = trip.maxGuests;
  const hostFirstName = trip.host.name.split(' ')[0];

  // ── State ────────────────────────────────────────────────────────────────────
  // Start from the user's existing request on this trip (sent by the feed API), if any.
  const [requestStatus, setRequestStatus] = useState<'idle' | 'loading' | 'PENDING' | 'APPROVED' | 'REJECTED'>(
    trip.requests?.[0]?.status ?? 'idle',
  );
  const isFull = spotsFilled >= spotsTotal;
  const [pitchMessage, setPitchMessage] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
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
    setSubmitError(null);
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
      setRequestStatus('PENDING');
      setPitchMessage('');
      closeModal();
      setShowToast(true);
      window.setTimeout(() => setShowToast(false), 2500);
    } catch (error) {
      console.error(error);
      setRequestStatus('idle');
      setSubmitError(apiErrorMessage(error, 'Could not send request. Please try again.'));
    }
  };

  return (
    <div className="relative flex flex-col h-full">
      {/* Cover */}
      <div className="relative">
        <Link to={tripPath(trip)} className={`${CARD_FRAME_BASE} aspect-[4/3] sm:aspect-[16/10]`} tabIndex={-1} aria-hidden="true">
          <CoverImg src={trip.coverImage} size={500} sizes="(min-width: 1280px) 360px, (min-width: 640px) 45vw, 46vw" priority={priority} alt="" className={CARD_IMG} />
        </Link>
        {tag && (
          <span
            className={cn('absolute top-2 left-2 sm:top-3 sm:left-3 text-white rounded-full px-2 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs backdrop-blur-sm', TAG_STYLE)}
            style={{ fontWeight: 600 }}
          >
            {tag}
          </span>
        )}
        <span
          className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-white/95 text-[#222222] rounded-full px-2 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs flex items-center gap-1"
          style={{ fontWeight: 600 }}
        >
          <Users size={12} />
          {spotsFilled}/{spotsTotal}
        </span>
        {trip.womenOnly && (
          <span
            className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 bg-pink-600/90 text-white rounded-full px-2 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs backdrop-blur-sm"
            style={{ fontWeight: 600 }}
          >
            Women only
          </span>
        )}
      </div>

      {/* Body */}
      <div className="pt-2.5 sm:pt-3 flex flex-col flex-1">
        <Link
          to={tripPath(trip)}
          className={cn('block line-clamp-2 break-words text-sm sm:text-base font-semibold leading-snug mb-0.5', TEXT_STRONG,
            // stretched link: this one link covers the whole card, so a click anywhere opens the trip
            "after:absolute after:inset-0 after:content-['']")}
        >
          {trip.destination}
        </Link>
        <div className="mb-3 sm:mb-4">
          <TripMeta trip={trip} />
        </div>
        <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link to={`/users/${trip.hostId}`} className="relative z-10 flex items-center gap-2 min-w-0 group">
              <Avatar src={trip.host.avatar} name={trip.host.name} size={22} />
              <span className={cn(TEXT_SOFT, 'truncate text-xs sm:text-sm')}>
                <span className="hidden sm:inline">Hosted by </span>
                <span className={TEXT_STRONG} style={{ fontWeight: 600 }}>
                  {hostFirstName}
                </span>
              </span>
            </Link>
          </div>

          {/* CTA */}
          {isHost ? (
            <span
              className="shrink-0 w-full sm:w-auto text-center rounded-full px-4 py-1.5 sm:py-2 text-[13px] sm:text-sm bg-[#F1F5F9] text-[#6A6A6A] select-none"
              style={{ fontWeight: 600 }}
            >
              Your trip
            </span>
          ) : requestStatus === 'PENDING' || requestStatus === 'APPROVED' || requestStatus === 'REJECTED' ? (
            <span
              className={cn(
                'shrink-0 w-full sm:w-auto text-center rounded-full px-4 py-1.5 sm:py-2 text-[13px] sm:text-sm select-none',
                requestStatus === 'PENDING' && 'bg-[#F3F3F3] text-[#6A6A6A]',
                requestStatus === 'APPROVED' && 'bg-[#EFF6FF] text-[#2563EB]',
                requestStatus === 'REJECTED' && 'bg-[#F3F3F3] text-[#222222]',
              )}
              style={{ fontWeight: 600 }}
            >
              {{ PENDING: 'Pending', APPROVED: 'Going', REJECTED: 'Declined' }[requestStatus]}
            </span>
          ) : isFull ? (
            <span
              className="shrink-0 w-full sm:w-auto text-center rounded-full px-4 py-1.5 sm:py-2 text-[13px] sm:text-sm bg-[#F1F5F9] text-[#6A6A6A] select-none"
              style={{ fontWeight: 600 }}
            >
              Full
            </span>
          ) : !canJoinWomenOnly ? (
            <span
              className="shrink-0 w-full sm:w-auto text-center rounded-full px-4 py-1.5 sm:py-2 text-[13px] sm:text-sm bg-[#F1F5F9] text-[#6A6A6A] select-none"
              style={{ fontWeight: 600 }}
            >
              Women only
            </span>
          ) : (
            <button
              type="button"
              onClick={openModal}
              className="relative z-10 shrink-0 w-full sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full px-5 py-1.5 sm:py-2 text-[13px] sm:text-sm transition-colors"
              style={{ fontWeight: 600 }}
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
            <h3 className="text-lg font-semibold text-[#222222]">Ask to Join {trip.destination}</h3>
            <p className="text-[#6A6A6A] text-sm mt-1">
              Send a quick note to {hostFirstName}. A good pitch helps your chances.
            </p>

            <textarea
              value={pitchMessage}
              onChange={(e) => setPitchMessage(e.target.value)}
              rows={4}
              maxLength={300}
              placeholder="Add a message for the host (optional), e.g., 'Hey! I have a DSLR and would love to join this trek!'"
              className="mt-4 w-full rounded-xl border border-[#DDDDDD] bg-slate-50 p-3 text-sm text-[#222222] placeholder:text-[#6A6A6A] outline-none focus:border-blue-600 resize-none"
            />

            {submitError && <p className="text-red-500 text-sm mt-3">{submitError}</p>}

            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={closeModal}
                disabled={requestStatus === 'loading'}
                className="px-5 py-2.5 rounded-full border border-[#DDDDDD] text-[#6A6A6A] text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
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
