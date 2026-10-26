# Jak vytvořit článek (pro AI)

Vstup: text uživatele nebo Typst/PDF + grafy (PNG/SVG). Výstup: složka `posts/<slug>/` s **jediným ručně psaným souborem `article.html`** (front matter + tělo) a obrázky. **Nečti jiné články ani CSS/JS**, vše potřebné je tady. Mluv česky, stručně.

## Postup
1. **Slug**: ASCII, malá písmena, pomlčky (`prvni-mereni-zvonek-flipper`) = název složky. Rubriku vyber ze `SITE.categories` v `build-blog.mjs` (jen `slug`y). Datum: z textu, jinak dnešní, `RRRR-MM-DD`.
2. **Text**: věrně převeď obsah, nepřidávej fakta, zdroje ani citace. Nevyplňuj, co ve zdroji není. Typst `==` → `<h2 id>`, `*x*` → `<strong>`, `#figure` → `<figure>`, tabulku zachovej. Nesmyslné nebo rozporné věty **neopravuj tiše**, nahlas je uživateli.
3. **Obrázky**: zkopíruj jako `cover.png` (1200×630) a `fig-N.png` do `posts/<slug>/`. Grafy mají světlé pozadí a vlastní titulek a osy.
4. **Napiš** `posts/<slug>/article.html` podle kostry níže.
5. **Spusť** `node build-blog.mjs`: zkontroluje chyby, doplní nbsp, rozměry obrázků, dobu čtení, obsah, další články a SEO a vygeneruje `index.html` článku, hlavní stránku, `feed.xml`, `sitemap.xml`, `llms.txt`, `robots.txt`, `404.html`. Opravuj, dokud nevypíše `OK`. Vygenerované soubory ručně neupravuj.
6. V odpovědi uveď: slug, rubriku, předpoklady, co jsi nahlásil. Necommituj.

## Pravidla obsahu (build jiné prvky odmítne)
- Povoleno: `h2` (kapitoly, bez podkapitol), `p`, `ul`, `ol`, `strong`, `em`, `figure`, `aside.note`, `ol.refs`. Nic jiného: žádné odkazy v textu, inline kód, rovnice, citace ani `[^1]`.
- Do těla nepatří hlavička, kicker, datum, obsah ani „další články“, build je přidá. Žádný abstrakt, autor, „řada“.
- Popisek je vždy **pod** v `<figcaption>`, jedinečný. `figure.fig` = Obr. (i grafy), `figure.tab` = Tab., `figure.code` = Kód. V textu píšeš „obr. 1“, „tab. 1“, „kód 1“ (pořadí hlídá build).
- `<img>`: stačí `src` a `alt`. Rozměry (PNG), `loading` a `decoding` doplní build.
- Každé `<h2>` má `id`. Poslední kapitola „Zdroje“ má `class="nonum"`.
- Kód: `<figure class="code"><pre><code>` ručně obarvený `<span class="k|f|s|n|b|c">` (klíčové slovo, funkce, řetězec, číslo, builtin, komentář). Žádné knihovny.
- Pravý sloupec: v textu `<a class="sn-ref" href="#n1"></a>` (prázdný, číslo doplní build), hned za odstavcem `<aside class="note" id="n1">…</aside>`. Varianty `note def` (definice) a `note author` (komentář autora). Jedna poznámka = jeden odstavec, dvě za sebou nejdou. Číslují se jednotně.
- Zdroje: `<a class="cite" href="#ref-1"></a>` (prázdný, zobrazí se `[•]`) ↔ `<li id="ref-1"><span>Zdroj</span></li>` v `<ol class="refs">` pod `<h2 id="zdroje" class="nonum">Zdroje</h2>`. Jen skutečné zdroje ze vstupu; odkaz smí být jen uvnitř zdroje.
- Typografie: české uvozovky „ “, pomlčka –, minus −. Pevné mezery doplní build.

## Kostra `posts/<slug>/article.html`
```html
---
title: [Název]
description: [1–2 věty, max. ~160 znaků, z obsahu; je to i perex na hlavní stránce a v RSS]
date: [RRRR-MM-DD]
category: [slug rubriky]
tags: [tag1, tag2, tag3]
cover: cover.png
cover-alt: [popis obrázku]
---
<h2 id="[kapitola]">[Kapitola]</h2>
<p>[Text s <strong>důrazem</strong> a odkazem na obr. 1.]</p>
<figure class="fig">
  <img src="fig-1.png" alt="[popis]">
  <figcaption>[Jedinečný popisek.]</figcaption>
</figure>
<figure class="tab">
  <div class="table-wrap"><table>
    <thead><tr><th>[A]</th><th class="num">[B]</th></tr></thead>
    <tbody><tr><td>[…]</td><td class="num">[…]</td></tr></tbody>
  </table></div>
  <figcaption>[Popisek tabulky.]</figcaption>
</figure>
```
Volitelné klíče: `updated: RRRR-MM-DD`, `cover:` prázdné = článek bez obrázku (pak `cover-alt` není potřeba).

## Kontrola před odevzdáním
`node build-blog.mjs` končí `OK` · každá kapitola má `id` · každý `figure` má `figcaption` · odkazy „obr./tab./kód N“ odpovídají pořadí · nic nebylo vymyšleno · nesrovnalosti zdroje jsou nahlášeny.
