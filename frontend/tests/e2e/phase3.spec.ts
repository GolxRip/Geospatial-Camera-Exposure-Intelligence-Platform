import AxeBuilder from '@axe-core/playwright';
import { expect, test, type ConsoleMessage, type Locator, type Page } from '@playwright/test';

/**
 * Phase 3 acceptance: the structure of every page at the four breakpoints of FRONTEND_SPEC.md section 21
 * (1366 = 1280 and up, 1100 = 1024 to 1279, 768 = 768 to 1023, 375 = below 768): where things are, that nothing overflows, that
 * every page is reachable by keyboard and axe-clean. /console and the device route are checked in the state the app ships in, with
 * no data source connected; the console components with data are covered by phase4.spec.ts through the labelled preview routes.
 */
const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/research', name: 'research' },
  { path: '/lab', name: 'lab' },
  { path: '/ethics', name: 'ethics' },
  { path: '/console', name: 'console' },
  { path: '/console/devices/demo-1', name: 'device' },
] as const;

const stage = (page: Page, name: string) => page.locator(`[data-stage="${name}"]:visible`);

async function box(l: Locator) {
  const b = await l.first().boundingBox();
  if (!b) throw new Error('element has no box');
  return b;
}

const width = (page: Page) => page.viewportSize()!.width;
const band = (w: number) => (w >= 1280 ? 'xl' : w >= 1024 ? 'lg' : w >= 768 ? 'md' : 'sm');

function watch(page: Page) {
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

async function axeBad(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

for (const { path, name } of ROUTES) {
  test.describe(`${name}: every page`, () => {
    test('loads clean, with one h1 and a main landmark', async ({ page }, info) => {
      const { problems, foreign } = watch(page);
      const res = await page.goto(path, { waitUntil: 'networkidle' });
      expect(res?.status()).toBe(200);
      await expect(page.locator('main#main')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
      expect(problems, problems.join('\n')).toEqual([]);
      expect(foreign, foreign.join(', ')).toEqual([]);
      await page.screenshot({
        path: `test-results/screens/p3-${info.project.name}-${name}.png`,
        fullPage: true,
      });
    });

    test('has no horizontal overflow', async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      const o = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(o.scroll).toBeLessThanOrEqual(o.inner);
    });

    test('has zero serious or critical axe violations', async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      expect(await axeBad(page)).toEqual([]);
    });

    test('the skip link is the first Tab stop and moves focus to main', async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      await page.keyboard.press('Tab');
      await expect(page.locator('a.skip-link')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#main$/);
    });
  });
}

test.describe('404', () => {
  test('answers 404 with the closed hood and a way back', async ({ page }) => {
    const { problems } = watch(page);
    const res = await page.goto('/does-not-exist', { waitUntil: 'networkidle' });
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to the start' })).toBeVisible();
    // Chromium logs the 404 status of the document itself as a console error; anything else is a real problem.
    const real = problems.filter((p) => !p.includes('status of 404'));
    expect(real, real.join('\n')).toEqual([]);
    expect(await axeBad(page)).toEqual([]);
  });
});

test.describe('navigation', () => {
  test('shows links from 1024 up, and a menu overlay below', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const w = width(page);
    const nav = page.getByRole('navigation', { name: 'Primary' });
    const menuButton = page.getByRole('button', { name: 'Open menu' });
    if (w >= 1024) {
      for (const l of ['Method', 'Research', 'Lab', 'Ethics', 'GitHub']) {
        await expect(nav.getByRole('link', { name: l })).toBeVisible();
      }
      await expect(menuButton).toBeHidden();
      await expect(page.getByRole('link', { name: 'Open console' }).first()).toBeVisible();
    } else {
      await expect(nav).toBeHidden();
      await expect(menuButton).toBeVisible();
      const b = await box(menuButton);
      expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    }
    const pill = await box(page.locator('header').first().locator('> div'));
    expect(pill.height).toBeCloseTo(56, 0);
    expect(pill.y).toBeCloseTo(16, 0);
    expect(pill.x).toBeGreaterThanOrEqual(0);
    expect(pill.x + pill.width).toBeLessThanOrEqual(w);
  });

  test('the overlay opens, traps focus, closes on Escape and returns focus', async ({ page }) => {
    test.skip(width(page) >= 1024, 'the overlay exists below 1024 only');
    await page.goto('/', { waitUntil: 'networkidle' });
    const trigger = page.getByRole('button', { name: 'Open menu' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Menu' });
    await expect(dialog).toBeVisible();
    for (const l of ['Method', 'Research', 'Lab', 'Ethics', 'GitHub', 'Open console']) {
      await expect(dialog.getByRole('link', { name: l })).toBeVisible();
    }
    expect(await axeBad(page)).toEqual([]);
    // Focus stays inside the dialog however many times Tab is pressed
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(
        true,
      );
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('a link in the overlay navigates and closes it', async ({ page }) => {
    test.skip(width(page) >= 1024, 'the overlay exists below 1024 only');
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Research' }).click();
    await expect(page).toHaveURL(/\/research$/);
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('the current page is marked in the nav', async ({ page }) => {
    test.skip(width(page) < 1024, 'links are in the overlay below 1024');
    await page.goto('/lab', { waitUntil: 'networkidle' });
    await expect(
      page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Lab' }),
    ).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('landing layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('hero: text beside the stage from 1024 (stage bleeds to the edge), stacked below', async ({
    page,
  }) => {
    const w = width(page);
    const h1 = await box(page.locator('#hero-title'));
    const heroStage = await box(stage(page, 'hero'));
    const cw = await page.evaluate(() => document.documentElement.clientWidth);
    if (w >= 1024) {
      expect(heroStage.x).toBeGreaterThan(h1.x + h1.width - 1);
      expect(heroStage.x + heroStage.width).toBeGreaterThanOrEqual(cw - 1);
      expect(heroStage.x + heroStage.width).toBeLessThanOrEqual(cw + 1);
      const hero = await box(page.locator('section[aria-labelledby="hero-title"]'));
      expect(hero.height).toBeGreaterThanOrEqual(page.viewportSize()!.height - 1);
    } else {
      expect(heroStage.y).toBeGreaterThanOrEqual(h1.y + h1.height);
      expect(heroStage.height).toBeGreaterThanOrEqual(0.58 * page.viewportSize()!.height);
    }
    // the hero's top padding is at most pt-24 (96 px), clear of the 72 px the nav takes
    const padTop = await page
      .locator('section[aria-labelledby="hero-title"] > div')
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
    expect(padTop).toBeLessThanOrEqual(96);
    expect(padTop).toBeGreaterThanOrEqual(72);
  });

  test('hero: the two calls to action are present and the console label is the only one', async ({
    page,
  }) => {
    const main = page.locator('main');
    await expect(main.getByRole('link', { name: 'Open console' }).first()).toBeVisible();
    await expect(main.getByRole('link', { name: 'Read the research' })).toBeVisible();
    const labels = await page.getByRole('link', { name: /console/i }).allInnerTexts();
    for (const l of labels) expect(l.trim().toLowerCase()).toMatch(/^(open console|console)$/);
  });

  test('blind spot: two columns from 768, one below', async ({ page }) => {
    const cards = page.locator('#blind-spot article');
    await expect(cards).toHaveCount(2);
    const a = await box(cards.nth(0));
    const b = await box(cards.nth(1));
    if (width(page) >= 768) {
      expect(Math.abs(a.y - b.y)).toBeLessThan(2);
      expect(b.x).toBeGreaterThan(a.x + a.width - 1);
    } else {
      expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
      expect(Math.abs(a.x - b.x)).toBeLessThan(2);
    }
  });

  test('walk the gate: one sticky stage from 1024 that stays pinned, an inline stage per panel below', async ({
    page,
  }) => {
    const panels = page.locator('#method ol > li');
    await expect(panels).toHaveCount(5);
    const inline = stage(page, 'inline');
    if (width(page) >= 1024) {
      await expect(inline).toHaveCount(0);
      const sticky = page.locator('[data-stage="sticky"] > div');
      await expect(sticky).toBeVisible();
      await panels.nth(2).scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(150);
      const b = await box(sticky);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
      const p = await box(panels.nth(2));
      expect(p.x).toBeGreaterThan(b.x + b.width - 1);
      // Each panel is at least 80 percent of the viewport high, so the section is about 400vh
      const section = await box(page.locator('#method ol'));
      expect(section.height).toBeGreaterThanOrEqual(5 * 0.8 * page.viewportSize()!.height - 5);
    } else {
      await expect(stage(page, 'sticky')).toHaveCount(0);
      await expect(inline).toHaveCount(5);
      const h = await box(inline.first());
      expect(h.height).toBeGreaterThanOrEqual(0.58 * page.viewportSize()!.height);
    }
  });

  test('gate explorer: controls beside the visuals from 1024, above below', async ({ page }) => {
    const controls = await box(page.locator('#explorer ul[aria-label="Controls"]'));
    const outputs = await box(page.locator('#explorer ul[aria-label="Outputs"]'));
    if (width(page) >= 1024) {
      expect(outputs.x).toBeGreaterThan(controls.x + controls.width - 1);
    } else {
      expect(outputs.y).toBeGreaterThanOrEqual(controls.y + controls.height);
    }
    const n = await page.locator('#explorer ul[aria-label="Outputs"] > li').count();
    expect(n).toBe(7);
  });

  test('results: the synthetic corpus chip sits in the section and links to the limits', async ({
    page,
  }) => {
    const chip = page.locator('#results').getByRole('link', { name: /Synthetic corpus, n = \d+/ });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute('href', '/research#limits');
    await expect(page.locator('#results ul[aria-label="F1 by model"] > li')).toHaveCount(4);
  });

  test('pipeline: six across from 1024, three per row from 768, one column below', async ({
    page,
  }) => {
    const items = page.locator('#pipeline ol > li');
    await expect(items).toHaveCount(6);
    const boxes = [] as { x: number; y: number }[];
    for (let i = 0; i < 6; i += 1) boxes.push(await box(items.nth(i)));
    const rows = new Set(boxes.map((b) => Math.round(b.y)));
    const cols = new Set(boxes.map((b) => Math.round(b.x)));
    const bd = band(width(page));
    if (bd === 'xl' || bd === 'lg') expect([rows.size, cols.size]).toEqual([1, 6]);
    else if (bd === 'md') expect([rows.size, cols.size]).toEqual([2, 3]);
    else expect([rows.size, cols.size]).toEqual([6, 1]);
  });

  test('map band runs edge to edge', async ({ page }) => {
    await stage(page, 'map-band').scrollIntoViewIfNeeded();
    const band = await box(stage(page, 'map-band'));
    const cw = await page.evaluate(() => document.documentElement.clientWidth);
    expect(Math.round(band.x)).toBe(0);
    expect(Math.round(band.width)).toBe(cw);
    await expect(page.locator('#map').getByText('No device data on this page')).toBeVisible();
  });

  test('ethics: three columns from 768, one below', async ({ page }) => {
    const cols = page.locator('#ethics .grid > div');
    await expect(cols).toHaveCount(3);
    const ys = new Set<number>();
    for (let i = 0; i < 3; i += 1) ys.add(Math.round((await box(cols.nth(i))).y));
    expect(ys.size).toBe(width(page) >= 768 ? 1 : 3);
  });

  test('run it: a sticky code panel from 1024, a code block per step below', async ({ page }) => {
    await expect(page.locator('#run-it ol > li')).toHaveCount(4);
    const copy = page.locator('#run-it').getByRole('button', { name: 'Copy' });
    // one code panel beside the rail from 1024, one under each step below
    await expect(copy.filter({ visible: true })).toHaveCount(width(page) >= 1024 ? 1 : 4);
  });

  test('headings are in order: one h1, then h2 sections, then h3', async ({ page }) => {
    const levels = await page
      .locator('main h1, main h2, main h3')
      .evaluateAll((els) => els.map((e) => Number(e.tagName[1])));
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    for (let i = 1; i < levels.length; i += 1)
      expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(9);
  });

  test('the footer carries the six links', async ({ page }) => {
    const footer = page.getByRole('navigation', { name: 'Footer' });
    for (const l of ['Research', 'Lab', 'Console', 'Ethics', 'GitHub', 'results.md']) {
      await expect(footer.getByRole('link', { name: l })).toBeVisible();
    }
  });
});

test.describe('console layout', () => {
  const stream = (p: Page) => p.locator('section[aria-labelledby="stream-title"]');
  const map = (p: Page) => p.locator('section[aria-label="Map"]');
  const inspector = (p: Page) => p.locator('section[aria-labelledby="inspector-title"]');

  test.beforeEach(async ({ page }) => {
    await page.goto('/console', { waitUntil: 'networkidle' });
  });

  test('fills the viewport and scrolls inside its panes, never the page', async ({ page }) => {
    const o = await page.evaluate(() => ({
      h: document.documentElement.scrollHeight,
      inner: window.innerHeight,
    }));
    expect(o.h).toBeLessThanOrEqual(o.inner);
  });

  test('panes follow the breakpoint table', async ({ page }) => {
    const w = width(page);
    const bd = band(w);
    if (bd === 'xl' || bd === 'lg') {
      for (const p of [stream(page), map(page), inspector(page)]) await expect(p).toBeVisible();
      const s = await box(stream(page));
      const m = await box(map(page));
      const i = await box(inspector(page));
      expect(m.x).toBeGreaterThan(s.x + s.width - 2);
      expect(i.x).toBeGreaterThan(m.x + m.width - 2);
      if (bd === 'xl') {
        // 3 : 6 : 3 columns
        expect(Math.abs(s.width - i.width)).toBeLessThan(4);
        expect(m.width / s.width).toBeGreaterThan(1.9);
        expect(m.width / s.width).toBeLessThan(2.1);
      } else {
        expect(i.width).toBeLessThan(s.width);
      }
      await expect(page.getByRole('group', { name: 'Panes' })).toBeHidden();
      await expect(page.getByRole('group', { name: 'Side pane' })).toBeHidden();
    } else if (bd === 'md') {
      await expect(map(page)).toBeVisible();
      await expect(stream(page)).toBeVisible();
      await expect(inspector(page)).toBeHidden();
      const side = page.getByRole('group', { name: 'Side pane' });
      await expect(side.getByRole('button', { name: 'Stream' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await side.getByRole('button', { name: 'Detail' }).click();
      await expect(inspector(page)).toBeVisible();
      await expect(stream(page)).toBeHidden();
      await expect(map(page)).toBeVisible();
      await expect(side.getByRole('button', { name: 'Detail' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      const m = await box(map(page));
      const i = await box(inspector(page));
      expect(i.x).toBeGreaterThan(m.x + m.width - 2);
    } else {
      const tabs = page.getByRole('group', { name: 'Panes' });
      await expect(map(page)).toBeVisible();
      await expect(stream(page)).toBeHidden();
      await expect(inspector(page)).toBeHidden();
      await tabs.getByRole('button', { name: 'Stream' }).click();
      await expect(stream(page)).toBeVisible();
      await expect(map(page)).toBeHidden();
      await tabs.getByRole('button', { name: 'Detail' }).click();
      await expect(inspector(page)).toBeVisible();
      await expect(stream(page)).toBeHidden();
      await tabs.getByRole('button', { name: 'Map' }).click();
      await expect(map(page)).toBeVisible();
      const m = await box(map(page));
      expect(m.width).toBeGreaterThanOrEqual(width(page) - 1);
    }
  });

  test('every pane is reachable and axe-clean in each state', async ({ page }) => {
    expect(await axeBad(page)).toEqual([]);
    if (width(page) < 1024) {
      const group = page.getByRole('group', { name: width(page) >= 768 ? 'Side pane' : 'Panes' });
      await group.getByRole('button', { name: 'Detail' }).click();
      expect(await axeBad(page)).toEqual([]);
      await group.getByRole('button', { name: 'Stream' }).click();
      expect(await axeBad(page)).toEqual([]);
    }
  });

  test('with no data source connected every panel says so and nothing is invented', async ({
    page,
  }) => {
    const w = width(page);
    const group = page.getByRole('group', { name: w >= 768 ? 'Side pane' : 'Panes' });
    await expect(page.getByText('Disconnected')).toBeVisible();
    await expect(page.getByText('Counts unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run scenario' })).toBeDisabled();
    // map pane
    if (w < 768) await group.getByRole('button', { name: 'Map' }).click();
    await expect(map(page).getByText('Data source not reachable.')).toBeVisible();
    await expect(map(page).locator('canvas.maplibregl-canvas')).toHaveCount(1);
    // stream pane
    if (w < 1024) await group.getByRole('button', { name: 'Stream' }).click();
    await expect(stream(page).getByText('Data source not reachable.')).toBeVisible();
    await expect(stream(page).getByRole('listbox')).toHaveCount(0);
    // inspector pane
    if (w < 1024) await group.getByRole('button', { name: 'Detail' }).click();
    await expect(inspector(page).getByText('No device selected')).toBeVisible();
    // no address, score or device name appears anywhere
    expect(await page.evaluate(() => document.body.innerText)).not.toMatch(
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
    );
    await expect(page.locator('body')).not.toContainText('Demo data');
  });

  test('the analytics drawer opens under the panes with five tabs that move with the arrow keys', async ({
    page,
  }) => {
    const toggle = page.getByRole('button', { name: 'Analytics' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const drawer = page.locator('#analytics-drawer');
    await expect(drawer).toBeVisible();
    const tabs = drawer.getByRole('tab');
    await expect(tabs).toHaveText(['Fleet', 'Alerts', 'Integrity', 'Ledger', 'Accuracy']);
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    const d = await box(drawer);
    const m = await box(
      page
        .locator('section[aria-labelledby="stream-title"], section[aria-label="Map"]')
        .filter({ visible: true }),
    );
    expect(d.y).toBeGreaterThanOrEqual(m.y + m.height - 1);
    const o = await page.evaluate(() => ({
      h: document.documentElement.scrollHeight,
      inner: window.innerHeight,
    }));
    expect(o.h).toBeLessThanOrEqual(o.inner);
    expect(await axeBad(page)).toEqual([]);
    await toggle.click();
    await expect(drawer).toBeHidden();
  });

  test('the top bar wraps instead of overflowing, and every control stays inside the viewport', async ({
    page,
  }) => {
    const header = await box(page.locator('main > header'));
    expect(header.x + header.width).toBeLessThanOrEqual(width(page) + 1);
    const items = page.locator('main > header > *:visible');
    const n = await items.count();
    for (let i = 0; i < n; i += 1) {
      const b = await items.nth(i).boundingBox();
      if (b && b.width > 0) expect(b.x + b.width).toBeLessThanOrEqual(width(page) + 1);
    }
  });
});

test.describe('device forensics layout', () => {
  test('the route reads the id without showing it, and says so when there is no data source', async ({
    page,
  }) => {
    await page.goto('/console/devices/demo-1', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).not.toContainText('demo-1');
    await expect(page.getByRole('link', { name: 'Back to the console' })).toHaveAttribute(
      'href',
      '/console',
    );
    await expect(page.getByText('Data source not reachable.')).toBeVisible();
    await expect(page.locator('main section[aria-labelledby^="inspector-"]')).toHaveCount(0);
  });
});

test.describe('lab and research layout', () => {
  test('lab tabs: four instruments, arrow keys move between them, every panel is demo-labelled page-wide', async ({
    page,
  }) => {
    await page.goto('/lab', { waitUntil: 'networkidle' });
    await expect(page.getByText('Demo scenario')).toBeVisible();
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveText([
      'Gate explorer',
      'Attack simulators',
      'Scenario replay',
      'Natural-language query',
    ]);
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    // shipped without a data source: five simulators, all disabled, with the reason beside them
    const sims = page.getByRole('list', { name: 'Simulators' }).getByRole('button');
    await expect(sims).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) await expect(sims.nth(i)).toBeDisabled();
    await expect(page.getByText('Not connected to a data source.')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: 'Run scenario' })).toBeDisabled();
    await page.keyboard.press('End');
    await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Ask in plain language')).toBeDisabled();
    // tabs wrap at narrow widths instead of scrolling sideways
    const list = await box(page.getByRole('tablist'));
    expect(list.x + list.width).toBeLessThanOrEqual(width(page) + 1);
  });

  test('research: contents rail beside the text from 1024, above it below; limits anchor exists', async ({
    page,
  }) => {
    await page.goto('/research', { waitUntil: 'networkidle' });
    const toc = await box(page.getByRole('navigation', { name: 'On this page' }));
    const first = await box(page.locator('#problem'));
    if (width(page) >= 1024) {
      expect(first.x).toBeGreaterThan(toc.x + toc.width - 1);
      // the rail stays in view while the text scrolls
      await page.locator('#benchmarks').scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(150);
      const t = await box(page.getByRole('navigation', { name: 'On this page' }).locator('ol'));
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeLessThanOrEqual(120);
    } else {
      expect(first.y).toBeGreaterThanOrEqual(toc.y + toc.height);
    }
    await expect(page.locator('#limits')).toHaveCount(1);
    await page.goto('/research#limits', { waitUntil: 'networkidle' });
    const lim = await box(page.locator('#limits h2'));
    expect(lim.y).toBeGreaterThanOrEqual(0);
    expect(lim.y).toBeLessThan(200);
    await expect(page.locator('#propositions h3')).toHaveCount(5);
  });

  test('ethics: scope tables side by side from 768, stacked below', async ({ page }) => {
    await page.goto('/ethics', { waitUntil: 'networkidle' });
    const a = await box(page.getByRole('heading', { name: 'In scope' }));
    const b = await box(page.getByRole('heading', { name: 'Out of scope' }));
    if (width(page) >= 768) expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    else expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
  });
});
