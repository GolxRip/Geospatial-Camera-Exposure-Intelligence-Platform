'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { NAV_LINKS, ROUTES } from '@/lib/constants/routes';
import type { MapDevice } from '@/lib/data/types';

const DEVICE_LIMIT = 20;
const itemClass =
  'flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-control px-3 text-sm text-bone data-[selected=true]:bg-ink-3 data-[disabled=true]:opacity-45';
const groupClass =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-bone-2';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cities: string[];
  onCityChange: (city: string) => void;
  devices: MapDevice[];
  onSelectDevice: (id: string) => void;
  onRunScenario?: () => void;
  onToggleAnalytics: () => void;
}

/**
 * Command palette (FRONTEND_SPEC.md section 10.6): navigate, jump to a city, find a device, run a scenario, open analytics.
 * Devices are searched by label and masked address only after two characters, and at most twenty are listed, so a large fleet
 * never renders as thousands of rows. The plain-language query is not built: it needs a language-model endpoint of your own.
 * Glass is allowed here and in the nav, and nowhere else.
 */
export function CommandPalette(props: CommandPaletteProps) {
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-modal bg-ink-0/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="glass fixed left-1/2 top-[12dvh] z-modal w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-panel border border-line-strong"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          {/* The body mounts when the dialog opens, so the query starts empty every time. */}
          <PaletteBody {...props} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PaletteBody({
  onOpenChange,
  cities,
  onCityChange,
  devices,
  onSelectDevice,
  onRunScenario,
  onToggleAnalytics,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: MapDevice[] = [];
    for (const d of devices) {
      if (d.label.toLowerCase().includes(q) || d.maskedIp.toLowerCase().includes(q)) {
        out.push(d);
        if (out.length === DEVICE_LIMIT) break;
      }
    }
    return out;
  }, [devices, query]);

  const run = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };

  return (
    <Command label="Command palette" loop>
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder="Jump to a page, a city or a device"
        className="h-14 w-full border-b border-line bg-transparent px-4 text-base text-bone placeholder:text-bone-2 focus:outline-none"
      />
      <Command.List className="max-h-[50dvh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-bone-2">
          Nothing matches.
        </Command.Empty>
        {matches.length > 0 ? (
          <Command.Group heading="Devices" className={groupClass}>
            {matches.map((d) => (
              <Command.Item
                key={d.id}
                value={`${d.label} ${d.maskedIp} ${d.id}`}
                className={itemClass}
                onSelect={run(() => onSelectDevice(d.id))}
              >
                <span className="truncate">{d.label}</span>
                <span className="num shrink-0 text-xs text-bone-2">{d.maskedIp}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}
        <Command.Group heading="Actions" className={groupClass}>
          {onRunScenario ? (
            <Command.Item value="Run scenario" className={itemClass} onSelect={run(onRunScenario)}>
              Run scenario
            </Command.Item>
          ) : null}
          <Command.Item
            value="Toggle analytics drawer"
            className={itemClass}
            onSelect={run(onToggleAnalytics)}
          >
            Toggle analytics
          </Command.Item>
        </Command.Group>
        <Command.Group heading="Cities" className={groupClass}>
          {cities.map((c) => (
            <Command.Item
              key={c}
              value={`City ${c}`}
              className={itemClass}
              onSelect={run(() => onCityChange(c))}
            >
              {c}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Go to" className={groupClass}>
          {[
            { href: ROUTES.home, label: 'Home' },
            ...NAV_LINKS.filter((l) => l.href !== '/#method'),
          ].map((l) => (
            <Command.Item
              key={l.href}
              value={`Go to ${l.label}`}
              className={itemClass}
              onSelect={run(() => router.push(l.href))}
            >
              {l.label}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command>
  );
}
