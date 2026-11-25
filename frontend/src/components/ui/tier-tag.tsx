import { GATE_TRIPPED_LABEL, TIER_LABEL, type TierId } from '@/lib/tier';
import { cn } from '@/lib/utils';

/**
 * Severity is shape plus one-hue amber intensity plus a text label, never colour alone
 * (FRONTEND_SPEC.md section 5.1). There is no red, no green and no traffic light.
 *
 *   High      filled circle, bone-2 at 70%
 *   Medium    ring, amber at 55%
 *   Low       filled diamond, amber
 *   Gate      filled diamond plus one outer ring
 *   Demo      any shape with a dashed outline
 *
 * The one-time pulse on appearance of a tripped gate is added with the animation system (Phase 6).
 */
export interface TierShapeProps {
  tier: TierId | null;
  gateTripped?: boolean;
  demo?: boolean;
  size?: number;
  className?: string;
}

export function TierShape({
  tier,
  gateTripped = false,
  demo = false,
  size = 12,
  className,
}: TierShapeProps) {
  const diamond = 'M6 1.5 L10.5 6 L6 10.5 L1.5 6 Z';
  return (
    <svg
      aria-hidden
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 12 12"
      className={cn('shrink-0 overflow-visible', className)}
    >
      {gateTripped ? (
        <>
          <path d={diamond} className="fill-signal" />
          <circle
            cx="6"
            cy="6"
            r="5.75"
            fill="none"
            className="stroke-signal"
            strokeWidth="1"
            strokeDasharray={demo ? '1.5 1.5' : undefined}
          />
        </>
      ) : (
        <>
          {tier === 'high' ? <circle cx="6" cy="6" r="3.5" className="fill-bone-2/70" /> : null}
          {tier === 'medium' ? (
            <circle
              cx="6"
              cy="6"
              r="4"
              fill="none"
              className="stroke-signal/55"
              strokeWidth="1.5"
            />
          ) : null}
          {tier === 'low' ? <path d={diamond} className="fill-signal" /> : null}
          {tier === null ? (
            <path d="M2 6 H10" className="stroke-bone-2" strokeWidth="1.5" strokeLinecap="butt" />
          ) : null}
          {demo ? (
            <circle
              cx="6"
              cy="6"
              r="5.75"
              fill="none"
              className="stroke-bone-2"
              strokeWidth="1"
              strokeDasharray="1.5 1.5"
            />
          ) : null}
        </>
      )}
    </svg>
  );
}

export interface TierTagProps extends TierShapeProps {
  /** Hide the visible label; it stays available to assistive technology. */
  showLabel?: boolean;
}

export function TierTag({
  tier,
  gateTripped = false,
  demo = false,
  size,
  showLabel = true,
  className,
}: TierTagProps) {
  const label = gateTripped ? GATE_TRIPPED_LABEL : tier ? TIER_LABEL[tier] : 'Unscored';
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm text-bone', className)}>
      <TierShape tier={tier} gateTripped={gateTripped} demo={demo} size={size} />
      <span className={showLabel ? undefined : 'sr-only'}>{label}</span>
      {demo && showLabel ? <span className="sr-only"> (demo)</span> : null}
    </span>
  );
}
