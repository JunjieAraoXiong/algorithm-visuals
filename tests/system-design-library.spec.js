const { test, expect } = require('@playwright/test');

const lessons = [
  'design-url-shortener',
  'design-rate-limiter',
  'design-consistent-hashing',
  'design-unique-id',
  'design-notification-queue',
  'design-search-autocomplete',
  'design-replicated-key-value',
  'design-news-feed'
];

test('every design remains readable and keyboard-operable in dark desktop embeds with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const slug of lessons) {
    await page.goto(`/${slug}/#step=0`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(27, 28, 30)');
    const next = page.locator('[data-action="next"]');
    const previous = page.locator('[data-action="previous"]');
    await next.press('End');
    await expect(next).toBeDisabled();
    await expect(previous).toBeInViewport({ ratio: 1 });
    const colors = await page.locator('#architecture text').evaluateAll(elements => elements.map(element => getComputedStyle(element).fill));
    expect(colors.length, slug).toBeGreaterThan(0);
    expect(colors, slug).not.toContain('rgb(39, 39, 39)');
    expect(colors, slug).not.toContain('rgb(0, 0, 0)');
    await previous.press('Home');
    await expect(previous).toBeDisabled();
    await expect(next).toBeInViewport({ ratio: 1 });
  }
  expect(errors).toEqual([]);
});

test('the complete system design collection opens working lessons without mixing algorithm results', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const slug of lessons) {
    await page.goto('/?topic=system-design');
    await expect(page.locator('[data-system-design]:visible')).toHaveCount(lessons.length);
    await expect(page.locator('.card:visible')).toHaveCount(0);
    await page.locator(`[data-system-design="${slug}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/`));
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-action="next"]')).toBeEnabled();
    await expect(page.locator('[data-step-select] option')).not.toHaveCount(0);
    await expect(page.locator('a.back-link[href="../"]')).toBeVisible();
    await page.locator('a.back-link[href="../"]').click();
    await expect(page.locator('.card:visible')).toHaveCount(61);
  }
  expect(errors).toEqual([]);
});

test('each lesson exposes a downloadable editable drawing with valid element references', async ({ page, request }) => {
  for (const slug of lessons) {
    await page.goto(`/${slug}/`);
    const link = page.locator('a[download][href$=".excalidraw"]');
    await expect(link).toHaveCount(1);
    const href = await link.getAttribute('href');
    const response = await request.get(new URL(href, page.url()).href);
    expect(response.ok(), slug).toBe(true);
    const drawing = await response.json();
    expect(drawing.type, slug).toBe('excalidraw');
    expect(drawing.version, slug).toBe(2);
    const elements = drawing.elements.filter(element => !element.isDeleted);
    expect(elements.some(element => element.type === 'text'), slug).toBe(true);
    expect(elements.some(element => element.type === 'arrow'), slug).toBe(true);
    const ids = new Set(elements.map(element => element.id));
    expect(ids.size, slug).toBe(elements.length);
    for (const element of elements) {
      for (const binding of [element.startBinding, element.endBinding]) {
        if (binding) expect(ids.has(binding.elementId), `${slug}: ${element.id}`).toBe(true);
      }
    }
  }
});

test('both catalogs and the initial teaching state remain available without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('[data-system-design]')).toHaveCount(lessons.length);
  await expect(page.locator('.card')).toHaveCount(61);
  for (const slug of lessons) {
    await page.goto(`/${slug}/`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-animation-panel]')).toBeVisible();
    await expect(page.locator('#step-change')).not.toHaveText('');
    await expect(page.locator('a[download][href$=".excalidraw"]')).toBeVisible();
  }
  await context.close();
});
