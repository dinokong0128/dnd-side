"""Game constants matching Supabase enums."""

# Message roles (matches game_messages.role enum in Supabase)
MESSAGE_ROLE_PLAYER = "player"
MESSAGE_ROLE_DM = "dm"
MESSAGE_ROLE_SYSTEM = "system"

# Event sources (matches game_events.source enum in Supabase)
EVENT_SOURCE_CLAUDE = "claude"
EVENT_SOURCE_PLAYER = "player"

# Game statuses (matches games.status enum in Supabase)
GAME_STATUS_LOBBY = "lobby"
GAME_STATUS_ACTIVE = "active"
GAME_STATUS_PAUSED = "paused"
GAME_STATUS_ENDED = "ended"

# Player statuses (matches players.status enum in Supabase)
PLAYER_STATUS_ACTIVE = "active"
PLAYER_STATUS_DEAD = "dead"
PLAYER_STATUS_INACTIVE = "inactive"
