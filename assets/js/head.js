const head = document.querySelector('[data-head]');
const button = head.querySelector('.menu-btn');

const setMenu = (open) => {
  head.dataset.open = String(open);
  button.setAttribute('aria-expanded', String(open));
  button.textContent = open ? 'zavřít' : 'menu';
};

button.addEventListener('click', () => setMenu(head.dataset.open !== 'true'));

export const closeMenu = () => setMenu(false);

export const setActive = ({ c = '' } = {}) => {
  head.querySelectorAll('[data-filter]').forEach((a) => {
    if (a.dataset.c === c) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
};

export const labelOf = (c) => head.querySelector(`[data-filter][data-c="${c}"] span`)?.textContent ?? '';
