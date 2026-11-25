import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import { EmptyState } from '@/components/ui/empty-state';
import { HoodGauge } from '@/components/ui/hood-gauge';
import { Skeleton } from '@/components/ui/skeleton';
import { TierTag } from '@/components/ui/tier-tag';
import { ROUTES } from '@/lib/constants/routes';
import type { ConsoleActions, DeviceDetail, LoadState } from '@/lib/data/types';
import { Inspector } from './inspector';

export interface DeviceForensicsProps {
  detail: LoadState<DeviceDetail | null>;
  actions?: ConsoleActions;
  backHref?: string;
  /** Rendered above the page, for example the demo-data banner. */
  banner?: React.ReactNode;
}

/**
 * Device forensics (FRONTEND_SPEC.md section 11): the inspector at full width, the full audit trail and the model comparison
 * table. The device id in the URL is never displayed: the header shows what the data says, with the address masked. The enlarged
 * feed pane is not built (it needs frames from an authorized source).
 */
export function DeviceForensics({
  detail,
  actions,
  backHref = ROUTES.console,
  banner,
}: DeviceForensicsProps) {
  const d = detail.status === 'ready' ? detail.data : null;
  return (
    <main id="main" className="min-h-[100dvh] pb-24">
      {banner}
      <header className="border-b border-line">
        <div className="page-container flex flex-col gap-6 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <HoodGauge
              size={96}
              gate={d?.gate.multiplier ?? 1}
              trust={d?.score ?? 100}
              decorative
            />
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">Device forensics</h1>
              {detail.status === 'loading' ? <Skeleton className="h-5 w-64" /> : null}
              {d ? (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-bone-2">
                  <span className="num text-bone">{d.maskedIp}</span>
                  <span>{d.manufacturer}</span>
                  <span>{d.city}</span>
                  <TierTag tier={d.tier} gateTripped={d.gateTripped} size={14} />
                </p>
              ) : null}
            </div>
          </div>
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-chip text-sm text-bone-2 transition-surface hover:text-bone md:self-auto"
          >
            <ArrowLeft aria-hidden size={16} />
            Back to the console
          </Link>
        </div>
      </header>
      <div className="page-container pt-10">
        {detail.status === 'ready' && detail.data === null ? (
          <EmptyState title="Device not found">
            The data source has no device for this address.
          </EmptyState>
        ) : (
          <Inspector detail={detail} actions={actions} wide />
        )}
      </div>
    </main>
  );
}
