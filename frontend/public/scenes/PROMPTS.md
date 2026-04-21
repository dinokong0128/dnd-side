# Scene Background Asset Prompts

All images share this base style suffix:

> `cinematic fantasy illustration, highly detailed, dramatic atmospheric lighting, rich environmental storytelling, warm shadows, no text, no characters in the foreground, landscape orientation, 16:9`

Generated via DALL-E 3 at **1792×1024** (the closest 16:9 size the model supports), converted to WebP at **quality 75**, target **150–400 KB per file**.

## Variant Convention — Mood Affinity

Each scene has **4 variants** whose filenames map to an affinity that the picker routes moods into:

| File | Affinity | Primary moods |
|---|---|---|
| `1.webp` | **serene** — warm, calm, idyllic | *(no mood)*, `victory` |
| `2.webp` | **dramatic** — warm, high-energy, dynamic | `combat` |
| `3.webp` | **melancholic** — dim, quiet, reflective | `somber` |
| `4.webp` | **ominous** — dim, tense, foreboding | `tense`, `stealth`, `mystery` |

Affinity mapping lives in `frontend/src/lib/scene-variants.ts` (`MOOD_AFFINITY` + `VARIANT_BY_AFFINITY`). The picker `pickVariantFor` routes the DM's `<scene mood="...">` to the right affinity, avoiding immediate repeats.

`rest/default.webp` is the asset-load-failure fallback — intentionally neutral so it reads as "generic adventuring" regardless of the scene it's replacing.

---

## Per-Scene Prompts

### tavern
- **1 serene** — `A warm medieval fantasy tavern, long wooden tables and empty chairs, hearth glowing low, rich amber light, peaceful inviting atmosphere, dust motes in the firelight`
- **2 dramatic** — `A medieval fantasy tavern lit by a roaring hearth, heavy timber rafters, long shadows cast by dancing flames, dynamic light, high contrast, bottles on shelves glinting`
- **3 melancholic** — `An empty medieval tavern at dim dawn, cold morning light through leaded windows, abandoned mugs on tables, dying embers, quiet solitude, muted browns and greys`
- **4 ominous** — `A dim medieval tavern, most candles extinguished, heavy shadows in the corners, single flickering lantern, an overturned chair, uneasy stillness`

### town_square
- **1 serene** — `A medieval fantasy town square, timber-framed buildings, stone well at center, market stalls with colorful awnings, golden afternoon light, gentle bustle, cobblestones`
- **2 dramatic** — `A grand medieval town square with festival banners and a clock tower, dramatic sunbeams breaking through clouds, energetic, cobblestones glinting`
- **3 melancholic** — `An empty medieval town square at overcast evening, shuttered stalls, wet cobblestones, a lone pigeon, distant chimney smoke, quiet and subdued`
- **4 ominous** — `A medieval town square at twilight, empty and shadowed, flickering lantern-post, abandoned cart, fog creeping through alleys, oppressive silence`

### throne_room
- **1 serene** — `A stately fantasy throne room in warm afternoon light, a large ornate gilded throne prominent in the foreground on a wide stone dais, rich red and gold banners hung between tall stone columns, polished marble floor catching soft reflections, clerestory windows above, peaceful dignified atmosphere, welcoming and inviting`
- **2 dramatic** — `A soaring fantasy throne room, torches ablaze on columns, shafts of light cutting through haze, red and gold banners, deep shadows between pillars`
- **3 melancholic** — `An abandoned fantasy throne room, dust on the ornate throne, faded banners, dim shafts of window light, cracked floor tiles, faded grandeur`
- **4 ominous** — `A shadowed fantasy throne room, cold blue light through narrow windows, imposing dark throne, silent banners, menacing stillness, deep shadows on marble`

### temple
- **1 serene** — `An ancient fantasy temple interior, soft sunlight through carved windows, candles on the altar, mossy stone archways, incense smoke drifting, peaceful and reverent`
- **2 dramatic** — `A grand fantasy temple, beams of colored light through stained glass, glowing altar runes, smoke curling toward vaulted ceiling, high contrast, sacred intensity`
- **3 melancholic** — `A forgotten fantasy temple overgrown with ivy, sunlight through a collapsed section of roof, a fallen statue, still pools on the floor, bittersweet solitude`
- **4 ominous** — `A dark fantasy temple at night, flickering altar candles, deep shadows between pillars, pale moonlight on stone, a sense that the sacred has turned wrong`

### forest
- **1 serene** — `A dappled forest glade, warm golden-hour sun filtering through mature oaks, moss-covered stones, dust motes, painterly, peaceful`
- **2 dramatic** — `A forest interior caught in a sunbeam after storm, high chiaroscuro, ancient gnarled roots, dynamic composition, light breaking through canopy`
- **3 melancholic** — `An autumn forest at overcast dusk, bare branches, russet leaves drifting down, distant fog, still water reflecting bare trees, quiet`
- **4 ominous** — `A twisted dim forest at moonlit night, gnarled leafless trees, pale blue fog between black trunks, unsettling negative space, oppressive silence`

### mountain
- **1 serene** — `An alpine mountain pass, snow-dusted peaks in the distance, golden afternoon light, a winding stone path, pine trees, clear crisp air, expansive vista`
- **2 dramatic** — `A mountain ridge in a storm, wind-whipped pines, lightning over jagged peaks, dramatic clouds, cascading sunlight breaking through, dynamic and wild`
- **3 melancholic** — `A lonely mountain overlook at dusk, cold blues and muted purples, drifting mist below, lone weathered pine, wistful solitude`
- **4 ominous** — `A dark mountain pass at night, black jagged silhouettes against an aurora, wind-swept snow, something unseen watching from the cliffs, cold and foreboding`

### swamp
- **1 serene** — `A fantasy swamp at soft twilight, twisted cypress trees draped in moss, still water reflecting sunset sky, fireflies drifting, warm and mysterious but calm`
- **2 dramatic** — `A fantasy swamp caught in a lightning strike, dramatic silhouettes of twisted trees, churning water, dark clouds, high contrast, ominous energy`
- **3 melancholic** — `A dying fantasy swamp at overcast dawn, bleached roots, still black water, mist clinging to dead trees, a broken fence post, quiet and forsaken`
- **4 ominous** — `A dark fantasy swamp at moonlit night, bioluminescent glows from rotting logs, twisted silhouettes, still black water, unsettling stillness`

### desert
- **1 serene** — `A fantasy desert at golden hour, rolling sand dunes, long shadows, warm amber sky, distant oasis palms, expansive and tranquil`
- **2 dramatic** — `A fantasy desert in a sandstorm, wind-whipped sand against ruined pillars, dramatic light breaking through dust, high contrast, ancient ruins half-emerging`
- **3 melancholic** — `A fantasy desert at overcast dusk, bleached bones in the sand, a broken pillar, distant ruins, muted amber and grey, wistful and ancient`
- **4 ominous** — `A fantasy desert at moonlit night, cold blue sand dunes, a half-buried temple entrance, stars through thin clouds, eerie silence`

### coast
- **1 serene** — `A wide panoramic open fantasy coastline at golden hour, warm waves lapping against a rocky shore, a lighthouse on a distant headland, soft sea mist, full open sky with golden clouds, expansive horizon, tranquil and peaceful atmosphere, painterly realism`
- **2 dramatic** — `A fantasy coast in a storm, crashing waves against black basalt cliffs, sea-spray mist, dark clouds with breaking light, a distant lighthouse beam, dynamic and powerful`
- **3 melancholic** — `A fantasy coast at overcast dusk, a shipwreck in the shallows, pale cold colors, mist, gulls wheeling, quiet loss`
- **4 ominous** — `A fantasy coast at moonlit night, jagged rocks, black water, a distant shape in the fog, pale moonlight on wet stone, ominous and lonely`

### dungeon
- **1 serene** — `A torchlit fantasy dungeon corridor, empty and quiet, warm glow of sconces, arched stone ceiling, calm watching moment, shadows softened by torchlight`
- **2 dramatic** — `A fantasy dungeon corridor, heavy shadows, a single dramatic torch casting long light down a vaulted passage, iron bars, dripping water, intense tension`
- **3 melancholic** — `An abandoned fantasy dungeon, extinguished torches, pale cold light from a slit window, forgotten shackles, dust, quiet neglect`
- **4 ominous** — `A gothic fantasy dungeon corridor in deep darkness, a single flickering torch at the far end, rusted iron chains hanging from the wall, damp mossy stone, oppressive shadow, cold blue tones against warm distant firelight, sense of dread and abandonment`

### cave
- **1 serene** — `An expansive natural underground cavern, limestone stalactites and stalagmites, warm torchlight reflecting off a still pool of water, a stone path along one wall, soft ambient glow, muted earth tones with gentle warm highlights, peaceful and awe-inspiring, painterly realism`
- **2 dramatic** — `A vast fantasy cave, stalactites, a dramatic shaft of sunlight from above, underground waterfall, high contrast, light and dark interplay`
- **3 melancholic** — `A silent cave chamber, dim glow from fungi, still black pool, scattered bones, cold and forgotten, muted purples and greys, solitude`
- **4 ominous** — `A deep dark cave, bioluminescent fungi casting sickly green glow, twisted stalactites like teeth, a passage descending into pure black, alien foreboding`

### crypt
- **1 serene** — `A calm fantasy crypt, marble sarcophagi in orderly rows, dignified candlelight, faint incense, dust motes, reverent silence, warm and respectful`
- **2 dramatic** — `A grand fantasy crypt, shafts of moonlight through broken ceiling, dramatic columns, carved reliefs, high contrast, sense of ancient gravity`
- **3 melancholic** — `A forgotten fantasy crypt, cracked sarcophagi, fallen bones, faded murals, cold grey light through a crack, quiet decay, wistful`
- **4 ominous** — `A dark fantasy crypt, a sarcophagus lid ajar, pale blue runes glowing on the floor, cold mist, sense of something waking, deeply foreboding`

### rest
- **1 serene** — `A peaceful fantasy campsite at night, warm campfire, bedrolls, stars visible through tree canopy, mountain silhouette in distance, calm and safe`
- **2 dramatic** — `A fantasy ranger's camp at stormy dusk, wind-whipped fire, dramatic mountain silhouette against lightning, dynamic and rugged, high contrast`
- **3 melancholic** — `A lonely fantasy campsite at cold dawn, dying embers, single bedroll, distant mist, muted blues and greys, solitude and reflection`
- **4 ominous** — `A fantasy campsite at deep night, campfire guttering low, oppressive darkness beyond the light, unseen shapes in the trees, uneasy quiet`

### rest/default.webp (fallback)
`A peaceful fantasy campsite clearing at night, small warm campfire, pine forest silhouette, scattered stars, neutral universal adventuring mood, nothing distinctive, calm and generic`

---

## Regeneration Notes

To regenerate an individual asset, concatenate its prompt above with the base style suffix and call DALL-E 3 at `1792×1024`, quality `standard`, one image. Convert the returned PNG to WebP at quality 75.

**Known DALL-E 3 quirks observed during initial generation:**
- The model silently rewrites prompts internally. Words like "painterly" and "muted palette" are dropped in favor of cinematic rendering — the base style above reflects what actually lands rather than what we'd ideally ask for.
- Prompts mentioning `"dramatic ... cliffs/vista"` sometimes produced compositions framed as *viewed through a cave opening*, with heavy black borders. Using "wide panoramic open" explicitly avoids this.
- Violence cues (blood, claw marks) trip the safety filter. For `dungeon/4` the atmospheric dread was achieved with rusted chains + cold blue tones + "sense of dread" phrasing.

All 53 files in this library (13 scenes × 4 variants + `rest/default.webp`) were generated under budget at 7.6 MB total.
