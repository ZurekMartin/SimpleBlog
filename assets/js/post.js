const article = document.querySelector('.prose');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = matchMedia('(width < 74rem)');
const FOCUS = { hold: 3200 };

const headings = [...article.querySelectorAll(':scope > h2[id]')];
const links = [...document.querySelectorAll('.toc a')];
let tops = [];
let ticking = false;

const update = () => {
  ticking = false;
  if (!links.length) return;
  const atEnd = scrollY > 0 && scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  const probe = scrollY + innerHeight * 0.3;
  const found = atEnd ? headings.length - 1 : tops.findLastIndex((t) => t <= probe);
  const index = Math.max(0, found);
  links.forEach((a, i) => {
    if (i === index) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  });
};

const placeNotes = () => {
  const notes = [...article.querySelectorAll(':scope > aside.note')];
  notes.forEach((n) => n.style.removeProperty('--shift'));
  if (narrow.matches) return;
  const pad = parseFloat(getComputedStyle(document.querySelector('.page')).paddingTop);
  if (!pad) return;
  const rows = (el) => (el.getBoundingClientRect().height + parseFloat(getComputedStyle(el).marginBottom)) / pad;
  notes.forEach((note) => {
    const marker = article.querySelector(`a.sn-ref[href="#${note.id}"]`);
    const block = marker?.closest('.prose > *');
    if (!block) return;
    const box = marker.getBoundingClientRect();
    const target = Math.floor((box.top + box.height / 2 - block.getBoundingClientRect().top) / pad);
    const room = Math.floor(rows(block) - rows(note) + 0.02);
    const k = Math.max(0, Math.min(target, room));
    note.style.setProperty('--shift', `${k * pad}px`);
  });
};

const measure = () => {
  placeNotes();
  tops = headings.map((h) => h.getBoundingClientRect().top + scrollY);
  update();
};

addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(update); }
}, { passive: true });
new ResizeObserver(measure).observe(article);
addEventListener('load', measure);
document.fonts?.ready.then(measure);
narrow.addEventListener('change', measure);
measure();

const canHighlight = typeof Highlight !== 'undefined' && 'highlights' in CSS;
const SKIP = '.sn-ref, .cite';
const ABBREVIATION = /(?:^|[\s(])(?:např|tj|tzn|apod|atd|resp|cca|tzv|č|str|obr|tab|kód|viz|mj|př|popř)\.$/i;

const sentenceStarts = (text) => {
  const starts = [0];
  for (const m of text.matchAll(/[.!?…]+["”)]*\s+(?=[\p{Lu}\d„"(\[])/gu)) {
    const single = m[0].match(/^[.!?…]+/)[0] === '.';
    if (single && ABBREVIATION.test(text.slice(Math.max(0, m.index - 12), m.index + 1))) continue;
    starts.push(m.index + m[0].length);
  }
  return starts;
};

const sentenceRange = (marker, count = 1) => {
  const block = marker.closest('p, li');
  if (!block) return null;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  let text = '';
  let at = -1;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (at < 0 && marker.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) at = text.length;
    nodes.push({ node: n, start: text.length });
    text += n.data;
  }
  if (at < 0) at = text.length;
  if (!nodes.length || at === 0) return null;

  const starts = sentenceStarts(text);
  const before = text.slice(0, at).trimEnd();
  const closed = /[.!?…]["”)]*$/.test(before) && !ABBREVIATION.test(before);
  const probe = closed ? before.length - 1 : at - 1;
  const index = starts.findLastIndex((s) => s <= probe);
  const to = closed ? before.length : (starts[index + 1] ?? text.length);
  const from = starts[Math.max(0, index - (count - 1))];
  const end = text.slice(0, to).trimEnd().length;

  const place = (offset, atEnd) => {
    for (const { node, start } of nodes) {
      const len = node.data.length;
      if (atEnd ? offset > start && offset <= start + len : offset >= start && offset < start + len) return [node, offset - start];
    }
    const last = nodes.at(-1);
    return [last.node, last.node.data.length];
  };
  const range = new Range();
  range.setStart(...place(from, false));
  range.setEnd(...place(end, true));
  if (range.comparePoint(marker, 0) > 0) range.setEndAfter(marker);
  return range;
};

const complement = (block, keeps) => {
  keeps.sort((a, b) => a.compareBoundaryPoints(Range.START_TO_START, b));
  const whole = new Range();
  whole.selectNodeContents(block);
  const out = [];
  let node = whole.startContainer;
  let offset = whole.startOffset;
  for (const keep of keeps) {
    const gap = new Range();
    gap.setStart(node, offset);
    gap.setEnd(keep.startContainer, keep.startOffset);
    if (!gap.collapsed) out.push(gap);
    node = keep.endContainer;
    offset = keep.endOffset;
  }
  const tail = new Range();
  tail.setStart(node, offset);
  tail.setEnd(whole.endContainer, whole.endOffset);
  if (!tail.collapsed) out.push(tail);
  return out;
};

const markersFor = (id) => [...article.querySelectorAll(`a.sn-ref[href="#${id}"], a.cite[href="#${id}"]`)];
const blockOf = (el) => el.closest('.prose > *');

let timer = 0;
const reset = () => {
  clearTimeout(timer);
  timer = 0;
  delete document.body.dataset.focus;
  document.querySelectorAll('.keep').forEach((el) => el.classList.remove('keep'));
  if (canHighlight) CSS.highlights.delete('dim');
};

const focusOn = (targets, markers, hold = 0) => {
  reset();
  document.body.dataset.focus = '';
  targets.forEach((t) => {
    t.classList.add('keep');
    blockOf(t)?.classList.add('keep');
  });
  const perBlock = new Map();
  markers.forEach((m) => {
    const block = blockOf(m);
    if (!block) return;
    block.classList.add('keep');
    m.closest('p, li')?.classList.add('keep');
    const range = sentenceRange(m, Number(m.dataset.s) || 1);
    if (range) perBlock.set(block, [...(perBlock.get(block) ?? []), range]);
  });
  if (canHighlight) {
    const dims = [...perBlock].flatMap(([block, keeps]) => complement(block, keeps));
    if (dims.length) CSS.highlights.set('dim', new Highlight(...dims));
  }
  if (hold) timer = setTimeout(reset, hold);
};

const timed = () => (narrow.matches ? FOCUS.hold : 0);

const hover = (el, getTargets, getMarkers) => {
  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') focusOn(getTargets(), getMarkers(), timed());
  });
  el.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !narrow.matches) reset();
  });
  el.addEventListener('focusin', () => focusOn(getTargets(), getMarkers(), timed()));
  el.addEventListener('focusout', () => {
    if (!narrow.matches) reset();
  });
};

article.querySelectorAll('a.sn-ref').forEach((ref) => {
  const note = document.getElementById(ref.getAttribute('href').slice(1));
  if (!note) return;
  hover(ref, () => [note], () => [ref]);
  ref.addEventListener('click', (e) => {
    e.preventDefault();
    note.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: narrow.matches ? 'center' : 'nearest' });
    focusOn([note], [ref], timed());
  });
});

article.querySelectorAll('aside.note').forEach((note) => {
  hover(note, () => [note], () => markersFor(note.id));
});

const pop = Object.assign(document.createElement('div'), { className: 'cite-pop', role: 'tooltip' });
document.body.append(pop);
article.querySelectorAll('a.cite').forEach((a) => {
  const item = document.getElementById(a.getAttribute('href').slice(1));
  if (!item) return;
  const place = () => {
    pop.innerHTML = item.innerHTML;
    const col = (article.querySelector(':scope > p') ?? article).getBoundingClientRect();
    const r = a.getBoundingClientRect();
    const width = Math.min(24 * 16, col.width);
    pop.style.width = `${width}px`;
    pop.style.left = `${Math.min(Math.max(r.left, col.left), col.right - width)}px`;
    const h = pop.offsetHeight;
    pop.style.top = `${r.bottom + 8 + h > innerHeight ? r.top - h - 8 : r.bottom + 8}px`;
    pop.classList.add('on');
  };
  const reveal = () => {
    focusOn([item], [a], timed());
    place();
  };
  const conceal = () => pop.classList.remove('on');
  a.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') reveal();
  });
  const release = () => {
    conceal();
    if (!timer && !narrow.matches) reset();
  };
  a.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') release();
  });
  a.addEventListener('focus', reveal);
  a.addEventListener('blur', release);
  a.addEventListener('click', (e) => {
    e.preventDefault();
    conceal();
    item.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    focusOn([item], [a], FOCUS.hold);
  });
});

document.querySelectorAll('figure.code').forEach((fig) => {
  const button = Object.assign(document.createElement('button'), { className: 'copy', type: 'button', title: 'Kopírovat kód' });
  button.setAttribute('aria-label', 'Kopírovat kód');
  button.append(Object.assign(document.createElement('span'), { className: 'ok' }));
  button.addEventListener('click', async () => {
    const text = fig.querySelector('pre').innerText;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = Object.assign(document.createElement('textarea'), { value: text });
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      button.focus();
      if (!ok) return;
    }
    button.dataset.done = '';
    setTimeout(() => delete button.dataset.done, 1600);
  });
  fig.prepend(button);
});
