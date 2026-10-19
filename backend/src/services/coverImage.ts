// Finds a cover photo for a destination from Wikipedia (free, no API key).
// Falls back to a seeded random photo when the place has no usable page or the lookup fails.
const UA = 'TripMate/1.0 (https://www.tripmateapp.tech)';

async function wikiThumb(title: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const page = (await res.json()) as { type?: string; thumbnail?: { source?: string } };
    const src = page.thumbnail?.source;
    // "disambiguation" pages (e.g. "Manali") have no useful photo.
    if (page.type !== 'standard' || !src) return null;
    return src.split('?')[0]!.replace(/\/\d+px-/, '/960px-');
  } catch {
    return null;
  }
}

export async function findCoverImage(destination: string, country: string): Promise<string> {
  const place = destination.split(',')[0]!.trim() || 'travel';
  const found = (await wikiThumb(place)) ?? (await wikiThumb(`${place}, ${country}`));
  return found ?? `https://picsum.photos/seed/${encodeURIComponent(place)}/800/600`;
}
