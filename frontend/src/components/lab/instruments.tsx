'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { DemoTag } from '@/components/ui/demo-tag';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { TierTag } from '@/components/ui/tier-tag';
import type {
  AlertRow,
  LabActions,
  NlQueryResult,
  ScenarioOutcome,
  SimulationResult,
  SimulatorId,
} from '@/lib/data/types';

const SIMULATORS: { id: SimulatorId; name: string; tries: string }[] = [
  {
    id: 'replay-attack',
    name: 'Replay attack',
    tries: 'Resend an event that was already accepted.',
  },
  {
    id: 'timestamp-skew',
    name: 'Timestamp skew',
    tries: 'Send an event whose timestamp is far from the server clock.',
  },
  { id: 'rate-flood', name: 'Rate flood', tries: 'Send events faster than the rate limit allows.' },
  {
    id: 'collusion-ring',
    name: 'Collusion ring',
    tries: 'Send events from cameras that corroborate each other in a ring.',
  },
  { id: 'reset', name: 'Reset', tries: 'Clear the simulators’ state.' },
];

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function NotConnected({ id }: { id: string }) {
  return (
    <p id={id} className="text-sm text-bone-2">
      Not connected to a data source. Nothing here is simulated in its place.
    </p>
  );
}

function AlertLine({ a }: { a: AlertRow }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2 text-sm">
      <time dateTime={a.time} className="num text-xs text-bone-2">
        {new Date(a.time).toISOString().slice(11, 19)}
      </time>
      <span className="min-w-0 flex-1 truncate text-bone">{a.deviceLabel}</span>
      <TierTag tier={a.tier} gateTripped={a.gateTripped} demo={a.demo} size={14} />
      <span className="num text-bone">{a.score === null ? '--' : Math.round(a.score)}</span>
      {a.demo ? <DemoTag compact /> : null}
    </li>
  );
}

/** Attack simulators (FRONTEND_SPEC.md section 12): one button each, the service's own response and the alert it produced. */
export function SimulatorsPanel({ onSimulate }: Pick<LabActions, 'onSimulate'>) {
  const [pending, setPending] = React.useState<SimulatorId | null>(null);
  const [result, setResult] = React.useState<{ id: SimulatorId; data: SimulationResult } | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  const run = async (id: SimulatorId) => {
    if (!onSimulate) return;
    setPending(id);
    setError(null);
    try {
      setResult({ id, data: await onSimulate(id) });
    } catch (e) {
      setResult(null);
      setError(message(e));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <ul aria-label="Simulators" className="flex flex-col gap-3">
          {SIMULATORS.map((s) => (
            <li key={s.id} className="flex flex-col gap-1">
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                disabled={!onSimulate || pending !== null}
                aria-describedby={onSimulate ? `sim-${s.id}` : 'sim-offline'}
                onClick={() => void run(s.id)}
              >
                {pending === s.id ? `${s.name}…` : s.name}
              </Button>
              <span id={`sim-${s.id}`} className="text-xs text-bone-2">
                {s.tries}
              </span>
            </li>
          ))}
        </ul>
        {!onSimulate ? <NotConnected id="sim-offline" /> : null}
      </div>
      <div className="flex flex-col gap-6" aria-live="polite">
        <section aria-labelledby="sim-response-title" className="flex flex-col gap-2">
          <h3 id="sim-response-title" className="text-base font-semibold tracking-tight">
            Response
          </h3>
          {error ? (
            <InlineError title="The request failed" detail={error} />
          ) : result ? (
            <p className="text-sm text-bone">
              <span className="num text-bone">{result.data.status}</span>{' '}
              <span className="text-bone-2">{result.data.reason}</span>
            </p>
          ) : (
            <EmptyState title="No request sent yet">Pick a simulator to send one.</EmptyState>
          )}
        </section>
        <section aria-labelledby="sim-alert-title" className="flex flex-col gap-2">
          <h3 id="sim-alert-title" className="text-base font-semibold tracking-tight">
            Resulting alert
          </h3>
          {result ? (
            result.data.alert ? (
              <ul>
                <AlertLine a={result.data.alert} />
              </ul>
            ) : (
              <p className="text-sm text-bone-2">The request produced no alert.</p>
            )
          ) : (
            <p className="text-sm text-bone-2">Shown here after a request.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/** Scenario replay: twelve synthetic events streamed in as they arrive, always tagged Demo. Errors are shown verbatim. */
export function ReplayPanel({ onRunScenario }: Pick<LabActions, 'onRunScenario'>) {
  const [running, setRunning] = React.useState(false);
  const [events, setEvents] = React.useState<AlertRow[]>([]);
  const [outcome, setOutcome] = React.useState<ScenarioOutcome | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = async () => {
    if (!onRunScenario) return;
    setRunning(true);
    setEvents([]);
    setOutcome(null);
    setError(null);
    try {
      setOutcome(await onRunScenario((e) => setEvents((rows) => [...rows, { ...e, demo: true }])));
    } catch (e) {
      setError(message(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-bone-2">
          Twelve synthetic events, two seconds apart, streamed into the list as they arrive.
        </p>
        <Button
          size="sm"
          className="self-start"
          disabled={!onRunScenario || running}
          aria-describedby={onRunScenario ? undefined : 'replay-offline'}
          onClick={() => void run()}
        >
          {running ? 'Running…' : 'Run scenario'}
        </Button>
        {!onRunScenario ? <NotConnected id="replay-offline" /> : null}
        <div aria-live="polite">
          {error ? <InlineError title="The scenario did not run" detail={error} /> : null}
          {outcome ? (
            <p className="text-sm text-bone">
              <span className="num">{outcome.status}</span>{' '}
              <span className="text-bone-2">{outcome.message}</span>
            </p>
          ) : null}
        </div>
      </div>
      <section aria-labelledby="replay-events-title" className="flex flex-col gap-2">
        <h3 id="replay-events-title" className="text-base font-semibold tracking-tight">
          Events <span className="num text-xs font-normal text-bone-2">{events.length} of 12</span>
        </h3>
        {events.length === 0 ? (
          <EmptyState title="No events yet">Run the scenario to stream them in.</EmptyState>
        ) : (
          <ul aria-label="Scenario events">
            {events.map((a) => (
              <AlertLine key={a.id} a={a} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Natural-language query: the parsed filters stay visible so a query can be audited, next to the matching devices. */
export function QueryPanel({ onNlQuery }: Pick<LabActions, 'onNlQuery'>) {
  const [q, setQ] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<NlQueryResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onNlQuery || q.trim() === '') return;
    setPending(true);
    setError(null);
    try {
      setResult(await onNlQuery(q.trim()));
    } catch (err) {
      setResult(null);
      setError(message(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => void submit(e)}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1 text-sm text-bone-2">
          Ask in plain language
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={!onNlQuery}
            aria-describedby={onNlQuery ? undefined : 'nl-offline'}
            className="h-11 rounded-control border border-line-strong bg-ink-2 px-4 text-base text-bone placeholder:text-bone-2 disabled:opacity-45"
          />
        </label>
        <Button type="submit" disabled={!onNlQuery || pending || q.trim() === ''}>
          {pending ? 'Searching…' : 'Search'}
        </Button>
      </form>
      {!onNlQuery ? <NotConnected id="nl-offline" /> : null}
      <div className="grid gap-6 md:grid-cols-2" aria-live="polite">
        {error ? (
          <div className="md:col-span-2">
            <InlineError title="The query failed" detail={error} />
          </div>
        ) : null}
        <section aria-labelledby="nl-filters-title" className="flex flex-col gap-2">
          <h3 id="nl-filters-title" className="text-base font-semibold tracking-tight">
            Parsed filters
          </h3>
          {result ? (
            <>
              <p className="text-sm text-bone-2">
                {result.parsedByModel
                  ? 'Parsed by a language model.'
                  : 'Plain text search: no model parsed this.'}
              </p>
              {result.filters.length === 0 ? (
                <p className="text-sm text-bone-2">No filters.</p>
              ) : (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {result.filters.map((f) => (
                    <React.Fragment key={f.name}>
                      <dt className="text-bone-2">{f.name}</dt>
                      <dd className="num text-bone">{f.value}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              )}
            </>
          ) : (
            <p className="text-sm text-bone-2">Shown here after a query.</p>
          )}
        </section>
        <section aria-labelledby="nl-devices-title" className="flex flex-col gap-2">
          <h3 id="nl-devices-title" className="text-base font-semibold tracking-tight">
            Matching devices
          </h3>
          {result ? (
            result.devices.length === 0 ? (
              <p className="text-sm text-bone-2">No device matches.</p>
            ) : (
              <ul>
                {result.devices.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 border-b border-line py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-bone">{d.label}</span>
                    <span className="num text-xs text-bone-2">{d.maskedIp}</span>
                    <TierTag tier={d.tier} gateTripped={d.gateTripped} size={14} />
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p className="text-sm text-bone-2">Shown here after a query.</p>
          )}
        </section>
      </div>
    </div>
  );
}
