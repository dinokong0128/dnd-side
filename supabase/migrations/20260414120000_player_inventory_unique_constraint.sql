-- Add UNIQUE constraint on player_inventory(player_id, item_name)
-- Required for safe upsert logic in apply_state_changes():
-- ensures inventory_add can detect existing items by (player_id, item_name) pair.
ALTER TABLE player_inventory
  ADD CONSTRAINT player_inventory_player_item_unique
  UNIQUE (player_id, item_name);
