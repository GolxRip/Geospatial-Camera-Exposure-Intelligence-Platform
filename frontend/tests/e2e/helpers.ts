import AxeBuilder from '@axe-core/playwright';
import type { ConsoleMessage, Locator, Page } from '@playwright/test';

export async function box(l: Locator) {
  const b = await l.first().boundingBox();
  if (!b) throw new Error('element has no box');
  return b;
}

export const width = (page: Page) => page.viewportSize()!.width;

export function watch(page: Page) {
  const problems: string[] = [];
  const foreign: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  page.on('request', (r) => {
    const { hostname, protocol } = new URL(r.url());
    if (protocol.startsWith('http') && hostname !== 'localhost' && hostname !== '127.0.0.1')
      foreign.push(r.url());
  });
  return { problems, foreign };
}

export async function axeBad(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

/** The console shows one pane at a time below 1024. These open the one a test needs; from 1024 up all three are on screen. */
export async function openPane(page: Page, name: 'Map' | 'Stream' | 'Detail') {
  const w = width(page);
  if (w >= 1024) return;
  const group = page.getByRole('group', { name: w >= 768 ? 'Side pane' : 'Panes' });
  if (w >= 768 && name === 'Map') return;
  await group.getByRole('button', { name, exact: true }).click();
}
