import { GateExplorer as Explorer } from '@/components/lab/gate-explorer';
import { Section } from '@/components/layout/section';

/** "Gate explorer" (FRONTEND_SPEC.md section 7.5): the compact form of the lab instrument. */
export function GateExplorer() {
  return (
    <Section id="explorer" title="Gate explorer">
      <Explorer compact />
    </Section>
  );
}
