import { useState, type CSSProperties, type ImgHTMLAttributes, type ReactNode } from 'react';

/* ── Trip card text (Airbnb-style hierarchy: near-black first, one soft grey for the rest) ── */
export const TEXT_STRONG = 'text-[#222222]';
export const TEXT_SOFT = 'text-[#6A6A6A]';
// Trip cards have no hover effect on purpose.
export const LINE = 'border-[#DDDDDD]'; // the one hairline colour used for dividers and outlines
export const PAGE_TITLE = 'text-[28px] sm:text-[32px] font-semibold leading-tight text-[#222222]';
export const H2 = 'text-[22px] font-semibold leading-snug text-[#222222]';
// Outline button (Airbnb "secondary"): dark thin border, no fill.
export const BTN_OUTLINE =
  'inline-flex items-center justify-center gap-1.5 rounded-full border border-[#222222] text-[#222222] hover:bg-slate-50 disabled:opacity-50 px-4 py-2 text-sm font-semibold transition-colors';
export const CARD_FRAME = 'block aspect-[16/10] overflow-hidden rounded-2xl bg-slate-100';
export const CARD_IMG = 'w-full h-full object-cover';

export function TripMeta({ trip }: { trip: { country: string; startDate: string; endDate: string; budget: number } }) {
  return (
    <>
      <p className={`${TEXT_SOFT} text-sm leading-snug`}>
        {trip.country} · {formatDateRange(trip.startDate, trip.endDate)}
      </p>
      <p className={`${TEXT_STRONG} text-sm font-semibold mt-0.5`}>{formatBudget(trip.budget)}</p>
    </>
  );
}

/* ── Trip cover photo ───────────────────────────────────────────────────────── */
// Bundled with the app, so it shows even when a cover link is missing or its host is down.
const FALLBACK_COVER = '/travel-bg-poster.jpg';

// `size` asks Wikipedia for a smaller copy (covers are stored at 960px) for small thumbnails.
export function CoverImg({
  src,
  size,
  ...props
}: { src: string | null | undefined; size?: 330 | 500 } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const url = !src ? FALLBACK_COVER : size ? src.replace('/960px-', `/${size}px-`) : src;
  return (
    <img
      {...props}
      src={url}
      onError={(e) => {
        if (!e.currentTarget.src.endsWith(FALLBACK_COVER)) e.currentTarget.src = FALLBACK_COVER;
      }}
    />
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/* Trip page URL: the readable slug ("/trips/udaipur-royal-heritage"), or the id for trips without one. */
export function tripPath(trip: { id: string; slug?: string | null }): string {
  return `/trips/${trip.slug ?? trip.id}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

/* Maps a real ISO date range → the compact label the design expects ("12–19 Jul"). */
export function formatDateRange(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  const mon = (d: Date) => d.toLocaleDateString('en-IN', { month: 'short' });
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  return sameMonth
    ? `${s.getDate()}–${e.getDate()} ${mon(e)}`
    : `${s.getDate()} ${mon(s)} – ${e.getDate()} ${mon(e)}`;
}

/* Real budget (INR number) → formatted string ("₹18,500"). */
export function formatBudget(inr: number): string {
  return `₹${inr.toLocaleString('en-IN')}`;
}

// One neutral "dark glass" look for every category tag (pair with text-white + backdrop-blur).
// Reads on any photo and on white, and doesn't compete with the cover image.
export const TAG_STYLE = 'bg-slate-900/55 ring-1 ring-white/15';

/* ── Avatar (img with initials fallback) ────────────────────────────────────── */
export function Avatar({
  src,
  name,
  size = 40,
  ring,
  ringWidth = 2,
}: {
  src: string | null;
  name: string;
  size?: number;
  ring?: boolean;
  ringWidth?: number; // px — only used when ring is true
}) {
  // Falls back to initials if the photo link is broken (e.g. an expired Google photo URL).
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const cls = cn('inline-flex items-center justify-center rounded-full overflow-hidden bg-[#EFF6FF] text-[#2563EB] font-semibold shrink-0');
  // A real border (not the box-shadow-based `ring` utility) so the circle stays exact
  // at every zoom/DPI — box-shadow rings can show a faint edge gap on some displays.
  const style: CSSProperties = ring
    ? { width: size, height: size, boxSizing: 'border-box', border: `${ringWidth}px solid white` }
    : { width: size, height: size };
  if (src && src !== failedSrc) {
    return (
      <span className={cls} style={style}>
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
        />
      </span>
    );
  }
  return (
    <span className={cls} style={{ ...style, fontSize: Math.round(size * 0.36) }}>
      {getInitials(name)}
    </span>
  );
}

/* ── Pill (category filter / toggle) ────────────────────────────────────────── */
export function Pill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'whitespace-nowrap rounded-full px-4 py-2 transition-all border',
        active
          ? 'bg-[#222222] text-white border-[#222222]'
          : 'bg-white text-[#222222] border-[#DDDDDD] hover:border-[#222222]',
      )}
      style={{ fontSize: 14, fontWeight: 400 }}
    >
      {children}
    </button>
  );
}

/* ── Underline tabs (Airbnb style) ──────────────────────────────────────────── */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('flex gap-8 border-b border-[#DDDDDD]', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            '-mb-px pb-3 text-[15px] font-semibold border-b-2 transition-colors',
            value === t.value ? 'border-[#222222] text-[#222222]' : 'border-transparent text-[#6A6A6A] hover:text-[#222222]',
          )}
        >
          {t.label}
          {!!t.badge && <span className="ml-1.5 text-[#6A6A6A] font-normal">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Section header with optional action ────────────────────────────────────── */
export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-[#222222]" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>
        {title}
      </h2>
      {action && (
        <button
          onClick={onAction}
          className="text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
          style={{ fontSize: 14, fontWeight: 600 }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

/* ── Skeleton ───────────────────────────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-[#EBEBEB]', className)} />;
}

/* ── Empty state ────────────────────────────────────────────────────────────── */
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-20 h-20 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#222222] mb-5">
        {icon}
      </div>
      <h3 className="text-[#222222] mb-2" style={{ fontSize: 20, fontWeight: 600 }}>
        {title}
      </h3>
      <p className="text-[#6A6A6A] max-w-xs mb-6" style={{ fontSize: 14 }}>
        {subtitle}
      </p>
      {action && (
        <button
          onClick={onAction}
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full px-6 py-2.5 transition-colors"
          style={{ fontSize: 14, fontWeight: 600 }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

/* ── Error state ────────────────────────────────────────────────────────────── */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-5">
        <span style={{ fontSize: 34 }}>⚠️</span>
      </div>
      <h3 className="text-[#222222] mb-2" style={{ fontSize: 20, fontWeight: 600 }}>
        Something went wrong
      </h3>
      <p className="text-[#6A6A6A] max-w-xs mb-6" style={{ fontSize: 14 }}>
        We couldn't load this right now. Check your connection and try again.
      </p>
      <button
        onClick={onRetry}
        className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full px-6 py-2.5 transition-colors"
        style={{ fontSize: 14, fontWeight: 600 }}
      >
        Try again
      </button>
    </div>
  );
}
