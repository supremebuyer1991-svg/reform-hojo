# リフォーム補助金ナビ（reform-hojo.com）

市区町村と国のリフォーム補助金を、工事ごとに整理するサイトです。

## しくみ

- `data/cities/<都道府県>/<市区町村>.json` … 市区町村ごとの補助金データ
- `data/prefs/<都道府県>.json` … 都道府県が直接出している補助金（あれば）
- `data/national.json` … 国の補助金の一覧
- `data/progress.json`・`data/progress/` … 調査の進み具合
- `src/kuni/<slug>.html` … 国の補助金ページの本文
- `src/pages/<slug>.html` … 運営者情報・編集方針・免責事項・プライバシーポリシー・お問い合わせの本文
- `src/style.css` / `src/picker.js` / `src/search.js` … デザインと、工事の切り替え・市区町村の検索の動き（ページに直接埋め込まれる）
- `src/static/ogp.png` … SNSで共有されたときの画像（1200×630。置けば自動で使われる。まだ無い）
- `config.json` … サイト名・URL・年度・運営者名・お問い合わせフォームのURL・アフィリエイトリンク
- `build.js` … 上のデータから `dist/` にページを書き出す（外部パッケージなし）
- `RESEARCH.md` … 定期タスクがデータを集めるときの手順書

## 作られるページ

| URL | 内容 | Googleに出すか |
|---|---|---|
| `/` | トップ（都道府県・市区町村の検索・最近の更新） | 出す |
| `/<都道府県>/` | 市区町村の一覧と、都道府県の制度 | 制度のある市区町村が1つでもあれば出す |
| `/<都道府県>/<市区町村>/` | 市区町村の補助金（工事別・制度別・出典） | 制度が1件以上あれば出す。0件は noindex＋サイトマップ除外 |
| `/<都道府県>/<工事>/` | その工事の補助金を市区町村ごとに見比べる一覧 | 3市区町村以上に制度があるときだけ作る |
| `/kuni/`・`/kuni/<slug>/` | 国の補助金 | 出す |
| `/koushin/` | 更新履歴 | 出す |
| `/about/` `/policy/` `/disclaimer/` `/privacy/` `/contact/` | 信頼性のためのページ | 出す |

`sitemap.xml`（更新日つき）・`robots.txt`・`404.html`・`favicon.svg`・`_headers` も自動で作られる。

## config.json の設定

- `fiscalYear` … 表示する年度（4月に変える）
- `operator.name` / `operator.profile` … 運営者名と紹介文（空だと「[要設定]」と表示される）
- `contactUrl` … お問い合わせフォーム（Googleフォームなど）のURL
- `googleSiteVerification` … Search Console の確認コード（HTMLタグ方式を使う場合）
- `affiliateUrl` … 見積もりサービスのアフィリエイトリンク

## ページを作る

```
node build.js
```

## Cloudflare Pages の設定

- ビルドコマンド：`node build.js`
- 出力ディレクトリ：`dist`
