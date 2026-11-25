import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { HoodGauge } from '@/components/ui/hood-gauge';
import { CTA_CONSOLE_LABEL, ROUTES } from '@/lib/constants/routes';

/** Interactive CTA band (FRONTEND_SPEC.md section 7.11). The hood is closed at rest; it opens on hover in phase 9. */
export function CtaBand() {
  return (
    <section aria-labelledby="cta-title" className="border-y border-line py-24 md:py-32">
      <div className="page-container flex flex-col items-start gap-10 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-8">
          <h2 id="cta-title" className="text-h2">
            Open the console.
          </h2>
          <Link href={ROUTES.console} className={buttonVariants({ size: 'lg' })}>
            {CTA_CONSOLE_LABEL}
          </Link>
        </div>
        <HoodGauge gate={0.3} trust={70} size={160} decorative />
      </div>
    </section>
  );
}
