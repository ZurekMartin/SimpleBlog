// Načítá se synchronně v <head>, aby nedošlo k probliknutí motivu.
(() => {
  const KEY = 'sb-theme';
  const root = document.documentElement;
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = (v) => { try { v === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, v); } catch {} };
  const apply = (v) => { v === 'light' || v === 'dark' ? (root.dataset.theme = v) : delete root.dataset.theme; };

  apply(read());

  const icon = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const OPTIONS = [
    ['light', 'Světlý režim', icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>')],
    ['dark', 'Tmavý režim', icon('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>')],
    ['system', 'Podle systému', icon('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>')],
  ];
  const current = () => read() ?? 'system';
  const sync = () => document.querySelectorAll('[data-theme-set]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.themeSet === current())));

  const mount = () => {
    document.querySelectorAll('[data-theme-switch]:not(.theme-switch)').forEach((el) => {
      el.classList.add('theme-switch');
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', 'Režim zobrazení');
      el.innerHTML = OPTIONS.map(([v, label, svg]) =>
        `<button type="button" data-theme-set="${v}" aria-label="${label}" title="${label}">${svg}</button>`).join('');
    });
    sync();
  };
  addEventListener('DOMContentLoaded', mount);
  document.addEventListener('sb:mount', mount);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme-set]');
    if (!btn) return;
    const run = () => { write(btn.dataset.themeSet); apply(btn.dataset.themeSet); sync(); };
    document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches
      ? document.startViewTransition(run) : run();
  });
})();
