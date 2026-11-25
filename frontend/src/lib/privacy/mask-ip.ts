import { env } from '@/lib/env';

/**
 * The only way an IP address reaches the DOM (FRONTEND_SPEC.md ground rule 8 and section 15.4).
 *
 * Default output masks IPv4 to the /24 (`203.0.113.45` becomes `203.0.113.•`) and IPv6 to its first three
 * groups (`2001:db8:abcd:•`). A value that does not parse as an address is never echoed back.
 *
 * This is the client-side fallback only: the backend still sends the full address in its JSON. Masking
 * server-side (backend touchpoint B1) is not approved and is listed in the build report.
 */
export const MASK_CHAR = '•';
const UNPARSEABLE = '•••';

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function parseV4(value: string): [number, number, number, number] | null {
  const m = IPV4.exec(value);
  if (!m) return null;
  const octets = [m[1], m[2], m[3], m[4]].map((o) => Number(o));
  if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null;
  return octets as [number, number, number, number];
}

function maskV6(value: string): string | null {
  // Plain structural check: hex groups and colons only, at least two colons, no more than 8 groups.
  if (!/^[0-9a-fA-F:]+$/.test(value) || (value.match(/:/g) ?? []).length < 2) return null;
  if (value.includes(':::')) return null;
  const groups = value.split(':');
  if (groups.length > 8 || groups.some((g) => g.length > 4)) return null;
  const head = groups.slice(0, 3).filter((g) => g.length > 0);
  if (head.length === 0) return `${MASK_CHAR}`;
  return `${head.map((g) => g.toLowerCase()).join(':')}:${MASK_CHAR}`;
}

export interface MaskOptions {
  /** Defaults to NEXT_PUBLIC_REVEAL_IP. Exposed for tests. */
  reveal?: boolean;
}

export function maskIp(ip: string | null | undefined, options: MaskOptions = {}): string {
  const reveal = options.reveal ?? env.revealIp;
  if (ip === null || ip === undefined) return UNPARSEABLE;
  const value = ip.trim();

  // IPv4-mapped IPv6 (::ffff:203.0.113.45): treat as the embedded IPv4 address.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  const candidate = mapped?.[1] ?? value;

  const v4 = parseV4(candidate);
  if (v4) {
    return reveal ? v4.join('.') : `${v4[0]}.${v4[1]}.${v4[2]}.${MASK_CHAR}`;
  }
  const v6 = maskV6(candidate);
  if (v6) {
    return reveal ? candidate : v6;
  }
  return UNPARSEABLE;
}
