import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { HoodGauge } from '@/components/ui/hood-gauge';
import { ROUTES } from '@/lib/constants/routes';

/** Branded 404: the hood, closed (FRONTEND_SPEC.md section 4). */
export default function NotFound() {
  return (
    <main
      id="main"
      className="page-container flex min-h-[100dvh] flex-col items-start justify-center gap-8 py-24"
    >
      <HoodGauge gate={0.3} trust={30} size={160} decorative />
      <div className="flex flex-col gap-3">
        <h1 className="text-h2">Page not found</h1>
        <p className="text-body measure text-bone-2">
          This address does not lead anywhere on COBRA-WATCH.
        </p>
      </div>
      <Link href={ROUTES.home} className={buttonVariants({ size: 'lg' })}>
        Back to the start
      </Link>
    </main>
  );
}
