'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, X } from '@phosphor-icons/react/dist/ssr';
import { Logo } from '@/components/brand/logo';
import { buttonVariants } from '@/components/ui/button';
import { CTA_CONSOLE_LABEL, NAV_LINKS, ROUTES } from '@/lib/constants/routes';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils';

const linkClass =
  'rounded-chip px-1 py-2 text-sm text-bone-2 underline-offset-[10px] transition-surface hover:text-bone aria-[current=page]:text-bone aria-[current=page]:underline aria-[current=page]:decoration-signal aria-[current=page]:decoration-2';

/**
 * Floating glass pill (FRONTEND_SPEC.md section 7.1), detached 16 px from the top, 56 px high, one of the two
 * places glass is allowed. From 1024 up it shows the links; below that the links live in a full-screen overlay.
 * The hide-on-scroll behaviour and the sliding underline are added with the animation system (phase 6).
 */
export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-nav flex justify-center px-4">
      <div className="glass pointer-events-auto flex h-14 w-full max-w-fit items-center gap-4 rounded-control border border-line pl-5 pr-2 lg:gap-8">
        <Link href={ROUTES.home} aria-label="COBRA-WATCH, home" className="rounded-chip">
          <Logo markSize={32} />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              className={linkClass}
            >
              {item.label}
            </Link>
          ))}
          <a href={env.repoUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            GitHub
          </a>
        </nav>

        <Link
          href={ROUTES.console}
          className={cn(buttonVariants({ size: 'sm' }), 'hidden md:inline-flex')}
        >
          {CTA_CONSOLE_LABEL}
        </Link>

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label="Open menu"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-bone transition-surface hover:bg-ink-3 lg:hidden"
            >
              <svg
                aria-hidden
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M3 7h14M3 13h14" />
              </svg>
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Content className="fixed inset-0 z-modal flex flex-col overflow-y-auto bg-ink-0 px-5 pb-10 pt-4 md:px-8">
              <Dialog.Title className="sr-only">Menu</Dialog.Title>
              <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
              <div className="flex h-14 items-center justify-between">
                <Link
                  href={ROUTES.home}
                  aria-label="COBRA-WATCH, home"
                  onClick={() => setOpen(false)}
                  className="rounded-chip"
                >
                  <Logo markSize={32} />
                </Link>
                <Dialog.Close
                  aria-label="Close menu"
                  className="inline-flex size-11 items-center justify-center rounded-control text-bone transition-surface hover:bg-ink-3"
                >
                  <X aria-hidden size={20} />
                </Dialog.Close>
              </div>
              <nav aria-label="Menu" className="mt-12 flex flex-col gap-2">
                {NAV_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={pathname === item.href ? 'page' : undefined}
                    className="rounded-chip py-3 text-4xl font-semibold tracking-tight text-bone aria-[current=page]:text-signal"
                  >
                    {item.label}
                  </Link>
                ))}
                <a
                  href={env.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-chip py-3 text-4xl font-semibold tracking-tight text-bone"
                >
                  GitHub
                </a>
              </nav>
              <Link
                href={ROUTES.console}
                onClick={() => setOpen(false)}
                className={cn(buttonVariants({ size: 'lg' }), 'mt-12 self-start')}
              >
                {CTA_CONSOLE_LABEL}
                <ArrowRight aria-hidden size={16} />
              </Link>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}
