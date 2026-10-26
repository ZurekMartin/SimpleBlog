import { setActive, closeMenu, labelOf } from './head.js';

const list = document.querySelector('[data-list]');
const items = [...list.querySelectorAll('.entry')];
const empty = list.querySelector('[data-empty]');
const state = document.querySelector('[data-state]');
const pager = document.querySelector('[data-pager]');
const size = Number(list.dataset.size) || 8;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const readUrl = () => {
  const q = new URLSearchParams(location.search);
  return { c: q.get('c') ?? '', p: Math.max(1, Number(q.get('p')) || 1) };
};

const hrefOf = ({ c, p }) => {
  const q = new URLSearchParams();
  if (c) q.set('c', c);
  if (p > 1) q.set('p', p);
  const text = q.toString();
  return location.pathname + (text ? `?${text}` : '');
};

const pagerHtml = (st, total) => {
  if (total <= 1) return '';
  const count = Math.min(3, total);
  const first = Math.min(Math.max(st.p - 1, 1), total - count + 1);
  const item = (p, label, aria, disabled, current = false) =>
    disabled
      ? `<span aria-disabled="true">${label}</span>`
      : `<a href="${hrefOf({ ...st, p })}" data-page="${p}" aria-label="${aria}"${current ? ' aria-current="page"' : ''}>${label}</a>`;
  return [
    item(1, '&lt;&lt;', 'První strana', st.p === 1),
    item(st.p - 1, '&lt;', 'Novější články', st.p === 1),
    ...Array.from({ length: count }, (_, i) => first + i).map((n) => item(n, n, `Strana ${n}`, false, n === st.p)),
    item(st.p + 1, '&gt;', 'Starší články', st.p === total),
    item(total, '&gt;&gt;', 'Poslední strana', st.p === total),
  ].join('');
};

const render = (st) => {
  const match = items.filter((el) => (!st.c || el.dataset.c === st.c));
  const total = Math.max(1, Math.ceil(match.length / size));
  const now = { ...st, p: Math.min(st.p, total) };
  const shown = new Set(match.slice((now.p - 1) * size, now.p * size));
  items.forEach((el) => { el.hidden = !shown.has(el); });
  empty.hidden = match.length > 0;
  pager.innerHTML = pagerHtml(now, total);
  setActive(now);

  const parts = [];
  if (now.c) {
    parts.push(`@ ${labelOf(now.c)}`);
  }
  if (total > 1) parts.push(`strana ${now.p}/${total}`);
  state.textContent = parts.join(' · ');
  if (now.c) {
    const clear = Object.assign(document.createElement('a'), { href: location.pathname, textContent: '[x] zrušit filtr' });
    clear.dataset.filter = '';
    clear.dataset.c = '';
    state.append(clear);
  }
  list.dataset.ready = '';
  return now;
};

let current = render(readUrl());

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-filter], a[data-page]');
  if (!link || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  const next = link.dataset.page
    ? { ...current, p: Number(link.dataset.page) }
    : { c: link.dataset.c, p: 1 };
  current = render(next);
  history.pushState(null, '', hrefOf(current));
  closeMenu();
  document.querySelector('.feed-head').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
});

addEventListener('popstate', () => { current = render(readUrl()); });
