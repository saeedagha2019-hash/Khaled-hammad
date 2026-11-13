/* Khaled Hammad — v2 interactions: quiet motion, players (never autoplay), filters, carousels, lightbox, forms. */
(function () {
  'use strict';
  var KH = window.KH || { t: {} }, T = KH.t || {}, doc = document, root = doc.documentElement;
  root.classList.add('js');
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rtl = root.dir === 'rtl';
  var on = function (el, ev, fn, o) { if (el) el.addEventListener(ev, fn, o); };

  /* header */
  var hd = $('[data-header]');
  function sc() { if (hd) hd.classList.toggle('is-scrolled', scrollY > 10); }
  sc(); on(window, 'scroll', sc, { passive: true });
  var burger = $('.burger');
  on(burger, 'click', function () {
    var open = !doc.body.classList.contains('nav-open');
    doc.body.classList.toggle('nav-open', open); burger.setAttribute('aria-expanded', open);
  });
  on(doc, 'keydown', function (e) { if (e.key === 'Escape' && doc.body.classList.contains('nav-open')) { doc.body.classList.remove('nav-open'); burger.setAttribute('aria-expanded', 'false'); burger.focus(); } });

  /* split headlines into words for the rise-in */
  $$('.split-l').forEach(function (h) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = doc.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(doc.createTextNode(w)); return; }
            var o = doc.createElement('span'), inner = doc.createElement('span'); o.className = 'w';
            inner.textContent = w; o.appendChild(inner); o.style.setProperty('--i', i++); frag.appendChild(o);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') { walk(n); }
      });
    })(h);
    if (!h.classList.contains('rv')) h.classList.add('rvx');
  });

  /* staggered children */
  $$('[data-stagger]').forEach(function (p) {
    var step = parseFloat(p.dataset.stagger) || .08;
    Array.prototype.slice.call(p.children).forEach(function (c, i) { if (!c.classList.contains('rv') && !c.classList.contains('rv-img')) c.classList.add('rv'); c.style.setProperty('--d', (i * step).toFixed(2) + 's'); });
  });

  /* reveal on scroll */
  var rv = $$('.rv, .rv-fade, .rv-img, .split-l');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: .01 });
    rv.forEach(function (el) { io.observe(el); });
  } else rv.forEach(function (el) { el.classList.add('is-in'); });
  function reveal(el) { $$('.rv, .rv-fade, .rv-img', el).forEach(function (x) { x.classList.add('is-in'); }); }

  /* count-up */
  var counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduce) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return; co.unobserve(en.target);
        var el = en.target, to = parseInt(el.dataset.count, 10), t0 = null;
        if (!isFinite(to)) return;
        (function step(ts) { if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / 1400), e = 1 - Math.pow(1 - p, 3); el.firstChild.nodeValue = Math.round(to * e); if (p < 1) requestAnimationFrame(step); })(performance.now());
        requestAnimationFrame(function s2(ts) { });
      });
    }, { threshold: .4 });
    counters.forEach(function (c) { if (c.firstChild && c.firstChild.nodeType === 3) { c.firstChild.nodeValue = '0'; co.observe(c); } });
  }

  /* dropdowns */
  $$('[data-dd]').forEach(function (dd) {
    var b = $('button', dd);
    on(b, 'click', function (e) { e.stopPropagation(); var o = !dd.classList.contains('open'); $$('[data-dd].open').forEach(function (x) { x.classList.remove('open'); }); dd.classList.toggle('open', o); b.setAttribute('aria-expanded', o); });
  });
  on(doc, 'click', function (e) { $$('[data-dd].open').forEach(function (x) { if (!x.contains(e.target)) { x.classList.remove('open'); $('button', x).setAttribute('aria-expanded', 'false'); } }); });

  /* ---------- coverflow ---------- */
  $$('[data-cf]').forEach(function (cf) {
    var items = $$('.cf-item', cf), n = items.length, cur = Math.floor(n / 2), dots = $('.cf-dots', cf.parentNode), timer;
    if (!n) return;
    if (dots) dots.innerHTML = items.map(function () { return '<i></i>'; }).join('');
    function lay() {
      var w = cf.clientWidth, sp = Math.min(w * .19, 230) * (rtl ? -1 : 1);
      items.forEach(function (it, i) {
        var d = i - cur; if (d > n / 2) d -= n; if (d < -n / 2) d += n;
        var a = Math.abs(d), x = d * sp, z = -a * 160, ry = -Math.sign(d) * Math.min(a, 2) * 18 * (rtl ? -1 : 1), s = a === 0 ? 1.08 : 1;
        it.style.transform = 'translate(-50%,-50%) translate3d(' + x + 'px,0,' + z + 'px) rotateY(' + ry + 'deg) scale(' + s + ')';
        it.style.zIndex = 20 - a; it.style.opacity = a > 2 ? 0 : (a === 2 ? .55 : 1); it.style.filter = a ? 'brightness(' + (1 - a * .22) + ')' : 'none';
        it.classList.toggle('is-c', a === 0); it.setAttribute('aria-hidden', a > 2 ? 'true' : 'false');
        var l = $('a', it); if (l) l.tabIndex = a === 0 ? 0 : -1;
      });
      if (dots) $$('i', dots).forEach(function (d, i) { d.classList.toggle('on', i === cur); });
    }
    function go(k) { cur = (k + n) % n; lay(); }
    items.forEach(function (it, i) { on(it, 'click', function (e) { if (i !== cur) { e.preventDefault(); go(i); } }); });
    $$('[data-cf-step]', cf.parentNode).forEach(function (b) { on(b, 'click', function () { go(cur + +b.dataset.cfStep); }); });
    on(cf, 'keydown', function (e) { if (e.key === 'ArrowRight') go(cur + (rtl ? -1 : 1)); if (e.key === 'ArrowLeft') go(cur - (rtl ? -1 : 1)); });
    var x0 = null;
    on(cf, 'pointerdown', function (e) { x0 = e.clientX; });
    on(cf, 'pointerup', function (e) { if (x0 === null) return; var dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1) * (rtl ? -1 : 1)); });
    on(window, 'resize', lay);
    function auto() { clearInterval(timer); if (!reduce) timer = setInterval(function () { go(cur + 1); }, 5200); }
    on(cf, 'mouseenter', function () { clearInterval(timer); }); on(cf, 'mouseleave', auto); on(cf, 'focusin', function () { clearInterval(timer); });
    lay(); auto();
  });

  /* ---------- crossfade slides ---------- */
  $$('[data-slides]').forEach(function (s) {
    var im = $$('img', s.querySelector('.sl') || s), n = im.length, cur = 0, t, box = s, ix = $('[data-ix]', box), dots = $('.cf-dots', box), cap = $('[data-cap]', box);
    if (n < 2) { if (im[0]) im[0].classList.add('on'); return; }
    if (dots) dots.innerHTML = im.map(function () { return '<i></i>'; }).join('');
    function show(k) {
      cur = (k + n) % n; im.forEach(function (x, i) { x.classList.toggle('on', i === cur); });
      if (ix) ix.textContent = ('0' + (cur + 1)).slice(-2);
      if (dots) $$('i', dots).forEach(function (d, i) { d.classList.toggle('on', i === cur); });
      if (cap) cap.textContent = im[cur].dataset.cap || '';
    }
    $$('[data-sl-step]', box).forEach(function (b) { on(b, 'click', function () { show(cur + +b.dataset.slStep); start(); }); });
    function start() { clearInterval(t); if (!reduce) t = setInterval(function () { show(cur + 1); }, 5600); }
    show(0); start();
  });

  /* ---------- audio decks (one shared <audio> per deck, never autoplay) ---------- */
  var allAudio = [];
  function fmt(s) { if (!isFinite(s) || s < 0) return '0:00'; s = Math.round(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  $$('[data-deck]').forEach(function (deck) {
    var a = new Audio(); a.preload = 'none'; allAudio.push(a);
    var tracks = $$('[data-track]', deck), bar = $('[data-pbar]', deck), idx = -1;
    var pp = bar && $('.pp', bar), seek = bar && $('.seek', bar), fill = seek && $('i', seek), cur = bar && $('[data-cur]', bar), dur = bar && $('[data-dur]', bar), vol = bar && $('[data-vol]', bar), volv = bar && $('[data-volv]', bar);
    var title = $$('[data-now-title]', deck), sub = $$('[data-now-sub]', deck), img = $$('[data-now-img]', deck), num = $('[data-now-n]', deck);
    function ui() {
      var playing = !a.paused;
      deck.classList.toggle('is-playing', playing);
      tracks.forEach(function (t, i) { t.classList.toggle('on', i === idx); t.classList.toggle('playing', i === idx && playing); var b = t.matches('button') ? t : $('button', t); if (b) b.setAttribute('aria-pressed', i === idx && playing ? 'true' : 'false'); });
      if (pp) pp.setAttribute('aria-label', playing ? (T.pause || 'Pause') : (T.play || 'Play'));
    }
    function load(i) {
      idx = (i + tracks.length) % tracks.length; var d = tracks[idx].dataset;
      a.src = d.src; a.load();
      title.forEach(function (x) { x.textContent = d.title; }); sub.forEach(function (x) { x.textContent = d.sub || ''; });
      img.forEach(function (x) { if (d.img) { x.src = d.img; x.alt = ''; } });
      if (num) num.textContent = ('0' + (idx + 1)).slice(-2) + ' / ' + ('0' + tracks.length).slice(-2);
      if (fill) fill.style.width = '0'; if (cur) cur.textContent = '0:00';
    }
    function play() { allAudio.forEach(function (o) { if (o !== a) o.pause(); }); $$('iframe[data-ytf]').forEach(function () { }); a.play().catch(function () { }); }
    function toggle(i) {
      if (i === undefined) i = idx < 0 ? 0 : idx;
      if (i !== idx) { load(i); play(); } else if (a.paused) play(); else a.pause();
    }
    tracks.forEach(function (t, i) { var b = t.matches('button') ? t : ($('button', t) || t); on(b, 'click', function (e) { e.preventDefault(); toggle(i); }); });
    $$('[data-deck-play]', deck).forEach(function (b) { on(b, 'click', function () { toggle(); }); });
    on(pp, 'click', function () { toggle(); });
    $$('[data-step]', deck).forEach(function (b) { on(b, 'click', function () { if (!tracks.length) return; load(idx + +b.dataset.step); play(); }); });
    $$('[data-skip]', deck).forEach(function (b) { on(b, 'click', function () { if (isFinite(a.duration)) a.currentTime = Math.max(0, Math.min(a.duration, a.currentTime + +b.dataset.skip)); }); });
    a.addEventListener('play', ui); a.addEventListener('pause', ui);
    a.addEventListener('ended', function () { if (tracks.length > 1 && deck.hasAttribute('data-continue')) { load(idx + 1); play(); } else ui(); });
    a.addEventListener('loadedmetadata', function () { if (dur) dur.textContent = fmt(a.duration); });
    a.addEventListener('timeupdate', function () { if (cur) cur.textContent = fmt(a.currentTime); if (fill && a.duration) fill.style.width = (a.currentTime / a.duration * 100) + '%'; if (seek) seek.setAttribute('aria-valuenow', Math.round(a.currentTime)); });
    if (seek) {
      function seekTo(e) { var r = seek.getBoundingClientRect(), p = (e.clientX - r.left) / r.width; if (rtl) p = 1 - p; if (idx < 0) { load(0); } if (isFinite(a.duration)) a.currentTime = Math.max(0, Math.min(1, p)) * a.duration; }
      on(seek, 'click', seekTo);
      on(seek, 'keydown', function (e) { if (!isFinite(a.duration)) return; if (e.key === 'ArrowRight') a.currentTime += 5 * (rtl ? -1 : 1); if (e.key === 'ArrowLeft') a.currentTime -= 5 * (rtl ? -1 : 1); });
    }
    if (vol) { a.volume = +vol.value; on(vol, 'input', function () { a.volume = +vol.value; if (volv) volv.textContent = Math.round(a.volume * 100) + '%'; }); }
    $$('[data-mute]', deck).forEach(function (b) { on(b, 'click', function () { a.muted = !a.muted; b.setAttribute('aria-pressed', a.muted); }); });
    if (tracks.length && !deck.hasAttribute('data-lazy')) { var d0 = tracks[0].dataset; title.forEach(function (x) { if (!x.textContent) x.textContent = d0.title; }); }
  });

  /* ---------- video facades (YouTube loads only after a click) ---------- */
  $$('[data-yt]').forEach(function (v) {
    var b = $('[data-yt-play]', v) || v;
    on(b, 'click', function (e) {
      e.preventDefault();
      var fr = $('.fr', v) || v, f = doc.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.dataset.yt) + '?autoplay=1&rel=0&hl=' + KH.lang;
      f.title = v.dataset.title || ''; f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true; f.setAttribute('data-ytf', '');
      allAudio.forEach(function (a) { a.pause(); });
      fr.appendChild(f); f.focus();
    });
  });

  /* ---------- tabs (Listen & Watch) ---------- */
  $$('[data-tabbed]').forEach(function (box) {
    var btns = $$('[data-tab]', box.parentNode);
    function set(k, push) {
      box.dataset.tabbed = k;
      btns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.tab === k ? 'true' : 'false'); });
      $$('[data-tab-label]', box).forEach(function (el) { el.textContent = el.dataset['label' + k.charAt(0).toUpperCase() + k.slice(1)] || el.dataset.labelAll; });
      reveal(box);
      if (push) { var p = new URLSearchParams(location.search); if (k === 'all') p.delete('tab'); else p.set('tab', k); history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash); }
    }
    btns.forEach(function (b) { on(b, 'click', function () { set(b.dataset.tab, true); }); });
    var q = new URLSearchParams(location.search).get('tab'); set(['listen', 'watch'].indexOf(q) > -1 ? q : 'all', false);
  });

  /* ---------- generic filter lists ---------- */
  function lister(box) {
    var items = $$('[data-item]', box), page = +box.dataset.page || 0, shown = page, more = $('[data-more]', box), count = $$('[data-count-out]', box), empty = $('[data-empty]', box);
    var st = { cat: 'all', y: '', d: '', q: '' }, catBtns = $$('[data-f-cat]', box), qIn = $('[data-f-q]', box);
    var yBtns = $$('[data-f-y]', box), dBtns = $$('[data-f-d]', box), yLbl = $$('[data-y-label]', box), dLbl = $$('[data-d-label]', box), groups = $$('[data-group]', box);
    function match(it) {
      var d = it.dataset, y = +d.y || 0;
      if (st.cat !== 'all' && (' ' + d.cat + ' ').indexOf(' ' + st.cat + ' ') < 0) return false;
      if (st.y && String(y) !== st.y) return false;
      if (st.d && !(y >= +st.d && y < +st.d + 10)) return false;
      if (st.q && (d.k || it.textContent).toLowerCase().indexOf(st.q) < 0) return false;
      return true;
    }
    function run(reset) {
      if (reset) shown = page;
      var ok = items.filter(match), n = 0;
      items.forEach(function (it) { it.hidden = true; });
      ok.forEach(function (it) { n++; if (!page || n <= shown) { it.hidden = false; } });
      groups.forEach(function (g) { var vis = $$('[data-item]', g).some(function (it) { return !it.hidden; }); g.hidden = !vis; var c = $('[data-g-count]', g); if (c) c.textContent = $$('[data-item]', g).filter(match).length; });
      count.forEach(function (c) { var tpl = c.dataset.tpl || '{n}'; c.textContent = tpl.replace('{a}', page ? Math.min(shown, ok.length) : ok.length).replace('{n}', ok.length); });
      if (more) more.hidden = !page || shown >= ok.length;
      if (empty) empty.hidden = ok.length > 0;
      catBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.fCat === st.cat ? 'true' : 'false');
        var sm = $('small', b); if (sm) { var c0 = st.cat; st.cat = b.dataset.fCat; sm.textContent = items.filter(match).length; st.cat = c0; }
      });
      yBtns.forEach(function (b) { b.classList.toggle('on', b.dataset.fY === st.y); });
      dBtns.forEach(function (b) { b.classList.toggle('on', b.dataset.fD === st.d); });
      yLbl.forEach(function (l) { l.textContent = st.y || l.dataset.all; }); dLbl.forEach(function (l) { l.textContent = st.d ? (l.dataset.fmt || '{d}s').replace('{d}', st.d).replace('{e}', +st.d + 9) : l.dataset.all; });
      $$('[data-y-of-d]', box).forEach(function (b) { b.hidden = !!st.d && !(+b.dataset.fY >= +st.d && +b.dataset.fY < +st.d + 10); });
      reveal(box);
    }
    catBtns.forEach(function (b) { on(b, 'click', function () { st.cat = b.dataset.fCat; run(true); }); });
    yBtns.forEach(function (b) { on(b, 'click', function () { st.y = b.dataset.fY; var dd = b.closest('[data-dd]'); if (dd) dd.classList.remove('open'); run(true); }); });
    dBtns.forEach(function (b) { on(b, 'click', function () { st.d = b.dataset.fD; if (st.y && st.d && !(+st.y >= +st.d && +st.y < +st.d + 10)) st.y = ''; var dd = b.closest('[data-dd]'); if (dd) dd.classList.remove('open'); run(true); }); });
    on(qIn, 'input', function () { st.q = qIn.value.trim().toLowerCase(); run(true); });
    on(more, 'click', function () { shown += page; run(false); });
    $$('[data-f-clear]', box).forEach(function (b) { on(b, 'click', function () { st = { cat: 'all', y: '', d: '', q: '' }; if (qIn) qIn.value = ''; run(true); }); });
    var p = new URLSearchParams(location.search);
    if (p.get('cat')) st.cat = p.get('cat'); if (p.get('y')) st.y = p.get('y'); if (p.get('decade')) st.d = p.get('decade'); if (p.get('q') && qIn) { qIn.value = p.get('q'); st.q = p.get('q').toLowerCase(); }
    run(true);
    return { st: st, run: run };
  }
  $$('[data-list]').forEach(lister);

  /* works view toggle */
  $$('[data-views]').forEach(function (box) {
    var btns = $$('[data-view]', box);
    function set(k) { box.dataset.views = k; btns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === k ? 'true' : 'false'); }); $$('[data-view-pane]', box).forEach(function (p) { p.hidden = p.dataset.viewPane !== k; }); reveal(box); window.dispatchEvent(new Event('resize')); }
    btns.forEach(function (b) { on(b, 'click', function () { set(b.dataset.view); }); });
    set(new URLSearchParams(location.search).get('view') === 'carousel' ? 'carousel' : 'grid');
  });

  /* awards: group tabs + show all */
  $$('[data-aw]').forEach(function (box) {
    var list = $('.aw-list', box), lis = $$('li', list), btns = $$('[data-aw-g]', box), all = $('[data-aw-all]', box), lim = +box.dataset.aw || 6, g = 'all', open = false;
    function run() {
      var n = 0;
      lis.forEach(function (li) { var ok = g === 'all' || li.dataset.g === g; li.hidden = !ok; if (ok) { n++; li.classList.toggle('more', n > lim); } });
      list.classList.toggle('all', open);
      btns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.awG === g ? 'true' : 'false'); });
      if (all) { all.hidden = n <= lim; all.setAttribute('aria-expanded', open); var s = $('span', all); if (s) s.textContent = open ? all.dataset.less : all.dataset.more; }
    }
    btns.forEach(function (b) { on(b, 'click', function () { g = b.dataset.awG; run(); }); });
    on(all, 'click', function () { open = !open; run(); });
    run();
  });

  /* gallery rail */
  $$('[data-rail]').forEach(function (box) {
    var rail = $('.rail', box), figs = $$('figure', rail), btns = $$('[data-g-cat]', box), prog = $('.rail-prog i', box), ix = $('[data-rail-ix]', box), tot = $('[data-rail-tot]', box);
    function vis() { return figs.filter(function (f) { return !f.hidden; }); }
    function upd() {
      var m = rail.scrollWidth - rail.clientWidth, p = m > 0 ? Math.abs(rail.scrollLeft) / m : 1;
      if (prog) prog.style.width = Math.max(8, p * 100) + '%';
      var v = vis(), k = 0, r0 = rail.getBoundingClientRect();
      v.forEach(function (f, i) { var r = f.getBoundingClientRect(); if ((rtl ? r0.right - r.right : r.left - r0.left) < 40) k = i; });
      if (ix) ix.textContent = ('0' + (k + 1)).slice(-2); if (tot) tot.textContent = ('0' + v.length).slice(-2);
    }
    btns.forEach(function (b) {
      on(b, 'click', function () {
        var c = b.dataset.gCat; btns.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        figs.forEach(function (f) { f.hidden = !(c === 'all' || (' ' + f.dataset.cats + ' ').indexOf(' ' + c + ' ') > -1); });
        rail.scrollLeft = 0; upd();
      });
    });
    $$('[data-rail-step]', box).forEach(function (b) { on(b, 'click', function () { rail.scrollBy({ left: (+b.dataset.railStep) * rail.clientWidth * .7 * (rtl ? -1 : 1), behavior: 'smooth' }); }); });
    on(rail, 'scroll', upd, { passive: true }); on(window, 'resize', upd);
    var down = false, sx = 0, sl = 0, moved = false;
    on(rail, 'pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = rail.scrollLeft; rail.style.scrollSnapType = 'none'; });
    on(window, 'pointermove', function (e) { if (!down) return; var dx = e.clientX - sx; if (Math.abs(dx) > 5) moved = true; rail.scrollLeft = sl - dx; });
    on(window, 'pointerup', function () { if (!down) return; down = false; rail.style.scrollSnapType = ''; });
    on(rail, 'click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    upd();
  });

  /* ---------- lightbox ---------- */
  var lbx = $('[data-lbx]');
  if (lbx) {
    var items = $$('[data-lb]'), cur = 0, opener = null, img = $('[data-lbx-img]', lbx), ttl = $('[data-lbx-title]', lbx), tg = $('[data-lbx-tag]', lbx), ixx = $('[data-lbx-ix]', lbx), cat = $('[data-lbx-cat]', lbx), th = $('[data-lbx-thumbs]', lbx);
    th.innerHTML = items.map(function (b, i) { return '<button type="button" data-i="' + i + '"><img src="' + b.dataset.thumb + '" alt="" loading="lazy"></button>'; }).join('');
    var tb = $$('button', th);
    function show(i) {
      var vis = items.filter(function (b) { return !b.closest('[hidden]'); }); if (!vis.length) vis = items;
      cur = (i + items.length) % items.length; var b = items[cur], d = b.dataset;
      img.style.opacity = 0; setTimeout(function () { img.src = d.full; img.alt = d.title; img.onload = function () { img.style.opacity = 1; }; }, 120);
      ttl.textContent = d.title; tg.textContent = d.tag; cat.textContent = d.tags; ixx.textContent = ('0' + (cur + 1)).slice(-2);
      tb.forEach(function (t, k) { t.classList.toggle('on', k === cur); }); tb[cur].scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    function open(i) { opener = items[i]; show(i); lbx.hidden = false; requestAnimationFrame(function () { lbx.classList.add('open'); }); doc.body.style.overflow = 'hidden'; $('[data-lbx-close]', lbx).focus(); }
    function close() { lbx.classList.remove('open'); doc.body.style.overflow = ''; setTimeout(function () { lbx.hidden = true; }, 450); if (opener) opener.focus(); }
    items.forEach(function (b, i) { on(b, 'click', function () { open(i); }); });
    tb.forEach(function (b, i) { on(b, 'click', function () { show(i); }); });
    $$('[data-lbx-step]', lbx).forEach(function (b) { on(b, 'click', function () { show(cur + +b.dataset.lbxStep * (rtl ? -1 : 1)); }); });
    on($('[data-lbx-close]', lbx), 'click', close);
    on($('[data-lbx-full]', lbx), 'click', function () { if (lbx.requestFullscreen) { if (doc.fullscreenElement) doc.exitFullscreen(); else lbx.requestFullscreen(); } });
    on($('[data-lbx-share]', lbx), 'click', function () { var u = location.href.split('#')[0] + '#gallery'; if (navigator.share) navigator.share({ title: ttl.textContent, url: u }).catch(function () { }); else if (navigator.clipboard) navigator.clipboard.writeText(u); });
    on(doc, 'keydown', function (e) { if (lbx.hidden) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') show(cur + 1); if (e.key === 'ArrowLeft') show(cur - 1); });
    var lx = null; on(lbx, 'touchstart', function (e) { lx = e.touches[0].clientX; }, { passive: true }); on(lbx, 'touchend', function (e) { if (lx === null) return; var dx = e.changedTouches[0].clientX - lx; lx = null; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1) * (rtl ? -1 : 1)); });
  }

  /* ---------- sheets (listen chooser) ---------- */
  $$('[data-sheet-open]').forEach(function (b) {
    var s = $('#' + b.dataset.sheetOpen); if (!s) return;
    on(b, 'click', function (e) { e.preventDefault(); s.hidden = false; requestAnimationFrame(function () { s.classList.add('open'); }); $('[data-sheet-close]', s).focus(); });
    function close() { s.classList.remove('open'); setTimeout(function () { s.hidden = true; }, 400); b.focus(); }
    on(s, 'click', function (e) { if (e.target === s || e.target.closest('[data-sheet-close]')) close(); });
    on(doc, 'keydown', function (e) { if (e.key === 'Escape' && !s.hidden) close(); });
  });

  /* copy link / share */
  $$('[data-copy-link]').forEach(function (b) {
    on(b, 'click', function () { var l = $('span', b), t0 = l.textContent; if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () { l.textContent = T.copied || 'Copied'; setTimeout(function () { l.textContent = t0; }, 1600); }); });
  });

  /* ---------- enquiry forms ---------- */
  var form = $('form[data-enquiry]');
  if (form) {
    var started = Date.now(), qp = new URLSearchParams(location.search);
    $$('[data-prefill]', form).forEach(function (el) { var v = qp.get(el.dataset.prefill); if (v) el.value = v; });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var E = T.err || {}, errs = [], d = new FormData(form);
      function check(name, ok, msg) { var el = form.elements[name], o = $('[data-err="' + name + '"]', form); if (!el || !o) return; (el.length && !el.tagName ? el[0] : el).setAttribute('aria-invalid', ok ? 'false' : 'true'); o.textContent = ok ? '' : msg; if (!ok) errs.push(el.length && !el.tagName ? el[0] : el); }
      check('name', (d.get('name') || '').trim().length > 1, E.name);
      check('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((d.get('email') || '').trim()), E.email);
      check('brief', (d.get('brief') || '').trim().length > 9, E.brief);
      check('consent', form.elements.consent && form.elements.consent.checked, E.consent);
      var sum = $('[data-summary]', form), ok = $('[data-ok]', form);
      if (errs.length) { sum.textContent = E.summary; sum.hidden = false; errs[0].focus(); return; }
      sum.hidden = true;
      function done(msg) { ok.textContent = msg; ok.hidden = false; ok.focus(); }
      if (d.get('website') || Date.now() - started < 2500) { done(T.sent); return; }
      var label = form.dataset.label, to = form.dataset.to, endpoint = form.dataset.endpoint || KH.endpoint, lines = [label, ''], payload = {};
      $$('input, select, textarea', form).forEach(function (el) {
        if (!el.name || el.name === 'website' || el.name === 'consent') return;
        if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
        var v = el.value.trim(); if (!v) return;
        var lab = el.closest('.fld') && $('label', el.closest('.fld'));
        var nm = lab ? lab.textContent.replace(/\*.*$/, '').replace(/\s*\(.*\)\s*$/, '').trim() : el.name;
        payload[el.name] = payload[el.name] ? payload[el.name] + ', ' + v : v;
        if (el.name !== 'brief') lines.push(nm + ': ' + v);
      });
      lines.push('', d.get('brief'), '', 'Language: ' + KH.lang);
      payload.enquiry_type = form.dataset.kind; payload.language = KH.lang; payload._subject = '[' + label + '] ' + d.get('name');
      function mailto() { location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(payload._subject) + '&body=' + encodeURIComponent(lines.join('\n')); done((T.sent_mailto || '').replace('{e}', to)); }
      if (!endpoint) { mailto(); return; }
      var btn = $('button[type="submit"]', form); btn.disabled = true;
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { if (!r.ok) throw r; form.reset(); done(T.sent); }).catch(mailto).then(function () { btn.disabled = false; });
    });
  }

  /* ---------- site search ---------- */
  var sb = $('[data-search]');
  if (sb) {
    var inp = $('[data-search-input]', sb), res = $('[data-search-results]', sb), cnt = $('[data-search-count]', sb), idxData = null;
    fetch(sb.dataset.index).then(function (r) { return r.json(); }).then(function (j) { idxData = j; go(); });
    var qs = new URLSearchParams(location.search).get('q'); if (qs) inp.value = qs;
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
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

  /* ---------- analytics after consent only ---------- */
  var A = KH.analytics || {}, cb = $('[data-consent]');
  function store(v) { try { localStorage.setItem('kh-consent', v); } catch (e) { } }
  function stored() { try { return localStorage.getItem('kh-consent'); } catch (e) { return null; } }
  function loadA() {
    if (!A.id || window.__khA) return; window.__khA = 1; var s = doc.createElement('script'); s.async = true;
    if (A.provider === 'plausible') { s.src = 'https://plausible.io/js/script.js'; s.setAttribute('data-domain', A.id); }
    else { s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(A.id); window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); }; window.gtag('js', new Date()); window.gtag('config', A.id, { anonymize_ip: true }); }
    doc.head.appendChild(s);
  }
  if (A.id && cb) {
    var c0 = stored(); if (c0 === 'yes') loadA(); else if (c0 !== 'no') cb.hidden = false;
    on($('[data-consent-yes]', cb), 'click', function () { store('yes'); cb.hidden = true; loadA(); });
    on($('[data-consent-no]', cb), 'click', function () { store('no'); cb.hidden = true; });
  }
})();
