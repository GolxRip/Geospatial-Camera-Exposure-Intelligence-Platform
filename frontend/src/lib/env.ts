import { z } from 'zod';

/**
 * Public configuration. NEXT_PUBLIC_* variables must be referenced literally (process.env.NEXT_PUBLIC_X)
 * so Next.js can inline them into the client bundle, which is why they are read one by one here.
 */
const schema = z.object({
  apiUrl: z.url(),
  siteUrl: z.url(),
  repoUrl: z.url(),
  repoBranch: z.string().min(1),
  /** Local sessions only: show full IP addresses. The app then shows a persistent "Unmasked" banner. */
  revealIp: z.boolean(),
  /** MapLibre style URL for the console map basemap. Unset: a plain dark canvas with the device layer (see BASEMAP.md). */
  mapStyleUrl: z.string().min(1).optional(),
  /** Show the /console-preview routes (labelled demo data) in a production build. Always on in `next dev`. */
  designPreview: z.boolean(),
});

export const env = schema.parse({
  apiUrl: (process.env.NEXT_PUBLIC_COBRA_API_URL ?? 'http://localhost:8000').replace(/\/$/, ''),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  repoUrl: (
    process.env.NEXT_PUBLIC_REPO_URL ??
    'https://github.com/Gokul0211/Geospatial-Camera-Exposure-Intelligence-Platform'
  ).replace(/\/$/, ''),
  repoBranch: process.env.NEXT_PUBLIC_REPO_BRANCH ?? 'master',
  revealIp: process.env.NEXT_PUBLIC_REVEAL_IP === 'true',
  mapStyleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL || undefined,
  designPreview: process.env.NEXT_PUBLIC_DESIGN_PREVIEW === 'true',
});

/** Link to a file in the repository, for example `paper/results.md`. */
export function repoFileUrl(path: string, anchor?: string | null): string {
  const hash = anchor ? `#${anchor}` : '';
  return `${env.repoUrl}/blob/${env.repoBranch}/${path}${hash}`;
}
