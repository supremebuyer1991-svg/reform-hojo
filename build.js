// リフォーム補助金ナビ サイト生成スクリプト
// data/ のJSONを読んで dist/ にHTMLを書き出す。外部パッケージは使わない。
// 使い方: node build.js   （BUILD_DATE=2026-12-01 node build.js で「今日」を指定できる）
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const config = readJson(path.join(ROOT, 'config.json'));
const national = readJson(path.join(ROOT, 'data', 'national.json'));
const progress = readJson(path.join(ROOT, 'data', 'progress.json'));

const SITE = config.siteUrl.replace(/\/$/, '');
const FY = String(config.fiscalYear || '2026');
const FY_LABEL = `${FY}年度`;
// ビルドした日（日本時間）。受付終了の判定に使う。
const TODAY = process.env.BUILD_DATE || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
// 都道府県×工事ページを作るのに必要な、その工事の制度がある市区町村の数
const MIN_CAT_CITIES = 3;
const warnings = [];
const errors = [];

// ---- 工事カテゴリ（全国共通） ----
// name: ボタンの表示名 / short: タイトル用の短い名前 / h: 見出し用（「〇〇市の{h}の補助金」）
const CATS = [
  { id: 'mado', name: '窓・断熱', short: '窓', h: '窓・断熱リフォーム', icon: 'M4 3h16v18H4z M12 3v18 M4 12h16' },
  { id: 'kyuto', name: '給湯器・エコキュート', short: '給湯器', h: '給湯器・エコキュート', icon: 'M8 2h8a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2z M10 15c0-2 2-3 2-5 0 2 2 3 2 5a2 2 0 01-4 0z' },
  { id: 'taiyo', name: '太陽光・蓄電池', short: '太陽光', h: '太陽光・蓄電池', icon: 'M12 2.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z M3 21l3-9h12l3 9z M9 12l-1.5 9 M15 12l1.5 9 M4.5 16.5h15' },
  { id: 'taishin', name: '耐震（古い木造住宅）', short: '耐震', h: '耐震診断・耐震改修', icon: 'M3 11l9-7 9 7 M5 10v11h14V10 M5 21l14-11 M5 10l14 11' },
  { id: 'mizu', name: 'お風呂・トイレ・キッチン', short: '水まわり', h: 'お風呂・トイレ・キッチン', icon: 'M4 12h16v3a5 5 0 01-5 5H9a5 5 0 01-5-5z M6 12V5a2 2 0 014 0 M7 20l-1 2 M17 20l1 2' },
  { id: 'yane', name: '屋根・外壁・雨漏り', short: '外壁', h: '屋根・外壁塗装', icon: 'M7 15a4 4 0 01-.5-8 5 5 0 019.6-1A4 4 0 0117 15 M9 18l-1 2 M13 18l-1 2 M17 18l-1 2' }
];
const CAT_IDS = CATS.map((c) => c.id);
const REGIONS = [
  ['北海道・東北', ['hokkaido', 'aomori', 'iwate', 'miyagi', 'akita', 'yamagata', 'fukushima']],
  ['関東', ['ibaraki', 'tochigi', 'gunma', 'saitama', 'chiba', 'tokyo', 'kanagawa']],
  ['中部', ['niigata', 'toyama', 'ishikawa', 'fukui', 'yamanashi', 'nagano', 'gifu', 'shizuoka', 'aichi']],
  ['近畿', ['mie', 'shiga', 'kyoto', 'osaka', 'hyogo', 'nara', 'wakayama']],
  ['中国・四国', ['tottori', 'shimane', 'okayama', 'hiroshima', 'yamaguchi', 'tokushima', 'kagawa', 'ehime', 'kochi']],
  ['九州・沖縄', ['fukuoka', 'saga', 'nagasaki', 'kumamoto', 'oita', 'miyazaki', 'kagoshima', 'okinawa']]
];

// ---- 便利関数 ----
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const ymd = (s) => s.replace(/-/g, '.');
const jdate = (s) => { const [y, m, d] = s.split('-').map(Number); return `${y}年${m}月${d}日`; };
const timeTag = (s) => `<time datetime="${s}">${jdate(s)}</time>`;
const maxDate = (list) => list.filter(isDate).sort().pop() || TODAY;
const write = (rel, html) => {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
};
const hasKuniPage = (p) => fs.existsSync(path.join(ROOT, 'src', 'kuni', `${p.slug}.html`));
const kuniHref = (p) => (hasKuniPage(p) ? `/kuni/${p.slug}/` : null);
const affHref = () => config.affiliateUrl || '#mitsumori';
// 出典が公式（自治体・国）かどうか。データに sourceOfficial があればそれを優先する。
const isOfficialUrl = (u) => { try { const h = new URL(u).hostname; return /\.(lg|go)\.jp$/.test(h) || /(^|\.)(city|town|vill|pref|metro)\.[a-z0-9.-]+\.jp$/.test(h); } catch (e) { return false; } };
const isOfficial = (p) => (p.sourceOfficial != null ? !!p.sourceOfficial : isOfficialUrl(p.source));
const svgArrow = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const svgCheck = (c) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c || 'currentColor'}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;margin-top:5px"><path d="M20 6L9 17l-5-5"/></svg>`;
const svgWarn = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;margin-top:4px"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>';
const stamp = (date) => `<svg class="stamp" viewBox="0 0 104 104" width="100" height="100" role="img" aria-label="${jdate(date)} 確認済み"><circle cx="52" cy="52" r="48" fill="#fff" fill-opacity=".9" stroke="#BF3324" stroke-width="2.6"/><path d="M5.6 40h92.8M5.6 64h92.8" stroke="#BF3324" stroke-width="1.6"/><text x="52" y="32" text-anchor="middle" font-family="Shippori Mincho, serif" font-weight="800" font-size="15" letter-spacing="2" fill="#BF3324">確認済</text><text x="52" y="57.5" text-anchor="middle" font-family="Shippori Mincho, serif" font-weight="800" font-size="15.5" fill="#BF3324">${ymd(date)}</text><text x="52" y="81" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="10.5" fill="#BF3324">補助金ナビ</text></svg>`;
const secHead = (id, title, sub) => `<div class="sec-head"><h2 id="${id}">${title}</h2>${sub ? `<span class="small muted">${sub}</span>` : ''}</div>`;
const PR_NOTE = '<span>当サイトはアフィリエイト広告（PR）を利用しています</span>';

// CSS と JS はHTMLに直接入れる（読み込み回数を減らして表示を速くする）
const minCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '').trim();
const CSS = minCss(fs.readFileSync(path.join(ROOT, 'src', 'style.css'), 'utf8'));
const minJs = (s) => s.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//')).join('\n');
const PICKER_JS = minJs(fs.readFileSync(path.join(ROOT, 'src', 'picker.js'), 'utf8'));
const SEARCH_JS = minJs(fs.readFileSync(path.join(ROOT, 'src', 'search.js'), 'utf8'));
const OG_IMAGE = fs.existsSync(path.join(ROOT, 'src', 'static', 'ogp.png')) ? `${SITE}/ogp.png` : '';
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@800&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap';

// ---- 構造化データ ----
const ORG_ID = `${SITE}/#org`;
const WEB_ID = `${SITE}/#website`;
const baseGraph = () => [
  { '@type': 'Organization', '@id': ORG_ID, name: config.siteName, url: `${SITE}/` },
  { '@type': 'WebSite', '@id': WEB_ID, name: config.siteName, url: `${SITE}/`, inLanguage: 'ja', publisher: { '@id': ORG_ID } }
];
// crumbs: [[名前, パス], ...]（先頭のトップは自動で付く）
const crumbLd = (crumbs) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [['トップ', '/'], ...crumbs].map(([name, u], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + u }))
});
const crumbHtml = (crumbs) => `<nav aria-label="パンくずリスト"><a href="/">トップ</a>${crumbs.map(([name, u], i) => (i === crumbs.length - 1 ? ` › ${esc(name)}` : ` › <a href="${u}">${esc(name)}</a>`)).join('')}</nav>`;
const pageLd = ({ type, url, title, description, modified, published, extra }) => Object.assign({
  '@type': type || 'WebPage', '@id': `${SITE}${url}#page`, url: SITE + url, name: title, description, inLanguage: 'ja',
  isPartOf: { '@id': WEB_ID }, publisher: { '@id': ORG_ID }
}, modified ? { dateModified: modified } : {}, published ? { datePublished: published } : {}, extra || {});

// ---- 共通の外枠 ----
function layout({ title, description, canonical, body, graph, noindex, hasCta, ogType }) {
  const ld = graph ? { '@context': 'https://schema.org', '@graph': [...baseGraph(), ...graph] } : null;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${noindex ? 'noindex,follow' : 'max-image-preview:large,max-snippet:-1'}">
${canonical ? `<link rel="canonical" href="${SITE}${canonical}">` : ''}
<meta property="og:site_name" content="${esc(config.siteName)}">
<meta property="og:locale" content="ja_JP">
<meta property="og:type" content="${ogType || 'website'}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${canonical ? `<meta property="og:url" content="${SITE}${canonical}">` : ''}
${OG_IMAGE ? `<meta property="og:image" content="${OG_IMAGE}">` : ''}
<meta name="twitter:card" content="${OG_IMAGE ? 'summary_large_image' : 'summary'}">
${config.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(config.googleSiteVerification)}">` : ''}
<meta name="theme-color" content="#1C4E6B">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONT_URL}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="${FONT_URL}"></noscript>
<style>${CSS}</style>
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<header class="site-head"><div class="wrap">
<a class="logo" href="/"><span class="logo-mark"><span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg></span></span><span class="logo-text"><b>${esc(config.siteName)}</b><small>市区町村の補助金を、工事ごとにかんたん検索</small></span></a>
${hasCta ? '<a class="btn-shu" href="#mitsumori">無料見積もり</a>' : '<a class="btn-head" href="/#h-pref">地域から探す</a>'}
</div></header>
${body}
<footer class="site-foot"><div class="wrap">
<b>${esc(config.siteName)}</b>
<p>金額・期間は変わることがあるため、申請前に必ず公式情報をご確認ください。</p>
<p>当サイトはアフィリエイト広告（PR）を利用しています。</p>
<nav class="foot-nav" aria-label="サイトの案内"><a href="/">トップ</a><a href="/#h-pref">都道府県から探す</a><a href="/kuni/">国の補助金</a><a href="/guide/">補助金の基礎知識</a><a href="/koushin/">更新履歴</a><a href="/about/">運営者情報</a><a href="/policy/">編集方針・情報の調べ方</a><a href="/disclaimer/">免責事項・広告について</a><a href="/privacy/">プライバシーポリシー</a><a href="/contact/">お問い合わせ</a></nav>
</div></footer>
</body>
</html>`;
}

function ctaBlock(heading, button) {
  return `<section id="mitsumori" class="cta" aria-labelledby="h-cta">
<div class="l"><span class="pr">PR</span>
<h2 id="h-cta">${heading}</h2>
<ul class="checks"><li>${svgCheck('var(--accent)')}<span>補助金が使えるかも一緒に相談できる</span></li><li>${svgCheck('var(--accent)')}<span>複数社を比べて適正価格がわかる</span></li><li>${svgCheck('var(--accent)')}<span>断っても費用は0円</span></li></ul></div>
<div class="r"><a class="btn-shu" href="${esc(affHref())}" rel="sponsored nofollow noopener">${button} ${svgArrow}</a>
${config.affiliateUrl ? '' : '<p class="small muted" style="text-align:center">[アフィリエイトリンク未設定]</p>'}</div>
</section>`;
}

// ---- 制度の状態 ----
function statusOf(p) {
  const per = p.period || {};
  if (p.status === 'ended' || (isDate(per.end) && per.end < TODAY)) return { key: 'ended', text: `${FY_LABEL}の受付は終了`, html: `<span class="st-end">${FY_LABEL}の受付は終了</span>` };
  if (isDate(per.start) && per.start > TODAY) return { key: 'soon', text: `${jdate(per.start)}から受付`, html: `<span class="st-check">${jdate(per.start)}から受付</span>` };
  if (p.status === 'open') return { key: 'open', text: '受付中', html: '<span class="st-open"><i aria-hidden="true"></i>受付中</span>' };
  const label = p.statusLabel || '受付状況 [要確認]';
  return { key: 'check', text: label, html: `<span class="st-check">${esc(label)}</span>` };
}
const timingText = (p) => (p.timing === 'before' ? '工事の前に申請' : p.timing === 'after' ? '工事（設置）が終わってから申請' : '');
const COMBO = { ok: '一緒に使える', ng: '一緒には使えない', check: '窓口で確認が必要' };

// ---- 制度カード（市・都道府県で共通） ----
function progCard(p, levelLabel) {
  const st = statusOf(p);
  const flow = p.timing === 'before'
    ? '<span class="s dark">申請（工事の前）</span>→<span class="s">工事</span>'
    : p.timing === 'after' ? '<span class="s">設置（工事）</span>→<span class="s dark">申請（設置のあと）</span>' : '';
  const rows = (p.details || []).map((d) => ({ k: d.k, v: esc(d.v) }));
  const has = (word) => rows.some((r) => r.k.includes(word));
  const per = p.period || {};
  if (!has('期間') && (isDate(per.start) || isDate(per.end))) rows.push({ k: '申請期間', v: `${isDate(per.start) ? timeTag(per.start) : ''}〜${isDate(per.end) ? timeTag(per.end) : ''}` });
  const c = p.contact || {};
  if (!has('窓口') && (c.dept || c.place)) rows.push({ k: '窓口', v: esc([c.place, c.dept].filter(Boolean).join(' ') + (c.method ? `（${c.method}）` : '')) });
  if (c.tel) rows.push({ k: '電話', v: `<a href="tel:${esc(c.tel.replace(/[^0-9+]/g, ''))}">${esc(c.tel)}</a>` });
  if (p.contractor) rows.push({ k: '業者の条件', v: esc(p.contractor) });
  if (p.combo && COMBO[p.combo.kuni]) rows.push({ k: '国の補助と', v: esc(COMBO[p.combo.kuni] + (p.combo.note ? `。${p.combo.note}` : '')) });
  if (p.lastYear) rows.push({ k: '前年度', v: esc(p.lastYear) });
  const list = (label, items) => (items && items.length ? `<div class="sub"><span class="small muted" style="font-weight:700">${label}</span><ul class="dots-list">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : '');
  const off = isOfficial(p);
  return `<article id="p-${esc(p.id)}" class="prog" data-cats="${p.cats.join(' ')}">
<div class="sub" style="gap:10px"><div class="prog-tags">${st.html}<span class="small muted" style="font-weight:700">${esc(levelLabel)}</span></div>
<h3>${esc(p.name)}</h3><p style="color:var(--ink2)">${esc(p.summary)}</p></div>
${p.tags && p.tags.length ? `<div class="sub"><span class="small muted" style="font-weight:700">対象になる設備・工事</span><ul class="pills">${p.tags.map((t) => `<li class="pill">${esc(t)}</li>`).join('')}</ul></div>` : ''}
${p.tiers ? `<ol class="tiers">${p.tiers.map((t, i) => `<li${t.highlight ? ' class="hl"' : ''}><b>${i + 1}. ${esc(t.label)}</b><span class="n">${esc(t.amount)}<small>${esc(t.unit)}</small></span><span style="font-size:15px" class="muted">${esc(t.note)}</span></li>`).join('')}</ol>` : ''}
${rows.length ? `<dl class="kv">${rows.map((d) => `<div><dt>${esc(d.k)}</dt><dd>${d.v}</dd></div>`).join('')}</dl>` : ''}
${list('主な条件', p.conditions)}${list('必要な書類', p.docs)}
${flow ? `<div class="flow"><span class="small muted" style="font-weight:700">申請のタイミング</span>${flow}</div>` : ''}
${p.warning ? `<div class="warn">${svgWarn}<span>${esc(p.warning)}</span></div>` : ''}
${p.source ? `<p class="small muted">${off ? '出典（公式）' : '参考にした情報'}：<a href="${esc(p.source)}" rel="${off ? 'noopener' : 'nofollow noopener'}">${esc(p.sourceName || (off ? '公式ページ' : new URL(p.source).hostname))}</a>${off ? '' : '　※公式ページでの確認がまだの情報です。申請前に市の窓口でお確かめください。'}</p>` : ''}
</article>`;
}

const natList = () => `<ul class="nat">${national.programs.map((p) => {
  const href = kuniHref(p);
  return `<li><span style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:2px">${href ? `<a class="serif" style="font-size:22px;line-height:1.5" href="${href}">${esc(p.name)}</a>` : `<span class="serif" style="font-size:22px;line-height:1.5">${esc(p.name)}</span>`}<span style="font-size:16px;color:var(--ink2)">${esc(p.target)}</span></span><span style="display:flex;align-items:baseline;gap:8px"><span class="muted" style="font-weight:700;font-size:15px">最大</span><span class="big">${p.maxNumber}<small>万円</small></span></span></li>`;
}).join('')}</ul>`;

const faqHtml = (items) => `<dl class="faq">${items.map((f) => `<div><dt><span class="q" aria-hidden="true">Q</span><span>${esc(f.q)}</span></dt><dd><span class="a" aria-hidden="true">A</span><span>${esc(f.a)}</span></dd></div>`).join('\n')}</dl>`;

const cityUrl = (c) => `/${c.prefSlug}/${c.slug}/`;
const cityCats = (c) => CATS.filter((cat) => c.programs.some((p) => p.cats.includes(cat.id)));
const cityMax = (c) => Math.max(0, ...c.programs.map((p) => p.maxNumber || 0));
const indexable = (c) => c.programs.length > 0;

// ---- 市区町村ページ ----
function cityPage(city, ctx) {
  const url = cityUrl(city);
  const n = city.programs.length;
  const prefData = ctx.prefData.get(city.prefSlug);
  const prefProgs = (prefData && prefData.programs) || [];
  const myCats = cityCats(city);
  const cMax = cityMax(city);
  const natMax = Math.max(0, ...national.programs.map((p) => p.maxNumber || 0));
  const thin = !indexable(city);
  const crumbs = [[city.pref, `/${city.prefSlug}/`], [city.name, url]];

  // 工事カテゴリごとの結果（HTMLに最初から書き出す。JSは表示の切り替えだけ）
  const row = (r) => `<li><span class="top"><b>${esc(r.name)}</b><span class="amt">${esc(r.amt)}</span></span><span class="note">${esc(r.note)}</span>${r.href ? `<a href="${r.href}">くわしく見る →</a>` : ''}</li>`;
  const rowsHtml = (list, none) => (list.length ? `<ul class="rows">${list.map(row).join('')}</ul>` : `<p class="none">${esc(none)}</p>`);
  const panels = CATS.map((c) => {
    const cityRows = city.programs.filter((p) => p.cats.includes(c.id)).map((p) => ({ name: p.name, amt: p.amountLabel, note: (p.catNotes && p.catNotes[c.id]) || p.summary, href: `#p-${p.id}` }));
    const prefRows = prefProgs.filter((p) => p.cats.includes(c.id)).map((p) => ({ name: p.name, amt: p.amountLabel, note: (p.catNotes && p.catNotes[c.id]) || p.summary, href: `/${city.prefSlug}/#p-${p.id}` }));
    const kuniRows = national.programs.filter((p) => p.cats.includes(c.id)).map((p) => ({ name: p.name, amt: p.maxLabel, note: p.target, href: kuniHref(p) }));
    if (c.id === 'yane') { const m = national.programs.find((x) => x.id === 'mirai'); if (m) kuniRows.push({ name: '国の省エネリフォーム補助', amt: '断熱と一緒なら', note: '断熱の工事と一緒に行う場合に、対象になることがあります。くわしい条件は各制度のページへ。', href: kuniHref(m) }); }
    const sum = [cityRows.length ? '市 あり' : '', prefRows.length ? `${city.pref.slice(-1)} あり` : '', kuniRows.length ? '国 あり' : ''].filter(Boolean).join(' ／ ') || '掲載中の制度なし';
    const cityNone = (city.noCityNote && city.noCityNote[c.id]) || 'このページに掲載している市の制度には、該当するものがありません。';
    return { c, cityRows, prefRows, kuniRows, sum, cityNone };
  });
  const first = (panels.find((x) => x.cityRows.length) || panels[0]).c.id;
  const catButtons = panels.map((x) => `<a class="cat" href="#${x.c.id}" data-cat="${x.c.id}"><span class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${x.c.icon}"/></svg></span><span class="tx"><b>${esc(x.c.name)}</b><small>${esc(x.sum)}</small></span><svg class="ck" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg></a>`).join('');
  const panelHtml = panels.map((x) => `<div class="result" id="${x.c.id}"><div class="result-head"><h3>${esc(city.name)}の${esc(x.c.h)}の補助金</h3></div>
<div class="result-body"><div class="result-col"><div class="col-head"><span class="badge-city">市</span>${esc(city.name)}の制度</div>${rowsHtml(x.cityRows, x.cityNone)}</div>
${x.prefRows.length ? `<div class="result-col"><div class="col-head"><span class="badge-city">${esc(city.pref.slice(-1))}</span>${esc(city.pref)}の制度</div>${rowsHtml(x.prefRows, '')}</div>` : ''}
<div class="result-col"><div class="col-head"><span class="badge-kuni">国</span>国の制度（全国共通）</div>${rowsHtml(x.kuniRows, 'このページに掲載している国の制度には、該当するものがありません。')}</div></div>
<div class="result-foot"><span>自分の家の工事が対象になるかは、見積もりのときに確認できます。</span><a href="#mitsumori">無料の見積もりで確認する →</a></div></div>`).join('\n');

  // となりの市・同じ都道府県の市（Googleに出しているページだけにリンクする）
  const samePref = ctx.cities.filter((c) => c.prefSlug === city.prefSlug && indexable(c));
  const nbLinks = (city.neighbors || []).map((nb) => {
    const name = typeof nb === 'string' ? nb : nb.name;
    const pool = ctx.cities.filter((c) => c.name === name && indexable(c) && (typeof nb === 'string' || !nb.prefSlug || c.prefSlug === nb.prefSlug));
    return pool.find((c) => c.prefSlug === city.prefSlug) || (pool.length === 1 ? pool[0] : null);
  }).filter(Boolean);
  const idx = samePref.findIndex((c) => c.slug === city.slug);
  const others = [];
  for (let i = 1; i < samePref.length && others.length < 8; i++) {
    const c = samePref[(idx + i) % samePref.length];
    if (c.slug !== city.slug && !nbLinks.includes(c)) others.push(c);
  }
  const nb = (c) => `<a class="nb" href="${cityUrl(c)}"><i aria-hidden="true"></i>${esc(c.name)} →</a>`;
  const prefCatLinks = myCats.filter((c) => ctx.prefCatPages.has(`${city.prefSlug}/${c.id}`)).map((c) => `<a class="nb" href="/${city.prefSlug}/${c.id}/"><i aria-hidden="true"></i>${esc(city.pref)}の${esc(c.h)}補助金 →</a>`).join('');

  // よくある質問（この市のデータから作る）
  const faq = [];
  for (const p of city.programs.slice(0, 3)) {
    const row = (word) => (p.details || []).find((d) => d.k.includes(word));
    const amount = row('補助額') ? row('補助額').v : p.tiers ? p.tiers.map((t) => `${t.label} ${t.amount}${t.unit}`).join('、') : p.amountLabel;
    const per = p.period || {};
    const period = row('期間') ? row('期間').v : isDate(per.end) ? `${isDate(per.start) ? jdate(per.start) : ''}〜${jdate(per.end)}` : '';
    faq.push({ q: `${city.name}の「${p.name}」は、いくら補助されますか？`, a: `補助額は、${amount}です。${period ? `申請期間は${period}。` : ''}${timingText(p) ? `${timingText(p)}します。` : ''}（${jdate(city.checked)}確認・${statusOf(p).text}）` });
  }
  for (const x of panels) {
    if (!x.cityRows.length && city.noCityNote && city.noCityNote[x.c.id]) {
      faq.push({ q: `${city.name}に${x.c.h}の補助金はありますか？`, a: `${city.noCityNote[x.c.id]}${x.kuniRows.length ? '国の制度が使える場合があります。' : ''}` });
    }
  }
  const timed = city.programs.filter((p) => timingText(p));
  if (timed.length) faq.push({ q: `${city.name}の補助金は、工事が終わってからでも申請できますか？`, a: `制度によって違います。${timed.map((p) => `「${p.name}」は${timingText(p)}`).join('、')}します。工事の前に申請が必要な制度は、先に工事を始めると対象外になるので注意してください。` });
  const combos = city.programs.filter((p) => p.combo && COMBO[p.combo.kuni]);
  faq.push({ q: `${city.name}の補助金と国の補助金は一緒に使えますか？`, a: combos.length ? `${combos.map((p) => `「${p.name}」は国の補助金と${COMBO[p.combo.kuni]}${p.combo.note ? `（${p.combo.note}）` : ''}`).join('、')}。` : '同じ工事に二重で出ない決まりのものもあります。工事ごとに分ければ使える場合があるので、申請の前に市の窓口や、見積もりをとる業者に確認しましょう。' });

  const catNames = myCats.map((c) => c.name.replace(/（.*）/, ''));
  const title = (() => {
    const t = `${city.name}のリフォーム補助金【${FY_LABEL}】${myCats.slice(0, 4).map((c) => c.short).join('・')}`;
    return t.length <= 34 ? `${t}｜${config.siteName}` : t;
  })();
  const description = n
    ? `${city.pref}${city.name}で${FY_LABEL}に使えるリフォーム補助金の一覧。市の制度${n}件${cMax ? `（最大${cMax}万円）` : ''}と国の制度を、${catNames.join('、')}など工事別に整理。申請の時期・窓口・出典つき。${jdate(city.checked)}確認。`
    : `${city.pref}${city.name}で使えるリフォーム補助金。${jdate(city.checked)}の時点で市独自の制度は見つかっていませんが、国の制度は使えます。`;
  const lead = n
    ? `${city.name}のリフォーム向け補助金は、確認できた範囲で${n}件（${catNames.join('、')}）。国の制度とあわせて、工事ごとに申請の時期と窓口を整理しました。`
    : `${city.name}が独自に行っているリフォーム向けの補助金は、${jdate(city.checked)}の時点では見つかっていません。国の制度は${city.name}でも使えます。`;
  const stale = (new Date(TODAY) - new Date(city.checked)) / 86400000 > 150;
  const history = (city.history || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));

  const body = `<div class="hero"><div class="wrap">
<div class="crumbs">${crumbHtml(crumbs)}${PR_NOTE}</div>
<div class="hero-row"><div class="hero-main">
<div class="hero-title"><div class="plate" aria-hidden="true"><div><i></i><span class="p">${esc(city.pref)}</span><span class="c">${esc(city.name)}</span><i></i></div></div>
<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:16px;padding-top:4px"><span class="small muted" style="font-weight:700;letter-spacing:.08em">${FY_LABEL}版 ／ 市と国の制度を1ページに</span>
<h1><span style="display:block">${esc(city.name)}の</span><span class="ib">リフォーム補助金</span><span class="ib">まとめ<span class="yr">${FY_LABEL}</span></span></h1>
<p style="color:var(--ink2);max-width:520px">${city.kana ? `${esc(city.name)}（${esc(city.kana)}）。` : ''}${esc(lead)}${city.lead ? esc(city.lead) : ''}</p></div></div>
<div class="btn-row"><a class="btn-ink" href="#sagasu">やりたい工事から調べる</a><a class="btn-line" href="#mitsumori">補助金が使えるか無料で見積もり ${svgArrow}</a></div>
</div>
<div class="ledger">${stamp(city.checked)}<p class="small muted" style="font-weight:700;margin:0 96px 14px 0;letter-spacing:.06em">${esc(city.name)}のあらまし</p>
<dl><div><dt>市の制度</dt><span class="dots" aria-hidden="true"></span><dd>${n}<small>件</small></dd></div>
${cMax ? `<div><dt>市の補助 <span class="small muted">最大</span></dt><span class="dots" aria-hidden="true"></span><dd>${cMax}<small>万円</small></dd></div>` : ''}
<div><dt>国の補助 <span class="small muted">最大</span></dt><span class="dots" aria-hidden="true"></span><dd>${natMax}<small>万円</small></dd></div></dl>
<p class="small muted" style="margin-top:14px">情報の確認日：${timeTag(city.checked)}（<a href="#shutten">出典を見る</a>）</p>
${stale ? '<p class="small" style="color:var(--shu-d);font-weight:700">確認から時間がたっています。最新の状況は市の公式ページでお確かめください。</p>' : ''}</div>
</div></div></div>

<main class="wrap">
<section id="sagasu" aria-labelledby="h-sagasu">${secHead('h-sagasu', `${esc(city.name)}の補助金を工事から探す`, '工事を押すと、使える制度が下に出ます')}
<div class="cats" role="group" aria-label="工事の種類">${catButtons}</div>
<div class="panels" id="panels" data-first="${first}">
${panelHtml}
</div>
<script>${PICKER_JS}</script>
</section>

<section id="city" aria-labelledby="h-city">${secHead('h-city', `${esc(city.name)}の補助金`, `市が独自に行っている制度（${n}件）`)}
${n ? city.programs.map((p) => progCard(p, '市の制度')).join('\n') : `<p>${esc(city.name)}が独自に行っている、個人の住宅のリフォーム向けの補助金は、${timeTag(city.checked)}の時点では見つかっていません。年度の途中で始まることもあるため、最新の情報は市の公式ページでお確かめください。</p>`}
</section>

${prefProgs.length ? `<section id="ken" aria-labelledby="h-ken">${secHead('h-ken', `${esc(city.name)}でも使える${esc(city.pref)}の補助金`, `${esc(city.pref)}が行っている制度`)}
<ul class="nat">${prefProgs.map((p) => `<li><span style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:2px"><a class="serif" style="font-size:22px;line-height:1.5" href="/${city.prefSlug}/#p-${esc(p.id)}">${esc(p.name)}</a><span style="font-size:16px;color:var(--ink2)">${esc(p.summary)}</span></span><span class="mid">${esc(p.amountLabel)}</span></li>`).join('')}</ul>
</section>` : ''}

<section id="kuni" aria-labelledby="h-kuni">${secHead('h-kuni', `${esc(city.name)}でも使える国の補助金`, '全国共通の制度')}
<p style="color:var(--ink2)">国の制度は全国共通です。市の補助金と組み合わせられる場合もあります。金額や条件は、各制度のページにまとめています。</p>
${natList()}
</section>

<section aria-labelledby="h-flow">${secHead('h-flow', '申請の流れ', '見積もりから入金まで')}
${timed.length ? `<ul class="dots-list">${timed.map((p) => `<li><b>${esc(p.name)}</b>：${esc(timingText(p))}</li>`).join('')}</ul>` : ''}
<ol class="steps"><li><span class="no">1</span><b>見積もりをとる</b><span class="small muted">対象の工事か確認</span></li><li><span class="no">2</span><b>申請する</b><span class="small muted">工事の前か後かは制度しだい</span></li><li><span class="no">3</span><b>交付決定</b><span class="small muted">通知が届く</span></li><li><span class="no">4</span><b>工事</b><span class="small muted">写真を残しておく</span></li><li><span class="no">5</span><b>報告・入金</b><span class="small muted">完了報告のあと振込</span></li></ol>
</section>

${ctaBlock(`<span class="ib">${esc(city.name)}対応のリフォーム会社に</span><span class="ib">まとめて無料で見積もり</span>`, '無料で見積もりをとる')}

<section aria-labelledby="h-faq">${secHead('h-faq', `${esc(city.name)}の補助金でよくある質問`)}
${faqHtml(faq)}
</section>

<section id="shutten" aria-labelledby="h-shutten">${secHead('h-shutten', '出典と確認日', `${timeTag(city.checked)}に確認`)}
<ul class="dots-list">${city.programs.filter((p) => p.source).map((p) => `<li>${esc(p.name)}：<a href="${esc(p.source)}" rel="${isOfficial(p) ? 'noopener' : 'nofollow noopener'}">${esc(p.sourceName || new URL(p.source).hostname)}</a>${isOfficial(p) ? '（公式）' : '（公式ページでの確認がまだの情報）'}</li>`).join('')}
<li>国の制度：各制度のページに出典を載せています。</li></ul>
${history.length ? `<div class="sub"><span class="small muted" style="font-weight:700">このページの更新履歴</span><ul class="dots-list">${history.map((h) => `<li>${timeTag(h.date)}　${esc(h.note)}</li>`).join('')}</ul></div>` : ''}
<p class="small muted">情報の調べ方は<a href="/policy/">編集方針・情報の調べ方</a>にまとめています。まちがいに気づいた方は<a href="/contact/">お問い合わせ</a>からお知らせください。</p>
</section>

<section aria-labelledby="h-area">${secHead('h-area', `${esc(city.pref)}のほかの市区町村`, 'となりの市・町の補助金')}
${nbLinks.length ? `<div class="links"><span class="muted" style="font-size:15px">となりの市・町：</span>${nbLinks.map(nb).join('')}</div>` : ''}
${others.length ? `<div class="links">${others.map(nb).join('')}</div>` : ''}
<div class="links">${prefCatLinks}<a class="nb" href="/${city.prefSlug}/"><i aria-hidden="true"></i>${esc(city.pref)}の市区町村一覧 →</a></div>
</section>
</main>`;

  const graph = [
    pageLd({
      url, title, description, modified: city.checked,
      extra: {
        breadcrumb: { '@id': `${SITE}${url}#crumbs` },
        about: { '@type': 'City', name: city.name, containedInPlace: { '@type': 'AdministrativeArea', name: city.pref } },
        mainEntity: n ? {
          '@type': 'ItemList', numberOfItems: n,
          itemListElement: city.programs.map((p, i) => ({
            '@type': 'ListItem', position: i + 1,
            item: Object.assign({ '@type': 'GovernmentService', name: p.name, description: p.summary, url: `${SITE}${url}#p-${p.id}`, serviceType: 'リフォーム補助金', areaServed: { '@type': 'City', name: city.name }, provider: { '@type': 'GovernmentOrganization', name: city.name } }, isOfficial(p) ? { sameAs: p.source } : {})
          }))
        } : undefined
      }
    }),
    Object.assign(crumbLd(crumbs), { '@id': `${SITE}${url}#crumbs` })
  ];
  write(`${city.prefSlug}/${city.slug}/index.html`, layout({ title, description, canonical: url, body, graph, noindex: thin, hasCta: true }));
  return thin ? null : { url, lastmod: city.checked };
}

// ---- 都道府県ページ ----
function prefPage(pref, ctx) {
  const url = `/${pref.slug}/`;
  const prefData = ctx.prefData.get(pref.slug);
  const prefProgs = (prefData && prefData.programs) || [];
  const live = pref.cities.filter(indexable);
  const none = pref.cities.filter((c) => !indexable(c));
  const prog = ctx.progress.get(pref.slug);
  const total = prog ? prog.cities.length : null;
  const lastmod = maxDate([...pref.cities.map((c) => c.checked), prefData && prefData.checked]);
  const crumbs = [[pref.name, url]];
  const cats = CATS.filter((c) => ctx.prefCatPages.has(`${pref.slug}/${c.id}`));
  const progCount = live.reduce((s, c) => s + c.programs.length, 0);
  const title = `${pref.name}のリフォーム補助金｜市区町村別の一覧【${FY_LABEL}】`;
  const description = `${pref.name}の市区町村ごとに、リフォームに使える補助金（耐震・給湯器・太陽光・窓の断熱など）を整理。${live.length}市区町村・${progCount}制度を掲載${prefProgs.length ? `、${pref.name}の制度${prefProgs.length}件も` : ''}。${jdate(lastmod)}更新。`;
  const body = `<div class="hero"><div class="wrap"><div class="crumbs">${crumbHtml(crumbs)}${PR_NOTE}</div>
<h1>${esc(pref.name)}のリフォーム補助金<span class="yr">${FY_LABEL}</span></h1>
<p style="color:var(--ink2);max-width:680px">${esc(pref.name)}の市区町村が行っているリフォーム向けの補助金を、市区町村ごとにまとめています。${total ? `${esc(pref.name)}の${total}市区町村のうち、${pref.cities.length}市区町村を調べ終わり、` : ''}制度が見つかった${live.length}市区町村・${progCount}制度を掲載中です（${timeTag(lastmod)}更新）。</p></div></div>
<main class="wrap">
<section aria-labelledby="h-list">${secHead('h-list', `${esc(pref.name)}の市区町村から探す`, '市区町村を選ぶと、使える補助金がわかります')}
${live.length ? `<ul class="nat">${live.map((c) => `<li><span style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:2px"><a class="serif" style="font-size:22px;line-height:1.5" href="${cityUrl(c)}">${esc(c.name)}のリフォーム補助金</a><span style="font-size:16px;color:var(--ink2)">${esc(cityCats(c).map((x) => x.name.replace(/（.*）/, '')).join('、'))}　／　${timeTag(c.checked)}確認</span></span><span class="mid">${c.programs.length}<small>件</small>${cityMax(c) ? `　最大${cityMax(c)}<small>万円</small>` : ''}</span></li>`).join('')}</ul>` : '<p>掲載の準備中です。</p>'}
${none.length ? `<p class="small muted">調べたものの、市区町村独自のリフォーム向け制度が見つからなかった地域：${none.map((c) => esc(c.name)).join('、')}（国の制度は使えます）</p>` : ''}
</section>
${cats.length ? `<section aria-labelledby="h-cat">${secHead('h-cat', `${esc(pref.name)}の補助金を工事から探す`, '市区町村ごとの金額を見比べられます')}
<div class="links">${cats.map((c) => `<a class="nb" href="/${pref.slug}/${c.id}/"><i aria-hidden="true"></i>${esc(c.h)}の補助金 →</a>`).join('')}</div></section>` : ''}
${prefProgs.length ? `<section id="ken" aria-labelledby="h-ken">${secHead('h-ken', `${esc(pref.name)}の補助金`, `${esc(pref.name)}が行っている制度（${prefProgs.length}件）`)}
${prefProgs.map((p) => progCard(p, `${pref.name}の制度`)).join('\n')}
<p class="small muted">情報の確認日：${timeTag(prefData.checked)}</p></section>` : ''}
<section aria-labelledby="h-kuni">${secHead('h-kuni', `${esc(pref.name)}でも使える国の補助金`, '全国共通の制度')}
${natList()}
</section>
${ctaBlock(`<span class="ib">${esc(pref.name)}対応のリフォーム会社に</span><span class="ib">まとめて無料で見積もり</span>`, '無料で見積もりをとる')}
</main>`;
  const ok = live.length > 0 || prefProgs.length > 0;
  const graph = [pageLd({ type: 'CollectionPage', url, title, description, modified: lastmod, extra: { breadcrumb: { '@id': `${SITE}${url}#crumbs` } } }), Object.assign(crumbLd(crumbs), { '@id': `${SITE}${url}#crumbs` })];
  write(`${pref.slug}/index.html`, layout({ title, description, canonical: url, body, graph, noindex: !ok, hasCta: true }));
  return ok ? { url, lastmod } : null;
}

// ---- 都道府県×工事ページ（市区町村ごとの見比べ） ----
function prefCatData(pref, cat, ctx) {
  const prefData = ctx.prefData.get(pref.slug);
  const prefProgs = ((prefData && prefData.programs) || []).filter((p) => p.cats.includes(cat.id));
  const rows = [];
  for (const c of pref.cities) for (const p of c.programs) if (p.cats.includes(cat.id)) rows.push({ c, p });
  const cityCount = new Set(rows.map((r) => r.c.slug)).size;
  return { prefProgs, rows, cityCount, ok: cityCount >= MIN_CAT_CITIES };
}
function prefCatPage(pref, cat, ctx) {
  const d = prefCatData(pref, cat, ctx);
  if (!d.ok) return null;
  const url = `/${pref.slug}/${cat.id}/`;
  const crumbs = [[pref.name, `/${pref.slug}/`], [`${cat.h}の補助金`, url]];
  const without = pref.cities.filter((c) => !c.programs.some((p) => p.cats.includes(cat.id)));
  const lastmod = maxDate(d.rows.map((r) => r.c.checked));
  const kuni = national.programs.filter((p) => p.cats.includes(cat.id));
  const title = `${pref.name}の${cat.h}補助金｜市区町村別の一覧【${FY_LABEL}】`;
  const description = `${pref.name}で${cat.h}に使える補助金を、市区町村ごとに金額・申請の時期・受付状況で見比べられる一覧。${d.cityCount}市区町村・${d.rows.length}制度を掲載。${jdate(lastmod)}更新。`;
  const body = `<div class="hero"><div class="wrap"><div class="crumbs">${crumbHtml(crumbs)}${PR_NOTE}</div>
<h1>${esc(pref.name)}の<span class="ib">${esc(cat.h)}の補助金</span><span class="yr">${FY_LABEL}</span></h1>
<p style="color:var(--ink2);max-width:680px">${esc(pref.name)}の市区町村が行っている、${esc(cat.h)}に使える補助金の一覧です。当サイトが調べた${pref.cities.length}市区町村のうち、${d.cityCount}市区町村で${d.rows.length}件の制度を確認しています（${timeTag(lastmod)}更新）。</p></div></div>
<main class="wrap">
<section aria-labelledby="h-list">${secHead('h-list', `市区町村ごとの${esc(cat.h)}補助金`, '市区町村名を押すと、くわしい条件が見られます')}
<ul class="nat">${d.rows.map(({ c, p }) => `<li><span style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:2px"><a class="serif" style="font-size:22px;line-height:1.5" href="${cityUrl(c)}#${cat.id}">${esc(c.name)}</a><span style="font-size:16px;color:var(--ink2)">${esc(p.name)}</span><span class="small muted">${esc([statusOf(p).text, timingText(p), `${jdate(c.checked)}確認`].filter(Boolean).join('　／　'))}</span></span><span class="mid">${esc(p.amountLabel)}</span></li>`).join('')}</ul>
${without.length ? `<p class="small muted">${esc(cat.h)}向けの市区町村独自の制度が見つかっていない地域：${without.map((c) => esc(c.name)).join('、')}</p>` : ''}
</section>
${d.prefProgs.length ? `<section aria-labelledby="h-ken">${secHead('h-ken', `${esc(pref.name)}の制度`)}
<ul class="nat">${d.prefProgs.map((p) => `<li><span style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:2px"><a class="serif" style="font-size:22px;line-height:1.5" href="/${pref.slug}/#p-${esc(p.id)}">${esc(p.name)}</a><span style="font-size:16px;color:var(--ink2)">${esc(p.summary)}</span></span><span class="mid">${esc(p.amountLabel)}</span></li>`).join('')}</ul></section>` : ''}
${kuni.length ? `<section aria-labelledby="h-kuni">${secHead('h-kuni', `${esc(cat.h)}に使える国の補助金`, '全国共通の制度')}
<ul class="nat">${kuni.map((p) => `<li><span style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:2px">${kuniHref(p) ? `<a class="serif" style="font-size:22px;line-height:1.5" href="${kuniHref(p)}">${esc(p.name)}</a>` : `<span class="serif" style="font-size:22px;line-height:1.5">${esc(p.name)}</span>`}<span style="font-size:16px;color:var(--ink2)">${esc(p.target)}</span></span><span class="mid">${esc(p.maxLabel)}</span></li>`).join('')}</ul></section>` : ''}
${ctaBlock(`<span class="ib">${esc(pref.name)}対応のリフォーム会社に</span><span class="ib">まとめて無料で見積もり</span>`, '無料で見積もりをとる')}
<section aria-labelledby="h-more">${secHead('h-more', `${esc(pref.name)}のほかの工事の補助金`)}
<div class="links">${CATS.filter((c) => c.id !== cat.id && ctx.prefCatPages.has(`${pref.slug}/${c.id}`)).map((c) => `<a class="nb" href="/${pref.slug}/${c.id}/"><i aria-hidden="true"></i>${esc(c.h)} →</a>`).join('')}<a class="nb" href="/${pref.slug}/"><i aria-hidden="true"></i>${esc(pref.name)}の市区町村一覧 →</a></div></section>
</main>`;
  const graph = [pageLd({ type: 'CollectionPage', url, title, description, modified: lastmod, extra: { breadcrumb: { '@id': `${SITE}${url}#crumbs` } } }), Object.assign(crumbLd(crumbs), { '@id': `${SITE}${url}#crumbs` })];
  write(`${pref.slug}/${cat.id}/index.html`, layout({ title, description, canonical: url, body, graph, hasCta: true }));
  return { url, lastmod };
}

// ---- 国の制度ページ（本文は src/kuni/<slug>.html） ----
function kuniPage(p, ctx) {
  if (!hasKuniPage(p)) return null;
  const url = `/kuni/${p.slug}/`;
  const crumbs = [['国の補助金', '/kuni/'], [p.name, url]];
  const areas = `<section aria-labelledby="h-area">${secHead('h-area', 'お住まいの市区町村の補助金も調べる', '国の制度と一緒に使える場合があります')}
<p style="color:var(--ink2)">市区町村が独自に出している補助金は、地域によって金額も条件も違います。都道府県を選んで、お住まいの市区町村のページをご覧ください。</p>
<div class="links">${ctx.livePrefs.map((x) => `<a class="nb" href="/${x.slug}/"><i aria-hidden="true"></i>${esc(x.name)} →</a>`).join('')}<a class="nb" href="/#h-pref"><i aria-hidden="true"></i>都道府県の一覧 →</a></div></section>`;
  const inner = fs.readFileSync(path.join(ROOT, 'src', 'kuni', `${p.slug}.html`), 'utf8')
    .replace(/\{\{CRUMBS\}\}/g, crumbHtml(crumbs))
    .replace(/\{\{CTA\}\}/g, ctaBlock('<span class="ib">締め切りに間に合う業者を、</span><span class="ib">まとめて無料で探す</span>', '見積もりをとる'))
    .replace(/\{\{STAMP\}\}/g, stamp(national.checked))
    .replace(/\{\{AREAS\}\}/g, areas)
    .replace(/\{\{CHECKED\}\}/g, timeTag(national.checked));
  const title = p.title || `${p.name}とは？補助額・対象工事・申請期限【${p.maxLabel}】`;
  const description = p.description || `${p.name}事業の対象工事（${p.target}）、補助額（${p.maxLabel}）、申請期限、ほかの補助金との併用を、やさしい言葉で整理しました。${jdate(national.checked)}確認。`;
  const graph = [
    { '@type': 'Article', '@id': `${SITE}${url}#page`, headline: title, description, inLanguage: 'ja', mainEntityOfPage: SITE + url, datePublished: p.published || national.checked, dateModified: national.checked, author: { '@id': ORG_ID }, publisher: { '@id': ORG_ID }, isPartOf: { '@id': WEB_ID } },
    crumbLd(crumbs)
  ];
  write(`kuni/${p.slug}/index.html`, layout({ title, description, canonical: url, body: inner, graph, hasCta: true, ogType: 'article' }));
  return { url, lastmod: national.checked };
}
function kuniIndex() {
  const url = '/kuni/';
  const crumbs = [['国の補助金', url]];
  const title = `国のリフォーム補助金の一覧【${FY_LABEL}】｜${config.siteName}`;
  const description = `全国どこでも使える国のリフォーム補助金（${national.programs.map((p) => p.name).join('・')}）の一覧。対象の工事と上限額を整理しています。${jdate(national.checked)}確認。`;
  const body = `<div class="hero"><div class="wrap"><div class="crumbs">${crumbHtml(crumbs)}${PR_NOTE}</div>
<h1>国のリフォーム補助金<span class="yr">${FY_LABEL}</span></h1>
<p style="color:var(--ink2);max-width:680px">全国どこに住んでいても使える、国のリフォーム補助金の一覧です。市区町村の補助金と一緒に使える場合もあります（情報の確認日：${timeTag(national.checked)}）。</p></div></div>
<main class="wrap"><section aria-labelledby="h-kuni">${secHead('h-kuni', '国の補助金の一覧', '制度名を押すと、くわしい説明が見られます')}
${natList()}
<p class="small muted">リンクのない制度は、くわしい説明ページを準備中です。</p></section>
<section aria-labelledby="h-pref">${secHead('h-pref', '市区町村の補助金も調べる')}<div class="links"><a class="nb" href="/#h-pref"><i aria-hidden="true"></i>都道府県から探す →</a></div></section>
</main>`;
  write('kuni/index.html', layout({ title, description, canonical: url, body, graph: [pageLd({ type: 'CollectionPage', url, title, description, modified: national.checked }), crumbLd(crumbs)] }));
  return { url, lastmod: national.checked };
}

// ---- トップページ ----
function topPage(ctx) {
  const live = ctx.cities.filter(indexable);
  const progCount = live.reduce((s, c) => s + c.programs.length, 0);
  const lastmod = maxDate([...ctx.cities.map((c) => c.checked), national.checked]);
  const liveSlugs = new Set(ctx.livePrefs.map((p) => p.slug));
  const prefName = new Map(progress.prefOrder.map((p) => [p.slug, p.name]));
  const recent = live.slice().sort((a, b) => (a.checked < b.checked ? 1 : -1)).slice(0, 12);
  const title = `${config.siteName}｜市区町村別のリフォーム補助金一覧【${FY_LABEL}】`;
  const description = `市区町村と国のリフォーム補助金を、窓・給湯器・太陽光・耐震など工事ごとに整理。お住まいの市区町村を選ぶと、使える補助金と申請の時期がわかります。${live.length}市区町村・${progCount}制度を掲載（${jdate(lastmod)}更新）。`;
  const body = `<div class="hero"><div class="wrap">
<div class="crumbs"><span></span>${PR_NOTE}</div>
<h1>リフォーム補助金を、<span class="ib">住んでいる市から探す</span></h1>
<p style="color:var(--ink2);max-width:640px">市区町村と国の補助金を、窓・給湯器・耐震など工事ごとに整理しています。自治体の公式情報を最優先に調べ、制度ごとに出典と確認日をつけて掲載しています。</p>
<p class="small muted">掲載中：${live.length}市区町村・${progCount}制度　／　最終更新：${timeTag(lastmod)}　／　<a href="/policy/">情報の調べ方</a></p>
<div class="search"><label for="q">市区町村の名前で探す</label><input id="q" type="search" autocomplete="off" placeholder="例：泉大津" inputmode="text"><div id="q-out" class="links" aria-live="polite"></div></div>
<script>${SEARCH_JS}</script>
</div></div>
<main class="wrap">
<section aria-labelledby="h-pref">${secHead('h-pref', '都道府県から探す', '順番に調べて追加しています')}
${REGIONS.map(([region, slugs]) => `<div class="region"><b>${region}</b><div class="links">${slugs.map((s) => (liveSlugs.has(s) ? `<a class="nb" href="/${s}/"><i aria-hidden="true"></i>${esc(prefName.get(s))} →</a>` : `<span class="nb off">${esc(prefName.get(s) || s)}<small>準備中</small></span>`)).join('')}</div></div>`).join('\n')}
</section>
${recent.length ? `<section aria-labelledby="h-new">${secHead('h-new', '最近確認した市区町村', '<a href="/koushin/">更新履歴を見る</a>')}
<div class="links">${recent.map((c) => `<a class="nb" href="${cityUrl(c)}"><i aria-hidden="true"></i>${esc(c.name)}<small>${ymd(c.checked).slice(5)}</small></a>`).join('')}</div></section>` : ''}
<section aria-labelledby="h-kuni">${secHead('h-kuni', '全国で使える国の補助金', '<a href="/kuni/">国の補助金の一覧</a>')}
${natList()}</section>
<section aria-labelledby="h-about">${secHead('h-about', 'このサイトについて')}
<ul class="dots-list"><li>市区町村の補助金は、自治体の公式ページを最優先に調べています。制度ごとに出典と確認日を載せ、公式ページでの確認がまだの情報は区別して表示しています。</li><li>制度が見つからなかった市区町村は、その旨を都道府県のページに書いています。</li><li>金額や期間は変わることがあります。申請の前に、必ず市区町村の窓口でご確認ください。</li></ul>
<div class="links"><a class="nb" href="/policy/"><i aria-hidden="true"></i>編集方針・情報の調べ方 →</a><a class="nb" href="/about/"><i aria-hidden="true"></i>運営者情報 →</a></div></section>
${ctaBlock('<span class="ib">お住まいの地域のリフォーム会社に</span><span class="ib">まとめて無料で見積もり</span>', '無料で見積もりをとる')}
</main>`;
  write('index.html', layout({ title, description, canonical: '/', body, graph: [pageLd({ url: '/', title, description, modified: lastmod })], hasCta: true }));
  write('cities.json', JSON.stringify(live.map((c) => ({ n: c.name, k: c.kana || '', p: c.pref, u: cityUrl(c) }))));
  return { url: '/', lastmod };
}

// ---- 更新履歴 ----
function logPage(ctx) {
  const url = '/koushin/';
  const crumbs = [['更新履歴', url]];
  const events = [];
  for (const c of ctx.cities.filter(indexable)) {
    events.push({ date: c.checked, html: `<a href="${cityUrl(c)}">${esc(c.pref)}${esc(c.name)}</a>の補助金情報を確認しました（${c.programs.length}件）` });
    for (const h of c.history || []) if (h.date !== c.checked || h.note) events.push({ date: h.date, html: `<a href="${cityUrl(c)}">${esc(c.pref)}${esc(c.name)}</a>：${esc(h.note)}` });
  }
  events.push({ date: national.checked, html: '<a href="/kuni/">国の補助金</a>の情報を確認しました' });
  for (const h of config.history || []) events.push({ date: h.date, html: esc(h.note) });
  events.sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastmod = events[0].date;
  const title = `更新履歴｜${config.siteName}`;
  const description = `${config.siteName}の更新履歴。市区町村ごとの補助金情報を確認した日を、新しい順に載せています。`;
  const body = `<div class="hero"><div class="wrap"><div class="crumbs">${crumbHtml(crumbs)}</div><h1>更新履歴</h1>
<p style="color:var(--ink2)">補助金の情報を確認した日を、新しい順に載せています（最新200件）。</p></div></div>
<main class="wrap"><section><ul class="log">${events.slice(0, 200).map((e) => `<li>${timeTag(e.date)}<span>${e.html}</span></li>`).join('')}</ul></section></main>`;
  write('koushin/index.html', layout({ title, description, canonical: url, body, graph: [pageLd({ url, title, description, modified: lastmod }), crumbLd(crumbs)] }));
  return { url, lastmod };
}

// ---- 運営者情報などの固定ページ（本文は src/pages/<slug>.html。1行目のコメントにタイトルなど） ----
function staticPages(sub = 'pages', prefix = '', parent = null) {
  const dir = path.join(ROOT, 'src', sub);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const op = config.operator || {};
  const vars = {
    SITE: esc(config.siteName), URL: SITE, FY: FY_LABEL,
    OPERATOR: esc(op.name || '[要設定]'), PROFILE: esc(op.profile || '[要設定]'), SINCE: esc(op.since || '2026年11月'),
    CONTACT: config.contactUrl ? `<a class="btn-ink" href="${esc(config.contactUrl)}" rel="noopener">お問い合わせフォームを開く</a>` : '<b>[要設定：お問い合わせフォームのURL]</b>'
  };
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html'))) {
    const slug = f.replace(/\.html$/, '');
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
    if (!m) { errors.push(`src/${sub}/${f}: 1行目に <!-- {"title":...} --> がありません`); continue; }
    const meta = JSON.parse(m[1]);
    const url = `${prefix}/${slug}/`;
    const crumbs = parent ? [parent, [meta.title, url]] : [[meta.title, url]];
    const content = raw.slice(m[0].length).replace(/\{\{(\w+)\}\}/g, (all, k) => (k in vars ? vars[k] : all));
    const body = `<div class="hero"><div class="wrap"><div class="crumbs">${crumbHtml(crumbs)}</div><h1>${esc(meta.title)}</h1>
<p class="small muted">最終更新：${timeTag(meta.updated)}</p></div></div>
<main class="wrap"><div class="prose">${content}</div></main>`;
    const title = `${meta.title}｜${config.siteName}`;
    write(`${url.slice(1)}index.html`, layout({ title, description: meta.description, canonical: url, body, graph: [pageLd({ type: meta.type || 'WebPage', url, title, description: meta.description, modified: meta.updated }), crumbLd(crumbs)] }));
    out.push({ url, lastmod: meta.updated, title: meta.title, description: meta.description });
  }
  return out;
}

// ---- データの読み込みと点検 ----
function loadCities() {
  const dir = path.join(ROOT, 'data', 'cities');
  const list = [];
  for (const pref of fs.readdirSync(dir).sort()) {
    for (const f of fs.readdirSync(path.join(dir, pref)).sort()) {
      if (!f.endsWith('.json')) continue;
      const rel = `data/cities/${pref}/${f}`;
      let c;
      try { c = readJson(path.join(dir, pref, f)); } catch (e) { errors.push(`${rel}: JSONとして読めません（${e.message}）`); continue; }
      checkPlace(c, rel);
      if (c.prefSlug !== pref) errors.push(`${rel}: prefSlug がフォルダ名（${pref}）と違います`);
      if (`${c.slug}.json` !== f) errors.push(`${rel}: slug がファイル名と違います`);
      if (CAT_IDS.includes(c.slug) || ['kuni', 'koushin'].includes(c.slug)) errors.push(`${rel}: slug「${c.slug}」は工事ページのURLと重なるので使えません（例：${c.slug}-shi にする）`);
      list.push(c);
    }
  }
  return list;
}
function checkPlace(c, rel) {
  for (const k of ['pref', 'prefSlug', 'name']) if (!c[k]) errors.push(`${rel}: ${k} がありません`);
  if (!isDate(c.checked)) errors.push(`${rel}: checked は YYYY-MM-DD の形で書いてください`);
  else if (c.checked > TODAY) errors.push(`${rel}: checked（${c.checked}）が未来の日付です`);
  if (!Array.isArray(c.programs)) { errors.push(`${rel}: programs がありません（制度なしは []）`); c.programs = []; }
  const ids = new Set();
  for (const p of c.programs) {
    const at = `${rel} > ${p.name || p.id}`;
    for (const k of ['id', 'name', 'summary', 'amountLabel']) if (!p[k]) errors.push(`${at}: ${k} がありません`);
    if (p.id && !/^[a-z0-9-]+$/.test(p.id)) errors.push(`${at}: id は英小文字・数字・ハイフンだけにしてください`);
    if (ids.has(p.id)) errors.push(`${at}: id が重なっています`);
    ids.add(p.id);
    if (!Array.isArray(p.cats) || !p.cats.length) { errors.push(`${at}: cats がありません`); p.cats = []; }
    for (const x of p.cats) if (!CAT_IDS.includes(x)) errors.push(`${at}: cats に知らないID「${x}」があります`);
    if (!['open', 'check', 'ended'].includes(p.status)) errors.push(`${at}: status は open / check / ended のどれかにしてください`);
    if (p.maxNumber != null && typeof p.maxNumber !== 'number') errors.push(`${at}: maxNumber は数値か null にしてください`);
    if (p.period) for (const k of ['start', 'end']) if (p.period[k] != null && !isDate(p.period[k])) errors.push(`${at}: period.${k} は YYYY-MM-DD の形で書いてください`);
    if (!p.source) errors.push(`${at}: source（出典のURL）がありません`);
    else if (!/^https?:\/\//.test(p.source)) errors.push(`${at}: source はURLで書いてください`);
    else if (!isOfficial(p)) warnings.push(`${at}: 出典が公式サイトではありません（${p.source}）。公式ページで確かめ直してください`);
    if (!p.timing) warnings.push(`${at}: timing（before / after）がありません`);
  }
  for (const h of c.history || []) if (!isDate(h.date) || !h.note) errors.push(`${rel}: history は { "date": "YYYY-MM-DD", "note": "..." } の形で書いてください`);
}

// ---- 実行 ----
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const cities = loadCities();
const prefData = new Map();
const prefDir = path.join(ROOT, 'data', 'prefs');
if (fs.existsSync(prefDir)) for (const f of fs.readdirSync(prefDir).filter((x) => x.endsWith('.json'))) {
  const d = readJson(path.join(prefDir, f));
  checkPlace(Object.assign({ name: d.pref }, d), `data/prefs/${f}`);
  prefData.set(d.prefSlug, d);
}
const progressMap = new Map();
const progDir = path.join(ROOT, 'data', 'progress');
if (fs.existsSync(progDir)) for (const f of fs.readdirSync(progDir).filter((x) => x.endsWith('.json'))) {
  const d = readJson(path.join(progDir, f));
  if (d.prefSlug && Array.isArray(d.cities)) progressMap.set(d.prefSlug, d);
}
if (errors.length) {
  console.error(`データに問題があります（${errors.length}件）。直してからもう一度実行してください。\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

// 都道府県ごとにまとめる（並び順は progress の市区町村リストがあればその順）
const prefMap = new Map();
for (const c of cities) {
  if (!prefMap.has(c.prefSlug)) prefMap.set(c.prefSlug, { slug: c.prefSlug, name: c.pref, cities: [] });
  prefMap.get(c.prefSlug).cities.push(c);
}
for (const [slug, d] of prefData) if (!prefMap.has(slug)) prefMap.set(slug, { slug, name: d.pref, cities: [] });
for (const p of prefMap.values()) {
  const order = progressMap.get(p.slug);
  if (order) { const pos = new Map(order.cities.map((x, i) => [x.slug, i])); p.cities.sort((a, b) => (pos.has(a.slug) ? pos.get(a.slug) : 1e9) - (pos.has(b.slug) ? pos.get(b.slug) : 1e9)); }
}
const prefOrder = progress.prefOrder.map((p) => p.slug);
const prefs = [...prefMap.values()].sort((a, b) => prefOrder.indexOf(a.slug) - prefOrder.indexOf(b.slug));
const ctx = { cities: prefs.flatMap((p) => p.cities), prefData, progress: progressMap, prefCatPages: new Set(), livePrefs: [] };
for (const p of prefs) {
  for (const cat of CATS) if (prefCatData(p, cat, ctx).ok) ctx.prefCatPages.add(`${p.slug}/${cat.id}`);
  if (p.cities.some(indexable) || ((prefData.get(p.slug) || {}).programs || []).length) ctx.livePrefs.push(p);
}

const pages = [];
const add = (x) => { if (x) pages.push(x); };
add(topPage(ctx));
for (const p of prefs) {
  add(prefPage(p, ctx));
  for (const cat of CATS) add(prefCatPage(p, cat, ctx));
  for (const c of p.cities) add(cityPage(c, ctx));
}
add(kuniIndex());
for (const p of national.programs) add(kuniPage(p, ctx));
add(logPage(ctx));
staticPages().forEach(add);
const guides = staticPages('guide', '/guide', ['補助金の基礎知識', '/guide/']);
guides.forEach(add);
if (guides.length) {
  const gUrl = '/guide/';
  const gTitle = 'リフォーム補助金の基礎知識';
  const gDesc = 'リフォームの補助金を使う前に知っておきたいことを、やさしく整理しました。';
  const gCrumbs = [['補助金の基礎知識', gUrl]];
  const gLast = guides.map((g) => g.lastmod).sort().pop();
  const gBody = `<div class="hero"><div class="wrap"><div class="crumbs">${crumbHtml(gCrumbs)}</div><h1>${esc(gTitle)}</h1><p style="color:var(--ink2)">${esc(gDesc)}</p></div></div>
<main class="wrap"><section><ul class="grid">${guides.map((g) => `<li class="card"><a class="t" href="${g.url}">${esc(g.title)}</a><span style="color:var(--ink2)">${esc(g.description)}</span></li>`).join('')}</ul></section></main>`;
  write('guide/index.html', layout({ title: `${gTitle}｜${config.siteName}`, description: gDesc, canonical: gUrl, body: gBody, graph: [pageLd({ url: gUrl, title: gTitle, description: gDesc, modified: gLast }), crumbLd(gCrumbs)] }));
  add({ url: gUrl, lastmod: gLast });
}

if (errors.length) { console.error(`- ${errors.join('\n- ')}`); process.exit(1); }

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `<url><loc>${SITE}${p.url}</loc><lastmod>${p.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
write('favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#1C4E6B"/><path d="M10 23l14-11 14 11M14 21.5V37h20V21.5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>\n');
write('_headers', '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/favicon.svg\n  Cache-Control: public, max-age=604800\n/ogp.png\n  Cache-Control: public, max-age=604800\n');
if (OG_IMAGE) fs.copyFileSync(path.join(ROOT, 'src', 'static', 'ogp.png'), path.join(DIST, 'ogp.png'));
write('404.html', layout({ title: `ページが見つかりません｜${config.siteName}`, description: 'ページが見つかりません', noindex: true, body: `<main class="wrap"><section><h1>ページが見つかりません</h1><p>お探しのページは、移動したか、なくなった可能性があります。</p><div class="links"><a class="nb" href="/"><i aria-hidden="true"></i>トップへ戻る →</a><a class="nb" href="/#h-pref"><i aria-hidden="true"></i>都道府県から探す →</a><a class="nb" href="/kuni/"><i aria-hidden="true"></i>国の補助金 →</a></div></section></main>` }));

if (pages.length > 45000) warnings.push('サイトマップのURLが45,000件を超えました。分割が必要です。');
if (warnings.length) console.warn(`注意（${warnings.length}件）：\n- ${warnings.join('\n- ')}`);
const hidden = cities.filter((c) => !indexable(c)).length;
console.log(`生成完了: サイトマップ ${pages.length}ページ（市区町村 ${cities.length}・うち制度なしで非公開 ${hidden}／基準日 ${TODAY}）`);
