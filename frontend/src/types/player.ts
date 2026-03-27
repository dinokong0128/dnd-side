export type PlayerStats = {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

export type Player = {
  id: string
  game_id: string
  profile_id: string
  character_name: string
  character_class: string
  hp_current: number
  hp_max: number
  stats: PlayerStats
  status: string
  joined_at: string
}

export type InventoryItem = {
  id: string
  player_id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
  created_at: string
}

export type CharacterData = {
  id: string
  character_name: string
  character_class: string
  hp_current: number
  hp_max: number
  stats: Record<string, number>
}
