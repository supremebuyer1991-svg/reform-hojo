// 都道府県ページの「地図と名前で探す」。
// 地図：1回目のタップで市区町村を選んで下の欄に案内を出し、案内のボタンかもう1回のタップでページへ。
// 名前：入力した文字を含む市区町村を、その都道府県の中から出す。
(function () {
  var box = document.getElementById('pm');
  if (!box) return;
  var data = [];
  try { data = JSON.parse(document.getElementById('pm-data').textContent); } catch (e) { return; }
  var byName = {};
  data.forEach(function (c) { byName[c.n] = c; });
  var info = document.getElementById('pm-info');
  var q = document.getElementById('pm-q');
  var out = document.getElementById('pm-out');
  var picked = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function line(c) {
    if (c.s === 'live') return '<a class="pm-go" href="' + esc(c.u) + '"><b>' + esc(c.n) + '</b><span>' + esc(c.t) + '</span><em>補助金を見る →</em></a>';
    if (c.s === 'none') return '<div class="pm-go is-off"><b>' + esc(c.n) + '</b><span>市区町村独自のリフォーム向け制度は見つかっていません。国の制度は使えます。</span></div>';
    return '<div class="pm-go is-off"><b>' + esc(c.n) + '</b><span>いま調べています。もうしばらくお待ちください。</span></div>';
  }
  function select(name) {
    var c = byName[name];
    if (!c) return;
    picked = name;
    [].forEach.call(box.querySelectorAll('.pm-city'), function (g) {
      g.classList.toggle('on', g.getAttribute('data-n') === name);
    });
    info.innerHTML = line(c);
  }
  [].forEach.call(box.querySelectorAll('.pm-city'), function (g) {
    var name = g.getAttribute('data-n');
    g.addEventListener('click', function (e) {
      // 1回目は選ぶだけ。同じところをもう1回押したらそのままページへ。
      if (picked !== name) { e.preventDefault(); select(name); }
    });
    g.addEventListener('mouseenter', function () { if (window.matchMedia('(hover: hover)').matches) select(name); });
    g.addEventListener('focus', function () { select(name); });
  });

  if (q && out) {
    q.addEventListener('input', function () {
      var v = q.value.replace(/\s/g, '');
      if (!v) { out.innerHTML = ''; return; }
      var hit = data.filter(function (c) { return c.n.indexOf(v) >= 0 || (c.k && c.k.indexOf(v) >= 0); }).slice(0, 10);
      out.innerHTML = hit.length ? hit.map(line).join('') : '<p class="small muted">見つかりませんでした。市区町村の名前を確かめてください。</p>';
    });
  }
})();
