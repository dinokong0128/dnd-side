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
