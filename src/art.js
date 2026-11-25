// リフォーム補助金ナビ のイラスト（すべてこのファイルの中で描いたオリジナルのSVG。写真や外部の素材は使っていない）
// - SCENES：工事ごと・記事のテーマごとの絵（dist/img/<名前>.svg に書き出して <img> で読む。全ページで同じファイルを使い回す）
// - STEPS：申請の流れの小さな絵（dist/img/step-<名前>.svg）
// - townStrip(seed)：町並みの帯（市区町村・都道府県ページの先頭。ページの slug から家の並びと色が決まる。実在の建物は描かない）
// - heroTown()：トップページの町の絵（dist/img/town.svg）
// 絵の中に文字は入れない（読み上げ・翻訳・検索のため、言葉はHTMLに書く）。
'use strict';

const C = {
  ink: '#17212B', ai: '#1C4E6B', ai2: '#7FA6BC', sky: '#CFE0E9', tint: '#E9EEF1',
  shu: '#BF3324', shu2: '#EBC9C0', kaki: '#C9974E', kaki2: '#F1E3CC', sand: '#E6DFD0',
  mid: '#2A6548', mid2: '#9CC3A8', ochre: '#DDA63A', white: '#fff', paper: '#F7F6F2'
};
const S = `stroke="${C.ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
const L = (w, c) => `fill="none" stroke="${c || C.ink}" stroke-width="${w || 3}" stroke-linecap="round" stroke-linejoin="round"`;
const ground = `<path d="M10 142h220" ${L(3)}/>`;
const svg = (w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>\n`;
// 確認印（赤い二重丸とチェック。文字は入れない）
const seal = (x, y, r, rot) => `<g transform="translate(${x} ${y}) rotate(${rot || -10})"><circle r="${r}" fill="#fff" fill-opacity=".92" stroke="${C.shu}" stroke-width="${(r * 0.12).toFixed(1)}"/><circle r="${(r * 0.74).toFixed(1)}" fill="none" stroke="${C.shu}" stroke-width="${(r * 0.06).toFixed(1)}"/><path d="M${(-r * 0.36).toFixed(1)} ${(r * 0.02).toFixed(1)}l${(r * 0.26).toFixed(1)} ${(r * 0.28).toFixed(1)} ${(r * 0.46).toFixed(1)}-${(r * 0.56).toFixed(1)}" fill="none" stroke="${C.shu}" stroke-width="${(r * 0.16).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
// 町の表示板（藍の縦長の板。白い内枠と、上下のびょう）
const plate = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.16}" fill="${C.ai}"/><rect x="${x + w * 0.12}" y="${y + w * 0.12}" width="${w * 0.76}" height="${h - w * 0.24}" rx="${w * 0.1}" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="${Math.max(1, w * 0.05).toFixed(1)}"/><circle cx="${x + w / 2}" cy="${y + w * 0.34}" r="${w * 0.07}" fill="#fff"/><circle cx="${x + w / 2}" cy="${y + h - w * 0.34}" r="${w * 0.07}" fill="#fff"/>`;

const SCENES = {
  // 窓・断熱：外は雪、内窓をつけた部屋はあたたかい
  mado: `<rect x="18" y="12" width="204" height="130" rx="8" fill="${C.kaki2}"/>
<rect x="48" y="26" width="136" height="96" rx="4" fill="#fff" ${S}/>
<rect x="57" y="35" width="118" height="78" fill="${C.sky}"/>
<path d="M76 50v16M69 54l14 8M83 54l-14 8M100 82v14M94 85.5l12 7M106 85.5l-12 7M150 46v12M145 49l10 6M155 49l-10 6" ${L(3, '#fff')}/>
<path d="M116 35v78" ${L(3)}/>
<rect x="104" y="30" width="84" height="88" rx="3" fill="#fff" fill-opacity=".55" stroke="${C.ai}" stroke-width="7"/>
<rect x="112" y="66" width="5" height="18" rx="2.5" fill="${C.ai}"/>
<rect x="38" y="120" width="156" height="10" rx="3" fill="${C.ink}"/>
<path d="M205 62c5 7-5 11 0 18s-5 11 0 18M216 70c4 6-4 9 0 15s-4 9 0 15" ${L(3.5, C.shu)}/>
<path d="M150 120l3-15h20l3 15z" fill="${C.shu}"/><path d="M163 105c-10-4-14-12-10-22 9 3 13 11 10 22zM163 105c2-10 9-15 19-14-1 9-8 14-19 14z" fill="${C.mid}"/>`,
  // 給湯器・エコキュート：貯湯タンクとヒートポンプ
  kyuto: `<rect x="14" y="20" width="92" height="122" fill="${C.kaki2}"/><rect x="34" y="44" width="46" height="40" rx="3" fill="${C.sky}" ${S}/><path d="M57 44v40M34 64h46" ${L(3)}/>
<rect x="112" y="18" width="50" height="118" rx="10" fill="#fff" ${S}/><path d="M112 44h50M112 112h50" ${L(3)}/>
<path d="M137 58c-9 12-13 18-13 25a13 13 0 0026 0c0-7-4-13-13-25z" fill="${C.ai2}"/><path d="M131 84c0 5 3 8 7 8" ${L(3, '#fff')}/>
<rect x="174" y="80" width="54" height="56" rx="6" fill="${C.tint}" ${S}/><circle cx="201" cy="108" r="17" fill="#fff" ${S}/><path d="M201 108l0-12M201 108l10 7M201 108l-10 7" ${L(3.5, C.ai)}/>
<path d="M162 126h12" ${L(5)}/><path d="M106 124h6" ${L(5)}/>
<path d="M188 34c5 6-5 10 0 16s-5 10 0 16M206 28c5 6-5 10 0 16s-5 10 0 16" ${L(3.5, C.shu)}/>
<path d="M119 136v6M155 136v6M182 136v6M220 136v6" ${L(3)}/>${ground}`,
  // 太陽光・蓄電池：屋根のパネルと、家の横の蓄電池
  taiyo: `<circle cx="204" cy="34" r="15" fill="${C.ochre}"/><path d="M204 8v7M204 53v7M178 34h7M223 34h7M186 16l5 5M222 16l-5 5M186 52l5-5M222 52l-5-5" ${L(3, C.ochre)}/>
<rect x="46" y="84" width="112" height="58" fill="#fff" ${S}/>
<path d="M30 88l72-52 72 52z" fill="${C.kaki}" ${S}/>
<path d="M107 46l52 38h-45l-33-24z" fill="${C.ai}" ${S}/><path d="M94 55l41 29M120 55l-13 9.5M139 69l-13 9.5" ${L(2, '#fff')}/>
<rect x="62" y="100" width="30" height="26" rx="2" fill="${C.sky}" ${S}/><path d="M77 100v26" ${L(3)}/>
<rect x="112" y="104" width="26" height="38" rx="2" fill="${C.kaki2}" ${S}/><circle cx="132" cy="124" r="2" fill="${C.ink}"/>
<rect x="176" y="92" width="42" height="50" rx="6" fill="#E5F0E8" ${S}/><path d="M200 102l-11 17h9l-3 14 12-18h-9z" fill="${C.mid}"/>
<path d="M158 132h18" ${L(4, C.mid)}/>${ground}`,
  // 耐震：筋かいで補強した木造の家
  taishin: `<rect x="50" y="76" width="140" height="58" fill="#fff" ${S}/>
<path d="M32 80l88-56 88 56z" fill="${C.ai}" ${S}/>
<path d="M97 76v58M143 76v58" ${L(3)}/>
<path d="M52 78l43 54M95 78l-43 54M145 78l43 54M188 78l-43 54" ${L(5, C.shu)}/>
<rect x="106" y="94" width="28" height="40" rx="2" fill="${C.kaki2}" ${S}/><circle cx="128" cy="115" r="2" fill="${C.ink}"/>
<rect x="40" y="134" width="160" height="10" rx="2" fill="${C.ink}"/>
<path d="M22 96l8 8-8 8 8 8M218 96l-8 8 8 8-8 8" ${L(3.5, C.ink)}/>
<circle cx="120" cy="54" r="9" fill="#fff"/><path d="M115 54l4 4 7-8" ${L(3, C.ai)}/>
<path d="M10 150l14-4 12 5 16-5 14 4" ${L(2.5, C.ai2)}/><path d="M174 150l14-4 12 5 16-5 14 4" ${L(2.5, C.ai2)}/>`,
  // お風呂・トイレ・キッチン：浴槽と手すり、トイレ
  mizu: `<rect x="14" y="14" width="212" height="128" rx="8" fill="${C.tint}"/>
<path d="M14 56h212M14 98h212M64 14v128M120 14v128M176 14v128" stroke="#fff" stroke-width="3"/>
<path d="M30 60h104" ${L(7, C.shu)}/><path d="M40 60v-10M124 60v-10" ${L(5, C.shu)}/>
<path d="M22 92h128v20a26 26 0 01-26 26H48a26 26 0 01-26-26z" fill="#fff" ${S}/>
<path d="M27 96h118v8H27z" fill="${C.sky}"/><path d="M18 92h136" ${L(5)}/>
<circle cx="60" cy="80" r="6" fill="#fff" ${S}/><circle cx="76" cy="70" r="4" fill="#fff" ${S}/><circle cx="90" cy="82" r="5" fill="#fff" ${S}/>
<rect x="180" y="62" width="36" height="34" rx="4" fill="#fff" ${S}/><path d="M172 98h48" ${L(4)}/>
<path d="M174 100h44c0 14-8 24-20 24h-6c-10 0-18-10-18-24z" fill="#fff" ${S}/><path d="M188 124v16h18v-16" fill="#fff" ${S}/>
<rect x="208" y="70" width="8" height="5" rx="2" fill="${C.ai}"/>`,
  // 屋根・外壁：ローラーで塗りかえ中の外壁と、雨雲
  yane: `<path d="M34 46a14 14 0 0114-14 18 18 0 0134-3 13 13 0 019 23H44a12 12 0 01-10-6z" fill="#fff" ${S}/>
<path d="M48 64l-4 10M64 64l-4 10M80 64l-4 10" ${L(3.5, C.ai2)}/>
<rect x="62" y="86" width="120" height="56" fill="${C.sand}" ${S}/>
<path d="M120 87.5h60.500v53H120z" fill="${C.sky}"/>
<path d="M44 90l78-52 78 52z" fill="${C.ai}" ${S}/>
<rect x="78" y="102" width="26" height="24" rx="2" fill="#fff" ${S}/><path d="M91 102v24" ${L(3)}/>
<rect x="112" y="92" width="16" height="36" rx="6" fill="${C.shu}" ${S}/><path d="M128 110h12v22" ${L(3.5)}/><rect x="135" y="128" width="10" height="14" rx="3" fill="${C.kaki}" ${S}/>
<path d="M198 78v64M216 78v64M198 92h18M198 108h18M198 124h18" ${L(3.5, C.kaki)}/>
<path d="M146 100l4 4 8-9" ${L(3.5, '#fff')}/>${ground}`,
  // 申請の基本：申請書と確認印
  shinsei: `<rect x="44" y="34" width="104" height="112" rx="6" fill="${C.sky}" transform="rotate(-7 96 90)"/>
<rect x="60" y="18" width="106" height="126" rx="6" fill="#fff" ${S}/>
<path d="M78 42h44" ${L(6, C.ai)}/><path d="M78 64h70M78 80h70M78 96h44" ${L(3.5, '#B9C4CC')}/>
<rect x="78" y="112" width="12" height="12" rx="2" fill="none" ${S}/><path d="M98 118h24" ${L(3.5, '#B9C4CC')}/>
${seal(150, 110, 24)}
<path d="M188 30l14 14-44 44-18 4 4-18z" fill="${C.kaki}" ${S}/><path d="M180 38l14 14" ${L(3)}/>`,
  // 期間・年度：カレンダーと締切
  koyomi: `<rect x="36" y="30" width="136" height="112" rx="8" fill="#fff" ${S}/>
<path d="M36 60h136v-22a8 8 0 00-8-8H44a8 8 0 00-8 8z" fill="${C.ai}" ${S}/>
<path d="M66 20v22M142 20v22" ${L(6)}/>
<g fill="${C.tint}"><rect x="52" y="72" width="22" height="18" rx="3"/><rect x="82" y="72" width="22" height="18" rx="3"/><rect x="112" y="72" width="22" height="18" rx="3"/><rect x="142" y="72" width="18" height="18" rx="3"/><rect x="52" y="98" width="22" height="18" rx="3"/><rect x="82" y="98" width="22" height="18" rx="3"/></g>
<rect x="112" y="98" width="22" height="18" rx="3" fill="${C.shu}"/>
<circle cx="188" cy="108" r="30" fill="#fff" ${S}/><path d="M188 90v18l12 8" ${L(4, C.ai)}/><circle cx="188" cy="108" r="3" fill="${C.ink}"/>`,
  // 暮らしとお金：家と硬貨
  okane: `<rect x="34" y="78" width="96" height="64" fill="#fff" ${S}/><path d="M20 82l62-48 62 48z" fill="${C.ai}" ${S}/>
<rect x="68" y="102" width="28" height="40" rx="2" fill="${C.kaki2}" ${S}/><circle cx="89" cy="123" r="2" fill="${C.ink}"/>
<g ${S} fill="${C.ochre}"><ellipse cx="184" cy="132" rx="30" ry="9"/><path d="M154 132v-12a30 9 0 0060 0v12"/><path d="M154 120v-12a30 9 0 0060 0v12"/><ellipse cx="184" cy="108" rx="30" ry="9"/></g>
<circle cx="178" cy="56" r="26" fill="${C.ochre}" ${S}/><path d="M168 44l10 13 10-13M178 57v14M169 59h18M169 66h18" ${L(3.5)}/>
<path d="M136 100c8-10 12-16 18-22" ${L(3, C.ai2)} stroke-dasharray="1 8"/>${ground}`,
  // 省エネ：葉と家
  eco: `<rect x="60" y="82" width="110" height="60" fill="#fff" ${S}/><path d="M44 86l71-54 71 54z" fill="${C.mid}" ${S}/>
<rect x="76" y="98" width="30" height="26" rx="2" fill="${C.sky}" ${S}/><path d="M91 98v26" ${L(3)}/>
<rect x="124" y="102" width="28" height="40" rx="2" fill="${C.kaki2}" ${S}/><circle cx="145" cy="123" r="2" fill="${C.ink}"/>
<path d="M186 76c0-30 14-46 44-48 0 30-14 46-44 48z" fill="${C.mid2}" ${S}/><path d="M186 76l28-32" ${L(3)}/>
<path d="M22 60c0-8 6-12 12-12M22 60c0 8 6 12 12 12" ${L(3.5, C.mid)}/><path d="M30 42l6 6-8 2M30 78l6-6-8-2" ${L(3.5, C.mid)}/>
<circle cx="115" cy="60" r="9" fill="#fff"/><path d="M110 60l4 4 7-8" ${L(3, C.mid)}/>${ground}`,
  // 探し方：地図のピンと、町の表示板
  sagasu: `<path d="M20 44l46-14 54 14 54-14 46 14v96l-46-14-54 14-54-14-46 14z" fill="#fff" ${S}/>
<path d="M66 30v96M120 44v96M174 30v96" ${L(2.5, '#B9C4CC')}/>
<path d="M34 86c20-8 26 10 44 2s22-22 42-16" ${L(3, C.ai2)} stroke-dasharray="1 8"/>
<path d="M150 108c-16-20-24-32-24-44a24 24 0 0148 0c0 12-8 24-24 44z" fill="${C.shu}" ${S}/><circle cx="150" cy="64" r="9" fill="#fff" ${S}/>
${plate(40, 50, 22, 56)}
<circle cx="196" cy="100" r="16" fill="#fff" fill-opacity=".9" ${S}/><path d="M207 112l12 12" ${L(5)}/>`,
  // 条件の確認：チェックリスト
  jouken: `<rect x="52" y="24" width="112" height="120" rx="8" fill="#fff" ${S}/><rect x="84" y="14" width="48" height="22" rx="6" fill="${C.ai}" ${S}/>
<g ${L(3)}><rect x="68" y="52" width="16" height="16" rx="3" fill="${C.tint}"/><rect x="68" y="80" width="16" height="16" rx="3" fill="${C.tint}"/><rect x="68" y="108" width="16" height="16" rx="3" fill="${C.tint}"/></g>
<path d="M71 60l4 4 8-10M71 88l4 4 8-10" ${L(3.5, C.shu)}/><path d="M96 60h52M96 88h52M96 116h34" ${L(4, '#B9C4CC')}/>
<rect x="170" y="100" width="46" height="42" fill="#fff" ${S}/><path d="M162 104l31-26 31 26z" fill="${C.kaki}" ${S}/><rect x="186" y="118" width="14" height="24" rx="2" fill="${C.kaki2}" ${S}/>`,
  // 国と市の併用：2つの輪が重なるところに家
  heiyou: `<circle cx="88" cy="80" r="58" fill="${C.sky}" ${S}/><circle cx="152" cy="80" r="58" fill="${C.shu2}" fill-opacity=".85" ${S}/>
<path d="M120 31.6a58 58 0 010 96.800 58 58 0 010-96.800z" fill="#fff" ${S}/>
<rect x="105" y="78" width="30" height="26" fill="#fff" ${S}/><path d="M98 80l22-18 22 18z" fill="${C.ai}" ${S}/><rect x="115" y="88" width="10" height="16" rx="1.5" fill="${C.kaki2}" ${S}/>
<path d="M44 96h34M44 96v-22M54 96v-22M68 96v-22M78 96v-22M40 74h42l-21-14z" ${L(3, C.ai)}/>
<rect x="166" y="66" width="30" height="30" rx="2" ${L(3, C.shu)}/><path d="M174 76h4M184 76h4M174 85h4M184 85h4M181 58v8" ${L(3, C.shu)}/>`,
  // 申請の順番：先に申請（交付決定）、それから工事
  junban: `<rect x="18" y="34" width="70" height="92" rx="6" fill="#fff" ${S}/><path d="M30 52h30" ${L(5, C.ai)}/><path d="M30 68h46M30 80h46M30 92h22" ${L(3.5, '#B9C4CC')}/>${seal(74, 108, 19)}
<path d="M104 84h26M122 74l10 10-10 10" ${L(5, C.shu)}/>
<rect x="152" y="84" width="64" height="52" fill="#fff" ${S}/><path d="M142 88l42-34 42 34z" fill="${C.ai}" ${S}/><rect x="174" y="104" width="20" height="32" rx="2" fill="${C.kaki2}" ${S}/>
<path d="M213 37l17 17" ${L(5, C.kaki)}/><rect x="196" y="27" width="26" height="12" rx="3" fill="${C.ink}" transform="rotate(-45 209 33)"/><path d="M140 136h88" ${L(3)}/>`,
  // 見積もり・業者選び：見積書と家、握手のかわりに「見比べる」
  mitsumori: `<rect x="26" y="40" width="84" height="102" rx="6" fill="#fff" ${S}/><path d="M40 60h36" ${L(5, C.ai)}/><path d="M40 78h56M40 92h56M40 106h30" ${L(3.5, '#B9C4CC')}/><path d="M74 124h22" ${L(5, C.shu)}/>
<rect x="130" y="24" width="84" height="102" rx="6" fill="#fff" ${S}/><path d="M144 44h36" ${L(5, C.ai)}/><path d="M144 62h56M144 76h56M144 90h30" ${L(3.5, '#B9C4CC')}/><path d="M178 108h22" ${L(5, C.shu)}/>
<circle cx="120" cy="92" r="20" fill="${C.ochre}" ${S}/><path d="M112 84l8 10 8-10M120 94v10M113 96h14M113 101h14" ${L(3)}/>`,
  // 空き家：鍵と古い家
  akiya: `<rect x="40" y="80" width="112" height="62" fill="${C.sand}" ${S}/><path d="M24 84l72-52 72 52z" fill="${C.kaki}" ${S}/>
<rect x="56" y="98" width="30" height="26" rx="2" fill="#fff" ${S}/><path d="M71 98v26M56 111h30" ${L(3)}/>
<rect x="104" y="102" width="28" height="40" rx="2" fill="${C.ai}" ${S}/><circle cx="125" cy="123" r="2.5" fill="#fff"/>
<circle cx="192" cy="60" r="20" fill="${C.ochre}" ${S}/><circle cx="192" cy="54" r="6" fill="#fff" ${S}/>
<path d="M192 80v48M192 104h12M192 118h10" ${L(6)}/><path d="M192 80v48M192 104h12M192 118h10" ${L(2.5, C.ochre)}/>
<path d="M166 142c0-8 4-12 4-18M176 142c0-6-3-9-2-14" ${L(3, C.mid)}/>${ground}`
};

// 申請の流れの絵（64×64）
const STEPS = {
  // 見積もり
  mitsumori: `<rect x="12" y="6" width="36" height="48" rx="4" fill="#fff" ${S}/><path d="M20 18h16" ${L(4, C.ai)}/><path d="M20 28h20M20 36h12" ${L(3, '#B9C4CC')}/><circle cx="44" cy="44" r="13" fill="${C.ochre}" ${S}/><path d="M39 39l5 6 5-6M44 45v7M40 47h8" ${L(2.5)}/>`,
  // 申請（窓口に出す）
  shinsei: `<path d="M6 30h52v24a4 4 0 01-4 4H10a4 4 0 01-4-4z" fill="${C.sky}" ${S}/><rect x="16" y="8" width="32" height="38" rx="3" fill="#fff" ${S}/><path d="M23 18h18M23 26h18M23 34h10" ${L(3, '#B9C4CC')}/><path d="M6 30l26 18 26-18" fill="${C.sky}" ${S}/>`,
  // 交付決定（確認印が押される）
  kettei: `<rect x="10" y="8" width="38" height="50" rx="4" fill="#fff" ${S}/><path d="M18 20h16" ${L(4, C.ai)}/><path d="M18 30h22M18 38h10" ${L(3, '#B9C4CC')}/>${seal(42, 42, 15)}`,
  // 契約・工事
  kouji: `<rect x="10" y="32" width="34" height="26" fill="#fff" ${S}/><path d="M4 34l23-18 23 18z" fill="${C.ai}" ${S}/><rect x="21" y="42" width="11" height="16" rx="1.5" fill="${C.kaki2}" ${S}/><path d="M43 25l15 15" ${L(5, C.kaki)}/><rect x="28" y="16" width="24" height="11" rx="2.5" fill="${C.ink}" transform="rotate(-45 40 21.5)"/><path d="M4 59h56" ${L(3)}/>`,
  // 完了報告（写真と領収書）
  houkoku: `<rect x="24" y="6" width="32" height="40" rx="3" fill="#fff" ${S}/><path d="M31 16h18M31 24h18M31 32h10" ${L(3, '#B9C4CC')}/><rect x="6" y="28" width="40" height="30" rx="5" fill="${C.ai}" ${S}/><path d="M16 28l3-6h14l3 6" fill="${C.ai}" ${S}/><circle cx="26" cy="43" r="9" fill="${C.sky}" ${S}/><circle cx="26" cy="43" r="3" fill="#fff"/>`,
  // 入金
  nyukin: `<rect x="6" y="14" width="40" height="44" rx="4" fill="#fff" ${S}/><path d="M6 26h40" ${L(3)}/><path d="M14 36h18M14 44h12" ${L(3, '#B9C4CC')}/><rect x="6" y="14" width="40" height="12" rx="4" fill="${C.mid2}" ${S}/><circle cx="46" cy="42" r="14" fill="${C.ochre}" ${S}/><path d="M41 36l5 7 5-7M46 43v8M42 45h8" ${L(2.5)}/>`
};

// ---- 町並み（slug から決まる。同じページはいつも同じ絵） ----
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
let PREC = 10; // 町並みの帯は整数に丸めて、HTMLを軽くする
const f1 = (n) => String(Math.round(n * PREC) / PREC);
const ROOFS = [C.ai, C.ai, C.ink, C.kaki, '#3D6E88', C.ai2];
const WALLS = ['#fff', '#fff', C.kaki2, C.tint, C.sand];
// 家を1軒。x: 左はし / base: 地面のy / w・h: 壁の幅と高さ / kind: 屋根の形 / feat: 工事の目印（太陽光・筋かい・塗りかえ・給湯器・内窓）
function house(x, base, w, h, o) {
  const sw = o.sw || 2.5;
  const st = o.bare ? '' : `stroke="${C.ink}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`; // bare：線の指定は外側の <g> にまとめる
  const top = base - h; const rh = o.rh || w * 0.34; const ov = w * 0.1;
  let out = `<rect x="${f1(x)}" y="${f1(top)}" width="${f1(w)}" height="${f1(h)}" fill="${o.wall}" ${st}/>`;
  if (o.feat === 'paint') out += `<rect x="${f1(x + w * 0.5)}" y="${f1(top + sw / 2)}" width="${f1(w * 0.5 - sw / 2)}" height="${f1(h - sw)}" fill="${C.sky}"/>`;
  if (o.kind === 'flat') out += `<rect x="${f1(x - ov * 0.5)}" y="${f1(top - 7)}" width="${f1(w + ov)}" height="9" rx="2" fill="${o.roof}" ${st}/>`;
  else if (o.kind === 'shed') out += `<path d="M${f1(x - ov)} ${f1(top + 1)}L${f1(x - ov)} ${f1(top - rh * 0.35)}L${f1(x + w + ov)} ${f1(top - rh)}L${f1(x + w + ov)} ${f1(top + 1)}z" fill="${o.roof}" ${st}/>`;
  else out += `<path d="M${f1(x - ov)} ${f1(top + 1)}L${f1(x + w / 2)} ${f1(top - rh)}L${f1(x + w + ov)} ${f1(top + 1)}z" fill="${o.roof}" ${st}/>`;
  if (o.feat === 'solar' && o.kind !== 'flat') {
    // 屋根の右の面にパネル
    const ax = x + w / 2, ay = top - rh, bx = x + w + ov, by = top + 1;
    out += `<path d="M${f1(ax + (bx - ax) * 0.2)} ${f1(ay + (by - ay) * 0.2 + 3)}L${f1(ax + (bx - ax) * 0.8)} ${f1(ay + (by - ay) * 0.8 + 3)}L${f1(ax + (bx - ax) * 0.8 - w * 0.2)} ${f1(ay + (by - ay) * 0.8 + 3)}L${f1(ax + (bx - ax) * 0.2 - w * 0.07)} ${f1(ay + (by - ay) * 0.2 + 5)}z" fill="${C.ink}" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>`;
  }
  // 窓と扉
  const dw = Math.min(w * 0.24, 16), dh = Math.min(h * 0.62, 30);
  const dx = o.door === 'r' ? x + w * 0.62 : x + w * 0.16;
  out += `<rect x="${f1(dx)}" y="${f1(base - dh)}" width="${f1(dw)}" height="${f1(dh)}" rx="1.5" fill="${o.doorC || C.kaki2}" ${st}/>`;
  const wx = o.door === 'r' ? x + w * 0.16 : x + w * 0.56; const ww = w * 0.28; const wh = o.two ? Math.min(13, h * 0.24) : Math.min(h * 0.36, 18); const wy = o.two ? base - dh : top + h * 0.24;
  if (o.feat === 'brace') out += `<path d="M${f1(wx)} ${f1(top + 4)}L${f1(wx + ww)} ${f1(base - 4)}M${f1(wx + ww)} ${f1(top + 4)}L${f1(wx)} ${f1(base - 4)}" fill="none" stroke="${C.shu}" stroke-width="${sw + 1}" stroke-linecap="round"/>`;
  else {
    out += `<rect x="${f1(wx)}" y="${f1(wy)}" width="${f1(ww)}" height="${f1(wh)}" rx="1.5" fill="${C.sky}" ${st}/><path d="M${f1(wx + ww / 2)} ${f1(wy)}v${f1(wh)}" ${st}/>`;
    if (o.feat === 'mado') out += `<rect x="${f1(wx - 2.5)}" y="${f1(wy - 2.5)}" width="${f1(ww + 5)}" height="${f1(wh + 5)}" rx="2.5" fill="none" stroke="${C.ai}" stroke-width="2"/>`;
  }
  if (o.two && o.feat !== 'brace') { const y2 = top + h * 0.13; const uh = Math.min(12, h * 0.2); out += `<rect x="${f1(x + w * 0.16)}" y="${f1(y2)}" width="${f1(w * 0.26)}" height="${f1(uh)}" rx="1.5" fill="${C.sky}" ${st}/><rect x="${f1(x + w * 0.58)}" y="${f1(y2)}" width="${f1(w * 0.26)}" height="${f1(uh)}" rx="1.5" fill="${C.sky}" ${st}/>`; }
  if (o.feat === 'tank') out += `<rect x="${f1(x + w + 4)}" y="${f1(base - h * 0.7)}" width="${f1(Math.max(9, w * 0.16))}" height="${f1(h * 0.7)}" rx="4" fill="#fff" ${st}/><path d="M${f1(x + w + 4)} ${f1(base - h * 0.5)}h${f1(Math.max(9, w * 0.16))}" ${st}/>`;
  return out;
}
const tree = (x, base, r, c, sw) => { const st = sw === 0 ? '' : ` stroke="${C.ink}" stroke-width="${sw || 2.5}" stroke-linecap="round"`; return `<path d="M${f1(x)} ${f1(base)}v-${f1(r * 1.3)}"${st}/><circle cx="${f1(x)}" cy="${f1(base - r * 1.9)}" r="${f1(r)}" fill="${c}"${st}/>`; };
const pine = (x, base, r, c, sw) => { const st = sw === 0 ? '' : ` stroke="${C.ink}" stroke-width="${sw || 2.5}" stroke-linecap="round" stroke-linejoin="round"`; return `<path d="M${f1(x)} ${f1(base)}v-${f1(r)}"${st}/><path d="M${f1(x - r * 0.8)} ${f1(base - r * 0.8)}L${f1(x)} ${f1(base - r * 3)}L${f1(x + r * 0.8)} ${f1(base - r * 0.8)}z" fill="${c}"${st}/>`; };
const signPole = (x, base, hgt) => `<path d="M${f1(x)} ${f1(base)}v-${f1(hgt)}"/><g stroke="none">${plate(Math.round(x) + 2, base - hgt, 9, 24)}</g>`;

// 町並みの帯。720×96 の中に、家と木と表示板を並べる。高さは CSS で決め、左右は切れてもよい（preserveAspectRatio="xMidYMax slice"）。
function townStrip(seedText) {
  const r = rng(hash(seedText)); PREC = 1;
  const pick = (a) => a[Math.floor(r() * a.length)];
  const W = 720, H = 96, base = 92;
  // うしろの丘（うすい色）。slug ごとに形が少し変わる
  const hill = (cx, w, h, c) => `<path d="M${f1(cx - w / 2)} ${base}Q${f1(cx)} ${f1(base - h * 2)} ${f1(cx + w / 2)} ${base}z" fill="${c}"/>`;
  let back = hill(120 + r() * 120, 300 + r() * 120, 26 + r() * 14, C.tint) + hill(470 + r() * 140, 340 + r() * 120, 22 + r() * 16, C.tint);
  let out = '';
  let x = -20 + r() * 14;
  const feats = ['solar', 'brace', 'paint', 'tank', 'mado'];
  let signDone = false; let i = 0;
  while (x < W + 10) {
    const w = 34 + r() * 26; const h = 24 + r() * 16; const two = h > 33 && r() < 0.7;
    const kind = pick(['gable', 'gable', 'gable', 'shed', 'flat']);
    const feat = r() < 0.36 ? pick(feats) : '';
    out += house(x, base, w, two ? h + 8 : h, { bare: true, wall: pick(WALLS), roof: pick(ROOFS), kind, feat, two, door: r() < 0.5 ? 'r' : 'l', doorC: r() < 0.2 ? C.shu : r() < 0.4 ? C.ai2 : C.kaki2, rh: w * (0.28 + r() * 0.14) });
    x += w + (feat === 'tank' ? 18 : 8);
    const gap = 10 + r() * 22;
    const g = r();
    if (!signDone && x > W * 0.3 && x < W * 0.62) { out += signPole(x + gap / 2 - 5, base, 40); signDone = true; }
    else if (g < 0.45) out += tree(x + gap / 2, base, 6 + r() * 3, pick([C.mid2, C.mid2, '#B9D4C2']), 0);
    else if (g < 0.65) out += pine(x + gap / 2, base, 6 + r() * 2, pick([C.mid2, '#86B197']), 0);
    x += gap; i++;
  }
  PREC = 10;
  return `<svg class="town" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${back}<g stroke="${C.ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${out}<path d="M0 ${base}h${W}"/></g></svg>`;
}

// トップページの町の絵（480×250）。工事の目印がついた家を並べ、表示板と確認印をそえる。
function heroTown() {
  const base = 196; const o = (extra) => Object.assign({ sw: 3 }, extra);
  const pale = '#DDE6EB';
  const cloud = (x, y, k) => `<path transform="translate(${x} ${y}) scale(${k})" d="M0 26a13 13 0 0113-13 18 18 0 0134-3 12 12 0 019 21H10A11 11 0 010 26z" fill="#fff" stroke="#C3CAD1" stroke-width="${f1(2.5 / k)}"/>`;
  const back = `<path d="M-10 ${base}Q120 70 270 ${base}z" fill="${C.tint}"/><path d="M210 ${base}Q350 96 500 ${base}z" fill="${C.tint}"/>${cloud(34, 30, 1)}${cloud(268, 18, 0.8)}
<path d="M92 ${base}V134l32-22 32 22v62z" fill="${pale}"/><path d="M222 ${base}V126l24-16 24 16v70z" fill="${pale}"/><path d="M326 ${base}V120h52v76z" fill="${pale}"/><path d="M320 122h64v-8h-64z" fill="${pale}"/>`;
  const front = house(16, base, 84, 50, o({ wall: '#fff', roof: C.ai, kind: 'gable', feat: 'solar', door: 'l', rh: 34 }))
    + tree(120, base, 10, C.mid2, 3)
    + house(160, base, 70, 58, o({ wall: C.kaki2, roof: C.ink, kind: 'gable', feat: 'brace', door: 'l', rh: 26 }))
    + house(256, base, 82, 46, o({ wall: C.sand, roof: C.kaki, kind: 'gable', feat: 'paint', door: 'l', rh: 30 }))
    + pine(360, base, 9, '#86B197', 3)
    + house(382, base, 68, 62, o({ wall: '#fff', roof: C.ai, kind: 'shed', feat: 'tank', two: true, door: 'r', doorC: C.shu, rh: 20 }));
  const ladder = `<path d="M322 ${base}v-44M334 ${base}v-44M322 ${base - 10}h12M322 ${base - 22}h12M322 ${base - 34}h12" fill="none" stroke="${C.kaki}" stroke-width="3" stroke-linecap="round"/>`;
  const pole = `<path d="M141 ${base}v-110" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>${plate(130, base - 158, 22, 62)}`;
  const road = `<path d="M-10 ${base}h500" stroke="${C.ink}" stroke-width="3"/><path d="M10 ${base + 16}h40M80 ${base + 16}h40M150 ${base + 16}h40M220 ${base + 16}h40M290 ${base + 16}h40M360 ${base + 16}h40M430 ${base + 16}h40" stroke="#C3CAD1" stroke-width="3" stroke-linecap="round"/>`;
  return svg(480, 224, `${back}${front}${ladder}${pole}${road}${seal(424, 60, 36, -10)}`);
}

module.exports = {
  C, hash, townStrip, heroTown,
  sceneFile: (id) => svg(240, 160, SCENES[id].replace(/\n/g, '')),
  stepFile: (id) => svg(64, 64, STEPS[id]),
  SCENE_IDS: Object.keys(SCENES), STEP_IDS: Object.keys(STEPS)
};
