const page = document.querySelector('.page');
let queued = false;

const snap = () => {
  queued = false;
  const pad = parseFloat(getComputedStyle(page).paddingTop);
  if (!pad) return;

  const targets = [...document.querySelectorAll('.prose figure > :is(img, .table-wrap), .cover, .more .card img')];
  targets.forEach((el) => el.style.removeProperty('--fit'));
  targets.forEach((el) => {
    if (!el.offsetParent) return;
    const height = el.getBoundingClientRect().height;
    if (!height) return;
    const rows = Math.ceil(height / pad - 0.02);
    const extra = rows * pad - height;
    if (extra > 0.5) el.style.setProperty('--fit', `${extra / 2}px`);
  });
};

const queue = () => {
  if (!queued) {
    queued = true;
    requestAnimationFrame(snap);
  }
};

if (page) {
  new ResizeObserver(queue).observe(page);
  addEventListener('load', queue);
  document.fonts?.ready.then(queue);
  queue();
}
