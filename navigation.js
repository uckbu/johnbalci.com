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
  blog: 'blog.html',
  groups: [
    {
      title: 'Software',
      projects: [
        { title: 'PCM Map Generator', href: 'projects/pcm-map-generator.html' },
        { title: 'scrapr.site', href: 'projects/scrapr.html' },
      ],
    },
    {
      title: 'Hardware',
      projects: [
        { title: 'Payload Interface Board', href: 'projects/payload-interface-board.html' },
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
  <div class="sidebar-rail"><a href="${url(SIDEBAR.home)}" aria-label="Home" title="Home">⌂</a><button type="button" class="rail-search" aria-label="Search projects" title="Search projects">⌕</button></div>
  <div class="sidebar-content">
    <label class="search-box"><span aria-hidden="true">⌕</span><input id="project-search" type="search" placeholder="Quick search…" aria-label="Search projects" aria-keyshortcuts="Control+k Meta+k"><kbd aria-hidden="true">⌘K</kbd></label>
    <a class="sidebar-home" href="${url(SIDEBAR.home)}"><span aria-hidden="true">⌂</span> Home</a>
    <a class="sidebar-home sidebar-blog" href="${url(SIDEBAR.blog)}"><span aria-hidden="true">≡</span> Interests</a>
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
    sidebar.querySelector('.sidebar-content').inert = !open;
    sidebar.querySelector('.sidebar-footer').inert = !open;
    sidebar.querySelector('.sidebar-rail').inert = open;
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
  sidebar.querySelector('.rail-search').addEventListener('click', () => { setSidebar(true, true); search.focus(); });
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    links.forEach((link) => { link.hidden = !link.textContent.toLowerCase().includes(query); });
    groups.forEach((item) => {
      item.hidden = ![...item.querySelectorAll('a')].some((link) => !link.hidden);
      if (query) item.open = true;
    });
    empty.hidden = links.some((link) => !link.hidden);
  });
  const blogLink = document.createElement('a');
  blogLink.href = url(SIDEBAR.blog);
  blogLink.textContent = 'Interests';
  blogLink.className = 'interests-nav';
  if (location.pathname.endsWith('/blog.html') || location.pathname.endsWith('/blog-post.html')) blogLink.setAttribute('aria-current', 'page');
  document.querySelector('.topbar nav').prepend(blogLink);

  const resume = document.createElement('details');
  resume.className = 'resume-dropdown';
  resume.innerHTML = `<summary class="resume-button">Resume <span class="resume-caret" aria-hidden="true"></span></summary><div class="resume-options"><a href="${url('resumes/John_Balci_Resume_SWE.pdf')}" target="_blank" rel="noopener" aria-label="SWE resume (opens PDF in a new tab)">SWE</a><a href="${url('resumes/John_Balci_Resume_EE.pdf')}" target="_blank" rel="noopener" aria-label="EE resume (opens PDF in a new tab)">EE</a></div>`;
  document.querySelector('.topbar nav').append(resume);
  document.addEventListener('click', (event) => {
    if (!resume.contains(event.target)) resume.open = false;
  });
  resume.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      resume.open = false;
      resume.querySelector('summary').focus();
    }
  });
  resume.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { resume.open = false; }));

  const current = location.pathname;
  document.querySelectorAll('.sidebar a').forEach((link) => {
    const path = new URL(link.href).pathname;
    if (path === current || (link.classList.contains('sidebar-blog') && current.endsWith('/blog-post.html')) || (link.classList.contains('sidebar-home') && current.endsWith('/'))) {
      link.setAttribute('aria-current', 'page');
    }
  });
})();

// Build a shared, live outline from the project content itself.
(() => {
  const article = document.querySelector('main > article');
  if (!article) return;
  const main = article.parentElement;
  main.classList.add('project-layout');
  const toc = document.createElement('nav');
  toc.className = 'project-toc';
  toc.setAttribute('aria-label', 'Table of contents');
  const title = document.createElement('h2');
  title.textContent = 'Table of Contents';
  toc.append(title);
  const list = document.createElement('ol');
  toc.append(list);
  const targets = [...article.querySelectorAll(article.dataset.tocSelector || 'h1, .scrapr-section, .project-detail > h2, .scrapr-end h2, .section-content > h3')];
  const entries = targets.filter(target => !target.hasAttribute('data-toc-skip')).map((target, index) => {
    if (!target.id) {
      const base = target.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'section';
      let id = base;
      let suffix = 2;
      while (document.getElementById(id)) id = `${base}-${suffix++}`;
      target.id = id;
    }
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${target.id}`;
    link.textContent = target.dataset.tocLabel || target.querySelector('.section-marker p')?.textContent || target.textContent;
    item.className = index === 0 ? 'toc-title' : target.matches('h3') ? 'toc-subsection' : 'toc-section';
    item.append(link);
    list.append(item);
    return { target, link };
  });
  main.append(toc);
  let scheduled = false;
  function update() {
    scheduled = false;
    const threshold = document.querySelector('.topbar').getBoundingClientRect().bottom + 36;
    let active = entries[0];
    for (const entry of entries) {
      if (entry.target.getBoundingClientRect().top <= threshold) active = entry;
    }
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) active = entries.at(-1);
    entries.forEach(({ link }) => {
      if (link === active?.link) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);
  update();
})();
