-- DIN-73: add scene_type / scene_mood to game_messages and game_events
-- These columns denormalise the current scene context onto each row so the
-- frontend can restore the scene background on page load without re-parsing
-- the entire message history.

ALTER TABLE public.game_messages
  ADD COLUMN IF NOT EXISTS scene_type TEXT,
  ADD COLUMN IF NOT EXISTS scene_mood TEXT;

ALTER TABLE public.game_events
  ADD COLUMN IF NOT EXISTS scene_type TEXT,
  ADD COLUMN IF NOT EXISTS scene_mood TEXT;

-- Partial index: only rows that carry a scene annotation need to be scanned
-- when the frontend is looking for the most recent scene to restore.
CREATE INDEX IF NOT EXISTS idx_game_messages_scene
  ON public.game_messages(game_id, created_at DESC)
  WHERE scene_type IS NOT NULL;
