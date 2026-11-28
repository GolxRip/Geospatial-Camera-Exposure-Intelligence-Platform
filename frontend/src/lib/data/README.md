# The data seam

Components never call the API directly. The console, the device page and the lab render plain props (the view models are in
`types.ts`) and draw their own loading, empty, error and offline states. Two hooks in this folder are the whole seam between the UI and
the backend:

| File | Used by | Returns |
|---|---|---|
| `use-console-data.ts` | `/console` (`ConsoleApp`) and `/console/devices/[id]` (`DeviceForensicsApp`) | `{ data: ConsoleData, actions: ConsoleActions }` |
| `use-lab-data.ts` | `/lab` (`LabApp`) | `LabActions` (simulators, scenario run with live WebSocket events, plain-language query) |

Both are wired to the FastAPI backend through `src/lib/api/` (TanStack Query hooks in `hooks.ts` and `console-hooks.ts`, zod
schemas in `schemas.ts`, the WebSocket client in `socket.ts`, the SSE reader in `sse.ts`). When the backend is unreachable every
panel shows its offline state and buttons that need the backend are disabled with a reason; nothing is invented.

## Rules the hooks follow

1. Wrap each panel's data in a `LoadState` (`loading`, `offline`, `error` with a message, `ready`). A panel the backend cannot fill
   stays `offline`. For the device route, `detail` is `ready` with `data: null` when the id does not exist ("Device not found").
2. Mask addresses before they leave the hook with `maskIp()` from `src/lib/privacy/mask-ip.ts` (the only masking module). Components
   display `maskedIp` as given and never see a raw address; the ESLint rule in `eslint.config.mjs` forbids rendering a field named `ip`.
   The backend masks to /24 as well (`mask_ip_for_public()`), so this is a second line of defence.
3. Map the backend's tier strings with `tierFromAction()` in `src/lib/tier.ts`; an unknown string becomes "unscored", never a guess.
4. Actions (`onRunScenario`, `onVerdict`, `onVerifyLedger`) are optional. If one is missing its control is disabled. A
   `verdictError` message is shown verbatim under the verdict buttons, with no retry.
5. Carry `geoSource` through so simulated rows (`synthetic_demo`) are labelled in the inspector, the map legend and the device page.

## Demo data for design review

`npm run dev`, then open `/console-preview`, `/console-preview/devices/demo-3` and `/console-preview/lab`. These render the same
components with scripted demo data from `demo.ts`, under a "Demo data" banner. They return 404 in a production build unless
`NEXT_PUBLIC_DESIGN_PREVIEW=true` was set at build time (`preview-gate.ts`).

## Typed API client

`src/lib/api/schema.d.ts` and `openapi.snapshot.json` are generated from the backend's OpenAPI schema by `npm run gen:api`
(needs the backend running); `npm run gen:api -- --check` fails when the snapshot is stale. Most backend routes return plain dicts, so
response shapes are enforced by the zod schemas; the WebSocket and SSE message formats are documented in `docs/API_STREAMS.md`.

## The map

`device-map.tsx` uses, in order: `NEXT_PUBLIC_MAP_STYLE_URL` if set; the self-hosted PMTiles basemap if
`public/tiles/basemap.json` says it is available and the file is really there; otherwise the self-hosted Natural Earth boundaries.
See `BASEMAP.md`.
