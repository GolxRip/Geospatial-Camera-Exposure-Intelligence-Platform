// assets/logo -> frontend. The hood geometry is NEVER redrawn by hand (spec 6.1).
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (p) => fileURLToPath(new URL(p, import.meta.url));
// One copy, byte for byte, where the app and the WebGL hood read it (src/lib/brand/hood.ts); tests/unit/hood.test.ts checks it.
mkdirSync(root("../src/lib/brand"), { recursive: true });
copyFileSync(root("../../assets/logo/cobra-mark.geometry.json"), root("../src/lib/brand/hood-geometry.json"));

mkdirSync(root("../public/brand"), { recursive: true });
for (const f of [
  "cobra-mark.svg",
  "cobra-mark-transparent.svg",
  "cobra-logo-dark.svg",
  "cobra-logo-light.svg",
  "cobra-banner.png",
]) {
  copyFileSync(root(`../../assets/logo/${f}`), root(`../public/brand/${f}`));
}
copyFileSync(root("../../assets/logo/cobra-favicon.svg"), root("../public/favicon.svg"));
console.log("sync-brand: hood-geometry.json, public/brand/*, public/favicon.svg written");
