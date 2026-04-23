-- DIN-74 Part B: Convert games.suggested_actions from text[] to jsonb
-- Preserves existing text[] values into the generic bucket.
ALTER TABLE games
  ALTER COLUMN suggested_actions DROP DEFAULT;

ALTER TABLE games
  ALTER COLUMN suggested_actions TYPE jsonb
  USING jsonb_build_object(
    'acting_player_id', NULL,
    'tailored', '[]'::jsonb,
    'generic', COALESCE(to_jsonb(suggested_actions), '[]'::jsonb)
  );

ALTER TABLE games
  ALTER COLUMN suggested_actions
  SET DEFAULT '{"acting_player_id": null, "tailored": [], "generic": []}'::jsonb;

ALTER TABLE games
  ALTER COLUMN suggested_actions SET NOT NULL;

COMMENT ON COLUMN games.suggested_actions IS
  'DIN-74: {acting_player_id: uuid|null, tailored: string[], generic: string[]}. tailored = first-person POV suggestions for acting_player_id. generic = observer prompts for other players.';
