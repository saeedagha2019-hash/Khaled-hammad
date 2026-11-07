/* Works — WebGL presentation views.
   "reel"   (default): a vertical, endlessly looping column of large cinematic cards. Scrolling is smooth
                       and inertial; speed bends the cards and splits colour, with grain and vignette.
   "canvas"          : an infinite draggable field of posters with depth parallax.
   Raw WebGL, no library. The accessible list stays in the DOM: no-WebGL, reduced-motion and keyboard
   users can always use it. */
(function () {
  'use strict';
  var root = document.querySelector('[data-wc]');
  if (!root) return;
  var doc = document, html = doc.documentElement, body = doc.body;
  var rtl = html.dir === 'rtl';
  var canvas = root.querySelector('[data-wc-canvas]');
  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  var toggles = [].slice.call(doc.querySelectorAll('[data-view]'));
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!gl) { toggles.forEach(function (b) { if (b.dataset.view !== 'list') b.hidden = true; }); doc.querySelectorAll('.view-toggle').forEach(function (v) { v.hidden = true; }); return; }

  var RAW = JSON.parse(root.querySelector('[data-wc-data]').textContent);
  var DATA = (function (d) {   // featured works first, then spread works that have posters evenly
    var feat = d.filter(function (x) { return x.f; }).sort(function (a, b) { return a.f - b.f; });
    d = d.filter(function (x) { return !x.f; });
    var withP = d.filter(function (x) { return x.i; }), rest = d.filter(function (x) { return !x.i; }), out = [];
    var step = withP.length ? Math.max(1, Math.round(d.length / withP.length)) : 1;
    while (withP.length || rest.length) { for (var k = 0; k < step - 1 && rest.length; k++) out.push(rest.shift()); if (withP.length) out.push(withP.shift()); else if (rest.length) out.push(rest.shift()); }
    return feat.concat(out);
  })(RAW.slice());
  var label = root.querySelector('[data-wc-label]'), cursor = root.querySelector('[data-wc-cursor]');
  var lCat = label.querySelector('.wcl-cat'), lTitle = label.querySelector('.wcl-title'), lMeta = label.querySelector('.wcl-meta');
  var COL = { bg: [0.067, 0.09, 0.098], teal: '#142B2A', teal2: '#1B3836', char: '#111719', bronze: '#B39A70', ivory: '#F2EDE3', dim: '#C9CFCB' };
  var F = rtl ? { disp: 'Amiri', sans: '"IBM Plex Sans Arabic"' } : { disp: '"Cormorant Garamond"', sans: 'Inter' };

  /* ---------- views ---------- */
  var params = new URLSearchParams(location.search);
  var view = params.get('view') || (reduce ? 'list' : 'reel');
  var mode = view === 'canvas' ? 'canvas' : 'reel';
  var running = false;
  function setView(v, push) {
    view = v;
    var gfx = v === 'reel' || v === 'canvas';
    body.classList.toggle('wc-mode', gfx);
    root.hidden = !gfx; root.dataset.mode = v;
    toggles.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === v ? 'true' : 'false'); });
    if (push) { var p = new URLSearchParams(location.search); if (v === 'reel') p.delete('view'); else p.set('view', v); history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '')); }
    if (gfx) {
      if (mode !== v) { mode = v; cam.x = cam.y = tgt.x = tgt.y = prev.x = prev.y = 0; appearT = 0; }
      resize();
      if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      canvas.focus({ preventScroll: true }); window.scrollTo(0, 0);
    } else running = false;
  }
  toggles.forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.view, true); }); });

  /* ---------- GL ---------- */
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; }
  function prog(vs, fs) { var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p; }
  function buf(arr) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); return b; }
  var quad = buf([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
  var SX = 28, SY = 14, meshArr = [];            // subdivided card mesh so cards can bend
  for (var gy = 0; gy < SY; gy++) for (var gx = 0; gx < SX; gx++) {
    var x0 = gx / SX, x1 = (gx + 1) / SX, y0 = gy / SY, y1 = (gy + 1) / SY;
    meshArr.push(x0, y0, x1, y0, x0, y1, x0, y1, x1, y0, x1, y1);
  }
  var mesh = buf(meshArr), meshN = meshArr.length / 2;

  var itemProg = prog(
    'attribute vec2 aP;uniform vec4 uRect;uniform vec2 uRes;uniform float uBend;varying vec2 vUv;' +
    'void main(){vUv=aP;vec2 p=uRect.xy+aP*uRect.zw;vec2 n=vec2(p.x/uRes.x*2.-1.,1.-p.y/uRes.y*2.);' +
    'n.y+=uBend*.11*(1.-n.x*n.x);' +                         /* scroll speed curves the card like film in a gate */
    'n.x*=1.-abs(uBend)*.05*(1.-n.y*n.y);' +
    'gl_Position=vec4(n,0.,1.);}',
    'precision mediump float;uniform sampler2D uTex;uniform float uAlpha;uniform float uDim;uniform float uLift;varying vec2 vUv;' +
    'void main(){vec4 c=texture2D(uTex,vUv);float g=dot(c.rgb,vec3(.299,.587,.114));' +
    'c.rgb=mix(c.rgb,vec3(g)*vec3(.82,.9,.88),uDim*.7)*(1.-uDim*.45);c.rgb+=uLift*.035;' +
    'gl_FragColor=vec4(mix(vec3(.067,.09,.098),c.rgb,uAlpha),1.);}');
  var postProg = prog(
    'attribute vec2 aP;varying vec2 vUv;void main(){vUv=aP;gl_Position=vec4(aP*2.-1.,0.,1.);}',
    'precision mediump float;uniform sampler2D uTex;uniform vec2 uRes;uniform vec2 uMouse;uniform vec2 uMVel;uniform float uSpeed;uniform float uTime;uniform float uLens;uniform float uBase;varying vec2 vUv;' +
    'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}' +
    'void main(){vec2 c=vUv-.5;float asp=uRes.x/uRes.y;float r2=dot(c*vec2(asp,1.),c*vec2(asp,1.));' +
    'float k=uBase+.24*uSpeed;vec2 uv=.5+c*(1.-k*r2);' +                                        /* barrel bend */
    'vec2 d=(uv-uMouse)*vec2(asp,1.);float m=exp(-dot(d,d)*14.)*uLens;uv-=d/vec2(asp,1.)*m*.05;' + /* cursor lens */
    'uv-=uMVel*exp(-dot(d,d)*9.)*.6;' +                                                          /* trail smear */
    'vec2 off=c*(.0015+.026*uSpeed);' +                                                          /* chromatic split */
    'vec3 col=vec3(texture2D(uTex,uv+off).r,texture2D(uTex,uv).g,texture2D(uTex,uv-off).b);' +
    'if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)col=vec3(.067,.09,.098);' +
    'float vig=smoothstep(1.05,.25,length(c*vec2(1.,1.15)));col*=mix(.45,1.,vig);' +
    'col+=(h(vUv*uRes+uTime)-.5)*.05;gl_FragColor=vec4(col,1.);}');            /* film grain */
  function attr(p, b) { var l = gl.getAttribLocation(p, 'aP'); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); }
  var U = {}; ['uRect', 'uRes', 'uTex', 'uAlpha', 'uDim', 'uLift', 'uBend'].forEach(function (n) { U['i' + n] = gl.getUniformLocation(itemProg, n); });
  ['uTex', 'uRes', 'uMouse', 'uMVel', 'uSpeed', 'uTime', 'uLens', 'uBase'].forEach(function (n) { U['p' + n] = gl.getUniformLocation(postProg, n); });
  function newTex(src) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    return t;
  }
  function upload(t, src) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }
  var fbo = gl.createFramebuffer(), fboTex = newTex(null);

  /* ---------- card artwork (drawn in the site's palette and fonts) ---------- */
  function mk(w, h) { var c = doc.createElement('canvas'); c.width = w; c.height = h; return c; }
  function wrapText(ctx, text, maxW, maxL) {
    var words = text.split(/\s+/), lines = [], line = '';
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line); return lines.slice(0, maxL || 5);
  }
  function setDir(x) { x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; }
  // portrait card for the free canvas
  var PW = 400, PH = 600;
  function portrait(it, im) {
    var c = mk(PW, PH), x = c.getContext('2d');
    if (im) { var s = Math.max(PW / im.width, PH / im.height); x.drawImage(im, (PW - im.width * s) / 2, (PH - im.height * s) / 2, im.width * s, im.height * s); return c; }
    var g = x.createLinearGradient(0, 0, PW * .6, PH); g.addColorStop(0, COL.teal2); g.addColorStop(1, COL.char); x.fillStyle = g; x.fillRect(0, 0, PW, PH);
    x.strokeStyle = 'rgba(179,154,112,.45)'; x.lineWidth = 2; x.strokeRect(18, 18, PW - 36, PH - 36);
    var pad = 44, sx = rtl ? PW - pad : pad; setDir(x);
    x.fillStyle = COL.bronze; x.font = '500 ' + (rtl ? 22 : 17) + 'px ' + F.sans; x.fillText(rtl ? it.cl : it.cl.toUpperCase(), sx, 72);
    x.fillStyle = COL.ivory; var fs = rtl ? 44 : 45; x.font = '400 ' + fs + 'px ' + F.disp;
    var lines = wrapText(x, it.t, PW - pad * 2), lh = fs * (rtl ? 1.45 : 1.08), y0 = PH - 100 - (lines.length - 1) * lh;
    lines.forEach(function (l, i) { x.fillText(l, sx, y0 + i * lh); });
    x.fillStyle = 'rgba(201,207,203,.85)'; x.font = '400 20px Inter'; x.fillText(it.y ? String(it.y) : '—', sx, PH - 52);
    return c;
  }
  // wide cinematic card for the reel: image frame + caption, all one texture so the caption bends with it
  var RW = 900, RI = 540, RC = 171, RH = RI + RC;
  function reelCard(it, im) {
    var c = mk(RW, RH), x = c.getContext('2d');
    x.fillStyle = COL.char; x.fillRect(0, 0, RW, RH);
    if (im) {
      x.save(); x.beginPath(); x.rect(0, 0, RW, RI); x.clip();
      var bs = Math.max(RW / im.width, RI / im.height), bw = im.width * bs, bh = im.height * bs;
      if ('filter' in x) { x.filter = 'blur(28px) saturate(.9)'; x.drawImage(im, (RW - bw) / 2 - 40, (RI - bh) / 2 - 40, bw + 80, bh + 80); x.filter = 'none'; }
      else {   // Safari: blur by shrinking then enlarging in steps
        var src = im, sw = 48, shh = 28;
        [[48, 28], [144, 86], [432, 260]].forEach(function (z, k) { var t = mk(z[0], z[1]), tx = t.getContext('2d'); tx.imageSmoothingEnabled = true;
          if (k === 0) { var q = Math.max(z[0] / im.width, z[1] / im.height); tx.drawImage(im, (z[0] - im.width * q) / 2, (z[1] - im.height * q) / 2, im.width * q, im.height * q); }
          else tx.drawImage(src, 0, 0, z[0], z[1]); src = t; });
        x.imageSmoothingEnabled = true; x.drawImage(src, 0, 0, RW, RI);
      }
      x.fillStyle = 'rgba(17,23,25,.45)'; x.fillRect(0, 0, RW, RI);
      var ph = RI * 0.86, pw = ph * im.width / im.height, px = (RW - pw) / 2, py = (RI - ph) / 2;
      x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 40; x.shadowOffsetY = 14; x.drawImage(im, px, py, pw, ph); x.shadowColor = 'transparent';
      x.restore();
    } else {
      var g = x.createLinearGradient(0, 0, RW, RI); g.addColorStop(0, COL.teal2); g.addColorStop(1, '#0E1415'); x.fillStyle = g; x.fillRect(0, 0, RW, RI);
      x.strokeStyle = 'rgba(179,154,112,.4)'; x.lineWidth = 2; x.strokeRect(22, 22, RW - 44, RI - 44);
      x.textAlign = 'center'; x.direction = rtl ? 'rtl' : 'ltr';
      x.fillStyle = COL.bronze; x.font = '500 ' + (rtl ? 28 : 22) + 'px ' + F.sans; x.fillText(rtl ? it.cl : it.cl.toUpperCase(), RW / 2, 92);
      x.fillStyle = COL.ivory; var fs = rtl ? 76 : 80; x.font = '400 ' + fs + 'px ' + F.disp;
      var lines = wrapText(x, it.t, RW - 180, 3), lh = fs * (rtl ? 1.4 : 1.05), y0 = RI / 2 + fs * .35 - (lines.length - 1) * lh / 2;
      lines.forEach(function (l, i) { x.fillText(l, RW / 2, y0 + i * lh); });
      x.fillStyle = 'rgba(201,207,203,.8)'; x.font = '400 26px Inter'; x.fillText(it.y ? String(it.y) : '—', RW / 2, RI - 64);
    }
    // caption
    var pad = 6, sx = rtl ? RW - pad : pad; setDir(x);
    x.fillStyle = COL.ivory; x.font = (rtl ? '700 42px ' : '500 45px ') + F.disp;
    var tl = wrapText(x, it.t, RW - 120, 1)[0]; x.fillText(tl, sx, RI + 58);
    x.fillStyle = COL.dim; x.font = '400 ' + (rtl ? 25 : 23) + 'px ' + F.sans; x.fillText([it.cl, it.y, it.cr].filter(Boolean).join(' · '), sx, RI + 101);
    x.fillStyle = 'rgba(242,237,227,.28)'; x.fillRect(0, RI + 135, RW, 2);
    var ax = rtl ? 22 : RW - 22, ay = RI + 88, dir = rtl ? 1 : -1;                     // ↘ (or ↙ in Arabic)
    x.strokeStyle = COL.bronze; x.lineWidth = 3; x.lineCap = 'round'; x.beginPath();
    x.moveTo(ax + dir * 26, ay - 26); x.lineTo(ax, ay); x.moveTo(ax, ay); x.lineTo(ax + dir * 18, ay); x.moveTo(ax, ay); x.lineTo(ax, ay - 18); x.stroke();
    return c;
  }
  var fontsReady = (doc.fonts && doc.fonts.load) ? Promise.all(['400 54px "Cormorant Garamond"', '500 50px "Cormorant Garamond"', '400 52px Amiri', '700 46px Amiri', '500 20px Inter', '500 26px "IBM Plex Sans Arabic"', '400 26px "IBM Plex Sans Arabic"'].map(function (f) { return doc.fonts.load(f).catch(function () {}); })) : Promise.resolve();
  fontsReady = Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 1200); })]);
  /* textures are made only for cards on screen and released when unused (keeps phone GPU memory low) */
  var ready = false, frameNo = 0, budget = 0, liveTex = [], MAXT = { r: 18, p: 54 };
  fontsReady.then(function () { ready = true; });
  function tex_(it, kind) {
    var key = kind === 'r' ? 'texR' : 'tex';
    if (it[key]) { it[key + 'U'] = frameNo; return it[key]; }
    if (!ready || budget <= 0) return null;
    budget--;
    it[key] = newTex(kind === 'r' ? reelCard(it, it.img) : portrait(it, it.img)); it[key + 'U'] = frameNo; liveTex.push([it, key]);
    if (it.i && !it.img && !it.loading) {
      it.loading = true; var im = new Image(); im.decoding = 'async';
      im.onload = function () { it.img = im; if (it.tex) upload(it.tex, portrait(it, im)); if (it.texR) upload(it.texR, reelCard(it, im)); };
      im.src = it.i;
    }
    var max = MAXT[kind === 'r' ? 'r' : 'p'], mine = liveTex.filter(function (e) { return e[1] === key; });
    if (mine.length > max) {
      mine.sort(function (a, b) { return a[0][key + 'U'] - b[0][key + 'U']; });
      mine.slice(0, mine.length - max).forEach(function (e) { if (e[0][key + 'U'] < frameNo - 2) { gl.deleteTexture(e[0][key]); e[0][key] = null; liveTex.splice(liveTex.indexOf(e), 1); } });
    }
    return it[key];
  }

  /* ---------- layout ---------- */
  var W = 0, H = 0, DPR = 1, cells = [], SW = 0, SH = 0, cw = 0, chh = 0, items = DATA, step = 0, reelTop = 0;
  function rand(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function layout() {
    cells = [];
    var n = items.length || 1;
    if (mode === 'reel') {
      cw = W < 700 ? W - 32 : Math.min(W * 0.56, 820); chh = cw * RH / RW;
      step = chh + Math.max(36, cw * 0.09);
      var reps = Math.max(1, Math.ceil((H * 2.2) / (n * step)));            // repeat short lists so the loop never shows a gap
      for (var r = 0; r < reps; r++) for (var i = 0; i < n; i++) cells.push({ it: items[i], by: (r * n + i) * step, d: 1, hov: 0, rects: [], delay: Math.min(i, 6) * 0.08 });
      SH = cells.length * step; SW = W; reelTop = W < 700 ? 150 : 170;
      return;
    }
    var side = Math.max(5, Math.round(Math.sqrt(2 * n)));
    cw = Math.max(128, Math.min(232, W * 0.145)); chh = cw * 1.5;
    var sx = cw * 1.58, sy = chh * 1.24; SW = side * sx; SH = side * sy;
    for (var rr = 0; rr < side; rr++) for (var c = 0; c < side; c++) {
      var ii = rr * side + c, k = (c + rr * (n > 12 ? 7 : 2)) % n;
      cells.push({ it: items[k], bx: c * sx + (rand(ii + 7) - .5) * sx * .45, by: rr * sy + (rand(ii + 13) - .5) * sy * .35, d: 0.78 + rand(ii) * 0.4,
        hov: 0, rects: [], delay: rand(ii + 21) * 0.5 });
    }
    cells.sort(function (a, b) { return a.d - b.d; });
  }
  function resize() {
    var r = canvas.getBoundingClientRect(); DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    gl.bindTexture(gl.TEXTURE_2D, fboTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    layout();
  }
  window.addEventListener('resize', function () { if (!root.hidden) resize(); });

  /* ---------- input ---------- */
  var cam = { x: 0, y: 0 }, tgt = { x: 0, y: 0 }, prev = { x: 0, y: 0 }, speed = 0, vy = 0;
  var mouse = { x: -1, y: -1, px: -1, py: -1, vx: 0, vy: 0, in: false }, lens = 0;
  var drag = null, hovered = null, opening = null, appearT = 0, fade = 1, fadeTo = 1, pendingItems = null;
  canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: 0, vx: 0, vy: 0, t: performance.now() }; root.classList.add('is-dragging'); });
  canvas.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.in = e.pointerType === 'mouse' || !!drag;
    if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y, now = performance.now(), dt = Math.max(1, now - drag.t);
      var gain = mode === 'reel' ? 1 : 1.15;
      if (mode !== 'reel') tgt.x -= dx * gain;
      tgt.y -= dy * gain; drag.vx = dx / dt; drag.vy = dy / dt; drag.t = now;
      drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    }
  });
  canvas.addEventListener('pointerleave', function () { mouse.in = false; });
  function endDrag(e) {
    if (!drag) return; var d = drag, click = d.moved < 6; drag = null; root.classList.remove('is-dragging');
    if (!click && !reduce) { tgt.y -= d.vy * 260; if (mode !== 'reel') tgt.x -= d.vx * 260; }  // fling
    if (click && e.type === 'pointerup') { var r = canvas.getBoundingClientRect(); var h = hit(e.clientX - r.left, e.clientY - r.top); if (h) open(h); }
    if (e.pointerType !== 'mouse') mouse.in = false;
  }
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault(); var f = e.deltaMode === 1 ? 32 : 1;
    if (mode === 'reel') tgt.y += (e.deltaY + e.deltaX) * f;
    else { tgt.x += (e.shiftKey ? e.deltaY : e.deltaX) * f; tgt.y += (e.shiftKey ? 0 : e.deltaY) * f; }
  }, { passive: false });
  canvas.addEventListener('keydown', function (e) {
    var k = e.key, s = mode === 'reel' ? step : 160;
    if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) tgt.y += s;
    else if (k === 'ArrowUp' || k === 'PageUp') tgt.y -= s;
    else if (mode !== 'reel' && k === 'ArrowLeft') tgt.x -= s; else if (mode !== 'reel' && k === 'ArrowRight') tgt.x += s;
    else if (k === 'Enter') { var h = nearestCenter(); if (h) open(h); } else return;
    e.preventDefault();
  });
  function hit(x, y) {
    for (var i = cells.length - 1; i >= 0; i--) { var rs = cells[i].rects;
      for (var j = 0; j < rs.length; j++) { var r = rs[j]; if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return { c: cells[i], r: r }; } }
    return null;
  }
  function nearestCenter() { var best = null, bd = 1e9, cy = mode === 'reel' ? reelTop + chh / 2 : H / 2; cells.forEach(function (c) { c.rects.forEach(function (r) { var dx = r[0] + r[2] / 2 - W / 2, dy = r[1] + r[3] / 2 - cy, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = { c: c, r: r }; } }); }); return best; }
  function open(h) {
    if (opening) return;
    if (reduce) { location.href = h.c.it.h; return; }
    opening = { c: h.c, t: 0, from: h.r.slice() }; root.classList.add('is-opening'); showLabel(null);
  }
  function showLabel(c) {
    if (c && mode === 'canvas') { lCat.textContent = c.it.cl; lTitle.textContent = c.it.t; lMeta.textContent = [c.it.y, c.it.cr].filter(Boolean).join(' · '); }
    label.classList.toggle('is-on', !!c && mode === 'canvas'); cursor.classList.toggle('is-hover', !!c);
  }

  /* filter dropdown */
  var live = root.querySelector('[data-wc-live]'), fBtn = root.querySelector('[data-wc-filter-btn]'), fMenu = root.querySelector('[data-wc-filter-menu]'), fCur = root.querySelector('[data-wc-filter-cur]');
  function menu(open) { fMenu.hidden = !open; fBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); if (open) { var a = fMenu.querySelector('[aria-pressed="true"]'); if (a) a.focus(); } }
  fBtn.addEventListener('click', function (e) { e.stopPropagation(); menu(fMenu.hidden); });
  doc.addEventListener('click', function (e) { if (!fMenu.hidden && !fMenu.contains(e.target)) menu(false); });
  fMenu.addEventListener('keydown', function (e) { if (e.key === 'Escape') { menu(false); fBtn.focus(); } });
  var chips = [].slice.call(root.querySelectorAll('[data-wc-cat]'));
  chips.forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.wcCat;
      chips.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      pendingItems = k === 'all' ? DATA : DATA.filter(function (it) { return it.c === k; });
      fadeTo = 0; fCur.textContent = b.dataset.label; if (live) live.textContent = b.textContent.trim(); menu(false); canvas.focus({ preventScroll: true });
    });
  });

  /* ---------- render ---------- */
  var last = 0;
  function wrapC(v, S) { return ((v % S) + S) % S - S / 2; }
  function frame(now) {
    if (!running) return;
    frameNo++; budget = 3;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    var ease = reduce ? 1 : 1 - Math.pow(mode === 'reel' ? 0.004 : 0.0009, dt);
    cam.x += (tgt.x - cam.x) * ease; cam.y += (tgt.y - cam.y) * ease;
    var dy = (cam.y - prev.y) / (dt * 60), v = Math.hypot(cam.x - prev.x, cam.y - prev.y) / (dt * 60); prev.x = cam.x; prev.y = cam.y;
    speed += (Math.min(1, v / (mode === 'reel' ? 45 : 55)) - speed) * 0.12;
    vy += (Math.max(-1, Math.min(1, dy / 40)) - vy) * 0.12;
    if (reduce) { speed = 0; vy = 0; }
    if (mouse.px >= 0) { mouse.vx += ((mouse.x - mouse.px) / W - mouse.vx) * 0.2; mouse.vy += ((mouse.y - mouse.py) / H - mouse.vy) * 0.2; }
    mouse.px = mouse.x; mouse.py = mouse.y; mouse.vx *= 0.9; mouse.vy *= 0.9;
    lens += ((mouse.in && !drag ? 1 : 0) - lens) * 0.08;
    appearT = Math.min(1, appearT + dt / (reduce ? 0.01 : 1.1));
    fade += (fadeTo - fade) * (reduce ? 1 : 0.18);
    if (pendingItems && fade < 0.03) { items = pendingItems; pendingItems = null; layout(); cam.y = tgt.y = prev.y = 0; appearT = 0; fadeTo = 1; }

    var hh = (!drag && mouse.in && !opening) ? hit(mouse.x, mouse.y) : null, hov = hh ? hh.c : null;
    if (hov !== hovered) { hovered = hov; showLabel(hov); }
    cursor.style.transform = 'translate(' + mouse.x + 'px,' + mouse.y + 'px)';
    label.style.transform = 'translate(' + mouse.x + 'px,' + mouse.y + 'px)';
    cursor.classList.toggle('is-on', mouse.in);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(COL.bg[0], COL.bg[1], COL.bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(itemProg); attr(itemProg, mesh); gl.uniform2f(U.iuRes, W, H); gl.uniform1i(U.iuTex, 0); gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(U.iuBend, mode === 'reel' ? -vy : 0);
    var anyHover = hovered ? (mode === 'reel' ? 0.55 : 1) : 0, op = opening;
    if (op) op.t = Math.min(1, op.t + dt / 0.8);
    var ot = op ? (1 - Math.pow(1 - op.t, 3)) : 0;
    function draw(tex, r, alpha, dim, lift) {
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform4f(U.iuRect, r[0], r[1], r[2], r[3]);
      gl.uniform1f(U.iuAlpha, alpha); gl.uniform1f(U.iuDim, dim); gl.uniform1f(U.iuLift, lift); gl.drawArrays(gl.TRIANGLES, 0, meshN);
    }
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i]; c.rects = [];
      c.hov += ((c === hovered ? 1 : 0) - c.hov) * 0.15;
      var a = Math.max(0, Math.min(1, (appearT - c.delay * 0.6) / 0.5)), ae = 1 - Math.pow(1 - a, 3), tex, x, y, w, h;
      if (mode === 'reel') {
        tex = null;
        var s = 1 + 0.025 * c.hov; w = cw * s; h = chh * s;
        var rel = ((c.by - cam.y) % SH + SH) % SH;          // position within one loop, first card at the top
        if (rel > SH - step * 1.5) rel -= SH;
        x = (W - w) / 2; y = reelTop + rel + (1 - ae) * 80 - (h - chh) / 2;
        if (y > H + 40 || y + h < -40) continue;
        tex = tex || tex_(c.it, 'r'); if (!tex) continue;
        c.rects.push([x, y, w, h]);
        draw(tex, [x, y, w, h], ae * fade * (op ? 1 - ot : 1), anyHover * (1 - c.hov), c.hov);
        continue;
      }
      tex = null;
      var sc = c.d * (0.9 + 0.1 * ae) * (1 + 0.07 * c.hov); w = cw * sc; h = chh * sc;
      var px = wrapC(c.bx - cam.x * c.d, SW), py = wrapC(c.by - cam.y * c.d, SH);
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        x = W / 2 + px + ox * SW - w / 2; y = H / 2 + py + oy * SH - h / 2;
        if (x > W + 40 || y > H + 40 || x + w < -40 || y + h < -40) continue;
        tex = tex || tex_(c.it, 'p'); if (!tex) continue;
        c.rects.push([x, y, w, h]);
        draw(tex, [x, y, w, h], ae * fade * (op ? 1 - ot : 1), anyHover * (1 - c.hov), c.hov);
      }
    }
    if (op) {   // the chosen work grows to centre stage before its page opens
      var T, f = op.from, ot2 = ot;
      if (mode === 'reel') { var tw2 = Math.min(W, 1200), th2 = tw2 * RH / RW; T = [(W - tw2) / 2, (H - th2) / 2, tw2, th2]; }
      else { var th = H * 0.86, tw = th / 1.5; T = [(W - tw) / 2, (H - th) / 2, tw, th]; }
      var tx2 = tex_(op.c.it, mode === 'reel' ? 'r' : 'p');
      if (tx2) draw(tx2, [f[0] + (T[0] - f[0]) * ot2, f[1] + (T[1] - f[1]) * ot2, f[2] + (T[2] - f[2]) * ot2, f[3] + (T[3] - f[3]) * ot2], 1, 0, 1);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(postProg); attr(postProg, quad); gl.bindTexture(gl.TEXTURE_2D, fboTex);
    gl.uniform1i(U.puTex, 0); gl.uniform2f(U.puRes, W, H);
    gl.uniform2f(U.puMouse, mouse.x / W, 1 - mouse.y / H); gl.uniform2f(U.puMVel, reduce ? 0 : mouse.vx, reduce ? 0 : -mouse.vy);
    gl.uniform1f(U.puSpeed, speed + ot * 0.5); gl.uniform1f(U.puTime, now * 0.001 % 100); gl.uniform1f(U.puLens, reduce ? 0 : lens * (mode === 'reel' ? 0.6 : 1));
    gl.uniform1f(U.puBase, mode === 'reel' ? 0.07 : 0.035);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (op && op.t >= 1) { running = false; location.href = op.c.it.h; return; }
    requestAnimationFrame(frame);
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted && opening) { opening = null; root.classList.remove('is-opening'); if (!root.hidden) { running = true; last = performance.now(); requestAnimationFrame(frame); } } });

  setView(view, false);
})();
