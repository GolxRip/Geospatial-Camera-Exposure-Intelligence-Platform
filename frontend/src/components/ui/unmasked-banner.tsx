import { env } from '@/lib/env';

/**
 * Persistent banner shown only when NEXT_PUBLIC_REVEAL_IP=true (FRONTEND_SPEC.md section 15.4).
 * With default settings this renders nothing and every IP address is masked by maskIp().
 */
export function UnmaskedBanner() {
  if (!env.revealIp) return null;
  return (
    <div role="status" className="bg-signal px-4 py-2 text-center text-sm font-medium text-ink-0">
      Unmasked: full IP addresses are visible in this local session. Set NEXT_PUBLIC_REVEAL_IP=false
      to mask them.
    </div>
  );
}
