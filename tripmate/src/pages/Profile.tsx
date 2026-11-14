import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Users, Compass, BadgeCheck, Link2, Pencil, X, LogOut, Trash2, Camera, Loader2, Star, Mail, Phone, Check } from 'lucide-react';
import type { RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';
// Firebase is only needed for phone OTP, so it's fetched when that flow starts.
const loadFirebase = () => import('../services/firebase');
import type { AuthUser } from '../context/AuthContext';
import api, { apiErrorMessage, cachedGet } from '../services/api';
import type { Trip } from '../types';
import { useAuth } from '../context/AuthContext';
import { Avatar, CoverImg, TripMeta, TEXT_STRONG, CARD_FRAME, CARD_IMG, Skeleton, TAG_STYLE, UnderlineTabs, BTN_OUTLINE, H2, cn, tripPath } from '../components/ui-bits';

const COVER = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&h=400&fit=crop&auto=format';

const VIBE_OPTIONS = [
  'Mountains', 'Beaches', 'Culture', 'Adventure', 'Wildlife', 'Road Trip',
  'Trekking', 'Photography', 'Food & Cafés', 'Nightlife', 'Relaxation', 'Slow travel',
];

type ProfileTab = 'hosted' | 'joined';
type ViewState = 'loading' | 'error' | 'ready';

interface ProfileReview {
  id: string;
  rating: number;
  text: string | null;
  createdAt: string;
  trip: { id: string; destination: string };
  reviewer: { id: string; name: string; avatar: string | null };
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
function socialLabel(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('instagram.com')) return 'Instagram';
  if (u.includes('linkedin.com')) return 'LinkedIn';
  return 'Profile';
}

// Inline brand SVGs (monochrome via currentColor → stays soft/consistent with the pill).
function SocialIcon({ url, size = 16 }: { url: string; size?: number }) {
  const u = url.toLowerCase();
  if (u.includes('instagram.com')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772 4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 1.802c-2.67 0-2.986.01-4.04.058-.976.045-1.505.207-1.858.344-.466.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.048 1.055-.058 1.37-.058 4.041 0 2.67.01 2.986.058 4.04.045.977.207 1.505.344 1.858.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058 2.67 0 2.987-.01 4.04-.058.977-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041 0-2.67-.01-2.986-.058-4.04-.045-.977-.207-1.505-.344-1.858a3.097 3.097 0 0 0-.748-1.15 3.098 3.098 0 0 0-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.055-.048-1.37-.058-4.041-.058zm0 3.063a5.135 5.135 0 1 1 0 10.27 5.135 5.135 0 0 1 0-10.27zm0 8.468a3.333 3.333 0 1 0 0-6.666 3.333 3.333 0 0 0 0 6.666zm6.538-8.671a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" />
      </svg>
    );
  }
  if (u.includes('linkedin.com')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
      </svg>
    );
  }
  return <Link2 size={size} />;
}

// Trust checklist: Google email (auto) + phone OTP (Firebase) → blue tick.
function VerificationPanel({ user, onVerified }: { user: AuthUser; onVerified: (partial: Partial<AuthUser>) => void }) {
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const sendCode = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Enter a valid phone number with country code, e.g. +919876543210.');
      return;
    }
    const fullPhone = phone.trim().startsWith('+') ? phone.trim() : `+91${digits}`;
    setBusy(true);
    setError('');
    try {
      const { firebaseAuth, RecaptchaVerifier, signInWithPhoneNumber } = await loadFirebase();
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', { size: 'invisible' });
      }
      const result = await signInWithPhoneNumber(firebaseAuth, fullPhone, recaptchaRef.current);
      setConfirmation(result);
    } catch (err) {
      console.error('[VerificationPanel] sendCode failed', err);
      const code = (err as { code?: string }).code ?? '';
      setError(
        code === 'auth/invalid-phone-number'
          ? 'That phone number looks invalid. Include the country code, e.g. +91.'
          : code === 'auth/too-many-requests'
            ? 'Too many attempts. Please wait a while and try again.'
            : `Could not send the code${code ? ` (${code})` : ''}. Please try again.`,
      );
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!confirmation) return;
    setBusy(true);
    setError('');
    try {
      const cred = await confirmation.confirm(code.trim());
      const idToken = await cred.user.getIdToken();
      await (await loadFirebase()).firebaseAuth.signOut();
      const { data } = await api.post('/users/me/phone/verify', { idToken });
      onVerified(data);
      setPhoneOpen(false);
      setConfirmation(null);
      setPhone('');
      setCode('');
    } catch (err) {
      console.error('[VerificationPanel] verifyCode failed', err);
      setError(apiErrorMessage(err, 'Wrong or expired code. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    { key: 'email', label: 'Google email verified', done: true, icon: Mail },
    { key: 'phone', label: 'Phone number verified', done: user.phoneVerified, icon: Phone },  ];

  return (
    <div className="mt-6 border border-[#DDDDDD] rounded-2xl p-5">
      <p className="text-base font-semibold text-[#222222] flex items-center gap-1.5">
        <BadgeCheck size={16} className="text-blue-600" /> Get the blue tick
      </p>
      <p className="text-sm text-[#6A6A6A] mt-0.5">Complete both to show other travellers your account is genuine.</p>

      <div className="mt-3 divide-y divide-[#DDDDDD]">
        {steps.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-2 text-sm text-[#222222]">
              <s.icon size={16} className="text-[#6A6A6A]" /> {s.label}
            </span>
            {s.done ? (
              <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                <Check size={14} /> Done
              </span>
            ) : s.key === 'phone' ? (
              <button
                onClick={() => setPhoneOpen((v) => !v)}
                className="text-sm font-semibold text-[#222222] underline underline-offset-4"
              >
                Verify
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {phoneOpen && (
        <div className="mt-3 border-t border-[#DDDDDD] pt-4 space-y-2">
          {!confirmation ? (
            <>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full border border-[#DDDDDD] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <button
                onClick={sendCode}
                disabled={busy}
                className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Send OTP'}
              </button>
            </>
          ) : (
            <>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full border border-[#DDDDDD] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <button
                onClick={verifyCode}
                disabled={busy}
                className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-60"
              >
                {busy ? 'Verifying…' : 'Verify OTP'}
              </button>
            </>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
      <div id="recaptcha-container" />
    </div>
  );
}

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Tab is synced to the URL (?tab=hosted | ?tab=joined).
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: ProfileTab = searchParams.get('tab') === 'joined' ? 'joined' : 'hosted';
  const setTab = (t: ProfileTab) => setSearchParams({ tab: t });

  // Edit modal is deep-linked via ?modal=editProfile (preserves ?tab).
  const isEditOpen = searchParams.get('modal') === 'editProfile';
  const openEdit = () =>
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('modal', 'editProfile');
      return p;
    });
  const closeEdit = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      navigate(-1);
    } else {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete('modal');
          return p;
        },
        { replace: true },
      );
    }
  };

  const [cached] = useState(() => ({
    hosted: cachedGet<Trip[]>('/trips/hosted'),
    joined: cachedGet<Trip[]>('/trips/joined'),
    me: user ? cachedGet<{ reviews: ProfileReview[]; avgRating: number | null }>(`/users/${user.id}`) : undefined,
  }));
  const [hosted, setHosted] = useState<Trip[]>(cached.hosted ?? []);
  const [joined, setJoined] = useState<Trip[]>(cached.joined ?? []);
  const [view, setView] = useState<ViewState>(cached.hosted && cached.joined ? 'ready' : 'loading');
  const [reviews, setReviews] = useState<ProfileReview[]>(cached.me?.reviews ?? []);
  const [avgRating, setAvgRating] = useState<number | null>(cached.me?.avgRating ?? null);

  const fetchTrips = async () => {
    setView((v) => (v === 'ready' ? v : 'loading')); // cached trips stay up while refreshing
    try {
      const [hostedRes, joinedRes, meRes] = await Promise.all([
        api.get<Trip[]>('/trips/hosted'),
        api.get<Trip[]>('/trips/joined'),
        user ? api.get<{ reviews: ProfileReview[]; avgRating: number | null }>(`/users/${user.id}`) : null,
      ]);
      setHosted(hostedRes.data);
      setJoined(joinedRes.data);
      if (meRes) {
        setReviews(meRes.data.reviews);
        setAvgRating(meRes.data.avgRating);
      }
      setView('ready');
    } catch (error) {
      console.error('[Profile] fetch failed', error);
      setView((v) => (v === 'ready' ? v : 'error'));
    }
  };

  useEffect(() => {
    void fetchTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount, like the other pages' fetch-on-load
  }, []);

  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  const deleteTrip = async (trip: Trip) => {
    if (!window.confirm(`Delete your ${trip.destination} trip? Everyone who asked to join will lose their request.`)) return;
    try {
      await api.delete(tripPath(trip));
      setHosted((rows) => rows.filter((t) => t.id !== trip.id));
    } catch (err) {
      console.error('[Profile] delete trip failed', err);
      window.alert(apiErrorMessage(err, 'Could not delete the trip. Please try again.'));
    }
  };

  const name = user?.name ?? 'Traveller';
  const vibes = user?.tags?.length ? user.tags : ['Mountains', 'Photography', 'Slow travel'];
  const list = tab === 'hosted' ? hosted : joined;

  const TABS: { id: ProfileTab; label: string; count: number }[] = [
    { id: 'hosted', label: 'Hosted Trips', count: hosted.length },
    { id: 'joined', label: 'Joined Trips', count: joined.length },
  ];

  const social = user?.socialHandle;

  return (
    <div className="pb-28 lg:pb-10 max-w-4xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="relative">
        <div className="h-40 sm:h-52 rounded-2xl overflow-hidden bg-slate-100">
          <img src={user?.coverImage || COVER} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute -bottom-8 left-5">
          <Avatar src={user?.avatar ?? null} name={name} size={88} ring ringWidth={4} />
        </div>
      </div>

      <div className="mt-12 px-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[26px] font-semibold leading-tight text-[#222222] truncate">{name}</h1>
              {user?.verified && (
                <span title="Verified account" className="text-blue-600 shrink-0">
                  <BadgeCheck size={20} />
                </span>
              )}
            </div>
            <p className="text-[#6A6A6A] flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mt-1">
              {avgRating !== null && (
                <span className="flex items-center gap-1 font-semibold text-[#222222]">
                  <Star size={14} fill="currentColor" />
                  {avgRating} <span className="text-[#6A6A6A] font-normal">({reviews.length})</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin size={14} /> {user?.location ?? 'Traveler'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openEdit}
              className={cn(BTN_OUTLINE, "gap-2 px-5 py-2.5")}
            >
              <Pencil size={15} /> Edit Profile
            </button>
            {/* Mobile-only sign out; the sidebar handles logout on desktop (lg+) */}
            <button
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="flex lg:hidden items-center justify-center w-10 h-10 border border-[#222222] text-[#222222] rounded-full hover:bg-slate-50 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <p className="text-[#222222] text-base mt-5 leading-relaxed">
          {user?.bio ?? 'Adventurer at heart, here to find a travel tribe and explore India together.'}
        </p>

        {/* Trust signal: social proof link */}
        {social && (
          <a
            href={normalizeUrl(social)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-[#222222] underline underline-offset-4"
          >
            <SocialIcon url={social} size={16} /> {socialLabel(social)}
          </a>
        )}

        <div className="flex flex-wrap gap-2 mt-5">
          {vibes.map((v) => (
            <span key={v} className="px-3 py-1.5 rounded-full border border-[#DDDDDD] text-[#222222] text-[13px] font-medium">
              {v}
            </span>
          ))}
        </div>

        {user && !user.verified && <VerificationPanel user={user} onVerified={updateUser} />}
      </div>

      {/* ── Reviews about you ───────────────────────────────────────────────── */}
      {reviews.length > 0 && (
        <div className="mt-10 px-1">
          <h2 className={cn(H2, 'mb-2')}>
            Reviews about you <span className="ml-1 text-[#6A6A6A] font-normal">· {reviews.length}</span>
          </h2>
          <div className="divide-y divide-[#DDDDDD]">
            {reviews.map((r) => (
              <div key={r.id} className="py-5">
                <div className="flex items-center gap-3">
                  <Avatar src={r.reviewer.avatar} name={r.reviewer.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[#222222] font-semibold text-sm truncate">{r.reviewer.name}</p>
                    <p className="text-[#6A6A6A] text-xs truncate">{r.trip.destination}</p>
                  </div>
                  <div className="flex gap-0.5 shrink-0 text-[#222222]">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={13} fill={i < r.rating ? 'currentColor' : 'none'} strokeWidth={1.75} />
                    ))}
                  </div>
                </div>
                {r.text && <p className="text-[#222222] text-sm mt-2 leading-relaxed">{r.text}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="mt-10 px-1">
        <UnderlineTabs
          tabs={TABS.map((t) => ({ value: t.id, label: t.label, badge: view === 'ready' ? t.count : undefined }))}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="mt-8 px-1">
        {view === 'loading' && <TripGridSkeleton />}

        {view === 'error' && (
          <div className="py-12 text-center">
            <p className="text-[#222222] font-semibold">Couldn't load your trips.</p>
            <button
              onClick={fetchTrips}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {view === 'ready' &&
          (list.length === 0 ? (
            <EmptyState tab={tab} onCta={() => navigate(tab === 'hosted' ? '/post' : '/')} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-10">
              {list.map((trip) => (
                <ProfileTripCard
                  key={trip.id}
                  trip={trip}
                  kind={tab}
                  onEdit={() => setEditingTrip(trip)}
                  onDelete={() => deleteTrip(trip)}
                />
              ))}
            </div>
          ))}
      </div>

      {/* ── Edit Profile modal ──────────────────────────────────────────────── */}
      {isEditOpen && <EditProfileModal onClose={closeEdit} onSaved={updateUser} />}

      {/* ── Edit Trip modal ─────────────────────────────────────────────────── */}
      {editingTrip && (
        <EditTripModal
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
          onSaved={(updated) => {
            setHosted((rows) => rows.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
            setEditingTrip(null);
          }}
        />
      )}
    </div>
  );
}

/* ── Photo upload helper ────────────────────────────────────────────────────────
   Centre-crops and shrinks a picked photo in the browser before upload, so a 5 MB
   phone photo becomes a ~50-200 KB JPEG. */
const PHOTO_SIZES = { avatar: { w: 400, h: 400 }, cover: { w: 1500, h: 500 } } as const;
type PhotoKind = keyof typeof PHOTO_SIZES;

async function cropToJpeg(file: File, width: number, height: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const sw = width / scale;
  const sh = height / scale;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.85),
  );
}

/* ── Edit Profile modal (Soft UI) ───────────────────────────────────────────── */
function EditProfileModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (partial: Partial<AuthUser>) => void;
}) {
  const { user } = useAuth();
  // Photos upload as soon as they're picked (separate from "Save Changes").
  const [photoBusy, setPhotoBusy] = useState<PhotoKind | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const changePhoto = async (kind: PhotoKind, file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.');
      return;
    }
    setPhotoBusy(kind);
    try {
      let blob: Blob;
      try {
        blob = await cropToJpeg(file, PHOTO_SIZES[kind].w, PHOTO_SIZES[kind].h);
      } catch {
        throw new Error("Couldn't read that image. Try a JPEG or PNG.");
      }
      const { data } = await api.put<AuthUser>(`/users/me/photo/${kind}`, blob, { headers: { 'Content-Type': 'image/jpeg' } });
      onSaved({ avatar: data.avatar, coverImage: data.coverImage });
    } catch (err) {
      setPhotoError(err instanceof Error && !('isAxiosError' in err) ? err.message : apiErrorMessage(err, 'Upload failed. Please try again.'));
    } finally {
      setPhotoBusy(null);
    }
  };

  const removePhoto = async (kind: PhotoKind) => {
    setPhotoError(null);
    setPhotoBusy(kind);
    try {
      const { data } = await api.delete<AuthUser>(`/users/me/photo/${kind}`);
      onSaved({ avatar: data.avatar, coverImage: data.coverImage });
    } catch (err) {
      setPhotoError(apiErrorMessage(err, 'Could not remove the photo. Please try again.'));
    } finally {
      setPhotoBusy(null);
    }
  };
  const [location, setLocation] = useState(user?.location ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [social, setSocial] = useState(user?.socialHandle ?? '');
  const [gender, setGender] = useState(user?.gender ?? '');
  const [vibes, setVibes] = useState<string[]>(user?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock background scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const toggleVibe = (v: string) =>
    setVibes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    // Payload is structured for PATCH /api/users/me (real endpoint).
    const payload = {
      bio: bio.trim(),
      location: location.trim(),
      socialHandle: social.trim(),
      tags: vibes,
      gender,
    };
    try {
      const { data } = await api.patch('/users/me', payload);
      onSaved({
        bio: data.bio ?? null,
        location: data.location ?? null,
        socialHandle: data.socialHandle ?? null,
        tags: data.tags ?? [],
        gender: data.gender ?? null,
      });
      onClose();
    } catch (err) {
      console.error('[Profile] save failed', err);
      setError('Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[88vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-[#222222]">Edit Profile</h2>
          <button onClick={onClose} aria-label="Close" className="text-[#6A6A6A] hover:text-[#6A6A6A] transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Cover + profile photo (upload immediately) */}
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void changePhoto('cover', e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={avatarInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void changePhoto('avatar', e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        <div className="relative">
          <div className="relative h-28 rounded-2xl overflow-hidden bg-slate-100">
            <img src={user?.coverImage || COVER} alt="" className="w-full h-full object-cover" />
            {photoBusy === 'cover' && <PhotoSpinner />}
          </div>
          <div className="absolute top-2 right-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => coverInput.current?.click()}
              disabled={photoBusy !== null}
              className="flex items-center gap-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900/75 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 transition-colors"
            >
              <Camera size={14} /> Change cover
            </button>
            {user?.coverImage && (
              <button
                type="button"
                onClick={() => void removePhoto('cover')}
                disabled={photoBusy !== null}
                aria-label="Remove cover"
                title="Remove cover"
                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-900/60 hover:bg-red-500 backdrop-blur-sm text-white disabled:opacity-60 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          <div className="flex items-end gap-3 -mt-8 ml-4">
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              disabled={photoBusy !== null}
              aria-label="Change profile photo"
              className="group relative rounded-full shrink-0"
              style={{ width: 72, height: 72 }}
            >
              <Avatar src={user?.avatar ?? null} name={user?.name ?? 'Traveller'} size={72} ring ringWidth={4} />
              <span className="absolute inset-0 rounded-full bg-slate-900/0 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
                <Camera size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
              <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-blue-600 ring-2 ring-white flex items-center justify-center text-white">
                <Camera size={12} />
              </span>
              {photoBusy === 'avatar' && <PhotoSpinner round />}
            </button>
            <div className="pb-1 flex items-center gap-3 text-[13px] font-semibold">
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                disabled={photoBusy !== null}
                className="text-blue-600 hover:text-blue-700 disabled:opacity-60"
              >
                Change photo
              </button>
              {user?.avatar && (
                <button
                  type="button"
                  onClick={() => void removePhoto('avatar')}
                  disabled={photoBusy !== null}
                  className="text-[#6A6A6A] hover:text-red-500 disabled:opacity-60"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
        {photoError && <p className="text-red-500 text-sm mt-2">{photoError}</p>}
        <p className="text-xs text-[#6A6A6A] mt-2 mb-1">Photos update right away.</p>

        {/* Location */}
        <label className="block text-sm font-semibold text-[#222222] mb-1.5">Location</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Delhi, India"
          className="w-full bg-slate-50 border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm text-[#222222] placeholder:text-[#6A6A6A] outline-none focus:border-blue-600 transition-colors"
        />

        {/* Bio */}
        <label className="block text-sm font-semibold text-[#222222] mt-4 mb-1.5">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={280}
          placeholder="Tell fellow travelers a little about you…"
          className="w-full bg-slate-50 border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm text-[#222222] placeholder:text-[#6A6A6A] outline-none focus:border-blue-600 resize-none transition-colors"
        />
        <p className="text-right text-xs text-[#6A6A6A] mt-1">{bio.length}/280</p>

        {/* Social handle */}
        <label className="block text-sm font-semibold text-[#222222] mt-2 mb-1.5">
          Instagram / LinkedIn <span className="font-normal text-[#6A6A6A]">(builds trust)</span>
        </label>
        <input
          value={social}
          onChange={(e) => setSocial(e.target.value)}
          placeholder="instagram.com/yourhandle"
          className="w-full bg-slate-50 border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm text-[#222222] placeholder:text-[#6A6A6A] outline-none focus:border-blue-600 transition-colors"
        />

        {/* Gender (used only to unlock hosting/joining women-only trips) */}
        <label className="block text-sm font-semibold text-[#222222] mt-4 mb-1.5">
          Gender <span className="font-normal text-[#6A6A6A]">(only used for women-only trips)</span>
        </label>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="w-full bg-slate-50 border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm text-[#222222] outline-none focus:border-blue-600 transition-colors"
        >
          <option value="">Prefer not to say</option>
          <option value="Woman">Woman</option>
          <option value="Man">Man</option>
        </select>

        {/* Vibes */}
        <label className="block text-sm font-semibold text-[#222222] mt-4 mb-2">Travel vibes</label>
        <div className="flex flex-wrap gap-2">
          {VIBE_OPTIONS.map((v) => {
            const on = vibes.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => toggleVibe(v)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-[13px] font-semibold border transition-colors',
                  on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-[#DDDDDD] text-[#6A6A6A] hover:border-blue-600',
                )}
              >
                {v}
              </button>
            );
          })}
        </div>

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-full border border-[#DDDDDD] text-[#6A6A6A] text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Spinner shown over a photo while it uploads. */
function PhotoSpinner({ round }: { round?: boolean }) {
  return (
    <span className={cn('absolute inset-0 flex items-center justify-center bg-white/60', round && 'rounded-full')}>
      <Loader2 size={22} className="animate-spin text-blue-600" />
    </span>
  );
}

/* ── Compact trip card (dashboard, no Join button) ─────────────────────────── */
function ProfileTripCard({
  trip,
  kind,
  onEdit,
  onDelete,
}: {
  trip: Trip;
  kind: ProfileTab;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tag = trip.tags[0];
  const spotsFilled = (trip._count?.requests ?? 0) + 1;

  return (
    <div className="relative flex flex-col h-full">
      <div className="relative">
        <Link to={tripPath(trip)} className={CARD_FRAME} tabIndex={-1} aria-hidden="true">
          <CoverImg src={trip.coverImage} size={500} sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 92vw" alt="" className={CARD_IMG} />
        </Link>
        {tag && (
          <span className={cn('absolute top-3 left-3 text-white rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm', TAG_STYLE)}>
            {tag}
          </span>
        )}
        <span className="absolute top-3 right-3 bg-white/95 text-[#222222] rounded-full px-3 py-1 flex items-center gap-1 text-xs font-semibold">
          <Users size={12} />
          {spotsFilled}/{trip.maxGuests}
        </span>
      </div>
      <div className="pt-3 flex flex-col flex-1">
        <Link to={tripPath(trip)} className={cn('text-base leading-snug font-semibold line-clamp-2 break-words mb-0.5', TEXT_STRONG, "after:absolute after:inset-0 after:content-['']")}>
          {trip.destination}
        </Link>
        <TripMeta trip={trip} />

        {/* Group progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[13px] mb-1.5">
            <span className="text-[#6A6A6A]">
              {spotsFilled} of {trip.maxGuests} spots filled
            </span>
            {kind === 'hosted' && !!trip.pendingCount && (
              <Link to="/requests" className="relative z-10 inline-flex items-center gap-1.5 font-medium text-[#2563EB] hover:underline underline-offset-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                {trip.pendingCount} waiting
              </Link>
            )}
          </div>
          <div className="h-1 rounded-full bg-[#EBEBEB] overflow-hidden">
            <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${Math.min(100, (spotsFilled / Math.max(1, trip.maxGuests)) * 100)}%` }} />
          </div>
        </div>

        {kind === 'hosted' && (
          <div className="grid grid-cols-2 gap-2 mt-auto pt-4">
            <button
              type="button"
              onClick={onEdit}
              className="relative z-10 flex items-center justify-center gap-1.5 h-10 border border-[#222222] text-[#222222] rounded-full text-[13px] font-medium hover:bg-[#F7F7F7] transition-colors"
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="relative z-10 flex items-center justify-center gap-1.5 h-10 border border-[#DDDDDD] text-[#6A6A6A] rounded-full text-[13px] font-medium hover:border-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Edit Trip modal ────────────────────────────────────────────────────────── */
function EditTripModal({
  trip,
  onClose,
  onSaved,
}: {
  trip: Trip;
  onClose: () => void;
  onSaved: (updated: Trip) => void;
}) {
  const [destination, setDestination] = useState(trip.destination);
  const [country, setCountry] = useState(trip.country);
  const [startDate, setStartDate] = useState(trip.startDate.slice(0, 10)); // yyyy-mm-dd
  const [endDate, setEndDate] = useState(trip.endDate.slice(0, 10));
  const [budget, setBudget] = useState(String(trip.budget));
  const [maxGuests, setMaxGuests] = useState(String(trip.maxGuests));
  const [description, setDescription] = useState(trip.description ?? '');
  const [womenOnly, setWomenOnly] = useState(trip.womenOnly);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Lock background scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.patch<Trip>(tripPath(trip), {
        destination: destination.trim(),
        country: country.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        budget: Number(budget),
        maxGuests: Number(maxGuests),
        tags: trip.tags,
        coverImage: trip.coverImage ?? '',
        description,
        womenOnly,
      });
      onSaved(data);
    } catch (err) {
      console.error('[Profile] edit trip failed', err);
      setError(apiErrorMessage(err, 'Could not save changes. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const input =
    'w-full bg-slate-50 border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm text-[#222222] placeholder:text-[#6A6A6A] outline-none focus:border-blue-600 transition-colors';
  const label = 'block text-sm font-semibold text-[#222222] mt-4 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[88vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-semibold text-[#222222]">Edit Trip</h2>
          <button onClick={onClose} aria-label="Close" className="text-[#6A6A6A] hover:text-[#6A6A6A] transition-colors">
            <X size={20} />
          </button>
        </div>

        <label className={label}>Destination</label>
        <input value={destination} onChange={(e) => setDestination(e.target.value)} maxLength={100} className={input} />

        <label className={label}>Region / Country</label>
        <input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={100} className={input} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>End date</label>
            <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Budget (₹)</label>
            <input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Group size</label>
            <input type="number" min={1} value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} className={input} />
          </div>
        </div>

        <label className={label}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          className={`${input} resize-none`}
        />

        {user?.gender === 'Woman' && (
          <label className="flex items-center gap-2 mt-4 text-sm font-semibold text-[#222222] cursor-pointer">
            <input type="checkbox" checked={womenOnly} onChange={(e) => setWomenOnly(e.target.checked)} className="accent-blue-600" />
            Women-only trip
          </label>
        )}

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-full border border-[#DDDDDD] text-[#6A6A6A] text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────────────── */
function EmptyState({ tab, onCta }: { tab: ProfileTab; onCta: () => void }) {
  const copy =
    tab === 'hosted'
      ? { title: "You aren't hosting any trips yet.", sub: 'Plan a trip and gather your travel tribe.', cta: 'Post a trip' }
      : { title: "You haven't joined any trips yet.", sub: 'Find a group heading where you want to go.', cta: 'Explore trips' };
  return (
    <div className="py-12 text-center flex flex-col items-center">
      <div className="w-16 h-16 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#222222] mb-4">
        <Compass size={30} />
      </div>
      <h3 className="text-[#222222] text-xl font-semibold">{copy.title}</h3>
      <p className="text-[#6A6A6A] text-sm mt-1 max-w-xs">{copy.sub}</p>
      <button
        onClick={onCta}
        className="mt-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
      >
        {copy.cta}
      </button>
    </div>
  );
}

/* ── Skeleton ───────────────────────────────────────────────────────────────── */
function TripGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-10">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[16/10] rounded-2xl" />
          <div className="pt-3 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}
