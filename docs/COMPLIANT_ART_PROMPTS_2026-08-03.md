# Compliant art prompt record — 2026-08-03

This file records the English-only prompt set used for the staged compliant
art. Every edit used the corresponding showcase image as its image-to-image
reference. Final files are stored under `art-packs/compliant/assets/`.

## Shared crest prompt

> Edit the supplied national-team crest into an original, fictionalized badge
> for an unlicensed association-football game. Keep immediate team recognition
> through the original broad color identity, badge category, and one familiar
> national football symbol. Redesign the symbol pose, count, border geometry,
> spacing, and internal arrangement. Remove federation initials, federation
> names, official wording, official star counts, founding years, and exact
> official geometry. Maintain crisp 16-bit pixel art, a centered transparent
> background, similar proportions, and a strong badge silhouette. No tournament
> marks, protected event branding, cup, chalice, trophy silhouette, watermark,
> or photorealism.

Team-specific directions:

- Argentina: sky blue, white, navy, gold, upright shield; replace the monogram
  with a rising-sun-and-football motif and replace the official star row with
  two diamond sparkles.
- Brazil: green, yellow, blue, white; replace the initials and cross with a blue
  football and two sweeping canary-feather curves.
- Canada: red, white, charcoal; redraw one angular seven-facet maple leaf above
  a football in a new hexagonal shield.
- Cape Verde: navy, white, red, gold; redraw one upward-moving angular marlin
  through new wave bands; remove initials and stars.
- Colombia: yellow, red, blue; replace the wording ring with a faceted golden
  football, red motion ribbon, blue arc, and offset gear-circle.
- Curacao: cobalt, gold, white, turquoise; replace wording and flag stars with a
  football, ocean-wave spiral, and two small diamond sparkles.
- England: white, royal blue, red; replace the official three-lion stack with
  one large original rampant lion and two motion ribbons; use four asymmetric
  diamond-cross pixels and remove the top star.
- France: blue, white, red, gold; redraw the rooster in a new running pose,
  remove initials and stars, and use a new six-sided shield.
- Germany: black, white, gold, red; use a heavy upright black hooked-beak
  heraldic bird with a broad torso, half-folded symmetrical wings, sturdy legs
  and a fan tail inside new segmented rings; no official stars or exact eagle
  silhouette.
- Japan: black, white, red, gold; redraw an original three-legged origami crow
  carrying a red football in a rounded hexagonal badge with no wording.
- Mexico: green, white, red, charcoal; redraw an angular eagle diving around a
  football with desert-wave accents and no wording or official composition.
- Morocco: green, red, gold, black; redraw the interlaced star as a gold-lined
  red mosaic over a football pattern in a new pointed circular shield.
- Norway: red, navy, white, gold; replace wording, lions, and flag cross with a
  Viking longship prow, mountain peaks, and an angled route line.
- Portugal: red, green, gold, white, blue; make an original broad red-and-gold
  cross the dominant silhouette, backed by a restrained green navigation ring,
  with a small central white shield and five abstract blue dots; no official
  cross proportions or exact national-arms arrangement.
- Spain: red, gold, navy, cream; use a broad shield with two plain architectural
  pillars framing a diagonally divided inner shield, a simplified castle and
  lion, a small angular coronet and a football; no pillar wording, official
  four-quarter arms or exact royal crown.
- USA: navy, red, white; use a broad traditional football shield with a white
  bald-eagle head across the navy upper field, a central football, five red and
  white lower stripes and three small abstract sparkles; no letters or official
  federation geometry.

## 48 country-identification plates

The approved source archive was supplied at
`复古足球国家识别牌_48国_20260803.zip`, SHA-256
`995d7561cd4c89c08661c983635174c9dbc3c976c2d288dd57016d469ac6ac9b`.
It contains 48 RGBA sources at 192 x 160 plus its own complete Chinese prompt
record and overview sheets.

Each source is a horizontal retro-football UI plate with one two-letter country
code, a limited national colour identity and at most one small abstract cultural
or natural cue. The shared source prompt explicitly excludes real flag layouts,
national-team crests, federation marks, event marks, cloth flags, shields,
scenes, extra wording and watermarks. The sources were mapped from their Chinese
country filenames to the ASCII flag paths in `config/art-rights.json`, then
nearest-neighbour resized to the exact dimensions of their corresponding
showcase slots. No showcase flag pixels were used in the replacements.

## Home background prompt

> Preserve the supplied warm parchment palette, paper texture, central dotted
> world map, bottom travel-landmark panorama, vintage postage composition,
> pixel-art rendering, and empty title area. Remove protected event wording and
> recognizable national flags. Replace flag bunting with neutral football
> pennants using dots, chevrons, and pitch-line motifs. Replace branded or
> flag-style stamps with generic football-travel and stadium stamps. Keep place
> names. Do not add federation marks, official logos, cups, trophies, crowns,
> or watermarks. The result must look like a minimal revision by the same artist.

Saved as `art-packs/compliant/assets/branding/home-background.png`.

## Locker-room prompt

> Preserve the supplied ivory palette, U-shaped lockers, numbered blank jerseys,
> benches, boots, cases, lighting, perspective, and 4:3 composition. Replace the
> protected wall branding with a generic MATCH DAY 2026 tactics-board emblem.
> Replace both wall trophies with circular football medallions and the case
> trophy with a star in a circle. Add no flags, crests, official marks, cups,
> trophy silhouettes, crowns, or watermarks. The result must be a minimal edit
> of the original scene.

Saved as `art-packs/compliant/assets/branding/locker-room.jpg`.

## Champion trophy icon

The standalone champion icon is the exact connected trophy component extracted
from the model-edited static title frame: a faceted football-like orb cradled by
two broad twisting gold ribbons over a compact dark-green-and-gold pedestal.
It was isolated from the transparent source and nearest-neighbour fitted to the
existing 192 x 354 slot. No showcase trophy pixels, star medal, wording,
federation mark, event mark or watermark are present.

Saved as `art-packs/compliant/assets/branding/trophy.png` and shared by the
scoreboard, formal ending and mini-cup ending.

## Title animation frames

The non-radiant showcase frame was supplied directly to the built-in image
editing model. The model removed the protected central cup, naturally rebuilt
the adjacent moss, soil and scattered-stone contours, and drew a new original
football championship cup in the same edit. No rectangular erase or manual
cup cutout was used.

The static-frame edit prompt specified:

> Replace only the central trophy with an original tall golden football
> championship cup: a faceted football-like orb cradled by two broad twisting
> golden ribbons, a narrow rising body, and a compact dark-green-and-gold
> angular pedestal. Match the polished 16-bit pixel-art source. Preserve the
> exact Chinese text “剑指美加墨”, its moss texture, position, soil outline and
> all artwork outside the immediately occluded central area. Naturally rebuild
> the central moss, soil, stones and transparent contours with no rectangular
> erase seam. Do not reproduce the FIFA World Cup Trophy, human figures holding
> a globe, the original trophy contour, flags, official marks or watermarks.

The radiant-frame edit prompt specified:

> Using the approved static frame as the unchanged animation body, add only a
> compact amber halo and 16–18 uneven stepped golden pixel rays behind the
> central cup. Preserve every Chinese character, moss texture, stone, trophy,
> pedestal, proportion, colour and position. Use crisp 16-bit pixels with no
> smooth lens flare, medal, badge, star emblem, new text or watermark.

Both model edits used a flat magenta extraction background. Chroma removal,
nearest-neighbour sizing and frame alignment then produced identical title and
cup pixels in both frames; only the model-generated rays change between them.

Saved as:

- `art-packs/compliant/assets/branding/title-frame-1.png` — radiant frame.
- `art-packs/compliant/assets/branding/title-frame-2.png` — static frame.
