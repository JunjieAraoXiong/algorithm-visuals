const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ROUTE = '/product-array-without-current-element/';
const NUMS = [2, 3, 1, 4, 5];
const PAGE_SOURCE = path.join(__dirname, '../src/chapters/10-prefix-sums/03-product-array-without-current-element/index.html');
const product = values => values.reduce((value, next) => value * next, 1);
const excludingEachIndex = nums => nums.map((_, index) => product(nums.filter((__, other) => other !== index)));

function loadSimulator() {
  const html = fs.readFileSync(PAGE_SOURCE, 'utf8');
  const start = html.indexOf('        function simulate(');
  const end = html.indexOf('\n        const FRAMES', start);
  expect(start, 'The test must execute the page’s actual simulator').toBeGreaterThanOrEqual(0);
  expect(end, 'The simulator must be extracted without the DOM adapter').toBeGreaterThan(start);
  const simulate = new Function('NUMS', 'fmt', `${html.slice(start, end)}\nreturn simulate;`)(
    NUMS, values => `[${values.join(', ')}]`
  );
  const sourceKeys = [...html.matchAll(/data-source-key="([^"]+)"/g)].map(match => match[1]);
  return { simulate, sourceKeys };
}

async function expectState(page, { i, rp, res, active }) {
  await expect(page.locator('[data-m-i]')).toHaveText(String(i));
  await expect(page.locator('[data-m-rp]')).toHaveText(String(rp));
  await expect(page.locator('[data-m-res]')).toHaveText(`[${res.join(', ')}]`);
  await expect(page.locator(`[data-source-key="${active}"]`)).toHaveAttribute('aria-current', 'step');
}

test.describe('Product array trace', () => {
  for (const { name, nums } of [
    { name: 'the standard example', nums: NUMS },
    { name: 'one zero', nums: [2, 0, 4] },
    { name: 'two zeros', nums: [0, 2, 0] },
    { name: 'a singleton', nums: [7] },
    { name: 'an empty array', nums: [] },
    { name: 'negative factors', nums: [-2, 3, -4] },
    { name: 'unit factors', nums: [1, 1, 1] }
  ]) {
    test(`the actual simulator excludes each index for ${name}`, () => {
      const { simulate } = loadSimulator();
      const input = [...nums];
      const frames = simulate(input);
      expect(frames.at(-1).state.res).toEqual(excludingEachIndex(nums));
      expect(input, 'Calculating the output must leave nums unchanged').toEqual(nums);
      expect(frames.at(-1).sourceKeys).toEqual(['ret']);
    });
  }

  test('output writes exclude the current factor, and suffix folds preserve completed answers', () => {
    const { simulate, sourceKeys } = loadSimulator();
    expect(new Set(sourceKeys).size, 'Code-line identifiers must be unique').toBe(sourceKeys.length);
    const inputs = [NUMS, [2, 0, 4], [0, 2, 0], [7], [-2, 3, -4]];
    for (const nums of inputs) {
      const frames = simulate(nums);
      const expected = excludingEachIndex(nums);
      expect(frames.filter(frame => frame.kind === 'right-write')).toHaveLength(nums.length);
      expect(frames.filter(frame => frame.kind === 'right-fold')).toHaveLength(nums.length);
      for (const [index, frame] of frames.entries()) {
        expect(frame.sourceKeys.length).toBeGreaterThan(0);
        for (const key of frame.sourceKeys) expect(sourceKeys).toContain(key);
        if (!['right-write', 'right-fold'].includes(frame.kind)) continue;
        const before = frames[index - 1].state;
        const { state } = frame;
        const i = state.i;
        expect(state.completedFrom).toBe(i);
        expect(state.res.slice(i), 'The completed suffix must contain final answers').toEqual(expected.slice(i));
        for (let pending = 0; pending < i; pending += 1) {
          expect(state.res[pending], 'Unvisited positions must retain their left product').toBe(product(nums.slice(0, pending)));
        }
        if (frame.kind === 'right-write') {
          expect(state.rp, 'Writing an answer must not incorporate its own factor').toBe(product(nums.slice(i + 1)));
          expect(state.rp).toBe(before.rp);
          expect(state.res.filter((_, other) => other !== i)).toEqual(before.res.filter((_, other) => other !== i));
          expect(frame.sourceKeys).toContain('res-mul');
          expect(frame.sourceKeys).not.toContain('rp-mul');
        } else {
          expect(state.res, 'Advancing the suffix accumulator must not rewrite any answer').toEqual(before.res);
          expect(state.rp, 'The updated suffix includes the current factor for the next position').toBe(product(nums.slice(i)));
          expect(frame.sourceKeys).toContain('rp-mul');
          expect(frame.sourceKeys).not.toContain('res-mul');
        }
      }
    }
  });

  test('the requested step link restores its state and backward navigation restores earlier writes', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${ROUTE}#step=16`);
    await expect(page.locator('[data-count]')).toHaveText('步骤 17 / 17');
    await page.goto(`${ROUTE}#step=11`);
    await expect(page.locator('[data-count]')).toHaveText('步骤 12 / 17');
    await expectState(page, { i: 2, rp: 20, res: [1, 2, 120, 30, 24], active: 'rp-mul' });
    await page.reload();
    await expectState(page, { i: 2, rp: 20, res: [1, 2, 120, 30, 24], active: 'rp-mul' });
    await page.getByLabel('跳到步骤').selectOption('9');
    await expectState(page, { i: 3, rp: 20, res: [1, 2, 6, 30, 24], active: 'rp-mul' });
    await page.getByRole('button', { name: '← 上一步', exact: true }).click();
    await expectState(page, { i: 3, rp: 5, res: [1, 2, 6, 30, 24], active: 'res-mul' });
    await expect(page.locator('[data-source-key="rp-mul"]')).not.toHaveAttribute('aria-current', 'step');
    await page.getByRole('button', { name: '← 上一步', exact: true }).click();
    await expectState(page, { i: 4, rp: 5, res: [1, 2, 6, 6, 24], active: 'rp-mul' });
    await page.getByRole('button', { name: '下一步 →', exact: true }).click();
    await expectState(page, { i: 3, rp: 5, res: [1, 2, 6, 30, 24], active: 'res-mul' });
  });

  test('the final result can be inspected through focusable buttons without changing the trace', async ({ page }) => {
    await page.goto(`${ROUTE}#step=16`);
    await expect(page.locator('[data-count]')).toHaveText('步骤 17 / 17');
    await expect(page.locator('[data-m-res]')).toHaveText('[60, 40, 120, 30, 24]');
    await expect(page.locator('[data-source-key="ret"]')).toHaveAttribute('aria-current', 'step');
    const initial = page.locator('button[data-result-index="1"]');
    const another = page.locator('button[data-result-index="3"]');
    await expect(initial).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-factor-equation]')).toHaveText(/2\s*[×*]\s*20\s*=\s*40/);
    await expect(another).toHaveAttribute('aria-pressed', 'false');
    await another.focus();
    await expect(another).toBeFocused();
    await another.press('Enter');
    await expect(another).toHaveAttribute('aria-pressed', 'true');
    await expect(initial).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-factor-equation]')).toHaveText(/6\s*[×*]\s*5\s*=\s*30/);
    await expect(page.locator('[data-count]')).toHaveText('步骤 17 / 17');
    await expect(page.locator('[data-m-res]')).toHaveText('[60, 40, 120, 30, 24]');
    await expect(page.locator('[data-source-key="ret"]')).toHaveAttribute('aria-current', 'step');
  });

  test('leaving result inspection keeps keyboard navigation focused on the stage', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${ROUTE}#step=16`);
    await expect(page.locator('[data-count]')).toHaveText('步骤 17 / 17');
    const result = page.locator('button[data-result-index="1"]');
    await result.focus();
    await expect(result).toBeFocused();
    await result.press('Home');
    await expect(page.locator('[data-count]')).toHaveText('步骤 1 / 17');
    await expect(page.locator('[data-stage]')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-count]')).toHaveText('步骤 2 / 17');
    await expect(page.locator('[data-source-key="left-set"]')).toHaveAttribute('aria-current', 'step');
  });
});
