export type PlayerRow = {
  id: string
  game_id: string
  profile_id: string
  character_name: string
  character_class: string
  race: string
  level: number
  hp_current: number
  hp_max: number
  stats: {
    str: number
    dex: number
    con: number
    int: number
    wis: number
    cha: number
    spell_slots?: Record<string, { max: number; used: number }> | null
    cantrips?: string[]
  }
  status: 'active' | 'dead' | 'inactive'
  joined_at: string
}
