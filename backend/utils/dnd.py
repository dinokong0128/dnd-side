"""D&D 5e rules helpers for character generation."""

# XP thresholds for levels 1–6 (MVP cap: level 5)
XP_THRESHOLDS: dict[int, int] = {
    1: 0,
    2: 300,
    3: 900,
    4: 2700,
    5: 6500,
    6: 14000,
}

# Hit die sides by class (lowercase keys for case-insensitive lookup)
HIT_DICE_BY_CLASS: dict[str, int] = {
    "sorcerer": 6,
    "wizard": 6,
    "bard": 8,
    "cleric": 8,
    "druid": 8,
    "monk": 8,
    "rogue": 8,
    "warlock": 8,
    "fighter": 10,
    "paladin": 10,
    "ranger": 10,
    "barbarian": 12,
}

# Class features unlocked at each level (levels 2–5, MVP scope)
CLASS_FEATURES_BY_LEVEL: dict[str, dict[int, str]] = {
    "barbarian": {
        2: "Reckless Attack, Danger Sense",
        3: "Primal Path feature",
        4: "Ability Score Improvement",
        5: "Extra Attack, Fast Movement",
    },
    "bard": {
        2: "Jack of All Trades, Song of Rest",
        3: "Bard College feature, Expertise",
        4: "Ability Score Improvement",
        5: "Bardic Inspiration (d8), Font of Inspiration",
    },
    "cleric": {
        2: "Channel Divinity, Divine Domain feature",
        3: "Divine Domain feature",
        4: "Ability Score Improvement",
        5: "Destroy Undead (CR 1/2)",
    },
    "druid": {
        2: "Wild Shape, Druid Circle feature",
        3: "Druid Circle feature",
        4: "Wild Shape improvement, Ability Score Improvement",
        5: "Wild Shape (CR 1)",
    },
    "fighter": {
        2: "Action Surge, Fighting Style",
        3: "Martial Archetype feature",
        4: "Ability Score Improvement",
        5: "Extra Attack",
    },
    "monk": {
        2: "Ki, Unarmored Movement",
        3: "Monastic Tradition feature, Deflect Missiles",
        4: "Slow Fall, Ability Score Improvement",
        5: "Extra Attack, Stunning Strike",
    },
    "paladin": {
        2: "Divine Smite, Fighting Style, Spellcasting",
        3: "Sacred Oath feature, Divine Health",
        4: "Ability Score Improvement",
        5: "Extra Attack",
    },
    "ranger": {
        2: "Fighting Style, Spellcasting, Primeval Awareness",
        3: "Ranger Archetype feature, Primeval Awareness",
        4: "Ability Score Improvement",
        5: "Extra Attack",
    },
    "rogue": {
        2: "Cunning Action",
        3: "Roguish Archetype feature, Sneak Attack (2d6)",
        4: "Ability Score Improvement",
        5: "Uncanny Dodge, Sneak Attack (3d6)",
    },
    "sorcerer": {
        2: "Font of Magic",
        3: "Sorcerous Origin feature, Metamagic",
        4: "Ability Score Improvement",
        5: "Sorcerous Origin feature",
    },
    "warlock": {
        2: "Eldritch Invocations",
        3: "Pact Boon",
        4: "Ability Score Improvement",
        5: "Eldritch Invocations improvement",
    },
    "wizard": {
        2: "Arcane Tradition feature",
        3: "Arcane Tradition feature",
        4: "Ability Score Improvement",
        5: "Arcane Tradition feature",
    },
}


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
