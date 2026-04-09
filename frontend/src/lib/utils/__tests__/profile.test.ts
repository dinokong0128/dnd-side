import { getInitials } from '../profile'

describe('getInitials', () => {
  it('returns "??" for null', () => {
    expect(getInitials(null)).toBe('??')
  })

  it('returns "??" for undefined', () => {
    expect(getInitials(undefined)).toBe('??')
  })

  it('returns "??" for an empty string', () => {
    expect(getInitials('')).toBe('??')
  })

  it('returns "??" for a whitespace-only string', () => {
    expect(getInitials('   ')).toBe('??')
  })

  it('returns the first two letters uppercased for a single word', () => {
    expect(getInitials('aragorn')).toBe('AR')
  })

  it('uppercases a single-letter username padded to one char', () => {
    expect(getInitials('a')).toBe('A')
  })

  it('returns the initial of the first two words for multi-word names', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('ignores extra whitespace between words', () => {
    expect(getInitials('  John   Doe  ')).toBe('JD')
  })

  it('uses the first two words only when more than two are present', () => {
    expect(getInitials('John Ronald Reuel Tolkien')).toBe('JR')
  })

  it('handles Unicode / accented characters', () => {
    expect(getInitials('Élodie')).toBe('ÉL')
  })

  it('handles a leading space before a single word', () => {
    expect(getInitials('  solo')).toBe('SO')
  })
})
