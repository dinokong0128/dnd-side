/** Split content into display paragraphs using the same rule as the streaming bubble. */
export function splitParagraphs(text: string): string[] {
  return text.split('\n\n').filter((p) => p.length > 0)
}

let cachedSegmenter: Intl.Segmenter | null = null

function getGraphemeSegmenter(): Intl.Segmenter | null {
  if (cachedSegmenter) return cachedSegmenter
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    cachedSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return cachedSegmenter
  }
  return null
}

/**
 * Split `text` into grapheme clusters so emoji, combining marks, and other
 * multi-code-unit glyphs aren't torn mid-character when we slice for the
 * typewriter reveal. Falls back to code-point iteration when
 * `Intl.Segmenter` is unavailable — still better than UTF-16 `.length`/`.slice`.
 */
export function graphemesOf(text: string): string[] {
  if (text.length === 0) return []
  const segmenter = getGraphemeSegmenter()
  if (segmenter) {
    const out: string[] = []
    for (const { segment } of segmenter.segment(text)) out.push(segment)
    return out
  }
  return Array.from(text)
}
