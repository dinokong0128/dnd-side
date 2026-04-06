-- Add race and level columns to players table
-- Required by all Claude DM prompt templates (DIN-8, DIN-10, DIN-12)
ALTER TABLE players ADD COLUMN race text NOT NULL DEFAULT 'Human';
ALTER TABLE players ADD COLUMN level integer NOT NULL DEFAULT 1;

-- Add CHECK constraint for level (D&D 5e levels are 1-20)
ALTER TABLE players ADD CONSTRAINT players_level_range CHECK (level >= 1 AND level <= 20);
