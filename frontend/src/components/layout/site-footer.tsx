import Link from 'next/link';
import { HoodGauge } from '@/components/ui/hood-gauge';
import { ROUTES } from '@/lib/constants/routes';
import { env, repoFileUrl } from '@/lib/env';

const linkClass =
  'rounded-chip text-sm text-bone-2 underline-offset-4 transition-surface hover:text-bone hover:underline';

/**
 * Footer (FRONTEND_SPEC.md section 7.12): the mark, one line about the project, and the links. No version strings and no
 * locale strip. The credit line waits on open decision 7.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line py-16">
      <div className="page-container flex flex-col gap-10 md:flex-row md:justify-between">
        <div className="flex max-w-sm flex-col gap-4">
          <HoodGauge size={48} decorative />
          <p className="text-sm text-bone-2">
            Trust scores for exposed cameras. Vulnerability posture, gated by signal integrity.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-12 gap-y-3 sm:grid-cols-3">
            <li>
              <Link href={ROUTES.research} className={linkClass}>
                Research
              </Link>
            </li>
            <li>
              <Link href={ROUTES.lab} className={linkClass}>
                Lab
              </Link>
            </li>
            <li>
              <Link href={ROUTES.console} className={linkClass}>
                Console
              </Link>
            </li>
            <li>
              <Link href={ROUTES.ethics} className={linkClass}>
                Ethics
              </Link>
            </li>
            <li>
              <a href={env.repoUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                GitHub
              </a>
            </li>
            <li>
              <a
                href={repoFileUrl('paper/results.md')}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                results.md
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
