(() => {
  const root = document.documentElement;
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem('portfolio-theme'); } catch {}
  if (preference !== 'light' && preference !== 'dark') preference = null;

  function applyTheme(theme) {
    root.dataset.theme = theme;
    document.querySelectorAll('.theme-toggle').forEach((button) => {
      button.hidden = false;
      button.setAttribute('aria-pressed', String(theme === 'dark'));
    });
  }

  function updateTheme() {
    applyTheme(preference || 'dark');
  }

  updateTheme();
  systemTheme.addEventListener('change', updateTheme);
  window.addEventListener('storage', (event) => {
    if (event.key !== 'portfolio-theme' && event.key !== null) return;
    preference = event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : null;
    updateTheme();
  });
  document.addEventListener('DOMContentLoaded', () => {
    updateTheme();
    document.querySelectorAll('.theme-toggle').forEach((button) => {
      button.addEventListener('click', () => {
        preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(preference);
        try { localStorage.setItem('portfolio-theme', preference); } catch {}
      });
    });
  });
})();
