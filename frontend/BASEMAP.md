# Basemap record

The console and the landing map band use a self-hosted Protomaps PMTiles file at `public/tiles/india.pmtiles`
(git-ignored, so every machine needs its own copy). `src/components/map/device-map.tsx` uses it only when
`public/tiles/basemap.json` says `"available": true` **and** a `HEAD /tiles/india.pmtiles` request succeeds; otherwise it falls back
to the self-hosted Natural Earth boundaries (`public/map/*.geojson`). A fresh clone therefore shows the boundary map until the file
is built or copied in. A MapLibre style URL in `NEXT_PUBLIC_MAP_STYLE_URL` overrides both.

**Status: built (z0 to 11, 263 MB).** Measured, not estimated.

To build it on a machine with network access (needs the [`pmtiles` CLI](https://github.com/protomaps/go-pmtiles)):

```bash
bash scripts/build-basemap.sh 11 <planet build URL from https://maps.protomaps.com/builds/>
```

Measured extract sizes for the India bounding box `68.1,6.7,97.4,35.7` (2026-10-15, `pmtiles extract --dry-run`): z9 52 MB,
z11 263 MB, z12 667 MB.

## Build log
- 2026-10-15: `pmtiles extract https://build.protomaps.com/20261015.pmtiles india.pmtiles --bbox=68.1,6.7,97.4,35.7 --maxzoom=11`
  (pmtiles 1.31.2), 263,175,029 bytes. Recorded in `public/tiles/india.size.txt`.
- 2026-11-28: same file copied into this checkout; `public/tiles/basemap.json` set to `available: true`.
