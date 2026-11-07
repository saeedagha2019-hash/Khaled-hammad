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

  /* enquiry form */
  var form = $('[data-enquiry]');
  if (form) {
    var started = Date.now(), hint = $('[data-cat-hint]', form), proj = $('[data-proj]', form), budget = $('[data-budget]', form);
    var type = new URLSearchParams(location.search).get('type');
    function syncCat() {
      var c = $('input[name="category"]:checked', form); hint.textContent = c.dataset.hint;
      proj.hidden = c.value === 'press';
      budget.hidden = !(c.value === 'scoring' || c.value === 'concerts' || c.value === 'licensing');
    }
    if (type) { var r = $('input[name="category"][value="' + type + '"]', form); if (r) r.checked = true; }
    $$('input[name="category"]', form).forEach(function (r) { r.addEventListener('change', syncCat); });
    syncCat();
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var E = T.err, errs = [], d = new FormData(form);
      function check(name, ok, msg) {
        var el = form.elements[name], out = $('[data-err="' + name + '"]', form);
        el.setAttribute('aria-invalid', ok ? 'false' : 'true'); out.textContent = ok ? '' : msg; if (!ok) errs.push(el);
      }
      check('name', (d.get('name') || '').trim().length > 1, E.name);
      check('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((d.get('email') || '').trim()), E.email);
      check('brief', (d.get('brief') || '').trim().length > 9, E.brief);
      check('consent', form.elements.consent.checked, E.consent);
      var sum = $('[data-summary]', form), ok = $('[data-ok]', form);
      if (errs.length) { sum.textContent = E.summary; sum.hidden = false; errs[0].focus(); return; }
      sum.hidden = true;
      if (d.get('website') || Date.now() - started < 2500) { ok.textContent = T.sent; ok.hidden = false; return; } // spam trap
      var catEl = $('input[name="category"]:checked', form), catLabel = catEl.nextElementSibling.textContent, to = (KH.contacts || {})[catEl.value] || KH.contacts.general;
      var lines = [catLabel, '', 'Name: ' + d.get('name'), 'Organisation: ' + (d.get('organisation') || '—'), 'Email: ' + d.get('email')];
      if (!proj.hidden) lines.push('Project dates: ' + (d.get('dates') || '—'));
      if (!budget.hidden) lines.push('Budget band: ' + form.elements.budget.options[form.elements.budget.selectedIndex].text);
      lines.push('', d.get('brief'), '', 'Language: ' + KH.lang);
      if (KH.endpoint) {
        var payload = {}; d.forEach(function (v, k) { if (k !== 'website') payload[k] = v; }); payload.category_label = catLabel; payload.language = KH.lang; payload._subject = '[' + catLabel + '] ' + d.get('name');
        fetch(KH.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
          .then(function (r) { if (!r.ok) throw r; ok.textContent = T.sent; ok.hidden = false; form.reset(); syncCat(); ok.focus && ok.setAttribute('tabindex', '-1'); ok.focus(); })
          .catch(function () { mailto(); });
      } else mailto();
      function mailto() {
        location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('[' + catLabel + '] ' + d.get('name')) + '&body=' + encodeURIComponent(lines.join('\n'));
        ok.textContent = T.sent_mailto.replace('{e}', to); ok.hidden = false;
      }
    });
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
