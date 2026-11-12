// リフォーム補助金ナビ サイト生成スクリプト
// data/ のJSONを読んで dist/ にHTMLを書き出す。外部パッケージは使わない。
// 使い方: node build.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const national = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'national.json'), 'utf8'));

// ---- 工事カテゴリ（全国共通） ----
const CATS = [
  { id: 'mado', name: '窓・断熱', icon: 'M4 3h16v18H4z M12 3v18 M4 12h16' },
  { id: 'kyuto', name: '給湯器・エコキュート', icon: 'M8 2h8a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2z M10 15c0-2 2-3 2-5 0 2 2 3 2 5a2 2 0 01-4 0z' },
  { id: 'taiyo', name: '太陽光・蓄電池', icon: 'M12 2.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z M3 21l3-9h12l3 9z M9 12l-1.5 9 M15 12l1.5 9 M4.5 16.5h15' },
  { id: 'taishin', name: '耐震（古い木造住宅）', icon: 'M3 11l9-7 9 7 M5 10v11h14V10 M5 21l14-11 M5 10l14 11' },
  { id: 'mizu', name: 'お風呂・トイレ・キッチン', icon: 'M4 12h16v3a5 5 0 01-5 5H9a5 5 0 01-5-5z M6 12V5a2 2 0 014 0 M7 20l-1 2 M17 20l1 2' },
  { id: 'yane', name: '屋根・外壁・雨漏り', icon: 'M7 15a4 4 0 01-.5-8 5 5 0 019.6-1A4 4 0 0117 15 M9 18l-1 2 M13 18l-1 2 M17 18l-1 2' }
];

// ---- 便利関数 ----
const kuniHref = (p) => fs.existsSync(path.join(ROOT, 'src', 'kuni', `${p.slug}.html`)) ? `/kuni/${p.slug}/` : '#kuni';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ymd = (s) => s.replace(/-/g, '.');
const jdate = (s) => { const [y, m, d] = s.split('-').map(Number); return `${y}年${m}月${d}日`; };
const write = (rel, html) => {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
};
const affHref = () => config.affiliateUrl || '#mitsumori';
const svgArrow = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const svgCheck = (c) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c || 'currentColor'}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;margin-top:5px"><path d="M20 6L9 17l-5-5"/></svg>`;
const svgWarn = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;margin-top:4px"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>';
const stamp = (date) => `<svg class="stamp" viewBox="0 0 104 104" width="100" height="100" role="img" aria-label="${jdate(date)} 確認済み"><circle cx="52" cy="52" r="48" fill="#fff" fill-opacity=".9" stroke="#BF3324" stroke-width="2.6"/><path d="M5.6 40h92.8M5.6 64h92.8" stroke="#BF3324" stroke-width="1.6"/><text x="52" y="32" text-anchor="middle" font-family="Shippori Mincho, serif" font-weight="800" font-size="15" letter-spacing="2" fill="#BF3324">確認済</text><text x="52" y="57.5" text-anchor="middle" font-family="Shippori Mincho, serif" font-weight="800" font-size="15.5" fill="#BF3324">${ymd(date)}</text><text x="52" y="81" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="10.5" fill="#BF3324">補助金ナビ</text></svg>`;

// ---- 共通の外枠 ----
function layout({ title, description, canonical, body, jsonld, noindex }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${config.siteUrl}${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${config.siteUrl}${canonical}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@700;800&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>
<header class="site-head"><div class="wrap">
<a class="logo" href="/"><span class="logo-mark"><span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg></span></span><span class="logo-text"><b>${esc(config.siteName)}</b><small>市区町村の補助金を、工事ごとにかんたん検索</small></span></a>
<a class="btn-shu" href="#mitsumori">無料見積もり</a>
</div></header>
${body}
<footer class="site-foot"><div class="wrap">
<b>${esc(config.siteName)}</b>
<p>金額・期間は変わることがあるため、申請前に必ず公式情報をご確認ください。</p>
<p>当サイトはアフィリエイト広告（PR）を利用しています。</p>
<p><a href="/">トップ</a></p>
</div></footer>
</body>
</html>`;
}

function ctaBlock(heading, button) {
  return `<section id="mitsumori" class="cta" aria-labelledby="h-cta">
<div class="l"><span class="pr">PR</span>
<h2 id="h-cta">${heading}</h2>
<ul class="checks"><li>${svgCheck('var(--accent)')}<span>補助金が使えるかも一緒に相談できる</span></li><li>${svgCheck('var(--accent)')}<span>複数社を比べて適正価格がわかる</span></li><li>${svgCheck('var(--accent)')}<span>断っても費用は0円</span></li></ul></div>
<div class="r"><a class="btn-shu" href="${esc(affHref())}" rel="sponsored noopener">${button} ${svgArrow}</a>
${config.affiliateUrl ? '' : '<p class="small muted" style="text-align:center">[アフィリエイトリンク未設定]</p>'}</div>
</section>`;
}

const secHead = (id, title, sub) => `<div class="sec-head"><h2 id="${id}">${title}</h2>${sub ? `<span class="small muted">${sub}</span>` : ''}</div>`;

// ---- 市区町村ページ ----
function cityPage(city, allCities) {
  const url = `/${city.prefSlug}/${city.slug}/`;
  const natByCat = (cat) => national.programs.filter((p) => p.cats.includes(cat));
  const cityMax = Math.max(0, ...city.programs.map((p) => p.maxNumber || 0));
  const natMax = Math.max(0, ...national.programs.map((p) => p.maxNumber || 0));

  // 工事カテゴリごとの結果データ（ブラウザ側のJSで使う）
  const pickData = CATS.map((c) => {
    const cityRows = city.programs.filter((p) => p.cats.includes(c.id)).map((p) => ({ name: p.name, amt: p.amountLabel, note: (p.catNotes && p.catNotes[c.id]) || p.summary, href: `#p-${p.id}` }));
    const kuniRows = natByCat(c.id).map((p) => ({ name: p.name, amt: p.maxLabel, note: p.target, href: kuniHref(p) }));
    if (c.id === 'yane') kuniRows.push({ name: '国の省エネリフォーム補助', amt: '断熱と一緒なら', note: '断熱の工事と一緒に行う場合に、対象になることがあります。くわしい条件は各制度のページへ。', href: kuniHref(national.programs.find((x) => x.id === 'mirai')) });
    const sumParts = [];
    if (cityRows.length) sumParts.push('市 あり');
    if (kuniRows.length) sumParts.push('国 あり');
    return {
      id: c.id, name: c.name,
      sum: sumParts.join(' ／ ') || '掲載中の制度なし',
      city: cityRows, kuni: kuniRows,
      cityNone: (city.noCityNote && city.noCityNote[c.id]) || 'このページに掲載している市の制度には、該当するものがありません。',
      kuniNone: 'このページに掲載している国の制度には、該当するものがありません。'
    };
  });

  const catButtons = CATS.map((c, i) => `<button type="button" class="cat" data-cat="${c.id}" aria-pressed="${i === 0}"><span class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${c.icon}"/></svg></span><span class="tx"><b>${esc(c.name)}</b><small>${esc(pickData[i].sum)}</small></span><svg class="ck" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg></button>`).join('');

  const programs = city.programs.map((p) => {
    const status = p.status === 'open'
      ? '<span class="st-open"><i aria-hidden="true"></i>受付中</span>'
      : `<span class="st-check">${esc(p.statusLabel || '受付状況 [要確認]')}</span>`;
    const flow = p.timing === 'before'
      ? '<span class="s dark">申請（工事の前）</span>→<span class="s">工事</span>'
      : '<span class="s">設置（工事）</span>→<span class="s dark">申請（設置のあと）</span>';
    return `<article id="p-${p.id}" class="prog" data-cats="${p.cats.join(' ')}">
<div style="display:flex;flex-direction:column;gap:10px"><div class="prog-tags">${status}<span class="small muted" style="font-weight:700">市の制度</span></div>
<h3>${esc(p.name)}</h3><p style="color:var(--ink2)">${esc(p.summary)}</p></div>
${p.tags ? `<div style="display:flex;flex-direction:column;gap:8px"><span class="small muted" style="font-weight:700">対象になる設備</span><ul class="pills">${p.tags.map((t) => `<li class="pill">${esc(t)}</li>`).join('')}</ul></div>` : ''}
${p.tiers ? `<ol class="tiers">${p.tiers.map((t, i) => `<li${t.highlight ? ' class="hl"' : ''}><b>${i + 1}. ${esc(t.label)}</b><span class="n">${esc(t.amount)}<small>${esc(t.unit)}</small></span><span style="font-size:15px" class="muted">${esc(t.note)}</span></li>`).join('')}</ol>` : ''}
${p.details ? `<dl class="kv">${p.details.map((d) => `<div><dt>${esc(d.k)}</dt><dd>${esc(d.v)}</dd></div>`).join('')}</dl>` : ''}
<div class="flow"><span class="small muted" style="font-weight:700">申請のタイミング</span>${flow}</div>
${p.warning ? `<div class="warn">${svgWarn}<span>${esc(p.warning)}</span></div>` : ''}
${p.source ? `<p class="small muted">出典：<a href="${esc(p.source)}" rel="nofollow noopener">${esc(p.sourceName || '公式情報')}</a></p>` : ''}
</article>`;
  }).join('\n');

  const natList = national.programs.map((p) => `<li><span style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:2px"><a class="serif" style="font-size:22px;line-height:1.5" href="${kuniHref(p)}">${esc(p.name)}</a><span style="font-size:16px;color:var(--ink2)">${esc(p.target)}</span></span><span style="display:flex;align-items:baseline;gap:8px"><span class="muted" style="font-weight:700;font-size:15px">最大</span><span class="big">${p.maxNumber}<small>万円</small></span></span></li>`).join('');

  const neighbors = (city.neighbors || []).map((n) => {
    const hit = allCities.find((c) => c.name === n);
    return hit ? `<a class="nb" href="/${hit.prefSlug}/${hit.slug}/"><i aria-hidden="true"></i>${esc(n)} →</a>` : '';
  }).join('');

  const title = `${city.name}のリフォーム補助金まとめ【2026年度】｜${config.siteName}`;
  const description = `${city.pref}${city.name}で使えるリフォーム補助金を、市と国の制度をあわせて工事ごとに整理。窓・給湯器・太陽光・耐震など、使える補助金と申請の時期がすぐわかります。`;

  const body = `<div class="hero"><div class="wrap">
<div class="crumbs"><nav aria-label="パンくずリスト"><a href="/">トップ</a> › <a href="/${city.prefSlug}/">${esc(city.pref)}</a> › ${esc(city.name)}</nav><span>当サイトはアフィリエイト広告（PR）を利用しています</span></div>
<div class="hero-row"><div class="hero-main">
<div class="hero-title"><div class="plate" aria-hidden="true"><div><i></i><span class="p">${esc(city.pref)}</span><span class="c">${esc(city.name)}</span><i></i></div></div>
<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:16px;padding-top:4px"><span class="small muted" style="font-weight:700;letter-spacing:.08em">2026年度版 ／ 市と国の制度を1ページに</span>
<h1><span style="display:block">${esc(city.name)}の</span><span class="ib">リフォーム補助金</span><span class="ib">まとめ<span class="yr">2026年度</span></span></h1>
<p style="color:var(--ink2);max-width:520px">市と国の制度を1ページに整理しました。やりたい工事を選ぶだけで、使える補助金がわかります。</p></div></div>
<div class="btn-row"><a class="btn-ink" href="#sagasu">やりたい工事から調べる</a><a class="btn-line" href="#mitsumori">補助金が使えるか無料で見積もり ${svgArrow}</a></div>
</div>
<div class="ledger">${stamp(city.checked)}<p class="small muted" style="font-weight:700;margin:0 96px 14px 0;letter-spacing:.06em">${esc(city.name)}のあらまし</p>
<dl><div><dt>市の制度</dt><span class="dots" aria-hidden="true"></span><dd>${esc(city.programCountLabel || city.programs.length + '件')}</dd></div>
${cityMax ? `<div><dt>市の補助 <span class="small muted">最大</span></dt><span class="dots" aria-hidden="true"></span><dd>${cityMax}<small>万円</small></dd></div>` : ''}
<div><dt>国の補助 <span class="small muted">最大</span></dt><span class="dots" aria-hidden="true"></span><dd>${natMax}<small>万円</small></dd></div></dl>
<p class="small muted" style="margin-top:14px">情報の確認日：${jdate(city.checked)}</p></div>
</div></div></div>

<main class="wrap">
<section id="sagasu" aria-labelledby="h-sagasu">${secHead('h-sagasu', 'やりたい工事から探す', '工事を押すと、使える制度が下に出ます')}
<div class="cats" role="group" aria-label="工事の種類">${catButtons}</div>
<div class="result" aria-live="polite"><div class="result-head"><span class="small" style="font-weight:700">${esc(city.name)}で</span><h3 id="pick-title"></h3></div>
<div class="result-body"><div class="result-col"><div class="col-head"><span class="badge-city">市</span>${esc(city.name)}の制度</div><div id="pick-city"></div></div>
<div class="result-col"><div class="col-head"><span class="badge-kuni">国</span>国の制度（全国共通）</div><div id="pick-kuni"></div></div></div>
<div class="result-foot"><span>自分の家の工事が対象になるかは、見積もりのときに確認できます。</span><a href="#mitsumori">無料の見積もりで確認する →</a></div></div>
</section>

<section id="city" aria-labelledby="h-city">${secHead('h-city', `${esc(city.name)}の補助金`, '市が独自に行っている制度')}
${programs}
</section>

<section id="kuni" aria-labelledby="h-kuni">${secHead('h-kuni', `${esc(city.name)}でも使える国の補助金`, '住宅省エネ2026キャンペーン')}
<p style="color:var(--ink2)">国の制度は全国共通です。市の補助金と組み合わせられる場合もあります。くわしくは各制度のページへ。</p>
<ul class="nat">${natList}</ul>
</section>

<section aria-labelledby="h-flow">${secHead('h-flow', '申請の流れ', '見積もりから入金まで')}
<ol class="steps"><li><span class="no">1</span><b>見積もりをとる</b><span class="small muted">対象の工事か確認</span></li><li><span class="no">2</span><b>申請する</b><span class="small muted">工事の前か後かは制度しだい</span></li><li><span class="no">3</span><b>交付決定</b><span class="small muted">通知が届く</span></li><li><span class="no">4</span><b>工事</b><span class="small muted">写真を残しておく</span></li><li><span class="no">5</span><b>報告・入金</b><span class="small muted">完了報告のあと振込</span></li></ol>
</section>

${ctaBlock(`<span class="ib">${esc(city.name)}対応のリフォーム会社に</span><span class="ib">まとめて無料で見積もり</span>`, '無料で見積もりをとる')}

<section aria-labelledby="h-area">${secHead('h-area', `対応エリア（${esc(city.name)}）`, '町名の一覧')}
${(city.towns || []).length ? `<ul class="towns">${city.towns.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
${neighbors ? `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px"><span class="muted" style="font-size:15px">となりの市・町の補助金：</span>${neighbors}</div>` : ''}
</section>

<section aria-labelledby="h-faq">${secHead('h-faq', 'よくある質問')}
<dl class="faq"><div><dt><span class="q" aria-hidden="true">Q</span><span>市の補助金と国の補助金は一緒に使えますか？</span></dt><dd><span class="a" aria-hidden="true">A</span><span>同じ工事に二重で出ない決まりのものもあります。工事ごとに分ければ使える場合があるので、見積もりのときに相談しましょう。</span></dd></div>
<div><dt><span class="q" aria-hidden="true">Q</span><span>工事が終わってから申請できますか？</span></dt><dd><span class="a" aria-hidden="true">A</span><span>制度によります。各制度の「申請のタイミング」を確認してください。</span></dd></div></dl>
</section>
</main>
<script>window.PICK=${JSON.stringify(pickData).replace(/</g, '\\u003c')};</script>
<script src="/picker.js" defer></script>`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'トップ', item: config.siteUrl + '/' },
      { '@type': 'ListItem', position: 2, name: city.pref, item: `${config.siteUrl}/${city.prefSlug}/` },
      { '@type': 'ListItem', position: 3, name: city.name, item: config.siteUrl + url }
    ]
  };
  const thin = !city.programs.length;
  write(`${city.prefSlug}/${city.slug}/index.html`, layout({ title, description, canonical: url, body, jsonld, noindex: thin }));
  return thin ? null : url;
}

// ---- 都道府県ページ ----
function prefPage(prefSlug, pref, cities) {
  const url = `/${prefSlug}/`;
  const body = `<div class="hero"><div class="wrap"><div class="crumbs"><nav aria-label="パンくずリスト"><a href="/">トップ</a> › ${esc(pref)}</nav></div>
<h1>${esc(pref)}のリフォーム補助金<span class="yr">2026年度</span></h1><p style="color:var(--ink2)">市区町村を選ぶと、その地域で使える補助金がわかります。</p></div></div>
<main class="wrap"><section aria-labelledby="h-list">${secHead('h-list', '市区町村から探す')}
<div style="display:flex;flex-wrap:wrap;gap:10px">${cities.map((c) => `<a class="nb" href="/${c.prefSlug}/${c.slug}/"><i aria-hidden="true"></i>${esc(c.name)} →</a>`).join('')}</div></section></main>`;
  write(`${prefSlug}/index.html`, layout({ title: `${pref}のリフォーム補助金まとめ【2026年度】｜${config.siteName}`, description: `${pref}の市区町村ごとに、リフォームに使える補助金をまとめています。`, canonical: url, body }));
  return url;
}

// ---- 国の制度ページ（本文は src/kuni/<slug>.html） ----
function kuniPage(p) {
  const file = path.join(ROOT, 'src', 'kuni', `${p.slug}.html`);
  if (!fs.existsSync(file)) return null;
  const url = `/kuni/${p.slug}/`;
  const inner = fs.readFileSync(file, 'utf8').replace(/\{\{CTA\}\}/g, ctaBlock('<span class="ib">締め切りに間に合う業者を、</span><span class="ib">まとめて無料で探す</span>', '見積もりをとる')).replace(/\{\{STAMP\}\}/g, stamp(national.checked));
  write(`kuni/${p.slug}/index.html`, layout({ title: `${p.name}事業とは？補助額・期限・申請方法｜${config.siteName}`, description: `${p.name}事業の対象工事、補助額、申請期限、ほかの補助金との併用をわかりやすく整理しました。`, canonical: url, body: inner }));
  return url;
}

// ---- トップページ ----
function topPage(prefs) {
  const body = `<div class="hero"><div class="wrap">
<h1>リフォーム補助金を、<span class="ib">住んでいる市から探す</span></h1>
<p style="color:var(--ink2);max-width:640px">市区町村と国の補助金を、窓・給湯器・耐震など工事ごとに整理しています。お住まいの地域を選んでください。</p></div></div>
<main class="wrap">
<section aria-labelledby="h-pref">${secHead('h-pref', '都道府県から探す')}
<div style="display:flex;flex-wrap:wrap;gap:10px">${prefs.map((p) => `<a class="nb" href="/${p.slug}/"><i aria-hidden="true"></i>${esc(p.name)} →</a>`).join('')}</div></section>
<section aria-labelledby="h-kuni">${secHead('h-kuni', '全国で使える国の補助金')}
<ul class="nat">${national.programs.map((p) => `<li><span style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:2px"><a class="serif" style="font-size:22px" href="${kuniHref(p)}">${esc(p.name)}</a><span style="font-size:16px;color:var(--ink2)">${esc(p.target)}</span></span><span class="big">${p.maxNumber}<small>万円</small></span></li>`).join('')}</ul></section>
</main>`;
  write('index.html', layout({ title: `${config.siteName}｜市区町村のリフォーム補助金を工事ごとにかんたん検索`, description: '市区町村と国のリフォーム補助金を、窓・給湯器・耐震など工事ごとに整理。住んでいる市から使える補助金がすぐわかります。', canonical: '/', body }));
}

// ---- 実行 ----
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'src', 'style.css'), path.join(DIST, 'style.css'));
fs.copyFileSync(path.join(ROOT, 'src', 'picker.js'), path.join(DIST, 'picker.js'));

const citiesDir = path.join(ROOT, 'data', 'cities');
const allCities = [];
for (const pref of fs.readdirSync(citiesDir)) {
  for (const f of fs.readdirSync(path.join(citiesDir, pref))) {
    if (f.endsWith('.json')) allCities.push(JSON.parse(fs.readFileSync(path.join(citiesDir, pref, f), 'utf8')));
  }
}
const urls = ['/'];
const prefMap = new Map();
for (const c of allCities) {
  const u = cityPage(c, allCities);
  if (u) urls.push(u);
  if (!prefMap.has(c.prefSlug)) prefMap.set(c.prefSlug, { slug: c.prefSlug, name: c.pref, cities: [] });
  prefMap.get(c.prefSlug).cities.push(c);
}
for (const p of prefMap.values()) urls.push(prefPage(p.slug, p.name, p.cities));
for (const p of national.programs) { const u = kuniPage(p); if (u) urls.push(u); }
topPage([...prefMap.values()]);

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${config.siteUrl}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
write('404.html', layout({ title: `ページが見つかりません｜${config.siteName}`, description: 'ページが見つかりません', canonical: '/404', body: '<main class="wrap"><section><h1>ページが見つかりません</h1><p><a href="/">トップへ戻る</a></p></section></main>' }));
console.log(`生成完了: ${urls.length}ページ（市区町村 ${allCities.length}）`);
