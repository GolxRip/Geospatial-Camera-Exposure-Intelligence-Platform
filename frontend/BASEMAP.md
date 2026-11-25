# Basemap record

The console and the landing map band use a self-hosted Protomaps PMTiles file at `public/tiles/india.pmtiles`
(git-ignored). It is built by `scripts/build-basemap.sh`, which appends one line below each time it runs.

**Status: not built.** The file does not exist yet and its size is **unmeasured**.

The first attempt (2026-10-14, build session) could not run: the sandbox's egress policy blocks the Protomaps
build host (HTTP 403 from the proxy), so no planet build could be read. Nothing was extracted and no size is claimed.
To build it, run on a machine with network access:

```bash
SOURCE_URL="<planet build URL from https://docs.protomaps.com/basemaps/downloads>" MAXZOOM=12 bash scripts/build-basemap.sh
```

## Build log
