// Adapt the existing paper-and-ink drawings at build time. Keep SVG attributes
// and trace data intact; CSS variables handle both static and animated marks.
const groups = [
  ['#1b1c1e', ['fffdf8']],
  ['#e7e3db', ['272727']],
  ['#d6d3cb', ['333', '383838']],
  ['#cecbc4', ['3f3f3f', '40403d', '41413e', '444']],
  ['#b7b5ad', ['555', '595959', '5b5b57', '5d5d59', '666', '686864']],
  ['#a0a2a5', ['777', '858580', '888', '8a8a84', '8a8a85', '8f8f88', '92928d']],
  ['#898c91', ['999', '9c9a92']],
  ['#777b80', ['a3a198', 'a3a199', 'a8a69e', 'a9a69d', 'aaa', 'aaa9a2']],
  ['#6c6e70', ['b0aea6', 'b7b7b1', 'b9b7ae']],
  ['#56595e', ['c0bdb2', 'c4c2b8', 'c4c2ba', 'c9c5ba', 'c9c7bd', 'd0d0c9']],
  ['#484c51', ['d8d8d0', 'd8d8d1', 'ddd9cb', 'e0ddd3', 'e3e1d8', 'e4e1d8', 'e5e3dc', 'e5e5df']],
  ['#35383d', ['e6e3d5', 'e7e3d8', 'e9e5d3', 'e9e5d9', 'e9e6da', 'e9e9e4', 'eaeae5']],
  ['#2c2f33', ['eceadf', 'eeece2', 'efeada', 'efece2', 'efede4', 'efede5', 'f0ecdd', 'f0eee6', 'f1eee5', 'f1efe7', 'f2f0e7', 'f4f1e7', 'f5f2e9']],
  ['#222428', ['f7f5ee', 'f8f6f0', 'faf9f4']],
  ['#ed9c8c', ['8a2f2f', 'a3402f']],
  ['#e6ad70', ['b3611e']]
];

const palette = new Map(groups.flatMap(([dark, colors]) => colors.map(color => [color, dark])));

export function themeColors(css) {
  return css.replace(/#[\da-f]{3,8}\b/gi, color => {
    const key = color.slice(1).toLowerCase();
    if (!palette.has(key)) throw new Error(`Unmapped theme color: ${color}`);
    return `var(--theme-${key}, ${color})`;
  }).replace(/rgba\(\s*229\s*,\s*227\s*,\s*220\s*,\s*([.\d]+)\s*\)/g,
    (_, alpha) => `color-mix(in srgb, var(--theme-e5e3dc, #e5e3dc) ${Number(alpha) * 100}%, transparent)`);
}

export function themePage(html, assetPath) {
  return html
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
      (_, open, css, close) => `${open}${themeColors(css)}${close}`)
    .replace(/\bstyle=(['"])(.*?)\1/gi,
      (_, quote, css) => `style=${quote}${themeColors(css)}${quote}`)
    .replace(/\.style\.color\s*=\s*(['"])(#[\da-f]+)\1/g,
      (_, quote, color) => `.style.color = ${quote}${themeColors(color)}${quote}`)
    .replace('</head>', `  <link rel="stylesheet" href="${assetPath}/theme.css">\n  <script src="${assetPath}/theme.js"></script>\n</head>`);
}

export function themePaletteCss() {
  const variables = [...palette].map(([key, dark]) => `  --theme-${key}: ${dark};`).join('\n');
  const svgRules = [...palette.keys()].flatMap(key => ['fill', 'stroke'].map(property =>
    `:root[data-theme="dark"] svg [${property}="#${key}" i] { ${property}: var(--theme-${key}); }`
  )).join('\n');
  return `\n:root[data-theme="dark"] {\n${variables}\n}\n${svgRules}\n`;
}
