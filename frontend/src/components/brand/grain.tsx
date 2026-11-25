/**
 * One fixed SVG-noise overlay at 3% over the page (FRONTEND_SPEC.md section 5.3). It is rendered by the
 * (site) layout only: never over the console, scrolling containers or the map.
 */
export function Grain() {
  return <div aria-hidden className="grain" />;
}
