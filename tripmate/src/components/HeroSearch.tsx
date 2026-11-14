import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, MapPin, Compass, Clock, Calendar, Wallet, ArrowLeft } from 'lucide-react';
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
  const [sheet, setSheet] = useState(false); // phone: full-screen search
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

  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheet]);

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
  // min-w-0 + block: iOS date inputs have a wide built-in size and would otherwise spill out of the popup
  const field = 'block w-full min-w-0 max-w-full h-11 sm:h-10 bg-white border border-[#B0B0B0] rounded-lg px-3 text-base sm:text-sm outline-none focus:border-[#222222] appearance-none';

  return (
    <div ref={wrapRef} className="relative mb-7 sm:mb-8">
      <div className="hidden sm:flex sm:flex-row sm:items-stretch bg-white border border-[#DDDDDD] rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.06)] focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]/20 transition">
        {/* Where */}
        <label className="flex-1 min-w-0 flex items-center gap-2.5 px-4 py-3.5 cursor-text">
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
            placeholder="Where to? Search a place, state or trip"
            className="flex-1 min-w-0 bg-transparent outline-none text-base sm:text-[15px] text-[#222222] placeholder:text-[#6A6A6A]"
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
        <div className="grid grid-cols-2 sm:flex border-t sm:border-t-0 sm:border-l border-[#EBEBEB] divide-x divide-[#EBEBEB]">
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
                'flex items-center justify-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap transition-colors hover:bg-[#F7F7F7] last:rounded-br-2xl first:rounded-bl-2xl sm:first:rounded-bl-none sm:last:rounded-r-2xl',
                c.on ? 'text-[#2563EB] font-medium' : 'text-[#222222]',
                open === c.key && 'bg-[#F7F7F7]',
              )}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Phone: compact bar that opens a full-screen search */}
      <div className="sm:hidden bg-white border border-[#DDDDDD] rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden">
        <button type="button" onClick={() => setSheet(true)} className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left">
          <Search size={18} className="text-[#2563EB] shrink-0" />
          <span className={cn('flex-1 truncate text-[15px]', q ? 'text-[#222222]' : 'text-[#6A6A6A]')}>{q || 'Where to? Search a place, state or trip'}</span>
        </button>
      </div>

      {sheet && (
        <div className="sm:hidden fixed inset-0 z-50 bg-white flex flex-col" role="dialog" aria-modal="true" aria-label="Search trips">
          <div className="flex items-center gap-2 px-3 py-3 border-b border-[#EBEBEB]">
            <button type="button" onClick={() => setSheet(false)} aria-label="Close search" className="w-10 h-10 rounded-full flex items-center justify-center active:bg-[#F7F7F7]">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0 flex items-center gap-2 h-11 rounded-xl border border-[#B0B0B0] px-3 focus-within:border-[#2563EB]">
              <Search size={16} className="text-[#2563EB] shrink-0" />
              <input
                autoFocus
                value={q}
                onChange={(e) => set({ q: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && (submit(), setSheet(false))}
                enterKeyHint="search"
                placeholder="Place, state or trip"
                className="flex-1 min-w-0 bg-transparent outline-none text-base text-[#222222] placeholder:text-[#6A6A6A]"
              />
              {q && (
                <button type="button" onClick={() => set({ q: '' })} aria-label="Clear search" className="text-[#6A6A6A]">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
            {sections.map((sec) => (
              <div key={sec.title || 'q'} className="pt-3">
                {sec.title && <p className="pb-1 text-xs font-medium text-[#6A6A6A]">{sec.title}</p>}
                {sec.rows.map((row) => {
                  const Icon = row.kind === 'recent' ? Clock : row.kind === 'trip' ? Compass : row.kind === 'query' ? Search : MapPin;
                  return (
                    <button
                      key={`${row.kind}-${row.text}`}
                      type="button"
                      onClick={() => {
                        pick(row.text);
                        setSheet(false);
                      }}
                      className="w-full flex items-center gap-3 py-2.5 text-left text-[15px] active:bg-[#F7F7F7]"
                    >
                      <span className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0">
                        <Icon size={16} />
                      </span>
                      <span className="truncate">{row.kind === 'query' ? `Search for “${row.text}”` : row.text}</span>
                    </button>
                  );
                })}
              </div>
            ))}

            <div className="mt-6 pt-5 border-t border-[#EBEBEB]">
              <p className="text-[15px] font-medium mb-3">When are you free?</p>
              <div className="flex flex-wrap gap-2">
                {datePresets().map((p) => (
                  <button key={p.label} type="button" onClick={() => set(startDate === p.start && endDate === p.end ? { startDate: '', endDate: '' } : { startDate: p.start, endDate: p.end })} className={chip(startDate === p.start && endDate === p.end)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <label className="min-w-0 text-xs text-[#6A6A6A]">
                  From
                  <input type="date" value={startDate} min={iso(new Date())} onChange={(e) => set({ startDate: e.target.value })} className={cn(field, 'mt-1 text-[#222222]')} />
                </label>
                <label className="min-w-0 text-xs text-[#6A6A6A]">
                  To
                  <input type="date" value={endDate} min={startDate || iso(new Date())} onChange={(e) => set({ endDate: e.target.value })} className={cn(field, 'mt-1 text-[#222222]')} />
                </label>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-[#EBEBEB]">
              <p className="text-[15px] font-medium mb-3">Budget per person</p>
              <div className="flex flex-wrap gap-2">
                {BUDGET_PRESETS.map((p) => (
                  <button key={p.label} type="button" onClick={() => set(minBudget === p.min && maxBudget === p.max ? { minBudget: '', maxBudget: '' } : { minBudget: p.min, maxBudget: p.max })} className={chip(minBudget === p.min && maxBudget === p.max)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <input type="number" min={0} inputMode="numeric" value={minBudget} onChange={(e) => set({ minBudget: e.target.value })} placeholder="Min ₹" className={field} />
                <span className="text-[#6A6A6A]">–</span>
                <input type="number" min={0} inputMode="numeric" value={maxBudget} onChange={(e) => set({ maxBudget: e.target.value })} placeholder="Max ₹" className={field} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#EBEBEB] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={() => set({ q: '', startDate: '', endDate: '', minBudget: '', maxBudget: '' })} disabled={!q && !datesOn && !budgetOn} className="text-sm underline underline-offset-4 disabled:opacity-40 disabled:no-underline">
              Clear all
            </button>
            <button
              type="button"
              onClick={() => {
                submit();
                setSheet(false);
              }}
              className="rounded-full bg-[#2563EB] active:bg-[#1D4ED8] text-white text-[15px] font-medium px-8 py-3"
            >
              Show results
            </button>
          </div>
        </div>
      )}

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
            <label className="min-w-0 text-xs text-[#6A6A6A]">
              From
              <input type="date" value={startDate} min={iso(new Date())} onChange={(e) => set({ startDate: e.target.value })} className={cn(field, 'mt-1 text-[#222222]')} />
            </label>
            <label className="min-w-0 text-xs text-[#6A6A6A]">
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
