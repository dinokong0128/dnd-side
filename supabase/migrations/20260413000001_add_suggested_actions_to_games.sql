-- Migration: add suggested_actions column to games table (DIN-42)
-- Stores the last set of DM-generated suggested player actions for the current game state.
-- Written by the Dramatiq worker using the service role key.

ALTER TABLE games ADD COLUMN IF NOT EXISTS suggested_actions text[];
