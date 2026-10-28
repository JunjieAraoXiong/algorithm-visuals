const { test, expect } = require('@playwright/test');

test('chapter and search state survives reload and browser navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card:visible')).toHaveCount(61);
  await page.locator('.chapter-link[data-chapter="linked-lists"]').click();
  await expect(page.locator('.card:visible')).toHaveCount(7);
  await page.getByRole('searchbox', { name: '搜索题目或模式' }).fill('递归');
  await expect(page.locator('.card:visible')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('递归');
  await expect(page.locator('.card:visible')).toHaveCount(1);
  await page.goBack();
  await expect(page.locator('.card:visible')).toHaveCount(61);
});

test('an empty search can recover, and matching questions navigate to working guides', async ({ page }) => {
  await page.goto('/?q=not-a-real-algorithm');
  await expect(page.getByRole('heading', { name: '没有找到匹配的图解' })).toBeVisible();
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect(page.locator('.card:visible')).toHaveCount(61);
  await page.getByRole('searchbox').fill('invert');
  await page.locator('.card:visible').click();
  const next = page.locator('[data-action="next"]:visible').first();
  await next.click();
  await expect(page.locator('[data-count]:visible').first()).toContainText('2 /');
});

test('the complete catalog remains usable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page.locator('.card:visible')).toHaveCount(61);
  await page.locator('.card[href="./reverse-linked-list/"]').click();
  await expect(page).toHaveURL(/\/reverse-linked-list\//);
  await context.close();
});

test('standard technique names find questions across the book chapters', async ({ page }) => {
  await page.goto('/?q=sliding+window');
  await expect(page.locator('.card[href="./substring-anagrams/"]')).toBeVisible();
  await expect(page.locator('.card[href="./maximums-of-sliding-window/"]')).toBeVisible();
  await page.getByRole('searchbox').fill('monotonic queue');
  await expect(page.locator('.card:visible')).toHaveCount(1);
  await expect(page.locator('.card:visible')).toHaveAttribute('href', './maximums-of-sliding-window/');
  await page.getByRole('searchbox').fill('单调队列');
  await expect(page.locator('.card:visible')).toHaveCount(1);
  await expect(page.locator('.card:visible')).toHaveAttribute('href', './maximums-of-sliding-window/');
});
