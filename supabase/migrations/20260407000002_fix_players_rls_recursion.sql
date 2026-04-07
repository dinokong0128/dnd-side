-- Fix infinite recursion in players RLS policy.
--
-- The original "players: read game members" policy queried the `players` table
-- from within a policy ON the `players` table, causing PostgreSQL error 42P17
-- (infinite recursion detected in policy for relation "players").
--
-- Fix: introduce a SECURITY DEFINER helper function that bypasses RLS when
-- checking membership, breaking the recursive cycle.

CREATE OR REPLACE FUNCTION public.is_player_in_game(game_id_check uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM players
    WHERE game_id = game_id_check
      AND profile_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "players: read game members" ON players;

CREATE POLICY "players: read game members" ON players
  FOR SELECT
  USING (public.is_player_in_game(game_id));

