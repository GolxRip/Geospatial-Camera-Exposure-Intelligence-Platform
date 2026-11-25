import { expect, test, type Page } from '@playwright/test';
import { facts } from '../../src/lib/content/facts.generated';
import { f3 } from '../../src/lib/format';
import { axeBad, box, openPane, watch, width } from './helpers';

/**
 * The console, device and lab components with data, driven through the labelled preview routes (/console-preview, which is a 404 in a
 * production build unless NEXT_PUBLIC_DESIGN_PREVIEW=true). The data is scripted demo data; these tests check behaviour, not the data.
 */
const stream = (p: Page) => p.locator('section[aria-labelledby="stream-title"]');
const map = (p: Page) => p.locator('section[aria-label="Map"]');
const inspector = (p: Page) => p.locator('section[aria-labelledby="inspector-title"]');
const options = (p: Page) =>
  stream(p).getByRole('listbox', { name: 'Alerts, newest first' }).getByRole('option');

const SECTIONS = [
  'Header',
  'Channel A factors',
  'Channel B',
  'Gate',
  'Scoring models',
  'Decay',
  'Audit trail',
  'Verdict',
];

test.describe('console with data', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/console-preview', { waitUntil: 'networkidle' });
    await openPane(page, 'Stream');
  });

  test('loads clean, is labelled as demo data, and is axe-clean', async ({ page }) => {
    await expect(page.getByText('Demo data: scripted sample devices')).toBeVisible();
    await expect(page.getByText('Live', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Counts')).toContainText('160');
    expect(await axeBad(page)).toEqual([]);
  });

  test('the console page itself is clean (no console errors, no third-party requests)', async ({
    page,
  }) => {
    const { problems, foreign } = watch(page);
    await page.goto('/console-preview', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    expect(problems, problems.join('\n')).toEqual([]);
    expect(foreign, foreign.join(', ')).toEqual([]);
  });

  test('the stream is a virtualised listbox: a window of rows, arrow keys, Enter selects', async ({
    page,
  }) => {
    const list = stream(page).getByRole('listbox', { name: 'Alerts, newest first' });
    await expect(options(page).first()).toBeVisible();
    const n = await options(page).count();
    expect(n).toBeGreaterThan(3);
    expect(n).toBeLessThan(60);
    await expect(options(page).first()).toHaveAttribute('aria-setsize', '240');
    await list.focus();
    await expect(list).toHaveAttribute('aria-activedescendant', 'alert-option-alert-0');
    await page.keyboard.press('ArrowDown');
    await expect(list).toHaveAttribute('aria-activedescendant', 'alert-option-alert-1');
    await page.keyboard.press('End');
    await expect(list).toHaveAttribute('aria-activedescendant', 'alert-option-alert-239');
    await expect(page.locator('#alert-option-alert-239')).toBeVisible();
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await openPane(page, 'Detail');
    await expect(inspector(page).locator('h3')).toHaveText(SECTIONS);
  });

  test('filters narrow the list, an empty result says so, and Clear filters restores it', async ({
    page,
  }) => {
    const filters = stream(page).getByRole('group', { name: 'Alert filters' });
    await filters.getByLabel('Tier').selectOption('low');
    await expect(stream(page).getByText(/^\d+ of 240$/)).toBeVisible();
    const texts = await options(page).allInnerTexts();
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).not.toMatch(/\bHigh\b|\bMedium\b/);
    await filters.getByLabel('Tier').selectOption('high');
    await filters.getByLabel('Gate tripped').check();
    await expect(stream(page).getByText('No alerts match these filters')).toBeVisible();
    await stream(page).getByRole('button', { name: 'Clear filters' }).click();
    await expect(stream(page).getByText('240 alerts')).toBeVisible();
    await filters.getByLabel('Traffic').selectOption('real');
    for (const t of await options(page).allInnerTexts()) expect(t).not.toMatch(/demo/i);
    await filters.getByLabel('Traffic').selectOption('demo');
    for (const t of await options(page).allInnerTexts()) expect(t).toMatch(/demo/i);
  });

  test('Run scenario adds demo rows on top and announces a gate-tripped alert politely', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Run scenario' }).first().click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Gate tripped on Camera 004' }),
    ).toHaveCount(1);
    await expect(options(page).first()).toContainText('Camera 004');
    await expect(options(page).first()).toContainText('Gate tripped');
    await expect(options(page).first()).toContainText('Demo');
  });

  test('selecting a device fills the inspector: eight sections, masked address, honest gaps', async ({
    page,
  }) => {
    await options(page).first().click();
    await openPane(page, 'Detail');
    const ins = inspector(page);
    await expect(ins.locator('h3')).toHaveText(SECTIONS);
    await expect(
      ins.getByText('Tier 2 unavailable: no authorized footage for this device.'),
    ).toBeVisible();
    await expect(ins.getByText('CISA KEV')).toBeVisible();
    await expect(ins.getByRole('img', { name: /^Gate curve\./ })).toBeVisible();
    await expect(ins.getByRole('img', { name: /^Decay curve\./ })).toBeVisible();
    await expect(ins.getByRole('table', { name: /Score this device receives/ })).toBeVisible();
    await expect(
      ins.getByText('IP', { exact: true }).locator('xpath=following-sibling::dd[1]'),
    ).toContainText('•');
    // Visible text only (innerText), so the separate labels of an SVG chart are not glued into something that looks like an address.
    expect(await page.evaluate(() => document.body.innerText)).not.toMatch(
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
    );
    expect(await axeBad(page)).toEqual([]);
  });

  test('the verdict buttons confirm what was sent', async ({ page }) => {
    await options(page).first().click();
    await openPane(page, 'Detail');
    await inspector(page).getByRole('button', { name: 'Verified' }).click();
    await expect(inspector(page).getByText('Sent: verified.')).toBeVisible();
  });

  test('Open forensics goes to the device page for the selected device', async ({ page }) => {
    await options(page).first().click();
    await openPane(page, 'Detail');
    await inspector(page).getByRole('link', { name: 'Open forensics' }).click();
    await expect(page).toHaveURL(/\/console-preview\/devices\/demo-\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Device forensics' })).toBeVisible();
  });

  test('the map fills its pane (not a collapsed canvas), has controls and a legend', async ({
    page,
  }) => {
    await openPane(page, 'Map');
    const canvas = map(page).locator('canvas.maplibregl-canvas');
    await expect(canvas).toHaveCount(1);
    const c = await box(canvas);
    const s = await box(map(page));
    expect(c.height).toBeGreaterThanOrEqual(s.height * 0.9);
    expect(c.width).toBeGreaterThanOrEqual(s.width - 2);
    for (const name of ['Zoom in', 'Zoom out']) {
      const b = await box(map(page).getByRole('button', { name }));
      expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    }
    await expect(map(page).getByText('Gate tripped')).toBeVisible();
    await expect(map(page).getByText('Positions are estimates')).toBeVisible();
  });

  test('the analytics drawer: fleet, alerts (real and demo apart), integrity, ledger, accuracy from the facts', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Analytics' }).click();
    const drawer = page.locator('#analytics-drawer');
    await expect(
      drawer.getByRole('list', { name: 'Devices by trust tier' }).getByRole('listitem'),
    ).toHaveCount(4);
    await drawer.getByRole('tab', { name: 'Alerts' }).click();
    await expect(drawer.getByRole('img', { name: /^Real alerts:/ })).toBeVisible();
    await expect(drawer.getByRole('img', { name: /^Demo alerts:/ })).toBeVisible();
    await drawer.getByRole('tab', { name: 'Integrity' }).click();
    await expect(
      drawer.getByRole('list', { name: 'Devices by gate status' }).getByRole('listitem'),
    ).toHaveCount(3);
    await drawer.getByRole('tab', { name: 'Ledger' }).click();
    await expect(drawer.getByText('Chain verified')).toBeVisible();
    await drawer.getByRole('button', { name: 'Verify full chain' }).click();
    await expect(drawer.getByText('Demo: nothing was verified.')).toBeVisible();
    await drawer.getByRole('tab', { name: 'Accuracy' }).click();
    await expect(drawer.getByRole('link', { name: /Synthetic corpus, n = 120/ })).toBeVisible();
    const rows = drawer.getByRole('list', { name: 'F1 by model' }).getByRole('listitem');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(3)).toContainText(f3(facts['res.model.igdctf'].value.f1));
    expect(await axeBad(page)).toEqual([]);
  });

  test('command palette: Ctrl+K opens it, finds a device, jumps to a city, closes on Escape', async ({
    page,
  }) => {
    await page.keyboard.press('Control+K');
    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await expect(dialog).toBeVisible();
    expect(await axeBad(page)).toEqual([]);
    await page.keyboard.type('Camera 04');
    await expect(dialog.getByRole('option')).toHaveCount(10);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await openPane(page, 'Detail');
    await expect(inspector(page).locator('h3')).toHaveText(SECTIONS);
    await page.keyboard.press('Control+K');
    await page.keyboard.type('Mumbai');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('City')).toHaveValue('Mumbai');
    await expect(page.getByLabel('Counts')).not.toContainText('160');
    await page.keyboard.press('Control+K');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('the top bar and panes stay inside the viewport', async ({ page }) => {
    const o = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth,
      h: document.documentElement.scrollHeight,
      iw: innerWidth,
      ih: innerHeight,
    }));
    expect(o.w).toBeLessThanOrEqual(o.iw);
    expect(o.h).toBeLessThanOrEqual(o.ih);
    const header = await box(page.locator('main > header'));
    expect(header.x + header.width).toBeLessThanOrEqual(width(page) + 1);
    // the three controls the bar must always carry are all in view
    for (const name of ['Run scenario', 'Search', 'Analytics']) {
      const b = await box(page.getByRole('button', { name }).first());
      expect(b.x + b.width).toBeLessThanOrEqual(width(page) + 1);
    }
  });
});

test.describe('device forensics with data', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/console-preview/devices/demo-3', { waitUntil: 'networkidle' });
  });

  test('eight sections in two columns from 1024, one below; the audit trail spans; id not shown', async ({
    page,
  }) => {
    const sections = page.locator('main section[aria-labelledby^="inspector-"]');
    await expect(sections).toHaveCount(8);
    await expect(page.locator('main h2')).toHaveText(SECTIONS);
    const a = await box(sections.nth(0));
    const b = await box(sections.nth(1));
    if (width(page) >= 1024) {
      expect(Math.abs(a.y - b.y)).toBeLessThan(2);
      const audit = await box(sections.nth(6));
      expect(audit.width).toBeGreaterThan(a.width * 1.8);
    } else {
      expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
    }
    await expect(page.locator('body')).not.toContainText('demo-3');
    await expect(page.getByRole('link', { name: 'Open forensics' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to the console' })).toHaveAttribute(
      'href',
      '/console-preview',
    );
    expect(await axeBad(page)).toEqual([]);
  });

  test('the model comparison carries the corpus columns, read from the facts', async ({ page }) => {
    const table = page.getByRole('table', { name: /Score this device receives/ });
    await expect(table.getByRole('columnheader')).toHaveText([
      'Model',
      'This device',
      'F1',
      'Precision',
      'Recall',
      'False alarms',
      'Missed',
    ]);
    const ig = table.getByRole('row').filter({ hasText: 'IG-DCTF' }).first();
    await expect(ig).toContainText(f3(facts['res.model.igdctf'].value.f1));
    await expect(
      page.getByText('Synthetic corpus, n = 120, positive class fabricated'),
    ).toBeVisible();
  });

  test('a device the data does not have is reported as not found, without echoing the id', async ({
    page,
  }) => {
    await page.goto('/console-preview/devices/nope-9', { waitUntil: 'networkidle' });
    await expect(page.getByText('Device not found')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('nope-9');
  });
});

test.describe('lab instruments with scripted actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/console-preview/lab', { waitUntil: 'networkidle' });
  });

  test('simulators show the response verbatim and the alert it produced, and a 429 as it is', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Attack simulators' }).click();
    await page.getByRole('button', { name: 'Replay attack' }).click();
    await expect(page.getByText('Demo: replay-attack accepted.')).toBeVisible();
    await expect(
      page
        .getByRole('heading', { name: 'Resulting alert' })
        .locator('xpath=following-sibling::ul//li'),
    ).toHaveCount(1);
    await page.getByRole('button', { name: 'Rate flood' }).click();
    await expect(page.getByText('Demo: rate limit reached.')).toBeVisible();
    await expect(page.getByText('The request produced no alert.')).toBeVisible();
    expect(await axeBad(page)).toEqual([]);
  });

  test('scenario replay streams twelve events, every one tagged Demo', async ({ page }) => {
    await page.getByRole('tab', { name: 'Scenario replay' }).click();
    await page.getByRole('button', { name: 'Run scenario' }).click();
    await expect(page.getByText('12 of 12')).toBeVisible({ timeout: 10_000 });
    const items = page.getByRole('list', { name: 'Scenario events' }).getByRole('listitem');
    await expect(items).toHaveCount(12);
    for (const t of await items.allInnerTexts()) expect(t).toMatch(/demo/i);
    await expect(page.getByText('Demo: twelve events sent.')).toBeVisible();
  });

  test('natural-language query shows the parsed filters, and a failure verbatim', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Natural-language query' }).click();
    await page.getByLabel('Ask in plain language').fill('cameras in Pune');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('Plain text search: no model parsed this.')).toBeVisible();
    await expect(page.getByText('cameras in Pune', { exact: true }).first()).toBeVisible();
    await page.getByLabel('Ask in plain language').fill('this will fail');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Demo: the query service returned 503.' }),
    ).toBeVisible();
  });
});

test.describe('production build', () => {
  test.skip(!process.env.E2E_PROD, 'set E2E_PROD=1 when pointing at `next start`');
  test('the preview routes are a 404 unless NEXT_PUBLIC_DESIGN_PREVIEW=true was set at build time', async ({
    page,
  }) => {
    for (const path of [
      '/console-preview',
      '/console-preview/devices/demo-1',
      '/console-preview/lab',
      '/design-system',
    ]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
    }
  });
});
