/*
 * Single source of truth for the portfolio sidebar.
 *
 * Every page just loads this script (<script src="navigation.js" defer>, or
 * "../navigation.js" from projects/). The sidebar markup is rendered here and
 * inserted after the page header, so adding, renaming, or reordering a project
 * only means editing the SIDEBAR object below.
 *
 * Paths are written relative to the site root; the correct "../" prefix for
 * pages in subdirectories is resolved from this script's own URL.
 */
const SIDEBAR = {
  home: 'index.html',
  groups: [
    {
      title: 'Software',
      projects: [
        { title: 'Telemetry Frame Solver', href: 'projects/project-one.html' },
        { title: 'Scrapr', href: 'projects/scrapr.html' },
      ],
    },
    {
      title: 'Hardware',
      projects: [
        { title: 'Project Six', href: 'projects/project-six.html' },
      ],
    },
  ],
};

(() => {
  const script = document.currentScript || document.querySelector('script[src$="navigation.js"]');
  const root = new URL('.', script.src);
  const url = (path) => new URL(path, root).href;
  const escape = (text) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

  const group = (item) => `<details class="sidebar-group" open><summary>${escape(item.title)}</summary><div class="sidebar-group-links">${item.projects.map((project) => `<a class="sidebar-project" href="${url(project.href)}">${escape(project.title)} <span class="chevron" aria-hidden="true">›</span></a>`).join('')}</div></details>`;

  document.querySelector('.topbar').insertAdjacentHTML('afterend', `
<aside class="sidebar" id="sidebar" aria-label="Portfolio sidebar">
  <div class="sidebar-content">
    <label class="search-box"><span aria-hidden="true">⌕</span><input id="project-search" type="search" placeholder="Quick search…" aria-label="Search projects" aria-keyshortcuts="Control+k Meta+k"><kbd aria-hidden="true">⌘K</kbd></label>
    <a class="sidebar-home" href="${url(SIDEBAR.home)}"><span aria-hidden="true">⌂</span> Home</a>
    ${SIDEBAR.groups.map(group).join('')}
    <p id="search-empty" role="status" hidden>No projects found.</p>
  </div>
  <div class="sidebar-footer">
    <button class="theme-toggle" type="button" aria-label="Dark mode" aria-pressed="false" hidden><span aria-hidden="true">◐</span> Dark mode</button>
  </div>
</aside>
<button class="sidebar-toggle" type="button" aria-label="Toggle sidebar" aria-controls="sidebar" aria-expanded="true">◧</button>`);

  const sidebar = document.querySelector('.sidebar');
  const toggle = document.querySelector('.sidebar-toggle');
  const search = document.querySelector('#project-search');
  const groups = [...document.querySelectorAll('.sidebar-group')];
  const links = [...document.querySelectorAll('.sidebar-project')];
  const empty = document.querySelector('#search-empty');
  const narrow = window.matchMedia('(max-width: 760px)');

  let preferredOpen = null;
  try { preferredOpen = localStorage.getItem('portfolio-sidebar-open'); } catch {}
  function setSidebar(open, persist = false) {
    document.body.classList.toggle('sidebar-closed', !open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Collapse sidebar' : 'Expand sidebar');
    toggle.title = open ? 'Collapse sidebar' : 'Expand sidebar';
    sidebar.inert = !open;
    if (persist) {
      preferredOpen = String(open);
      try { localStorage.setItem('portfolio-sidebar-open', preferredOpen); } catch {}
    }
  }
  setSidebar(preferredOpen === null ? !narrow.matches : preferredOpen === 'true');
  toggle.addEventListener('click', () => setSidebar(toggle.getAttribute('aria-expanded') !== 'true', true));
  narrow.addEventListener('change', () => setSidebar(preferredOpen === null ? !narrow.matches : preferredOpen === 'true'));
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setSidebar(true);
      search.focus();
    }
    if (event.key === 'Escape' && narrow.matches) {
      setSidebar(false);
      toggle.focus();
    }
  });
  sidebar.addEventListener('click', (event) => {
    if (narrow.matches && event.target.closest('a')) setSidebar(false);
  });
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    links.forEach((link) => { link.hidden = !link.textContent.toLowerCase().includes(query); });
    groups.forEach((item) => {
      item.hidden = ![...item.querySelectorAll('a')].some((link) => !link.hidden);
      if (query) item.open = true;
    });
    empty.hidden = links.some((link) => !link.hidden);
  });
  const current = location.pathname;
  document.querySelectorAll('.sidebar a').forEach((link) => {
    const path = new URL(link.href).pathname;
    if (path === current || (link.classList.contains('sidebar-home') && current.endsWith('/'))) {
      link.setAttribute('aria-current', 'page');
    }
  });
})();
