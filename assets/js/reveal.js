/* ------------------------------------------------------------------
   Animations d'ouverture et d'apparition
   - nom : « décodage » à partir de symboles mathématiques
   - en-tête : empilement ligne par ligne
   - sections : apparition par strates au défilement, trait-axe sous h2,
     compteurs de publications qui comptent depuis 0
   Sans JS ou avec « réduire les animations » : tout est affiché directement.
------------------------------------------------------------------- */
(function () {
  var html = document.documentElement;
  window.__revealReady = true;
  if (!html.classList.contains('js-anim')) return;

  var STEP = 75; // ms entre deux éléments empilés

  function stagger(els, start) {
    var i = start || 0;
    els.forEach(function (el) {
      if (!el) return;
      el.classList.add('rv');
      el.style.setProperty('--d', (i * STEP) + 'ms');
      i++;
    });
    return i;
  }

  // ---------- en-tête ----------
  var header = document.querySelector('.site-header');
  var h1 = header && header.querySelector('h1');
  if (header) {
    var list = [header.querySelector('.photo'), h1, header.querySelector('.role'), header.querySelector('.affil')];
    list = list.concat(Array.prototype.slice.call(header.querySelectorAll('.themes li, .icons li')));
    var n = stagger(list, 0);
    var nav = document.querySelector('.nav');
    if (nav) stagger([nav], n);
  }

  // ---------- décodage du nom ----------
  var SYMBOLS = '∑∂∫λμσθπ∇∞≈∈ΩΔβαφψ01';
  function decode(el) {
    var text = el.textContent;
    el.setAttribute('aria-label', text);
    el.textContent = '';
    var spans = [];
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement('span');
      s.textContent = text[i];
      s.setAttribute('aria-hidden', 'true');
      el.appendChild(s);
      spans.push(s);
    }
    // fige la largeur de chaque lettre pour éviter que la ligne ne tremble
    spans.forEach(function (s) {
      if (s.textContent === ' ') return;
      s.style.display = 'inline-block';
      s.style.width = s.getBoundingClientRect().width + 'px';
      s.style.textAlign = 'center';
    });
    var start = null, DUR = 1100, SPREAD = 0.55;
    function frame(ts) {
      if (start === null) start = ts;
      var p = (ts - start) / DUR, done = true;
      spans.forEach(function (s, k) {
        var ch = text[k];
        if (ch === ' ') return;
        var lock = (k / text.length) * SPREAD + (1 - SPREAD) * 0.6;
        if (p >= lock) { s.textContent = ch; s.classList.remove('sym'); }
        else {
          done = false;
          if (Math.random() < 0.35) s.textContent = SYMBOLS[(Math.random() * SYMBOLS.length) | 0];
          s.classList.add('sym');
        }
      });
      if (!done) requestAnimationFrame(frame);
      else { el.textContent = text; el.removeAttribute('aria-label'); }
    }
    // démarre une fois le titre visible dans l'empilement
    setTimeout(function () { requestAnimationFrame(frame); }, STEP + 60);
  }

  // ---------- sections ----------
  var sections = Array.prototype.slice.call(document.querySelectorAll('main section'));
  sections.forEach(function (sec) {
    var items = [];
    Array.prototype.forEach.call(sec.children, function (c) {
      if (c.classList.contains('cards') || c.classList.contains('bio')) {
        Array.prototype.forEach.call(c.children, function (cc) { items.push(cc); });
      } else items.push(c);
    });
    // délai plafonné pour que les longues sections ne traînent pas
    items.forEach(function (el, i) {
      el.classList.add('rv');
      el.style.setProperty('--d', Math.min(i, 8) * 90 + 'ms');
    });
    sec.classList.add('rv-sec');
  });

  function countUp(el) {
    var target = parseInt(el.textContent, 10);
    if (!(target > 0)) return;
    var t0 = null, D = 700;
    el.textContent = '0';
    function f(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / D);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  }

  function show(sec) {
    sec.classList.add('in');
    Array.prototype.forEach.call(sec.querySelectorAll('.pub-group .count'), function (c, i) {
      setTimeout(function () { countUp(c); }, 250 + i * 80);
    });
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  } else {
    sections.forEach(show);
  }

  // ---------- lancement ----------
  requestAnimationFrame(function () {
    if (h1) decode(h1);
    requestAnimationFrame(function () { html.classList.add('anim-start'); });
  });
})();
