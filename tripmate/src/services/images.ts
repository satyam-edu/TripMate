// Wikipedia serves a fixed set of thumbnail widths; give the browser all of them so each screen
// downloads only the size it needs (a phone tile gets 330px, a big retina card gets 960px).
const WIKI_WIDTHS = [330, 500, 960] as const;
const WIKI_THUMB = /\/(\d+)px-/;
export function wikiSrcSet(url: string): string | undefined {
  return url.includes('upload.wikimedia.org') || url.includes('thumb.wikimedia.org')
    ? WIKI_WIDTHS.map((w) => `${url.replace(WIKI_THUMB, `/${w}px-`)} ${w}w`).join(', ')
    : undefined;
}


