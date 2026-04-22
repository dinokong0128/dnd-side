import type { Mood, SceneType } from './scene'

/**
 * Variant-selection manifest for `SceneBackground`.
 *
 * Each scene has 4 variants whose filenames map to an affinity:
 *   1.webp — serene       (warm, calm, idyllic)
 *   2.webp — dramatic     (warm, high-energy, dynamic)
 *   3.webp — melancholic  (dim, quiet, reflective)
 *   4.webp — ominous      (dim, tense, foreboding)
 *
 * The DM's `<scene mood="...">` attribute steers the picker toward the
 * variant whose affinity matches the narrative tone. When no mood is
 * emitted, the picker defaults to the serene variant.
 */

export type VariantAffinity = 'serene' | 'dramatic' | 'melancholic' | 'ominous'

export const SCENE_VARIANT_COUNT = 4

/** Mood → variant-affinity mapping. Every mood has exactly one primary. */
export const MOOD_AFFINITY: Record<Mood, VariantAffinity> = {
  combat: 'dramatic',
  tense: 'ominous',
  stealth: 'ominous',
  somber: 'melancholic',
  mystery: 'ominous',
  victory: 'serene',
}

/** Affinity → variant-number (1-indexed filename). */
export const VARIANT_BY_AFFINITY: Record<VariantAffinity, number> = {
  serene: 1,
  dramatic: 2,
  melancholic: 3,
  ominous: 4,
}

/**
 * Pick a variant for the given scene + mood, avoiding an immediate repeat
 * of `lastVariant` when possible.
 *
 * - No mood: prefer `serene` (variant 1).
 * - With mood: prefer the variant whose affinity matches `MOOD_AFFINITY[mood]`.
 * - If the preferred variant equals `lastVariant`, rotate to a different
 *   variant (cycles 1 → 2 → 3 → 4 → 1).
 *
 * `sceneType` is currently unused — all 13 scenes share the same 1/2/3/4
 * convention. The parameter is kept so individual scenes can override the
 * mapping later without touching the call site.
 */
export function pickVariantFor(
  _sceneType: SceneType,
  mood: Mood | null,
  lastVariant: number,
): number {
  const affinity = mood ? MOOD_AFFINITY[mood] : 'serene'
  const preferred = VARIANT_BY_AFFINITY[affinity]
  if (preferred !== lastVariant) return preferred
  return (preferred % SCENE_VARIANT_COUNT) + 1
}
