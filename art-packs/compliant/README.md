# Compliant art pack

Place approved replacements under `assets/` using the exact ASCII paths listed
in `config/art-rights.json`. Do not copy showcase assets into this directory.

Current staged review assets:

- Two 1473 x 400 title animation frames preserving the original lettering: one
  static original football-championship-cup frame and one radiant frame.
- 16 original, nationally recognizable pixel crests with official federation
  wording and exact logo arrangements removed.
- 48 original country-identification plates using two-letter codes and abstract
  colour/cultural cues instead of real flag layouts. The supplied 192 x 160
  sources are nearest-neighbour adapted to each exact showcase flag slot.
- A minimally retouched parchment travel-map home background.
- A minimally retouched locker-room background.
- An original football championship trophy shared by the scoreboard and both
  ending screens; it uses the same model-edited design as the title frames.

The current 69-asset review sheet is stored at
`review/staged-assets-contact-sheet.png`. It is review-only and is not copied
into any build output.

Approval status:

- The complete 69-asset contact sheet was approved on 2026-08-03.

The eight legacy flags embedded in the interactive Runtime have also been
rewritten from these approved sources at 512 x 256 and reviewed in
`review/runtime-flags-contact-sheet.png`.

`manifest.json` is now `ready`. The build gate verifies file type, dimensions
and SHA-256 separation from the showcase pack for every compliant build.
