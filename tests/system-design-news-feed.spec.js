const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

const lesson = (strategy, author = 'b', followers = 12, step = 14) =>
  `/design-news-feed/?strategy=${strategy}&author=${author}&followers=${followers}#step=${step}`;

async function expectWork(page, expected) {
  for (const [key, value] of Object.entries(expected)) {
    await expect(page.locator('#architecture')).toHaveAttribute(`data-${key}`, String(value));
  }
}

test('all strategies and authors return the same ordered feed with counted model work', async ({ page }) => {
  const cases = [
    ['push', 'a', 3, 2, 5], ['push', 'b', 12, 2, 5],
    ['pull', 'a', 0, 4, 6], ['pull', 'b', 0, 4, 6],
    ['hybrid', 'a', 3, 4, 5], ['hybrid', 'b', 0, 4, 6]
  ];
  for (const [strategy, author, inboxWrites, reads, merged] of cases) {
    await page.goto(lesson(strategy, author));
    await expectWork(page, { 'author-writes': 1, 'inbox-writes': inboxWrites, reads, merged, pending: 0, feed: 'P3,B1,A1' });
    await expect(page.locator('[data-feed-row]')).toHaveText(['P3 @ 10:00:03', 'B1 @ 10:00:02', 'A1 @ 10:00:01']);
  }
});

test('partial fanout preserves the first response until a new read and rewinds exactly', async ({ page }) => {
  await page.goto(lesson('push', 'b', 12, 4));
  await expectWork(page, { 'inbox-writes': 6, pending: 6, inbox: 'B1,A1', feed: '' });
  await page.locator('[data-step-select]').selectOption('8');
  await expectWork(page, { reads: 1, merged: 2, feed: 'B1,A1', pending: 6 });
  await page.locator('[data-action="next"]').click();
  await expectWork(page, { 'inbox-writes': 12, pending: 0, inbox: 'P3,B1,A1', feed: 'B1,A1' });
  await page.locator('[data-action="previous"]').click();
  await expectWork(page, { 'inbox-writes': 6, pending: 6, inbox: 'B1,A1', feed: 'B1,A1' });
  await page.reload();
  await expectWork(page, { 'inbox-writes': 6, pending: 6, feed: 'B1,A1' });
  await expect(page.locator('[data-count]')).toContainText('9 / 15');
  await page.locator('[data-step-select]').selectOption('13');
  await expectWork(page, { 'inbox-writes': 12, reads: 2, merged: 5, feed: 'P3,B1,A1' });
  await page.locator('[data-action="previous"]').click();
  await expectWork(page, { reads: 2, merged: 2, feed: 'B1,A1' });
});

test('follower choices change actual fanout writes while hybrid moves B work to reads', async ({ page }) => {
  for (const followers of [6, 24]) {
    await page.goto(lesson('push', 'b', followers, 4));
    await expectWork(page, { 'inbox-writes': followers / 2, pending: followers / 2 });
    await page.locator('[data-action="next"]').press('End');
    await expectWork(page, { 'inbox-writes': followers, reads: 2, feed: 'P3,B1,A1' });
    await page.locator('#strategy').selectOption('hybrid');
    await expect(page).toHaveURL(new RegExp(`strategy=hybrid&author=b&followers=${followers}#step=0$`));
    await expectWork(page, { 'author-writes': 0, 'inbox-writes': 0, reads: 0 });
    await page.locator('[data-step-select]').selectOption('8');
    await expectWork(page, { 'author-writes': 1, 'inbox-writes': 0, reads: 2, merged: 3, pending: 0, feed: 'P3,B1,A1' });
    await page.locator('[data-action="next"]').press('End');
    await expectWork(page, { 'inbox-writes': 0, reads: 4, merged: 6 });
    await page.locator('#author').selectOption('a');
    await page.locator('[data-step-select]').selectOption('14');
    await expectWork(page, { 'inbox-writes': 3, reads: 4, merged: 5 });
  }
});
