# Compliant art pack

Place approved replacements under `assets/` using the exact ASCII paths listed
in `config/art-rights.json`. Do not copy showcase assets into this directory.

When every required file is present, update `manifest.json` from `pending` to
`ready`. The build gate will then verify file type, dimensions and SHA-256
separation from the showcase pack before allowing a compliant build.
