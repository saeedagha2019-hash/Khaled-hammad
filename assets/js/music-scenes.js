/* Music scenes — three ways of showing the works on a musical staff, chosen from the concept stills.
   data-scene="stage": the work in focus stands large in front of a gently curved wall of works; a staff flows behind
                       them and a treble clef opens it; the works glide one step at a time, right → left
   data-scene="wave":  the posters are bent onto a staff that flows as a wave; they enter small on the right and grow
                       as they travel toward the clef on the left, notes riding the staff between them
   data-scene="hung":  each poster hangs from the top line of the staff by a bronze clip and swings as the line carries
                       it right → left; the staff and the posters move with the music
   Listening is opt-in only: the staff dances with the music (height from loudness, shape from the spectrum, a pulse
   on the beat) and the music cross-fades to the work in focus when it has its own excerpt.
   Three stacked canvases: 2D behind (staff, light), WebGL (the posters as meshes, so they bend and turn in
   perspective), 2D in front (clef, notes, frames, clips, grain). */
(function () {
  'use strict';
  var root = document.querySelector('[data-scene]');
  if (!root) return;
  var SCENE = root.getAttribute('data-scene'), doc = document;
  var back = root.querySelector('[data-sc-back]'), glc = root.querySelector('[data-sc-gl]'), front = root.querySelector('[data-sc-front]');
  var gl = null; try { gl = glc.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true }); } catch (e) {}
  if (!gl) { root.classList.add('no-gl'); return; }
  var bx = back.getContext('2d'), fx = front.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WORKS = JSON.parse(root.querySelector('[data-mm-data]').textContent), N = WORKS.length;
  var ui = {
    title: root.querySelector('[data-mm-title]'), mood: root.querySelector('[data-mm-mood]'), meter: root.querySelector('[data-mm-meter]'),
    listen: root.querySelector('[data-mm-listen]'), listenLabel: root.querySelector('[data-mm-listen-label]'), cut: root.querySelector('[data-mm-cut]'),
    cap: root.querySelector('[data-ms-cap]'), capT: root.querySelector('[data-ms-cap-t]'), capM: root.querySelector('[data-ms-cap-m]')
  };
  doc.body.classList.add('wc-mode');

  /* ---------- GL ---------- */
  function sh(t, s) { var q = gl.createShader(t); gl.shaderSource(q, s); gl.compileShader(q); return q; }
  var prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 aPos;attribute vec2 aUv;attribute float aL;uniform vec2 uR;varying vec2 vUv;varying float vL;' +
    'void main(){vUv=aUv;vL=aL;gl_Position=vec4(aPos.x/uR.x*2.-1.,1.-aPos.y/uR.y*2.,0.,1.);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, 'precision mediump float;uniform sampler2D uTex;uniform float uA;varying vec2 vUv;varying float vL;' +
    'void main(){vec3 c=texture2D(uTex,vUv).rgb*vL;float e=min(min(vUv.x,1.-vUv.x)*70.,min(vUv.y,1.-vUv.y)*100.);c*=mix(.72,1.,clamp(e,0.,1.));gl_FragColor=vec4(c*uA,uA);}'));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { root.classList.add('no-gl'); return; }
  gl.useProgram(prog);
  var loc = { aPos: gl.getAttribLocation(prog, 'aPos'), aUv: gl.getAttribLocation(prog, 'aUv'), aL: gl.getAttribLocation(prog, 'aL'),
    uR: gl.getUniformLocation(prog, 'uR'), uTex: gl.getUniformLocation(prog, 'uTex'), uA: gl.getUniformLocation(prog, 'uA') };
  var vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.enableVertexAttribArray(loc.aPos); gl.vertexAttribPointer(loc.aPos, 2, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(loc.aUv); gl.vertexAttribPointer(loc.aUv, 2, gl.FLOAT, false, 20, 8);
  gl.enableVertexAttribArray(loc.aL); gl.vertexAttribPointer(loc.aL, 1, gl.FLOAT, false, 20, 16);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.uniform1i(loc.uTex, 0);
  var VB = new Float32Array(240000), vn = 0, draws = [];
  function texFrom(src) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t;
  }
  var blank = (function () { var c = doc.createElement('canvas'); c.width = c.height = 4; var q = c.getContext('2d'); q.fillStyle = '#1B3836'; q.fillRect(0, 0, 4, 4); return texFrom(c); })();
  // queue a poster mesh: fn(u, v) → [x, y] in CSS px, light(u, v) → brightness
  function mesh(fn, tex, light, nu, nv, alpha) {
    var start = vn / 5, need = nu * nv * 30; if (vn + need > VB.length) return;
    for (var i = 0; i < nu; i++) for (var j = 0; j < nv; j++) {
      var u0 = i / nu, u1 = (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv, a = fn(u0, v0), b = fn(u1, v0), c = fn(u0, v1), d = fn(u1, v1);
      var la = light(u0, v0), lb = light(u1, v0), lc = light(u0, v1), ld = light(u1, v1);
      put(a, u0, v0, la); put(b, u1, v0, lb); put(c, u0, v1, lc); put(c, u0, v1, lc); put(b, u1, v0, lb); put(d, u1, v1, ld);
    }
    draws.push([tex || blank, start, vn / 5 - start, alpha]);
  }
  function put(p, u, v, l) { VB[vn++] = p[0]; VB[vn++] = p[1]; VB[vn++] = u; VB[vn++] = v; VB[vn++] = l; }
  function flushGL() {
    gl.viewport(0, 0, glc.width, glc.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform2f(loc.uR, W, H);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, VB.subarray(0, vn), gl.DYNAMIC_DRAW);
    draws.forEach(function (d) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, d[0]); gl.uniform1f(loc.uA, d[3]); gl.drawArrays(gl.TRIANGLES, d[1], d[2]); });
    vn = 0; draws = [];
  }

  /* ---------- posters ---------- */
  WORKS.forEach(function (w) {
    w.rgb = [40, 70, 68]; w.im = new Image(); w.im.decoding = 'async';
    w.im.onload = function () {
      var c = doc.createElement('canvas'); c.width = 512; c.height = 1024; c.getContext('2d').drawImage(w.im, 0, 0, 512, 1024); w.tex = texFrom(c);
      var t = doc.createElement('canvas'); t.width = 4; t.height = 6; var tx = t.getContext('2d'); tx.drawImage(w.im, 0, 0, 4, 6);
      var d = tx.getImageData(0, 0, 4, 6).data, r = 0, g = 0, b = 0; for (var k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
      var n = d.length / 4; w.rgb = [r / n * 0.45 + 179 * 0.55 | 0, g / n * 0.45 + 154 * 0.55 | 0, b / n * 0.45 + 112 * 0.55 | 0];
    };
    w.im.src = w.img;
  });

  /* ---------- music glyphs ---------- */
  var fontOk = false, CLEF = '𝄞', Q = '𝅘𝅥', E8 = '𝅘𝅥𝅮', S16 = '𝅘𝅥𝅯', BEAM = '♫', clefM = null;
  if (window.FontFace && root.dataset.font) {
    var ff = new FontFace('KHMusic', 'url(' + root.dataset.font + ')');
    ff.load().then(function (f) { doc.fonts.add(f); fontOk = true; fx.font = '100px KHMusic'; var m = fx.measureText(CLEF); clefM = [m.actualBoundingBoxAscent, m.actualBoundingBoxDescent]; }).catch(function () {});
  }
  function metal(c, y0, y1) { var g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#F2EDE3'); g.addColorStop(0.35, '#D9C49A'); g.addColorStop(0.7, '#B39A70'); g.addColorStop(1, '#6E5B3E'); return g; }
  function glyph(ch, x, y, size, rot, glow) {
    if (!fontOk) return; var c = fx; c.save(); c.translate(x, y); c.rotate(rot || 0); c.font = size + 'px KHMusic'; c.textAlign = 'center'; c.direction = 'ltr';
    c.shadowColor = 'rgba(217,180,120,' + (0.7 * (glow || 1)) + ')'; c.shadowBlur = size * 0.18; c.fillStyle = metal(c, -size * 0.8, size * 0.15); c.fillText(ch, 0, 0); c.restore();
  }
  function clef(x, top, height, rot) {
    if (!clefM) return; var fs = 100 * height / (clefM[0] + clefM[1]); glyph(CLEF, x, top + clefM[0] * fs / 100, fs, rot, 1.2);
  }

  /* ---------- 2D helpers ---------- */
  function glowPath(c, pts, w, a) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = c.lineCap = 'round';
    var passes = [[w * 5, 0.1, '190,160,115'], [w * 1.8, 0.4, '217,196,154'], [w * 0.6, 0.9, '242,237,227']];
    for (var p = 0; p < passes.length; p++) { c.beginPath(); for (var i = 0; i < pts.length; i++) i ? c.lineTo(pts[i][0], pts[i][1]) : c.moveTo(pts[i][0], pts[i][1]);
      c.strokeStyle = 'rgba(' + passes[p][2] + ',' + passes[p][1] * a + ')'; c.lineWidth = passes[p][0]; c.stroke(); }
    c.restore();
  }
  function outline(fn, n) { var p = [], i; for (i = 0; i <= n; i++) p.push(fn(i / n, 0)); for (i = 1; i <= n; i++) p.push(fn(1, i / n)); for (i = n - 1; i >= 0; i--) p.push(fn(i / n, 1)); for (i = n - 1; i > 0; i--) p.push(fn(0, i / n)); return p; }
  function softGlow(c, x, y, r, rgb, a) { if (a <= 0.003 || r <= 1) return; c.save(); c.globalCompositeOperation = 'lighter'; var g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(0.5, 'rgba(' + rgb + ',' + a * 0.3 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
  function shadowPoly(c, pts, blur, dy, a) { c.save(); c.shadowColor = 'rgba(0,0,0,' + a + ')'; c.shadowBlur = blur; c.shadowOffsetY = dy; c.fillStyle = 'rgba(8,12,14,.9)'; c.beginPath();
    pts.forEach(function (p, i) { i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath(); c.fill(); c.restore(); }
  function inPoly(px, py, pts) { var inside = false; for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) { var a = pts[i], b = pts[j];
    if ((a[1] > py) !== (b[1] > py) && px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; }
  function bgFill(lx, ly) {
    var g = bx.createRadialGradient(W * lx, H * ly, 30, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    g.addColorStop(0, '#1F3431'); g.addColorStop(0.45, '#122120'); g.addColorStop(1, '#070B0D'); bx.fillStyle = g; bx.fillRect(0, 0, W, H);
    softGlow(bx, W * lx, H * (ly - 0.06), Math.max(W, H) * 0.45, '179,154,112', 0.12 + level * 0.12);
  }

  /* ---------- size ---------- */
  var W = 0, H = 0, DPR = 1, small = false, grainPat = null;
  function resize() {
    var r = root.getBoundingClientRect(); DPR = Math.min(window.devicePixelRatio || 1, 1.75); W = r.width; H = r.height; small = W < 700;
    [back, glc, front].forEach(function (c) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); });
    var g = doc.createElement('canvas'); g.width = g.height = 160; var gx = g.getContext('2d'), id = gx.createImageData(160, 160);
    for (var k = 0; k < id.data.length; k += 4) { var v = Math.random() * 255 | 0; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 13; }
    gx.putImageData(id, 0, 0); grainPat = fx.createPattern(g, 'repeat');
    if (scene.resize) scene.resize();
  }
  window.addEventListener('resize', resize);

  /* ---------- audio (opt-in) ---------- */
  var AC = null, analyser = null, fdata = null, listening = false, playing = -1, bands = new Float32Array(18), level = 0, pulse = 0, lowPrev = 0, eq = 0;
  var TRACKS = WORKS.filter(function (w) { return w.track; });
  function initAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return false;
    AC = new Ctx(); analyser = AC.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.6; fdata = new Uint8Array(analyser.frequencyBinCount); analyser.connect(AC.destination);
    TRACKS.forEach(function (w) { w.audio = new Audio(); w.audio.src = w.track; w.audio.loop = true; w.audio.preload = 'none'; w.audio.crossOrigin = 'anonymous';
      w.gain = AC.createGain(); w.gain.gain.value = 0; AC.createMediaElementSource(w.audio).connect(w.gain); w.gain.connect(analyser); });
    return true;
  }
  function fadeTo(w) {
    if (!AC) return; var now = AC.currentTime;
    TRACKS.forEach(function (o) { var g = o.gain.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(o === w ? 0.9 : 0, now + (o === w ? 2 : 1.5)); });
    if (w && w.audio.paused) w.audio.play().catch(function () {});
    TRACKS.forEach(function (o) { if (o !== w) setTimeout(function () { if (playing !== TRACKS.indexOf(o)) o.audio.pause(); }, 1700); });
    playing = w ? TRACKS.indexOf(w) : -1;
  }
  ui.listen.addEventListener('click', function () {
    if (!AC && !initAudio()) return; if (AC.state === 'suspended') AC.resume();
    listening = !listening; ui.listen.setAttribute('aria-pressed', listening ? 'true' : 'false'); ui.listenLabel.textContent = listening ? ui.listen.dataset.on : ui.listen.dataset.off;
    if (listening) fadeTo(WORKS[focus].track ? WORKS[focus] : TRACKS[0]); else fadeTo(null);
  });
  function listenFrame() {
    if (!listening || !analyser) { level += (0 - level) * 0.04; pulse *= 0.9; for (var z = 0; z < 18; z++) bands[z] *= 0.95; return; }
    analyser.getByteFrequencyData(fdata);
    var sum = 0, low = 0, n = fdata.length; for (var i = 0; i < n; i++) { sum += fdata[i]; if (i < 12) low += fdata[i]; }
    for (var bi = 0; bi < 18; bi++) {
      var a0 = Math.floor(2 * Math.pow(n / 2, bi / 18)), a1 = Math.max(a0 + 1, Math.floor(2 * Math.pow(n / 2, (bi + 1) / 18))), acc = 0;
      for (var q = a0; q < a1 && q < n; q++) acc += fdata[q];
      var v0 = Math.max(0, acc / ((a1 - a0) * 255) - 0.15) / 0.85; bands[bi] += (v0 - bands[bi]) * (v0 > bands[bi] ? 0.22 : 0.05);
    }
    var lv = sum / (n * 255), lo = low / (12 * 255); level += (lv - level) * (lv > level ? 0.2 : 0.04);
    if (lo - lowPrev > 0.06) pulse = 1; lowPrev = lo; pulse *= 0.93;
  }
  function specAt(t) { var u = Math.max(0, Math.min(1, 1 - t)) * 16.999, i = Math.floor(u), f = u - i; return (bands[i] * (1 - f) + bands[Math.min(17, i + 1)] * f) * eq; }   // lows on the right

  /* ---------- input ---------- */
  var cam = 0, target = 0, vel = 0, lastInput = -1e9, drag = null, mouse = { x: -1, y: -1, in: false }, hits = [], opening = null, wheelT = 0;
  front.addEventListener('wheel', function (e) { e.preventDefault(); var d = e.deltaY - e.deltaX; lastInput = performance.now();
    if (scene.stepped) { if (performance.now() - wheelT > 380 && Math.abs(d) > 4) { target += d > 0 ? 1 : -1; wheelT = performance.now(); } } else cam += d / (scene.unit() * 1.4); }, { passive: false });
  front.addEventListener('pointerdown', function (e) { front.setPointerCapture(e.pointerId); drag = { x: e.clientX, moved: 0, v: 0, t: performance.now() }; lastInput = performance.now(); });
  front.addEventListener('pointermove', function (e) {
    var r = front.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.in = e.pointerType === 'mouse';
    if (!drag) return; var dx = e.clientX - drag.x, now = performance.now(), du = dx / scene.unit();
    cam -= du; target = cam; drag.v = -du / Math.max(1, now - drag.t) * 1000; drag.t = now; drag.x = e.clientX; drag.moved += Math.abs(dx); lastInput = now;
  });
  front.addEventListener('pointerleave', function () { mouse.in = false; });
  front.addEventListener('pointerup', function (e) {
    if (!drag) return; var d = drag; drag = null;
    if (d.moved < 6) { var r = front.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top); if (h) open(h.w); }
    else if (scene.stepped) target = Math.round(cam + (reduce ? 0 : d.v * 0.25)); else if (!reduce) vel = d.v * 0.35;
    lastInput = performance.now();
  });
  front.addEventListener('keydown', function (e) {
    var s = scene.stepped;
    if (e.key === 'ArrowLeft') { if (s) target += 1; else cam += 1; } else if (e.key === 'ArrowRight') { if (s) target -= 1; else cam -= 1; }
    else if (e.key === 'Enter') { open(WORKS[focus]); return; } else return;
    lastInput = performance.now(); e.preventDefault();
  });
  function hit(px, py) { for (var i = hits.length - 1; i >= 0; i--) if (inPoly(px, py, hits[i].pts)) return hits[i]; return null; }
  function open(w) { if (opening) return; opening = { w: w, t: 0 }; if (AC && listening) fadeTo(null); }
  var wi = function (k) { return ((k % N) + N) % N; };

  /* =================================================================================================== */
  var scenes = {};

  /* --- the stage: a curved wall of works, the one in focus large in front --- */
  scenes.stage = (function () {
    var D = 3000, R = 2600, FY = 620, BH = 720, F = 1, CX = 0, CY = 0, TB = 1600, PMAX = 8, sTab = new Float32Array(TB + 1);
    function hf(p) { return 1 + 0.6 * Math.exp(-p * p * 2.2); }
    (function () { var dp = 2 * PMAX / TB, acc = 0; sTab[TB / 2] = 0;
      for (var i = TB / 2 + 1; i <= TB; i++) { var p = -PMAX + (i - 0.5) * dp; acc += (BH * hf(p) / 1.5 + 85) * dp; sTab[i] = acc; }
      acc = 0; for (i = TB / 2 - 1; i >= 0; i--) { p = -PMAX + (i + 0.5) * dp; acc -= (BH * hf(p) / 1.5 + 85) * dp; sTab[i] = acc; } })();
    function sOf(p) { var f = (Math.max(-PMAX, Math.min(PMAX, p)) + PMAX) / (2 * PMAX) * TB, i = Math.min(TB - 1, f | 0), k = f - i; return sTab[i] * (1 - k) + sTab[i + 1] * k; }
    function pr(x, y, z) { return [CX + x * F / z, CY + y * F / z]; }
    var phase = 0, amp = 1;
    function yS(x) { return -30 - 70 * Math.cos(x / 1100) + 40 * Math.sin(x / 720 + 0.4) + amp * 46 * Math.sin(x / 900 - phase) - specAt(x / 8600 + 0.5) * 160; }
    return {
      stepped: true,
      resize: function () { F = Math.min(H * 1.26, W * (small ? 1.55 : 2.3)); CX = W / 2; CY = H * (small ? 0.44 : 0.46); },
      unit: function () { return BH / 1.5 * 1.25 * F / D; },
      update: function (dt, t) { phase += reduce ? 0 : dt * (0.35 + level * 1.6) * tempo; amp += ((reduce ? 0.6 : listening ? 0.7 + level * 2.4 + pulse * 0.4 : 0.8 + 0.25 * Math.sin(t * 0.8 * tempo)) - amp) * 0.06; },
      layout: function (items) {
        var base = Math.round(cam);
        for (var k = base - 5; k <= base + 5; k++) {
          var p = k - cam, ap = Math.abs(p); if (ap > 4.6) continue;
          var w = WORKS[wi(k)], h = BH * hf(p) * (ap < 0.5 && listening ? 1 + pulse * 0.025 : 1), ww = h / 1.5, s0 = sOf(p), heroK = Math.exp(-p * p * 2.2);
          var xw = R * Math.sin(s0 / R), yc = yS(xw) * (1 - heroK) + (-70) * heroK, a = Math.min(1, (4.6 - ap) / 1.1);
          (function (s0, ww, h, yc, heroK) {
            items.push({ w: w, k: k, p: p, alpha: a, focus: ap < 0.5, depth: -ap,
              fn: function (u, v) { var th = (s0 + (u - 0.5) * ww) / R; return pr(R * Math.sin(th), yc + (v - 0.5) * h, D + R - R * Math.cos(th)); },
              mf: function (u, v) { var th = (s0 + (u - 0.5) * ww) / R; return pr(R * Math.sin(th), 2 * FY - (yc + (v - 0.5) * h), D + R - R * Math.cos(th)); },
              light: function (u) { return (0.86 + 0.18 * heroK) - 0.1 * Math.abs(u - 0.5) * (1 - heroK); }, nu: 14, nv: 2 });
          })(s0, ww, h, yc, heroK);
        }
        items.sort(function (a, b) { return a.depth - b.depth; });
      },
      back: function (items) {
        bgFill(0.5, 0.45);
        items.forEach(function (it) { var c = it.fn(0.5, 0.5), r = (it.fn(1, 0.5)[0] - it.fn(0, 0.5)[0]) * (it.focus ? 1.7 : 1.3); softGlow(bx, c[0], c[1], r, it.focus ? '217,180,120' : it.w.rgb.join(','), (it.focus ? 0.45 + level * 0.4 : 0.26) * it.alpha); });
        for (var i = 0; i < 5; i++) { var pts = []; for (var x = -4300; x <= 4300; x += 40) { var g = 95 * (1 + Math.pow(x / 3300, 2) * 1.6); pts.push(pr(x, yS(x) + (i - 2) * g, D + x * x / 12000)); } glowPath(bx, pts, small ? 1.2 : 1.6, 0.85); }
        var fy = pr(0, FY, D)[1], fg = bx.createLinearGradient(0, fy - 30, 0, H); fg.addColorStop(0, 'rgba(6,9,10,0)'); fg.addColorStop(0.2, 'rgba(6,9,10,.4)'); fg.addColorStop(1, 'rgba(4,6,7,.8)'); bx.fillStyle = fg; bx.fillRect(0, fy - 30, W, H);
        // reflections on the floor (drawn with the posters, dimmed toward the floor)
        items.forEach(function (it) { mesh(it.mf, it.w.tex, function (u, v) { return 0.32 * Math.pow(v, 2.6); }, it.nu, it.nv, it.alpha); });
      },
      front: function (items) {
        items.forEach(function (it) { glowPath(fx, outline(it.fn, 10), it.focus ? 2.2 : 1.1, (it.focus ? 0.95 + pulse * 0.3 : 0.55) * it.alpha); });
        clef(W * (small ? 0.08 : 0.085), H * (small ? 0.3 : 0.2), H * (small ? 0.3 : 0.6), 0.04);
        var notes = [[-2450, -1.6, BEAM, 0.1, -0.1], [-1060, -2.6, E8, 0.075, 0.05], [1050, -2.7, Q, 0.08, -0.04], [-1700, 3.4, E8, 0.07, 0.08], [1500, 3.8, S16, 0.075, -0.06], [2600, -1.4, BEAM, 0.09, 0.08]], tt = performance.now() * 0.001;
        notes.forEach(function (n, i) { var g = 95 * (1 + Math.pow(n[0] / 3300, 2) * 1.6), p = pr(n[0], yS(n[0]) + (n[1] - 2) * g + Math.sin(tt * 1.1 + i) * 14, D + n[0] * n[0] / 12000);
          glyph(n[2], p[0], p[1], H * n[3] * (small ? 1 : 1.4) * (1 + pulse * 0.08), n[4] + Math.sin(tt * 0.9 + i * 2) * 0.05, 1 + level); });
      }
    };
  })();

  /* --- the staff wave: posters bent onto a flowing staff, growing as they near the clef --- */
  scenes.wave = (function () {
    var phase = 0, amp = 0.1, k2 = 1.6, TBL = 512, nOf = new Float32Array(TBL + 1), NT = 0, X0 = 0, XW = 1;
    function Hs() { return small ? Math.min(H * 0.9, W * 1.45) : H; }
    function ph(t) { return Hs() * (0.15 + 0.33 * Math.pow(Math.max(0, 1 - t), 1.35)); }
    function cy(t) { var AU = small ? Math.min(H, W * 0.8) : H; return H * 0.5 + AU * amp * (Math.sin(t * Math.PI * k2 + phase) * (0.55 + 0.45 * (1 - t)) + 0.16 * Math.sin(t * Math.PI * 4.2 - phase * 1.3 + 1.1)) - specAt(t) * AU * 0.1; }
    function X(t) { return X0 + t * XW; } function T(x) { return (x - X0) / XW; }
    function slope(t) { var d = 0.002; return (cy(t + d) - cy(t - d)) / (2 * d * XW); }
    function P(x, v) { var t = T(x), a = Math.atan(slope(t)), nx = -Math.sin(a) * 0.5, ny = Math.cos(a), l = Math.hypot(nx, ny), h = ph(t) / 2; return [x + nx / l * v * h, cy(t) + ny / l * v * h]; }
    function build() { X0 = -W * 0.08; XW = W * 1.16; var acc = 0; nOf[0] = 0;
      for (var i = 1; i <= TBL; i++) { var t = (i - 0.5) / TBL; acc += (XW / TBL) / (ph(t) / 1.5 * 1.15); nOf[i] = acc; } NT = acc; }
    function tOf(v) { if (v <= 0) return 0; if (v >= NT) return 1; var lo = 0, hi = TBL; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (nOf[m] < v) lo = m; else hi = m; } return (lo + (v - nOf[lo]) / (nOf[hi] - nOf[lo])) / TBL; }
    var NOTE = [[E8, -1.7, 0.1], [Q, 1.9, -0.05], [BEAM, -1.85, 0.08], [S16, 1.75, -0.1], [Q, -1.6, 0.05], [BEAM, 1.85, -0.06], [E8, -1.75, 0.1]];
    return {
      stepped: false, focusT: 0.3,
      resize: build, unit: function () { return XW / NT; },
      update: function (dt, t, idle) {
        var flow = reduce ? 0 : (drag ? 0 : (0.06 + (listening ? 0.03 * tempo + level * 0.06 : 0)) * (idle > 1.2 ? 1 : 0.15));
        if (!drag) { cam += (flow + vel) * dt; vel *= Math.pow(0.08, dt); }
        var breath = 0.5 + 0.5 * Math.sin(t * tempo * 1.3);
        amp += ((reduce ? 0.06 : listening ? 0.04 + level * (small ? 0.16 : 0.2) + pulse * 0.025 : (0.06 + 0.03 * breath) * calm) - amp) * 0.05;
        phase += reduce ? 0 : dt * (0.35 + 0.45 * tempo) * (listening ? 0.8 + level * 2 : calm); k2 = 1.6 + (listening ? Math.sin(t * 0.21) * 0.25 : 0);
      },
      layout: function (items) {
        var base = Math.floor(cam), frac = cam - base;
        for (var k = -1; k <= Math.ceil(NT) + 1; k++) {
          var v = k - frac; if (v < -1.2 || v > NT + 0.2) continue;
          var t0 = tOf(v), t1 = tOf(v + 1), x0 = X(t0), x1 = X(t0) + (X(t1) - X(t0)) / 1.15, xc = (x0 + x1) / 2, a = Math.max(0, Math.min(1, (xc - W * 0.1) / (W * 0.08)));
          if (x1 < -20 || x0 > W + 20) continue;
          (function (x0, x1) {
            items.push({ w: WORKS[wi(base + k)], k: base + k, t: T(xc), x0: x0, x1: x1, alpha: a, depth: -ph(T(xc)),
              fn: function (u, vv) { return P(x0 + (x1 - x0) * u, vv * 2 - 1); },
              light: function (u, vv) { var tt = T(x0 + (x1 - x0) * u); return 0.9 + 0.14 * Math.tanh(-slope(tt) * 2.4) - 0.06 * vv; }, nu: 18, nv: 4 });
          })(x0, x1);
        }
        var best = null; items.forEach(function (it) { if (it.alpha > 0.5 && (!best || Math.abs(it.t - 0.3) < Math.abs(best.t - 0.3))) best = it; }); if (best) best.focus = true;
        items.sort(function (a, b) { return a.depth - b.depth; });
      },
      back: function (items) {
        bgFill(0.35, 0.47);
        items.forEach(function (it) { var c = it.fn(0.5, 0.5); softGlow(bx, c[0], c[1], ph(it.t) * 1.1, it.focus ? '217,180,120' : it.w.rgb.join(','), (it.focus ? 0.4 + level * 0.4 : 0.26) * it.alpha); });
        for (var i = 0; i < 5; i++) { var pts = []; for (var x = W * 0.02; x <= W + 30; x += 10) pts.push(P(x, (i - 2) / 2 * 1.16)); glowPath(bx, pts, small ? 1.2 : 1.7, 0.9); }
        items.forEach(function (it) { if (it.alpha > 0.05) shadowPoly(bx, outline(it.fn, 6), small ? 16 : 26, small ? 10 : 18, 0.5 * it.alpha); });
      },
      front: function (items) {
        items.forEach(function (it) { glowPath(fx, outline(it.fn, 10), it.focus ? 2 : 1.1, (it.focus ? 0.9 + pulse * 0.3 : 0.5) * it.alpha); });
        var tt = performance.now() * 0.001;
        items.forEach(function (it) { var gx = it.x1 + (it.x1 - it.x0) * 0.075; if (gx < W * 0.16 || gx > W - 10) return; var n = NOTE[wi(it.k) % NOTE.length], p = P(gx, n[1] + Math.sin(tt * 1.2 + it.k) * 0.08);
          glyph(n[0], p[0], p[1], ph(T(gx)) * 0.42 * (1 + pulse * 0.1), Math.atan(slope(T(gx))) * 0.6 + n[2], 1 + level); });
        var cx = W * 0.07, ct = T(cx); clef(cx, cy(ct) - ph(ct) * 0.8, ph(ct) * 1.5, 0.03);
      }
    };
  })();

  /* --- hung on the staff: posters clipped to the top line, swinging as it carries them --- */
  scenes.hung = (function () {
    var phase = 0, amp = 0.04, state = {}, sp = 1, hh = 1, prevCam = 0, accel = 0;
    function top(x) { var t = x / W, A = small ? Math.min(H, W * 0.7) : H; return H * (small ? 0.34 : 0.3) + A * amp * Math.sin(t * Math.PI * (small ? 1.4 : 2.2) + phase) + A * amp * 0.3 * Math.sin(t * Math.PI * 5 - phase * 1.4) - A * 0.02 * t - specAt(t) * A * 0.06; }
    function gap() { return Math.min(H * 0.032, W * 0.03); }
    return {
      stepped: false,
      resize: function () { hh = small ? Math.min(H * 0.38, W * 0.55) : H * 0.44; sp = hh / 1.5 + (small ? 34 : 60); },
      unit: function () { return sp; },
      update: function (dt, t, idle) {
        var flow = reduce ? 0 : (drag ? 0 : (0.07 + (listening ? 0.03 * tempo + level * 0.06 : 0)) * (idle > 1.2 ? 1 : 0.15));
        if (!drag) { cam += (flow + vel) * dt; vel *= Math.pow(0.08, dt); }
        var v = (cam - prevCam) / Math.max(dt, 0.001); accel += ((v - (this.v || 0)) / Math.max(dt, 0.001) - accel) * 0.3; this.v = v; prevCam = cam;
        amp += ((reduce ? 0.03 : listening ? 0.02 + level * 0.09 + pulse * 0.012 : 0.03 + 0.012 * Math.sin(t * tempo)) - amp) * 0.05;
        phase += reduce ? 0 : dt * (0.4 + 0.4 * tempo) * (listening ? 0.8 + level * 2 : calm);
        // pendulums: the line's pull swings each poster, the beat nudges it
        Object.keys(state).forEach(function (k) { var s = state[k]; if (s.seen < frameNo - 1) { delete state[k]; return; }
          var drive = -accel * 0.0009 * sp / 300 + (listening ? pulse * 0.9 * Math.sin(k * 7.1 + t) : 0);
          s.w += (-14 * s.th - 1.6 * s.w + drive * 10) * dt; s.th += s.w * dt; s.th = Math.max(-0.35, Math.min(0.35, s.th)); });
      },
      layout: function (items) {
        var x0 = W * (small ? 0.62 : 0.3), base = Math.floor(cam);
        for (var k = base - 3; k <= base + Math.ceil(W / sp) + 3; k++) {
          var px = x0 + (k - cam) * sp; if (px < -sp || px > W + sp) continue;
          var s = state[k] || (state[k] = { th: 0, w: 0, yaw: Math.sin(k * 2.3) * 0.12 }); s.seen = frameNo;
          var roll = Math.atan((top(px + 3) - top(px - 3)) / 6) * 0.5 + s.th, yaw = 0.14 * Math.sin(performance.now() * 0.0005 * (1 + level) + k * 1.7) + s.th * 0.4;
          var a = Math.max(0, Math.min(1, (px - W * 0.16) / (W * 0.08)));
          (function (px, roll, yaw) {
            var py = top(px), w = hh / 1.5, cs = Math.cos(yaw), sn = Math.sin(yaw), fz = 2400, clip = H * 0.03, cr = Math.cos(roll), sr = Math.sin(roll);
            items.push({ w: WORKS[wi(k)], k: k, px: px, py: py, roll: roll, alpha: a, depth: 0,
              fn: function (u, v) { var X = (u - 0.5) * w * cs, Z = (u - 0.5) * w * sn, sc = fz / (fz + Z), Y = clip + v * hh, xx = X * sc, yy = Y * (0.96 + 0.04 * sc); return [px + xx * cr - yy * sr, py + xx * sr + yy * cr]; },
              light: function (u) { return 0.97 - 0.7 * (u - 0.5) * Math.sin(yaw); }, nu: 6, nv: 6 });
          })(px, roll, yaw);
        }
        var fx0 = W * (small ? 0.62 : 0.55), best = null; items.forEach(function (it) { if (!best || Math.abs(it.px - fx0) < Math.abs(best.px - fx0)) best = it; }); if (best) best.focus = true;
      },
      back: function (items) {
        bgFill(0.45, 0.42);
        for (var i = 0; i < 5; i++) { var pts = []; for (var x = W * 0.03; x <= W + 30; x += 10) pts.push([x, top(x) + i * gap()]); glowPath(bx, pts, small ? 1.2 : 1.7, 0.9); }
        items.forEach(function (it) { var c = it.fn(0.5, 0.5); softGlow(bx, c[0], c[1], hh * 0.9, it.focus ? '217,180,120' : it.w.rgb.join(','), (it.focus ? 0.38 + level * 0.4 : 0.24) * it.alpha);
          if (it.alpha > 0.05) shadowPoly(bx, outline(it.fn, 4), 30, 26, 0.55 * it.alpha); });
      },
      front: function (items) {
        items.forEach(function (it) {
          glowPath(fx, outline(it.fn, 6), it.focus ? 1.8 : 1, (it.focus ? 0.85 + pulse * 0.3 : 0.45) * it.alpha);
          var c = fx; c.save(); c.globalAlpha = it.alpha; c.translate(it.px, it.py); c.rotate(it.roll);
          c.strokeStyle = metal(c, -12, 12); c.lineWidth = small ? 3 : 4; c.beginPath(); c.arc(0, -2, small ? 8 : 11, 0, 7); c.stroke();
          c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 10; c.shadowOffsetY = 4; c.fillStyle = metal(c, 6, 60); c.beginPath();
          if (c.roundRect) c.roundRect(-19, 8, 38, 50, 6); else c.rect(-19, 8, 38, 50); c.fill();
          c.shadowColor = 'transparent'; c.fillStyle = 'rgba(40,32,20,.5)'; c.fillRect(-13, 30, 26, 3); c.restore();
        });
        var cx = W * (small ? 0.08 : 0.1); clef(cx, top(cx) - H * 0.13, small ? gap() * 4 * 2.6 : H * 0.42, 0.03);
        var tt = performance.now() * 0.001;
        [[0.2, -2.2, BEAM, 0.09], [0.47, -2.8, Q, 0.07], [0.74, -2.5, E8, 0.07], [0.95, -1.9, BEAM, 0.08]].forEach(function (n, i) {
          var x = W * n[0]; glyph(n[2], x, top(x) + n[1] * gap() + Math.sin(tt * 1.1 + i) * 8, H * n[3] * (small ? 0.9 : 1.3) * (1 + pulse * 0.1), 0.06 + Math.sin(tt * 0.8 + i) * 0.05, 1 + level); });
      }
    };
  })();

  var scene = scenes[SCENE] || scenes.wave;

  /* ---------- frame ---------- */
  var last = performance.now(), focus = 0, shown = -1, tempo = 1, calm = 1, frameNo = 0, autoT = 0;
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000 || 0.016), t = now * 0.001, idle = (now - lastInput) / 1000; last = now; frameNo++;
    listenFrame(); eq += ((listening ? 1 : 0) - eq) * 0.05; calm += ((listening ? 1 : idle > 10 ? 0.55 : 1) - calm) * 0.02;
    tempo += ((WORKS[focus].tempo || 1) - tempo) * 0.02;
    if (scene.stepped) {                                   // glide one work at a time, a phrase per work
      if (!drag) { autoT += dt; if (!reduce && idle > 3 && autoT > (listening ? 7 : 5.5)) { target = Math.round(target) + 1; autoT = 0; } cam += (target - cam) * Math.min(1, dt * (reduce ? 20 : 3.2)); }
      else autoT = 0;
    }
    scene.update(dt, t, idle);
    var items = []; scene.layout(items);
    var fit = null; items.forEach(function (it) { if (it.focus) fit = it; });
    if (fit) { focus = wi(fit.k); if (focus !== shown) onFocus(); }
    bx.setTransform(DPR, 0, 0, DPR, 0, 0); fx.setTransform(DPR, 0, 0, DPR, 0, 0); fx.clearRect(0, 0, W, H);
    var fade = 1 - (opening ? opening.t : 0);
    scene.back(items);
    hits = [];
    items.forEach(function (it) { if (it.alpha <= 0.01) return; mesh(it.fn, it.w.tex, it.light, it.nu, it.nv, it.alpha * fade); hits.push({ w: it.w, pts: outline(it.fn, 4) }); });
    flushGL();
    scene.front(items);
    fx.fillStyle = grainPat; fx.fillRect(0, 0, W, H);
    var vg = fx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); fx.fillStyle = vg; fx.fillRect(0, 0, W, H);
    var hov = mouse.in && !drag ? hit(mouse.x, mouse.y) : null;
    ui.meter.style.setProperty('--lv', (listening ? level * 2.2 : 0.18 * calm).toFixed(3)); ui.meter.style.setProperty('--pulse', pulse.toFixed(3));
    root.classList.toggle('is-scrolled', listening || idle < 30 && lastInput > 0);
    front.style.cursor = hov ? 'pointer' : (drag ? 'grabbing' : 'grab');
    if (opening) { opening.t = Math.min(1, opening.t + dt / 0.75); ui.cut.style.opacity = opening.t; if (opening.t >= 1) { location.href = opening.w.href; return; } }
    requestAnimationFrame(frame);
  }
  function onFocus() {
    shown = focus; var w = WORKS[focus];
    ui.title.textContent = w.t; ui.mood.textContent = w.moodLabel || w.cl;
    ui.cap.classList.remove('is-on');
    setTimeout(function () { ui.capT.textContent = w.t; ui.capM.textContent = [w.cl, w.y, w.cr].filter(Boolean).join(' · '); ui.cap.classList.add('is-on'); }, 300);
    if (listening && w.track && TRACKS.indexOf(w) !== playing) fadeTo(w);
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted && opening) { opening = null; ui.cut.style.opacity = 0; last = performance.now(); requestAnimationFrame(frame); } });
  resize(); front.focus({ preventScroll: true }); requestAnimationFrame(frame);
})();
