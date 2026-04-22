import { z } from 'zod'

export const SCENE_TYPES = [
  'tavern',
  'town_square',
  'throne_room',
  'temple',
  'forest',
  'mountain',
  'swamp',
  'desert',
  'coast',
  'dungeon',
  'cave',
  'crypt',
  'rest',
] as const

export const MOODS = [
  'combat',
  'tense',
  'victory',
  'stealth',
  'somber',
  'mystery',
] as const

export type SceneType = (typeof SCENE_TYPES)[number]
export type Mood = (typeof MOODS)[number]

export const sceneTypeSchema = z.enum(SCENE_TYPES)
export const moodSchema = z.enum(MOODS)

const _SCENE_TAG_RE = /<scene\s([^>]*?)\/>/

export function parseSceneTag(text: string): { type: SceneType; mood?: Mood } | null {
  try {
    const m = _SCENE_TAG_RE.exec(text)
    if (!m) return null

    const attrsStr = m[1]

    const typeMatch = /type="([^"]*)"/.exec(attrsStr) ?? /type='([^']*)'/.exec(attrsStr)
    if (!typeMatch) return null

    const typeResult = sceneTypeSchema.safeParse(typeMatch[1])
    if (!typeResult.success) return null

    const moodMatch = /mood="([^"]*)"/.exec(attrsStr) ?? /mood='([^']*)'/.exec(attrsStr)
    if (!moodMatch) {
      return { type: typeResult.data }
    }

    const moodResult = moodSchema.safeParse(moodMatch[1])
    if (!moodResult.success) return null

    return { type: typeResult.data, mood: moodResult.data }
  } catch {
    return null
  }
}

export function stripSceneTag(text: string): string {
  return text.replace(_SCENE_TAG_RE, '')
}
