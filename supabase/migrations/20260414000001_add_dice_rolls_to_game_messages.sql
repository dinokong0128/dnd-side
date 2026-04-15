-- Add dice_rolls JSONB column to game_messages for storing DM dice roll data
-- Used by the DiceRoller component (DIN-24) to animate server-determined roll results
ALTER TABLE game_messages ADD COLUMN dice_rolls JSONB DEFAULT NULL;
