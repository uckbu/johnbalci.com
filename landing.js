// Reveal content once as it enters the viewport; navigation stays steady.
(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !('IntersectionObserver' in window)) return;

  const targets = document.querySelectorAll(
    'main [data-reveal], main > section:not(.hero) > :is(h2, h3, p), main .project-card, body > footer > p'
  );
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      target.classList.add('is-visible');
      observer.unobserve(target);
    });
  }, { threshold: 0.08 });

  targets.forEach((target) => {
    target.classList.add('reveal');
    observer.observe(target);
  });
  document.addEventListener('focusin', (event) => {
    event.target.closest('.reveal')?.classList.add('is-visible');
  });
  motion.addEventListener('change', ({ matches }) => {
    if (matches) {
      observer.disconnect();
      targets.forEach(target => target.classList.add('is-visible'));
    }
  });
})();
