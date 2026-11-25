import { Badge } from './badge';

/**
 * Marks scripted traffic (scenario runs and attack simulators, alerts with `demo: true`) wherever it appears
 * (FRONTEND_SPEC.md ground rule 5). The compact form is used in dense rows.
 */
export function DemoTag({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Badge tone="demo" className={className} title="Scripted traffic, not a real detection">
      {compact ? 'Demo' : 'Demo scenario'}
    </Badge>
  );
}
