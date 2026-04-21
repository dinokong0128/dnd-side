import { splitParagraphs } from '../text'

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
