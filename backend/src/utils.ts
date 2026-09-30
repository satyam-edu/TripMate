// Tags must be an array of at most 12 non-empty strings, each ≤ 30 chars.
export function isValidTags(tags: unknown): tags is string[] {
  return (
    Array.isArray(tags) &&
    tags.length <= 12 &&
    tags.every((t) => typeof t === 'string' && t.length > 0 && t.length <= 30)
  );
}
