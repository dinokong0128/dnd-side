# Scene Background Asset Prompts

All images share this base style suffix:

> `digital painting, cinematic lighting, fantasy illustration, painterly, muted palette, no text, no characters in foreground, landscape orientation, 16:9`

Target: 1920×1080, WebP at quality 75, ~150–400KB per file.  
Variants: 3–5 per scene type, filed as `{scene_type}/1.webp`, `{scene_type}/2.webp`, etc.  
Fallback: `rest/default.webp` (loaded on asset error).

---

## Per-Scene Prompts

### tavern
`A cozy medieval fantasy tavern interior at night, warm firelight casting amber glows on wooden beams, barrels and mugs on shelves, a roaring hearth, mist through leaded-glass windows`

### town_square
`A bustling medieval fantasy town square at dawn, cobblestone streets, merchant stalls with canvas awnings, timber-framed buildings, a stone well at center, distant clock tower`

### throne_room
`A grand fantasy throne room with soaring stone arches, stained glass casting colored light, a massive throne on a dais, banners hanging from vaulted ceilings, flickering torches`

### temple
`An ancient stone temple interior lit by candles and filtered sunlight, carved pillars, mossy archways, sacred altar with glowing runes, incense smoke drifting upward`

### forest
`A deep ancient forest at dusk, towering oaks with gnarled roots, shafts of golden light filtering through dense canopy, moss-covered stones, fog weaving between trunks`

### mountain
`A dramatic mountain pass at twilight, jagged rocky peaks, alpine pine trees, a winding stone path, stars beginning to appear above storm clouds, icy wind-swept ridgelines`

### swamp
`A murky fantasy swamp at dusk, twisted cypress trees draped in moss, still black water reflecting orange sky, fireflies, half-submerged ruins barely visible in the mist`

### desert
`A vast fantasy desert at sunset, rolling sand dunes casting long shadows, ruined stone columns half-buried, a starry purple sky emerging on the horizon, distant oasis`

### coast
`A dramatic fantasy coastline at golden hour, crashing waves against black basalt cliffs, a lighthouse in the distance, sea-spray mist, dark storm clouds gathering offshore`

### dungeon
`A torch-lit stone dungeon corridor, iron-barred cells receding into shadow, dripping water stains on mossy walls, a single torch flickering at the far end, chains on the walls`

### cave
`The interior of a vast natural cave, bioluminescent fungi casting blue and green glow, stalactites and stalagmites, an underground river reflecting the dim light, ominous shadows`

### crypt
`An ancient fantasy crypt, vaulted stone ceiling, marble sarcophagi lining the walls, niches holding skulls and candelabras, a faint blue ethereal glow from runes on the floor`

### rest
`A warm campfire at night in a forest clearing, adventurer's camp with bedrolls and packs, stars visible through the tree canopy, the glow of embers, a peaceful mountain silhouette`

---

## Regeneration Notes

To regenerate these assets consistently, use the per-scene prompt above concatenated with the base style suffix. Calibrate style with `tavern` first, then batch the rest using the same seed/model checkpoint for visual consistency.

All variants for the same scene should feel like alternate framings of the same location — vary the camera angle, time of day within the same palette, or weather conditions slightly.
