// Tags must be an array of at most 12 non-empty strings, each ≤ 30 chars.
export function isValidTags(tags: unknown): tags is string[] {
  return (
    Array.isArray(tags) &&
    tags.length <= 12 &&
    tags.every((t) => typeof t === 'string' && t.length > 0 && t.length <= 30)
  );
}

// True when a caught Prisma error has the given code (e.g. 'P2002' for a unique constraint).
export function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === code
  );
}

// "Udaipur Royal Heritage, India" → "udaipur-royal-heritage-india". Empty when nothing usable is left.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
}

export const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
