/** Route map (FRONTEND_SPEC.md section 4). "Open console" is the only console CTA label on the site. */
export const ROUTES = {
  home: '/',
  research: '/research',
  limits: '/research#limits',
  lab: '/lab',
  console: '/console',
  ethics: '/ethics',
} as const;

export const CTA_CONSOLE_LABEL = 'Open console';

/** Global nav (FRONTEND_SPEC.md section 4). `Method` is an anchor on the landing page. */
export const NAV_LINKS = [
  { href: '/#method', label: 'Method' },
  { href: ROUTES.research, label: 'Research' },
  { href: ROUTES.lab, label: 'Lab' },
  { href: ROUTES.ethics, label: 'Ethics' },
] as const;

export const deviceRoute = (id: string): string => `/console/devices/${encodeURIComponent(id)}`;
export const verifyRoute = (alertId: string): string => `/verify/${encodeURIComponent(alertId)}`;
