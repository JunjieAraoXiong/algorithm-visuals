const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('durable enqueue, API acceptance, provider execution and queue acknowledgement are separate states', async ({ page }) => {
  await page.goto('/design-notification-queue/?scenario=normal#step=2');
  await expect(page.locator('#api-state')).toHaveText('已接收');
  await expect(page.locator('#queue-state')).toHaveText('空');
  await expect(page.locator('#delivery-count')).toHaveText('服务商发送：0 次');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#queue-state')).toHaveText('待处理');
  await expect(page.locator('#api-state')).toHaveText('已接收');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#api-state')).toHaveText('已返回 202');
  await expect(page.locator('#delivery-count')).toHaveText('服务商发送：0 次');
  await page.locator('[data-step-select]').selectOption('8');
  await expect(page.locator('#delivery-count')).toHaveText('服务商发送：1 次');
  await expect(page.locator('#confirmation-state')).toHaveText('Worker 确认：无');
  await expect(page.locator('#consumer-record')).toHaveText('消费者完成记录：无');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#confirmation-state')).toHaveText('Worker 确认：成功结果');
  await expect(page.locator('#consumer-record')).toHaveText('消费者完成记录：无');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#consumer-record')).toHaveText('消费者完成记录：e42');
  await expect(page.locator('#queue-state')).toHaveText('处理中');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#queue-state')).toHaveText('已确认移除');
  await expect(page.locator('#message-slot')).toBeHidden();
});

test('a lost response causes a duplicate external send despite consumer-only completion tracking', async ({ page }) => {
  await page.goto('/design-notification-queue/?scenario=lost&dedup=consumer#step=9');
  await expect(page.locator('#worker-state')).toHaveText('超时，结果未知');
  await expect(page.locator('#delivery-count')).toHaveText('服务商发送：1 次');
  await expect(page.locator('#consumer-record')).toHaveText('消费者完成记录：无');
  await page.locator('[data-step-select]').selectOption('14');
  await expect(page.locator('#delivery-count')).toHaveText('服务商发送：2 次');
  await expect(page.locator('#attempt-count')).toContainText('发送调用：2 次');
  await expect(page.locator('#consumer-record')).toHaveText('消费者完成记录：无');
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('#delivery-count')).toHaveText('服务商发送：1 次');
  await page.reload();
  await expect(page.locator('[data-count]')).toContainText('14 / 19');
  await expect(page.locator('#delivery-count')).toHaveText('服务商发送：1 次');
  await page.locator('[data-action="next"]').press('End');
  await expect(page.locator('#delivery-count')).toHaveText('服务商发送：2 次');
  await expect(page.locator('#consumer-record')).toHaveText('消费者完成记录：e42');
});

test('provider idempotency reuses the first result while preserving two call attempts', async ({ page }) => {
  await page.goto('/design-notification-queue/?scenario=lost&dedup=provider#step=9');
  await expect(page.locator('#provider-record')).toHaveText('服务商幂等记录：e42 → p1');
  await expect(page.locator('#consumer-record')).toHaveText('消费者完成记录：无');
  await page.locator('[data-step-select]').selectOption('14');
  await expect(page.locator('#provider-state')).toHaveText('复用首次结果');
  await expect(page.locator('#delivery-count')).toHaveText('服务商发送：1 次');
  await expect(page.locator('#attempt-count')).toContainText('发送调用：2 次');
  await expect(page.locator('#confirmation-state')).toHaveText('Worker 确认：无');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#confirmation-state')).toHaveText('Worker 确认：成功结果');
  await page.locator('#dedup').selectOption('consumer');
  await expect(page).toHaveURL(/\?scenario=lost&dedup=consumer#step=5$/);
  await page.locator('[data-action="next"]').press('End');
  await expect(page.locator('#delivery-count')).toHaveText('服务商发送：2 次');
});

test('failure before the side effect retries once without a duplicate and keyboard replay resets state', async ({ page }) => {
  await page.goto('/design-notification-queue/?scenario=failure&dedup=provider#step=9');
  await expect(page.locator('#delivery-count')).toHaveText('服务商发送：0 次');
  await expect(page.locator('#provider-record')).toHaveText('服务商幂等记录：无');
  await page.locator('[data-action="next"]').press('End');
  await expect(page.locator('#delivery-count')).toHaveText('服务商发送：1 次');
  await expect(page.locator('#attempt-count')).toHaveText('发送调用：2 次；队列消息已被确认');
  await page.locator('[data-action="previous"]').press('Home');
  await expect(page.locator('[data-count]')).toContainText('1 / 19');
  await expect(page.locator('#delivery-count')).toHaveText('服务商发送：0 次');
  await expect(page.locator('#consumer-record')).toHaveText('消费者完成记录：无');
  await expect(page.locator('[data-node="queue"]')).toBeHidden();
  await page.locator('[data-design-key="retry"]').click();
  await expect(page.locator('[data-count]')).toContainText('10 / 19');
  await page.locator('#scenario').selectOption('normal');
  await expect(page).toHaveURL(/\?scenario=normal&dedup=provider#step=5$/);
  await page.locator('[data-action="next"]').press('End');
  await expect(page.locator('[data-count]')).toContainText('13 / 13');
  await expect(page.locator('#attempt-count')).toHaveText('发送调用：1 次；队列消息已被确认');
});

test('desktop and embed layouts keep the architecture and primary controls in view', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1280, height: 900 }, { width: 900, height: 700 }, { width: 760, height: 700 }]) {
    await page.setViewportSize(viewport);
    for (const step of [0, 9, 18]) {
      await page.goto('/design-notification-queue/?scenario=lost#step=' + step);
      await expect(page.locator('[data-count]')).toContainText((step + 1) + ' / 19');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('#architecture')).toBeInViewport({ ratio: 1 });
      for (const action of ['previous', 'next']) {
        await expect(page.locator('[data-action="' + action + '"]')).toBeInViewport({ ratio: 1 });
      }
      expect(await page.locator('.design-controls').evaluate(controls => {
        const box = controls.getBoundingClientRect();
        const other = document.querySelector('.drawing-panel').getBoundingClientRect();
        return Math.min(box.right, other.right) > Math.max(box.left, other.left) + 1 &&
          Math.min(box.bottom, other.bottom) > Math.max(box.top, other.top) + 1;
      })).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});

test('the downloadable diagram has editable elements and reciprocal arrow bindings', async ({ page }) => {
  await page.goto('/design-notification-queue/');
  const downloaded = page.waitForEvent('download');
  await page.locator('a[download]').click();
  const file = await downloaded;
  const diagram = JSON.parse(await fs.readFile(await file.path(), 'utf8'));
  expect(diagram.type).toBe('excalidraw');
  const elements = new Map(diagram.elements.map(element => [element.id, element]));
  expect(elements.size).toBe(diagram.elements.length);
  expect(diagram.elements.some(element => element.type === 'arrow')).toBe(true);
  for (const element of diagram.elements) {
    for (const binding of [element.startBinding, element.endBinding]) {
      if (binding) expect(elements.get(binding.elementId).boundElements).toContainEqual({ id: element.id, type: 'arrow' });
    }
  }
});
