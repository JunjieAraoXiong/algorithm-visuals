const { test, expect } = require('@playwright/test');

const sceneState = page => page.locator('#architecture').evaluate(svg => ({
  description: svg.querySelector('desc').textContent,
  elements: [...svg.querySelectorAll('[data-scene], [data-node], [data-flow], [data-detail]')].map(element => ({
    hidden: element.hasAttribute('hidden'),
    classes: [...element.classList].sort(),
    text: element.textContent
  }))
}));

test('fundamentals scenes rewind exactly and keep controls visible in desktop embeds', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 760, height: 700 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/design-fundamentals/#step=0');
    const select = page.locator('[data-step-select]');
    await expect(select.locator('option')).toHaveCount(16);
    const scenes = [];
    for (let step = 0; step < 16; step++) {
      await select.selectOption(String(step));
      await expect(page.locator('[data-count]')).toContainText(`${step + 1} / 16`);
      scenes.push(await sceneState(page));
      await expect(page.locator('[data-action="previous"]')).toBeInViewport({ ratio: 1 });
      await expect(page.locator('[data-action="next"]')).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    for (let step = 14; step >= 0; step--) {
      await page.locator('[data-action="previous"]').click();
      expect(await sceneState(page)).toEqual(scenes[step]);
    }
    await select.selectOption('10');
    await page.reload();
    await expect(page.locator('[data-count]')).toContainText('11 / 16');
    expect(await sceneState(page)).toEqual(scenes[10]);
  }
  expect(errors).toEqual([]);
});
