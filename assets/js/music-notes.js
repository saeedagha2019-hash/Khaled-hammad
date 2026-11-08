/* Music-notes study — the posters ride a musical staff that flows across the screen as a wave.
   · a five-line staff sweeps right → left; it swells toward the viewer at both edges and recedes in the middle,
     so the posters riding it grow and shrink with the perspective, tilting with the line they sit on
   · the works travel along the wave continuously, right → left (the reading direction in Arabic)
   · listen (opt-in only): the wave dances with the chosen music — its height follows loudness, its shape follows
     the frequency spectrum, the posters sway on it and the one in focus pulses on the beat; as works pass the
     focus, the music cross-fades to that work's own excerpt when it has one
   · drag or scroll to move the wave yourself; click a poster to open it
   Canvas 2D (crisp posters on every browser) + Web Audio. No notes or clefs: only the staff, in bronze. */
(function () {
  'use strict';
  var root = document.querySelector('[data-mn]');
  if (!root) return;
  var doc = document, canvas = root.querySelector('canvas'), x = canvas.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && matchMedia('(hover: none)').matches;
  var WORKS = JSON.parse(root.querySelector('[data-mm-data]').textContent), N = WORKS.length;
  var ui = {
    title: root.querySelector('[data-mm-title]'), mood: root.querySelector('[data-mm-mood]'), meter: root.querySelector('[data-mm-meter]'),
    listen: root.querySelector('[data-mm-listen]'), listenLabel: root.querySelector('[data-mm-listen-label]'), cut: root.querySelector('[data-mm-cut]'),
    cap: root.querySelector('[data-ms-cap]'), capT: root.querySelector('[data-ms-cap-t]'), capM: root.querySelector('[data-ms-cap-m]')
  };
  doc.body.classList.add('wc-mode');

  /* ---------- posters ---------- */
  WORKS.forEach(function (w) {
    w.im = new Image(); w.im.decoding = 'async';
    w.im.onload = function () {
      w.ok = true;
      var t = doc.createElement('canvas'); t.width = 4; t.height = 6; var tx = t.getContext('2d'); tx.drawImage(w.im, 0, 0, 4, 6);
      var d = tx.getImageData(0, 0, 4, 6).data, r = 0, g = 0, b = 0; for (var k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
      var n = d.length / 4, m = (r + g + b) / (3 * n), s = 1.5; w.rgb = [m + (r / n - m) * s, m + (g / n - m) * s, m + (b / n - m) * s].map(function (v) { return Math.max(0, Math.min(255, v)) | 0; });
    };
    w.im.src = w.img; w.rgb = [40, 70, 68]; w.sway = 0; w.lift = 0;
  });

  /* ---------- the wave ---------- */
  var W = 0, H = 0, DPR = 1, small = false, grainPat = null;
  var wave = { amp: 0.17, phase: 0, k: 1.9 }, bands = new Float32Array(18), eq = 0;
  // perspective along the wave: near (large) at both edges, far (small) in the middle — as in the sketch
  function S(t) { var c = 2 * t - 1; return 0.5 + 0.78 * Math.pow(Math.abs(c), 1.5); }
  function X(t) { return -W * 0.06 + t * W * 1.12; }
  function specAt(t) { var u = Math.max(0, Math.min(1, 1 - t)) * 16.999, i = Math.floor(u), f = u - i; return (bands[i] * (1 - f) + bands[Math.min(17, i + 1)] * f) * eq; }  // lows on the right
  function Y(t) {
    var AU = small ? Math.min(H, W * 0.75) : H;                // on tall phones the wave is measured against the width
    return H * 0.52 + Math.sin(t * Math.PI * wave.k + wave.phase) * AU * wave.amp * (0.6 + 0.5 * S(t))
      + Math.sin(t * Math.PI * 4.2 - wave.phase * 1.3 + 1.1) * AU * wave.amp * 0.16 - specAt(t) * AU * 0.12;
  }
  function gap(t) { return posterH(t) * 0.2; }
  function posterH(t) { return (small ? Math.min(H * 0.24, W * 0.5) : H * 0.27) * S(t); }
  function angle(t) { var d = 0.002; return Math.atan2(Y(t + d) - Y(t - d), X(t + d) - X(t - d)); }

  // index-space ↔ screen mapping, so posters stay evenly spaced in proportion to their size
  var TBL = 512, nOf = new Float32Array(TBL + 1), NT = 0;
  function buildTable() {
    var acc = 0; nOf[0] = 0;
    for (var i = 1; i <= TBL; i++) { var t = (i - 0.5) / TBL, spacing = posterH(t) / 1.5 * 1.22 + (small ? 10 : 18); acc += (W * 1.12 / TBL) / spacing; nOf[i] = acc; }
    NT = acc;
  }
  function tOf(v) {                         // inverse of nOf
    if (v <= 0) return 0; if (v >= NT) return 1;
    var lo = 0, hi = TBL; while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (nOf[mid] < v) lo = mid; else hi = mid; }
    return (lo + (v - nOf[lo]) / (nOf[hi] - nOf[lo])) / TBL;
  }

  function resize() {
    var r = canvas.getBoundingClientRect(); DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    small = W < 700; buildTable();
    var g = doc.createElement('canvas'); g.width = g.height = 160; var gx = g.getContext('2d'), id = gx.createImageData(160, 160);
    for (var k = 0; k < id.data.length; k += 4) { var v = Math.random() * 255 | 0; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 14; }
    gx.putImageData(id, 0, 0); grainPat = x.createPattern(g, 'repeat');
  }
  window.addEventListener('resize', resize);

  /* ---------- audio (opt-in) ---------- */
  var AC = null, analyser = null, data = null, listening = false, playing = -1;
  var TRACKS = WORKS.filter(function (w) { return w.track; });
  function initAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return false;
    AC = new Ctx(); analyser = AC.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.6; data = new Uint8Array(analyser.frequencyBinCount);
    analyser.connect(AC.destination);
    TRACKS.forEach(function (w) {
      w.audio = new Audio(); w.audio.src = w.track; w.audio.loop = true; w.audio.preload = 'none'; w.audio.crossOrigin = 'anonymous';
      w.gain = AC.createGain(); w.gain.gain.value = 0; AC.createMediaElementSource(w.audio).connect(w.gain); w.gain.connect(analyser);
    });
    return true;
  }
  function fadeTo(w) {                      // cross-fade like a dissolve between two scenes
    if (!AC) return; var now = AC.currentTime;
    TRACKS.forEach(function (o) { var g = o.gain.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(o === w ? 0.9 : 0, now + (o === w ? 2 : 1.5)); });
    if (w && w.audio.paused) w.audio.play().catch(function () {});
    TRACKS.forEach(function (o) { if (o !== w) setTimeout(function () { if (playing !== TRACKS.indexOf(o)) o.audio.pause(); }, 1700); });
    playing = w ? TRACKS.indexOf(w) : -1;
  }
  ui.listen.addEventListener('click', function () {
    if (!AC && !initAudio()) return;
    if (AC.state === 'suspended') AC.resume();
    listening = !listening;
    ui.listen.setAttribute('aria-pressed', listening ? 'true' : 'false');
    ui.listenLabel.textContent = listening ? ui.listen.dataset.on : ui.listen.dataset.off;
    if (listening) fadeTo(WORKS[focus].track ? WORKS[focus] : TRACKS[0]); else fadeTo(null);
  });
  var level = 0, pulse = 0, lowPrev = 0;
  function listenFrame() {
    if (!listening || !analyser) { level += (0 - level) * 0.04; pulse *= 0.9; for (var z = 0; z < 18; z++) bands[z] *= 0.95; return; }
    analyser.getByteFrequencyData(data);
    var sum = 0, low = 0, n = data.length; for (var i = 0; i < n; i++) { sum += data[i]; if (i < 12) low += data[i]; }
    for (var bi = 0; bi < 18; bi++) {
      var a0 = Math.floor(2 * Math.pow(n / 2, bi / 18)), a1 = Math.max(a0 + 1, Math.floor(2 * Math.pow(n / 2, (bi + 1) / 18))), acc = 0;
      for (var q = a0; q < a1 && q < n; q++) acc += data[q];
      var v0 = Math.max(0, acc / ((a1 - a0) * 255) - 0.15) / 0.85;
      bands[bi] += (v0 - bands[bi]) * (v0 > bands[bi] ? 0.22 : 0.05);      // soft, so the staff flows rather than jitters
    }
    var lv = sum / (n * 255), lo = low / (12 * 255);
    level += (lv - level) * (lv > level ? 0.2 : 0.04);
    if (lo - lowPrev > 0.06) pulse = 1;
    lowPrev = lo; pulse *= 0.93;
  }

  /* ---------- input ---------- */
  var cam = 0, vel = 0, lastInput = -1e9, drag = null, mouse = { x: -1, y: -1, in: false }, hits = [], opening = null;
  function unitPx() { return W * 1.12 / NT; }            // roughly how many px one index step is
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); cam += (e.deltaY - e.deltaX) / (unitPx() * 1.4); lastInput = performance.now(); }, { passive: false });
  canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, moved: 0, v: 0, t: performance.now() }; lastInput = performance.now(); });
  canvas.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.in = e.pointerType === 'mouse';
    if (!drag) return; var dx = e.clientX - drag.x, now = performance.now();
    cam -= dx / unitPx(); drag.v = -dx / unitPx() / Math.max(1, now - drag.t) * 1000; drag.t = now; drag.x = e.clientX; drag.moved += Math.abs(dx); lastInput = now;
  });
  canvas.addEventListener('pointerleave', function () { mouse.in = false; });
  canvas.addEventListener('pointerup', function (e) {
    if (!drag) return; var d = drag; drag = null;
    if (d.moved < 6) { var r = canvas.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top); if (h) open(h); }
    else if (!reduce) vel = d.v * 0.35;
    lastInput = performance.now();
  });
  canvas.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') cam += 1; else if (e.key === 'ArrowRight') cam -= 1; else if (e.key === 'Enter') { open({ w: WORKS[focus] }); return; } else return;
    lastInput = performance.now(); e.preventDefault();
  });
  function hit(px, py) {                                     // the poster under the pointer, front-most first (posters are rotated)
    for (var i = hits.length - 1; i >= 0; i--) {
      var h = hits[i], c = Math.cos(-h.a), s = Math.sin(-h.a), dx = px - h.x, dy = py - h.y, lx = dx * c - dy * s, ly = dx * s + dy * c;
      if (Math.abs(lx) <= h.pw / 2 && Math.abs(ly) <= h.ph / 2) return h;
    }
    return null;
  }
  function open(h) { if (opening) return; opening = { w: h.w, t: 0 }; if (AC && listening) fadeTo(null); }

  /* ---------- draw ---------- */
  var last = performance.now(), focus = 0, shown = -1, tempo = 1, calm = 1, FOCUS_T = 0.74;   // the "now" point, right of centre: works enter there first
  function staff(alpha, lw) {
    for (var i = 0; i < 5; i++) {
      x.beginPath();
      for (var k = 0; k <= 160; k++) { var t = k / 160, px = X(t), py = Y(t) + (i - 2) * gap(t); k ? x.lineTo(px, py) : x.moveTo(px, py); }
      var g = x.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, 'rgba(214,190,146,' + 0.85 * alpha + ')'); g.addColorStop(0.5, 'rgba(179,154,112,' + 0.45 * alpha + ')'); g.addColorStop(1, 'rgba(242,237,227,' + 0.9 * alpha + ')');
      x.strokeStyle = g; x.lineWidth = lw * (i === 2 ? 1.25 : 1); x.stroke();
    }
  }
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000 || 0.016), t = now * 0.001; last = now;
    var idle = (now - lastInput) / 1000;
    listenFrame(); eq += ((listening ? 1 : 0) - eq) * 0.05;
    // flow: continuous right → left; a drag fling decays into it
    var flow = reduce ? 0 : (drag ? 0 : (0.05 + (listening ? 0.03 * tempo + level * 0.05 : 0)) * (idle > 1.2 ? 1 : 0.15));
    if (!drag) { cam += (flow + vel) * dt; vel *= Math.pow(0.08, dt); }
    calm += ((listening ? 1 : idle > 10 ? 0.55 : 1) - calm) * 0.02;
    // the wave: breathes on its own, dances with the music
    var fw = WORKS[focus]; tempo += ((fw.tempo || 1) - tempo) * 0.02;
    var breath = 0.5 + 0.5 * Math.sin(t * tempo * 1.3);
    var targetAmp = reduce ? 0.12 : (listening ? 0.08 + level * (small ? 0.22 : 0.3) + pulse * 0.035 : (0.12 + 0.05 * breath) * calm);
    wave.amp += (targetAmp - wave.amp) * 0.05;
    wave.phase += reduce ? 0 : dt * (0.35 + 0.5 * tempo) * (listening ? 0.8 + level * 2 : calm);
    wave.k = 1.9 + (listening ? Math.sin(t * 0.21) * 0.25 : 0);

    // background
    var bg = x.createRadialGradient(W * 0.55, H * 0.5, 40, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    bg.addColorStop(0, '#182927'); bg.addColorStop(1, '#0B1012');
    x.setTransform(DPR, 0, 0, DPR, 0, 0); x.fillStyle = bg; x.fillRect(0, 0, W, H);
    // echoes of the staff, far behind
    x.save(); x.globalAlpha = 0.16; x.translate(0, -H * 0.2); x.scale(1, 1.25); staff(0.6, 1); x.restore();
    x.save(); x.globalAlpha = 0.1; x.translate(0, H * 0.22); x.scale(1, 0.8); staff(0.6, 1); x.restore();
    staff(1, small ? 1.1 : 1.5);

    // posters along the wave
    var base = Math.floor(cam), frac = cam - base, items = [];
    for (var k = -1; k <= Math.ceil(NT) + 1; k++) {
      var v = k - frac + 0.5; if (v < -0.6 || v > NT + 0.6) continue;
      var tt = tOf(Math.max(0, Math.min(NT, v))), wi = ((base + k) % N + N) % N, w = WORKS[wi];
      items.push({ t: tt, w: w, wi: wi, d: Math.abs(tt - FOCUS_T) });
    }
    // focus: the work at the "now" point
    var best = items.reduce(function (a, b) { return !a || b.d < a.d ? b : a; }, null);
    if (best) { focus = best.wi; if (focus !== shown) onFocus(); }
    items.sort(function (a, b) { return S(a.t) - S(b.t); });                      // far first, near last
    hits = [];
    var hov = mouse.in && !drag ? hit(mouse.x, mouse.y) : null;
    items.forEach(function (it) {
      var w = it.w, tt = it.t, h = posterH(tt), pw = h / 1.5, px = X(tt), a = Math.max(-0.42, Math.min(0.42, angle(tt) * 0.75));   // tilt with the line, never more than ~24°
      var isF = it === best, isH = !!hov && hov.w === w && Math.abs(hov.t - tt) < 0.02;
      w.lift += ((isH ? 1 : 0) - w.lift) * 0.15;
      var sway = listening ? Math.sin(t * (2 + tempo) + it.wi) * level * 0.08 : Math.sin(t * tempo + it.wi * 1.7) * 0.02 * calm;
      var py = Y(tt) + Math.sin(it.wi * 2.3) * gap(tt) * 0.35;                     // each work sits on its own line or space, like a note
      var sc = 1 + 0.04 * w.lift + (isF && listening ? pulse * 0.05 : 0);
      var hh = h * sc, ww = pw * sc, alpha = 1 - (opening ? opening.t : 0);
      // light spill in the poster's colour
      var rg = x.createRadialGradient(px, py, 0, px, py, hh * 1.1), c = w.rgb, glowA = (0.22 + 0.25 * S(tt) + (isF ? 0.15 + level * 0.5 : 0)) * alpha;
      rg.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + glowA + ')'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.globalCompositeOperation = 'lighter'; x.fillStyle = rg; x.fillRect(px - hh * 1.2, py - hh * 1.2, hh * 2.4, hh * 2.4); x.globalCompositeOperation = 'source-over';
      x.save(); x.translate(px, py); x.rotate(a + sway); x.globalAlpha = alpha;
      x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 26 * S(tt); x.shadowOffsetY = 10 * S(tt);
      if (w.ok) x.drawImage(w.im, -ww / 2, -hh / 2, ww, hh); else { x.fillStyle = '#1B3836'; x.fillRect(-ww / 2, -hh / 2, ww, hh); }
      x.shadowColor = 'transparent';
      x.strokeStyle = isF ? 'rgba(214,190,146,' + (0.65 + 0.35 * pulse) + ')' : 'rgba(242,237,227,.16)'; x.lineWidth = isF ? 2 : 1; x.strokeRect(-ww / 2, -hh / 2, ww, hh);
      // far posters sink into the dark
      var fade = Math.max(0, 1 - S(tt)) * 0.55; if (fade > 0) { x.fillStyle = 'rgba(11,16,18,' + fade + ')'; x.fillRect(-ww / 2, -hh / 2, ww, hh); }
      x.restore();
      hits.push({ x: px, y: py, w: w, t: tt, a: a + sway, pw: ww, ph: hh });
    });
    // the staff threads lightly over the posters at the edges, so they sit *on* it
    x.save(); x.globalAlpha = 0.18; staff(1, 1); x.restore();
    // grain + vignette
    x.fillStyle = grainPat; x.fillRect(0, 0, W, H);
    var vg = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);

    ui.meter.style.setProperty('--lv', (listening ? level * 2.2 : 0.18 * calm * breath).toFixed(3)); ui.meter.style.setProperty('--pulse', pulse.toFixed(3));
    root.classList.toggle('is-scrolled', listening || idle < 30 && lastInput > 0);
    canvas.style.cursor = hov ? 'pointer' : (drag ? 'grabbing' : 'grab');
    if (opening) { opening.t = Math.min(1, opening.t + dt / 0.75); ui.cut.style.opacity = opening.t; if (opening.t >= 1) { location.href = opening.w.href; return; } }
    requestAnimationFrame(frame);
  }
  function onFocus() {
    shown = focus; var w = WORKS[focus];
    ui.title.textContent = w.t; ui.mood.textContent = w.moodLabel || w.cl;
    ui.cap.classList.remove('is-on');
    setTimeout(function () { ui.capT.textContent = w.t; ui.capM.textContent = [w.cl, w.y, w.cr].filter(Boolean).join(' · '); ui.cap.classList.add('is-on'); }, 300);
    if (listening && w.track && TRACKS.indexOf(w) !== playing) fadeTo(w);               // its own music, when it has one
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted && opening) { opening = null; ui.cut.style.opacity = 0; last = performance.now(); requestAnimationFrame(frame); } });
  resize(); canvas.focus({ preventScroll: true }); requestAnimationFrame(frame);
})();
