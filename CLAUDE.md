# SimpleBlog

Osobní blog Martina Žůrka (GitHub Pages, repo `ZurekMartin/SimpleBlog`, placeholder doména `blog.zurekmartin.cz`, ověřit). Ručně psané HTML/CSS/JS, **bez frameworku, bundleru a npm**. Sdílí paletu a styl s rodinou „Simple…“. Komunikace česky, stručně. **Nic necommituj ani nepushuj bez vyžádání. Nikdy nepřidávej komentáře do kódu** Nevymýšlej citace, zdroje ani fakta. Nikdy nekontroluj build ani vzhled, vse kontroluji sam.

Pomocne skripty musí být v hlavní složce a ve stylu: build-blog.mjs abych si je jednoduse mohl pretahnout do private repozitare. Tento soubor musi obsahovat vse pro aktualizaci vsech souboru v blogu.

## Struktura
```
build-blog.mjs            konfigurace (SITE), šablony a build; jediný skript, stačí ho přetáhnout jinam
POST.md                   návod pro psaní článků
posts/<slug>/article.html ZDROJ článku: front matter + tělo (jediný soubor, který se píše ručně)
posts/<slug>/*.png        obrázky článku (cover.png, fig-N.png)
assets/css/               core.css (tokeny, layout, header, patička), home.css, post.css
assets/js/                boot.js (blokující: motiv + třída js), site.js, head.js, home.js, post.js
assets/fonts/             woff2 (stahuje `node build-blog.mjs fonts`)
assets/img/               favicon.png, profile.png
GENEROVANÉ (neupravovat): index.html, 404.html, posts/<slug>/index.html, feed.xml, sitemap.xml, llms.txt, robots.txt
```
- `node build-blog.mjs` přegeneruje vše; `node build-blog.mjs fonts` stáhne fonty (@fontsource). `SITE=https://… node build-blog.mjs` přepíše doménu.
- Rubriky, bio, patička a velikost stránky jsou v `SITE` na začátku `build-blog.mjs`.
- Tečkovaný papír (jednotka `--pad`, rozteč teček, mřížka posunutá o 0.5px). Pravidla rytmu:
  - Řádek textu = jeden řádek mřížky (`line-height: --pad`), písmo vždy menší než `--pad`. Základní linka sedí na spodní řadě teček s drobnou mezerou `--gap` nad ní (posun `--d-text/-ui/-head/-title` = `padding-top` + záporný `margin-bottom`, spočítaný z metrik fontů). Text nikdy nezaplní celou výšku řádku.
  - Čára patří přímo pod text, který na ní „stojí“ (kapitola, titulek seznamu, řádek menu, řádek tabulky, záznam na hlavní stránce); horní čára začíná skupinu (hlavičky sloupců, poznámka, kód). Čáry se kreslí `box-shadow` (shora `inset 0 1px 0`, zdola `0 1px 0`), nikdy `border`, aby ležely na tečkách a nehýbaly obsahem.
  - Mezery: mezi odstavci a bloky jeden prázdný řádek, mezi kapitolou (čára) a jejím textem žádný. Prázdný řádek jen tam, kde odděluje význam, jinak ne.
  - Výjimky bez zarovnání na spodní linku: ovládací prvky (tlačítka, stránkování, přepínač) mají výšku jednoho řádku s rámem na tečkách a text vystředěný; obrázky, tabulky a kód vyplní šířku a `snap.js` je vystředí do celých řádků (`--fit`); sticky obsah.
  - Sloupce se zaokrouhlují na `--pad` přes `round()`.
- Velikosti písma jen `--t-l`, `--t-m`, `--t-s`.

## Technická pravidla
- Moderní standardy: `oklch()`, `light-dark()`, MathML, ES moduly...
- Fungovat musí světlý, tmavý i systémový režim.
- Zákaz: knihoven na zvýraznění kódu (ručně třídy `k f s n b c` v `<pre><code>`), inline SVG grafů/dekorací (grafy = `<img>`), nových závislostí a generátorů (Jekyll, Astro…).
- SEO, indexace (robots, sitemap, llms.txt, JSON-LD).
- Přístupnost: skip link, landmarky (`header`, `main`, `footer`), ovládací prvky bez `role=radio`, skryté panely mají `visibility: hidden`, obsah nesmí záviset na JS (články jsou statické). Respektuj `prefers-reduced-motion`, animace jemné.

## Design (neměnné)
- Redakční (novinářský) minimalismus, obsah nad formou. **Žádné plovoucí karty/boxy se šedým pozadím a zaoblenými rohy**. Žádné efekty, glow, gradienty. Pozadí: jedna nenápadná tečkovaná mřížka. Značky rubrik jsou čtverce (ne kruhy), ovládací prvky obdélníkové. Bez podtrzitek za slovy. bez badgu, vyuzivat striktne markdown a latex/typst drobne znaky jako jsou hashtagy, @, ...
- Třísloupcový vystředěný layout (boční sloupce stejně široké, prostřední širší), pod urcite rozliseni boční mezery ze vsech stran stejne. Header je plne sirky, obsah i bio jsou šířky mensi, ktera odpovida sirce kontejneru header pro jeho obsah.
- Odstavce a seznamy v článku `justify` ve všech zobrazeních (i mobil). Kapitoly (`h2`) vlevo. **Hlavička článku (kicker, h1, datum · doba čtení) je vždy na střed.** Na mobilu (≤640 px) jsou na střed i náhledy zápisků v seznamu (kromě řádku s datem a štítkem). Popisky, náhledy dalších článků, bio a patička na střed. Mezery mezi kapitolami malé.

## Obsah článku (povolené prvky, build jiné odmítne)
- Kapitoly `h2` (bez podkapitol), odstavce, odrážkový a číslovaný seznam, bold a kurzíva (`strong`, `em`).
- Pravý sloupec: komentář autora, poznámka, definice, číslované jednotně dohromady; v textu odkaz horním indexem. Zdroje se v textu i dole značí symbolem `[•]` místo čísla (obsah ukáže náhled po najetí).
- Obrázek (i graf) `Obr. N:`, tabulka `Tab. N:`, kód `Kód N:` (Lekton), popisek vždy pod.
- Nikdy: citace, poznámky `[^1]`, odkazy v textu, inline kód, rovnice, podkapitoly.

## Komponenty
- **Header** (levý sloupec, bez pozadí). stejný všude: brand „SimpleBlog“, rubriky (bez podrubrik), RSS, přepínač režimu. **Není sticky.** Rubriky jsou řádky oddělené čárou se čtvercovou značkou. **Zobrazují se vždy všechny rubriky, i prázdné.** Podrubriky neexistují.
- **Obsah článku** (pod headerem, bez pozadí) je **jediný sticky** prvek; aktuální kapitola jen jemně odsazená, musi fungovat az po posledni kapitolu pokud je clanek uplne scrollvany dolu.
- **Hlavní stránka**: řádky oddělené čárou: datum `d. m. rrrr` vlevo, štítek rubriky, název, popis, doba čtení, až 3 `#tagy`. Žádná svislá linka ani uzly. Na mobilu je štítek na konci řádku s datem a zbytek na střed. Filtr v url adrese, stránkování po 8, max. 3 čísla stránek (moznost ale zvolit rychle prvni a posledni), jen při >1 stránce.
- **Bio** (pravý sloupec, na mobilu pod seznamem): `profile.png`, Martin Žůrek, „Cybersecurity Student & Junior Software Engineer“, web portfolia, e‑mail. Samostatná bio stránka **neexistuje**. **Autor se u článků nikde neuvádí.**
- **Patička** vystředěná, vždy dole s pozadim jedne barvy aby byla nad pozadim stranky. „Martin Žůrek“ (https://www.zurekmartin.cz) · „GitHub“ (https://github.com/ZurekMartin/SimpleBlog).
- **Kód**: tlačítko kopírování je ikona, zobrazí se při najetí.
- **Poznamky v textu** vzdy pri hover nebo v mobilnim zobrazeni kliknuti prejedou a zvyrazni poznamku na boku/pod sekci

## Fonty
- Jen tři, vlastní hosting (`assets/fonts`, woff2): **Cutive Mono** (patkový, celý text blogu a nadpisy), **Lekton** (bezpatkový, celé rozhraní: menu, meta, poznámky, popisky, tabulky, kód), **Doto** (jen titulek projektu „SimpleBlog“). VT323 se nepoužívá.
- Maximálně 3 velikosti: `--t-l` nadpisy, `--t-m` text, `--t-s` vše ostatní.
