import type { ReactNode } from 'react';

/* ── Helpers ────────────────────────────────────────────────────────────────── */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
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

const TAG_COLORS: Record<string, string> = {
  Mountains: 'bg-emerald-500/90',
  Beaches: 'bg-sky-500/90',
  Culture: 'bg-amber-500/90',
  Adventure: 'bg-orange-500/90',
  Wildlife: 'bg-lime-600/90',
  'Road Trip': 'bg-violet-500/90',
};

export function tagColor(tag: string): string {
  return TAG_COLORS[tag] ?? 'bg-[#2563EB]/90';
}

/* ── Avatar (img with initials fallback) ────────────────────────────────────── */
export function Avatar({
  src,
  name,
  size = 40,
  ring,
}: {
  src: string | null;
  name: string;
  size?: number;
  ring?: boolean;
}) {
  const cls = cn(
    'inline-flex items-center justify-center rounded-full overflow-hidden bg-[#EFF6FF] text-[#2563EB] font-bold shrink-0',
    ring && 'ring-2 ring-white',
  );
  if (src) {
    return (
      <span className={cls} style={{ width: size, height: size }}>
        <img src={src} alt={name} className="w-full h-full object-cover" loading="lazy" />
      </span>
    );
  }
  return (
    <span className={cls} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
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
          ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm shadow-blue-200'
          : 'bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB]',
      )}
      style={{ fontSize: 14, fontWeight: 600 }}
    >
      {children}
    </button>
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
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[#0F172A] tracking-tight" style={{ fontSize: 19, fontWeight: 700 }}>
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
  return <div className={cn('animate-pulse rounded-2xl bg-[#F1F5F9]', className)} />;
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
      <div className="w-20 h-20 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] mb-5">
        {icon}
      </div>
      <h3 className="text-[#0F172A] mb-2" style={{ fontSize: 18, fontWeight: 700 }}>
        {title}
      </h3>
      <p className="text-[#64748B] max-w-xs mb-6" style={{ fontSize: 14 }}>
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
      <h3 className="text-[#0F172A] mb-2" style={{ fontSize: 18, fontWeight: 700 }}>
        Something went wrong
      </h3>
      <p className="text-[#64748B] max-w-xs mb-6" style={{ fontSize: 14 }}>
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
