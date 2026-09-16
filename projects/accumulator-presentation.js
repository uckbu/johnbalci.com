(() => {
  const viewer = document.querySelector('.acc-presentation');
  if (!viewer) return;
  const base = new URL('./presentations/accumulator/', document.currentScript.src);
  const stage = viewer.querySelector('.acc-presentation-stage');
  const placeholder = viewer.querySelector('.acc-presentation-placeholder');
  const image = viewer.querySelector('img');
  const status = viewer.querySelector('[role="status"]');
  const input = viewer.querySelector('input');
  const full = viewer.querySelector('.acc-slide-full');
  const buttons = [...viewer.querySelectorAll('[data-slide-step]')];
  let slides = [], selected = 0;
  function show(index) {
    selected = Math.max(0, Math.min(slides.length - 1, index));
    const slide = slides[selected];
    image.alt = slide.alt || `Slide ${selected + 1}`;
    image.src = new URL(slide.src, base).href;
    full.href = image.src;
    full.hidden = false;
    full.setAttribute('aria-label', `Open slide ${selected + 1} at full size`);
    image.hidden = false;
    placeholder.hidden = true;
    status.textContent = `${selected + 1} / ${slides.length}`;
    input.value = selected + 1;
    buttons[0].disabled = selected === 0;
    buttons[1].disabled = selected === slides.length - 1;
  }
  buttons.forEach(button => button.addEventListener('click', () => show(selected + Number(button.dataset.slideStep))));
  input.addEventListener('change', () => {
    const value = Number(input.value);
    if (Number.isInteger(value) && value >= 1 && value <= slides.length) show(value - 1);
    else input.value = selected + 1;
  });
  stage.addEventListener('keydown', event => {
    if (!slides.length) return;
    const target = { ArrowLeft: selected - 1, ArrowRight: selected + 1, Home: 0, End: slides.length - 1 }[event.key];
    if (target !== undefined) { event.preventDefault(); show(target); }
  });
  image.addEventListener('error', () => {
    image.hidden = true;
    placeholder.hidden = false;
    placeholder.querySelector('p').textContent = 'This slide could not load. Try another slide.';
  });
  fetch(new URL('slides.json', base)).then(response => {
    if (!response.ok) throw new Error('Presentation unavailable');
    return response.json();
  }).then(deck => {
    if (!Array.isArray(deck.slides)) throw new Error('Invalid presentation');
    slides = deck.slides.filter(slide => slide && typeof slide.src === 'string' && slide.src);
    if (!slides.length) return;
    viewer.querySelector('.acc-presentation-jump').hidden = false;
    input.max = slides.length;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { show(0); observer.disconnect(); }
    }, { rootMargin: '300px' });
    observer.observe(viewer);
  }).catch(() => { status.textContent = 'Presentation unavailable'; });
})();
