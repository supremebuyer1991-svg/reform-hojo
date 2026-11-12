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
// ビルドした日（日本時間）。受付終了・年度の判定に使う。
const TODAY = process.env.BUILD_DATE || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
// 年度（4月はじまり）。config.fiscalYear が "auto"（おすすめ）なら日付から自動で決まる。4けたの数字を書くとその年度に固定される。
const FY_PIN = /^\d{4}$/.test(String(config.fiscalYear || '')) ? Number(config.fiscalYear) : null;
const fyOf = (d) => { if (FY_PIN) return FY_PIN; const [y, m] = d.split('-').map(Number); return m >= 4 ? y : y - 1; };
const NOW_FY = fyOf(TODAY); // 今日が属する年度
const fyLabel = (n) => `${n}年度`;
const fyEra = (n) => `令和${n - 2018}年度`;
// 一覧ページ・トップに出す年度（データを確かめた日のうち、いちばん新しい年度。データを読んだあとに決まる）
let FY = NOW_FY;
let FY_LABEL = fyLabel(FY);
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
const written = new Set();   // 書き出したファイル
const linkRefs = [];         // [書き出したページ, そのページから張っているサイト内リンク]
const pageTitles = new Map(); // タイトルの重なりの点検用
const write = (rel, html) => {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  written.add(rel);
  if (rel.endsWith('.html')) {
    const seen = new Set();
    for (const m of html.matchAll(/ href="(\/[^"#?]*)[^"]*"/g)) if (!seen.has(m[1])) { seen.add(m[1]); linkRefs.push([rel, m[1]]); }
    const t = (html.match(/<title>(.*?)<\/title>/) || [])[1];
    if (t && !/noindex/.test((html.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || '')) pageTitles.set(t, [...(pageTitles.get(t) || []), rel]);
  }
};
for (const p of national.programs) p.national = true;
const kuniSrc = (p) => path.join(ROOT, 'src', 'kuni', `${p.slug}.html`);
// 国の制度ページ：src/kuni/<slug>.html があればそれを使い、無くても national.json に summary と source があればデータから自動で作る
const hasKuniPage = (p) => !!p.slug && (fs.existsSync(kuniSrc(p)) || !!(p.summary && p.source));
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
  Object.assign({ '@type': 'Organization', '@id': ORG_ID, name: config.siteName, url: `${SITE}/`, publishingPrinciples: `${SITE}/policy/` }, OG_IMAGE ? { image: OG_IMAGE } : {}, (config.operator || {}).name ? { founder: { '@type': 'Person', name: config.operator.name, url: `${SITE}/about/` } } : {}),
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
${OG_IMAGE ? `<meta property="og:image" content="${OG_IMAGE}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="${esc(config.siteName)}">` : ''}
<meta name="twitter:card" content="${OG_IMAGE ? 'summary_large_image' : 'summary'}">
${config.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(config.googleSiteVerification)}">` : ''}
<meta name="theme-color" content="#1C4E6B">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/atom+xml" title="${esc(config.siteName)} 更新情報" href="/feed.xml">
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
// checked: その制度を確かめた日（市区町村の checked）。年度をまたいでまだ確かめ直していない制度は「受付中」と言い切らない。
function statusOf(p, checked) {
  const per = p.period || {};
  const fy = isDate(checked) ? fyOf(checked) : NOW_FY;
  if (p.status === 'ended' || (isDate(per.end) && per.end < TODAY)) { const t = p.national ? '受付は終了しました' : `${fyLabel(fy)}の受付は終了`; return { key: 'ended', text: t, html: `<span class="st-end">${t}</span>` }; }
  if (isDate(per.start) && per.start > TODAY) return { key: 'soon', text: `${jdate(per.start)}から受付`, html: `<span class="st-check">${jdate(per.start)}から受付</span>` };
  if (fy < NOW_FY && !p.national && !(isDate(per.end) && per.end >= TODAY)) { const t = `${fyLabel(NOW_FY)}の内容は確認中`; return { key: 'check', text: t, html: `<span class="st-check">${t}</span>` }; }
  if (p.status === 'open') return { key: 'open', text: '受付中', html: '<span class="st-open"><i aria-hidden="true"></i>受付中</span>' };
  const label = p.statusLabel || '受付状況 [要確認]';
  return { key: 'check', text: label, html: `<span class="st-check">${esc(label)}</span>` };
}
const timingText = (p) => (p.timing === 'before' ? '工事の前に申請' : p.timing === 'after' ? '工事（設置）が終わってから申請' : '');
const COMBO = { ok: '一緒に使える', ng: '一緒には使えない', check: '窓口で確認が必要' };

// ---- 制度カード（市・都道府県で共通） ----
function progCard(p, levelLabel, checked) {
  const st = statusOf(p, checked);
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

const natEnded = (p) => statusOf(p).key === 'ended';
const natActive = () => national.programs.filter((p) => !natEnded(p));
const natList = () => `<ul class="nat">${national.programs.map((p) => {
  const href = kuniHref(p);
  const end = natEnded(p);
  return `<li><span style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:2px">${href ? `<a class="serif" style="font-size:22px;line-height:1.5" href="${href}">${esc(p.name)}</a>` : `<span class="serif" style="font-size:22px;line-height:1.5">${esc(p.name)}</span>`}<span style="font-size:16px;color:var(--ink2)">${esc(p.target)}</span></span>${end ? '<span class="st-end">受付は終了しました</span>' : p.maxNumber ? `<span style="display:flex;align-items:baseline;gap:8px"><span class="muted" style="font-weight:700;font-size:15px">最大</span><span class="big">${p.maxNumber}<small>万円</small></span></span>` : `<span class="mid">${esc(p.maxLabel || '')}</span>`}</li>`;
}).join('')}</ul>`;
// ---- ガイド記事へのリンク（データから自動で作る。記事が無ければ何も出ない） ----
const guideLabel = (g) => esc(g.meta.short || g.meta.title);
const guidesFor = (ctx, catId, max) => ctx.guides.filter((g) => (g.meta.cats || []).includes(catId)).slice(0, max || 3);
const guidesGeneral = (ctx, max) => ctx.guides.filter((g) => g.meta.general).slice(0, max || 4);
const guideLinks = (list) => list.map((g) => `<a class="nb" href="${g.url}"><i aria-hidden="true"></i>${guideLabel(g)} →</a>`).join('');
// ページの中身が変わった日（確認日と、受付の開始日・終了日のうち、今日までに来たいちばん新しい日）
const contentDate = (c) => maxDate([c.checked, ...c.programs.flatMap((p) => [p.period && p.period.start, p.period && p.period.end]).filter((d) => isDate(d) && d <= TODAY)]);

const faqHtml = (items) => `<dl class="faq">${items.map((f) => `<div><dt><span class="q" aria-hidden="true">Q</span><span>${esc(f.q)}</span></dt><dd><span class="a" aria-hidden="true">A</span><span>${esc(f.a)}</span></dd></div>`).join('\n')}</dl>`;

const cityUrl = (c) => `/${c.prefSlug}/${c.slug}/`;
const cityCats = (c) => CATS.filter((cat) => c.programs.some((p) => p.cats.includes(cat.id)));
const liveProgs = (c) => c.programs.filter((p) => statusOf(p, c.checked).key !== 'ended');
const cityMax = (c) => Math.max(0, ...liveProgs(c).map((p) => p.maxNumber || 0));
const indexable = (c) => c.programs.length > 0;

// ---- 市区町村ページ ----
function cityPage(city, ctx) {
  const url = cityUrl(city);
  const n = city.programs.length;
  const prefData = ctx.prefData.get(city.prefSlug);
  const prefProgs = (prefData && prefData.programs) || [];
  const myCats = cityCats(city);
  const cMax = cityMax(city);
  const natMax = Math.max(0, ...natActive().map((p) => p.maxNumber || 0));
  const thin = !indexable(city);
  const cfy = fyOf(city.checked);
  const CFY = fyLabel(cfy);
  const oldFy = cfy < NOW_FY; // 新しい年度になってから、まだ確かめ直していない
  const nEnded = n - liveProgs(city).length;
  const stText = (p) => statusOf(p, city.checked);
  const crumbs = [[city.pref, `/${city.prefSlug}/`], [city.name, url]];

  // 工事カテゴリごとの結果（HTMLに最初から書き出す。JSは表示の切り替えだけ）
  const row = (r) => `<li><span class="top"><b>${esc(r.name)}</b><span class="amt">${esc(r.amt)}</span></span><span class="note">${esc(r.note)}</span>${r.href ? `<a href="${r.href}">くわしく見る →</a>` : ''}</li>`;
  const rowsHtml = (list, none) => (list.length ? `<ul class="rows">${list.map(row).join('')}</ul>` : `<p class="none">${esc(none)}</p>`);
  const panels = CATS.map((c) => {
    const cityRows = city.programs.filter((p) => p.cats.includes(c.id)).map((p) => ({ name: p.name, amt: p.amountLabel, note: (stText(p).key === 'ended' ? `【${stText(p).text}】` : '') + ((p.catNotes && p.catNotes[c.id]) || p.summary), href: `#p-${p.id}` }));
    const prefRows = prefProgs.filter((p) => p.cats.includes(c.id)).map((p) => ({ name: p.name, amt: p.amountLabel, note: (p.catNotes && p.catNotes[c.id]) || p.summary, href: `/${city.prefSlug}/#p-${p.id}` }));
    const kuniRows = national.programs.filter((p) => p.cats.includes(c.id)).map((p) => ({ name: p.name, amt: natEnded(p) ? '受付終了' : p.maxLabel, note: (natEnded(p) ? '【受付は終了しました】' : '') + p.target, href: kuniHref(p) }));
    // その工事そのものの制度ではないが、条件つきで対象になることがある国の制度（national.json の extraCats）
    for (const m of natActive()) { const x = m.extraCats && m.extraCats[c.id]; if (x) kuniRows.push({ name: x.label || m.name, amt: x.amt || '', note: x.note || '', href: kuniHref(m) }); }
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
${(() => { const g = guidesFor(ctx, x.c.id, 2); const pc = ctx.prefCatPages.has(`${city.prefSlug}/${x.c.id}`); return g.length || pc ? `<div class="result-guide"><span class="small muted" style="font-weight:700">あわせて見る</span>${g.map((y) => `<a href="${y.url}">${guideLabel(y)}</a>`).join('')}${pc ? `<a href="/${city.prefSlug}/${x.c.id}/">${esc(city.pref)}の市区町村で${esc(x.c.short)}の補助金を見比べる</a>` : ''}</div>` : ''; })()}
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
    faq.push({ q: `${city.name}の「${p.name}」は、いくら補助されますか？`, a: `補助額は、${amount}です。${period ? `申請期間は${period}。` : ''}${timingText(p) ? `${timingText(p)}します。` : ''}（${jdate(city.checked)}確認・${statusOf(p, city.checked).text}）` });
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
    const t = `${city.name}のリフォーム補助金【${CFY}】${myCats.slice(0, 4).map((c) => c.short).join('・')}`;
    return t.length <= 34 ? `${t}｜${config.siteName}` : t;
  })();
  const description = n
    ? `${city.pref}${city.name}の${CFY}（${fyEra(cfy)}）のリフォーム補助金の一覧。市の制度${n}件${nEnded ? `（うち${nEnded}件は受付終了）` : cMax ? `（最大${cMax}万円）` : ''}と国の制度を、${catNames.join('、')}など工事別に整理。申請の時期・窓口・出典つき。${jdate(city.checked)}確認。`
    : `${city.pref}${city.name}で使えるリフォーム補助金。${jdate(city.checked)}の時点で市独自の制度は見つかっていませんが、国の制度は使えます。`;
  const lead = n
    ? `${city.name}のリフォーム向け補助金は、確認できた範囲で${n}件（${catNames.join('、')}）${nEnded ? `。うち${nEnded}件は${CFY}の受付を終えています` : ''}。国の制度とあわせて、工事ごとに申請の時期と窓口を整理しました。`
    : `${city.name}が独自に行っているリフォーム向けの補助金は、${jdate(city.checked)}の時点では見つかっていません。国の制度は${city.name}でも使えます。`;
  const stale = (new Date(TODAY) - new Date(city.checked)) / 86400000 > 150;
  const history = (city.history || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));

  const body = `<div class="hero"><div class="wrap">
<div class="crumbs">${crumbHtml(crumbs)}${PR_NOTE}</div>
<div class="hero-row"><div class="hero-main">
<div class="hero-title"><div class="plate" aria-hidden="true"><div><i></i><span class="p">${esc(city.pref)}</span><span class="c">${esc(city.name)}</span><i></i></div></div>
<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:16px;padding-top:4px"><span class="small muted" style="font-weight:700;letter-spacing:.08em">${CFY}（${fyEra(cfy)}）版 ／ 市と国の制度を1ページに</span>
<h1><span style="display:block">${esc(city.name)}の</span><span class="ib">リフォーム補助金</span><span class="ib">まとめ<span class="yr">${CFY}</span></span></h1>
<p style="color:var(--ink2);max-width:520px">${city.kana ? `${esc(city.name)}（${esc(city.kana)}）。` : ''}${esc(lead)}${city.lead ? esc(city.lead) : ''}</p></div></div>
<div class="btn-row"><a class="btn-ink" href="#sagasu">やりたい工事から調べる</a><a class="btn-line" href="#mitsumori">補助金が使えるか無料で見積もり ${svgArrow}</a></div>
</div>
<div class="ledger">${stamp(city.checked)}<p class="small muted" style="font-weight:700;margin:0 96px 14px 0;letter-spacing:.06em">${esc(city.name)}のあらまし</p>
<dl><div><dt>市の制度</dt><span class="dots" aria-hidden="true"></span><dd>${n}<small>件</small></dd></div>
${cMax ? `<div><dt>市の補助 <span class="small muted">最大</span></dt><span class="dots" aria-hidden="true"></span><dd>${cMax}<small>万円</small></dd></div>` : ''}
${natMax ? `<div><dt>国の補助 <span class="small muted">最大</span></dt><span class="dots" aria-hidden="true"></span><dd>${natMax}<small>万円</small></dd></div>` : ''}</dl>
<p class="small muted" style="margin-top:14px">情報の確認日：${timeTag(city.checked)}（<a href="#shutten">出典を見る</a>）</p>
${oldFy ? `<p class="small" style="color:var(--shu-d);font-weight:700">このページは${CFY}（${fyEra(cfy)}）の情報です。${fyLabel(NOW_FY)}の内容は、市の発表を確認でき次第、更新します。</p>` : stale ? '<p class="small" style="color:var(--shu-d);font-weight:700">確認から時間がたっています。最新の状況は市の公式ページでお確かめください。</p>' : ''}</div>
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
${n ? city.programs.map((p) => progCard(p, '市の制度', city.checked)).join('\n') : `<p>${esc(city.name)}が独自に行っている、個人の住宅のリフォーム向けの補助金は、${timeTag(city.checked)}の時点では見つかっていません。年度の途中で始まることもあるため、最新の情報は市の公式ページでお確かめください。</p>`}
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
${guidesGeneral(ctx).length ? `<div class="links"><span class="muted" style="font-size:15px">申請の前に読む：</span>${guideLinks(guidesGeneral(ctx))}</div>` : ''}
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
    Object.assign(crumbLd(crumbs), { '@id': `${SITE}${url}#crumbs` }),
    { '@type': 'FAQPage', '@id': `${SITE}${url}#faq`, url: SITE + url, inLanguage: 'ja', isPartOf: { '@id': `${SITE}${url}#page` }, mainEntity: faq.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) }
  ];
  write(`${city.prefSlug}/${city.slug}/index.html`, layout({ title, description, canonical: url, body, graph, noindex: thin, hasCta: true }));
  return thin ? null : { url, lastmod: contentDate(city) };
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
  const lastmod = maxDate([...pref.cities.map(contentDate), prefData && prefData.checked]);
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
${live.length ? `<ul class="nat">${live.map((c) => `<li><span style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:2px"><a class="serif" style="font-size:22px;line-height:1.5" href="${cityUrl(c)}">${esc(c.name)}のリフォーム補助金</a><span style="font-size:16px;color:var(--ink2)">${esc(cityCats(c).map((x) => x.name.replace(/（.*）/, '')).join('、'))}　／　${timeTag(c.checked)}確認${fyOf(c.checked) < FY ? `（${fyLabel(fyOf(c.checked))}の情報）` : ''}</span></span><span class="mid">${c.programs.length}<small>件</small>${cityMax(c) ? `　最大${cityMax(c)}<small>万円</small>` : ''}</span></li>`).join('')}</ul>` : '<p>掲載の準備中です。</p>'}
${none.length ? `<p class="small muted">調べたものの、市区町村独自のリフォーム向け制度が見つからなかった地域：${none.map((c) => esc(c.name)).join('、')}（国の制度は使えます）</p>` : ''}
</section>
${cats.length ? `<section aria-labelledby="h-cat">${secHead('h-cat', `${esc(pref.name)}の補助金を工事から探す`, '市区町村ごとの金額を見比べられます')}
<div class="links">${cats.map((c) => `<a class="nb" href="/${pref.slug}/${c.id}/"><i aria-hidden="true"></i>${esc(c.h)}の補助金 →</a>`).join('')}</div></section>` : ''}
${prefProgs.length ? `<section id="ken" aria-labelledby="h-ken">${secHead('h-ken', `${esc(pref.name)}の補助金`, `${esc(pref.name)}が行っている制度（${prefProgs.length}件）`)}
${prefProgs.map((p) => progCard(p, `${pref.name}の制度`, prefData.checked)).join('\n')}
<p class="small muted">情報の確認日：${timeTag(prefData.checked)}</p></section>` : ''}
<section aria-labelledby="h-kuni">${secHead('h-kuni', `${esc(pref.name)}でも使える国の補助金`, '全国共通の制度')}
${natList()}
</section>
${ctx.guides.length ? `<section aria-labelledby="h-guide">${secHead('h-guide', '補助金を使う前に知っておきたいこと', '<a href="/guide/">基礎知識の一覧</a>')}
<div class="links">${guideLinks([...guidesGeneral(ctx, 3), ...cats.flatMap((c) => guidesFor(ctx, c.id, 1))].filter((g, i, a) => a.indexOf(g) === i).slice(0, 8))}</div></section>` : ''}
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
  const lastmod = maxDate(d.rows.map((r) => contentDate(r.c)));
  const kuni = natActive().filter((p) => p.cats.includes(cat.id));
  const catGuides = guidesFor(ctx, cat.id, 4);
  const title = `${pref.name}の${cat.h}補助金｜市区町村別の一覧【${FY_LABEL}】`;
  const description = `${pref.name}で${cat.h}に使える補助金を、市区町村ごとに金額・申請の時期・受付状況で見比べられる一覧。${d.cityCount}市区町村・${d.rows.length}制度を掲載。${jdate(lastmod)}更新。`;
  const body = `<div class="hero"><div class="wrap"><div class="crumbs">${crumbHtml(crumbs)}${PR_NOTE}</div>
<h1>${esc(pref.name)}の<span class="ib">${esc(cat.h)}の補助金</span><span class="yr">${FY_LABEL}</span></h1>
<p style="color:var(--ink2);max-width:680px">${esc(pref.name)}の市区町村が行っている、${esc(cat.h)}に使える補助金の一覧です。当サイトが調べた${pref.cities.length}市区町村のうち、${d.cityCount}市区町村で${d.rows.length}件の制度を確認しています（${timeTag(lastmod)}更新）。</p></div></div>
<main class="wrap">
<section aria-labelledby="h-list">${secHead('h-list', `市区町村ごとの${esc(cat.h)}補助金`, '市区町村名を押すと、くわしい条件が見られます')}
<ul class="nat">${d.rows.map(({ c, p }) => `<li><span style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:2px"><a class="serif" style="font-size:22px;line-height:1.5" href="${cityUrl(c)}#${cat.id}">${esc(c.name)}</a><span style="font-size:16px;color:var(--ink2)">${esc(p.name)}</span><span class="small muted">${esc([statusOf(p, c.checked).text, timingText(p), `${jdate(c.checked)}確認`].filter(Boolean).join('　／　'))}</span></span><span class="mid">${esc(p.amountLabel)}</span></li>`).join('')}</ul>
${without.length ? `<p class="small muted">${esc(cat.h)}向けの市区町村独自の制度が見つかっていない地域：${without.map((c) => esc(c.name)).join('、')}</p>` : ''}
</section>
${d.prefProgs.length ? `<section aria-labelledby="h-ken">${secHead('h-ken', `${esc(pref.name)}の制度`)}
<ul class="nat">${d.prefProgs.map((p) => `<li><span style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:2px"><a class="serif" style="font-size:22px;line-height:1.5" href="/${pref.slug}/#p-${esc(p.id)}">${esc(p.name)}</a><span style="font-size:16px;color:var(--ink2)">${esc(p.summary)}</span></span><span class="mid">${esc(p.amountLabel)}</span></li>`).join('')}</ul></section>` : ''}
${kuni.length ? `<section aria-labelledby="h-kuni">${secHead('h-kuni', `${esc(cat.h)}に使える国の補助金`, '全国共通の制度')}
<ul class="nat">${kuni.map((p) => `<li><span style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:2px">${kuniHref(p) ? `<a class="serif" style="font-size:22px;line-height:1.5" href="${kuniHref(p)}">${esc(p.name)}</a>` : `<span class="serif" style="font-size:22px;line-height:1.5">${esc(p.name)}</span>`}<span style="font-size:16px;color:var(--ink2)">${esc(p.target)}</span></span><span class="mid">${esc(p.maxLabel)}</span></li>`).join('')}</ul></section>` : ''}
${catGuides.length ? `<section aria-labelledby="h-guide">${secHead('h-guide', `${esc(cat.h)}の補助金の基礎知識`)}
<ul class="grid">${catGuides.map((g) => `<li class="card"><a class="t" href="${g.url}">${esc(g.meta.title)}</a><span style="color:var(--ink2);font-size:16px">${esc(g.meta.description)}</span></li>`).join('')}</ul></section>` : ''}
${ctaBlock(`<span class="ib">${esc(pref.name)}対応のリフォーム会社に</span><span class="ib">まとめて無料で見積もり</span>`, '無料で見積もりをとる')}
<section aria-labelledby="h-more">${secHead('h-more', `${esc(pref.name)}のほかの工事の補助金`)}
<div class="links">${CATS.filter((c) => c.id !== cat.id && ctx.prefCatPages.has(`${pref.slug}/${c.id}`)).map((c) => `<a class="nb" href="/${pref.slug}/${c.id}/"><i aria-hidden="true"></i>${esc(c.h)} →</a>`).join('')}<a class="nb" href="/${pref.slug}/"><i aria-hidden="true"></i>${esc(pref.name)}の市区町村一覧 →</a></div></section>
</main>`;
  const graph = [pageLd({ type: 'CollectionPage', url, title, description, modified: lastmod, extra: { breadcrumb: { '@id': `${SITE}${url}#crumbs` } } }), Object.assign(crumbLd(crumbs), { '@id': `${SITE}${url}#crumbs` })];
  write(`${pref.slug}/${cat.id}/index.html`, layout({ title, description, canonical: url, body, graph, hasCta: true }));
  return { url, lastmod };
}

// ---- 国の制度ページ（本文は src/kuni/<slug>.html。無ければ data/national.json の内容から自動で作る） ----
// 記事の著者は、発行の責任を持つ運営者（サイト）として示す
const AUTHOR = () => ({ '@id': ORG_ID });
const uniq = (x, i, a) => a.indexOf(x) === i;
function kuniPage(p, ctx) {
  if (!hasKuniPage(p)) return null;
  const url = `/kuni/${p.slug}/`;
  const crumbs = [['国の補助金', '/kuni/'], [p.name, url]];
  const per = p.period || {};
  const ended = natEnded(p);
  const suc = national.programs.find((x) => x.slug && x.slug === p.successor && hasKuniPage(x));
  const related = [...ctx.guides.filter((g) => (g.meta.kuni || []).includes(p.slug)), ...p.cats.flatMap((c) => guidesFor(ctx, c, 2))].filter(uniq).slice(0, 6);
  const banner = ended ? `<div class="warn" role="note">${svgWarn}<span>${esc(p.name)}の受付は終了しました${isDate(per.end) ? `（${jdate(per.end)}まで）` : ''}。このページは記録として残しています。${suc ? `後継の制度は<a href="/kuni/${suc.slug}/">${esc(suc.name)}</a>です。` : 'いま使える制度は<a href="/kuni/">国の補助金の一覧</a>をご覧ください。'}</span></div>` : '';
  const areas = `<section aria-labelledby="h-area">${secHead('h-area', 'お住まいの市区町村の補助金も調べる', '国の制度と一緒に使える場合があります')}
<p style="color:var(--ink2)">市区町村が独自に出している補助金は、地域によって金額も条件も違います。都道府県を選んで、お住まいの市区町村のページをご覧ください。</p>
<div class="links">${ctx.livePrefs.map((x) => `<a class="nb" href="/${x.slug}/"><i aria-hidden="true"></i>${esc(x.name)} →</a>`).join('')}<a class="nb" href="/#h-pref"><i aria-hidden="true"></i>都道府県の一覧 →</a></div></section>
${related.length ? `<section aria-labelledby="h-guide">${secHead('h-guide', 'あわせて読みたい基礎知識')}
<div class="links">${guideLinks(related)}</div></section>` : ''}`;
  const cta = ctaBlock(ended ? '<span class="ib">いま使える補助金を、</span><span class="ib">見積もりのときに無料で相談</span>' : '<span class="ib">締め切りに間に合う業者を、</span><span class="ib">まとめて無料で探す</span>', '見積もりをとる');
  let inner;
  if (fs.existsSync(kuniSrc(p))) {
    inner = fs.readFileSync(kuniSrc(p), 'utf8')
      .replace(/\{\{CRUMBS\}\}/g, crumbHtml(crumbs))
      .replace(/\{\{CTA\}\}/g, cta)
      .replace(/\{\{STAMP\}\}/g, stamp(national.checked))
      .replace(/\{\{AREAS\}\}/g, areas)
      .replace(/\{\{CHECKED\}\}/g, timeTag(national.checked));
    if (banner) inner = inner.replace('<main class="wrap">', `<main class="wrap">\n${banner}`);
  } else {
    inner = `<div class="hero"><div class="wrap"><div class="crumbs">${crumbHtml(crumbs)}${PR_NOTE}</div>
<h1><span style="display:block">${esc(p.name)}</span>${p.maxLabel ? `<span class="ib" style="font-size:.62em">${esc(p.maxLabel)}</span>` : ''}</h1>
<p style="color:var(--ink2);max-width:680px">${esc(p.summary)}</p>
<p class="small muted">国の制度（全国共通）　／　情報の確認日：${timeTag(national.checked)}</p></div></div>
<main class="wrap">
${banner}
<section aria-labelledby="h-gaiyo">${secHead('h-gaiyo', `${esc(p.name)}のあらまし`, esc(p.target || ''))}
${progCard(Object.assign({ amountLabel: p.maxLabel || '' }, p), '国の制度（全国共通）')}
</section>
${cta}
${areas}
<p class="small muted">情報の確認日：${timeTag(national.checked)}。調べ方は<a href="/policy/">編集方針・情報の調べ方</a>へ。</p>
</main>`;
  }
  const title = ended ? `${p.name}とは？【受付終了】補助額・対象工事のまとめ` : (p.title || `${p.name}とは？補助額・対象工事・申請期限【${p.maxLabel}】`);
  const description = (ended ? '受付は終了しました。' : '') + (p.description || `${p.name}事業の対象工事（${p.target}）、補助額（${p.maxLabel}）、申請期限、ほかの補助金との併用を、やさしい言葉で整理しました。${jdate(national.checked)}確認。`);
  const lastmod = maxDate([national.checked, isDate(per.end) && per.end <= TODAY ? per.end : null]);
  const graph = [
    Object.assign({ '@type': 'Article', '@id': `${SITE}${url}#page`, headline: title, description, inLanguage: 'ja', mainEntityOfPage: SITE + url, datePublished: p.published || national.checked, dateModified: lastmod, author: AUTHOR(), publisher: { '@id': ORG_ID }, isPartOf: { '@id': WEB_ID } }, OG_IMAGE ? { image: OG_IMAGE } : {}),
    crumbLd(crumbs)
  ];
  write(`kuni/${p.slug}/index.html`, layout({ title, description, canonical: url, body: inner, graph, hasCta: true, ogType: 'article' }));
  return { url, lastmod };
}
function kuniIndex(ctx) {
  const url = '/kuni/';
  const crumbs = [['国の補助金', url]];
  const act = natActive();
  const title = `国のリフォーム補助金の一覧【${FY_LABEL}】｜${config.siteName}`;
  const description = `全国どこでも使える国のリフォーム補助金（${(act.length ? act : national.programs).map((p) => p.name).join('・')}）の一覧。対象の工事と上限額、受付の状況を整理しています。${jdate(national.checked)}確認。`;
  const gl = [...national.programs.flatMap((p) => ctx.guides.filter((g) => (g.meta.kuni || []).includes(p.slug))), ...guidesGeneral(ctx, 3)].filter(uniq).slice(0, 8);
  const body = `<div class="hero"><div class="wrap"><div class="crumbs">${crumbHtml(crumbs)}${PR_NOTE}</div>
<h1>国のリフォーム補助金<span class="yr">${FY_LABEL}</span></h1>
<p style="color:var(--ink2);max-width:680px">全国どこに住んでいても使える、国のリフォーム補助金の一覧です。市区町村の補助金と一緒に使える場合もあります（情報の確認日：${timeTag(national.checked)}）。</p></div></div>
<main class="wrap"><section aria-labelledby="h-kuni">${secHead('h-kuni', '国の補助金の一覧', '制度名を押すと、くわしい説明が見られます')}
${natList()}
${national.programs.some((p) => !hasKuniPage(p)) ? '<p class="small muted">リンクのない制度は、くわしい説明ページを準備中です。</p>' : ''}
${act.length < national.programs.length ? '<p class="small muted">受付が終わった制度も、記録として残しています。後継の制度が発表されたら、この一覧に追加します。</p>' : ''}</section>
${gl.length ? `<section aria-labelledby="h-guide">${secHead('h-guide', '国の補助金の基礎知識', '<a href="/guide/">基礎知識の一覧</a>')}<div class="links">${guideLinks(gl)}</div></section>` : ''}
<section aria-labelledby="h-pref">${secHead('h-pref', '市区町村の補助金も調べる')}<div class="links">${ctx.livePrefs.map((x) => `<a class="nb" href="/${x.slug}/"><i aria-hidden="true"></i>${esc(x.name)} →</a>`).join('')}<a class="nb" href="/#h-pref"><i aria-hidden="true"></i>都道府県から探す →</a></div></section>
</main>`;
  const lastmod = maxDate([national.checked, ...national.programs.map((p) => p.period && p.period.end).filter((d) => isDate(d) && d <= TODAY)]);
  write('kuni/index.html', layout({ title, description, canonical: url, body, graph: [pageLd({ type: 'CollectionPage', url, title, description, modified: lastmod }), crumbLd(crumbs)] }));
  return { url, lastmod };
}

// ---- トップページ ----
function topPage(ctx) {
  const live = ctx.cities.filter(indexable);
  const progCount = live.reduce((s, c) => s + c.programs.length, 0);
  const lastmod = maxDate([...ctx.cities.map(contentDate), national.checked, ...ctx.guides.map((g) => g.meta.updated)]);
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
${ctx.guides.length ? `<section aria-labelledby="h-guide">${secHead('h-guide', '補助金の基礎知識', `<a href="/guide/">${ctx.guides.length}本の記事をすべて見る</a>`)}
<ul class="grid">${ctx.guides.slice(0, 6).map((g) => `<li class="card"><a class="t" href="${g.url}">${esc(g.meta.title)}</a><span style="color:var(--ink2);font-size:16px">${esc(g.meta.description)}</span></li>`).join('')}</ul>
${ctx.guides.length > 6 ? `<div class="links">${guideLinks(ctx.guides.slice(6))}</div>` : ''}</section>` : ''}
<section aria-labelledby="h-about">${secHead('h-about', 'このサイトについて')}
<ul class="dots-list"><li>市区町村の補助金は、自治体の公式ページを最優先に調べています。制度ごとに出典と確認日を載せ、公式ページでの確認がまだの情報は区別して表示しています。</li><li>制度が見つからなかった市区町村は、その旨を都道府県のページに書いています。</li><li>金額や期間は変わることがあります。申請の前に、必ず市区町村の窓口でご確認ください。</li></ul>
<div class="links"><a class="nb" href="/policy/"><i aria-hidden="true"></i>編集方針・情報の調べ方 →</a><a class="nb" href="/about/"><i aria-hidden="true"></i>運営者情報 →</a></div></section>
${ctaBlock('<span class="ib">お住まいの地域のリフォーム会社に</span><span class="ib">まとめて無料で見積もり</span>', '無料で見積もりをとる')}
</main>`;
  write('index.html', layout({ title, description, canonical: '/', body, graph: [pageLd({ url: '/', title, description, modified: lastmod })], hasCta: true }));
  write('cities.json', JSON.stringify(live.map((c) => ({ n: c.name, k: c.kana || '', p: c.pref, u: cityUrl(c) }))));
  return { url: '/', lastmod };
}

// ---- 更新履歴（ページとフィードで同じものを使う） ----
function buildEvents(ctx) {
  const events = [];
  for (const c of ctx.cities.filter(indexable)) {
    events.push({ date: c.checked, url: cityUrl(c), label: `${c.pref}${c.name}`, rest: `の補助金情報を確認しました（${c.programs.length}件）` });
    for (const h of c.history || []) if (h.date !== c.checked || h.note) events.push({ date: h.date, url: cityUrl(c), label: `${c.pref}${c.name}`, rest: `：${h.note}` });
  }
  events.push({ date: national.checked, url: '/kuni/', label: '国の補助金', rest: 'の情報を確認しました' });
  for (const g of ctx.guides) {
    events.push({ date: g.meta.published, url: g.url, label: `基礎知識「${g.meta.title}」`, rest: 'を公開しました' });
    if (g.meta.updated > g.meta.published) events.push({ date: g.meta.updated, url: g.url, label: `基礎知識「${g.meta.title}」`, rest: 'を更新しました' });
  }
  for (const h of config.history || []) events.push({ date: h.date, url: '/koushin/', label: '', rest: h.note });
  // 同じ日の中では、もとの並び（都道府県・市区町村の順）を保つ
  return events.map((e, i) => [e, i]).sort((a, b) => (a[0].date < b[0].date ? 1 : a[0].date > b[0].date ? -1 : a[1] - b[1])).map((x) => x[0]);
}
function logPage(ctx) {
  const url = '/koushin/';
  const crumbs = [['更新履歴', url]];
  const events = ctx.events;
  const lastmod = events[0].date;
  const title = `更新履歴｜${config.siteName}`;
  const description = `${config.siteName}の更新履歴。市区町村ごとの補助金情報を確認した日と、基礎知識の記事を公開・更新した日を、新しい順に載せています。`;
  const body = `<div class="hero"><div class="wrap"><div class="crumbs">${crumbHtml(crumbs)}</div><h1>更新履歴</h1>
<p style="color:var(--ink2)">補助金の情報を確認した日と、記事を公開・更新した日を、新しい順に載せています（最新200件）。<a href="/feed.xml">フィード（Atom）</a>でも受け取れます。</p></div></div>
<main class="wrap"><section><ul class="log">${events.slice(0, 200).map((e) => `<li>${timeTag(e.date)}<span>${e.label ? `<a href="${e.url}">${esc(e.label)}</a>` : ''}${esc(e.rest)}</span></li>`).join('')}</ul></section></main>`;
  write('koushin/index.html', layout({ title, description, canonical: url, body, graph: [pageLd({ url, title, description, modified: lastmod }), crumbLd(crumbs)] }));
  return { url, lastmod };
}
function feed(ctx) {
  const seen = new Map();
  const entries = ctx.events.slice(0, 40).map((e) => {
    const k = `${e.url}#${e.date}`; const nth = (seen.get(k) || 0) + 1; seen.set(k, nth);
    return `<entry><title>${esc(e.label + e.rest)}</title><link href="${SITE}${e.url}"/><id>${SITE}${k}${nth > 1 ? `-${nth}` : ''}</id><updated>${e.date}T00:00:00+09:00</updated><summary>${esc(e.label + e.rest)}</summary></entry>`;
  });
  write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ja">\n<title>${esc(config.siteName)} 更新情報</title>\n<subtitle>市区町村と国のリフォーム補助金の確認・更新の記録</subtitle>\n<link href="${SITE}/"/>\n<link rel="self" type="application/atom+xml" href="${SITE}/feed.xml"/>\n<id>${SITE}/</id>\n<updated>${ctx.events[0].date}T00:00:00+09:00</updated>\n<author><name>${esc((config.operator || {}).name || config.siteName)}</name></author>\n${entries.join('\n')}\n</feed>\n`);
}

// ---- 運営者情報などの固定ページ（本文は src/pages/<slug>.html。1行目のコメントにタイトルなど） ----
const pageVars = () => {
  const op = config.operator || {};
  return {
    SITE: esc(config.siteName), URL: SITE, FY: FY_LABEL,
    OPERATOR: esc(op.name || '[要設定]'), PROFILE: esc(op.profile || '[要設定]'), SINCE: esc(op.since || '2026年11月'),
    CONTACT: config.contactUrl ? `<a class="btn-ink" href="${esc(config.contactUrl)}" rel="noopener">お問い合わせフォームを開く</a>` : '<b>[要設定：お問い合わせフォームのURL]</b>'
  };
};
const readSrcPage = (sub, f) => {
  const raw = fs.readFileSync(path.join(ROOT, 'src', sub, f), 'utf8');
  const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
  if (!m) { errors.push(`src/${sub}/${f}: 1行目に <!-- {"title":...} --> がありません`); return null; }
  let meta;
  try { meta = JSON.parse(m[1]); } catch (e) { errors.push(`src/${sub}/${f}: 1行目のJSONが読めません（${e.message}）`); return null; }
  for (const k of ['title', 'description']) if (!meta[k]) errors.push(`src/${sub}/${f}: ${k} がありません`);
  if (!isDate(meta.updated)) errors.push(`src/${sub}/${f}: updated は YYYY-MM-DD の形で書いてください`);
  return { slug: f.replace(/\.html$/, ''), meta, content: raw.slice(m[0].length) };
};
function staticPages() {
  const dir = path.join(ROOT, 'src', 'pages');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const vars = pageVars();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html')).sort()) {
    const pg = readSrcPage('pages', f);
    if (!pg) continue;
    const { slug, meta } = pg;
    const url = `/${slug}/`;
    const crumbs = [[meta.title, url]];
    const content = pg.content.replace(/\{\{(\w+)\}\}/g, (all, k) => (k in vars ? vars[k] : all));
    const body = `<div class="hero"><div class="wrap"><div class="crumbs">${crumbHtml(crumbs)}</div><h1>${esc(meta.title)}</h1>
<p class="small muted">最終更新：${timeTag(meta.updated)}</p></div></div>
<main class="wrap"><div class="prose">${content}</div></main>`;
    const title = `${meta.title}｜${config.siteName}`;
    write(`${url.slice(1)}index.html`, layout({ title, description: meta.description, canonical: url, body, graph: [pageLd({ type: meta.type || 'WebPage', url, title, description: meta.description, modified: meta.updated }), crumbLd(crumbs)] }));
    out.push({ url, lastmod: meta.updated });
  }
  return out;
}

// ---- ガイド記事（本文は src/guide/<slug>.html。1行目のコメントにタイトルなど） ----
// 1行目のJSON： title / description / updated は必須。
//   published（公開日。無ければ updated） / short（リンクに使う短い名前） / order（小さいほど先に並ぶ）
//   cats（関係する工事のID。市区町村ページのその工事の欄からリンクされる） / kuni（関係する国の制度の slug）
//   general（true なら、すべての市区町村ページの「申請の流れ」からリンクされる） / sources（出典 [{ "name", "url" }]）
// 本文で使える差し込み（データから自動で作られ、データが増えると中身も増える。該当が無ければ何も出ない）：
//   {{EXAMPLES:工事ID|見出し}} … その工事の制度の件数と、市区町村の例、都道府県別の一覧へのリンク
//   {{MATCH:正規表現|見出し}} … 制度名が合うものの例（例：空き家|空家）
//   {{FIELD:項目名|見出し}} … その項目（contractor / docs / combo / lastYear）が書かれている制度の例
//   {{TIMING:工事ID}} … 「工事の前に申請」「あとに申請」の件数（工事IDを省くと全体）
function loadGuides() {
  const dir = path.join(ROOT, 'src', 'guide');
  if (!fs.existsSync(dir)) return [];
  const list = [];
  const slugs = new Set(national.programs.map((p) => p.slug));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html')).sort()) {
    const g = readSrcPage('guide', f);
    if (!g) continue;
    const at = `src/guide/${f}`;
    g.meta.published = g.meta.published || g.meta.updated;
    if (!isDate(g.meta.published)) errors.push(`${at}: published は YYYY-MM-DD の形で書いてください`);
    else if (isDate(g.meta.updated) && g.meta.published > g.meta.updated) errors.push(`${at}: published が updated より後になっています`);
    for (const c of g.meta.cats || []) if (!CAT_IDS.includes(c)) errors.push(`${at}: cats に知らないID「${c}」があります`);
    for (const k of g.meta.kuni || []) if (!slugs.has(k)) errors.push(`${at}: kuni に、data/national.json に無い slug「${k}」があります`);
    for (const x of g.meta.sources || []) if (!x.name || !/^https:\/\//.test(x.url || '')) errors.push(`${at}: sources は { "name": "...", "url": "https://..." } の形で書いてください`);
    g.url = `/guide/${g.slug}/`;
    list.push(g);
  }
  return list.sort((a, b) => (a.meta.order || 999) - (b.meta.order || 999) || (a.slug < b.slug ? -1 : 1));
}
// 記事に出す例の選び方：公式の出典があり、受付が終わっていない制度だけ。都道府県がかたよらないよう順番に1件ずつ取る。
function pickExamples(ctx, test, max) {
  const rank = { open: 0, soon: 1, check: 2 };
  const byPref = new Map();
  let total = 0; const cityHit = new Set(); let last = '';
  for (const c of ctx.cities) {
    if (!indexable(c)) continue;
    for (const p of c.programs) {
      if (!test(p, c)) continue;
      total++; cityHit.add(`${c.prefSlug}/${c.slug}`); if (c.checked > last) last = c.checked;
      const st = statusOf(p, c.checked).key;
      if (st === 'ended' || !isOfficial(p)) continue;
      if (!byPref.has(c.prefSlug)) byPref.set(c.prefSlug, []);
      byPref.get(c.prefSlug).push({ c, p, k: [rank[st], p.cats.length, -(p.maxNumber || 0), c.slug, p.id] });
    }
  }
  const cmp = (a, b) => { for (let i = 0; i < a.k.length; i++) if (a.k[i] !== b.k[i]) return a.k[i] < b.k[i] ? -1 : 1; return 0; };
  const lanes = [...byPref.values()].map((l) => {
    l.sort(cmp);
    // 同じ市が続かないようにする
    const out = []; const used = new Set();
    for (const x of l) if (!used.has(x.c.slug)) { used.add(x.c.slug); out.push(x); }
    return out;
  });
  const items = [];
  for (let i = 0; items.length < max && lanes.some((l) => l[i]); i++) for (const l of lanes) if (l[i] && items.length < max) items.push(l[i]);
  return { items, total, cities: cityHit.size, last };
}
const exList = (items, extra) => `<ul class="nat">${items.map(({ c, p }) => `<li><span style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:2px"><a class="serif" style="font-size:20px;line-height:1.5" href="${cityUrl(c)}#p-${esc(p.id)}">${esc(c.pref)}${esc(c.name)}</a><span style="font-size:16px;color:var(--ink2)">${esc(p.name)}</span>${extra ? `<span style="font-size:16px"><b>${esc(extra(p))}</b></span>` : ''}<span class="small muted">${esc(statusOf(p, c.checked).text)}　／　${jdate(c.checked)}確認</span></span>${extra ? '' : `<span class="mid" style="font-size:20px">${esc(p.amountLabel)}</span>`}</li>`).join('')}</ul>`;
const prefCatLinks = (ctx, catIds) => {
  const out = [];
  for (const id of catIds) {
    const cat = CATS.find((c) => c.id === id);
    const links = ctx.livePrefs.filter((p) => ctx.prefCatPages.has(`${p.slug}/${id}`)).map((p) => `<a class="nb" href="/${p.slug}/${id}/"><i aria-hidden="true"></i>${esc(p.name)}の${esc(cat.short)}補助金 →</a>`);
    if (!links.length) continue;
    out.push(links.length > 12 ? `<details class="more"><summary>${esc(cat.h)}の補助金を都道府県ごとに見る（${links.length}都道府県）</summary><div class="links">${links.join('')}</div></details>` : `<div class="links">${links.join('')}</div>`);
  }
  return out.join('\n');
};
const prefLinks = (ctx) => {
  const links = ctx.livePrefs.map((p) => `<a class="nb" href="/${p.slug}/"><i aria-hidden="true"></i>${esc(p.name)} →</a>`);
  return links.length > 12 ? `<details class="more"><summary>都道府県から市区町村の補助金を探す（${links.length}都道府県）</summary><div class="links">${links.join('')}</div></details>` : `<div class="links">${links.join('')}<a class="nb" href="/#h-pref"><i aria-hidden="true"></i>都道府県の一覧 →</a></div>`;
};
const FIELD_TEXT = {
  contractor: (p) => p.contractor,
  lastYear: (p) => p.lastYear,
  docs: (p) => (p.docs || []).join('、'),
  combo: (p) => (p.combo && COMBO[p.combo.kuni] ? `国の補助金と${COMBO[p.combo.kuni]}${p.combo.note ? `（${p.combo.note}）` : ''}` : '')
};
function guideInsert(ctx, at, kind, arg) {
  const s0 = String(arg || ''); const cut = s0.lastIndexOf('|'); const a = cut < 0 ? s0 : s0.slice(0, cut); const heading = cut < 0 ? '' : s0.slice(cut + 1);
  const h = heading ? `<h2>${esc(heading)}</h2>\n` : '';
  if (kind === 'EXAMPLES') {
    const cat = CATS.find((c) => c.id === a);
    if (!cat) { errors.push(`${at}: {{EXAMPLES:${a}}} の工事IDが正しくありません`); return ''; }
    const ex = pickExamples(ctx, (p) => p.cats.includes(cat.id), 8);
    if (!ex.items.length) return '';
    return `${h}<p>当サイトが調べた${ctx.cities.length}市区町村のうち、${ex.cities}市区町村で、${esc(cat.h)}に使える制度を${ex.total}件確認しています（${jdate(ex.last)}時点）。そのうちの一部です。金額や条件は市区町村ごとにちがうので、くわしくは市区町村名を押してご覧ください。</p>
${exList(ex.items)}
${prefCatLinks(ctx, [cat.id])}`;
  }
  if (kind === 'MATCH') {
    let re; try { re = new RegExp(a); } catch (e) { errors.push(`${at}: {{MATCH:${a}}} の正規表現が正しくありません`); return ''; }
    const ex = pickExamples(ctx, (p) => re.test(p.name), 8);
    if (!ex.items.length) return '';
    return `${h}<p>当サイトに掲載している制度のうち、あてはまるものを${ex.total}件確認しています（${jdate(ex.last)}時点）。そのうちの一部です。</p>
${exList(ex.items)}`;
  }
  if (kind === 'FIELD') {
    const fn = FIELD_TEXT[a];
    if (!fn) { errors.push(`${at}: {{FIELD:${a}}} の項目名が正しくありません（contractor / docs / combo / lastYear）`); return ''; }
    const ex = pickExamples(ctx, (p) => !!fn(p), 6);
    if (!ex.items.length) return '';
    return `${h}<p>市区町村の公式ページで確認できた例です（${jdate(ex.last)}時点）。</p>
${exList(ex.items, fn)}`;
  }
  if (kind === 'TIMING') {
    const cat = a ? CATS.find((c) => c.id === a) : null;
    if (a && !cat) { errors.push(`${at}: {{TIMING:${a}}} の工事IDが正しくありません`); return ''; }
    let before = 0, after = 0;
    for (const c of ctx.cities) for (const p of c.programs) if (!cat || p.cats.includes(cat.id)) { if (p.timing === 'before') before++; else if (p.timing === 'after') after++; }
    if (before + after < 5) return '';
    return `<p>当サイトに掲載している${cat ? `${esc(cat.h)}の` : ''}制度のうち、申請の時期が分かっている${before + after}件を数えると、<strong>「工事の前に申請」が${before}件、「工事（設置）が終わってから申請」が${after}件</strong>でした（${jdate(maxDate(ctx.cities.map((c) => c.checked)))}時点）。</p>`;
  }
  errors.push(`${at}: 知らない差し込み {{${kind}}} があります`);
  return '';
}
function guidePage(g, ctx) {
  const { meta, url } = g;
  const at = `src/guide/${g.slug}.html`;
  const crumbs = [['補助金の基礎知識', '/guide/'], [meta.short || meta.title, url]];
  const vars = pageVars();
  const content = g.content.replace(/\{\{(\w+)(?::([^}]*))?\}\}/g, (all, k, arg) => (arg == null && k in vars ? vars[k] : guideInsert(ctx, at, k, arg)));
  const myKuni = (meta.kuni || []).map((s) => national.programs.find((p) => p.slug === s)).filter((p) => p && hasKuniPage(p));
  const endedKuni = myKuni.filter(natEnded);
  const notice = endedKuni.length ? `<div class="warn" role="note">${svgWarn}<span>この記事でふれている${endedKuni.map((p) => `「${esc(p.name)}」`).join('')}は、受付を終了しました。いま使える国の制度は<a href="/kuni/">国の補助金の一覧</a>でご確認ください。</span></div>` : '';
  const cats = meta.cats || [];
  const related = ctx.guides.filter((x) => x !== g)
    .map((x, i) => ({ x, i, s: (x.meta.cats || []).filter((c) => cats.includes(c)).length * 2 + (x.meta.kuni || []).filter((k) => (meta.kuni || []).includes(k)).length + (x.meta.general && !cats.length ? 1 : 0) }))
    .sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 4).map((r) => r.x);
  const op = config.operator || {};
  const body = `<div class="hero"><div class="wrap"><div class="crumbs">${crumbHtml(crumbs)}${PR_NOTE}</div><h1>${esc(meta.title)}</h1>
<p class="small muted">公開：${timeTag(meta.published)}　／　最終更新：${timeTag(meta.updated)}　／　編集・発行：<a href="/about/">${esc(op.name || config.siteName)}</a></p></div></div>
<main class="wrap"><article class="prose">${notice}${content}</article>
<section aria-labelledby="h-sagasu">${secHead('h-sagasu', 'お住まいの市区町村の補助金を調べる', '金額・条件・窓口は市区町村ごとにちがいます')}
${cats.length ? prefCatLinks(ctx, cats) : ''}
${prefLinks(ctx)}
${myKuni.length ? `<div class="links"><span class="muted" style="font-size:15px">国の制度：</span>${myKuni.map((p) => `<a class="nb" href="/kuni/${p.slug}/"><i aria-hidden="true"></i>${esc(p.name)}${natEnded(p) ? '<small>受付終了</small>' : ''} →</a>`).join('')}<a class="nb" href="/kuni/"><i aria-hidden="true"></i>国の補助金の一覧 →</a></div>` : ''}
</section>
${ctaBlock('<span class="ib">補助金が使えるかどうかも、</span><span class="ib">見積もりのときに無料で相談</span>', '無料で見積もりをとる')}
${related.length ? `<section aria-labelledby="h-rel">${secHead('h-rel', 'あわせて読みたい', '<a href="/guide/">基礎知識の一覧</a>')}
<ul class="grid">${related.map((x) => `<li class="card"><a class="t" href="${x.url}">${esc(x.meta.title)}</a><span style="color:var(--ink2);font-size:16px">${esc(x.meta.description)}</span></li>`).join('')}</ul></section>` : ''}
<section aria-labelledby="h-src">${secHead('h-src', 'この記事について')}
${(meta.sources || []).length ? `<div class="sub"><span class="small muted" style="font-weight:700">出典（公式の情報）</span><ul class="dots-list">${meta.sources.map((x) => `<li><a href="${esc(x.url)}" rel="noopener">${esc(x.name)}</a></li>`).join('')}</ul></div>` : ''}
<p class="small muted">この記事は、国や自治体の公式の発表と、当サイトが市区町村ごとに調べたデータをもとに、AIも使って作成し、${esc(op.name || config.siteName)}の責任で公開しています。記事の中の市区町村の例は、当サイトのデータから自動で選ばれ、確認のたびに入れ替わります。制度は年度の途中でも変わるため、申請の前に必ず公式の情報をお確かめください。調べ方は<a href="/policy/">編集方針・情報の調べ方</a>、まちがいのご連絡は<a href="/contact/">お問い合わせ</a>へ。</p>
</section>
</main>`;
  const title = [...`${meta.title}｜${config.siteName}`].length <= 44 ? `${meta.title}｜${config.siteName}` : meta.title;
  const lastmod = maxDate([meta.updated, ...endedKuni.map((p) => p.period && p.period.end).filter((d) => isDate(d) && d <= TODAY)]);
  const graph = [
    Object.assign({ '@type': 'Article', '@id': `${SITE}${url}#page`, headline: meta.title, description: meta.description, inLanguage: 'ja', mainEntityOfPage: SITE + url, url: SITE + url, datePublished: meta.published, dateModified: lastmod, author: AUTHOR(), publisher: { '@id': ORG_ID }, isPartOf: { '@id': WEB_ID } },
      OG_IMAGE ? { image: OG_IMAGE } : {}, (meta.sources || []).length ? { citation: meta.sources.map((x) => x.url) } : {}),
    crumbLd(crumbs)
  ];
  write(`guide/${g.slug}/index.html`, layout({ title, description: meta.description, canonical: url, body, graph, hasCta: true, ogType: 'article' }));
  return { url, lastmod };
}
function guideIndex(ctx) {
  const url = '/guide/';
  const title = 'リフォーム補助金の基礎知識';
  const description = `リフォームの補助金を使う前に知っておきたいことを、${ctx.guides.length}本の記事にやさしく整理しました。申請の順番、国と市の併用、耐震・窓・給湯器など工事ごとのしくみ、減税や介護保険まで。`;
  const crumbs = [['補助金の基礎知識', url]];
  const lastmod = maxDate(ctx.guides.map((g) => g.meta.updated));
  const card = (g) => `<li class="card"><a class="t" href="${g.url}">${esc(g.meta.title)}</a><span style="color:var(--ink2);font-size:16px">${esc(g.meta.description)}</span><span class="small muted">${timeTag(g.meta.updated)}更新</span></li>`;
  const grp = (g) => g.meta.group || ((g.meta.cats || []).length ? 'kouji' : 'kihon');
  const groups = [
    ['h-kihon', '申請の基本', ctx.guides.filter((g) => grp(g) === 'kihon')],
    ['h-kouji', '工事ごとの補助金', ctx.guides.filter((g) => grp(g) === 'kouji')]
  ].filter((x) => x[2].length);
  const body = `<div class="hero"><div class="wrap"><div class="crumbs">${crumbHtml(crumbs)}</div><h1>${esc(title)}</h1><p style="color:var(--ink2);max-width:680px">リフォームの補助金を使う前に知っておきたいことを、やさしく整理しました。国や自治体の公式の発表と、当サイトが市区町村ごとに調べたデータをもとに作成しています（<a href="/policy/">編集方針</a>）。</p></div></div>
<main class="wrap">${groups.map(([id, name, list]) => `<section aria-labelledby="${id}">${secHead(id, name, `${list.length}本`)}<ul class="grid">${list.map(card).join('')}</ul></section>`).join('\n')}
<section aria-labelledby="h-sagasu">${secHead('h-sagasu', 'お住まいの市区町村の補助金を調べる')}
${prefLinks(ctx)}
<div class="links"><a class="nb" href="/kuni/"><i aria-hidden="true"></i>国の補助金の一覧 →</a></div></section>
</main>`;
  const graph = [pageLd({ type: 'CollectionPage', url, title, description, modified: lastmod, extra: { mainEntity: { '@type': 'ItemList', numberOfItems: ctx.guides.length, itemListElement: ctx.guides.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + g.url, name: g.meta.title })) } } }), crumbLd(crumbs)];
  write('guide/index.html', layout({ title: `${title}｜${config.siteName}`, description, canonical: url, body, graph }));
  return { url, lastmod };
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

// 国の制度（data/national.json）の点検
function checkNational() {
  const rel = 'data/national.json';
  if (!isDate(national.checked)) errors.push(`${rel}: checked は YYYY-MM-DD の形で書いてください`);
  else if (national.checked > TODAY) errors.push(`${rel}: checked（${national.checked}）が未来の日付です`);
  const ids = new Set(); const slugs = new Set();
  for (const p of national.programs) {
    const at = `${rel} > ${p.name || p.id}`;
    for (const k of ['id', 'name', 'target']) if (!p[k]) errors.push(`${at}: ${k} がありません`);
    if (ids.has(p.id)) errors.push(`${at}: id が重なっています`);
    ids.add(p.id);
    if (p.slug) { if (!/^[a-z0-9-]+$/.test(p.slug)) errors.push(`${at}: slug は英小文字・数字・ハイフンだけにしてください`); if (slugs.has(p.slug)) errors.push(`${at}: slug が重なっています`); slugs.add(p.slug); }
    if (!Array.isArray(p.cats)) { errors.push(`${at}: cats がありません`); p.cats = []; }
    for (const x of [...p.cats, ...Object.keys(p.extraCats || {})]) if (!CAT_IDS.includes(x)) errors.push(`${at}: cats / extraCats に知らないID「${x}」があります`);
    if (p.status == null) p.status = 'open';
    if (!['open', 'check', 'ended'].includes(p.status)) errors.push(`${at}: status は open / check / ended のどれかにしてください`);
    if (p.maxNumber != null && typeof p.maxNumber !== 'number') errors.push(`${at}: maxNumber は数値か null にしてください`);
    if (p.period) for (const k of ['start', 'end']) if (p.period[k] != null && !isDate(p.period[k])) errors.push(`${at}: period.${k} は YYYY-MM-DD の形で書いてください`);
    if (p.source && !isOfficialUrl(p.source)) warnings.push(`${at}: 出典が公式サイトではありません（${p.source}）`);
    if (!hasKuniPage(p)) warnings.push(`${at}: 説明ページがありません（slug・summary・source を書くと自動で作られます）`);
  }
  for (const p of national.programs) if (p.successor && !slugs.has(p.successor)) errors.push(`${rel} > ${p.name}: successor「${p.successor}」という slug の制度がありません`);
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
checkNational();
const guides = loadGuides();
if (errors.length) {
  console.error(`データに問題があります（${errors.length}件）。直してからもう一度実行してください。\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
// 一覧ページに出す年度：確かめた日のうち、いちばん新しい年度（4月になって最初の市を確かめ直した時点で切り替わる）
FY = Math.max(...cities.map((c) => fyOf(c.checked)), fyOf(national.checked));
FY_LABEL = fyLabel(FY);

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
const ctx = { cities: prefs.flatMap((p) => p.cities), prefData, progress: progressMap, prefCatPages: new Set(), livePrefs: [], guides };
for (const p of prefs) {
  for (const cat of CATS) if (prefCatData(p, cat, ctx).ok) ctx.prefCatPages.add(`${p.slug}/${cat.id}`);
  if (p.cities.some(indexable) || ((prefData.get(p.slug) || {}).programs || []).length) ctx.livePrefs.push(p);
}
ctx.events = buildEvents(ctx);

const pages = [];
const add = (x) => { if (x) pages.push(x); };
add(topPage(ctx));
for (const p of prefs) {
  add(prefPage(p, ctx));
  for (const cat of CATS) add(prefCatPage(p, cat, ctx));
  for (const c of p.cities) add(cityPage(c, ctx));
}
add(kuniIndex(ctx));
for (const p of national.programs) add(kuniPage(p, ctx));
if (guides.length) { add(guideIndex(ctx)); for (const g of guides) add(guidePage(g, ctx)); }
add(logPage(ctx));
staticPages().forEach(add);
feed(ctx);

// サイトマップ：1ファイル4万件まで。超えたら sitemap-1.xml, sitemap-2.xml … に分け、sitemap.xml はその目次（sitemap index）になる。
// Search Console に登録した /sitemap.xml のままで、分割後も読まれる。
const SITEMAP_MAX = Number(process.env.SITEMAP_MAX) || 40000;
const urlset = (list) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${list.map((p) => `<url><loc>${SITE}${p.url}</loc><lastmod>${p.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`;
if (pages.length <= SITEMAP_MAX) write('sitemap.xml', urlset(pages));
else {
  const parts = [];
  for (let i = 0; i < pages.length; i += SITEMAP_MAX) parts.push(pages.slice(i, i + SITEMAP_MAX));
  parts.forEach((list, i) => write(`sitemap-${i + 1}.xml`, urlset(list)));
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${parts.map((list, i) => `<sitemap><loc>${SITE}/sitemap-${i + 1}.xml</loc><lastmod>${maxDate(list.map((p) => p.lastmod))}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`);
}
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
write('favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#1C4E6B"/><path d="M10 23l14-11 14 11M14 21.5V37h20V21.5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>\n');
// *.pages.dev（Cloudflare Pages の予備のアドレス）は検索に出さない。同じ内容が2つのアドレスで出るのを防ぐ。
write('_headers', '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\nhttps://:project.pages.dev/*\n  X-Robots-Tag: noindex\nhttps://:version.:project.pages.dev/*\n  X-Robots-Tag: noindex\n/cities.json\n  X-Robots-Tag: noindex\n/favicon.svg\n  Cache-Control: public, max-age=604800\n/ogp.png\n  Cache-Control: public, max-age=604800\n');
if (OG_IMAGE) fs.copyFileSync(path.join(ROOT, 'src', 'static', 'ogp.png'), path.join(DIST, 'ogp.png'));
write('404.html', layout({ title: `ページが見つかりません｜${config.siteName}`, description: 'ページが見つかりません', noindex: true, body: `<main class="wrap"><section><h1>ページが見つかりません</h1><p>お探しのページは、移動したか、なくなった可能性があります。</p><div class="links"><a class="nb" href="/"><i aria-hidden="true"></i>トップへ戻る →</a><a class="nb" href="/#h-pref"><i aria-hidden="true"></i>都道府県から探す →</a><a class="nb" href="/kuni/"><i aria-hidden="true"></i>国の補助金 →</a>${guides.length ? '<a class="nb" href="/guide/"><i aria-hidden="true"></i>補助金の基礎知識 →</a>' : ''}</div></section></main>` }));
const INDEXNOW_KEY = /^[a-f0-9]{8,128}$/.test(config.indexNowKey || '') ? config.indexNowKey : '';
if (INDEXNOW_KEY) write(`${INDEXNOW_KEY}.txt`, INDEXNOW_KEY);

// ---- 仕上げの点検 ----
// サイト内リンクの行き先が、ほんとうに作られているか（存在しないページへのリンクを出さない）
for (const [from, href] of linkRefs) {
  const rel = href.slice(1);
  if (!(written.has(rel) || written.has(`${rel}index.html`) || (rel === '' && written.has('index.html')))) errors.push(`${from}: リンク先 ${href} のページがありません`);
}
if (errors.length) { console.error(`ページに問題があります（${errors.length}件）。\n- ${[...new Set(errors)].slice(0, 50).join('\n- ')}`); process.exit(1); }
for (const [t, list] of pageTitles) if (list.length > 1) warnings.push(`タイトルが同じページがあります：「${t}」 ${list.join(' / ')}`);

if (warnings.length) console.warn(`注意（${warnings.length}件）：\n- ${warnings.join('\n- ')}`);
const hidden = cities.filter((c) => !indexable(c)).length;
console.log(`生成完了: サイトマップ ${pages.length}ページ（市区町村 ${cities.length}・うち制度なしで非公開 ${hidden}・基礎知識 ${guides.length}本／基準日 ${TODAY}・${FY_LABEL}）`);

// ---- IndexNow（Bing などへの更新通知） ----
// Cloudflare Pages で本番（main）をビルドしたときだけ動く。公開中のサイトマップと見比べて、新しいページ・更新日が変わったページだけを知らせる。
// 失敗してもビルドは止めない。手元や定期タスクの node build.js では何も送らない。
function indexNow() {
  const live = process.env.CF_PAGES === '1' && process.env.CF_PAGES_BRANCH === 'main';
  if (!INDEXNOW_KEY || !(live || process.env.INDEXNOW_DRY)) return;
  const https = require('https');
  const host = new URL(SITE).hostname;
  const get = (u) => new Promise((res, rej) => {
    const r = https.get(u, { timeout: 8000 }, (x) => {
      if (x.statusCode !== 200) { x.resume(); rej(new Error(`${u} が HTTP ${x.statusCode}`)); return; }
      let b = ''; x.setEncoding('utf8'); x.on('data', (d) => { b += d; }); x.on('end', () => res(b));
    });
    r.on('timeout', () => r.destroy(new Error('時間切れ'))); r.on('error', rej);
  });
  (async () => {
    let xml = await get(`${SITE}/sitemap.xml`);
    if (/<sitemapindex/.test(xml)) xml = (await Promise.all([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith(`${SITE}/`)).slice(0, 50).map(get))).join('\n');
    const old = new Map([...xml.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));
    if (!old.size) throw new Error('公開中のサイトマップが読めません');
    const urlList = pages.filter((p) => old.get(SITE + p.url) !== p.lastmod).map((p) => SITE + p.url).slice(0, 10000);
    if (!urlList.length) { console.log('IndexNow: 変わったページはありません'); return; }
    if (!live) { console.log(`IndexNow（試し・送信なし）: ${urlList.length}件\n${urlList.slice(0, 20).join('\n')}`); return; }
    const data = JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList });
    const code = await new Promise((res, rej) => {
      const r = https.request({ hostname: 'api.indexnow.org', path: '/indexnow', method: 'POST', timeout: 8000, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) } }, (x) => { x.resume(); res(x.statusCode); });
      r.on('timeout', () => r.destroy(new Error('時間切れ'))); r.on('error', rej); r.end(data);
    });
    console.log(`IndexNow: ${urlList.length}件を通知しました（応答 ${code}）`);
  })().catch((e) => console.warn(`IndexNow: 通知しませんでした（${e.message}）`));
}
indexNow();
