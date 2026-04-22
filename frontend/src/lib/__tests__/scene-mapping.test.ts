import { SCENE_TO_BUCKET, type SceneBucket } from '../scene-mapping'
import { SCENE_TYPES } from '../scene'

const VALID_BUCKETS: SceneBucket[] = ['tavern', 'town', 'solemn', 'forest', 'dungeon', 'adventure']

describe('SCENE_TO_BUCKET', () => {
  it('maps every SceneType to a valid bucket', () => {
    SCENE_TYPES.forEach((sceneType) => {
      const bucket = SCENE_TO_BUCKET[sceneType]
      expect(VALID_BUCKETS).toContain(bucket)
    })
  })

  it('maps tavern to tavern bucket', () => {
    expect(SCENE_TO_BUCKET['tavern']).toBe('tavern')
  })

  it('maps dungeon, cave, crypt to dungeon bucket', () => {
    expect(SCENE_TO_BUCKET['dungeon']).toBe('dungeon')
    expect(SCENE_TO_BUCKET['cave']).toBe('dungeon')
    expect(SCENE_TO_BUCKET['crypt']).toBe('dungeon')
  })

  it('maps throne_room and temple to solemn bucket', () => {
    expect(SCENE_TO_BUCKET['throne_room']).toBe('solemn')
    expect(SCENE_TO_BUCKET['temple']).toBe('solemn')
  })

  it('maps outdoor scenes to forest bucket', () => {
    expect(SCENE_TO_BUCKET['forest']).toBe('forest')
    expect(SCENE_TO_BUCKET['mountain']).toBe('forest')
    expect(SCENE_TO_BUCKET['swamp']).toBe('forest')
    expect(SCENE_TO_BUCKET['desert']).toBe('forest')
    expect(SCENE_TO_BUCKET['coast']).toBe('forest')
  })

  it('maps town_square to town bucket', () => {
    expect(SCENE_TO_BUCKET['town_square']).toBe('town')
  })

  it('maps rest to adventure bucket', () => {
    expect(SCENE_TO_BUCKET['rest']).toBe('adventure')
  })

  it('covers exactly 13 scene types', () => {
    expect(Object.keys(SCENE_TO_BUCKET)).toHaveLength(13)
  })
})
