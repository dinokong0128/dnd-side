import { characterSchema } from '../character'

function validBase() {
  return {
    characterName: 'Aragorn',
    characterClass: 'Fighter' as const,
    race: 'Human' as const,
    level: 1,
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  }
}

describe('characterSchema', () => {
  describe('valid input', () => {
    it('accepts a minimal valid character', () => {
      const result = characterSchema.safeParse(validBase())
      expect(result.success).toBe(true)
    })

    it('accepts level 20 (max)', () => {
      const result = characterSchema.safeParse({ ...validBase(), level: 20 })
      expect(result.success).toBe(true)
    })

    it('accepts stats at the boundary (1 and 20)', () => {
      const result = characterSchema.safeParse({
        ...validBase(),
        stats: { str: 1, dex: 20, con: 1, int: 20, wis: 1, cha: 20 },
      })
      expect(result.success).toBe(true)
    })

    it('accepts a name of max length (50)', () => {
      const result = characterSchema.safeParse({
        ...validBase(),
        characterName: 'A'.repeat(50),
      })
      expect(result.success).toBe(true)
    })
  })

  describe('characterName rules', () => {
    it('rejects an empty name', () => {
      const result = characterSchema.safeParse({
        ...validBase(),
        characterName: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Name is required')
      }
    })

    it('rejects a name longer than 50 characters', () => {
      const result = characterSchema.safeParse({
        ...validBase(),
        characterName: 'A'.repeat(51),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Max 50 characters')
      }
    })
  })

  describe('characterClass rules', () => {
    it('rejects an unknown class', () => {
      const result = characterSchema.safeParse({
        ...validBase(),
        characterClass: 'Ninja',
      })
      expect(result.success).toBe(false)
    })

    it('accepts all allowed classes', () => {
      const classes = [
        'Fighter',
        'Wizard',
        'Rogue',
        'Cleric',
        'Ranger',
        'Barbarian',
        'Paladin',
        'Druid',
        'Bard',
        'Monk',
        'Sorcerer',
        'Warlock',
      ]
      for (const cls of classes) {
        const result = characterSchema.safeParse({
          ...validBase(),
          characterClass: cls,
        })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('race rules', () => {
    it('rejects an unknown race', () => {
      const result = characterSchema.safeParse({
        ...validBase(),
        race: 'Kenku',
      })
      expect(result.success).toBe(false)
    })

    it('accepts all allowed races', () => {
      const races = [
        'Human',
        'Elf',
        'Dwarf',
        'Halfling',
        'Gnome',
        'Half-Elf',
        'Half-Orc',
        'Tiefling',
        'Dragonborn',
      ]
      for (const race of races) {
        const result = characterSchema.safeParse({ ...validBase(), race })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('level rules', () => {
    it('rejects level 0', () => {
      const result = characterSchema.safeParse({ ...validBase(), level: 0 })
      expect(result.success).toBe(false)
    })

    it('rejects level 21', () => {
      const result = characterSchema.safeParse({ ...validBase(), level: 21 })
      expect(result.success).toBe(false)
    })

    it('rejects non-integer level', () => {
      const result = characterSchema.safeParse({ ...validBase(), level: 1.5 })
      expect(result.success).toBe(false)
    })

    it('rejects a non-number level', () => {
      const result = characterSchema.safeParse({
        ...validBase(),
        level: '3' as unknown as number,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('stats rules', () => {
    it('rejects a stat below 1', () => {
      const result = characterSchema.safeParse({
        ...validBase(),
        stats: { str: 0, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message === 'Min 1')
        ).toBe(true)
      }
    })

    it('rejects a stat above 20', () => {
      const result = characterSchema.safeParse({
        ...validBase(),
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 21 },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message === 'Max 20')
        ).toBe(true)
      }
    })

    it('rejects a non-integer stat', () => {
      const result = characterSchema.safeParse({
        ...validBase(),
        stats: { str: 10.5, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      })
      expect(result.success).toBe(false)
    })

    it('rejects a non-number stat with the configured message', () => {
      const result = characterSchema.safeParse({
        ...validBase(),
        stats: {
          str: 'ten' as unknown as number,
          dex: 10,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10,
        },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message === 'Must be a number')
        ).toBe(true)
      }
    })

    it('rejects missing stats object entirely', () => {
      const base = validBase()
      const without = {
        characterName: base.characterName,
        characterClass: base.characterClass,
        race: base.race,
        level: base.level,
      }
      const result = characterSchema.safeParse(without)
      expect(result.success).toBe(false)
    })
  })
})
