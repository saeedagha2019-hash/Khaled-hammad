/* Works canvas — an infinite, draggable WebGL field of posters.
   Technique: wrapped grid with depth parallax, inertial drag/wheel, and a post-processing pass
   (speed-driven barrel bend, chromatic split, cursor lens, vignette, grain). Raw WebGL, no library.
   The accessible list stays in the DOM: no-WebGL, reduced-motion and keyboard users can always use it. */
(function () {
  'use strict';
  var root = document.querySelector('[data-wc]');
  if (!root) return;
  var doc = document, html = doc.documentElement, body = doc.body;
  var rtl = html.dir === 'rtl', lang = html.lang;
  var canvas = root.querySelector('[data-wc-canvas]');
  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  var toggles = [].slice.call(doc.querySelectorAll('[data-view]'));
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!gl) { toggles.forEach(function (b) { b.hidden = true; }); doc.querySelectorAll('.view-toggle').forEach(function (v) { v.hidden = true; }); return; }

  var DATA = (function (d) {   // spread the works that have posters evenly through the field
    var withP = d.filter(function (x) { return x.i; }), rest = d.filter(function (x) { return !x.i; }), out = [];
    var step = withP.length ? Math.max(1, Math.round(d.length / withP.length)) : 1;
    while (withP.length || rest.length) { for (var k = 0; k < step - 1 && rest.length; k++) out.push(rest.shift()); if (withP.length) out.push(withP.shift()); else if (rest.length) out.push(rest.shift()); }
    return out;
  })(JSON.parse(root.querySelector('[data-wc-data]').textContent));
  var label = root.querySelector('[data-wc-label]'), cursor = root.querySelector('[data-wc-cursor]');
  var lCat = label.querySelector('.wcl-cat'), lTitle = label.querySelector('.wcl-title'), lMeta = label.querySelector('.wcl-meta');
  var COL = { bg: [0.067, 0.09, 0.098], teal: '#142B2A', teal2: '#1B3836', char: '#111719', bronze: '#B39A70', ivory: '#F2EDE3' };

  /* ---------- view switching (canvas ⇄ list) ---------- */
  var params = new URLSearchParams(location.search);
  var view = params.get('view') || (reduce ? 'list' : 'canvas');
  var running = false;
  function setView(v, push) {
    view = v;
    body.classList.toggle('wc-mode', v === 'canvas');
    root.hidden = v !== 'canvas';
    toggles.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === v ? 'true' : 'false'); });
    if (push) { var p = new URLSearchParams(location.search); if (v === 'canvas') p.delete('view'); else p.set('view', v); history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '')); }
    if (v === 'canvas') { resize(); if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } canvas.focus({ preventScroll: true }); window.scrollTo(0, 0); }
    else running = false;
  }
  toggles.forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.view, true); }); });

  /* ---------- GL helpers ---------- */
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; }
  function prog(vs, fs) { var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p; }
  var quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);

  var itemProg = prog(
    'attribute vec2 aP;uniform vec4 uRect;uniform vec2 uRes;varying vec2 vUv;' +
    'void main(){vUv=aP;vec2 p=uRect.xy+aP*uRect.zw;gl_Position=vec4(p.x/uRes.x*2.-1.,1.-p.y/uRes.y*2.,0.,1.);}',
    'precision mediump float;uniform sampler2D uTex;uniform float uAlpha;uniform float uDim;uniform float uLift;varying vec2 vUv;' +
    'void main(){vec4 c=texture2D(uTex,vUv);float g=dot(c.rgb,vec3(.299,.587,.114));' +
    'c.rgb=mix(c.rgb,vec3(g)*vec3(.82,.9,.88),uDim*.7)*(1.-uDim*.45);c.rgb+=uLift*.04;' +
    'gl_FragColor=vec4(mix(vec3(.067,.09,.098),c.rgb,uAlpha),1.);}');
  var postProg = prog(
    'attribute vec2 aP;varying vec2 vUv;void main(){vUv=aP;gl_Position=vec4(aP*2.-1.,0.,1.);}',
    'precision mediump float;uniform sampler2D uTex;uniform vec2 uRes;uniform vec2 uMouse;uniform vec2 uMVel;uniform float uSpeed;uniform float uTime;uniform float uLens;varying vec2 vUv;' +
    'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}' +
    'void main(){vec2 c=vUv-.5;float asp=uRes.x/uRes.y;float r2=dot(c*vec2(asp,1.),c*vec2(asp,1.));' +
    'float k=.035+.22*uSpeed;vec2 uv=.5+c*(1.-k*r2);' +                                        /* speed-driven barrel bend */
    'vec2 d=(uv-uMouse)*vec2(asp,1.);float m=exp(-dot(d,d)*14.)*uLens;uv-=d/vec2(asp,1.)*m*.05;' + /* cursor lens */
    'uv-=uMVel*exp(-dot(d,d)*9.)*.6;' +                                                          /* trail smear */
    'vec2 off=c*(.001+.02*uSpeed);' +                                                           /* chromatic split */
    'vec3 col=vec3(texture2D(uTex,uv+off).r,texture2D(uTex,uv).g,texture2D(uTex,uv-off).b);' +
    'if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)col=vec3(.067,.09,.098);' +
    'float vig=smoothstep(1.05,.25,length(c*vec2(1.,1.15)));col*=mix(.42,1.,vig);' +
    'col+=(h(vUv*uRes+uTime)-.5)*.035;gl_FragColor=vec4(col,1.);}');
  function attr(p) { var l = gl.getAttribLocation(p, 'aP'); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); }
  var U = {}; ['uRect', 'uRes', 'uTex', 'uAlpha', 'uDim', 'uLift'].forEach(function (n) { U['i' + n] = gl.getUniformLocation(itemProg, n); });
  ['uTex', 'uRes', 'uMouse', 'uMVel', 'uSpeed', 'uTime', 'uLens'].forEach(function (n) { U['p' + n] = gl.getUniformLocation(postProg, n); });

  function newTex(src) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    return t;
  }
  var fbo = gl.createFramebuffer(), fboTex = newTex(null);

  /* ---------- textures: posters, or typographic cards in the site's identity ---------- */
  var TW = 480, TH = 720;
  function wrapText(ctx, text, maxW) {
    var words = text.split(/\s+/), lines = [], line = '';
    words.forEach(function (w) { var test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; });
    if (line) lines.push(line); return lines.slice(0, 5);
  }
  function card(it) {
    var c = doc.createElement('canvas'); c.width = TW; c.height = TH; var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, TW * .6, TH); g.addColorStop(0, COL.teal2); g.addColorStop(1, COL.char); x.fillStyle = g; x.fillRect(0, 0, TW, TH);
    x.strokeStyle = 'rgba(179,154,112,.45)'; x.lineWidth = 2; x.strokeRect(22, 22, TW - 44, TH - 44);
    var pad = 52, sx = rtl ? TW - pad : pad; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left';
    x.fillStyle = COL.bronze; x.font = (rtl ? '500 26px "IBM Plex Sans Arabic"' : '500 20px Inter'); x.fillText(rtl ? it.cl : it.cl.toUpperCase(), sx, 86);
    x.fillStyle = COL.ivory; var fs = rtl ? 52 : 54; x.font = (rtl ? '400 ' + fs + 'px Amiri' : '400 ' + fs + 'px "Cormorant Garamond"');
    var lines = wrapText(x, it.t, TW - pad * 2), lh = fs * (rtl ? 1.45 : 1.08), y0 = TH - 120 - (lines.length - 1) * lh;
    lines.forEach(function (l, i) { x.fillText(l, sx, y0 + i * lh); });
    x.fillStyle = 'rgba(201,207,203,.85)'; x.font = '400 24px Inter'; x.fillText(it.y ? String(it.y) : '—', sx, TH - 62);
    return c;
  }
  var fontsReady = (doc.fonts && doc.fonts.load) ? Promise.all(['400 54px "Cormorant Garamond"', '400 52px Amiri', '500 20px Inter', '500 26px "IBM Plex Sans Arabic"'].map(function (f) { return doc.fonts.load(f).catch(function () {}); })) : Promise.resolve();
  fontsReady = Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 1200); })]);  // never wait long for fonts
  DATA.forEach(function (it) { it.tex = null; });
  fontsReady.then(function () {
    DATA.forEach(function (it) {
      it.tex = newTex(card(it));
      if (it.i) {
        var im = new Image(); im.decoding = 'async';
        im.onload = function () { var c = doc.createElement('canvas'); c.width = TW; c.height = TH; var x = c.getContext('2d');
          var s = Math.max(TW / im.width, TH / im.height), w = im.width * s, h = im.height * s; x.drawImage(im, (TW - w) / 2, (TH - h) / 2, w, h);
          gl.bindTexture(gl.TEXTURE_2D, it.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); };
        im.src = it.i;
      }
    });
  });

  /* ---------- the field ---------- */
  var W = 0, H = 0, DPR = 1, cells = [], cols = 0, rows = 0, SW = 0, SH = 0, cw = 0, chh = 0, items = DATA;
  function rand(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function layout() {
    var n = items.length || 1, side = Math.max(5, Math.round(Math.sqrt(2 * n)));
    cols = side; rows = side;
    cw = Math.max(128, Math.min(232, W * 0.145)); chh = cw * 1.5;
    var sx = cw * 1.58, sy = chh * 1.24; SW = cols * sx; SH = rows * sy;
    cells = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var i = r * cols + c, k = (c * 1 + r * (n > 12 ? 7 : 2)) % n;           // offset each row so neighbours differ
      var d = 0.78 + rand(i) * 0.4;                         // depth → scale + parallax
      cells.push({ it: items[k], bx: c * sx + (rand(i + 7) - .5) * sx * .45, by: r * sy + (rand(i + 13) - .5) * sy * .35, d: d,
        hov: 0, rects: [], appear: 0, delay: rand(i + 21) * 0.5 });
    }
    cells.sort(function (a, b) { return a.d - b.d; });     // far first, near last
  }
  function resize() {
    var r = canvas.getBoundingClientRect(); DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    gl.bindTexture(gl.TEXTURE_2D, fboTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    layout();
  }
  window.addEventListener('resize', function () { if (view === 'canvas') resize(); });

  /* ---------- input: drag, wheel, keys, hover, click ---------- */
  var cam = { x: 0, y: 0 }, tgt = { x: 0, y: 0 }, prev = { x: 0, y: 0 }, speed = 0;
  var mouse = { x: -1, y: -1, px: -1, py: -1, vx: 0, vy: 0, in: false }, lens = 0;
  var drag = null, hovered = null, opening = null, appearT = 0, fade = 1, fadeTo = 1, pendingItems = null;
  canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: 0 }; root.classList.add('is-dragging'); });
  canvas.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.in = true;
    if (drag) { var dx = e.clientX - drag.x, dy = e.clientY - drag.y; tgt.x -= dx * 1.15; tgt.y -= dy * 1.15; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); }
  });
  canvas.addEventListener('pointerleave', function () { mouse.in = false; });
  function endDrag(e) {
    if (!drag) return; var click = drag.moved < 6; drag = null; root.classList.remove('is-dragging');
    if (click && e.type === 'pointerup') { var r = canvas.getBoundingClientRect(); var c = hit(e.clientX - r.left, e.clientY - r.top); if (c) open(c); }
  }
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); var f = e.deltaMode === 1 ? 32 : 1; tgt.x += (e.shiftKey ? e.deltaY : e.deltaX) * f; tgt.y += (e.shiftKey ? 0 : e.deltaY) * f; }, { passive: false });
  canvas.addEventListener('keydown', function (e) {
    var s = 160, k = e.key;
    if (k === 'ArrowLeft') tgt.x -= s; else if (k === 'ArrowRight') tgt.x += s; else if (k === 'ArrowUp') tgt.y -= s; else if (k === 'ArrowDown') tgt.y += s;
    else if (k === 'Enter') { var c = nearestCenter(); if (c) open(c); } else return;
    e.preventDefault();
  });
  /* every visible copy of a cell is recorded, so hit-testing works anywhere on the infinite field */
  function hit(x, y) {
    for (var i = cells.length - 1; i >= 0; i--) { var rs = cells[i].rects;
      for (var j = 0; j < rs.length; j++) { var r = rs[j]; if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return { c: cells[i], r: r }; } }
    return null;
  }
  function nearestCenter() { var best = null, bd = 1e9; cells.forEach(function (c) { c.rects.forEach(function (r) { var dx = r[0] + r[2] / 2 - W / 2, dy = r[1] + r[3] / 2 - H / 2, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = { c: c, r: r }; } }); }); return best; }
  function open(h) {
    if (opening) return;
    if (reduce) { location.href = h.c.it.h; return; }
    opening = { c: h.c, t: 0, from: h.r.slice() }; root.classList.add('is-opening'); showLabel(null);
  }
  var live = root.querySelector('[data-wc-live]');
  function showLabel(c) {
    if (c) { lCat.textContent = c.it.cl; lTitle.textContent = c.it.t; lMeta.textContent = [c.it.y, c.it.cr].filter(Boolean).join(' · '); }
    label.classList.toggle('is-on', !!c); cursor.classList.toggle('is-hover', !!c);
  }

  /* filters */
  var chips = [].slice.call(root.querySelectorAll('[data-wc-cat]'));
  chips.forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.wcCat;
      chips.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      pendingItems = k === 'all' ? DATA : DATA.filter(function (it) { return it.c === k; });
      fadeTo = 0; if (live) live.textContent = b.textContent.trim();
    });
  });

  /* ---------- render loop ---------- */
  var last = 0;
  function wrapC(v, S) { return ((v % S) + S) % S - S / 2; }
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    var ease = reduce ? 1 : 1 - Math.pow(0.0009, dt);           // inertia
    cam.x += (tgt.x - cam.x) * ease; cam.y += (tgt.y - cam.y) * ease;
    var v = Math.hypot(cam.x - prev.x, cam.y - prev.y) / (dt * 60); prev.x = cam.x; prev.y = cam.y;
    speed += (Math.min(1, v / 55) - speed) * 0.12; if (reduce) speed = 0;
    if (mouse.px >= 0) { mouse.vx += ((mouse.x - mouse.px) / W - mouse.vx) * 0.2; mouse.vy += ((mouse.y - mouse.py) / H - mouse.vy) * 0.2; }
    mouse.px = mouse.x; mouse.py = mouse.y; mouse.vx *= 0.9; mouse.vy *= 0.9;
    lens += ((mouse.in && !drag ? 1 : 0) - lens) * 0.08;
    appearT = Math.min(1, appearT + dt / (reduce ? 0.01 : 1.1));
    fade += (fadeTo - fade) * (reduce ? 1 : 0.18);
    if (pendingItems && fade < 0.03) { items = pendingItems; pendingItems = null; layout(); appearT = 0; fadeTo = 1; }

    var hh = (!drag && mouse.in && !opening) ? hit(mouse.x, mouse.y) : null, hov = hh ? hh.c : null;
    if (hov !== hovered) { hovered = hov; showLabel(hov); }
    cursor.style.transform = 'translate(' + mouse.x + 'px,' + mouse.y + 'px)';
    label.style.transform = 'translate(' + mouse.x + 'px,' + mouse.y + 'px)';
    cursor.classList.toggle('is-on', mouse.in);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(COL.bg[0], COL.bg[1], COL.bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(itemProg); attr(itemProg); gl.uniform2f(U.iuRes, W, H); gl.uniform1i(U.iuTex, 0); gl.activeTexture(gl.TEXTURE0);
    var anyHover = hovered ? 1 : 0, op = opening;
    if (op) op.t = Math.min(1, op.t + dt / 0.75);
    var ot = op ? (1 - Math.pow(1 - op.t, 3)) : 0;
    function draw(tex, r, alpha, dim, lift) {
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform4f(U.iuRect, r[0], r[1], r[2], r[3]);
      gl.uniform1f(U.iuAlpha, alpha); gl.uniform1f(U.iuDim, dim); gl.uniform1f(U.iuLift, lift); gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i]; c.rects = [];
      c.hov += ((c === hovered ? 1 : 0) - c.hov) * 0.15;
      var a = Math.max(0, Math.min(1, (appearT - c.delay * 0.6) / 0.5)), ae = 1 - Math.pow(1 - a, 3);
      var s = c.d * (0.9 + 0.1 * ae) * (1 + 0.07 * c.hov), w = cw * s, h = chh * s;
      var px = wrapC(c.bx - cam.x * c.d, SW), py = wrapC(c.by - cam.y * c.d, SH);
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var x = W / 2 + px + ox * SW - w / 2, y = H / 2 + py + oy * SH - h / 2;
        if (x > W + 40 || y > H + 40 || x + w < -40 || y + h < -40 || !c.it.tex) continue;
        c.rects.push([x, y, w, h]);
        draw(c.it.tex, [x, y, w, h], ae * fade * (op ? 1 - ot : 1), anyHover * (1 - c.hov), c.hov);
      }
    }
    if (op && op.c.it.tex) {   // the chosen work grows to centre stage before the page opens
      var th = H * 0.86, tw = th / 1.5, f = op.from, T = [(W - tw) / 2, (H - th) / 2, tw, th];
      draw(op.c.it.tex, [f[0] + (T[0] - f[0]) * ot, f[1] + (T[1] - f[1]) * ot, f[2] + (T[2] - f[2]) * ot, f[3] + (T[3] - f[3]) * ot], 1, 0, 1);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(postProg); attr(postProg); gl.bindTexture(gl.TEXTURE_2D, fboTex);
    gl.uniform1i(U.puTex, 0); gl.uniform2f(U.puRes, W, H);
    gl.uniform2f(U.puMouse, mouse.x / W, 1 - mouse.y / H); gl.uniform2f(U.puMVel, reduce ? 0 : mouse.vx, reduce ? 0 : -mouse.vy);
    gl.uniform1f(U.puSpeed, speed + ot * 0.6); gl.uniform1f(U.puTime, now * 0.001 % 100); gl.uniform1f(U.puLens, reduce ? 0 : lens);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (op && op.t >= 1) { running = false; location.href = op.c.it.h; return; }
    requestAnimationFrame(frame);
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted && opening) { opening = null; root.classList.remove('is-opening'); if (view === 'canvas') { running = true; last = performance.now(); requestAnimationFrame(frame); } } });

  setView(view, false);
})();
