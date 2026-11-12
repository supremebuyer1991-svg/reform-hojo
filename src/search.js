// トップページの「市区町村の名前で探す」。入力されたときだけ一覧（/cities.json）を読み込む。
(function () {
  var q = document.getElementById('q');
  var out = document.getElementById('q-out');
  if (!q || !out) return;
  var list = null;
  var loading = false;
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function render() {
    var v = q.value.replace(/\s/g, '');
    if (!v || !list) { out.innerHTML = ''; return; }
    var hit = list.filter(function (c) { return c.n.indexOf(v) >= 0 || (c.k && c.k.indexOf(v) >= 0); }).slice(0, 12);
    out.innerHTML = hit.length ? hit.map(function (c) {
      return '<a class="nb" href="' + esc(c.u) + '"><i aria-hidden="true"></i>' + esc(c.n) + '<small>' + esc(c.p) + '</small></a>';
    }).join('') : '<span class="small muted">まだ掲載していないか、制度が見つかっていない市区町村です。</span>';
  }
  q.addEventListener('input', function () {
    if (list) return render();
    if (loading) return;
    loading = true;
    fetch('/cities.json').then(function (r) { return r.json(); }).then(function (d) { list = d; render(); }).catch(function () { loading = false; });
  });
})();
