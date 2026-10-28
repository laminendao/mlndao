/* ------------------------------------------------------------------
   Fond animé « champ de données »
   - points en dérive (processus d'Ornstein-Uhlenbeck) reliés en graphe
   - régression linéaire en direct autour du curseur (droite, résidus, r)
   - clic sur le fond : échantillon gaussien N(clic, σ²) qui s'estompe
   - signaux multivariés qui défilent (séries temporelles)
   Respecte prefers-reduced-motion et se met en pause onglet caché.
------------------------------------------------------------------- */
(function () {
  var canvas = document.getElementById('data-bg');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, dpr = 1;
  var pts = [];        // points permanents
  var samples = [];    // échantillons gaussiens (clic)
  var mouse = { x: -1e4, y: -1e4, on: false };
  var t = 0, raf = null;

  var LINK = 130;      // distance max pour relier deux points
  var FOCUS = 200;     // rayon de la fenêtre de régression

  var C = {
    point: 'rgba(205, 222, 255, 0.75)',
    link: '150, 190, 255',
    focus: '#9fdcff',
    sample: '255, 205, 110',
    signal: ['rgba(160, 200, 255, 0.20)', 'rgba(140, 230, 220, 0.16)', 'rgba(200, 180, 255, 0.16)']
  };

  function gauss() {
    var u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function makePoint(x, y) {
    return { x: x, y: y, vx: gauss() * 0.15, vy: gauss() * 0.15, r: 1.2 + Math.random() * 1.6 };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var target = Math.round(Math.min(110, Math.max(35, (W * H) / 14000)));
    while (pts.length < target) pts.push(makePoint(Math.random() * W, Math.random() * H));
    if (pts.length > target) pts.length = target;
    if (reduce) draw();
  }

  // ---------- dynamique ----------
  function step() {
    var i, p, dx, dy, d;
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      // Ornstein-Uhlenbeck : rappel vers 0 + bruit
      p.vx = p.vx * 0.985 + gauss() * 0.018;
      p.vy = p.vy * 0.985 + gauss() * 0.018;
      // légère attraction vers le curseur
      if (mouse.on) {
        dx = mouse.x - p.x; dy = mouse.y - p.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d < FOCUS * 1.4 && d > 1) { p.vx += (dx / d) * 0.006; p.vy += (dy / d) * 0.006; }
      }
      p.x += p.vx; p.y += p.vy;
      if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
    }
    for (i = samples.length - 1; i >= 0; i--) {
      p = samples[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= 0.0035;
      if (p.life <= 0) samples.splice(i, 1);
    }
  }

  // ---------- dessin ----------
  function drawSignals() {
    var k, x, u, y, base, amp;
    var bands = [0.62, 0.74, 0.86];
    ctx.lineWidth = 1.2;
    for (k = 0; k < 3; k++) {
      base = H * bands[k];
      amp = Math.min(34, H * 0.04);
      ctx.strokeStyle = C.signal[k];
      ctx.beginPath();
      for (x = 0; x <= W + 6; x += 6) {
        u = x * 0.012 + t * (0.004 + k * 0.0012);
        y = base
          + amp * (0.55 * Math.sin(u * (1 + k * 0.37) + k)
          + 0.30 * Math.sin(u * 2.71 + k * 2.1)
          + 0.15 * Math.sin(u * 6.13 + k * 0.7))
          // tendance de dégradation lente, réinitialisée en dents de scie
          + amp * 0.9 * ((x / W + t * 0.0004 + k * 0.33) % 1);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawGraph(all) {
    var i, j, a, b, dx, dy, d2, L2 = LINK * LINK, alpha;
    ctx.lineWidth = 1;
    for (i = 0; i < all.length; i++) {
      a = all[i];
      for (j = i + 1; j < all.length; j++) {
        b = all[j];
        dx = a.x - b.x; dy = a.y - b.y; d2 = dx * dx + dy * dy;
        if (d2 < L2) {
          alpha = (1 - d2 / L2) * 0.32 * Math.min(a.life || 1, b.life || 1);
          ctx.strokeStyle = 'rgba(' + C.link + ',' + alpha.toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    for (i = 0; i < pts.length; i++) {
      a = pts[i];
      ctx.fillStyle = C.point;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
    }
    for (i = 0; i < samples.length; i++) {
      a = samples[i];
      ctx.fillStyle = 'rgba(' + C.sample + ',' + (0.9 * a.life).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(a.x, a.y, 2.2, 0, 6.2832); ctx.fill();
    }
  }

  function drawRegression(all) {
    if (!mouse.on) return;
    var near = [], i, p, dx, dy, F2 = FOCUS * FOCUS;
    for (i = 0; i < all.length; i++) {
      p = all[i]; dx = p.x - mouse.x; dy = p.y - mouse.y;
      if (dx * dx + dy * dy < F2) near.push(p);
    }

    // fenêtre
    ctx.strokeStyle = 'rgba(159, 220, 255, 0.18)';
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, FOCUS, 0, 6.2832); ctx.stroke();
    ctx.setLineDash([]);

    var n = near.length;
    if (n < 4) return;

    // moindres carrés : y = a + b x (axe y vers le haut)
    var sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, x, y, xmin = 1e9, xmax = -1e9;
    for (i = 0; i < n; i++) {
      x = near[i].x; y = -near[i].y;
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
      if (x < xmin) xmin = x; if (x > xmax) xmax = x;
    }
    var vx = sxx - sx * sx / n, vy = syy - sy * sy / n, cxy = sxy - sx * sy / n;
    if (vx < 1e-6 || vy < 1e-6) return;
    var b = cxy / vx, a = (sy - b * sx) / n, r = cxy / Math.sqrt(vx * vy);
    function yhat(xx) { return -(a + b * xx); }

    // résidus
    ctx.strokeStyle = 'rgba(159, 220, 255, 0.35)';
    ctx.lineWidth = 1;
    for (i = 0; i < n; i++) {
      p = near[i];
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, yhat(p.x)); ctx.stroke();
    }

    // points dans la fenêtre
    ctx.fillStyle = C.focus;
    for (i = 0; i < n; i++) {
      p = near[i];
      ctx.beginPath(); ctx.arc(p.x, p.y, (p.r || 2) + 1, 0, 6.2832); ctx.fill();
    }

    // droite ajustée
    var pad = 30;
    ctx.strokeStyle = C.focus;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xmin - pad, yhat(xmin - pad));
    ctx.lineTo(xmax + pad, yhat(xmax + pad));
    ctx.stroke();

    // étiquette
    var label = 'r = ' + r.toFixed(2) + '   n = ' + n;
    ctx.font = '500 12.5px "IBM Plex Mono", ui-monospace, Menlo, monospace';
    var w = ctx.measureText(label).width + 16, ly = mouse.y - 16;
    // côté extérieur (vers le bord), pour ne pas passer sous la carte blanche
    var lx = mouse.x < W / 2 ? mouse.x - 16 - w : mouse.x + 16;
    if (lx < 8) lx = 8;
    if (lx + w > W - 8) lx = W - 8 - w;
    if (ly < 24) ly = mouse.y + 30;
    ctx.fillStyle = 'rgba(4, 22, 70, 0.72)';
    roundRect(lx, ly - 17, w, 24, 6); ctx.fill();
    ctx.fillStyle = '#e6f4ff';
    ctx.fillText(label, lx + 8, ly);
  }

  function roundRect(x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var all = pts.concat(samples);
    drawSignals();
    drawGraph(all);
    drawRegression(all);
  }

  function loop() {
    t++;
    step();
    draw();
    raf = window.requestAnimationFrame(loop);
  }

  function start() { if (!reduce && raf === null) raf = window.requestAnimationFrame(loop); }
  function stop() { if (raf !== null) { window.cancelAnimationFrame(raf); raf = null; } }

  // ---------- interactions ----------
  function setMouse(x, y) { mouse.x = x; mouse.y = y; mouse.on = true; if (reduce) draw(); }
  function clearMouse() { mouse.on = false; if (reduce) draw(); }

  window.addEventListener('mousemove', function (e) { setMouse(e.clientX, e.clientY); }, { passive: true });
  document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) clearMouse(); });
  window.addEventListener('blur', clearMouse);
  window.addEventListener('touchstart', function (e) {
    if (e.touches[0]) setMouse(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener('touchend', clearMouse, { passive: true });

  // clic sur le fond bleu (pas sur la carte, les liens, les boutons)
  window.addEventListener('click', function (e) {
    var el = e.target;
    if (el && el.closest && el.closest('main, a, button, nav, input, label, #profile-chat')) return;
    var k, s = 52, m = 24;
    for (k = 0; k < m; k++) {
      samples.push({
        x: e.clientX, y: e.clientY,
        vx: gauss() * s * 0.05, vy: gauss() * s * 0.05,
        r: 2.2, life: 1
      });
    }
    if (samples.length > 120) samples.splice(0, samples.length - 120);
    if (reduce) draw();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 120);
  });

  resize();
  if (reduce) draw(); else start();
})();
