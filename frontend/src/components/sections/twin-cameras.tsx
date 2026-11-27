import { FeedCanvas } from '@/components/lab/feed-canvas';
import { Section } from '@/components/layout/section';
import { HoodGauge } from '@/components/ui/hood-gauge';
import { SourceNote } from '@/components/ui/source-note';
import { facts } from '@/lib/content/facts.generated';
import { manualFacts } from '@/lib/content/facts.manual';
import { fuse } from '@/lib/scoring/gate';

/** Two cameras that read the same to a banner scanner. The scores below are computed with the scoring port, not typed. */
const BANNER = [
  ['Product', 'ExampleCam 2000'],
  ['Server', 'example-httpd'],
  ['Firmware', '1.0.0'],
  ['Ports', '80, 554'],
] as const;

const T_CVE_DEMO = 100;

const LIVE = fuse({
  tCve: T_CVE_DEMO,
  drift: 0,
  freeze: false,
  qualityDrift: 0,
  specMismatch: false,
  tier2: true,
});
const FROZEN = fuse({
  tCve: T_CVE_DEMO,
  drift: 0,
  freeze: true,
  qualityDrift: 0,
  specMismatch: false,
  tier2: true,
});
const FROZEN_FRAMES = manualFacts['const.tier2.freeze'].value.consecutive_frames;

function Camera({
  title,
  frozen,
  result,
  status,
}: {
  title: string;
  frozen: boolean;
  result: typeof LIVE;
  status: string;
}) {
  return (
    <article className="surface-raised flex flex-col gap-5 rounded-panel border border-line p-5 md:p-6">
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm">
        {BANNER.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-bone-2">{k}</dt>
            <dd className="text-bone">{v}</dd>
          </div>
        ))}
      </dl>
      <FeedCanvas
        frozen={frozen}
        label={`Feed of the ${title.toLowerCase()}: ${frozen ? 'frozen' : 'moving'}`}
      />
      <p className="num text-sm text-bone-2">{status}</p>
      <div className="flex items-end justify-between gap-4 border-t border-line pt-5">
        <dl className="flex gap-8">
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-bone-2">CVE-only score</dt>
            <dd className="num text-3xl">{T_CVE_DEMO}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-bone-2">IG-DCTF score</dt>
            <dd className="num text-3xl">{result.final}</dd>
          </div>
        </dl>
        <HoodGauge gate={result.gate.multiplier} trust={result.final} size={96} />
      </div>
    </article>
  );
}

/** "The blind spot" (FRONTEND_SPEC.md section 7.3): two-column comparison; one column below 768. */
export function TwinCameras() {
  return (
    <Section id="blind-spot" title="The blind spot">
      <div className="grid gap-6 md:grid-cols-2">
        <Camera title="Live feed" frozen={false} result={LIVE} status="Frames are changing" />
        <Camera
          title="Frozen feed"
          frozen
          result={FROZEN}
          status={`${FROZEN_FRAMES} identical frames`}
        />
      </div>
      <p className="measure mt-6 text-sm text-bone-2">
        Illustration of the genuine_live and freeze_loop_attack categories (results, section 5). The
        decoy has the same banner and a clean CVE record.
        <SourceNote fact={facts['res.t2.end2end']} />
      </p>
    </Section>
  );
}
