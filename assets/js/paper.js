/* Formules de recherche écrites en fond de page (thème « papier »).
   Rendu KaTeX ; une formule se précise quand la souris passe à côté.
   Pour changer les formules : modifier la liste ci-dessous. */
(function () {
  // x, y : position en % de la fenêtre (x = bord gauche si < 50, bord droit sinon) ; r : rotation ; s : taille ; desk : masquée sur mobile
  var F = [
    { tex: '\\phi_i=\\sum_{S\\subseteq F\\setminus\\{i\\}}\\frac{|S|!\\,(|F|-|S|-1)!}{|F|!}\\,\\big[f(S\\cup\\{i\\})-f(S)\\big]',
      x: 4, y: 13, r: -3, s: '1.05rem', desk: true },
    { tex: '\\Sigma=\\begin{pmatrix}\\sigma_1^2 & \\cdots & \\sigma_{1p}\\\\ \\vdots & \\ddots & \\vdots\\\\ \\sigma_{p1} & \\cdots & \\sigma_p^2\\end{pmatrix}',
      x: 95, y: 13, r: 2, s: '1.05rem', desk: true },
    { tex: '\\hat\\beta=(X^{\\top}X)^{-1}X^{\\top}y', x: 96, y: 41, r: -2, s: '1.3rem', desk: true },
    { tex: 'f(x)=\\phi_0+\\sum_{i=1}^{M}\\phi_i', x: 3, y: 42, r: 2, s: '1.25rem', desk: true },
    { tex: '\\hat\\Sigma=\\frac{1}{n-1}\\sum_{i=1}^{n}(x_i-\\bar x)(x_i-\\bar x)^{\\top}', x: 3, y: 70, r: -3, s: '1.05rem', desk: true },
    { tex: '\\min_{\\beta}\\ \\lVert y-X\\beta\\rVert_2^2', x: 97, y: 68, r: 1.5, s: '1.25rem', desk: true },
    { tex: '\\mathrm{RMSE}=\\sqrt{\\tfrac1n\\textstyle\\sum_i(\\hat y_i-y_i)^2}', x: 4, y: 91, r: 3, s: '1.1rem' },
    { tex: '\\operatorname{Var}(\\hat\\beta)=\\sigma^2(X^{\\top}X)^{-1}', x: 96, y: 91, r: -2, s: '1.15rem' }
  ];

  function render() {
    if (!window.katex) return;
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
      try { katex.render(f.tex, el, { throwOnError: false, displayMode: false }); } catch (e) { return; }
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
