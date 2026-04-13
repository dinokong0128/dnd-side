-- Add suggested_actions column to games table (DIN-42)
ALTER TABLE games ADD COLUMN IF NOT EXISTS suggested_actions text[];
