/* Khaled Hammad — progressive enhancement. Everything works without JS except filtering, players and search. */
(function () {
  'use strict';
  var KH = window.KH || { t: {} }, T = KH.t, doc = document, root = doc.documentElement;
  root.classList.add('js');
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* header + mobile nav */
  var header = $('[data-header]'), toggle = $('.nav-toggle'), nav = $('#site-nav');
  function onScroll() { if (header) header.classList.toggle('is-solid', window.scrollY > 40); }
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  function setNav(open) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? toggle.dataset.close : toggle.dataset.open);
    nav.classList.toggle('is-open', open); doc.body.classList.toggle('nav-open', open);
    if (header) header.classList.toggle('is-solid', open || window.scrollY > 40);
    if (open) setTimeout(function () { var f = $('a', nav); if (f) f.focus(); }, 280);
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () { setNav(toggle.getAttribute('aria-expanded') !== 'true'); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setNav(false); toggle.focus(); } });
  }

  /* gentle reveals */
  var rev = $$('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    rev.forEach(function (el) { io.observe(el); });
  } else rev.forEach(function (el) { el.classList.add('is-in'); });

  /* audio players — never autoplay; one at a time */
  var players = $$('[data-player]');
  function fmt(s) { if (!isFinite(s)) return '–:––'; s = Math.round(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  players.forEach(function (p) {
    var a = $('audio', p), btn = $('.pl-btn', p), seek = $('.pl-seek', p), cur = $('[data-cur]', p), dur = $('[data-dur]', p), vol = $('[data-vol]', p);
    var seeking = false;
    function ui() {
      var on = !a.paused; p.classList.toggle('is-playing', on);
      btn.setAttribute('aria-label', on ? btn.dataset.labelPause : btn.dataset.labelPlay);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    btn.addEventListener('click', function () {
      if (a.paused) { players.forEach(function (o) { var oa = $('audio', o); if (oa !== a && !oa.paused) oa.pause(); }); a.play().catch(function () {}); }
      else a.pause();
    });
    a.addEventListener('play', ui); a.addEventListener('pause', ui); a.addEventListener('ended', function () { a.currentTime = 0; ui(); });
    a.addEventListener('loadedmetadata', function () { seek.max = Math.floor(a.duration); dur.textContent = fmt(a.duration); });
    a.addEventListener('timeupdate', function () { if (!seeking) seek.value = Math.floor(a.currentTime); cur.textContent = fmt(a.currentTime); seek.setAttribute('aria-valuetext', fmt(a.currentTime) + ' / ' + dur.textContent); });
    seek.addEventListener('input', function () { seeking = true; cur.textContent = fmt(+seek.value); });
    seek.addEventListener('change', function () { if (a.readyState === 0) a.load(); a.currentTime = +seek.value; seeking = false; });
    if (vol) { a.volume = +vol.value; vol.addEventListener('input', function () { a.volume = +vol.value; }); }
  });

  /* privacy-friendly video facades */
  $$('[data-yt]').forEach(function (fig) {
    var b = $('.video-play', fig);
    if (!b) return;
    b.addEventListener('click', function () {
      var f = doc.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(fig.dataset.yt) + '?autoplay=1&rel=0&hl=' + KH.lang + '&cc_lang_pref=' + KH.lang;
      f.title = fig.dataset.title; f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true;
      players.forEach(function (o) { $('audio', o).pause(); });
      $('.video-frame', fig).innerHTML = ''; $('.video-frame', fig).appendChild(f); f.focus();
    });
  });

  /* works filters */
  var filt = $('[data-filters]');
  if (filt) {
    var list = $('[data-list]'), rows = $$('.work-row', list), q = $('[data-q]', filt), dec = $('[data-decade]', filt), sortB = $('[data-sort]', filt),
      count = $('[data-count]', filt), empty = $('[data-empty]'), cat = 'all', asc = false;
    var params = new URLSearchParams(location.search);
    if (params.get('cat')) cat = params.get('cat');
    if (params.get('decade')) dec.value = params.get('decade');
    if (params.get('q')) q.value = params.get('q');
    function run(push) {
      var term = q.value.trim().toLowerCase(), d = dec.value, n = 0;
      $$('[data-cat]', filt).forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.cat === cat ? 'true' : 'false'); });
      rows.forEach(function (r) {
        var y = +r.dataset.year, ok = (cat === 'all' || r.dataset.cat === cat) && (!d || (y >= +d && y < +d + 10)) && (!term || r.dataset.text.indexOf(term) > -1);
        r.hidden = !ok; if (ok) n++;
      });
      count.textContent = (n === 1 ? T.results_one : T.results_many).replace('{n}', n);
      empty.hidden = n > 0;
      if (push) {
        var p = new URLSearchParams(); if (cat !== 'all') p.set('cat', cat); if (d) p.set('decade', d); if (term) p.set('q', term);
        history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
      }
    }
    $$('[data-cat]', filt).forEach(function (c) { c.addEventListener('click', function () { cat = c.dataset.cat; run(true); }); });
    q.addEventListener('input', function () { run(true); }); dec.addEventListener('change', function () { run(true); });
    sortB.addEventListener('click', function () {
      asc = !asc;
      rows.sort(function (a, b) { var ya = +a.dataset.year || 9999, yb = +b.dataset.year || 9999; return asc ? ya - yb : yb - ya; }).forEach(function (r) { list.appendChild(r); });
      sortB.textContent = asc ? sortB.dataset.lOld : sortB.dataset.lNew;
    });
    run(false);
  }

  /* press filter */
  var pf = $('[data-press-filter]');
  if (pf) {
    var items = $$('[data-press-list] .press-item');
    $$('[data-ptype]', pf).forEach(function (c) {
      c.addEventListener('click', function () {
        var k = c.dataset.ptype;
        $$('[data-ptype]', pf).forEach(function (o) { o.setAttribute('aria-pressed', o === c ? 'true' : 'false'); });
        items.forEach(function (i) { i.hidden = !(k === 'all' || i.dataset.type === k); });
      });
    });
  }

  /* lightbox */
  var lb = $('[data-lightbox]');
  if (lb && lb.showModal) {
    var gi = $$('.g-item[data-full]'), idx = 0, lim = $('img', lb), opener = null;
    function show(i) { idx = (i + gi.length) % gi.length; var s = $('img', gi[idx]); lim.src = gi[idx].dataset.full; lim.alt = s.alt; }
    gi.forEach(function (b, i) { b.addEventListener('click', function () { opener = b; show(i); lb.showModal(); }); });
    lb.addEventListener('click', function (e) {
      var a = e.target.closest('[data-lb]');
      if (e.target === lb || (a && a.dataset.lb === 'close')) lb.close();
      else if (a) show(idx + (a.dataset.lb === 'next' ? 1 : -1) * (root.dir === 'rtl' ? -1 : 1));
    });
    lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') show(idx + (root.dir === 'rtl' ? -1 : 1)); if (e.key === 'ArrowLeft') show(idx - (root.dir === 'rtl' ? -1 : 1)); });
    lb.addEventListener('close', function () { if (opener) opener.focus(); });
  }

  /* copy buttons (press kit) */
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var el = $(b.dataset.copy); if (!el) return;
      var txt = el.innerText.trim();
      var done = function () { b.textContent = T.copied; setTimeout(function () { b.textContent = T.copy_text; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, function () {}); else { var r = doc.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); }
    });
  });

  /* enquiry forms — one per enquiry type */
  var form = $('[data-enquiry]');
  if (form) {
    var started = Date.now();
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var E = T.err, errs = [], d = new FormData(form);
      function check(name, ok, msg) {
        var el = form.elements[name], o = $('[data-err="' + name + '"]', form);
        if (!el || !o) return;
        el.setAttribute('aria-invalid', ok ? 'false' : 'true'); o.textContent = ok ? '' : msg; if (!ok) errs.push(el);
      }
      check('name', (d.get('name') || '').trim().length > 1, E.name);
      check('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((d.get('email') || '').trim()), E.email);
      check('brief', (d.get('brief') || '').trim().length > 9, E.brief);
      check('consent', form.elements.consent.checked, E.consent);
      var sum = $('[data-summary]', form), ok = $('[data-ok]', form);
      if (errs.length) { sum.textContent = E.summary; sum.hidden = false; errs[0].focus(); return; }
      sum.hidden = true;
      function done(msg) { ok.textContent = msg; ok.hidden = false; ok.focus(); }
      if (d.get('website') || Date.now() - started < 2500) { done(T.sent); return; } // spam trap
      var label = form.dataset.label, to = form.dataset.to, endpoint = form.dataset.endpoint || KH.endpoint, lines = [label, ''], payload = {};
      $$('input, select, textarea', form).forEach(function (el) {
        if (!el.name || el.name === 'website' || el.name === 'consent') return;
        var v = el.type === 'checkbox' ? (el.checked ? '✓' : '') : el.value.trim();
        if (!v) return;
        var lab = form.querySelector('label[for="' + el.id + '"]');
        var name = lab ? lab.textContent.replace(/\*.*$/, '').replace(/\s*\(.*\)\s*$/, '').trim() : el.name;
        payload[el.name] = v;
        if (el.name !== 'brief') lines.push(name + ': ' + v);
      });
      lines.push('', d.get('brief'), '', 'Language: ' + KH.lang);
      payload.enquiry_type = form.dataset.kind; payload.language = KH.lang; payload._subject = '[' + label + '] ' + d.get('name');
      function mailto() { location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(payload._subject) + '&body=' + encodeURIComponent(lines.join('\n')); done(T.sent_mailto.replace('{e}', to)); }
      if (!endpoint) { mailto(); return; }
      var btn = $('button[type="submit"]', form); btn.disabled = true;
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { if (!r.ok) throw r; form.reset(); done(T.sent); })
        .catch(mailto)
        .then(function () { btn.disabled = false; });
    });
  }

  /* about-page gallery filter */
  var gf = $('[data-gallery-filter]');
  if (gf) {
    var gl = $$('[data-gallery] > li');
    $$('[data-gcat]', gf).forEach(function (c) {
      c.addEventListener('click', function () {
        var k = c.dataset.gcat;
        $$('[data-gcat]', gf).forEach(function (o) { o.setAttribute('aria-pressed', o === c ? 'true' : 'false'); });
        gl.forEach(function (li) { li.hidden = !(k === 'all' || li.dataset.gcat === k); });
      });
    });
  }

  /* analytics — loaded only after explicit consent; nothing runs when no provider is configured */
  var A = KH.analytics || {}, cb = $('[data-consent]');
  function store(v) { try { localStorage.setItem('kh-consent', v); } catch (e) {} }
  function stored() { try { return localStorage.getItem('kh-consent'); } catch (e) { return null; } }
  function loadAnalytics() {
    if (!A.id || window.__khA) return; window.__khA = 1;
    var s = doc.createElement('script'); s.async = true;
    if (A.provider === 'plausible') { s.src = 'https://plausible.io/js/script.js'; s.setAttribute('data-domain', A.id); }
    else {
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(A.id); window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); }; window.gtag('js', new Date()); window.gtag('config', A.id, { anonymize_ip: true });
    }
    doc.head.appendChild(s);
  }
  if (A.id && cb) {
    var c0 = stored();
    if (c0 === 'yes') loadAnalytics(); else if (c0 !== 'no') cb.hidden = false;
    $('[data-consent-yes]', cb).addEventListener('click', function () { store('yes'); cb.hidden = true; loadAnalytics(); });
    $('[data-consent-no]', cb).addEventListener('click', function () { store('no'); cb.hidden = true; });
    $$('[data-consent-open]').forEach(function (b) { b.addEventListener('click', function () { cb.hidden = false; $('[data-consent-yes]', cb).focus(); }); });
  }

  /* site search */
  var sb = $('[data-search]');
  if (sb) {
    var inp = $('[data-search-input]', sb), res = $('[data-search-results]', sb), cnt = $('[data-search-count]', sb), idxData = null;
    fetch(sb.dataset.index).then(function (r) { return r.json(); }).then(function (j) { idxData = j; go(); });
    var qs = new URLSearchParams(location.search).get('q'); if (qs) inp.value = qs;
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function go() {
      if (!idxData) return;
      var terms = inp.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.length) { res.innerHTML = ''; cnt.textContent = ''; return; }
      var hits = idxData.filter(function (it) { return terms.every(function (t) { return it.k.indexOf(t) > -1 || it.t.toLowerCase().indexOf(t) > -1; }); }).slice(0, 60);
      cnt.textContent = hits.length ? '' + hits.length : T.search_none;
      res.innerHTML = hits.map(function (h) { return '<li><a href="' + esc(h.u) + '"' + (h.x ? ' target="_blank" rel="noopener"' : '') + '><span class="sr-t">' + esc(h.t) + '</span><span class="sr-s">' + esc(h.s) + '</span></a></li>'; }).join('');
    }
    inp.addEventListener('input', go);
  }
})();
