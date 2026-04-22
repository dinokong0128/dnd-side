import type { SceneType } from './scene'

export type SceneBucket = 'tavern' | 'town' | 'solemn' | 'forest' | 'dungeon' | 'adventure'

export const SCENE_TO_BUCKET: Record<SceneType, SceneBucket> = {
  tavern:       'tavern',
  town_square:  'town',
  throne_room:  'solemn',
  temple:       'solemn',
  forest:       'forest',
  mountain:     'forest',
  swamp:        'forest',
  desert:       'forest',
  coast:        'forest',
  dungeon:      'dungeon',
  cave:         'dungeon',
  crypt:        'dungeon',
  rest:         'adventure',
}
