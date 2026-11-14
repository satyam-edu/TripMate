import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, MapPin, Compass, Clock, Calendar, Wallet } from 'lucide-react';
import type { Trip } from '../types';
import type { FeedFilters } from '../pages/Home';
import { cn } from './ui-bits';

/* The Home search: what travellers actually look for here.
   - Where : a place, state or trip name (the server matches destination, country and description)
   - When  : quick date windows, or a custom range
   - Budget: quick ranges, or custom min/max
   Suggestions come from places people search most + the trips already loaded; recent searches are kept on this device. */

const RECENT_KEY = 'tripmate_recent_searches';
const loadRecents = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 4) : [];
  } catch {
    return [];
  }
};
const saveRecent = (q: string): string[] => {
  const next = [q, ...loadRecents().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 4);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage blocked: recents just won't persist
  }
  return next;
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function datePresets(): { label: string; start: string; end: string }[] {
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const sat = addDays(today, today.getDay() === 6 ? 0 : today.getDay() === 0 ? -1 : 6 - today.getDay());
  return [
    { label: 'This weekend', start: iso(sat), end: iso(addDays(sat, 1)) },
    { label: 'Next 30 days', start: iso(today), end: iso(addDays(today, 30)) },
    { label: 'This month', start: iso(today), end: iso(new Date(today.getFullYear(), today.getMonth() + 1, 0)) },
    { label: 'Next month', start: iso(new Date(today.getFullYear(), today.getMonth() + 1, 1)), end: iso(new Date(today.getFullYear(), today.getMonth() + 2, 0)) },
    { label: 'Next 3 months', start: iso(today), end: iso(addDays(today, 90)) },
  ];
}

const BUDGET_PRESETS: { label: string; min: string; max: string }[] = [
  { label: 'Under ₹10,000', min: '', max: '10000' },
  { label: '₹10,000 – ₹20,000', min: '10000', max: '20000' },
  { label: '₹20,000 – ₹35,000', min: '20000', max: '35000' },
  { label: '₹35,000 and above', min: '35000', max: '' },
];

const shortDate = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const inr = (n: string) => `₹${Number(n).toLocaleString('en-IN')}`;

type Open = 'where' | 'dates' | 'budget' | null;
type Row = { kind: 'query' | 'place' | 'trip' | 'recent'; text: string };

export default function HeroSearch({
  filters,
  setFilters,
  trips,
  places,
}: {
  filters: FeedFilters;
  setFilters: React.Dispatch<React.SetStateAction<FeedFilters>>;
  trips: Trip[];
  places: string[]; // popular places shown before the user types
}) {
  const { q, minBudget, maxBudget, startDate, endDate } = filters;
  const [open, setOpen] = useState<Open>(null);
  const [recents, setRecents] = useState<string[]>(loadRecents);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<FeedFilters>) => setFilters((f) => ({ ...f, ...patch }));

  // Close the open popover on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // ── Suggestions ─────────────────────────────────────────────────────────────
  const sections = useMemo(() => {
    const text = q.trim().toLowerCase();
    const out: { title: string; rows: Row[] }[] = [];
    if (!text) {
      if (recents.length) out.push({ title: 'Recent', rows: recents.map((t) => ({ kind: 'recent' as const, text: t })) });
      out.push({ title: 'Popular places', rows: places.map((t) => ({ kind: 'place' as const, text: t })) });
      return out;
    }
    const placeSet = new Set([...places, ...trips.map((t) => t.country)]);
    const matchPlaces = [...placeSet].filter((p) => p.toLowerCase().includes(text) && p.toLowerCase() !== text).slice(0, 4);
    const matchTrips = [...new Set(trips.map((t) => t.destination))].filter((d) => d.toLowerCase().includes(text) && d.toLowerCase() !== text).slice(0, 4);
    out.push({ title: '', rows: [{ kind: 'query' as const, text: q.trim() }] });
    if (matchPlaces.length) out.push({ title: 'Places', rows: matchPlaces.map((t) => ({ kind: 'place' as const, text: t })) });
    if (matchTrips.length) out.push({ title: 'Trips', rows: matchTrips.map((t) => ({ kind: 'trip' as const, text: t })) });
    return out;
  }, [q, recents, places, trips]);
  const flat = sections.flatMap((s) => s.rows);

  const pick = (text: string) => {
    set({ q: text });
    setRecents(saveRecent(text));
    setOpen(null);
    inputRef.current?.blur();
  };
  const submit = () => {
    const text = q.trim();
    if (text) setRecents(saveRecent(text));
    setOpen(null);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen('where');
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Enter') {
      if (active >= 0 && flat[active]) pick(flat[active]!.text);
      else submit();
    } else if (e.key === 'Escape') {
      setOpen(null);
    }
  };

  // ── Labels ──────────────────────────────────────────────────────────────────
  const datesLabel =
    startDate && endDate ? `${shortDate(startDate)} – ${shortDate(endDate)}` : startDate ? `From ${shortDate(startDate)}` : endDate ? `Until ${shortDate(endDate)}` : 'Dates';
  const budgetLabel = minBudget && maxBudget ? `${inr(minBudget)} – ${inr(maxBudget)}` : minBudget ? `${inr(minBudget)}+` : maxBudget ? `Up to ${inr(maxBudget)}` : 'Budget';
  const datesOn = Boolean(startDate || endDate);
  const budgetOn = Boolean(minBudget || maxBudget);

  const popover = 'absolute z-30 top-full mt-2 bg-white rounded-2xl border border-[#DDDDDD] shadow-[0_12px_32px_rgba(15,23,42,0.18)] text-[#222222]';
  const chip = (on: boolean) =>
    cn(
      'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
      on ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB] font-medium' : 'border-[#DDDDDD] hover:border-[#222222]',
    );
  const field = 'w-full bg-white border border-[#B0B0B0] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#222222]';

  return (
    <div ref={wrapRef} className="relative mt-6 max-w-3xl">
      <div className="bg-white rounded-2xl p-2 flex flex-col sm:flex-row sm:items-center gap-2 shadow-[0_10px_30px_rgba(15,23,42,0.25)]">
        {/* Where */}
        <label className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2.5 cursor-text">
          <Search size={18} className="text-[#2563EB] shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              set({ q: e.target.value });
              setOpen('where');
              setActive(-1);
            }}
            onFocus={() => setOpen('where')}
            onKeyDown={onKeyDown}
            placeholder="Search a place, state or trip name"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-[#222222] placeholder:text-[#6A6A6A]"
            role="combobox"
            aria-expanded={open === 'where'}
            aria-autocomplete="list"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                set({ q: '' });
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="text-[#6A6A6A] hover:text-[#222222]"
            >
              <X size={16} />
            </button>
          )}
        </label>

        {/* When / Budget */}
        <div className="flex gap-2">
          {(
            [
              { key: 'dates', icon: <Calendar size={15} />, label: datesLabel, on: datesOn },
              { key: 'budget', icon: <Wallet size={15} />, label: budgetLabel, on: budgetOn },
            ] as const
          ).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setOpen(open === c.key ? null : c.key)}
              aria-expanded={open === c.key}
              className={cn(
                'flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm whitespace-nowrap transition-colors',
                c.on ? 'bg-[#EFF6FF] text-[#2563EB] font-medium' : 'bg-[#F3F4F6] text-[#222222] hover:bg-[#E5E7EB]',
                open === c.key && 'ring-2 ring-[#2563EB]/40',
              )}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Suggestions */}
      {open === 'where' && flat.length > 0 && (
        <div className={cn(popover, 'left-0 right-0 py-2 max-h-[22rem] overflow-y-auto')} role="listbox">
          {sections.map((sec) => (
            <div key={sec.title || 'q'}>
              {sec.title && <p className="px-4 pt-2 pb-1 text-xs font-medium text-[#6A6A6A]">{sec.title}</p>}
              {sec.rows.map((row) => {
                const idx = flat.indexOf(row);
                const Icon = row.kind === 'recent' ? Clock : row.kind === 'trip' ? Compass : row.kind === 'query' ? Search : MapPin;
                return (
                  <button
                    key={`${row.kind}-${row.text}`}
                    type="button"
                    role="option"
                    aria-selected={idx === active}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => pick(row.text)}
                    className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm', idx === active && 'bg-[#F7F7F7]')}
                  >
                    <span className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#222222] shrink-0">
                      <Icon size={15} />
                    </span>
                    {row.kind === 'query' ? (
                      <span className="truncate">
                        Search for <span className="font-medium">“{row.text}”</span>
                      </span>
                    ) : (
                      <span className="truncate">{row.text}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Dates */}
      {open === 'dates' && (
        <div className={cn(popover, 'left-0 right-0 sm:left-auto sm:right-0 sm:w-[22rem] p-4')}>
          <p className="text-sm font-medium mb-3">When are you free?</p>
          <div className="flex flex-wrap gap-2">
            {datePresets().map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  set({ startDate: p.start, endDate: p.end });
                  setOpen(null);
                }}
                className={chip(startDate === p.start && endDate === p.end)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#6A6A6A] mt-4 mb-2">Or pick your own dates</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-[#6A6A6A]">
              From
              <input type="date" value={startDate} min={iso(new Date())} onChange={(e) => set({ startDate: e.target.value })} className={cn(field, 'mt-1 text-[#222222]')} />
            </label>
            <label className="text-xs text-[#6A6A6A]">
              To
              <input type="date" value={endDate} min={startDate || iso(new Date())} onChange={(e) => set({ endDate: e.target.value })} className={cn(field, 'mt-1 text-[#222222]')} />
            </label>
          </div>
          <div className="flex items-center justify-between mt-4">
            <button type="button" onClick={() => set({ startDate: '', endDate: '' })} disabled={!datesOn} className="text-sm underline underline-offset-4 disabled:opacity-40 disabled:no-underline">
              Clear
            </button>
            <button type="button" onClick={() => setOpen(null)} className="rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium px-5 py-2 transition-colors">
              Done
            </button>
          </div>
        </div>
      )}

      {/* Budget */}
      {open === 'budget' && (
        <div className={cn(popover, 'left-0 right-0 sm:left-auto sm:right-0 sm:w-[22rem] p-4')}>
          <p className="text-sm font-medium mb-3">Budget per person</p>
          <div className="flex flex-wrap gap-2">
            {BUDGET_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  set({ minBudget: p.min, maxBudget: p.max });
                  setOpen(null);
                }}
                className={chip(minBudget === p.min && maxBudget === p.max)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#6A6A6A] mt-4 mb-2">Or set your own range (₹)</p>
          <div className="flex items-center gap-2">
            <input type="number" min={0} inputMode="numeric" value={minBudget} onChange={(e) => set({ minBudget: e.target.value })} placeholder="Min" className={field} />
            <span className="text-[#6A6A6A]">–</span>
            <input type="number" min={0} inputMode="numeric" value={maxBudget} onChange={(e) => set({ maxBudget: e.target.value })} placeholder="Max" className={field} />
          </div>
          <div className="flex items-center justify-between mt-4">
            <button type="button" onClick={() => set({ minBudget: '', maxBudget: '' })} disabled={!budgetOn} className="text-sm underline underline-offset-4 disabled:opacity-40 disabled:no-underline">
              Clear
            </button>
            <button type="button" onClick={() => setOpen(null)} className="rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium px-5 py-2 transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
