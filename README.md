# リフォーム補助金ナビ（reform-hojo.com）

市区町村と国のリフォーム補助金を、工事ごとに整理するサイトです。

## しくみ

- `data/cities/<都道府県>/<市区町村>.json` … 市区町村ごとの補助金データ
- `data/national.json` … 国の補助金の一覧
- `src/kuni/<slug>.html` … 国の補助金ページの本文
- `src/style.css` / `src/picker.js` … デザインと「工事から探す」の動き
- `config.json` … サイト名・URL・アフィリエイトリンク
- `build.js` … 上のデータから `dist/` にページを書き出す（外部パッケージなし）

## ページを作る

```
node build.js
```

## Cloudflare Pages の設定

- ビルドコマンド：`node build.js`
- 出力ディレクトリ：`dist`
