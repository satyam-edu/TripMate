import { useState } from 'react';
import axios from 'axios';
import type { Trip } from '../types';
import api from '../services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatBudget(inr: number): string {
  return inr >= 1000 ? `₹${(inr / 1000).toFixed(0)}k` : `₹${inr}`;
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const PALETTES = [
  ['bg-violet-100', 'text-violet-700'],
  ['bg-teal-100',   'text-teal-700'],
  ['bg-rose-100',   'text-rose-700'],
  ['bg-amber-100',  'text-amber-700'],
  ['bg-sky-100',    'text-sky-700'],
] as const;

function avatarPalette(name: string) {
  return PALETTES[name.charCodeAt(0) % PALETTES.length]!;
}

const GRADIENTS = [
  'from-violet-400 to-indigo-500',
  'from-teal-400 to-cyan-500',
  'from-rose-400 to-pink-500',
  'from-amber-400 to-orange-500',
  'from-sky-400 to-blue-500',
] as const;

function getGradient(dest: string) {
  return GRADIENTS[dest.charCodeAt(0) % GRADIENTS.length]!;
}

// ── CalendarIcon ──────────────────────────────────────────────────────────────
function CalendarIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ── BudgetIcon ────────────────────────────────────────────────────────────────
function BudgetIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

// ── PinIcon ───────────────────────────────────────────────────────────────────
function PinIcon() {
  return (
    <svg className="w-3 h-3 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.016.07-.04a17 17 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 17 17 0 001.145.742z" clipRule="evenodd" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
interface TripCardProps {
  trip: Trip;
  currentUserId: string;
}

export default function TripCard({ trip, currentUserId }: TripCardProps) {
  const isHost = currentUserId === trip.hostId;
  const coverUrl  =
    trip.coverImage ||
    `https://loremflickr.com/800/600/${encodeURIComponent(trip.destination.split(',')[0]?.trim() ?? 'travel')}/travel`;
  const gradient  = getGradient(trip.destination);
  const [bgCls, txtCls] = avatarPalette(trip.host.name);
  const spotsLeft = trip.maxGuests - (trip._count?.requests ?? 0);

  const [isJoining, setIsJoining]       = useState<boolean>(false);
  const [hasRequested, setHasRequested] = useState<boolean>(false);

  const handleJoinRequest = async (): Promise<void> => {
    setIsJoining(true);
    try {
      await api.post(`/trips/${trip.id}/join`);
      setHasRequested(true);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setHasRequested(true);
      } else {
        console.error(error);
        const message =
          (axios.isAxiosError(error) &&
            (error.response?.data as { message?: string } | undefined)?.message) ||
          (error instanceof Error ? error.message : null) ||
          'Failed to request to join';
        alert(message);
      }
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <article className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden flex flex-col group hover:-translate-y-1 hover:shadow-lg transition-all duration-300">

      {/* Cover */}
      <div className={`relative w-full aspect-[16/9] overflow-hidden bg-gradient-to-br ${gradient}`}>
        <img
          src={coverUrl}
          alt={trip.destination}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Tags */}
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap max-w-[70%]">
          {trip.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/85 backdrop-blur-sm text-slate-700 shadow-sm leading-none">
              {tag}
            </span>
          ))}
        </div>

        {/* Spots left */}
        {spotsLeft > 0 && (
          <span className="absolute top-3 right-3 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-sm text-white shadow-sm leading-none">
            {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2.5 flex-1">

        {/* Destination + Country */}
        <div>
          <h3 className="text-[15px] font-bold text-slate-900 leading-snug line-clamp-1">
            {trip.destination}
          </h3>
          <p className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
            <PinIcon />
            {trip.country}
          </p>
        </div>

        {/* Dates + Budget */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <CalendarIcon />
            {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
          </span>
          <span className="flex items-center gap-1">
            <BudgetIcon />
            {formatBudget(trip.budget)} / person
          </span>
        </div>

        <div className="flex-1" />

        {/* Host row + CTA */}
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-2">
            {trip.host.avatar ? (
              <img
                src={trip.host.avatar}
                alt={trip.host.name}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-sm"
              />
            ) : (
              <div className={`w-7 h-7 rounded-full ${bgCls} ${txtCls} flex items-center justify-center text-[10px] font-bold ring-2 ring-white flex-shrink-0`}>
                {getInitials(trip.host.name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 leading-none">Host</p>
              <p className="text-xs font-semibold text-slate-700 leading-tight truncate max-w-[90px]">
                {trip.host.name}
              </p>
            </div>
          </div>

          {isHost ? (
            <span className="flex-shrink-0 text-[11px] font-semibold px-3.5 py-2 rounded-2xl bg-slate-100 text-slate-400 border border-slate-200 cursor-default select-none">
              Your Trip
            </span>
          ) : (
            <button
              type="button"
              onClick={handleJoinRequest}
              disabled={isJoining || hasRequested}
              className={
                `flex-shrink-0 text-[11px] font-semibold px-3.5 py-2 rounded-2xl transition-all duration-200 shadow-sm active:scale-95 ${
                  hasRequested
                    ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-default'
                    : 'bg-sky-500 text-white hover:bg-sky-600'
                } disabled:active:scale-100`
              }
            >
              {isJoining ? 'Sending...' : hasRequested ? 'Pending' : 'Request to Join'}
            </button>
          )}
        </div>

      </div>
    </article>
  );
}
