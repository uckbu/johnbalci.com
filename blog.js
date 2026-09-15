import { posts } from './blog-posts.js';

const words = post => [post.title, ...post.sections.flatMap(section => [section.title, ...section.paragraphs])].join(' ').trim().split(/\s+/u).filter(Boolean).length;
const dateLabel = date => date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) : '';
const list = document.querySelector('.blog-list');
if (list) {
  document.querySelector('.blog-empty').hidden = posts.length > 0;
  const template = document.querySelector('#blog-row-template');
  [...posts].sort((a, b) => b.date.localeCompare(a.date)).forEach((post, index) => {
    const row = template.content.firstElementChild.cloneNode(true);
    const title = row.querySelector('.blog-title');
    title.textContent = post.title || 'Untitled';
    title.href = `blog-post.html?post=${encodeURIComponent(post.slug)}`;
    row.querySelector('.blog-word-count').textContent = `(${words(post)} words)`;
    const time = row.querySelector('time');
    time.dateTime = post.date;
    time.textContent = dateLabel(post.date);
    time.hidden = !post.date;
    row.classList.toggle('is-empty-post', !post.title && !post.description);
    const description = row.querySelector('.blog-description');
    description.id = `blog-description-${index}`;
    description.querySelector('p').textContent = post.description;
    const button = row.querySelector('button');
    button.setAttribute('aria-controls', description.id);
    button.setAttribute('aria-label', `Show description for ${post.title || 'Untitled'}`);
    let hovered = false;
    let focused = false;
    let pinned = false;
    const update = () => {
      const expanded = hovered || focused || pinned;
      row.classList.toggle('is-open', expanded);
      description.inert = !expanded;
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-label', `${expanded ? 'Hide' : 'Show'} description for ${post.title || 'Untitled'}`);
    };
    row.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hovered = true; update(); } });
    row.addEventListener('pointerleave', () => { hovered = false; update(); });
    title.addEventListener('focus', () => { focused = true; update(); });
    title.addEventListener('blur', () => { focused = false; update(); });
    button.addEventListener('click', () => {
      pinned = !row.classList.contains('is-open');
      hovered = false;
      focused = false;
      update();
    });
    row.addEventListener('keydown', event => {
      if (event.key === 'Escape') { pinned = hovered = focused = false; update(); }
    });
    list.append(row);
  });
} else {
  const post = posts.find(post => post.slug === new URLSearchParams(location.search).get('post'));
  if (post) {
    document.title = `${post.title || 'Untitled'} — John Balci`;
    document.querySelector('.blog-empty').remove();
    const main = document.querySelector('main');
    const article = document.createElement('article');
    article.className = 'blog-article';
    article.classList.toggle('is-empty-post', !post.sections.length);
    const heading = document.createElement('h1');
    heading.id = 'post-title';
    heading.textContent = post.title || 'Untitled';
    const metadata = document.createElement('p');
    metadata.className = 'blog-post-meta';
    metadata.textContent = [dateLabel(post.date), `${words(post)} words`].filter(Boolean).join(' · ');
    article.append(heading, metadata);
    const toc = document.createElement('nav');
    toc.className = 'project-toc blog-toc';
    toc.setAttribute('aria-label', 'Table of contents');
    const tocHeading = document.createElement('h2');
    tocHeading.textContent = 'Table of Contents';
    const links = document.createElement('ol');
    toc.append(tocHeading, links);
    const targets = [heading];
    post.sections.forEach((section, index) => {
      const container = document.createElement('section');
      const title = document.createElement('h2');
      title.id = `section-${index}`;
      title.textContent = section.title;
      container.append(title);
      section.paragraphs.forEach(text => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        container.append(paragraph);
      });
      article.append(container);
      targets.push(title);
    });
    targets.forEach(target => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${target.id}`;
      link.textContent = target.textContent;
      item.append(link);
      links.append(item);
    });
    main.classList.add('blog-has-post');
    main.append(article, toc);
    const updateOutline = () => {
      const offset = document.querySelector('.topbar').getBoundingClientRect().bottom + 36;
      let active = 0;
      targets.forEach((target, index) => { if (target.getBoundingClientRect().top <= offset) active = index; });
      links.querySelectorAll('a').forEach((link, index) => {
        if (index === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    window.addEventListener('scroll', updateOutline, { passive: true });
    window.addEventListener('resize', updateOutline);
    updateOutline();
  }
}
