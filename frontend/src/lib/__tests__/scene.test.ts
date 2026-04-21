import { parseSceneTag, stripSceneTag, SCENE_TYPES, MOODS } from '../scene'

describe('SCENE_TYPES and MOODS constants', () => {
  it('exports 13 scene types', () => {
    expect(SCENE_TYPES).toHaveLength(13)
  })

  it('exports 6 moods', () => {
    expect(MOODS).toHaveLength(6)
  })

  it('includes expected scene types', () => {
    const expected = ['tavern', 'town_square', 'throne_room', 'temple', 'forest', 'mountain', 'swamp', 'desert', 'coast', 'dungeon', 'cave', 'crypt', 'rest']
    expected.forEach((s) => expect(SCENE_TYPES).toContain(s))
  })

  it('includes expected moods', () => {
    const expected = ['combat', 'tense', 'victory', 'stealth', 'somber', 'mystery']
    expected.forEach((m) => expect(MOODS).toContain(m))
  })
})

describe('parseSceneTag', () => {
  it('parses a valid scene tag with type only', () => {
    const result = parseSceneTag('Some narrative <scene type="forest"/> more text')
    expect(result).toEqual({ type: 'forest', mood: undefined })
  })

  it('parses a valid scene tag with type and mood', () => {
    const result = parseSceneTag('<scene type="dungeon" mood="combat"/>')
    expect(result).toEqual({ type: 'dungeon', mood: 'combat' })
  })

  it('parses a valid scene tag with mood before type (attribute reordering)', () => {
    const result = parseSceneTag('<scene mood="tense" type="tavern"/>')
    expect(result).toEqual({ type: 'tavern', mood: 'tense' })
  })

  it('returns null when no scene tag is present', () => {
    expect(parseSceneTag('The goblin attacks.')).toBeNull()
  })

  it('returns null for unknown scene type', () => {
    expect(parseSceneTag('<scene type="library"/>')).toBeNull()
  })

  it('returns null for unknown mood', () => {
    expect(parseSceneTag('<scene type="forest" mood="angry"/>')).toBeNull()
  })

  it('returns null for malformed tag (missing type)', () => {
    expect(parseSceneTag('<scene mood="combat"/>')).toBeNull()
  })

  it('tolerates extra whitespace in the tag', () => {
    const result = parseSceneTag('<scene  type="cave"  />')
    expect(result).toEqual({ type: 'cave', mood: undefined })
  })

  it('never throws on any input', () => {
    expect(() => parseSceneTag('')).not.toThrow()
    expect(() => parseSceneTag('<scene type=')).not.toThrow()
    expect(() => parseSceneTag('<scene />')).not.toThrow()
  })
})

describe('stripSceneTag', () => {
  it('removes the scene tag from text', () => {
    const text = 'You enter the tavern. <scene type="tavern"/> The innkeeper nods.'
    expect(stripSceneTag(text)).toBe('You enter the tavern.  The innkeeper nods.')
  })

  it('is a no-op when no scene tag is present', () => {
    const text = 'The goblin attacks with a rusty sword.'
    expect(stripSceneTag(text)).toBe(text)
  })

  it('removes the tag even when mood is present', () => {
    const text = 'Swords clash. <scene type="dungeon" mood="combat"/> Blood spills.'
    expect(stripSceneTag(text)).not.toContain('<scene')
    expect(stripSceneTag(text)).toContain('Swords clash.')
    expect(stripSceneTag(text)).toContain('Blood spills.')
  })

  it('preserves leading and trailing prose', () => {
    const text = 'Prologue. <scene type="rest"/> Epilogue.'
    const stripped = stripSceneTag(text)
    expect(stripped).toContain('Prologue.')
    expect(stripped).toContain('Epilogue.')
  })
})
