(() => {
  'use strict';
  const sections = [...document.querySelectorAll('.pattern')];
  const sidebar = document.querySelector('.chapter-sidebar');
  const nav = document.querySelector('#chapter-links');
  const input = document.querySelector('#visual-search');
  const title = document.querySelector('#catalog-title');
  const count = document.querySelector('#catalog-count');
  const empty = document.querySelector('.catalog-empty');
  const chapters = sections.map(section => {
    const heading = section.querySelector('.pattern-heading h2');
    const slug = heading.id.replace(/-title$/, '');
    section.id = `chapter-${slug}`;
    const cards = [...section.querySelectorAll('.card')];
    return { section, slug, name: heading.querySelector('[lang]')?.textContent || heading.textContent,
      navigationName: [...heading.childNodes].filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent).join('').trim(),
      number: section.querySelector('.pattern-number').textContent.trim(), cards,
      terms: heading.textContent.toLocaleLowerCase() };
  });
  let chapter = '';
  let query = '';

  function addLink(slug, name, number, total) {
    const link = document.createElement('a');
    link.className = 'chapter-link';
    link.href = slug ? `?chapter=${encodeURIComponent(slug)}` : './';
    link.dataset.chapter = slug;
    for (const [value, className] of [[number, 'chapter-index'], [name, 'chapter-name'], [total, 'chapter-total']]) {
      const label = document.createElement('span');
      label.className = className;
      label.textContent = String(value);
      link.append(label);
    }
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      chapter = slug;
      query = '';
      input.value = '';
      syncURL(true);
      render();
      document.querySelector('.catalog-content').scrollIntoView({ block: 'start' });
    });
    nav.append(link);
  }

  const total = chapters.reduce((sum, c) => sum + c.cards.length, 0);
  addLink('', 'All visuals', '', total);
  chapters.forEach(c => addLink(c.slug, c.navigationName, c.number, c.cards.length));

  function syncURL(push = false) {
    const url = new URL(location.href);
    if (chapter) url.searchParams.set('chapter', chapter); else url.searchParams.delete('chapter');
    if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
    url.hash = '';
    if (url.href !== location.href) history[push ? 'pushState' : 'replaceState'](null, '', url);
  }

  function render() {
    let matches = 0;
    let shownChapters = 0;
    const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    for (const item of chapters) {
      let visible = 0;
      for (const card of item.cards) {
        const aliases = card.querySelector('[data-search-aliases]')?.dataset.searchAliases || '';
        const text = `${item.terms} ${card.textContent} ${aliases}`.toLocaleLowerCase();
        const show = (!chapter || chapter === item.slug) && words.every(word => text.includes(word));
        card.hidden = !show;
        if (show) visible++;
      }
      item.section.hidden = visible === 0;
      item.section.querySelectorAll('.tree-group').forEach(group => {
        group.hidden = ![...group.querySelectorAll('.card')].some(card => !card.hidden);
      });
      matches += visible;
      if (visible) shownChapters++;
    }
    const selected = chapters.find(c => c.slug === chapter);
    title.textContent = selected ? selected.name : '全部图解';
    count.textContent = query ? `找到 ${matches} 个图解` : `${matches} 个图解 / ${shownChapters} 个章节`;
    nav.querySelectorAll('a').forEach(link => {
      if (link.dataset.chapter === chapter) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    empty.hidden = matches !== 0;
  }

  function readURL() {
    const params = new URLSearchParams(location.search);
    const requested = params.get('chapter');
    chapter = chapters.some(c => c.slug === requested) ? requested : '';
    query = params.get('q') || '';
    input.value = query;
    render();
  }
  document.querySelector('.catalog-search').addEventListener('submit', event => event.preventDefault());
  input.addEventListener('input', () => { query = input.value.trim(); syncURL(); render(); });
  document.querySelector('#clear-filters').addEventListener('click', () => {
    chapter = ''; query = ''; input.value = ''; syncURL(true); render(); input.focus();
  });
  window.addEventListener('popstate', readURL);
  sidebar.hidden = false;
  document.querySelector('.catalog-toolbar').hidden = false;
  readURL();
})();
