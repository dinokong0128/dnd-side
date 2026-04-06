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
