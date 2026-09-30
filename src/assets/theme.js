(() => {
  'use strict';

  const storageKey = 'algorithm-visuals:theme';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  let preference = null;
  let button;

  function savedPreference() {
    try {
      const value = localStorage.getItem(storageKey);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  }

  function applyTheme() {
    const theme = preference || (media.matches ? 'dark' : 'light');
    root.dataset.theme = theme;
    button?.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  // Run in the head before first paint, including when storage is unavailable.
  preference = savedPreference();
  applyTheme();

  media.addEventListener('change', () => { if (!preference) applyTheme(); });
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) {
      preference = savedPreference();
      applyTheme();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    let navigation = document.querySelector('main > header, .back-nav, .page-nav');
    if (!navigation) {
      navigation = document.createElement('nav');
      document.querySelector('main').prepend(navigation);
    }
    navigation.classList.add('theme-nav');
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.dataset.themeToggle = '';
    button.setAttribute('aria-label', '深色模式');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span lang="zh-CN">深色模式</span>';
    button.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(storageKey, preference); } catch { /* private embeds may block storage */ }
      applyTheme();
    });
    navigation.append(button);
    applyTheme();
  });
})();
