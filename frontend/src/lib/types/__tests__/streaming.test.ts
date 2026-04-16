import { appendTextChunk, type StreamSegment } from '../streaming'

describe('appendTextChunk', () => {
  it('creates a new text segment from an empty list', () => {
    expect(appendTextChunk([], 'Hello')).toEqual([
      { kind: 'text', content: 'Hello' },
    ])
  })

  it('appends to the existing trailing text segment', () => {
    const segs: StreamSegment[] = [{ kind: 'text', content: 'Hello' }]
    expect(appendTextChunk(segs, ' world')).toEqual([
      { kind: 'text', content: 'Hello world' },
    ])
  })

  it('starts a new text segment after a non-text segment', () => {
    const segs: StreamSegment[] = [
      { kind: 'text', content: 'Rolling... ' },
      { kind: 'dice_rolls', content: '[]' },
    ]
    const result = appendTextChunk(segs, 'You pass.')
    expect(result).toHaveLength(3)
    expect(result[2]).toEqual({ kind: 'text', content: 'You pass.' })
  })

  it('is a no-op for empty text', () => {
    const segs: StreamSegment[] = [{ kind: 'text', content: 'Hi' }]
    expect(appendTextChunk(segs, '')).toBe(segs)
  })

  it('does not mutate the input array', () => {
    const segs: StreamSegment[] = [{ kind: 'text', content: 'A' }]
    const result = appendTextChunk(segs, 'B')
    expect(segs).toEqual([{ kind: 'text', content: 'A' }])
    expect(result).not.toBe(segs)
  })
})
