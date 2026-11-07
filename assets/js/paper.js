/* Formules de recherche écrites en fond de page (thème « papier »).
   Les formules sont déjà converties en SVG dans assets/js/formulas.js
   (généré par scripts/formules.mjs : c'est là qu'on les modifie).
   Une formule se précise quand la souris passe à côté. */
(function () {
  function render() {
    var F = window.PAPER_FORMULAS;
    if (!F || !F.length) return;
    var box = document.createElement('div');
    box.id = 'formulas';
    box.setAttribute('aria-hidden', 'true');
    F.forEach(function (f) {
      var el = document.createElement('div');
      el.className = 'f' + (f.desk ? ' desk' : '');
      if (f.x < 50) el.style.left = f.x + '%';
      else { el.style.right = (100 - f.x) + '%'; el.classList.add('end'); }
      el.style.top = f.y + '%';
      el.style.setProperty('--r', f.r + 'deg');
      el.style.setProperty('--s', f.s);
      el.innerHTML = f.svg;
      box.appendChild(el);
    });
    document.body.insertBefore(box, document.body.firstChild);

    // proximité de la souris : la formule « s'éclaire »
    if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;
    var items = box.querySelectorAll('.f'), raf = 0, mx = -1e4, my = -1e4;
    function tick() {
      raf = 0;
      items.forEach(function (el) {
        var b = el.getBoundingClientRect();
        var dx = Math.max(b.left - mx, 0, mx - b.right);
        var dy = Math.max(b.top - my, 0, my - b.bottom);
        el.classList.toggle('near', dx * dx + dy * dy < 120 * 120);
      });
    }
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
