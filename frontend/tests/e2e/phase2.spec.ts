import AxeBuilder from '@axe-core/playwright';
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * Phase 1 and 2 acceptance in a real browser, at 1366x768, 768 and 375 wide (see playwright.config.ts).
 * /design-system is the development preview of the primitives; it only exists outside production builds.
 */
const PAGES = [
  { path: '/', name: 'home' },
  { path: '/design-system', name: 'design-system' },
] as const;

const section = (page: Page, id: string) => page.locator(`section[aria-labelledby="${id}"]`);

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

for (const { path, name } of PAGES) {
  test.describe(`${name}`, () => {
    test('loads without console errors, hydration warnings or third-party requests', async ({
      page,
    }, info) => {
      const { problems, foreign } = watch(page);
      const res = await page.goto(path, { waitUntil: 'networkidle' });
      expect(res?.status()).toBe(200);
      await expect(page.locator('main#main')).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);
      expect(problems, problems.join('\n')).toEqual([]);
      expect(foreign, `third-party requests: ${foreign.join(', ')}`).toEqual([]);
      await page.screenshot({
        path: `test-results/screens/${info.project.name}-${name}.png`,
        fullPage: true,
      });
    });

    test('has no horizontal overflow', async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.inner);
    });

    test('has zero serious or critical axe violations', async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      const results = await new AxeBuilder({ page }).analyze();
      const bad = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(
        bad.map(
          (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
        ),
      ).toEqual([]);
    });

    test('keyboard: the first Tab stop is the skip link, and it moves focus to main', async ({
      page,
    }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      await page.keyboard.press('Tab');
      const skip = page.locator('a.skip-link');
      await expect(skip).toBeFocused();
      const box = await skip.boundingBox();
      expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#main$/);
    });
  });
}

test.describe('design-system primitives', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/design-system', { waitUntil: 'networkidle' });
  });

  test('focus ring is a 2 px amber outline on every interactive element reached by keyboard', async ({
    page,
  }) => {
    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Tab'); // first control after it
    const ring = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const s = getComputedStyle(el);
        return { color: s.outlineColor, width: s.outlineWidth, style: s.outlineStyle };
      });
    // The ring must appear at once (no colour transition on outline), so no polling is needed.
    expect(await ring()).toEqual({ color: 'rgb(243, 163, 58)', width: '2px', style: 'solid' });
  });

  test('every tier state carries a text label, not colour alone', async ({ page }) => {
    const tiers = section(page, 'tiers');
    for (const label of ['High', 'Medium', 'Low', 'Gate tripped', 'Unscored']) {
      await expect(tiers.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test('hood gauges expose their values to assistive technology', async ({ page }) => {
    await expect(
      page.getByRole('img', { name: 'Gate multiplier 0.30, trust score 30' }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('img', { name: 'Gate multiplier 1.00, trust score 100' }).first(),
    ).toBeVisible();
  });

  test('SourceNote links to the results.md heading it came from and shows its source', async ({
    page,
  }) => {
    const link = page
      .getByRole('link', { name: 'Source: paper/results.md, 1. Four-model comparison' })
      .first();
    await expect(link).toHaveAttribute(
      'href',
      /\/blob\/master\/paper\/results\.md#1-four-model-comparison$/,
    );
    // Tooltips open on keyboard focus (Radix ignores a programmatic focus()), so reach the link with Tab.
    await link.scrollIntoViewIfNeeded();
    let reached = false;
    for (let i = 0; i < 60 && !reached; i += 1) {
      await page.keyboard.press('Tab');
      reached = await link.evaluate((el) => el === document.activeElement);
    }
    expect(reached, 'SourceNote link is reachable by Tab').toBe(true);
    // Radix closes a tooltip when the page scrolls, and focusing an off-screen link scrolls it into view
    // (seen at 375 wide). Re-focus once the page has settled so the assertion tests the tooltip, not the scroll.
    await page.waitForTimeout(250);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    expect(await link.evaluate((el) => el === document.activeElement)).toBe(true);
    await expect(page.getByRole('tooltip').first()).toContainText(
      'paper/data/results.json#comparison.IG-DCTF',
    );
  });

  test('IP masking and the offline state render honestly', async ({ page }) => {
    await expect(section(page, 'privacy')).toContainText('203.0.113.•');
    await expect(section(page, 'privacy')).not.toContainText('203.0.113.45');
    await expect(section(page, 'states')).toContainText('Data source not reachable.');
    await expect(section(page, 'states')).toContainText('Nothing is shown in its place.');
  });

  test('the Synthetic corpus chip reads n = 120 from the facts', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: 'Synthetic corpus, n = 120' }).first(),
    ).toBeVisible();
  });
});

test.describe('reduced motion', () => {
  test('transitions and animations collapse to nothing', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/design-system', { waitUntil: 'networkidle' });
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
      true,
    );
    const timings = await page.evaluate(() => {
      const btn = getComputedStyle(document.querySelector('button') as HTMLElement);
      const skeleton = getComputedStyle(document.querySelector('.animate-pulse') as HTMLElement);
      const first = (v: string) => parseFloat(v.split(',')[0] ?? '0');
      return {
        transition: first(btn.transitionDuration),
        animation: first(skeleton.animationDuration),
      };
    });
    expect(timings.transition).toBeLessThan(0.001);
    expect(timings.animation).toBeLessThan(0.001);
  });
});

// Needs a running backend, which this frontend does not ship: set E2E_BACKEND=1 after you have wired yours on :8000.
test.describe('backend reachability', () => {
  test.skip(!process.env.E2E_BACKEND, 'set E2E_BACKEND=1 to run against a backend on :8000');
  test('the backend is up and the thresholds match the static fallback', async ({ request }) => {
    const res = await request.get('http://localhost:8000/api/config/thresholds');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({
      tiers: { high_min: 80, medium_min: 50 },
      gate: { theta_low: 0.5, theta_high: 0.85, floor_multiplier: 0.3, hard_cap: 30 },
    });
  });
});
