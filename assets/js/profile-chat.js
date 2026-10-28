/*!
 * Assistant IA du site de Mouhamadou Lamine NDAO
 * ----------------------------------------------------------------------
 * Panneau latéral façon article de recherche, ouvert depuis un onglet sur le
 * bord droit de l'écran. Intégration (avant </body>) :
 *
 *   <script src="assets/js/profile-chat.js"
 *           data-api="https://lamine-chat.<sous-domaine>.workers.dev/chat" defer></script>
 *
 * Options (attributs data-*) :
 *   data-api       URL de l'API (Cloudflare Worker, route /chat) — obligatoire
 *   data-avatar    (optionnel) image à utiliser à la place de l'avatar dessiné
 *   data-email     adresse proposée en cas de panne (défaut mlndao@outlook.com)
 *   data-open      "true" pour ouvrir le panneau au chargement
 *
 * La langue suit le bouton FR / EN du site (attribut data-lang de <html>).
 * Le widget vit dans un Shadow DOM : il n'hérite pas du CSS de la page et ne le modifie pas.
 */
(function () {
  'use strict';
  if (window.__profileChatLoaded) return;
  window.__profileChatLoaded = true;

  var script = document.currentScript || document.querySelector('script[src*="profile-chat"]');
  var ds = (script && script.dataset) || {};
  var CFG = {
    api: ds.api || '',
    avatar: ds.avatar || '',
    email: ds.email || 'mlndao@outlook.com',
    openOnLoad: ds.open === 'true',
  };
  if (!CFG.api || /VOTRE|<|>/.test(CFG.api)) {
    console.info('[Assistant] data-api non configuré : le chat n’est pas affiché (voir chatbot/README.md).');
    return;
  }

  var STORE_KEY = 'profile-chat-history-v1';
  var SEEN_KEY = 'profile-chat-seen-v1';

  // ------------------------------------------------------------------ textes
  var T = {
    fr: {
      kicker: 'En ligne',
      title: 'Assistant intelligent',
      tab: 'Poser une question',
      welcome:
        'Bonjour et bienvenue. Je suis l’assistant virtuel de **Lamine NDAO** : je peux vous présenter ses ' +
        'recherches, ses publications, ses enseignements et son parcours, ou vous indiquer comment le contacter.',
      suggestions: [
        ['ses recherches', 'Sur quoi portent ses recherches ?'],
        ['publications', 'Quelles sont ses publications récentes ?'],
        ['sa thèse', 'Sur quoi porte sa thèse ?'],
        ['ses cours', 'Quels cours enseigne-t-il ?'],
        ['contact', 'Comment le contacter ?'],
      ],
      teaser: 'Une question sur mes travaux ? <b>Mon assistant vous répond.</b>',
      placeholder: 'Votre question…',
      input: 'Votre question',
      send: 'Entrée',
      reset: 'Nouvelle conversation',
      close: 'Fermer l’assistant',
      openLabel: 'Ouvrir l’assistant de Lamine NDAO',
      typing: 'recherche dans le site',
      legal: 'réponses générées par IA à partir de ce site',
      error:
        'Désolé, je ne parviens pas à répondre pour le moment. Vous pouvez réessayer dans un instant ' +
        'ou écrire directement à Lamine : ',
    },
    en: {
      kicker: 'Online',
      title: 'Smart assistant',
      tab: 'Ask a question',
      welcome:
        'Hello and welcome. I am the virtual assistant of **Lamine NDAO**: I can tell you about his research, ' +
        'publications, teaching and background, or how to get in touch with him.',
      suggestions: [
        ['his research', 'What is his research about?'],
        ['publications', 'What are his recent publications?'],
        ['his PhD', 'What was his PhD about?'],
        ['teaching', 'What courses does he teach?'],
        ['contact', 'How can I contact him?'],
      ],
      teaser: 'A question about my work? <b>My assistant will answer.</b>',
      placeholder: 'Your question…',
      input: 'Your question',
      send: 'Enter',
      reset: 'New conversation',
      close: 'Close the assistant',
      openLabel: 'Open Lamine NDAO’s assistant',
      typing: 'searching the website',
      legal: 'AI-generated answers based on this website',
      error: 'Sorry, I cannot answer right now. Please try again in a moment or email Lamine directly: ',
    },
  };
  function lang() { return document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'fr'; }
  function t(k) { return T[lang()][k]; }

  // ------------------------------------------------------------------ avatar
  // Petite tête de robot avec antenne (dessin original, sans image externe).
  var AVATAR =
    '<svg viewBox="0 0 48 48" aria-hidden="true">' +
    '<defs><radialGradient id="avg" cx="32%" cy="26%" r="80%">' +
    '<stop offset="0" stop-color="#3d7be0"/><stop offset=".55" stop-color="#1452c8"/><stop offset="1" stop-color="#0a2a6b"/>' +
    '</radialGradient></defs>' +
    '<circle cx="24" cy="24" r="24" fill="url(#avg)"/>' +
    // antenne
    '<path d="M24 15V10.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="24" cy="8.6" r="2.9" fill="#ffcd6e"/>' +
    // oreilles
    '<rect x="9.2" y="22" width="3.4" height="8" rx="1.6" fill="#cfe0ff"/>' +
    '<rect x="35.4" y="22" width="3.4" height="8" rx="1.6" fill="#cfe0ff"/>' +
    // tête
    '<rect x="12" y="15" width="24" height="21" rx="7" fill="#fff"/>' +
    // visière
    '<rect x="15" y="19.5" width="18" height="9.5" rx="4.75" fill="#0a2a6b"/>' +
    // yeux
    '<circle cx="20" cy="24.25" r="2.1" fill="#7fd3ff"/><circle cx="28" cy="24.25" r="2.1" fill="#7fd3ff"/>' +
    // sourire
    '<path d="M21 31.6q3 1.9 6 0" stroke="#0a2a6b" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
    '</svg>';

  // ------------------------------------------------------------------ styles
  var CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .root { --navy:#003189; --navy2:#0a2a6b; --blue:#1452c8; --soft:#e8eefb; --gold:#ffcd6e;
          --ink:#1a1a1a; --muted:#5a6275; --line:#dde3ef; --paper:#fdfdfb;
          --serif: "CMU Serif", "Latin Modern Roman", Georgia, serif;
          --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
          font-family: "Source Sans 3", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          font-size: 15px; line-height: 1.55; color: var(--ink); }

  .av { display: block; border-radius: 50%; flex: none; overflow: hidden; background: var(--navy) center 20% / cover; }
  .av svg { display: block; width: 100%; height: 100%; }

  /* ---------- onglet (fermé) */
  .tab { position: fixed; right: 0; top: 50%; z-index: 2147483000;
         transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; gap: 12px;
         padding: 12px 9px 16px; background: #fff; color: var(--navy); border: 0; cursor: pointer;
         border-radius: 12px 0 0 12px; box-shadow: -6px 8px 26px rgba(0,10,50,.32);
         transition: transform .3s cubic-bezier(.2,.8,.2,1), padding .2s; }
  .tab:hover { padding-right: 13px; }
  .tab:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
  .tab .av { width: 34px; height: 34px; box-shadow: 0 0 0 2px #fff, 0 0 0 3px #c3d2ee; }
  .tab .lbl { writing-mode: vertical-rl; font: 600 12px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; }
  .tab .pulse { position: absolute; top: 12px; left: 50%; width: 34px; height: 34px; margin-left: -17px;
                border-radius: 50%; border: 2px solid var(--gold); animation: pulse 2.6s ease-out infinite; pointer-events: none; }
  .root.seen .tab .pulse { display: none; }
  .root.open .tab { transform: translate(110%, -50%); }
  @keyframes pulse { 0% { transform: scale(1); opacity: .8 } 100% { transform: scale(1.7); opacity: 0 } }

  .teaser { position: fixed; right: 64px; top: 50%; z-index: 2147483000; transform: translate(8px, -50%);
            width: max-content; max-width: 230px; background: #fff; color: var(--ink); padding: 10px 14px;
            border-radius: 12px 12px 4px 12px; box-shadow: 0 8px 24px rgba(0,10,50,.25); font-size: 14px; cursor: pointer;
            opacity: 0; pointer-events: none; transition: all .35s ease; }
  .teaser.show { opacity: 1; transform: translate(0, -50%); pointer-events: auto; }
  .teaser b { color: var(--blue); font-weight: 600; }

  /* ---------- panneau (ouvert) */
  .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 440px; max-width: 100vw; z-index: 2147483001;
            background: var(--paper); border-left: 1px solid var(--line); box-shadow: -20px 0 60px rgba(0,10,50,.35);
            display: flex; flex-direction: column;
            transform: translateX(105%); visibility: hidden;
            transition: transform .35s cubic-bezier(.2,.8,.2,1), visibility 0s linear .35s; }
  .root.open .drawer { transform: none; visibility: visible; transition: transform .35s cubic-bezier(.2,.8,.2,1); }

  .head { position: relative; display: flex; gap: 14px; align-items: center; padding: 20px 20px 14px 24px;
          border-bottom: 1px solid var(--line); }
  .head .av { width: 54px; height: 54px; box-shadow: 0 0 0 3px #fff, 0 0 0 4px #c3d2ee, 0 6px 16px rgba(0,10,50,.2); }
  .head .txt { flex: 1; min-width: 0; }
  .kicker { font: 500 11px/1 var(--mono); letter-spacing: .1em; color: var(--muted); text-transform: uppercase;
            display: flex; align-items: center; gap: 6px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #40c057; box-shadow: 0 0 0 2px rgba(64,192,87,.25); }
  h2 { margin: 6px 0 2px; font: 700 23px/1.15 var(--serif); color: var(--navy); }
  .tools { display: flex; gap: 2px; align-self: flex-start; }
  .hbtn { background: transparent; border: 0; color: var(--muted); cursor: pointer; width: 32px; height: 32px;
          border-radius: 8px; display: grid; place-items: center; }
  .hbtn:hover { color: var(--navy); background: var(--soft); }
  .hbtn:focus-visible { outline: 2px solid var(--blue); }
  .hbtn svg { width: 18px; height: 18px; }

  .log { flex: 1; overflow-y: auto; padding: 20px 24px 8px; scroll-behavior: smooth; }
  .intro { display: flex; gap: 12px; margin: 0 0 18px; color: #2b3242; }
  .intro .av { width: 26px; height: 26px; margin-top: 2px; }
  .intro p { margin: 0; }

  .q { font: 500 13.5px/1.5 var(--mono); color: var(--blue); margin: 4px 0 10px; word-wrap: break-word; }
  .q .n { color: var(--muted); }
  .a { position: relative; border-left: 2px solid var(--navy); padding: 2px 0 2px 16px; margin: 0 0 22px; word-wrap: break-word;
       animation: in .25s ease; }
  .a .av { position: absolute; left: -12px; top: -2px; width: 22px; height: 22px; box-shadow: 0 0 0 3px var(--paper); }
  .a > div { padding-top: 1px; }
  @keyframes in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
  .a p { margin: 0 0 9px; } .a p:last-child { margin-bottom: 0; }
  .a ul { margin: 4px 0 10px; padding-left: 18px; } .a ul li { margin: 3px 0; }
  .a ol { margin: 4px 0 10px; padding: 0; list-style: none; counter-reset: r; }
  .a ol li { counter-increment: r; position: relative; padding-left: 30px; margin: 0 0 8px; }
  .a ol li::before { content: "[" counter(r) "]"; position: absolute; left: 0; font: 600 12.5px/1.95 var(--mono); color: var(--navy); }
  .a a { color: var(--blue); font-weight: 600; text-decoration: none; }
  .a a:hover { text-decoration: underline; }
  .a em { font-family: var(--serif); font-size: 1.04em; }
  .a code { font: 13px var(--mono); background: var(--soft); padding: 0 4px; border-radius: 4px; }
  .a.err { border-left-color: #c92a2a; color: #a61e1e; }
  .a .typing { font: 500 12.5px var(--mono); color: var(--muted); }
  .a .typing::after { content: "▍"; color: var(--blue); animation: caret 1s steps(1) infinite; margin-left: 2px; }
  .a .cursor { display: inline-block; width: .5em; height: 1.05em; margin-left: 2px; vertical-align: -.17em;
               background: var(--blue); border-radius: 1px; animation: caret 1s steps(1) infinite; }
  @keyframes caret { 50% { opacity: 0 } }

  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 2px 0 18px; }
  .chip { background: transparent; border: 1px dashed #9db3df; color: var(--navy); border-radius: 6px;
          padding: 5px 9px; font: 500 12.5px/1.3 var(--mono); cursor: pointer; transition: all .15s; }
  .chip:hover, .chip:focus-visible { background: var(--navy); color: #fff; border-color: var(--navy); border-style: solid; outline: 0; }

  .foot { padding: 14px 20px 14px; border-top: 1px solid var(--line); background: #fff; }
  .composer { display: flex; align-items: flex-end; gap: 10px; border: 1px solid var(--line); border-radius: 10px;
              padding: 7px 7px 7px 12px; background: #f8f9fc; transition: border-color .15s, box-shadow .15s; }
  .composer:focus-within { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(20,82,200,.14); background: #fff; }
  textarea { flex: 1; border: 0; outline: 0; background: transparent; resize: none; font: inherit; color: var(--ink);
             max-height: 120px; min-height: 22px; padding: 5px 0; }
  textarea::placeholder { color: #8a95a8; }
  .send { border: 0; background: var(--navy); color: #fff; border-radius: 7px; padding: 7px 10px; cursor: pointer;
          font: 600 12px/1 var(--mono); flex: none; transition: background .15s, opacity .15s; }
  .send:hover { background: var(--blue); }
  .send:disabled { opacity: .35; cursor: not-allowed; }
  .legal { margin: 8px 0 0; font: 500 10.5px var(--mono); color: var(--muted); text-align: center; }

  @media (max-width: 560px) {
    .drawer { width: 100vw; border-left: 0; }
    .tab { top: auto; bottom: 18px; transform: none; padding: 8px; border-radius: 50%; }
    .tab:hover { padding-right: 8px; }
    .tab .lbl { display: none; }
    .tab .av { width: 44px; height: 44px; box-shadow: none; }
    .tab .pulse { top: 8px; width: 44px; height: 44px; margin-left: -22px; }
    .root.open .tab { transform: translateX(150%); }
    .teaser { top: auto; bottom: 30px; right: 82px; transform: translateY(8px); }
    .teaser.show { transform: none; }
    .tab { right: 16px; }
    .head { padding: 16px 14px 12px 18px; }
    .head .av { width: 44px; height: 44px; }
    h2 { font-size: 20px; }
    .log { padding: 18px 18px 8px; }
  }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  `;

  // ------------------------------------------------------------------ icônes
  var I = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  };

  // ------------------------------------------------------------------ DOM
  var host = document.createElement('div');
  host.id = 'profile-chat';
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML =
    '<style>' + CSS + '</style>' +
    '<div class="root">' +
    '  <button class="tab" aria-expanded="false"><span class="pulse"></span><span class="av"></span><span class="lbl"></span></button>' +
    '  <div class="teaser" role="button" tabindex="-1"></div>' +
    '  <aside class="drawer" role="dialog" aria-modal="false">' +
    '    <header class="head">' +
    '      <span class="av"></span>' +
    '      <div class="txt"><span class="kicker"><span class="dot"></span><span class="k"></span></span><h2></h2></div>' +
    '      <div class="tools"><button class="hbtn" data-act="reset">' + I.reset + '</button>' +
    '      <button class="hbtn" data-act="close">' + I.close + '</button></div>' +
    '    </header>' +
    '    <div class="log" aria-live="polite"></div>' +
    '    <footer class="foot">' +
    '      <form class="composer">' +
    '        <textarea rows="1" maxlength="1000"></textarea>' +
    '        <button class="send" type="submit" disabled></button>' +
    '      </form>' +
    '      <p class="legal"></p>' +
    '    </footer>' +
    '  </aside>' +
    '</div>';

  var $ = function (s) { return shadow.querySelector(s); };
  var root = $('.root'), drawer = $('.drawer'), log = $('.log'), form = $('.composer'),
      input = $('textarea'), sendBtn = $('.send'), tab = $('.tab'), teaser = $('.teaser'),
      btnReset = $('[data-act="reset"]'), btnClose = $('[data-act="close"]');

  function paintAvatar(el) {
    if (CFG.avatar) el.style.backgroundImage = 'url("' + new URL(CFG.avatar, location.href).href + '")';
    else el.innerHTML = AVATAR;
  }
  Array.prototype.forEach.call(shadow.querySelectorAll('.av'), paintAvatar);

  // ------------------------------------------------------------------ état
  var history = load();
  var busy = false;
  var aborter = null;

  function load() {
    try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; }
  }
  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-30))); } catch (e) {}
  }

  // ------------------------------------------------------------------ rendu
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // mini-markdown : **gras**, *italique*, `code`, [lien](url), URLs, e-mails,
  // listes à puces et listes numérotées (affichées comme des références [1] [2]…)
  function inline(l) {
    return l
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
      .replace(/(^|[\s(])([\w.+-]+@[\w-]+\.[\w.-]*\w)/g, '$1<a href="mailto:$2">$2</a>');
  }
  function md(text) {
    var out = [], list = null, kind = null;
    function close() { if (list) { out.push('<' + kind + '>' + list.join('') + '</' + kind + '>'); list = null; } }
    esc(text).split('\n').forEach(function (line) {
      var l = inline(line);
      var ol = l.match(/^\s*\d+[.)]\s+(.*)/), ul = l.match(/^\s*[-•*]\s+(.*)/);
      var m = ol || ul, k = ol ? 'ol' : 'ul';
      if (m) {
        if (list && kind !== k) close();
        if (!list) { list = []; kind = k; }
        list.push('<li>' + m[1] + '</li>');
        return;
      }
      close();
      if (l.trim()) out.push('<p>' + l + '</p>');
    });
    close();
    return out.join('');
  }

  var qCount = 0;
  function addQuestion(text) {
    qCount++;
    var q = document.createElement('p');
    q.className = 'q';
    // espace insécable avant ? ! : ; (typographie française)
    q.innerHTML = '<span class="n">In [' + qCount + '] ▸ </span>' + esc(text).replace(/ ([?!:;])/g, '\u00a0$1');
    log.appendChild(q);
    scroll();
  }
  function addAnswer(text, opts) {
    var a = document.createElement('div');
    a.className = 'a' + (opts && opts.error ? ' err' : '');
    var av = document.createElement('span');
    av.className = 'av';
    paintAvatar(av);
    var body = document.createElement('div');
    body.innerHTML = text == null ? '<span class="typing">' + esc(t('typing')) + '</span>' : md(text);
    a.appendChild(av); a.appendChild(body);
    log.appendChild(a);
    scroll();
    return body;
  }

  function addChips() {
    var wrap = document.createElement('div');
    wrap.className = 'chips';
    t('suggestions').forEach(function (s) {
      var c = document.createElement('button');
      c.className = 'chip'; c.type = 'button'; c.textContent = '→ ' + s[0];
      c.title = s[1];
      c.onclick = function () { send(s[1]); };
      wrap.appendChild(c);
    });
    log.appendChild(wrap);
  }

  function renderAll() {
    log.innerHTML = '';
    qCount = 0;
    var intro = document.createElement('div');
    intro.className = 'intro';
    var av = document.createElement('span'); av.className = 'av'; paintAvatar(av);
    var p = document.createElement('p'); p.innerHTML = inline(esc(t('welcome')));
    intro.appendChild(av); intro.appendChild(p);
    log.appendChild(intro);
    history.forEach(function (m) { if (m.role === 'user') addQuestion(m.content); else addAnswer(m.content); });
    addChips();
  }

  // textes de l'interface dans la langue courante
  function applyLang() {
    $('.k').textContent = t('kicker');
    $('h2').textContent = t('title');
    $('.tab .lbl').textContent = t('tab');
    tab.setAttribute('aria-label', t('openLabel'));
    drawer.setAttribute('aria-label', t('title'));
    teaser.innerHTML = t('teaser');
    input.placeholder = t('placeholder');
    input.setAttribute('aria-label', t('input'));
    sendBtn.textContent = t('send') + ' ↵';
    btnReset.title = t('reset'); btnReset.setAttribute('aria-label', t('reset'));
    btnClose.title = t('close'); btnClose.setAttribute('aria-label', t('close'));
    $('.legal').textContent = t('legal');
    if (!busy) renderAll();
  }

  function scroll() { log.scrollTop = log.scrollHeight; }

  // ------------------------------------------------------------------ écriture progressive
  // Le texte reçu est révélé à vitesse régulière, avec un curseur qui clignote,
  // que le réseau le livre par petits morceaux ou d'un seul bloc.
  var REDUCE_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function withCursor(html) {
    var c = '<span class="cursor" aria-hidden="true"></span>';
    var i = Math.max(html.lastIndexOf('</p>'), html.lastIndexOf('</li>'));
    return i < 0 ? html + c : html.slice(0, i) + c + html.slice(i);
  }
  function typewriter(el) {
    var target = '', shown = 0, finished = false, raf = null, last = 0, onEnd = null;
    function render(final) {
      var h = md(target.slice(0, shown));
      el.innerHTML = final ? h : withCursor(h);
      scroll();
    }
    function tick(ts) {
      raf = null;
      var dt = last ? Math.min(ts - last, 100) : 16;
      last = ts;
      var backlog = target.length - shown;
      if (backlog > 0) {
        // environ 60 caractères par seconde, plus vite s'il reste beaucoup de texte à afficher
        // (une réponse de 500 caractères s'écrit en 2 secondes environ)
        shown = Math.min(target.length, shown + Math.max(1, Math.round(dt * (0.06 + backlog / 1500))));
        render(false);
      }
      if (shown < target.length || !finished) raf = requestAnimationFrame(tick);
      else { render(true); if (onEnd) onEnd(); }
    }
    function start() { if (!raf) raf = requestAnimationFrame(tick); }
    return {
      push: function (txt) {
        target = txt;
        if (REDUCE_MOTION) { shown = target.length; render(false); } else start();
      },
      end: function () {
        finished = true;
        if (REDUCE_MOTION) { shown = target.length; render(true); return Promise.resolve(); }
        return new Promise(function (resolve) { onEnd = resolve; start(); });
      },
      stop: function () { if (raf) cancelAnimationFrame(raf); raf = null; },
    };
  }

  // ------------------------------------------------------------------ envoi
  async function send(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    busy = true; updateSend();
    var chips = log.querySelector('.chips'); if (chips) chips.remove();

    history.push({ role: 'user', content: text });
    addQuestion(text);
    input.value = ''; autosize();
    var body = addAnswer(null);
    var answer = '';
    var tw = typewriter(body);
    aborter = new AbortController();

    try {
      var res = await fetch(CFG.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: aborter.signal,
      });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        var e1 = new Error(err.error || 'Erreur ' + res.status);
        e1.friendly = res.status === 429 ? err.error : null;
        throw e1;
      }
      var reader = res.body.getReader(), dec = new TextDecoder();
      while (true) {
        var r = await reader.read();
        if (r.done) break;
        answer += dec.decode(r.value, { stream: true });
        tw.push(answer);
      }
      if (!answer.trim()) throw new Error('Réponse vide.');
      await tw.end();
      history.push({ role: 'assistant', content: answer.trim() });
      save();
    } catch (e) {
      tw.stop();
      if (e.name === 'AbortError') { history.pop(); }
      else {
        history.pop(); // on ne garde pas la question sans réponse
        body.parentNode.classList.add('err');
        body.innerHTML = md(e.friendly || t('error') + CFG.email);
        console.warn('[Assistant]', e.message);
      }
    } finally {
      busy = false; aborter = null; updateSend();
      if (!log.querySelector('.chips')) addChips();
      scroll();
      if (root.classList.contains('open')) input.focus();
    }
  }

  // ------------------------------------------------------------------ interactions
  var lastFocus = null;
  function markSeen() {
    root.classList.add('seen');
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
  }
  function open(v) {
    var isOpen = v === undefined ? !root.classList.contains('open') : v;
    if (isOpen && !root.classList.contains('open')) lastFocus = document.activeElement;
    root.classList.toggle('open', isOpen);
    markSeen();
    teaser.classList.remove('show');
    tab.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) setTimeout(function () { input.focus(); scroll(); }, 300);
    else if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }
  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; updateSend(); }
  function updateSend() { sendBtn.disabled = busy || !input.value.trim(); }

  tab.addEventListener('click', function () { open(true); });
  teaser.addEventListener('click', function () { open(true); });
  btnClose.addEventListener('click', function () { open(false); });
  btnReset.addEventListener('click', function () {
    if (aborter) aborter.abort();
    history = []; save(); renderAll(); input.focus();
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
  });
  drawer.addEventListener('keydown', function (e) { if (e.key === 'Escape') open(false); });

  // suit le bouton FR / EN du site
  new MutationObserver(applyLang).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });

  // API minimale : window.ProfileChat.open() / .close() / .ask("…")
  window.ProfileChat = {
    open: function () { open(true); },
    close: function () { open(false); },
    ask: function (q) { open(true); send(q); },
  };

  applyLang();
  var seen = false;
  try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch (e) {}
  if (seen) root.classList.add('seen');
  if (CFG.openOnLoad) open(true);
  else if (!seen) {
    // petite bulle d'invitation, une seule fois par visite, qui se retire d'elle-même
    setTimeout(function () {
      if (root.classList.contains('seen')) return;
      teaser.classList.add('show');
      setTimeout(function () { teaser.classList.remove('show'); }, 12000);
    }, 7000);
  }
})();
