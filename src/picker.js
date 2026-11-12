// 「工事から探す」の切り替え。結果はHTMLに最初から書いてあり、ここでは表示を切り替えるだけ。
(function () {
  var box = document.getElementById('panels');
  if (!box) return;
  var cats = [].slice.call(document.querySelectorAll('.cat'));
  var panels = [].slice.call(box.querySelectorAll('.result'));
  function show(id) {
    if (!panels.some(function (p) { return p.id === id; })) return false;
    panels.forEach(function (p) { p.classList.toggle('on', p.id === id); });
    cats.forEach(function (b) {
      var on = b.getAttribute('data-cat') === id;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    [].forEach.call(document.querySelectorAll('.prog'), function (p) {
      p.classList.toggle('on', (' ' + p.getAttribute('data-cats') + ' ').indexOf(' ' + id + ' ') >= 0);
    });
    return true;
  }
  box.classList.add('js');
  cats.forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var id = b.getAttribute('data-cat');
      show(id);
      if (history.replaceState) history.replaceState(null, '', '#' + id);
    });
  });
  function fromHash() { return show(location.hash.slice(1)); }
  if (!fromHash()) show(box.getAttribute('data-first'));
  window.addEventListener('hashchange', fromHash);
  document.addEventListener('DOMContentLoaded', function () { show(box.querySelector('.result.on').id); });
})();
