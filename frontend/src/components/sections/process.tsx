'use client';

import * as React from 'react';
import { Section } from '@/components/layout/section';
import { CodeBlock } from '@/components/ui/code-block';
import { env } from '@/lib/env';

const REPO_DIR = env.repoUrl.split('/').pop() ?? 'repo';

const STEPS = [
  {
    title: 'Clone and configure',
    label: 'shell',
    code: `git clone ${env.repoUrl}.git\ncd ${REPO_DIR}\ncp .env.example .env`,
  },
  { title: 'Install the backend', label: 'shell', code: 'pip install -r backend/requirements.txt' },
  {
    title: 'Start the API',
    label: 'shell, API and docs on port 8000',
    code: 'python backend/main.py',
  },
  {
    title: 'Start the app',
    label: 'shell, app on port 3000',
    code: 'cd frontend\nnpm install\nnpm run dev',
  },
] as const;

/**
 * "Run it" (FRONTEND_SPEC.md section 7.10): a vertical rail of steps. From 1024 up one sticky code panel sits beside the rail and
 * shows the step in view; below that each step carries its own code block. A line on the rail fills as the steps pass.
 */
export function Process() {
  const [active, setActive] = React.useState(0);
  const refs = React.useRef<(HTMLLIElement | null)[]>([]);

  React.useEffect(() => {
    const els = refs.current.filter((e): e is HTMLLIElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: '-35% 0px -55% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const current = STEPS[active] ?? STEPS[0];

  return (
    <Section id="run-it" title="Run it">
      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <ol className="flex flex-col">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              ref={(el) => {
                refs.current[i] = el;
              }}
              data-step={i}
              className={`flex flex-col gap-4 border-l-2 py-8 pl-6 md:pl-8 lg:min-h-48 ${i <= active ? 'border-signal' : 'border-line-strong'}`}
            >
              <h3 className="text-xl font-semibold tracking-tight">
                <span className="num mr-3 text-sm text-bone-2">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s.title}
              </h3>
              <div className="lg:hidden">
                <CodeBlock code={s.code} label={s.label} />
              </div>
            </li>
          ))}
        </ol>
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <CodeBlock code={current.code} label={current.label} />
          </div>
        </div>
      </div>
    </Section>
  );
}
