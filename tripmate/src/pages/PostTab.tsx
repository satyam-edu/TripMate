import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MapPin, Calendar, Users, Wallet, ChevronLeft, ChevronRight, Minus, Plus, Check,
  Mountain, Landmark, Waves, UtensilsCrossed, Sun, Music, Camera, ShoppingBag,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Avatar, tagColor, formatDateRange, formatBudget } from '../components/ui-bits';

/* ── Types & constants ──────────────────────────────────────────────────────── */
type Category = 'Mountains' | 'Beaches' | 'Culture' | 'Adventure' | 'Wildlife' | 'Road Trip';

const STEP_LABELS = ['Destination', 'Dates', 'Group & Budget', 'Details'];
const SUGGESTIONS = ['Spiti Valley', 'Goa', 'Manali', 'Kerala Backwaters', 'Hampi', 'Ladakh'];
const CATEGORIES: Category[] = ['Mountains', 'Beaches', 'Culture', 'Adventure', 'Wildlife', 'Road Trip'];

// Everyday travel vibes people actually pick.
const VIBES: { label: string; icon: typeof Mountain }[] = [
  { label: 'Sightseeing', icon: Landmark },
  { label: 'Trekking', icon: Mountain },
  { label: 'Beach Time', icon: Waves },
  { label: 'Food & Cafés', icon: UtensilsCrossed },
  { label: 'Relaxation', icon: Sun },
  { label: 'Nightlife', icon: Music },
  { label: 'Photography', icon: Camera },
  { label: 'Shopping', icon: ShoppingBag },
];

const PREVIEW_COVER =
  'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&h=600&fit=crop&auto=format';

/* ═══════════════════════════════════════════════════════════════════════════════
   POST TAB  (V2 design — translated to Tailwind, real engine grafted in)
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function PostTab() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Wizard step synced to the URL (?step=1..4). Form data below stays in local
  //    state and survives the query change (the route element is not remounted). ──
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStep = parseInt(searchParams.get('step') ?? '1', 10);
  const step = (Number.isFinite(rawStep) ? Math.min(4, Math.max(1, rawStep)) : 1) - 1; // 0..3
  const goToStep = (s0: number) => setSearchParams({ step: String(Math.min(4, Math.max(1, s0 + 1))) });

  // ── Form state (engine) ──────────────────────────────────────────────────────
  const [destination, setDestination] = useState('');
  const [region, setRegion] = useState('');
  const [startDate, setStartDate] = useState(''); // ISO yyyy-mm-dd
  const [endDate, setEndDate] = useState('');
  const [group, setGroup] = useState(4);
  const [budget, setBudget] = useState(18500);
  const [vibes, setVibes] = useState<string[]>([]);
  const [tag, setTag] = useState<Category>('Mountains');

  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  const toggleVibe = (v: string) =>
    setVibes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  /* ── Publish (real axios POST /trips — preserved) ──────────────────────────── */
  const handlePublish = async () => {
    setErrorMessage(null);

    const missing: string[] = [];
    if (!destination.trim()) missing.push('Destination');
    if (!startDate) missing.push('Start date');
    if (!endDate) missing.push('End date');
    if (!budget) missing.push('Budget');
    if (missing.length) {
      setErrorMessage(`Required: ${missing.join(', ')}`);
      return;
    }

    setIsPublishing(true);
    try {
      await api.post('/trips', {
        destination: destination.trim(),
        country: region.trim() || 'India',
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        budget,
        maxGuests: group,
        tags: [tag, ...vibes.filter((v) => v !== tag)],
        coverImage: '', // backend auto-generates a cover from the destination
        description: '',
      });
      setPublished(true);
    } catch (err: unknown) {
      console.error('[PostTab] publish failed', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to publish trip.');
    } finally {
      setIsPublishing(false);
    }
  };

  const reset = () => {
    goToStep(0);
    setDestination('');
    setRegion('');
    setStartDate('');
    setEndDate('');
    setGroup(4);
    setBudget(18500);
    setVibes([]);
    setTag('Mountains');
    setErrorMessage(null);
    setPublished(false);
  };

  /* ── Success screen ────────────────────────────────────────────────────────── */
  if (published) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 text-3xl">🎉</div>
        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Trip Published!</h2>
        <p className="text-slate-500 max-w-xs leading-relaxed mb-8">
          Your trip to <span className="text-slate-900 font-semibold">{destination}</span> is now live.
        </p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
          >
            Post another
          </button>
          <button
            onClick={() => navigate('/')}
            className="border border-slate-200 text-slate-900 rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  const previewDates = formatDateRange(startDate, endDate);

  // Required fields gate each step: destination, dates, travelers, and price.
  // (Group size and budget always carry a value, so they're satisfied by default.)
  const stepValid =
    step === 0
      ? destination.trim().length > 0
      : step === 1
        ? Boolean(startDate && endDate)
        : true;

  /* ── Main ──────────────────────────────────────────────────────────────────── */
  return (
    <div className="pb-28 lg:pb-10">
      {/* Header — floats directly on the page background (no card) */}
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">Post a Trip</h1>
      <p className="text-slate-500 mb-6 text-[15px]">Plan your route and gather companions to join you.</p>

      {/* Segmented progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex-1">
            <div className="flex flex-col items-center gap-1.5 w-full">
              <div className={`h-1.5 w-full rounded-full transition-colors ${i <= step ? 'bg-blue-600' : 'bg-slate-200'}`} />
              <span className={`hidden sm:block text-xs font-semibold ${i <= step ? 'text-blue-600' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        {/* ── Form card ───────────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
          <p className="text-sm font-semibold text-slate-400 mb-5">
            STEP {step + 1} OF 4 · {STEP_LABELS[step]}
          </p>

          {/* Step 0 — Destination */}
          {step === 0 && (
            <div>
              <Label icon={<MapPin size={18} />} required>Where are you headed?</Label>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Spiti Valley"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-600 text-slate-900 mb-3"
              />
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Region / State"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-600 text-slate-900 mb-5"
              />
              <p className="text-sm font-semibold text-slate-500 mb-3">Popular right now</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDestination(s)}
                    className={`rounded-full px-4 py-2 border text-sm font-semibold transition-colors ${
                      destination === s
                        ? 'bg-blue-50 border-blue-600 text-blue-600'
                        : 'border-slate-200 text-slate-500 hover:border-blue-600'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1 — Dates */}
          {step === 1 && (
            <div>
              <Label icon={<Calendar size={18} />} required>Select your travel dates</Label>
              <CalendarPicker
                start={startDate}
                end={endDate}
                onSelect={(s, e) => {
                  setStartDate(s);
                  setEndDate(e);
                }}
              />
            </div>
          )}

          {/* Step 2 — Group & Budget */}
          {step === 2 && (
            <div>
              <Label icon={<Users size={18} />} required>How many travelers?</Label>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 mb-6">
                <span className="text-slate-900 font-semibold text-[15px]">Group size</span>
                <Counter value={group} setValue={setGroup} min={2} max={12} />
              </div>

              <Label icon={<Wallet size={18} />} required>Estimated budget per person</Label>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-2xl font-extrabold text-slate-900">₹{budget.toLocaleString('en-IN')}</span>
                  <span className="text-slate-400 text-[13px]">per person</span>
                </div>
                <input
                  type="range"
                  min={5000}
                  max={50000}
                  step={500}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-slate-400 text-xs mt-1">
                  <span>₹5,000</span>
                  <span>₹50,000</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Details (vibes + category tag) */}
          {step === 3 && (
            <div>
              <Label icon={<Mountain size={18} />}>What's the vibe?</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {VIBES.map((v) => {
                  const Icon = v.icon;
                  const on = vibes.includes(v.label);
                  return (
                    <button
                      key={v.label}
                      type="button"
                      onClick={() => toggleVibe(v.label)}
                      className={`flex flex-col items-center gap-2 rounded-2xl border py-4 transition-colors ${
                        on ? 'bg-blue-50 border-blue-600 text-blue-600' : 'border-slate-200 text-slate-500 hover:border-blue-600'
                      }`}
                    >
                      <Icon size={22} />
                      <span className="text-xs font-semibold">{v.label}</span>
                    </button>
                  );
                })}
              </div>

              <Label icon={<MapPin size={18} />}>Category tag</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setTag(c)}
                    className={`rounded-full px-4 py-2 border text-sm font-semibold transition-colors ${
                      tag === c ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-500 hover:border-blue-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-8">
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              disabled={step === 0}
              className="flex items-center gap-1 text-sm font-semibold text-slate-500 disabled:opacity-40 hover:text-slate-900 transition-colors"
            >
              <ChevronLeft size={18} /> Back
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => goToStep(step + 1)}
                disabled={!stepValid}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
              >
                Continue <ChevronRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
              >
                <Check size={18} /> {isPublishing ? 'Publishing…' : 'Publish trip'}
              </button>
            )}
          </div>

          {errorMessage && <p className="text-red-500 text-sm mt-4">{errorMessage}</p>}
        </div>

        {/* ── Live preview (sticky desktop, stacks below on mobile) ───────────── */}
        <div className="lg:sticky lg:top-6">
          <p className="text-sm font-semibold text-slate-400 mb-3">LIVE PREVIEW</p>
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.05)]">
            <div className="relative">
              <div className="aspect-[16/10] bg-slate-100">
                <img src={PREVIEW_COVER} alt="" className="w-full h-full object-cover" />
              </div>
              <span
                className={`absolute top-3 left-3 text-white rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm ${tagColor(tag)}`}
              >
                {tag}
              </span>
              <span className="absolute top-3 right-3 bg-white/95 text-slate-900 rounded-full px-3 py-1 flex items-center gap-1 text-xs font-semibold">
                <Users size={12} className="text-blue-600" />
                1/{group}
              </span>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-1.5 text-slate-900 mb-1">
                <MapPin size={16} className="text-blue-600 shrink-0" />
                <span className="text-[17px] font-bold truncate">{destination || 'Your destination'}</span>
              </div>
              <p className="text-slate-400 mb-3 text-[13px]">{region || 'Region'}</p>
              <div className="flex items-center gap-4 text-slate-500 mb-4 text-[13px]">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} /> {previewDates || 'Pick dates'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Wallet size={14} /> {formatBudget(budget)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar src={user?.avatar ?? null} name={user?.name ?? 'You'} size={28} />
                  <span className="text-slate-500 truncate text-[13px]">
                    Hosted by{' '}
                    <span className="text-slate-900 font-semibold">{(user?.name ?? 'You').split(' ')[0]}</span>
                  </span>
                </div>
                <span className="shrink-0 bg-blue-600 text-white rounded-full px-5 py-2 text-sm font-semibold">Join</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Step heading label (prominent, per V2) ─────────────────────────────────── */
function Label({ icon, children, required }: { icon: React.ReactNode; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-slate-900 mb-3 text-xl font-semibold">
      <span className="text-blue-600">{icon}</span>
      {children}
      {required && <span className="text-red-500">*</span>}
    </label>
  );
}

/* ── Group size − / + stepper ───────────────────────────────────────────────── */
function Counter({ value, setValue, min, max }: { value: number; setValue: (n: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => setValue(Math.max(min, value - 1))}
        className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:border-blue-600 hover:text-blue-600 transition-colors"
      >
        <Minus size={16} />
      </button>
      <span className="text-slate-900 w-6 text-center text-lg font-bold">{value}</span>
      <button
        type="button"
        onClick={() => setValue(Math.min(max, value + 1))}
        className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 transition-colors"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

/* ── Functional date-range calendar (emits real ISO dates) ──────────────────── */
function CalendarPicker({ start, end, onSelect }: { start: string; end: string; onSelect: (s: string, e: string) => void }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selecting, setSelecting] = useState<'start' | 'end'>(!start ? 'start' : 'end');

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(viewYear, viewMonth, 1),
  );

  const toISO = (d: number) => `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  };

  const handleDayClick = (d: number) => {
    const iso = toISO(d);
    if (selecting === 'start') {
      onSelect(iso, '');
      setSelecting('end');
    } else if (iso < start) {
      onSelect(iso, '');
      setSelecting('end');
    } else {
      onSelect(start, iso);
      setSelecting('start');
    }
  };

  const inRange = (d: number) => {
    if (!start || !end) return false;
    const iso = toISO(d);
    return iso >= start && iso <= end;
  };
  const isStart = (d: number) => toISO(d) === start;
  const isEnd = (d: number) => toISO(d) === end;
  const isPast = (d: number) => toISO(d) < todayISO;

  return (
    <>
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-slate-900 font-bold text-[15px]">{monthLabel}</span>
          <div className="flex gap-1">
            <button type="button" onClick={prevMonth} className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center text-slate-500">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={nextMonth} className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center text-slate-500">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span key={i} className="text-center text-slate-400 text-[11px] font-semibold">
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => (
            <span key={`e${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const past = isPast(d);
            const ranged = inRange(d);
            const edge = isStart(d) || isEnd(d);
            return (
              <button
                key={d}
                type="button"
                disabled={past}
                onClick={() => handleDayClick(d)}
                className={`h-9 rounded-full text-[13px] transition-colors ${
                  edge
                    ? 'bg-blue-600 text-white font-bold'
                    : ranged
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : past
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-600 hover:bg-white'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-slate-500 mt-4 text-sm">
        {!start ? (
          'Select your start date'
        ) : !end ? (
          'Now select your end date'
        ) : (
          <>
            Selected: <span className="text-blue-600 font-bold">{formatDateRange(start, end)}</span>
          </>
        )}
      </p>
    </>
  );
}
