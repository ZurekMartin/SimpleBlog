import { readFile, writeFile, readdir, mkdir, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(process.env.ROOT ?? dirname(fileURLToPath(import.meta.url)));

const SITE = {
  url: (process.env.SITE ?? 'https://blog.zurekmartin.cz').replace(/\/$/, ''),
  name: 'SimpleBlog',
  tagline: 'technologie, radiofrekvenční otisky a osobní projekty',
  description: 'Blog Martina Žůrka o technologiích, radiofrekvenčních otiscích a osobních projektech.',
  pageSize: 8,
  author: {
    name: 'Martin Žůrek',
    role: 'Cybersecurity Student & Junior Software Engineer',
    web: 'https://www.zurekmartin.cz',
    email: 'zurek.martin.1@icloud.com',
    photo: 'assets/img/profile.png',
  },
  footer: [
    ['Martin Žůrek', 'https://www.zurekmartin.cz'],
    ['GitHub', 'https://github.com/ZurekMartin/SimpleBlog'],
  ],
  categories: [
    { slug: 'rf-otisky', name: 'Radiofrekvenční otisky', hue: 165 },
    { slug: 'projekty', name: 'Osobní projekty', hue: 75 },
    { slug: 'case-studies', name: 'Case studies', hue: 320 },
    { slug: 'technologie', name: 'Technologie', hue: 245 },
  ],
};

const LIST_COPIES = 12;

const FONTS = [
  ['cutive-mono', [400]],
  ['lekton', [400, 700]],
  ['doto', [700]],
];
const FONT_VERSION = '5.3.0';
const SUBSETS = ['latin', 'latin-ext'];
const fontFile = (id, subset, weight) => `${id}-${subset}-${weight}-normal.woff2`;

const NB = '\u00a0';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'";
const abs = (path = '') => `${SITE.url}/${path}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const dateFmt = (iso, opts) => new Intl.DateTimeFormat('cs-CZ', { timeZone: 'UTC', ...opts }).format(new Date(iso));
const longDate = (iso) => dateFmt(iso, { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (iso) => dateFmt(iso, { day: 'numeric', month: 'numeric', year: 'numeric' });
const rfcDate = (iso) => new Date(`${iso}T08:00:00Z`).toUTCString();

const typo = (html) => {
  let skip = 0;
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith('<')) {
        const m = part.match(/^<(\/?)(pre|code|math|script|style)\b/i);
        if (m) skip += m[1] ? -1 : 1;
        return part;
      }
      if (skip > 0) return part;
      return part
        .replace(/(?<![\p{L}\p{N}])([KkSsVvZzOoUuAaIi]) /gu, `$1${NB}`)
        .replace(/(\d) (?=(?:%|°C|(?:[kMGTmµnp]?(?:Hz|S\/s|s|m|g|V|A|W|B|bit)|dB|ppm|min|cm|mm|km|kg|h)(?![\p{L}\p{N}])))/gu, `$1${NB}`)
        .replace(/\b(obr\.|tab\.|kód) (\d)/gi, `$1${NB}$2`);
    })
    .join('');
};
const tx = (s) => typo(esc(s));

const plain = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const minutesOf = (html) => {
  const words = html
    .replace(/<(pre|math)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

const pngSize = async (file) => {
  try {
    const b = await readFile(file);
    if (b.toString('latin1', 1, 4) !== 'PNG') return null;
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  } catch {
    return null;
  }
};

const prepareImages = async (html, dir) => {
  for (const tag of new Set(html.match(/<img\b[^>]*>/g) ?? [])) {
    let next = tag;
    const src = tag.match(/\ssrc="([^"]+)"/)?.[1];
    if (src && !/\swidth=/.test(tag)) {
      const size = await pngSize(join(dir, src));
      if (size) next = next.replace('<img', `<img width="${size[0]}" height="${size[1]}"`);
    }
    if (!/\sloading=/.test(next) && !/\sfetchpriority=/.test(next)) next = next.replace('<img', '<img loading="lazy" decoding="async"');
    html = html.replaceAll(tag, () => next);
  }
  return html;
};

const numberNotes = (html) => {
  const order = [];
  html = html.replace(/<a class="sn-ref" href="#([^"]+)"([^>]*)><\/a>/g, (_, id, attrs) => {
    order.push(id);
    const n = order.length;
    return `<a class="sn-ref" href="#${id}"${attrs} aria-label="Poznámka ${n}">${n}</a>`;
  });
  order.forEach((id, i) => {
    html = html.replace(new RegExp(`<aside class="note([^"]*)" id="${id}"`), `<aside class="note$1" id="${id}" data-n="${i + 1}"`);
  });
  return html;
};

const normalizeSources = (html) => {
  const block = html.match(/<ol class="refs">[\s\S]*?<\/ol>/)?.[0];
  if (!block) return html;
  const ids = [...block.matchAll(/<li id="([^"]+)"/g)].map((m) => m[1]);
  const fixed = block
    .replace(/<span class="n">[^<]*<\/span>/g, '')
    .replace(/<li id="([^"]+)">/g, (_, id) => `<li id="${id}"><span class="n">[${ids.indexOf(id) + 1}]</span>`);
  return html
    .replace(block, () => fixed)
    .replace(/<a class="cite" href="#([^"]+)"([^>]*)>[^<]*<\/a>/g, (_, id, attrs) => `<a class="cite" href="#${id}"${attrs}>[${ids.indexOf(id) + 1}]</a>`);
};

const wrapCells = (html) => html.replace(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/g, '<$1$2><span>$3</span></$1>');

const parseSource = (raw) => {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error('chybí front matter');
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2].trim() };
};

const ALLOWED_TAGS = new Set(['h2', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'figure', 'figcaption', 'img', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'pre', 'code', 'span', 'aside', 'a']);

const validate = (meta, body) => {
  const errors = new Set();
  for (const k of ['title', 'description', 'date', 'category']) if (!meta[k]) errors.add(`chybí „${k}“`);
  if (meta.date && !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) errors.add('datum musí být RRRR-MM-DD');
  if (meta.category && !SITE.categories.some((c) => c.slug === meta.category)) errors.add(`neznámá rubrika „${meta.category}“`);
  if (meta.cover !== '' && !meta['cover-alt']) errors.add('chybí „cover-alt“');

  for (const m of body.matchAll(/<([a-z][a-z0-9]*)\b/gi)) {
    if (!ALLOWED_TAGS.has(m[1].toLowerCase())) errors.add(`nepovolený prvek <${m[1].toLowerCase()}>`);
  }
  const withoutPre = body.replace(/<pre\b[\s\S]*?<\/pre>/g, '');
  if (/<code\b/.test(withoutPre)) errors.add('<code> je povolený jen uvnitř <pre>');
  if (/<div\b(?![^>]*class="table-wrap")/.test(body)) errors.add('<div> je povolený jen jako table-wrap');
  if (/<aside\b(?![^>]*class="note(?: def| author)?")/.test(body)) errors.add('aside musí mít třídu note, note def nebo note author');
  const withoutRefs = body.replace(/<ol class="refs">[\s\S]*?<\/ol>/, '');
  if (/<a\b(?![^>]*class="(?:sn-ref|cite)")/.test(withoutRefs)) errors.add('odkazy v textu nejsou povolené, jen sn-ref a cite');
  if (/<h2\b(?![^>]*\sid=)/.test(body)) errors.add('h2 bez id');

  const ids = new Set([...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of body.matchAll(/class="(?:sn-ref|cite)" href="#([^"]+)"/g)) if (!ids.has(m[1])) errors.add(`odkaz na neexistující #${m[1]}`);
  const refs = (body.match(/class="sn-ref"/g) ?? []).length;
  if (refs !== (body.match(/<a class="sn-ref" href="#[^"]+"(?: data-s="\d")?><\/a>/g) ?? []).length) errors.add('sn-ref musí být prázdný: <a class="sn-ref" href="#nX"></a>');
  const notes = (body.match(/<aside\b/g) ?? []).length;
  if (refs !== notes) errors.add(`počet odkazů na poznámky (${refs}) ≠ počet poznámek (${notes})`);

  const figures = body.match(/<figure\b[^>]*>[\s\S]*?<\/figure>/g) ?? [];
  const counts = { fig: 0, tab: 0, code: 0 };
  for (const f of figures) {
    if (!/<figcaption>/.test(f)) errors.add('figure bez figcaption');
    const kind = f.match(/^<figure[^>]*class="([^"]*)"/)?.[1].split(/\s+/).find((c) => c in counts);
    if (kind) counts[kind]++;
    else errors.add('figure musí mít třídu fig, tab nebo code');
  }
  const names = { 'obr.': 'fig', 'tab.': 'tab', 'kód': 'code' };
  for (const m of plain(body).matchAll(/(obr\.|tab\.|kód) (\d+)/gi)) {
    if (Number(m[2]) > counts[names[m[1].toLowerCase()]]) errors.add(`„${m[0]}“ neexistuje`);
  }
  return [...errors];
};

const loadPosts = async () => {
  const posts = [];
  const errors = [];
  const entries = await readdir(join(ROOT, 'posts'), { withFileTypes: true });
  for (const d of entries.filter((e) => e.isDirectory())) {
    const dir = join(ROOT, 'posts', d.name);
    let raw;
    try {
      raw = await readFile(join(dir, 'article.html'), 'utf8');
    } catch {
      continue;
    }
    try {
      const { meta, body } = parseSource(raw);
      const problems = validate(meta, body);
      if (problems.length) {
        errors.push(...problems.map((p) => `${d.name}: ${p}`));
        continue;
      }
      const { html, toc } = numberHeadings(numberNotes(normalizeSources(wrapCells(typo(await prepareImages(body, dir))))));
      const cover = meta.cover === undefined ? 'cover.png' : meta.cover;
      posts.push({
        slug: d.name,
        title: meta.title,
        description: meta.description,
        date: meta.date,
        updated: meta.updated || meta.date,
        category: meta.category,
        tags: (meta.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
        cover,
        coverAlt: meta['cover-alt'] ?? '',
        coverSize: cover ? (await pngSize(join(dir, cover))) ?? [1200, 630] : null,
        minutes: minutesOf(html),
        html,
        toc,
      });
    } catch (err) {
      errors.push(`${d.name}: ${err.message}`);
    }
  }
  posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  return { posts, errors };
};

const catOf = (p) => SITE.categories.find((c) => c.slug === p.category);
const postPath = (p) => `posts/${p.slug}/`;
const cur = (on) => (on ? ' aria-current="true"' : '');

const headerHtml = (rel, posts, active = {}) => {
  const n = (c) => posts.filter((p) => p.category === c).length * LIST_COPIES;
  const cats = SITE.categories
    .map(
      (c) => `
        <li class="cat hue" data-hue="${c.hue}" data-cat="${c.slug}">
          <a class="row" href="${rel}?c=${c.slug}" data-filter data-c="${c.slug}"${cur(active.c === c.slug)}><span>${esc(c.name)}</span><span class="count">${n(c.slug)}</span></a>
        </li>`,
    )
    .join('');
  return `<header class="head" data-head>
      <div class="head-in">
        <div class="head-bar">
          <a class="brand" href="${rel || './'}">${SITE.name}</a>
          <button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu">menu</button>
        </div>
        <div class="head-panel" id="menu"><div class="head-body">
          <nav aria-label="Rubriky"><ul class="cats">
            <li class="cat"><a class="row all" href="${rel || './'}" data-filter data-c=""${cur(!active.c)}><span>Všechny články</span><span class="count">${posts.length * LIST_COPIES}</span></a></li>${cats}
          </ul></nav>
          <div class="tools">
            <a class="row tool" href="${rel}feed.xml"><span>RSS</span><span class="count">feed.xml</span></a>
            <div class="theme" role="group" aria-label="Režim zobrazení">
              <button type="button" data-theme-set="light" aria-pressed="false">světlý</button>
              <button type="button" data-theme-set="dark" aria-pressed="false">tmavý</button>
              <button type="button" data-theme-set="system" aria-pressed="false">auto</button>
            </div>
          </div>
        </div></div>
      </div>
    </header>`;
};

const footerHtml = () =>
  `<footer class="foot">${SITE.footer.map(([label, href]) => `<a href="${href}">${esc(label)}</a>`).join('<span aria-hidden="true">·</span>')}</footer>`;

const page = ({ rel, kind, title, description, path, canonical = true, robots = 'index, follow, max-image-preview:large', type = 'website', image, imageSize, css = 'home', keywords, ld = [], extraMeta = '', content }) => {
  const url = abs(path);
  const og = canonical
    ? `
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:locale" content="cs_CZ">
<meta property="og:title" content="${esc(title.replace(/ – SimpleBlog$/, ''))}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${abs(image ?? 'assets/img/favicon.png')}">${imageSize ? `
<meta property="og:image:width" content="${imageSize[0]}">
<meta property="og:image:height" content="${imageSize[1]}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">${extraMeta}`
    : '';
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">${keywords ? `
<meta name="keywords" content="${esc(keywords)}">` : ''}
<meta name="robots" content="${robots}">${canonical ? `
<link rel="canonical" href="${url}">` : ''}
<link rel="icon" href="${rel}assets/img/favicon.png" type="image/png">
<link rel="alternate" type="application/rss+xml" title="${SITE.name}" href="${rel}feed.xml">
<link rel="preload" href="${rel}assets/fonts/${fontFile('cutive-mono', 'latin', 400)}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${rel}assets/fonts/${fontFile('lekton', 'latin', 400)}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${rel}assets/fonts/${fontFile('doto', 'latin', 700)}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${rel}assets/css/core.css">
<link rel="stylesheet" href="${rel}assets/css/hues.css">
<link rel="stylesheet" href="${rel}assets/css/${css}.css">
<script src="${rel}assets/js/boot.js"></script>
<script type="module" src="${rel}assets/js/site.js"></script>${og}${ld.map((o) => `\n${jsonLd(o)}`).join('')}
</head>
<body data-page="${kind}">
<a class="skip" href="#main">Přeskočit na obsah</a>
${content}
${footerHtml()}
</body>
</html>
`;
};

const entryHtml = (p) => {
  const cat = catOf(p);
  return `
      <li class="entry hue" data-hue="${cat.hue}" data-c="${p.category}">
        <a class="entry-link" href="${postPath(p)}">
          <time datetime="${p.date}">${shortDate(p.date)}</time>
          <span class="label">${esc(cat.name)}</span>
          <h2>${tx(p.title)}</h2>
          <p>${tx(p.description)}</p>
          <span class="foot-line"><span>${p.minutes} min</span>${p.tags.slice(0, 3).map((t) => `<span>#${esc(t)}</span>`).join('')}</span>
        </a>
      </li>`;
};

const homePage = async (posts) => {
  const a = SITE.author;
  const size = (await pngSize(join(ROOT, a.photo))) ?? [256, 256];
  const title = `${SITE.name} – ${SITE.tagline}`;
  const content = `<div class="page">
    <div class="rail">
    ${headerHtml('', posts)}
    </div>
    <main id="main">
      <div class="feed-head">
        <h1>Články</h1>
        <p class="state" data-state aria-live="polite"></p>
      </div>
      <ol class="timeline" data-list data-size="${SITE.pageSize}">${posts.flatMap((p) => Array.from({ length: LIST_COPIES }, () => entryHtml(p))).join('')}
        <li class="empty" data-empty hidden>V této rubrice zatím nic není.</li>
      </ol>
      <nav class="pager" data-pager aria-label="Stránkování"></nav>
    </main>
    <aside class="bio" aria-label="O autorovi">
      <figure class="portrait"><img src="${a.photo}" alt="${esc(a.name)}" width="${size[0]}" height="${size[1]}"></figure>
      <h2>${esc(a.name)}</h2>
      <p class="role">${esc(a.role)}</p>
      <dl>
        <div><dt>web</dt><dd><a href="${a.web}">${esc(a.web.replace(/^https?:\/\//, ''))}</a></dd></div>
        <div><dt>mail</dt><dd><a href="mailto:${a.email}">${esc(a.email)}</a></dd></div>
      </dl>
    </aside>
  </div>`;
  return page({
    rel: '',
    kind: 'home',
    title,
    description: SITE.description,
    path: '',
    content,
    ld: [
      {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: SITE.name,
        url: abs(),
        description: SITE.description,
        inLanguage: 'cs',
        blogPost: posts.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: abs(postPath(p)), datePublished: p.date })),
      },
    ],
  });
};

const numberHeadings = (html) => {
  const toc = [];
  let n = 0;
  const out = html.replace(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/g, (_, attrs, inner) => {
    const id = attrs.match(/\sid="([^"]+)"/)?.[1];
    const nonum = /class="[^"]*\bnonum\b/.test(attrs);
    const label = nonum ? '' : String(++n);
    toc.push({ id, n: label, text: plain(inner) });
    return `<h2${attrs}${label ? ` data-n="${label}"` : ''}>${inner}</h2>`;
  });
  return { html: out, toc };
};

const postPage = (p, posts) => {
  const rel = '../../';
  const cat = catOf(p);
  const toc = p.toc;
  const others = posts
    .filter((x) => x !== p && x.cover)
    .sort((x, y) => (y.category === p.category) - (x.category === p.category) || y.date.localeCompare(x.date))
    .slice(0, 2);
  const pool = others.length ? others : p.cover ? [p] : [];
  const cards = pool.length ? Array.from({ length: 2 }, (_, i) => pool[i % pool.length]) : [];
  const more = cards.length
    ? `
      <aside class="more" aria-label="Další články">
        <p class="more-title">Další články</p>
        <div class="more-grid">${cards
          .map((o) => {
            const oc = catOf(o);
            return `
          <a class="card hue" data-hue="${oc.hue}" href="../${o.slug}/">
            <img src="../${o.slug}/${o.cover}" alt="" width="${o.coverSize[0]}" height="${o.coverSize[1]}" loading="lazy" decoding="async">
            <span class="meta">@ ${esc(oc.name)} · ${longDate(o.date)}</span>
            <span class="title">${tx(o.title)}</span>
          </a>`;
          })
          .join('')}
        </div>
      </aside>`
    : '';
  const kicker = `@ <a href="${rel}?c=${cat.slug}">${esc(cat.name)}</a>`;
  const content = `<div class="page">
    <div class="rail">
    ${headerHtml(rel, posts, { c: p.category })}
    <nav class="toc" aria-label="Obsah">
      <p class="toc-title">Obsah</p>
      <ol>${toc.map((h) => `<li><a href="#${h.id}"><span class="n"${h.n ? '' : ' data-dot'}>${h.n}</span><span>${esc(h.text)}</span></a></li>`).join('')}</ol>
    </nav>
    </div>
    <main id="main">
      <article class="prose hue" data-hue="${cat.hue}">
        <header class="post-head">
          <p class="kicker">${kicker}</p>
          <h1>${tx(p.title)}</h1>
          <p class="meta"><time datetime="${p.date}">${longDate(p.date)}</time> · ${p.minutes} min čtení</p>${p.cover ? `
          <img class="cover" src="${p.cover}" alt="${esc(p.coverAlt)}" width="${p.coverSize[0]}" height="${p.coverSize[1]}" fetchpriority="high" decoding="async">` : ''}
        </header>
${p.html}
      </article>${more}
    </main>
  </div>`;
  const url = abs(postPath(p));
  const image = p.cover ? abs(`${postPath(p)}${p.cover}`) : undefined;
  return page({
    rel,
    kind: 'post',
    css: 'post',
    title: `${p.title} – ${SITE.name}`,
    description: p.description,
    path: postPath(p),
    type: 'article',
    image: p.cover ? `${postPath(p)}${p.cover}` : undefined,
    imageSize: p.coverSize,
    keywords: p.tags.join(', '),
    extraMeta: `
<meta property="article:published_time" content="${p.date}">
<meta property="article:modified_time" content="${p.updated}">
<meta property="article:section" content="${esc(cat.name)}">${p.tags.map((t) => `
<meta property="article:tag" content="${esc(t)}">`).join('')}`,
    content,
    ld: [
      {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.description,
        datePublished: p.date,
        dateModified: p.updated,
        inLanguage: 'cs',
        ...(image && { image }),
        articleSection: cat.name,
        keywords: p.tags,
        mainEntityOfPage: url,
        isPartOf: { '@type': 'Blog', name: SITE.name, url: abs() },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE.name, item: abs() },
          { '@type': 'ListItem', position: 2, name: cat.name, item: abs(`?c=${cat.slug}`) },
          { '@type': 'ListItem', position: 3, name: p.title, item: url },
        ],
      },
    ],
  });
};

const notFoundPage = (posts) => {
  const rel = `${SITE.url}/`;
  return page({
    rel,
    kind: 'static',
    title: `Stránka nenalezena – ${SITE.name}`,
    description: 'Tato adresa neexistuje nebo byl článek přesunut.',
    path: '404.html',
    canonical: false,
    robots: 'noindex',
    content: `<div class="page">
    <div class="rail">
    ${headerHtml(rel, posts)}
    </div>
    <main id="main">
      <div class="feed-head"><h1>Stránka nenalezena</h1></div>
      <p class="lead">Tato adresa neexistuje nebo byl článek přesunut.</p>
      <a class="btn" href="${rel}">Zpět na články</a>
    </main>
  </div>`,
  });
};

const feedBody = (p) => {
  const base = abs(postPath(p));
  return `${p.cover ? `<p><img src="${base}${p.cover}" alt="${esc(p.coverAlt)}"></p>` : ''}${p.html
    .replace(/<a class="sn-ref"[^>]*>[^<]*<\/a>/g, '')
    .replace(/<aside\b[^>]*>([\s\S]*?)<\/aside>/g, '<blockquote>$1</blockquote>')
    .replace(/(src|href)="(?!https?:|mailto:|#|\/)([^"]+)"/g, `$1="${base}$2"`)}`;
};

const feedXml = (posts) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${SITE.name}</title>
    <link>${abs()}</link>
    <description>${esc(SITE.description)}</description>
    <language>cs</language>
    <lastBuildDate>${rfcDate(posts[0]?.date ?? '1970-01-01')}</lastBuildDate>
    <atom:link href="${abs('feed.xml')}" rel="self" type="application/rss+xml"/>
${posts
  .map(
    (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${abs(postPath(p))}</link>
      <guid isPermaLink="true">${abs(postPath(p))}</guid>
      <pubDate>${rfcDate(p.date)}</pubDate>
      <category>${esc(catOf(p).name)}</category>${p.tags.map((t) => `
      <category>${esc(t)}</category>`).join('')}
      <description>${esc(p.description)}</description>
      <content:encoded><![CDATA[${feedBody(p).replace(/\]\]>/g, ']]]]><![CDATA[>')}]]></content:encoded>
    </item>`,
  )
  .join('\n')}
  </channel>
</rss>
`;

const sitemapXml = (posts) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${abs()}</loc><lastmod>${posts[0]?.date ?? ''}</lastmod></url>
${posts.map((p) => `  <url><loc>${abs(postPath(p))}</loc><lastmod>${p.updated}</lastmod></url>`).join('\n')}
</urlset>
`;

const llmsTxt = (posts) => `# ${SITE.name}

> ${SITE.description}

## Články

${posts.map((p) => `- [${p.title}](${abs(postPath(p))}): ${p.description}`).join('\n')}

## Rubriky

${SITE.categories.filter((c) => posts.some((p) => p.category === c.slug)).map((c) => `- [${c.name}](${abs(`?c=${c.slug}`)})`).join('\n')}

## Odběr a mapa webu

- [RSS](${abs('feed.xml')})
- [Sitemap](${abs('sitemap.xml')})
`;

const huesCss = () => `${SITE.categories.map((c) => `[data-hue="${c.hue}"] { --hue: ${c.hue}; }`).join('\n')}\n`;

const securityTxt = () => `Contact: mailto:${SITE.author.email}
Expires: ${new Date(Date.now() + 364 * 86400000).toISOString().replace(/\.\d+Z$/, 'Z')}
Preferred-Languages: cs, en
Canonical: ${abs('.well-known/security.txt')}
`;

const robotsTxt = () => `User-agent: *
Allow: /

Sitemap: ${abs('sitemap.xml')}
`;

const fetchFonts = async () => {
  const dir = join(ROOT, 'assets/fonts');
  await mkdir(dir, { recursive: true });
  for (const [id, weights] of FONTS) {
    for (const subset of SUBSETS) {
      for (const weight of weights) {
        const name = fontFile(id, subset, weight);
        const res = await fetch(`https://cdn.jsdelivr.net/npm/@fontsource/${id}@${FONT_VERSION}/files/${name}`);
        if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
        await writeFile(join(dir, name), Buffer.from(await res.arrayBuffer()));
        console.log(`stažen ${name}`);
      }
    }
  }
};

const missingFonts = async () => {
  const missing = [];
  for (const [id, weights] of FONTS) {
    for (const subset of SUBSETS) {
      for (const weight of weights) {
        const name = fontFile(id, subset, weight);
        try {
          await access(join(ROOT, 'assets/fonts', name));
        } catch {
          missing.push(name);
        }
      }
    }
  }
  return missing;
};

const build = async () => {
  const { posts, errors } = await loadPosts();
  if (errors.length) {
    console.error(errors.map((e) => `CHYBA ${e}`).join('\n'));
    process.exit(1);
  }
  const out = (path, data) => writeFile(join(ROOT, path), data);
  await mkdir(join(ROOT, '.well-known'), { recursive: true });
  await Promise.all([
    ...posts.map((p) => out(`posts/${p.slug}/index.html`, postPage(p, posts))),
    homePage(posts).then((html) => out('index.html', html)),
    out('404.html', notFoundPage(posts)),
    out('feed.xml', feedXml(posts)),
    out('sitemap.xml', sitemapXml(posts)),
    out('llms.txt', llmsTxt(posts)),
    out('robots.txt', robotsTxt()),
    out('assets/css/hues.css', huesCss()),
    out('.well-known/security.txt', securityTxt()),
    out('.nojekyll', ''),
  ]);
  const missing = await missingFonts();
  if (missing.length) console.warn(`Chybí fonty (${missing.length}), spusť: node build-blog.mjs fonts`);
  console.log(`OK: ${posts.length} čl.`);
};

const [command = 'build'] = process.argv.slice(2);
if (command === 'fonts') await fetchFonts();
else if (command === 'build') await build();
else {
  console.error('Použití: node build-blog.mjs [build|fonts]');
  process.exit(1);
}
