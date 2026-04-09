import { actionSchema, ACTION_MAX_LENGTH } from '../action'

describe('actionSchema', () => {
  it('accepts a simple action', () => {
    const result = actionSchema.safeParse({ actionText: 'Attack the goblin' })
    expect(result.success).toBe(true)
  })

  it('trims leading/trailing whitespace before validation', () => {
    const result = actionSchema.safeParse({
      actionText: '   Cast fireball   ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.actionText).toBe('Cast fireball')
    }
  })

  it('rejects an empty string', () => {
    const result = actionSchema.safeParse({ actionText: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Action cannot be empty')
    }
  })

  it('rejects a whitespace-only string (after trim)', () => {
    const result = actionSchema.safeParse({ actionText: '   \n\t ' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Action cannot be empty')
    }
  })

  it('accepts a string exactly ACTION_MAX_LENGTH characters long', () => {
    const result = actionSchema.safeParse({
      actionText: 'a'.repeat(ACTION_MAX_LENGTH),
    })
    expect(result.success).toBe(true)
  })

  it('rejects a string longer than ACTION_MAX_LENGTH', () => {
    const result = actionSchema.safeParse({
      actionText: 'a'.repeat(ACTION_MAX_LENGTH + 1),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        `Action must be under ${ACTION_MAX_LENGTH} characters`
      )
    }
  })

  it('rejects missing actionText entirely', () => {
    const result = actionSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects a non-string actionText', () => {
    const result = actionSchema.safeParse({ actionText: 42 })
    expect(result.success).toBe(false)
  })

  it('exports ACTION_MAX_LENGTH as a number', () => {
    expect(typeof ACTION_MAX_LENGTH).toBe('number')
    expect(ACTION_MAX_LENGTH).toBeGreaterThan(0)
  })
})
