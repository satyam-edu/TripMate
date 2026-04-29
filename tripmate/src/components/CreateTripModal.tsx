import { useRef, useState } from 'react';
import { Calendar, Check, X } from 'lucide-react';
import api from '../services/api';

interface CreateTripModalProps {
  onClose: () => void;
}

interface TripFormData {
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  budget: string;
  maxGroupSize: number;
  vibes: string[];
  description: string;
}

const EMPTY_FORM: TripFormData = {
  city: '',
  country: '',
  startDate: '',
  endDate: '',
  budget: '',
  maxGroupSize: 4,
  vibes: [],
  description: '',
};

const POPULAR_DESTINATIONS = [
  'Manali', 'Leh Ladakh', 'Spiti Valley', 'Rishikesh', 'Mussoorie', 'Tirthan Valley',
] as const;

const TRIP_VIBES = [
  'Relaxing', 'Adventure', 'Religious/Spiritual', 'Road Trip', 'Trekking', 'Party', 'Nature',
] as const;

const LABEL = 'text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block';
const INPUT = 'w-full bg-transparent border-b border-slate-200 py-2 outline-none focus:border-sky-500 text-slate-900 text-lg placeholder:text-slate-300 transition-colors';

function formatDisplayDate(iso: string): string {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

// ── Premium Date Input ─────────────────────────────────────────────────────────
function DateInput({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div
        className="relative flex items-center border-b border-slate-200 focus-within:border-sky-500 transition-colors cursor-pointer"
        onClick={() => ref.current?.click()}
      >
        <span className={`flex-1 py-2 text-lg select-none ${value ? 'text-slate-900' : 'text-slate-300'}`}>
          {value ? formatDisplayDate(value) : 'Select a date'}
        </span>
        <Calendar className="w-5 h-5 text-slate-400 shrink-0 pointer-events-none" />
        <input
          ref={ref}
          type="date"
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}

export default function CreateTripModal({ onClose }: CreateTripModalProps) {
  const [step, setStep]                 = useState<number>(1);
  const [form, setForm]                 = useState<TripFormData>(EMPTY_FORM);
  const [imageFile, setImageFile]       = useState<File | null>(null);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const update = <K extends keyof TripFormData>(key: K, value: TripFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleVibe = (vibe: string) =>
    setForm((prev) => ({
      ...prev,
      vibes: prev.vibes.includes(vibe)
        ? prev.vibes.filter((v) => v !== vibe)
        : [...prev.vibes, vibe],
    }));

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  const handlePublish = async (): Promise<void> => {
    setIsPublishing(true);
    try {
      setErrorMessage(null);
      const missing: string[] = [];
      if (!form.city)      missing.push('City');
      if (!form.country)   missing.push('Country');
      if (!form.startDate) missing.push('Start Date');
      if (!form.endDate)   missing.push('End Date');
      if (!form.budget || form.budget === '0') missing.push('Budget');

      if (missing.length > 0) {
        setErrorMessage(`Required fields missing: ${missing.join(', ')}`);
        setIsPublishing(false);
        return;
      }

      let imageUrl = '';

      if (imageFile) {
        const cloudinaryData = new FormData();
        cloudinaryData.append('file', imageFile);
        cloudinaryData.append('upload_preset', 'tripmate_uploads');

        const imgRes = await fetch(
          'https://api.cloudinary.com/v1_1/dhsv5tuho/image/upload',
          { method: 'POST', body: cloudinaryData }
        );
        const imgData: { secure_url?: string } = await imgRes.json();
        imageUrl = imgData.secure_url ?? '';
      }

      await api.post('/trips', {
        destination: form.city.trim(),
        country:     form.country.trim(),
        startDate:   new Date(form.startDate).toISOString(),
        endDate:     new Date(form.endDate).toISOString(),
        budget:      parseInt(form.budget.toString().replace(/\D/g, ''), 10) || 0,
        maxGuests:   parseInt(form.maxGroupSize.toString(), 10),
        tags:        form.vibes,
        coverImage:  imageUrl,
        description: form.description,
      });
      setStep(5);
    } catch (error: unknown) {
      console.error('[handlePublish]', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to publish trip.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col md:p-4 md:bg-slate-900/40 md:items-center md:justify-center">
      <div className="w-full h-full flex flex-col md:max-w-[480px] md:h-[85vh] md:bg-slate-50 md:rounded-[2rem] overflow-hidden">

        {/* ── Header (steps 1–4) ────────────────────────────────────────── */}
        {step < 5 && (
          <div className="px-6 pt-12 md:pt-8 pb-4 bg-white md:bg-slate-50 shrink-0">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-slate-900">Plan a New Trip</h1>
              <button
                type="button"
                onClick={onClose}
                className="hidden md:flex w-8 h-8 rounded-full items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-1.5 mb-1.5">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-sky-500' : 'bg-slate-200'}`}
                />
              ))}
            </div>
            <p className="text-[11px] text-slate-400">Step {step} of 4</p>
          </div>
        )}

        {/* ── Step Content ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* Step 1 — Destination */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-6">Where are you going?</h2>

              <div className="mb-6">
                <label className={LABEL}>City / Place</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  placeholder="e.g., Manali, Rishikesh"
                  className={INPUT}
                />
              </div>

              <div className="mb-8">
                <label className={LABEL}>Country</label>
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => update('country', e.target.value)}
                  placeholder="e.g., India"
                  className={INPUT}
                />
              </div>

              <p className={LABEL}>Popular Destinations</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {POPULAR_DESTINATIONS.map((dest) => (
                  <button
                    key={dest}
                    type="button"
                    onClick={() => update('city', dest)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      form.city === dest
                        ? 'bg-sky-500 text-white border-sky-500'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {dest}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Dates & Budget */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-6">When and how much?</h2>

              <div className="mb-6">
                <DateInput
                  label="Start Date"
                  value={form.startDate}
                  onChange={(v) => update('startDate', v)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="mb-8">
                <DateInput
                  label="End Date"
                  value={form.endDate}
                  onChange={(v) => update('endDate', v)}
                  min={form.startDate || new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className={LABEL}>Budget per Person (INR)</label>
                <div className="flex items-end gap-2 border-b border-slate-200 focus-within:border-sky-500 transition-colors">
                  <span className="text-2xl font-light text-slate-400 pb-2 leading-none">₹</span>
                  <input
                    type="number"
                    value={form.budget}
                    onChange={(e) => update('budget', e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-transparent py-2 outline-none text-slate-900 text-lg placeholder:text-slate-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Group Details */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-6">Group details</h2>

              <div className="mb-8">
                <p className={LABEL}>Maximum Group Size</p>
                <div className="flex items-center gap-6 mt-4">
                  <button
                    type="button"
                    onClick={() => update('maxGroupSize', Math.max(2, form.maxGroupSize - 1))}
                    className="w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xl text-slate-600 hover:border-slate-400 transition-colors"
                  >
                    −
                  </button>
                  <span className="text-3xl font-bold text-slate-900 w-8 text-center">
                    {form.maxGroupSize}
                  </span>
                  <button
                    type="button"
                    onClick={() => update('maxGroupSize', form.maxGroupSize + 1)}
                    className="w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xl text-slate-600 hover:border-slate-400 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <p className={LABEL}>Trip Vibe</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {TRIP_VIBES.map((vibe) => (
                    <button
                      key={vibe}
                      type="button"
                      onClick={() => toggleVibe(vibe)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                        form.vibes.includes(vibe)
                          ? 'bg-sky-500 text-white border-sky-500'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {vibe}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Description & Summary */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-6">Trip description</h2>

              <div className="mb-6">
                <label className={LABEL}>Cover Photo (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-600 hover:file:bg-sky-100 mb-2"
                />
                {imageFile && (
                  <p className="text-xs text-slate-400 truncate">{imageFile.name}</p>
                )}
              </div>

              <div className="mb-8">
                <label className={LABEL}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => update('description', e.target.value.slice(0, 500))}
                  placeholder="Tell travellers what makes this trip special..."
                  rows={4}
                  className="w-full bg-transparent border-b border-slate-200 py-2 outline-none focus:border-sky-500 text-slate-900 text-base placeholder:text-slate-300 resize-none transition-colors"
                />
                <p className="text-xs text-slate-400 text-right mt-1">
                  {form.description.length} / 500
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className={LABEL}>Trip Summary</p>
                <div className="space-y-2.5 text-sm mt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destination</span>
                    <span className="font-semibold text-slate-900">
                      {form.city || '—'}{form.country ? `, ${form.country}` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dates</span>
                    <span className="font-semibold text-slate-900">
                      {form.startDate ? formatDisplayDate(form.startDate) : '—'}
                      {' → '}
                      {form.endDate ? formatDisplayDate(form.endDate) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Budget</span>
                    <span className="font-semibold text-slate-900">
                      {form.budget ? `₹${Number(form.budget).toLocaleString('en-IN')}` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Group Size</span>
                    <span className="font-semibold text-slate-900">{form.maxGroupSize} people</span>
                  </div>
                  {form.vibes.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vibes</span>
                      <span className="font-semibold text-slate-900 text-right max-w-[55%]">
                        {form.vibes.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 5 — Success */}
          {step === 5 && (
            <div className="relative flex flex-col items-center justify-center text-center h-full py-20">
              <button
                type="button"
                onClick={onClose}
                className="hidden md:flex absolute top-0 right-0 w-8 h-8 rounded-full items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-20 h-20 rounded-[1.5rem] bg-slate-900 flex items-center justify-center mb-6 shadow-lg">
                <Check className="w-10 h-10 text-white" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Trip Published!</h2>
              <p className="text-slate-500 text-sm max-w-[240px] leading-relaxed">
                Your trip to{' '}
                <span className="font-semibold text-slate-800">
                  {form.city || 'your destination'}
                </span>{' '}
                is now live. Travellers can start requesting to join.
              </p>
            </div>
          )}

        </div>

        {/* ── Sticky Footer ────────────────────────────────────────────── */}
        {step < 5 && (
          <div className="mt-auto bg-white p-4 pb-24 md:pb-4 border-t border-slate-100 flex flex-col gap-3 shrink-0">
            {step === 4 && errorMessage && (
              <div className="text-red-500 text-sm text-center font-medium">
                {errorMessage}
              </div>
            )}
            <div className="flex justify-between items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={back}
                className="px-6 py-3 bg-slate-50 text-slate-900 font-semibold rounded-2xl text-sm hover:bg-slate-100 transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={step === 4 ? handlePublish : next}
              disabled={step === 4 && isPublishing}
              className={`flex-1 py-3 font-semibold rounded-2xl text-sm text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                step === 4 ? 'bg-sky-500 hover:bg-sky-600' : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {step === 4 ? (isPublishing ? 'Publishing…' : 'Publish Trip') : 'Continue'}
            </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
