// Tracks whether the backend looks like it's waking up from a cold start (Render's free
// tier spins down after inactivity; the first request can take 30-50s). Any request that's
// still pending after WAKE_THRESHOLD_MS flips this on; it flips off once nothing slow is
// still in flight. Plain pub/sub (not React state) so api.ts, a non-component module, can
// drive it — components read it through the useServerWaking hook below.
import { useEffect, useState } from 'react';

const WAKE_THRESHOLD_MS = 4000;
let slowRequestCount = 0;
let waking = false;
const listeners = new Set<(waking: boolean) => void>();

function setWaking(next: boolean) {
  if (next === waking) return;
  waking = next;
  listeners.forEach((l) => l(waking));
}

// Call when a request starts; call the returned function when it settles (success or error).
export function trackRequest(): () => void {
  const timer = window.setTimeout(() => {
    slowRequestCount += 1;
    setWaking(true);
  }, WAKE_THRESHOLD_MS);

  let settled = false;
  return () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    if (waking) {
      slowRequestCount = Math.max(0, slowRequestCount - 1);
      if (slowRequestCount === 0) setWaking(false);
    }
  };
}

export function useServerWaking(): boolean {
  const [value, setValue] = useState(waking);
  useEffect(() => {
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
