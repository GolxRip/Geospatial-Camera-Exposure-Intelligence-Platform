import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Landing section frame: an id for anchors, a heading that labels the section, and the vertical rhythm
 * (96 px on small screens, 128 px from 768 up). `bleed` drops the page container so a child can run edge to edge.
 */
export function Section({
  id,
  title,
  children,
  className,
  bleed = false,
  headerExtra,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
  bleed?: boolean;
  headerExtra?: React.ReactNode;
}) {
  const heading = (
    <div className="mb-10 flex flex-col gap-4 md:mb-14 md:flex-row md:items-end md:justify-between">
      <h2 id={`${id}-title`} className="text-h2 measure">
        {title}
      </h2>
      {headerExtra}
    </div>
  );
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn('scroll-mt-24 py-24 md:py-32', className)}
    >
      {bleed ? (
        <>
          <div className="page-container">{heading}</div>
          {children}
        </>
      ) : (
        <div className="page-container">
          {heading}
          {children}
        </div>
      )}
    </section>
  );
}
