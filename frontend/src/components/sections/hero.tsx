import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { buttonVariants } from '@/components/ui/button';
import { HoodGauge } from '@/components/ui/hood-gauge';
import { CTA_CONSOLE_LABEL, ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils';

/**
 * Hero (FRONTEND_SPEC.md section 7.2): asymmetric split, text 5/12 and stage 7/12 bleeding off the right edge from 1024 up;
 * below 1024 the text sits above a 60vh stage. The static mark holds the stage position until a 3D scene replaces it.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="overflow-x-clip">
      <div className="page-container flex flex-col gap-12 pb-16 pt-24 lg:grid lg:min-h-[100dvh] lg:grid-cols-12 lg:items-center lg:gap-0 lg:pb-24">
        <div className="flex flex-col gap-8 lg:col-span-5 lg:pr-8">
          <h1 id="hero-title" className="text-display">
            A secure camera can still lie.
          </h1>
          <p className="text-body measure text-bone-2">
            COBRA-WATCH scores exposed cameras on how vulnerable they are and whether their feed is
            still real.
          </p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link href={ROUTES.console} className={buttonVariants({ size: 'lg' })}>
              {CTA_CONSOLE_LABEL}
            </Link>
            <Link
              href={ROUTES.research}
              className={cn(buttonVariants({ variant: 'link', size: 'lg' }), 'group')}
            >
              Read the research
              <ArrowRight
                aria-hidden
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </div>
        <div
          data-stage="hero"
          className="bleed-right-lg flex h-[60vh] min-h-80 items-center justify-center border-y border-line bg-ink-1 lg:col-span-7 lg:h-[min(80dvh,56rem)] lg:border-l"
        >
          <HoodGauge
            size={320}
            label="The COBRA-WATCH hood: nine ribs fanned around an amber eye"
          />
        </div>
      </div>
    </section>
  );
}
