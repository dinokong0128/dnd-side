import { graphemesOf, splitParagraphs } from '../text'

describe('splitParagraphs', () => {
  it('returns an empty array for an empty string', () => {
    expect(splitParagraphs('')).toEqual([])
  })

  it('returns a single-element array for a single paragraph', () => {
    expect(splitParagraphs('a')).toEqual(['a'])
  })

  it('splits on double newlines', () => {
    expect(splitParagraphs('a\n\nb')).toEqual(['a', 'b'])
  })

  it('treats multiple paragraphs separated by double newlines', () => {
    expect(splitParagraphs('one\n\ntwo\n\nthree')).toEqual(['one', 'two', 'three'])
  })

  it('filters out empty paragraphs from consecutive double newlines', () => {
    expect(splitParagraphs('a\n\n\n\nb')).toEqual(['a', 'b'])
  })

  it('preserves single newlines within a paragraph', () => {
    expect(splitParagraphs('line1\nline2\n\nline3')).toEqual(['line1\nline2', 'line3'])
  })
})

describe('graphemesOf', () => {
  it('returns an empty array for an empty string', () => {
    expect(graphemesOf('')).toEqual([])
  })

  it('returns one entry per ASCII character', () => {
    expect(graphemesOf('hello')).toEqual(['h', 'e', 'l', 'l', 'o'])
  })

  it('keeps a basic-plane emoji as a single entry', () => {
    // The dragon emoji is a single code point but occupies 2 UTF-16 units.
    expect(graphemesOf('🐉')).toEqual(['🐉'])
  })

  it('keeps a ZWJ emoji sequence as a single entry', () => {
    // Family emoji: man + ZWJ + woman + ZWJ + boy
    const family = '\u{1F468}‍\u{1F469}‍\u{1F466}'
    expect(graphemesOf(family)).toEqual([family])
  })

  it('splits mixed text correctly', () => {
    expect(graphemesOf('a🐉b')).toEqual(['a', '🐉', 'b'])
  })
})
