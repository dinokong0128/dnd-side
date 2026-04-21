/**
 * Shared test fixtures and factory helpers.
 *
 * This file lives outside any `__tests__/` directory and uses the `.ts`
 * extension (not `.test.ts`) so Jest does not execute it as a test suite.
 * Import from test files as `@/lib/__test-utils__/fixtures`.
 */

import type { Game } from '@/lib/supabase/games'
import type { InventoryRow } from '@/lib/supabase/players'
import type { PlayerRow } from '@/lib/types/player'
import type { GameMessage } from '@/lib/types/message'

export function makeUser(
  overrides: Partial<{ id: string; email: string }> = {}
): { id: string; email: string } {
  return {
    id: 'user-1',
    email: 'adventurer@example.com',
    ...overrides,
  }
}

export function makeSession(
  overrides: Partial<{
    access_token: string
    user: { id: string; email: string }
  }> = {}
): { access_token: string; user: { id: string; email: string } } {
  return {
    access_token: 'test-access-token',
    user: makeUser(),
    ...overrides,
  }
}

export function makeProfile(
  overrides: Partial<{ id: string; username: string }> = {}
): { id: string; username: string } {
  return {
    id: 'user-1',
    username: 'Aragorn',
    ...overrides,
  }
}

export function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game-1',
    name: 'Dragon Quest',
    dm_persona: 'A dark fantasy realm',
    status: 'lobby',
    created_by: 'user-1',
    created_at: '2026-03-22T00:00:00Z',
    updated_at: '2026-03-22T00:00:00Z',
    suggested_actions: null,
    ...overrides,
  }
}

export function makePlayer(overrides: Partial<PlayerRow> = {}): PlayerRow {
  return {
    id: 'player-1',
    game_id: 'game-1',
    profile_id: 'user-1',
    character_name: 'Thorin',
    character_class: 'Fighter',
    race: 'Dwarf',
    level: 3,
    hp_current: 24,
    hp_max: 30,
    stats: { str: 15, dex: 12, con: 14, int: 10, wis: 11, cha: 8 },
    status: 'active',
    joined_at: '2026-03-22T00:00:00Z',
    ...overrides,
  }
}

export function makeInventoryRow(
  overrides: Partial<InventoryRow> = {}
): InventoryRow {
  return {
    id: 'inv-1',
    player_id: 'player-1',
    item_name: 'Longsword',
    quantity: 1,
    properties: null,
    created_at: '2026-03-22T00:00:00Z',
    ...overrides,
  }
}

export function makeMessage(overrides: Partial<GameMessage> = {}): GameMessage {
  return {
    id: 'msg-1',
    game_id: 'game-1',
    role: 'dm',
    profile_id: null,
    content: 'You stand before the gates of doom.',
    created_at: '2026-03-22T00:00:00Z',
    scene_type: null,
    scene_mood: null,
    ...overrides,
  }
}
