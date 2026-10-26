import './head.js';
import './snap.js';

const KEY = 'sb-theme';
const root = document.documentElement;

const read = () => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};
const write = (value) => {
  try { value === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, value); } catch {}
};

const sync = () => {
  const now = read() ?? 'system';
  document.querySelectorAll('[data-theme-set]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.themeSet === now));
  });
};

document.addEventListener('click', (e) => {
  const button = e.target.closest('[data-theme-set]');
  if (!button) return;
  const value = button.dataset.themeSet;
  write(value);
  if (value === 'system') delete root.dataset.theme;
  else root.dataset.theme = value;
  sync();
});

sync();

const page = document.body.dataset.page;
if (page === 'home' || page === 'post') import(`./${page}.js`);
