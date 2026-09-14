// Each gallery has independent, keyboard-accessible tabs and manual navigation.
document.querySelectorAll('[data-carousel]').forEach(carousel => {
  const tabs = [...carousel.querySelectorAll('[role="tab"]')];
  const slides = [...carousel.querySelectorAll('[role="tabpanel"]')];
  const count = carousel.querySelector('.pib-slide-count');
  let selected = 0;
  function select(index, focus = false) {
    selected = (index + tabs.length) % tabs.length;
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === selected));
      tab.tabIndex = i === selected ? 0 : -1;
      slides[i].hidden = i !== selected;
    });
    count.textContent = `${selected + 1} / ${tabs.length}`;
    if (focus) tabs[selected].focus({ preventScroll: true });
    const strip = carousel.querySelector('[role="tablist"]');
    const active = tabs[selected];
    if (active.offsetLeft < strip.scrollLeft || active.offsetLeft + active.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: active.offsetLeft - strip.clientWidth / 2 + active.offsetWidth / 2, behavior: 'instant' });
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      const destination = { ArrowRight: selected + 1, ArrowLeft: selected - 1, Home: 0, End: tabs.length - 1 }[event.key];
      if (destination !== undefined) { event.preventDefault(); select(destination, true); }
    });
  });
  carousel.querySelectorAll('[data-direction]').forEach(button => {
    button.addEventListener('click', () => select(selected + Number(button.dataset.direction)));
  });
});
