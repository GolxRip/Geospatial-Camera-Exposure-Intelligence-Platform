import { manualFacts } from '@/lib/content/facts.manual';

/** Trust tiers as the UI names them. The backend names them high_trust, medium_trust and low_trust. */
export type TierId = 'high' | 'medium' | 'low';

export const TIER_LABEL: Record<TierId, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const GATE_TRIPPED_LABEL = 'Gate tripped';

/** Maps the backend's `action_tier` string. Anything else is unscored, never guessed. */
export function tierFromAction(action: string | null | undefined): TierId | null {
  switch (action) {
    case 'high_trust':
      return 'high';
    case 'medium_trust':
      return 'medium';
    case 'low_trust':
      return 'low';
    default:
      return null;
  }
}

export interface TierCutoffs {
  readonly high_min: number;
  readonly medium_min: number;
}

/** Static cut-offs are only a fallback: the live values come from GET /api/config/thresholds. */
export function tierFromScore(
  score: number,
  cutoffs: TierCutoffs = manualFacts['const.tiers'].value,
): TierId {
  if (score >= cutoffs.high_min) return 'high';
  if (score >= cutoffs.medium_min) return 'medium';
  return 'low';
}
