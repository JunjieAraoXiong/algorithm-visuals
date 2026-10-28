import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { themeColors, themePage, themePaletteCss } from './theme-palette.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(repositoryRoot, 'src');
const outputRoot = path.join(repositoryRoot, '_site');
const registryPath = path.join(sourceRoot, 'questions.json');
const readText = (file) => fs.readFileSync(file, 'utf8');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function fail(message) {
  throw new Error(`Site build failed: ${message}`);
}

function sameMembers(actual, expected, label) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    fail(`${label}\n  actual: ${left.join(', ')}\nexpected: ${right.join(', ')}`);
  }
}

function pageLinks(html) {
  return [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].map((match) => match[1]);
}

function catalogSlugs(html) {
  return [...html.matchAll(/<a\b[^>]*class=["'][^"']*\bcard\b[^"']*["'][^>]*href=["']\.\/([^/"']+)\/["'][^>]*>/g)]
    .map((match) => match[1]);
}

function validateOutputLinks(htmlFiles) {
  for (const htmlFile of htmlFiles) {
    for (const link of pageLinks(readText(htmlFile))) {
      if (!link || link.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(link) || link.startsWith('//')) {
        continue;
      }

      const cleanLink = decodeURIComponent(link.split(/[?#]/, 1)[0]);
      if (!cleanLink) continue;
      const target = path.resolve(path.dirname(htmlFile), cleanLink);
      const relativeTarget = path.relative(outputRoot, target);
      if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
        fail(`${path.relative(outputRoot, htmlFile)} points outside the published site: ${link}`);
      }

      const resolvedTarget = fs.existsSync(target) && fs.statSync(target).isDirectory()
        ? path.join(target, 'index.html')
        : target;
      if (!fs.existsSync(resolvedTarget)) {
        fail(`${path.relative(outputRoot, htmlFile)} has a missing local target: ${link}`);
      }
    }
  }
}

const registry = JSON.parse(readText(registryPath));
if (!Array.isArray(registry.chapters) || registry.chapters.length === 0) {
  fail('src/questions.json must contain at least one chapter');
}

const questions = registry.chapters.flatMap((chapter) => {
  const chapterDirectory = `${chapter.number}-${chapter.slug}`;
  return chapter.questions.map((question) => ({
    ...question,
    chapterDirectory,
    sourceDirectory: path.join(sourceRoot, 'chapters', chapterDirectory, question.directory)
  }));
});

const slugs = questions.map((question) => question.slug);
if (new Set(slugs).size !== slugs.length) fail('question slugs must be unique');

for (const question of questions) {
  if (!Array.isArray(question.tags) || question.tags.length < 1 || question.tags.length > 3 ||
      new Set(question.tags).size !== question.tags.length) {
    fail(`${question.slug} must have 1–3 unique tags`);
  }
  for (const id of question.tags) {
    const tag = registry.tags?.[id];
    if (!tag?.title || !tag?.titleZh || !Array.isArray(tag.aliases)) {
      fail(`${question.slug} has an unknown or incomplete tag: ${id}`);
    }
  }
  const page = path.join(question.sourceDirectory, 'index.html');
  if (!fs.existsSync(page)) {
    fail(`${question.slug} is registered but ${path.relative(repositoryRoot, page)} does not exist`);
  }
}

// Hosts that build from a plain checkout (e.g. Vercel previews) may not ship
// git metadata; fall back to the source pages on disk there.
function listSourcePages() {
  try {
    return execFileSync(
      'git',
      ['ls-files', '--', 'src/chapters/*/*/index.html'],
      { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).split(/\r?\n/).filter(Boolean);
  } catch {
    const chaptersRoot = path.join(sourceRoot, 'chapters');
    return fs.readdirSync(chaptersRoot, { withFileTypes: true })
      .filter((chapter) => chapter.isDirectory())
      .flatMap((chapter) => fs.readdirSync(path.join(chaptersRoot, chapter.name), { withFileTypes: true })
        .filter((question) => question.isDirectory())
        .map((question) => path.join(chaptersRoot, chapter.name, question.name, 'index.html')))
      .filter((page) => fs.existsSync(page))
      .map((page) => path.relative(repositoryRoot, page));
  }
}

const trackedSourcePages = listSourcePages();
const registeredSourcePages = questions.map((question) => path.relative(
  repositoryRoot,
  path.join(question.sourceDirectory, 'index.html')
));
sameMembers(
  trackedSourcePages,
  registeredSourcePages,
  'tracked question pages must exactly match src/questions.json'
);

const catalog = readText(path.join(sourceRoot, 'index.html'));
sameMembers(catalogSlugs(catalog), slugs, 'src/index.html cards must exactly match src/questions.json');
const tagSlots = [...catalog.matchAll(/data-question-tags="([^"]+)"/g)].map(match => match[1]);
sameMembers(tagSlots, slugs, 'catalog tag slots must exactly match src/questions.json');
const questionsBySlug = new Map(questions.map(question => [question.slug, question]));
const taggedCatalog = catalog.replace(/<span class="chips" data-question-tags="([^"]+)"><\/span>/g,
  (_, slug) => {
    const tags = questionsBySlug.get(slug).tags.map(id => registry.tags[id]);
    const aliases = tags.flatMap(tag => tag.aliases).join(' ');
    const chips = tags.map(tag => `<span class="chip">${escapeHtml(tag.title)} / ${escapeHtml(tag.titleZh)}</span>`).join('');
    return `<span class="chips" data-search-aliases="${escapeHtml(aliases)}">${chips}</span>`;
  });

const readme = readText(path.join(repositoryRoot, 'README.md'));
const readmeSlugs = [...readme.matchAll(/junjiearaoxiong\.github\.io\/algorithm-visuals\/([^/)]+)\//gi)]
  .map((match) => match[1]);
sameMembers(readmeSlugs, slugs, 'README visual links must exactly match src/questions.json');

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });
fs.cpSync(path.join(sourceRoot, 'assets'), path.join(outputRoot, 'assets'), { recursive: true });
for (const asset of ['visual.css', 'guide.css']) {
  fs.writeFileSync(path.join(outputRoot, 'assets', asset), themeColors(readText(path.join(sourceRoot, 'assets', asset))));
}
fs.appendFileSync(path.join(outputRoot, 'assets', 'theme.css'), themePaletteCss());
fs.writeFileSync(path.join(outputRoot, 'index.html'), themePage(taggedCatalog, './assets'));
fs.copyFileSync(path.join(sourceRoot, '.nojekyll'), path.join(outputRoot, '.nojekyll'));

for (const question of questions) {
  fs.cpSync(question.sourceDirectory, path.join(outputRoot, question.slug), { recursive: true });
  const page = path.join(outputRoot, question.slug, 'index.html');
  const lesson = themePage(readText(page), '../assets');
  const workbench = question.slug === 'lowest-common-ancestor' ? '' : `
  <link rel="stylesheet" href="../assets/workbench.css">
  <script src="../assets/workbench-tree.js"></script>
  <script src="../assets/workbench-legacy.js"></script>
  <script src="../assets/workbench.js"></script>
`;
  const readerControls = '<link rel="stylesheet" href="../assets/reader-controls.css">\n<script src="../assets/reader-controls.js" defer></script>\n';
  fs.writeFileSync(page, lesson.replace('</head>', `${workbench}${readerControls}</head>`));
}

validateOutputLinks([
  path.join(outputRoot, 'index.html'),
  ...questions.map((question) => path.join(outputRoot, question.slug, 'index.html'))
]);

console.log(`Built ${questions.length} visualizations in ${path.relative(repositoryRoot, outputRoot)}/`);
