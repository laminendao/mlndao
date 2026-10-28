/* ------------------------------------------------------------------
   Thème « liquide »
   1. Fond d'eau en WebGL : courants lents (bruit déformé), reflets de
      caustiques, halo de lumière sous le curseur, ondes au clic et petits
      remous quand la souris se déplace.
   2. « Goutte » de verre qui glisse sous le lien actif du menu.
   3. Reflet lumineux qui suit la souris sur les cartes.
   Sans WebGL : le dégradé CSS du site reste affiché.
   Avec « réduire les animations » : une image fixe, sans mouvement.
------------------------------------------------------------------- */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('liquid');

  // ================================================================ 1. eau
  (function water() {
    var canvas = document.createElement('canvas');
    canvas.id = 'liquid-bg';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);

    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) { canvas.remove(); return; }

    var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    var FS = [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#else',
      'precision mediump float;',
      '#endif',
      'uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uMouseOn; uniform float uScroll;',
      'uniform vec4 uRip[8];',
      'float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }',
      'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);',
      '  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x), u.y); }',
      'const mat2 R = mat2(.8,.6,-.6,.8);',
      'float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*noise(p); p=R*p*2.03; a*=.5; } return v; }',
      'void main(){',
      '  vec2 uv = gl_FragCoord.xy/uRes;',
      '  float asp = uRes.x/uRes.y;',
      '  vec2 p = vec2(uv.x*asp, uv.y + uScroll);',
      '  float t = uTime*.045;',
      // ondes : déplacement radial (réfraction) + anneau lumineux
      '  vec2 disp = vec2(0.); float ring = 0.;',
      '  for(int i=0;i<8;i++){',
      '    vec4 r = uRip[i]; float age = uTime - r.z;',
      '    if(r.w > 0. && age > 0. && age < 4.5){',
      '      vec2 d = p - vec2(r.x*asp, r.y + uScroll); float dist = length(d);',
      '      float front = age*.32; float x = dist - front;',
      '      float w = sin(x*58.) * exp(-x*x*90.) * exp(-age*.95) * r.w;',
      '      disp += d/(dist+1e-4) * w * .013; ring += w;',
      '    }',
      '  }',
      '  p += disp;',
      // courants : bruit déformé deux fois
      '  vec2 q = vec2(fbm(p*1.5 + vec2(0., t)), fbm(p*1.5 + vec2(5.2, 1.3) - t));',
      '  vec2 r2 = vec2(fbm(p*1.5 + 2.4*q + vec2(1.7, 9.2) + t*1.3), fbm(p*1.5 + 2.4*q + vec2(8.3, 2.8) - t*1.1));',
      '  float f = fbm(p*1.5 + 2.4*r2);',
      '  vec3 deep = vec3(.016,.075,.235), mid = vec3(.0,.17,.50), light = vec3(.10,.36,.80), cyan = vec3(.42,.80,1.);',
      '  vec3 col = mix(deep, mid, smoothstep(.05,.6,f));',
      '  col = mix(col, light, smoothstep(.45,1.,f)*.75);',
      '  col = mix(col, light, .28*smoothstep(.1,1.3, uv.x*.45 + (1.-uv.y)*.85));',
      // caustiques : réseaux de lignes claires qui se croisent
      '  float c1 = 1. - abs(noise(p*4.6 + q*2.2 + vec2(t*3., t*2.))*2. - 1.);',
      '  float c2 = 1. - abs(noise(p*5.9 - r2*1.6 + vec2(-t*2.2, t*2.6))*2. - 1.);',
      '  float caus = pow(max(c1,c2), 14.)*.55 + pow(c1*c2, 6.)*.75;',
      '  col += cyan * caus * (.16 + .14*uv.y);',
      // lumière sous le curseur
      '  vec2 m = vec2(uMouse.x*asp, uMouse.y + uScroll);',
      '  float g = exp(-pow(length(p - m)*3., 2.)) * uMouseOn;',
      '  col += vec3(.22,.48,.95) * g * .20 + cyan * caus * g * .35;',
      '  col += vec3(.65,.88,1.) * clamp(ring, 0., 1.) * .13;',
      // vignette douce
      '  col *= .86 + .14*smoothstep(1.35, .15, length(uv - vec2(.5,.6)));',
      '  gl_FragColor = vec4(col, 1.);',
      '}'
    ].join('\n');

    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[liquid]', gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { canvas.remove(); return; }
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ['uRes', 'uTime', 'uMouse', 'uMouseOn', 'uScroll', 'uRip'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    // l'eau est floue par nature : on calcule en demi-résolution, le navigateur agrandit
    var SCALE = 0.5, W = 0, H = 0;
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.max(1, Math.round(W * SCALE));
      canvas.height = Math.max(1, Math.round(H * SCALE));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (reduce) frame(performance.now());
    }

    var rip = new Float32Array(32), ripIdx = 0;
    var t0 = performance.now();
    function now() { return (performance.now() - t0) / 1000; }
    function addRipple(x, y, amp) {
      var o = (ripIdx++ % 8) * 4;
      rip[o] = x / W; rip[o + 1] = 1 - y / H; rip[o + 2] = now(); rip[o + 3] = amp;
    }

    var mouse = { x: .5, y: .5, tx: .5, ty: .5, on: 0, ton: 0 };
    var last = { x: -1e4, y: -1e4, t: 0 };
    window.addEventListener('pointermove', function (e) {
      mouse.tx = e.clientX / W; mouse.ty = 1 - e.clientY / H; mouse.ton = 1;
      // petits remous derrière le curseur
      var dx = e.clientX - last.x, dy = e.clientY - last.y, tt = now();
      if (dx * dx + dy * dy > 70 * 70 && tt - last.t > .12) {
        addRipple(e.clientX, e.clientY, .35);
        last.x = e.clientX; last.y = e.clientY; last.t = tt;
      }
    }, { passive: true });
    document.addEventListener('mouseleave', function () { mouse.ton = 0; });
    window.addEventListener('blur', function () { mouse.ton = 0; });
    window.addEventListener('pointerdown', function (e) {
      var el = e.target;
      if (el && el.closest && el.closest('main, a, button, nav, input, textarea, label, #profile-chat')) return;
      addRipple(e.clientX, e.clientY, 1);
    }, { passive: true });

    var raf = null;
    function frame() {
      var t = reduce ? 30 : now();
      // le curseur glisse doucement (inertie de l'eau)
      mouse.x += (mouse.tx - mouse.x) * .08; mouse.y += (mouse.ty - mouse.y) * .08;
      mouse.on += (mouse.ton - mouse.on) * .05;
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, t);
      gl.uniform2f(U.uMouse, mouse.x, mouse.y);
      gl.uniform1f(U.uMouseOn, reduce ? 0 : mouse.on);
      gl.uniform1f(U.uScroll, -(window.scrollY || 0) / Math.max(H, 1) * .18);
      gl.uniform4fv(U.uRip, rip);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    function start() { if (!reduce && raf === null) raf = requestAnimationFrame(frame); }
    function stop() { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stop(); canvas.remove(); });
    if (reduce) window.addEventListener('scroll', function () { frame(); }, { passive: true });

    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 120); });
    resize();
    document.documentElement.classList.add('liquid-gl');
    if (reduce) frame(); else start();
  })();

  // ================================================================ 2. goutte du menu
  (function navBlob() {
    var ul = document.querySelector('.nav ul');
    if (!ul) return;
    var blob = document.createElement('span');
    blob.className = 'nav-blob';
    blob.setAttribute('aria-hidden', 'true');
    ul.insertBefore(blob, ul.firstChild);
    var links = ul.querySelectorAll('a');

    function place() {
      var act = ul.querySelector('a.active');
      if (!act) { blob.style.opacity = '0'; return; }
      var li = act.parentNode;
      blob.style.opacity = '1';
      blob.style.width = li.offsetWidth + 'px';
      blob.style.transform = 'translateX(' + li.offsetLeft + 'px)';
    }
    var mo = new MutationObserver(place);
    Array.prototype.forEach.call(links, function (a) { mo.observe(a, { attributes: true, attributeFilter: ['class'] }); });
    window.addEventListener('resize', place);
    // la langue change la largeur des liens
    new MutationObserver(function () { setTimeout(place, 30); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    place();
  })();

  // ================================================================ 3. reflet sur les cartes
  (function sheen() {
    if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;
    var els = document.querySelectorAll('.card, .facts, .contact > div');
    Array.prototype.forEach.call(els, function (el) {
      el.classList.add('sheen');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }, { passive: true });
    });
  })();
})();
