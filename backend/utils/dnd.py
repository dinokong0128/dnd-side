"""D&D 5e rules helpers for character generation."""

HIT_DIE: dict[str, int] = {
    "Barbarian": 12,
    "Fighter": 10,
    "Paladin": 10,
    "Ranger": 10,
    "Bard": 8,
    "Cleric": 8,
    "Druid": 8,
    "Monk": 8,
    "Rogue": 8,
    "Warlock": 8,
    "Sorcerer": 6,
    "Wizard": 6,
}

CLASS_STARTING_INVENTORY: dict[str, list[dict]] = {
    "Fighter": [
        {"item_name": "Longsword", "quantity": 1},
        {"item_name": "Shield", "quantity": 1},
        {"item_name": "Chain Mail", "quantity": 1},
        {"item_name": "Explorer's Pack", "quantity": 1},
        {"item_name": "Handaxe", "quantity": 5},
    ],
    "Wizard": [
        {"item_name": "Spellbook", "quantity": 1},
        {"item_name": "Arcane Focus (Staff)", "quantity": 1},
        {"item_name": "Scholar's Pack", "quantity": 1},
        {"item_name": "Dagger", "quantity": 1},
    ],
    "Rogue": [
        {"item_name": "Shortsword", "quantity": 1},
        {"item_name": "Shortbow", "quantity": 1},
        {"item_name": "Arrows", "quantity": 20},
        {"item_name": "Leather Armor", "quantity": 1},
        {"item_name": "Thieves' Tools", "quantity": 1},
        {"item_name": "Burglar's Pack", "quantity": 1},
    ],
    "Cleric": [
        {"item_name": "Mace", "quantity": 1},
        {"item_name": "Scale Mail", "quantity": 1},
        {"item_name": "Shield", "quantity": 1},
        {"item_name": "Holy Symbol", "quantity": 1},
        {"item_name": "Priest's Pack", "quantity": 1},
    ],
    "Ranger": [
        {"item_name": "Longbow", "quantity": 1},
        {"item_name": "Arrows", "quantity": 20},
        {"item_name": "Shortsword", "quantity": 1},
        {"item_name": "Leather Armor", "quantity": 1},
        {"item_name": "Explorer's Pack", "quantity": 1},
    ],
    "Barbarian": [
        {"item_name": "Greataxe", "quantity": 1},
        {"item_name": "Handaxe", "quantity": 2},
        {"item_name": "Explorer's Pack", "quantity": 1},
        {"item_name": "Javelin", "quantity": 4},
    ],
    "Paladin": [
        {"item_name": "Longsword", "quantity": 1},
        {"item_name": "Shield", "quantity": 1},
        {"item_name": "Chain Mail", "quantity": 1},
        {"item_name": "Holy Symbol", "quantity": 1},
        {"item_name": "Explorer's Pack", "quantity": 1},
    ],
    "Druid": [
        {"item_name": "Quarterstaff", "quantity": 1},
        {"item_name": "Leather Armor", "quantity": 1},
        {"item_name": "Druidic Focus", "quantity": 1},
        {"item_name": "Explorer's Pack", "quantity": 1},
    ],
    "Bard": [
        {"item_name": "Rapier", "quantity": 1},
        {"item_name": "Leather Armor", "quantity": 1},
        {"item_name": "Lute", "quantity": 1},
        {"item_name": "Diplomat's Pack", "quantity": 1},
        {"item_name": "Dagger", "quantity": 1},
    ],
    "Monk": [
        {"item_name": "Shortsword", "quantity": 1},
        {"item_name": "Dungeoneer's Pack", "quantity": 1},
        {"item_name": "Dart", "quantity": 10},
    ],
    "Sorcerer": [
        {"item_name": "Light Crossbow", "quantity": 1},
        {"item_name": "Bolts", "quantity": 20},
        {"item_name": "Arcane Focus (Crystal)", "quantity": 1},
        {"item_name": "Dungeoneer's Pack", "quantity": 1},
        {"item_name": "Dagger", "quantity": 1},
    ],
    "Warlock": [
        {"item_name": "Light Crossbow", "quantity": 1},
        {"item_name": "Bolts", "quantity": 20},
        {"item_name": "Arcane Focus (Wand)", "quantity": 1},
        {"item_name": "Scholar's Pack", "quantity": 1},
        {"item_name": "Dagger", "quantity": 1},
    ],
}


SPELL_SLOTS_BY_CLASS_LEVEL: dict[str, dict[int, dict[int, int]] | None] = {
    "wizard":   {1: {1: 2}, 2: {1: 3}, 3: {1: 4, 2: 2}, 4: {1: 4, 2: 3}, 5: {1: 4, 2: 3, 3: 2}},
    "cleric":   {1: {1: 2}, 2: {1: 3}, 3: {1: 4, 2: 2}, 4: {1: 4, 2: 3}, 5: {1: 4, 2: 3, 3: 2}},
    "druid":    {1: {1: 2}, 2: {1: 3}, 3: {1: 4, 2: 2}, 4: {1: 4, 2: 3}, 5: {1: 4, 2: 3, 3: 2}},
    "sorcerer": {1: {1: 2}, 2: {1: 3}, 3: {1: 4, 2: 2}, 4: {1: 4, 2: 3}, 5: {1: 4, 2: 3, 3: 2}},
    "bard":     {1: {1: 2}, 2: {1: 3}, 3: {1: 4, 2: 2}, 4: {1: 4, 2: 3}, 5: {1: 4, 2: 3, 3: 2}},
    "paladin":  {1: {}, 2: {1: 2}, 3: {1: 3}, 4: {1: 3}, 5: {1: 4, 2: 2}},
    "ranger":   {1: {}, 2: {1: 2}, 3: {1: 3}, 4: {1: 3}, 5: {1: 4, 2: 2}},
    "warlock":  {1: {1: 1}, 2: {1: 2}, 3: {2: 2}, 4: {2: 2}, 5: {3: 2}},
    "fighter":   None,
    "barbarian": None,
    "rogue":     None,
    "monk":      None,
}

_MAX_SPELL_LEVEL = 5


def get_spell_slots(character_class: str, level: int) -> dict[int, int] | None:
    """Return {slot_level: max_count} for a class at the given level, or None for non-casters.

    Returns an empty dict {} for casters with no slots at the given level (e.g. Paladin level 1).
    Caps at level 5 for MVP scope.

    Args:
        character_class: Character class name (case-insensitive)
        level: Character level (1+)

    Returns:
        Dict of {slot_level_int: slot_count} or None for non-spellcasting classes.
    """
    entry = SPELL_SLOTS_BY_CLASS_LEVEL.get(character_class.lower())
    if entry is None:
        return None
    capped_level = min(level, _MAX_SPELL_LEVEL)
    return entry.get(capped_level, {})


def calculate_hp_max(character_class: str, con: int) -> int:
    """Return level-1 HP max per SRD 5e rules.

    Formula: Hit Die max + CON modifier (minimum 1).

    Args:
        character_class: One of the 12 D&D classes
        con: Constitution stat (1-20)

    Returns:
        HP max for level 1 character
    """
    con_modifier = (con - 10) // 2
    return max(1, HIT_DIE[character_class] + con_modifier)
