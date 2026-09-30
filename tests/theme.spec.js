const fs = require('node:fs');
const path = require('node:path');
const { expect, test } = require('@playwright/test');

const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/questions.json'), 'utf8'));
const slugs = registry.chapters.flatMap(chapter => chapter.questions.map(question => question.slug));
const toggle = page => page.getByRole('button', { name: '深色模式', exact: true });

test('theme selection survives navigation and reload, with keyboard switching', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await toggle(page).focus();
  await toggle(page).press('Enter');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(27, 28, 30)');

  await page.locator('.card[href="./reverse-linked-list/"]').click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.lab-node').first()).toHaveCSS('background-color', 'rgb(27, 28, 30)');
  await expect(page.locator('.lab-node').first()).toHaveCSS('color', 'rgb(231, 227, 219)');
  await expect(page.locator('.code-scroll')).toHaveCSS('background-color', 'rgb(34, 36, 40)');
  await page.reload();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');

  await toggle(page).press('Space');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 253, 248)');
  await page.getByRole('link', { name: '← Algo Visual / 返回目录', exact: true }).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
});

test('system appearance applies until a saved choice overrides it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await toggle(page).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
});

test('theme controls work when an embed blocks storage', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
    Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 253, 248)');
});

test('every guide keeps readable dark diagrams and usable trace controls on phones', async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const slug of slugs) {
    await page.goto(`/${slug}/#step=0`);
    await expect(toggle(page), slug).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('body'), slug).toHaveCSS('background-color', 'rgb(27, 28, 30)');
    await expect(page.locator('h1').first(), slug).toHaveCSS('color', 'rgb(231, 227, 219)');
    await expect(page.locator('[aria-current="step"]:visible').first(), slug).toBeVisible();
    const next = page.locator('[data-action="next"]:visible').first();
    await next.click();
    await expect(page.locator('[data-count]:visible').first(), slug).toContainText('2 /');
    await next.press('End');
    await expect(next, slug).toBeDisabled();
    await expect(page.locator('[aria-current="step"]:visible').first(), slug).toBeVisible();
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      unreadableText: [...document.querySelectorAll('svg text[fill]')]
        .filter(text => ['rgb(39, 39, 39)', 'rgb(85, 85, 85)'].includes(getComputedStyle(text).fill))
        .map(text => text.textContent)
    }));
    expect(layout, slug).toEqual({ overflow: false, unreadableText: [] });
  }
  expect(errors).toEqual([]);
});
