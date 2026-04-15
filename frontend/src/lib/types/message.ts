export type DiceRollEvent = {
  type: 'dice_roll'
  die: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'
  count: number
  result: number
  modifier: number
  total: number
  label: string
  dc?: number
  success?: boolean
  advantage?: boolean
  all_rolls?: number[]
  ac?: number
}

export type GameMessage = {
  id: string
  game_id: string
  role: 'player' | 'dm' | 'system'
  profile_id: string | null
  content: string
  created_at: string
  dice_rolls?: DiceRollEvent[] | null
}
