// 「やりたい工事から探す」の切り替え
(function () {
  var data = window.PICK || [];
  var title = document.getElementById('pick-title');
  var cityBox = document.getElementById('pick-city');
  var kuniBox = document.getElementById('pick-kuni');
  if (!title || !data.length) return;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rows(list, none) {
    if (!list.length) return '<p class="none">' + esc(none) + '</p>';
    return '<ul class="rows">' + list.map(function (r) {
      return '<li><span class="top"><b>' + esc(r.name) + '</b><span class="amt">' + esc(r.amt) + '</span></span>' +
        '<span class="note">' + esc(r.note) + '</span><a href="' + esc(r.href) + '">くわしく見る →</a></li>';
    }).join('') + '</ul>';
  }
  function show(id) {
    var d = data.filter(function (x) { return x.id === id; })[0] || data[0];
    title.textContent = '「' + d.name + '」に使える制度';
    cityBox.innerHTML = rows(d.city, d.cityNone);
    kuniBox.innerHTML = rows(d.kuni, d.kuniNone);
    document.querySelectorAll('.cat').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-cat') === d.id ? 'true' : 'false');
    });
    document.querySelectorAll('.prog').forEach(function (p) {
      p.classList.toggle('on', (' ' + p.getAttribute('data-cats') + ' ').indexOf(' ' + d.id + ' ') >= 0);
    });
  }
  document.querySelectorAll('.cat').forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-cat')); });
  });
  show(data[0].id);
})();
