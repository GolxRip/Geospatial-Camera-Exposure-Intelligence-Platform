# Where your backend plugs in

Nothing in `src/components` calls an API. The console, the device page and the lab render plain props (the types are in
`types.ts`) and draw their own loading, empty, error and offline states. Two hooks in this folder are the whole seam:

| File | Used by | What to return |
|---|---|---|
| `use-console-data.ts` | `/console` (`ConsoleApp`) and `/console/devices/[id]` (`DeviceForensicsApp`) | `{ data: ConsoleData, actions: ConsoleActions }` |
| `use-lab-data.ts` | `/lab` (`LabApp`) | `LabActions` (simulators, scenario run, plain-language query) |

As shipped both return "not connected": every panel shows its offline state, buttons that would call the backend are disabled
with a reason, and nothing is invented. That is the honest state; keep it for any panel your backend cannot fill.

## Wiring it

1. In `useConsoleData(selectedDeviceId, city)`, fetch whatever you like (fetch, SWR, TanStack Query, a WebSocket) and map the
   responses onto the view models in `types.ts`. Refetch when `selectedDeviceId` or `city` changes.
2. Wrap each panel's data in a `LoadState` (`loading`, `offline`, `error` with a message, `ready`). A panel you cannot fill stays
   `offline`. For the device route, `detail` is `ready` with `data: null` when the id does not exist ("Device not found").
3. Mask addresses before they leave the hook: `maskIp()` in `src/lib/privacy/mask-ip.ts`. The components display `maskedIp` as
   given and never see a raw address. The ESLint rule in `eslint.config.mjs` forbids rendering a field named `ip`.
4. Map the backend's tier strings with `tierFromAction()` in `src/lib/tier.ts`; an unknown string becomes "unscored", never a guess.
5. Actions (`onRunScenario`, `onVerdict`, `onVerifyLedger`) are optional. If you leave one out its control is disabled.
   Put an error message in `verdictError` and the console shows it verbatim under the verdict buttons, with no retry.

## Seeing the real states before you integrate

`npm run dev`, then open `/console-preview`, `/console-preview/devices/demo-3` and `/console-preview/lab`. These render the
same components with scripted demo data from `demo.ts`, under a "Demo data" banner. They are a 404 in a production build unless
`NEXT_PUBLIC_DESIGN_PREVIEW=true` was set at build time. Delete `src/app/console-preview`, `demo.ts`, `preview-gate.ts` and
`src/components/{console/console-preview,console/demo-banner,lab/lab-preview}.tsx` when you no longer want them.

## The map

`NEXT_PUBLIC_MAP_STYLE_URL` is the one place a basemap is configured (a MapLibre style URL, for example one that points at your
own PMTiles file; see `BASEMAP.md`). Unset, the map is a plain dark canvas with the device layer on it.

## Optional typed API client

`src/lib/api/`, `schema.d.ts`, `openapi.snapshot.json` and `npm run gen:api` are a typed client generated from the backend's
OpenAPI schema. Nothing in the UI imports it. Use it in your hooks or delete the folder (then remove `gen:api` and `check:api` from
`package.json`).
