export type GameMessage = {
  id: string
  game_id: string
  role: 'player' | 'dm' | 'system'
  profile_id: string | null
  content: string
  created_at: string
}
