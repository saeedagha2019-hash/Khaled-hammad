/* Works views — several ways of presenting the works, each with the same filters. No audio here: the music of a
   work plays only on its own page, when the visitor chooses to.
   One carousel: the work in focus stands large in the middle, its neighbours smaller on a gently curved surface,
   reflected on a dark floor. Each design dresses that stage differently:
   1 staff    the works on a flowing musical staff, a treble clef at its start, notes around them
   2 film     the works framed in a strip of film unrolling from a reel
   3 halo     a bronze halo behind the work in focus, silk waves of fine lines on both sides
   4 spectrum fine bronze bars of a spectrum behind the row, a lit thread through them
   5 silk     two silk ribbons of fine lines weaving above and below the row
   Three stacked canvases: 2D behind (decoration, light), WebGL (posters as meshes in perspective), 2D in front
   (frames, clef, notes, grain). Drag / swipe, wheel, arrows and the buttons move the row; click a side work to bring
   it to the middle, click the middle one to open it. */
(function () {
  'use strict';
  var root = document.querySelector('[data-wv]');
  if (!root) return;
  var doc = document, back = root.querySelector('[data-sc-back]'), glc = root.querySelector('[data-sc-gl]'), front = root.querySelector('[data-sc-front]');
  var gl = null; try { gl = glc.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true }); } catch (e) {}
  if (!gl) { root.classList.add('no-gl'); return; }
  var bx = back.getContext('2d'), fx = front.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ALL = JSON.parse(root.querySelector('[data-wv-data]').textContent);
  var $ = function (s) { return root.querySelector(s); }, $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
  var ui = { cat: $('[data-wv-cat]'), title: $('[data-wv-title]'), meta: $('[data-wv-meta]'), more: $('[data-wv-more]'), cap: $('[data-wv-cap]'),
    count: $('[data-wv-count]'), empty: $('[data-wv-empty]'), live: $('[data-wv-live]'), cut: $('[data-wv-cut]'), decade: $('[data-wv-decade]'), q: $('[data-wv-q]') };
  var EN = (doc.documentElement.lang || '').indexOf('en') === 0, DIR = EN ? 'ltr' : 'rtl';
  var AR = function (n) { return EN ? String(n) : String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); };

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
  var loc = { aPos: gl.getAttribLocation(prog, 'aPos'), aUv: gl.getAttribLocation(prog, 'aUv'), aL: gl.getAttribLocation(prog, 'aL'), uR: gl.getUniformLocation(prog, 'uR'), uA: gl.getUniformLocation(prog, 'uA') };
  var vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.enableVertexAttribArray(loc.aPos); gl.vertexAttribPointer(loc.aPos, 2, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(loc.aUv); gl.vertexAttribPointer(loc.aUv, 2, gl.FLOAT, false, 20, 8);
  gl.enableVertexAttribArray(loc.aL); gl.vertexAttribPointer(loc.aL, 1, gl.FLOAT, false, 20, 16);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);
  var VB = new Float32Array(120000), vn = 0, draws = [];
  function texFrom(src) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t;
  }
  function put(p, u, v, l) { VB[vn++] = p[0]; VB[vn++] = p[1]; VB[vn++] = u; VB[vn++] = v; VB[vn++] = l; }
  function mesh(fn, tex, light, nu, nv, alpha) {
    var start = vn / 5; if (vn + nu * nv * 30 > VB.length || !tex) return;
    for (var i = 0; i < nu; i++) for (var j = 0; j < nv; j++) {
      var u0 = i / nu, u1 = (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv, a = fn(u0, v0), b = fn(u1, v0), c = fn(u0, v1), d = fn(u1, v1);
      var la = light(u0, v0), lb = light(u1, v0), lc = light(u0, v1), ld = light(u1, v1);
      put(a, u0, v0, la); put(b, u1, v0, lb); put(c, u0, v1, lc); put(c, u0, v1, lc); put(b, u1, v0, lb); put(d, u1, v1, ld);
    }
    draws.push([tex, start, vn / 5 - start, alpha]);
  }
  function flushGL() {
    gl.viewport(0, 0, glc.width, glc.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform2f(loc.uR, W, H);
    if (vn) { gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, VB.subarray(0, vn), gl.DYNAMIC_DRAW);
      draws.forEach(function (d) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, d[0]); gl.uniform1f(loc.uA, d[3]); gl.drawArrays(gl.TRIANGLES, d[1], d[2]); }); }
    vn = 0; draws = [];
  }

  /* ---------- posters (loaded as they come near) ---------- */
  function wrapText(c, text, maxW) { var words = text.split(' '), lines = [], cur = ''; words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }); if (cur) lines.push(cur); return lines; }
  function cardTex(w) {                    // a typographic card for a work without a poster
    var c = doc.createElement('canvas'); c.width = 512; c.height = 1024; var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, 1024); g.addColorStop(0, '#1C3533'); g.addColorStop(1, '#0D1517'); x.fillStyle = g; x.fillRect(0, 0, 512, 1024);
    x.strokeStyle = 'rgba(179,154,112,.6)'; x.lineWidth = 3; x.strokeRect(28, 56, 456, 912);
    x.direction = DIR; x.textAlign = 'center'; x.fillStyle = '#B39A70'; x.font = EN ? '400 28px Inter, sans-serif' : '400 30px "IBM Plex Sans Arabic", sans-serif'; x.fillText([w.cl, w.y ? AR(w.y) : ''].filter(Boolean).join(' · '), 256, 300);
    x.fillStyle = '#F2EDE3'; x.font = EN ? '400 66px "Cormorant Garamond", serif' : '400 64px Amiri, serif'; var lines = wrapText(x, w.t, 400); lines.forEach(function (l, i) { x.fillText(l, 256, 470 + (i - (lines.length - 1) / 2) * 150, 420); });
    x.fillStyle = '#B39A70'; x.fillRect(216, 640, 80, 2); x.fillStyle = 'rgba(201,207,203,.8)'; x.font = EN ? '400 26px Inter, sans-serif' : '400 28px "IBM Plex Sans Arabic", sans-serif'; if (w.cr) x.fillText(w.cr, 256, 700, 420);
    return texFrom(c);
  }
  function need(w) {
    if (w.req) return; w.req = true; w.rgb = '64,96,92';
    if (!w.i) { var make = function () { w.tex = cardTex(w); }; if (doc.fonts && doc.fonts.load) Promise.all(EN ? [doc.fonts.load('400 66px "Cormorant Garamond"'), doc.fonts.load('400 28px Inter')] : [doc.fonts.load('400 64px Amiri'), doc.fonts.load('400 30px "IBM Plex Sans Arabic"')]).then(make, make); else make(); return; }
    var im = new Image(); im.decoding = 'async';
    im.onload = function () {
      var c = doc.createElement('canvas'); c.width = 512; c.height = 1024; c.getContext('2d').drawImage(im, 0, 0, 512, 1024); w.tex = texFrom(c);
      var t = doc.createElement('canvas'); t.width = 4; t.height = 6; var tx = t.getContext('2d'); tx.drawImage(im, 0, 0, 4, 6);
      var d = tx.getImageData(0, 0, 4, 6).data, r = 0, g = 0, b = 0; for (var k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
      var n = d.length / 4; w.rgb = [r / n * 0.45 + 179 * 0.55 | 0, g / n * 0.45 + 154 * 0.55 | 0, b / n * 0.45 + 112 * 0.55 | 0].join(',');
    };
    im.onerror = function () { w.i = null; w.req = false; need(w); };
    im.src = w.i;
  }

  /* ---------- music glyphs (design 1) ---------- */
  var fontOk = false, CLEF = '𝄞', Q = '𝅘𝅥', E8 = '𝅘𝅥𝅮', S16 = '𝅘𝅥𝅯', BEAM = '♫', clefM = null;
  if (window.FontFace && root.dataset.font) new FontFace('KHMusic', 'url(' + root.dataset.font + ')').load().then(function (f) { doc.fonts.add(f); fontOk = true; fx.font = '100px KHMusic'; var m = fx.measureText(CLEF); clefM = [m.actualBoundingBoxAscent, m.actualBoundingBoxDescent]; }).catch(function () {});
  function metal(c, y0, y1) { var g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#F2EDE3'); g.addColorStop(0.35, '#D9C49A'); g.addColorStop(0.7, '#B39A70'); g.addColorStop(1, '#6E5B3E'); return g; }
  function glyph(ch, x, y, size, rot, a) { if (!fontOk) return; fx.save(); fx.globalAlpha = a == null ? 1 : a; fx.translate(x, y); fx.rotate(rot || 0); fx.font = size + 'px KHMusic'; fx.textAlign = 'center'; fx.direction = 'ltr';
    fx.shadowColor = 'rgba(217,180,120,.7)'; fx.shadowBlur = size * 0.18; fx.fillStyle = metal(fx, -size * 0.8, size * 0.15); fx.fillText(ch, 0, 0); fx.restore(); }
  function clef(x, top, height) { if (!clefM) return; var fs = 100 * height / (clefM[0] + clefM[1]); glyph(CLEF, x, top + clefM[0] * fs / 100, fs, 0.04, fade); }

  /* ---------- 2D helpers ---------- */
  function glowPath(c, pts, w, a) {
    if (a <= 0.01) return; c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = c.lineCap = 'round';
    var passes = [[w * 5, 0.1, '190,160,115'], [w * 1.8, 0.4, '217,196,154'], [w * 0.6, 0.9, '242,237,227']];
    for (var p = 0; p < 3; p++) { c.beginPath(); for (var i = 0; i < pts.length; i++) i ? c.lineTo(pts[i][0], pts[i][1]) : c.moveTo(pts[i][0], pts[i][1]);
      c.strokeStyle = 'rgba(' + passes[p][2] + ',' + passes[p][1] * a + ')'; c.lineWidth = passes[p][0]; c.stroke(); }
    c.restore();
  }
  function thin(c, pts, w, a, col) { c.beginPath(); for (var i = 0; i < pts.length; i++) i ? c.lineTo(pts[i][0], pts[i][1]) : c.moveTo(pts[i][0], pts[i][1]); c.strokeStyle = 'rgba(' + (col || '217,196,154') + ',' + a + ')'; c.lineWidth = w; c.stroke(); }
  function outline(fn, n) { var p = [], i; for (i = 0; i <= n; i++) p.push(fn(i / n, 0)); for (i = 1; i <= n; i++) p.push(fn(1, i / n)); for (i = n - 1; i >= 0; i--) p.push(fn(i / n, 1)); for (i = n - 1; i > 0; i--) p.push(fn(0, i / n)); return p; }
  function softGlow(c, x, y, r, rgb, a) { if (a <= 0.003 || r <= 1) return; c.save(); c.globalCompositeOperation = 'lighter'; var g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(0.5, 'rgba(' + rgb + ',' + a * 0.3 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
  function inPoly(px, py, pts) { var inside = false; for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) { var a = pts[i], b = pts[j];
    if ((a[1] > py) !== (b[1] > py) && px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; }
  function poly(c, pts, fill) { c.beginPath(); pts.forEach(function (p, i) { i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath(); c.fillStyle = fill; c.fill(); }

  /* ---------- stage geometry ---------- */
  var W = 0, H = 0, DPR = 1, small = false, grainPat = null;
  var D = 3000, K = 9000, BH = 700, YC = -30, FY = 560, F = 1, CX = 0, CY = 0, TB = 1600, PMAX = 8, sTab = new Float32Array(TB + 1);
  function hf(p) { return 1 + 0.55 * Math.exp(-p * p * 2.4); }
  (function () { var dp = 2 * PMAX / TB, acc = 0, i, p; for (i = TB / 2 + 1; i <= TB; i++) { p = -PMAX + (i - 0.5) * dp; acc += (BH * hf(p) / 1.5 + 70) * dp; sTab[i] = acc; }
    acc = 0; for (i = TB / 2 - 1; i >= 0; i--) { p = -PMAX + (i + 0.5) * dp; acc -= (BH * hf(p) / 1.5 + 70) * dp; sTab[i] = acc; } })();
  function sOf(p) { var f = (Math.max(-PMAX, Math.min(PMAX, p)) + PMAX) / (2 * PMAX) * TB, i = Math.min(TB - 1, f | 0), k = f - i; return sTab[i] * (1 - k) + sTab[i + 1] * k; }
  function pr(x, y, z) { return [CX + x * F / z, CY + y * F / z]; }
  function surf(x, y) { return pr(x, y, D + x * x / K); }               // the curved surface the row (and its decoration) sits on
  function resize() {
    var r = root.getBoundingClientRect(); DPR = Math.min(window.devicePixelRatio || 1, 1.75); W = r.width; H = r.height; small = W < 700;
    [back, glc, front].forEach(function (c) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); });
    F = Math.min(H * (small ? 1.05 : 1.12), W * (small ? 1.95 : 2.2)); CX = W / 2; CY = H * (small ? 0.47 : 0.5);
    var g = doc.createElement('canvas'); g.width = g.height = 160; var gx = g.getContext('2d'), id = gx.createImageData(160, 160);
    for (var k = 0; k < id.data.length; k += 4) { var v = Math.random() * 255 | 0; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 12; }
    gx.putImageData(id, 0, 0); grainPat = fx.createPattern(g, 'repeat');
  }
  window.addEventListener('resize', resize);

  /* ---------- designs ---------- */
  var T = 0, ph = 0;
  function bgFill(lx) { var g = bx.createRadialGradient(W * lx, H * 0.46, 30, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    g.addColorStop(0, '#1F3734'); g.addColorStop(0.45, '#122322'); g.addColorStop(1, '#070B0D'); bx.fillStyle = g; bx.fillRect(0, 0, W, H);
    softGlow(bx, W * lx, H * 0.42, Math.max(W, H) * 0.45, '179,154,112', 0.13); }
  function floorShade() { var fy = pr(0, FY, D)[1], fg = bx.createLinearGradient(0, fy - 20, 0, H); fg.addColorStop(0, 'rgba(6,9,10,0)'); fg.addColorStop(0.2, 'rgba(6,9,10,.42)'); fg.addColorStop(1, 'rgba(4,6,7,.82)');
    bx.fillStyle = fg; bx.fillRect(0, fy - 20, W, H); var l = bx.createLinearGradient(0, 0, W, 0); l.addColorStop(0, 'rgba(179,154,112,0)'); l.addColorStop(0.5, 'rgba(179,154,112,.18)'); l.addColorStop(1, 'rgba(179,154,112,0)'); bx.fillStyle = l; bx.fillRect(0, fy, W, 1.5); return fy; }
  function hero(items) { for (var i = 0; i < items.length; i++) if (items[i].focus) return items[i]; return null; }
  var XS = 4800;
  var designs = {
    staff: {
      yS: function (x) { return YC + 40 * Math.sin(x / 1500 + ph) - 30 * Math.cos(x / 820 - ph * 0.7); },
      gap: function (x) { return 66 * (1 + Math.pow(x / 3000, 2) * 1.4); },
      back: function () { for (var i = 0; i < 5; i++) { var pts = []; for (var x = -XS; x <= XS; x += 60) pts.push(surf(x, this.yS(x) + (i - 2) * this.gap(x))); glowPath(bx, pts, small ? 1.1 : 1.5, 0.85 * fade); } },
      front: function () {
        var self = this; clef(W * (small ? 0.07 : 0.075), H * (small ? 0.3 : 0.22), H * (small ? 0.3 : 0.52));
        [[-2900, -1.4, BEAM, 0.085], [-1700, 3.6, E8, 0.065], [-1150, -2.4, Q, 0.065], [1250, -2.5, E8, 0.07], [1750, 3.8, S16, 0.065], [2900, -1.3, BEAM, 0.08]].forEach(function (n, i) {
          var p = surf(n[0], self.yS(n[0]) + (n[1] - 2) * self.gap(n[0]) + (reduce ? 0 : Math.sin(T * 1.1 + i) * 12)); glyph(n[2], p[0], p[1], H * n[3] * (small ? 0.9 : 1.2), (reduce ? 0 : Math.sin(T * 0.8 + i * 2) * 0.05) + (i % 2 ? 0.06 : -0.06), fade); });
      }
    },
    film: {
      edge: function (x, s) { return YC + s * (BH / 2 + 92) + 22 * Math.sin(x / 1700 + ph * 0.4); },
      back: function () {
        var x0 = -3300, x1 = XS, top = [], bot = [], x, i;
        // reel at the start of the strip
        var rc = surf(x0, YC), rr = (BH / 2 + 150) * F / (D + x0 * x0 / K), c = bx;
        c.save(); c.globalAlpha = fade; c.translate(rc[0], rc[1]); c.scale(0.55, 1);
        c.fillStyle = '#3E3324'; c.beginPath(); c.arc(-22, 0, rr, 0, 7); c.fill();
        var rg = c.createRadialGradient(-rr * 0.3, -rr * 0.35, 8, 0, 0, rr); rg.addColorStop(0, '#E8DCC2'); rg.addColorStop(0.45, '#B39A70'); rg.addColorStop(1, '#5A4A31'); c.fillStyle = rg; c.beginPath(); c.arc(0, 0, rr, 0, 7); c.fill();
        c.strokeStyle = 'rgba(242,237,227,.45)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, rr * 0.93, 0, 7); c.stroke();
        var spin = reduce ? 0 : cam * -0.9;
        for (i = 0; i < 6; i++) { var a = spin + i * Math.PI / 3; c.fillStyle = '#0B1214'; c.beginPath(); c.arc(Math.cos(a) * rr * 0.56, Math.sin(a) * rr * 0.56, rr * 0.22, 0, 7); c.fill(); c.strokeStyle = 'rgba(110,91,62,.9)'; c.lineWidth = 4; c.stroke(); }
        c.fillStyle = metal(c, -rr * 0.13, rr * 0.13); c.beginPath(); c.arc(0, 0, rr * 0.13, 0, 7); c.fill(); c.restore();
        for (x = x0; x <= x1; x += 60) { top.push(surf(x, this.edge(x, -1))); bot.push(surf(x, this.edge(x, 1))); }
        var g = bx.createLinearGradient(0, CY - H * 0.3, 0, CY + H * 0.3); g.addColorStop(0, 'rgba(12,18,20,.96)'); g.addColorStop(0.5, 'rgba(23,33,33,.96)'); g.addColorStop(1, 'rgba(12,18,20,.96)');
        bx.save(); bx.globalAlpha = fade; poly(bx, top.concat(bot.slice().reverse()), g);
        // sprocket holes along both rails, travelling with the row
        var step = 130, off = ((cam * 190) % step + step) % step;
        for (x = x0 + 40 - off; x <= x1 - 40; x += step) for (var s = -1; s <= 1; s += 2) {
          var y0 = this.edge(x, s) - s * 30, y1 = this.edge(x, s) - s * 62, hp = [surf(x - 30, y0), surf(x + 30, y0), surf(x + 30, y1), surf(x - 30, y1)];
          poly(bx, hp, '#030505'); bx.strokeStyle = 'rgba(179,154,112,.55)'; bx.lineWidth = 1; bx.stroke();
        }
        bx.restore();
        glowPath(bx, top, small ? 1 : 1.3, 0.8 * fade); glowPath(bx, bot, small ? 1 : 1.3, 0.8 * fade);
        var rail = function (sg) { var p = []; for (var xx = x0; xx <= x1; xx += 80) p.push(surf(xx, designs.film.edge(xx, sg) - sg * 78)); return p; };
        thin(bx, rail(-1), 1, 0.35 * fade); thin(bx, rail(1), 1, 0.35 * fade);
      },
      front: function () {}
    },
    halo: {
      back: function (items) {
        var hi = hero(items);
        silk(-XS, -650, YC + 200, 230, 34, 0.15, -1); silk(650, XS, YC + 200, 230, 34, 0.15, 1);
        if (hi) { var c = hi.fn(0.5, 0.5), top = hi.fn(0.5, 0), r = (c[1] - top[1]) * 1.32, pts = [];
          for (var i = 0; i <= 120; i++) { var a = i / 120 * Math.PI * 2; pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * 0.98]); }
          softGlow(bx, c[0], c[1], r * 1.25, '217,180,120', 0.22 * fade); glowPath(bx, pts, small ? 1.4 : 2, 0.9 * fade * hi.alpha);
          var arc = [], a0 = reduce ? -0.6 : T * 0.35; for (i = 0; i <= 40; i++) { var b = a0 + i / 40 * 1.4; arc.push([c[0] + Math.cos(b) * r, c[1] + Math.sin(b) * r * 0.98]); } glowPath(bx, arc, small ? 2 : 3, 0.7 * fade * hi.alpha); }
      },
      front: function () {}
    },
    spectrum: {
      back: function () {
        var cy = pr(0, YC, D)[1], fy = pr(0, FY, D)[1], gap = small ? 9 : 13;
        bx.save(); bx.globalCompositeOperation = 'lighter';
        for (var x = gap / 2; x < W; x += gap) {
          var t = x / W, env = 0.06 + 0.3 * Math.exp(-Math.pow((t - 0.06) / 0.09, 2)) + 0.3 * Math.exp(-Math.pow((t - 0.94) / 0.09, 2)) + 0.1 * Math.exp(-Math.pow((t - 0.5) / 0.32, 2));
          var tt = reduce ? 0 : T, n = 0.4 + 0.6 * Math.abs(Math.sin(x * 0.061 + tt * 1.1) * Math.sin(x * 0.017 + 1.3 - tt * 0.6)), h = env * n * H;
          var g = bx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2); g.addColorStop(0, 'rgba(179,154,112,0)'); g.addColorStop(0.3, 'rgba(200,170,120,.75)'); g.addColorStop(0.5, 'rgba(242,237,227,.95)'); g.addColorStop(0.7, 'rgba(200,170,120,.75)'); g.addColorStop(1, 'rgba(179,154,112,0)');
          bx.globalAlpha = 0.8 * fade; bx.fillStyle = g; bx.fillRect(x - 2, cy - h / 2, 4, h);
          bx.globalAlpha = 0.1 * fade; bx.fillRect(x - 2, 2 * fy - cy - h / 2, 4, h);
        }
        bx.restore(); glowPath(bx, [[0, cy], [W, cy]], 1.2, 0.7 * fade);
      },
      front: function () {}
    },
    silk: {
      back: function () { silk(-XS, XS, YC - BH * 0.55, 120, 30, 0.13, 1, 0); silk(-XS, XS, YC + BH * 0.58, 130, 30, 0.13, -1, 2.1); },
      front: function () {}
    }
  };
  // a silk ribbon of fine lines, twisting as it flows
  function silk(x0, x1, cy, hw, n, a, dir, ph0) {
    for (var j = 0; j <= n; j++) {
      var p = j / n * 2 - 1, pts = [], edge = j === 0 || j === n;
      for (var x = x0; x <= x1; x += 70) { var tw = x * 0.0011 * (dir || 1) + (ph0 || 0) + ph * 0.8, w = hw * (0.75 + 0.35 * Math.sin(x / 1300 + 1.2 + ph * 0.5)), c = cy + 70 * Math.sin(x / 1600 + (ph0 || 0) - ph * 0.6);
        pts.push(surf(x, c + w * p * Math.cos(tw))); }
      if (edge) glowPath(bx, pts, small ? 0.9 : 1.2, 0.7 * fade); else { bx.save(); bx.globalCompositeOperation = 'lighter'; thin(bx, pts, small ? 0.8 : 1.1, a * 2.2 * fade, '230,210,170'); bx.restore(); }
    }
  }

  /* ---------- drag designs (6–10) ---------- */
  function sstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function arcPts(cx, cy, r, a0, a1, n) { var p = []; for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; p.push([cx + Math.sin(a) * r, cy - Math.cos(a) * r]); } return p; }

  // 6 · the zoetrope: the works around a bronze drum that turns as you drag (the device that came before cinema)
  designs.zoetrope = {
    mode: 'free', noFloor: true, R: 1350, Z: 3350,
    S: function () { return small ? 10 : 12; },
    unit: function () { return (2 * Math.PI * this.R / this.S()) * F / (this.Z - this.R); },
    v: function (x, y, z) { return pr(x, y - 110 - (z - this.Z) * 0.2, z); },
    hgt: function () { return small ? 660 : 640; },
    layout: function (items) {
      var S = this.S(), R = this.R, Z = this.Z, h = this.hgt(), w = h / 1.5, base = Math.round(cam), self = this;
      for (var k = base - Math.floor(S / 2); k < base + Math.ceil(S / 2); k++) {
        if (!wrap && (k < 0 || k >= N)) continue; var wk = list[wi(k)]; need(wk);
        var th = (k - cam) * 2 * Math.PI / S, c = Math.cos(th), s = Math.sin(th);
        (function (cx, cz, tx, tz, c) {
          items.push({ w: wk, k: k, focus: Math.abs(k - cam) < 0.5, depth: -cz, alpha: fade * (c > -0.2 ? 1 : 0.85), noFrame: c < 0.1, nu: 8,
            fn: function (u, v) { var X = (u - 0.5) * w; return self.v(cx + X * tx, YC + (v - 0.5) * h, cz + X * tz); },
            light: function () { return c > 0 ? 0.42 + 0.62 * c : 0.2; } });
        })(R * s, Z - R * c, c, s, c);
      }
      items.sort(function (a, b) { return a.depth - b.depth; });
    },
    ring: function (yy, frontHalf, ctx, a) {
      var pts = [], R = this.R * 1.04; for (var i = 0; i <= 90; i++) { var t = i / 90 * Math.PI * 2, c = Math.cos(t); if ((c > 0) !== frontHalf) { if (pts.length > 1) glowPath(ctx, pts, small ? 1 : 1.4, a); pts = []; continue; } pts.push(this.v(R * Math.sin(t), yy, this.Z - R * c)); }
      if (pts.length > 1) glowPath(ctx, pts, small ? 1 : 1.4, a);
    },
    slats: function (frontHalf, ctx, a) { var S = this.S(), h = this.hgt(), R = this.R * 1.04; for (var k = 0; k < S; k++) { var th = (k + 0.5 - (cam % 1)) * 2 * Math.PI / S, c = Math.cos(th); if ((c > 0) !== frontHalf) continue;
      var x = R * Math.sin(th), z = this.Z - R * c; glowPath(ctx, [this.v(x, YC - h / 2 - 55, z), this.v(x, YC + h / 2 + 55, z)], small ? 0.8 : 1.1, a * (frontHalf ? 0.35 + 0.4 * c : 0.4)); } },
    back: function () {
      var h = this.hgt(), base = this.v(0, YC + h / 2 + 130, this.Z), rx = this.R * 1.25 * F / this.Z;
      bx.save(); bx.globalAlpha = 0.6 * fade; bx.fillStyle = 'rgba(0,0,0,.55)'; bx.beginPath(); bx.ellipse(base[0], base[1], rx, rx * 0.2, 0, 0, 7); bx.fill(); bx.restore();
      softGlow(bx, base[0], base[1], rx * 1.1, '179,154,112', 0.12 * fade);
      this.ring(YC - h / 2 - 55, false, bx, 0.75 * fade); this.ring(YC + h / 2 + 55, false, bx, 0.75 * fade); this.slats(false, bx, fade);
    },
    front: function () { var h = this.hgt(); this.slats(true, fx, fade); this.ring(YC - h / 2 - 55, true, fx, 0.9 * fade); this.ring(YC + h / 2 + 55, true, fx, 0.9 * fade); }
  };

  // 7 · the corridor of time: the works hung on both walls, you walk through them; the years are written on the floor
  designs.tunnel = {
    mode: 'free', axis: 'y', noFloor: true, Z0: 1900, G: 640,
    unit: function () { return small ? 90 : 120; },
    Wc: function () { return small ? 420 : 640; }, hgt: function () { return small ? 600 : 720; },
    zMax: function () { return this.Z0 + 10 * this.G; },
    layout: function (items) {
      var base = Math.round(cam), h = this.hgt(), w = h / 1.5, Wc = this.Wc(), zMax = this.zMax();
      for (var k = base - 2; k <= base + 11; k++) {
        if (!wrap && (k < 0 || k >= N)) continue;
        var z = this.Z0 + (k - cam) * this.G; if (z < 320 || z > zMax) continue;
        var wk = list[wi(k)]; need(wk);
        var left = ((k % 2) + 2) % 2 === 0, yaw = left ? 1.0 : -1.0, tx = Math.cos(yaw), tz = Math.sin(yaw), x = left ? -Wc : Wc;
        var a = sstep(320, 820, z) * (1 - sstep(zMax - 2200, zMax, z)) * fade, near = Math.abs(k - cam) < 0.5;
        (function (x, z, tx, tz, near) {
          items.push({ w: wk, k: k, focus: near, depth: -z, alpha: a, nu: 8,
            fn: function (u, v) { var X = (u - 0.5) * w; return pr(x + X * tx, YC + (v - 0.5) * h, z + X * tz); },
            light: function (u) { return (near ? 1.04 : 0.86) - 0.15 * Math.abs(u - 0.5); } });
        })(x, z, tx, tz, near);
      }
      items.sort(function (a, b) { return a.depth - b.depth; });
    },
    back: function () {
      var Wc = this.Wc(), h = this.hgt(), fy = YC + h / 2 + 70, cy = YC - h / 2 - 90, zMax = this.zMax() + 1500, z, i;
      var end = pr(0, YC, zMax); softGlow(bx, end[0], end[1], Math.min(W, H) * 0.45, '217,180,120', 0.25 * fade);
      [[-Wc, fy], [Wc, fy], [-Wc, cy], [Wc, cy]].forEach(function (q) { glowPath(bx, [pr(q[0], q[1], 330), pr(q[0], q[1], zMax)], small ? 1 : 1.4, 0.7 * fade); });
      // floor rungs travel with you, each with its work's year
      var base = Math.round(cam);
      bx.save(); bx.textAlign = 'center'; bx.direction = DIR;
      for (var k = base - 1; k <= base + 11; k++) {
        if (!wrap && (k < 0 || k >= N)) continue; z = this.Z0 + (k - cam) * this.G; if (z < 330) continue;
        var a = sstep(this.Z0 + 150, this.Z0 + 700, z) * (1 - sstep(zMax - 3000, zMax, z)) * fade, l = pr(-Wc, fy, z), r = pr(Wc, fy, z);
        thin(bx, [l, r], 1, 0.35 * a); var y = list[wi(k)].y;
        if (y) { bx.globalAlpha = 0.75 * a; bx.fillStyle = '#B39A70'; bx.font = '400 ' + Math.max(10, 46 * F / z) + 'px ' + (EN ? 'Inter' : '"IBM Plex Sans Arabic"') + ', sans-serif'; var c = pr(0, fy + 70, z); bx.fillText(AR(y), c[0], c[1]); bx.globalAlpha = 1; }
      }
      bx.restore();
      for (i = 1; i < 6; i++) { var zz = 330 + i * 900 - ((cam * this.G) % 900 + 900) % 900; if (zz < 330) continue; thin(bx, [pr(-Wc, cy, zz), pr(Wc, cy, zz)], 1, 0.12 * fade); }
    },
    front: function () {}
  };

  // 8 · the fan: the works open like a hand of cards; a dial of years above them
  designs.fan = {
    mode: 'free', noFloor: true,
    st: function () { return small ? 0.27 : 0.165; }, R0: function () { return small ? H * 0.7 : H * 0.95; },
    hgt: function () { return small ? Math.min(H * 0.36, W * 0.72) : H * 0.38; },
    unit: function () { return this.st() * this.R0(); },
    layout: function (items) {
      var st = this.st(), R0 = this.R0(), h0 = this.hgt(), base = Math.round(cam), span = small ? 3 : 5, py = CY + R0 - h0 * 0.05;
      for (var k = base - span; k <= base + span; k++) {
        if (!wrap && (k < 0 || k >= N)) continue; var p = k - cam, ap = Math.abs(p); if (ap > span + 0.4) continue;
        var wk = list[wi(k)]; need(wk);
        var hk = Math.exp(-p * p * 3), ang = p * st, h = h0 * (1 + 0.16 * hk), w = h / 1.5, rr = R0 + 24 * hk;
        var cx = CX + Math.sin(ang) * rr, cy = py - Math.cos(ang) * rr, ca = Math.cos(ang), sa = Math.sin(ang);
        (function (cx, cy, ca, sa, w, h, ap) {
          items.push({ w: wk, k: k, focus: ap < 0.5, depth: -ap, alpha: Math.min(1, (span + 0.4 - ap) / 1.2) * fade, nu: 2, noFrame: ap >= 0.5,
            fn: function (u, v) { var X = (u - 0.5) * w, Y = (v - 0.5) * h; return [cx + X * ca - Y * sa, cy + X * sa + Y * ca]; },
            light: function () { return 1.02 - 0.07 * ap; } });
        })(cx, cy, ca, sa, w, h, ap);
      }
      items.sort(function (a, b) { return a.depth - b.depth; });
    },
    back: function () {
      var st = this.st(), R0 = this.R0(), h0 = this.hgt(), py = CY + R0 - h0 * 0.05, ro = R0 + h0 * 0.62 + 60, ri = R0 - h0 * 0.62 - 30, frac = cam - Math.round(cam);
      glowPath(bx, arcPts(CX, py, ro, -1.35, 1.35, 160), small ? 1.1 : 1.5, 0.85 * fade);
      glowPath(bx, arcPts(CX, py, ri, -1.2, 1.2, 140), small ? 0.8 : 1, 0.45 * fade);
      for (var i = -40; i <= 40; i++) { var a = (i * 0.5 - frac) * st; if (Math.abs(a) > 1.33) continue; var major = i % 2 === 0, l = major ? 22 : 11;
        thin(bx, [[CX + Math.sin(a) * ro, py - Math.cos(a) * ro], [CX + Math.sin(a) * (ro + l), py - Math.cos(a) * (ro + l)]], 1, (major ? 0.6 : 0.3) * fade); }
    },
    front: function () {
      var st = this.st(), R0 = this.R0(), h0 = this.hgt(), py = CY + R0 - h0 * 0.05, ro = R0 + h0 * 0.62 + 60 + 44, base = Math.round(cam), span = small ? 3 : 5;
      fx.save(); fx.textAlign = 'center'; fx.direction = DIR;
      for (var k = base - span; k <= base + span; k++) {
        if (!wrap && (k < 0 || k >= N)) continue; var p = k - cam, y = list[wi(k)].y; if (!y || Math.abs(p) > span) continue; var a = p * st;
        fx.save(); fx.translate(CX + Math.sin(a) * ro, py - Math.cos(a) * ro); fx.rotate(a); fx.globalAlpha = fade * (1 - Math.abs(p) / (span + 1)) * (Math.abs(p) < 0.5 ? 1 : 0.7);
        fx.fillStyle = Math.abs(p) < 0.5 ? '#F2EDE3' : '#B39A70'; fx.font = '400 ' + (small ? 13 : 16) + 'px ' + (EN ? 'Inter' : '"IBM Plex Sans Arabic"') + ', sans-serif'; fx.fillText(AR(y), 0, 0); fx.restore();
      }
      fx.restore();
    }
  };

  // 9 · the archive: a stack of cards; drag the top one away to reveal the next
  designs.deck = {
    mode: 'free', noFloor: true,
    unit: function () { return W * (small ? 0.7 : 0.5); },
    hgt: function () { return small ? Math.min(H * 0.46, W * 1.02) : H * 0.52; },
    layout: function (items) {
      var base = Math.floor(cam), h0 = this.hgt(), w0 = h0 / 1.5;
      for (var k = base - 1; k <= base + 6; k++) {
        if (!wrap && (k < 0 || k >= N)) continue; var p = k - cam; if (p < -1.3 || p > 5.6) continue;
        var wk = list[wi(k)]; need(wk);
        var j1 = Math.sin(k * 12.9898) * 0.5, j2 = Math.sin(k * 78.233) * 0.5, x, y, rot, sc, a, l;
        if (p >= 0) { var q = Math.min(p, 1); x = CX + j1 * 26 * q; y = CY - 14 - p * (small ? 12 : 16); rot = j2 * 0.1 * q; sc = 1 - 0.055 * p; a = 1 - sstep(3.6, 5.6, p); l = 1.03 - 0.13 * p; }
        else { var t = -p; x = CX - t * W * (small ? 0.78 : 0.6); y = CY - 14 + t * 36 - Math.sin(t * Math.PI) * 30; rot = -t * 0.34; sc = 1 - 0.05 * t; a = 1 - sstep(0.75, 1.3, t); l = 1.03; }
        (function (x, y, rot, sc, a, l, p) {
          var w = w0 * sc, h = h0 * sc, cr = Math.cos(rot), sr = Math.sin(rot);
          items.push({ w: wk, k: k, focus: Math.abs(p) < 0.5, depth: -p, alpha: a * fade, nu: 2, noFrame: p > 0.6,
            fn: function (u, v) { var X = (u - 0.5) * w, Y = (v - 0.5) * h; return [x + X * cr - Y * sr, y + X * sr + Y * cr]; },
            light: function () { return l; } });
        })(x, y, rot, sc, a, l, p);
      }
      items.sort(function (a, b) { return a.depth - b.depth; });
    },
    back: function () {
      var h0 = this.hgt(), w0 = h0 / 1.5;
      bx.save(); bx.globalAlpha = fade; bx.fillStyle = 'rgba(0,0,0,.5)'; bx.filter = 'blur(18px)'; bx.beginPath(); bx.ellipse(CX + 10, CY + h0 * 0.5 + 8, w0 * 0.62, h0 * 0.06, 0, 0, 7); bx.fill(); bx.restore();
      for (var i = 0; i < 4; i++) { var o = (i + 1) * 7; bx.save(); bx.globalAlpha = 0.5 * fade; bx.strokeStyle = 'rgba(179,154,112,' + (0.35 - i * 0.07) + ')'; bx.lineWidth = 1; bx.strokeRect(CX - w0 / 2 + o, CY - 14 - h0 / 2 - o, w0 - o * 2 + o, h0); bx.restore(); }
    },
    front: function () {
      if (!N) return; var h0 = this.hgt(), w0 = h0 / 1.5, i = wi(Math.round(cam));
      fx.save(); fx.globalAlpha = fade; fx.direction = DIR; fx.textAlign = 'center'; fx.fillStyle = '#B39A70'; fx.font = '400 ' + (small ? 13 : 15) + 'px ' + (EN ? 'Inter' : '"IBM Plex Sans Arabic"') + ', sans-serif';
      fx.fillText(AR(i + 1) + ' / ' + AR(N), CX, CY - 14 - h0 / 2 - (small ? 14 : 22)); fx.restore();
    }
  };

  // 10 · the constellation: every work on a sphere you turn in any direction
  designs.sphere = {
    mode: 'sphere', noFloor: true,
    R: function () { return Math.max(700, Math.min(1500, 900 * Math.sqrt(Math.max(N, 6) / 40))); },
    Z: function () { return this.R() * (small ? 3.3 : 3.05) + 500; }, yc: function () { return YC - 250; },
    radPx: function () { return this.R() * F / this.Z(); },
    rot: function (x0, y0, z0) { var cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX), x1 = x0 * cy + z0 * sy, z1 = -x0 * sy + z0 * cy; return [x1, y0 * cx - z1 * sx, y0 * sx + z1 * cx]; },
    layout: function (items) {
      var R = this.R(), Z = this.Z(), n = N, h = Math.sqrt(7.6 / Math.max(n, 8)) * R, w = h / 1.5, best = null, snapN = null;
      for (var i = 0; i < n; i++) {
        var sl = slots[i], yy = 1 - 2 * (sl + 0.5) / n, r = Math.sqrt(1 - yy * yy), phi = sl * 2.399963, d = this.rot(r * Math.cos(phi), yy, r * Math.sin(phi)), nx = d[0], ny = d[1], nz = d[2];
        if (i === snapTo) snapN = d;
        var vis = -nz; if (vis < -0.12) continue;
        var wk = list[i]; need(wk);
        var el = Math.hypot(nz, nx) || 1, e1 = [-nz / el, 0, nx / el], e2 = [-nx * ny / el, (nx * nx + nz * nz) / el, -nz * ny / el], c = [R * nx, this.yc() + R * ny, Z + R * nz];
        (function (c, e1, e2, vis) {
          var it = { w: wk, k: i, focus: false, depth: -c[2], alpha: sstep(-0.12, 0.3, vis) * fade, nu: 3, nv: 3, n: d, vis: vis, noFrame: vis < 0.55,
            fn: function (u, v) { var X = (u - 0.5) * w, Y = (v - 0.5) * h; return pr(c[0] + X * e1[0] + Y * e2[0], c[1] + X * e1[1] + Y * e2[1], c[2] + X * e1[2] + Y * e2[2]); },
            light: function () { return 0.42 + 0.64 * Math.max(0, vis); } };
          items.push(it); if (!best || vis > best.vis) best = it;
        })(c, e1, e2, vis);
      }
      if (best) best.focus = true;
      // when the sphere comes to rest, turn the nearest work (or the one clicked) to face you
      var tn = snapN || (best && best.n);
      if (tn && !drag && Math.abs(vX) + Math.abs(vY) < 0.25 && (lastInput > 0 || snapN)) {
        var g = Math.min(1, DT * (reduce ? 30 : 4)); rotY += Math.atan2(tn[0], -tn[2]) * g; rotX = Math.max(-1.25, Math.min(1.25, rotX - Math.atan2(tn[1], -tn[2]) * g));
        if (snapN && Math.abs(tn[0]) < 0.01 && Math.abs(tn[1]) < 0.01 && tn[2] < 0) snapTo = -1;
      }
      items.sort(function (a, b) { return a.depth - b.depth; });
    },
    back: function () {
      var R = this.R() * 1.02, Z = this.Z(), YS = this.yc(), c = pr(0, YS, Z), rp = R * F / Z, self = this, i, j, pts;
      softGlow(bx, c[0], c[1], rp * 1.5, '179,154,112', 0.16 * fade);
      glowPath(bx, arcPts(c[0], c[1], rp * 1.04, 0, Math.PI * 2, 140), small ? 1 : 1.3, 0.5 * fade);
      var line = function (f) { pts = []; for (j = 0; j <= 72; j++) { var q = f(j / 72 * Math.PI * 2), d = self.rot(q[0], q[1], q[2]); if (d[2] < 0) { if (pts.length > 1) thin(bx, pts, 1, 0.1 * fade); pts = []; continue; } pts.push(pr(R * d[0], YS + R * d[1], Z + R * d[2])); } if (pts.length > 1) thin(bx, pts, 1, 0.1 * fade); };
      for (i = -2; i <= 2; i++) { var la = i * 0.5; line(function (t) { return [Math.cos(la) * Math.cos(t), Math.sin(la), Math.cos(la) * Math.sin(t)]; }); }
      for (i = 0; i < 6; i++) { var lo = i * Math.PI / 6; line(function (t) { return [Math.cos(t) * Math.cos(lo), Math.sin(t), Math.cos(t) * Math.sin(lo)]; }); }
    },
    front: function () {}
  };

  /* ---------- filters ---------- */
  var list = [], slots = [], N = 0, wrap = true, cat = 'all', dec = '', query = '', fade = 0, fadeTo = 1, pendingList = null;
  function norm(s) { return (s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي'); }
  function filtered() { var q = norm(query.trim()); return ALL.filter(function (w) { return (cat === 'all' || w.c === cat) && (!dec || (w.y && Math.floor(w.y / 10) * 10 === +dec)) && (!q || norm(w.t + ' ' + (w.cr || '') + ' ' + (w.k || '')).indexOf(q) >= 0); }); }
  function applyFilters(instant) {
    var nl = filtered();
    ui.count.textContent = EN ? (!nl.length ? 'No works' : nl.length === 1 ? '1 work' : nl.length + ' works') : !nl.length ? 'لا أعمال' : nl.length === 1 ? 'عمل واحد' : nl.length === 2 ? 'عملان' : AR(nl.length) + ' ' + (nl.length >= 3 && nl.length <= 10 ? 'أعمال' : 'عملًا');
    ui.empty.hidden = nl.length > 0; ui.live.textContent = ui.count.textContent;
    if (instant) { setList(nl); return; }
    pendingList = nl; fadeTo = 0;
  }
  function setList(nl) { list = nl; N = list.length; slots = nl.map(function (w, i) { return i; }).sort(function (a, b) { return (a * 0.6180339887) % 1 - (b * 0.6180339887) % 1; }); var inv = []; slots.forEach(function (i, r) { inv[i] = r; }); slots = inv; wrap = N >= 7; var withPoster = 0; nl.forEach(function (w) { if (w.i) withPoster++; }); cam = target = wrap && withPoster >= 9 ? 4 : 0; shown = -1; started = performance.now(); fadeTo = 1; if (!N) ui.cap.classList.remove('is-on'); root.classList.toggle('is-empty', !N); rotY = 0; rotX = -0.15; snapTo = N ? 0 : -1; vel = vX = vY = 0; }
  $$('[data-wv-chip]').forEach(function (b) { b.addEventListener('click', function () { cat = b.getAttribute('data-wv-chip'); $$('[data-wv-chip]').forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); }); applyFilters(); }); });
  ui.decade.addEventListener('change', function () { dec = ui.decade.value; applyFilters(); });
  var qT = 0; ui.q.addEventListener('input', function () { clearTimeout(qT); qT = setTimeout(function () { query = ui.q.value; applyFilters(); }, 220); });

  /* ---------- design switch ---------- */
  var NAMES = ['staff', 'film', 'halo', 'spectrum', 'silk', 'zoetrope', 'tunnel', 'fan', 'deck', 'sphere'], design = 'staff';
  function setDesign(d) { if (!designs[d]) d = 'staff'; design = d; vel = vX = vY = 0; snapTo = designs[d].mode === 'sphere' && N ? wi(Math.round(cam)) : -1; cam = target = Math.round(cam); root.setAttribute('data-design', d);
    $$('[data-wv-design]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-wv-design') === d ? 'true' : 'false'); });
    try { history.replaceState(null, '', location.pathname + '?d=' + (NAMES.indexOf(d) + 1) + location.hash); } catch (e) {}
    try { localStorage.setItem('kh-works-design', d); } catch (e) {} }
  $$('[data-wv-design]').forEach(function (b) { b.addEventListener('click', function () { setDesign(b.getAttribute('data-wv-design')); front.focus({ preventScroll: true }); }); });
  (function () { var m = /[?&]d=(\d+)/.exec(location.search), d = m ? NAMES[+m[1] - 1] : null; if (!d) try { d = localStorage.getItem('kh-works-design'); } catch (e) {} setDesign(d || 'staff'); })();

  /* ---------- input ---------- */
  var cam = 0, target = 0, vel = 0, rotX = -0.15, rotY = 0, vX = 0, vY = 0, snapTo = -1, DT = 0.016;
  var lastInput = -1e9, drag = null, mouse = { x: -1, y: -1, in: false }, hits = [], opening = null, wheelT = 0, started = performance.now();
  function cur() { return designs[design]; }
  function mode() { return cur().mode || 'stepped'; }
  function unit() { return cur().unit ? cur().unit() : BH / 1.5 * 1.2 * F / D; }
  function clampT(v) { return wrap ? v : Math.max(0, Math.min(N - 1, v)); }
  function go(d) { lastInput = performance.now(); if (mode() === 'sphere') { snapTo = -1; vX = vY = 0; rotY -= d * 0.5; return; } vel = 0; target = clampT(Math.round(target) + d); }
  front.addEventListener('wheel', function (e) { var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? -e.deltaX : e.deltaY; if (Math.abs(d) < 4) return; e.preventDefault();
    if (performance.now() - wheelT > 380) { go(d > 0 ? 1 : -1); wheelT = performance.now(); } }, { passive: false });
  front.addEventListener('pointerdown', function (e) { front.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: 0, v: 0, vx: 0, vy: 0, t: performance.now() }; vel = vX = vY = 0; lastInput = performance.now(); });
  front.addEventListener('pointermove', function (e) {
    var r = front.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.in = e.pointerType === 'mouse';
    if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y, now = performance.now(), ms = Math.max(1, now - drag.t);
    if (mode() === 'sphere') { var kr = cur().radPx(); rotY -= dx / kr; rotX = Math.max(-1.25, Math.min(1.25, rotX + dy / kr)); drag.vx = -dx / kr / ms * 1000; drag.vy = dy / kr / ms * 1000; snapTo = -1; }
    else { var dd = cur().axis === 'y' ? (Math.abs(dy) > Math.abs(dx) ? dy : dx) : dx, du = dd / unit();
      cam = cam - du; if (!wrap) cam = Math.max(-0.4, Math.min(N - 0.6, cam)); target = cam; drag.v = -du / ms * 1000; }
    drag.t = now; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); lastInput = now;
  });
  front.addEventListener('pointerleave', function () { mouse.in = false; });
  front.addEventListener('pointerup', function (e) {
    if (!drag) return; var d = drag; drag = null; lastInput = performance.now();
    if (d.moved < 6) { var r = front.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top);
      if (h) { if (h.focus) open(h.w); else if (mode() === 'sphere') snapTo = h.k; else { vel = 0; target = clampT(h.k); } } return; }
    if (reduce) { if (mode() !== 'sphere') target = clampT(Math.round(cam)); return; }
    if (mode() === 'sphere') { vY = Math.max(-4, Math.min(4, d.vx)); vX = Math.max(-3, Math.min(3, d.vy)); }
    else if (mode() === 'free') { vel = Math.max(-9, Math.min(9, d.v)); }
    else target = clampT(Math.round(cam + Math.max(-3, Math.min(3, d.v * 0.22))));
  });
  front.addEventListener('keydown', function (e) {
    var fwd = EN ? 'ArrowRight' : 'ArrowLeft', bwd = EN ? 'ArrowLeft' : 'ArrowRight';
    if (e.key === fwd || e.key === 'ArrowUp') go(1); else if (e.key === bwd || e.key === 'ArrowDown') go(-1);
    else if (e.key === 'Enter' || e.key === ' ') { var hi = null; hits.forEach(function (h) { if (h.focus) hi = h; }); if (hi) open(hi.w); } else return; e.preventDefault();
  });
  $$('[data-wv-step]').forEach(function (b) { b.addEventListener('click', function () { go(+b.getAttribute('data-wv-step')); }); });
  function hit(px, py) { for (var i = hits.length - 1; i >= 0; i--) if (inPoly(px, py, hits[i].pts)) return hits[i]; return null; }
  function open(w) { if (opening || !w) return; opening = { w: w, t: 0 }; }
  function wi(k) { return ((k % N) + N) % N; }

  /* ---------- frame ---------- */
  var last = performance.now(), shown = -1;
  function rowLayout(items) {
    var base = Math.round(cam), span = small ? 3 : 4;
    for (var k = base - span; k <= base + span; k++) {
      if (!wrap && (k < 0 || k >= N)) continue;
      var p = k - cam, ap = Math.abs(p); if (ap > span + 0.4) continue;
      var w = list[wi(k)]; need(w);
      var heroK = Math.exp(-p * p * 2.4), h = BH * hf(p), ww = h / 1.5, xc = sOf(p), zc = D + xc * xc / K, yaw = Math.atan(2 * xc / K), cs = Math.cos(yaw), sn = Math.sin(yaw);
      var yc = YC + (design === 'staff' ? (designs.staff.yS(xc) - YC) * (1 - heroK) * 0.6 : 0);
      var a = Math.min(1, (span + 0.4 - ap) / 1.2) * fade;
      items.push(make(w, k, p, a, ap < 0.5, xc, zc, yc, ww, h, cs, sn, heroK));
    }
    items.sort(function (a, b) { return a.depth - b.depth; });
  }
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000 || 0.016), m = mode(); DT = dt; last = now; T = now * 0.001;
    if (!reduce) ph += dt * 0.22;
    if (m === 'sphere') {
      if (!drag) { rotY += vY * dt; rotX = Math.max(-1.25, Math.min(1.25, rotX + vX * dt)); vY *= Math.pow(0.05, dt); vX *= Math.pow(0.05, dt); if (!reduce && lastInput < 0 && snapTo < 0) rotY += dt * 0.09; }
    } else {
      // a slow tour of the works until the visitor takes over
      if (!reduce && !drag && N > 1 && lastInput < 0 && now - started > 6000) { started = now; target = clampT(Math.round(target) + 1); }
      if (!drag) {
        if (m === 'free' && Math.abs(vel) > 0.35) { cam += vel * dt; vel *= Math.pow(0.035, dt); if (!wrap && (cam < 0 || cam > N - 1)) { cam = clampT(cam); vel = 0; } target = cam; }
        else { vel = 0; if (m === 'free') target = clampT(Math.round(target)); cam += (target - cam) * Math.min(1, dt * (reduce ? 30 : 4.2)); }
      }
    }
    // filter transition
    fade += (fadeTo - fade) * Math.min(1, dt * (reduce ? 30 : 7)); if (pendingList && fade < 0.03) { setList(pendingList); pendingList = null; }
    var items = [];
    if (N) { if (cur().layout) cur().layout(items); else rowLayout(items); }
    var hi = hero(items); if (hi && wi(hi.k) !== shown) onFocus(hi.w, wi(hi.k));
    bx.setTransform(DPR, 0, 0, DPR, 0, 0); fx.setTransform(DPR, 0, 0, DPR, 0, 0); fx.clearRect(0, 0, W, H);
    bgFill(0.5);
    items.forEach(function (it) { if (it.alpha < 0.05) return; var c = it.fn(0.5, 0.5), r = Math.abs(it.fn(1, 0.5)[0] - it.fn(0, 0.5)[0]) * (it.focus ? 1.7 : 1.25); softGlow(bx, c[0], c[1], r, it.focus ? '217,180,120' : it.w.rgb, (it.focus ? 0.42 : 0.2) * it.alpha); });
    cur().back(items);
    if (!cur().noFloor) floorShade();
    var op = 1 - (opening ? opening.t : 0);
    items.forEach(function (it) { if (it.mf) mesh(it.mf, it.w.tex, function (u, v) { return 0.3 * Math.pow(v, 2.6); }, it.nu || 10, it.nv || 2, it.alpha * op); });
    hits = [];
    items.forEach(function (it) { if (it.alpha < 0.02) return; mesh(it.fn, it.w.tex, it.light, it.nu || 10, it.nv || 2, it.alpha * op); hits.push({ w: it.w, k: it.k, focus: it.focus, pts: outline(it.fn, 3) }); });
    flushGL();
    items.forEach(function (it) { if (it.alpha < 0.02 || it.noFrame) return; glowPath(fx, outline(it.fn, 8), it.focus ? 2.1 : 1, (it.focus ? 0.95 : 0.5) * it.alpha); });
    cur().front(items);
    fx.fillStyle = grainPat; fx.fillRect(0, 0, W, H);
    var vg = fx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); fx.fillStyle = vg; fx.fillRect(0, 0, W, H);
    var hov = mouse.in && !drag ? hit(mouse.x, mouse.y) : null; front.style.cursor = hov ? 'pointer' : (drag ? 'grabbing' : 'grab');
    if (opening) { opening.t = Math.min(1, opening.t + dt / 0.6); ui.cut.style.opacity = opening.t; if (opening.t >= 1) { location.href = opening.w.h; return; } }
    requestAnimationFrame(frame);
  }
  function make(w, k, p, a, focus, xc, zc, yc, ww, h, cs, sn, heroK) {
    return { w: w, k: k, alpha: a, focus: focus, depth: -Math.abs(p),
      fn: function (u, v) { var X = (u - 0.5) * ww; return pr(xc + X * cs, yc + (v - 0.5) * h, zc + X * sn); },
      mf: function (u, v) { var X = (u - 0.5) * ww; return pr(xc + X * cs, 2 * FY - (yc + (v - 0.5) * h), zc + X * sn); },
      light: function (u) { return 0.86 + 0.18 * heroK - 0.12 * (u - 0.5) * sn * 3; } };
  }
  function onFocus(w, idx) {
    shown = idx; ui.cap.classList.remove('is-on');
    setTimeout(function () {
      ui.cat.textContent = [w.cl, w.y ? AR(w.y) : ''].filter(Boolean).join(' · '); ui.title.textContent = w.t; ui.title.href = w.h; ui.more.href = w.h;
      ui.meta.textContent = w.cr || ''; ui.cap.classList.add('is-on');
    }, 220);
    ui.live.textContent = w.t;
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted && opening) { opening = null; ui.cut.style.opacity = 0; last = performance.now(); requestAnimationFrame(frame); } });
  resize(); applyFilters(true); requestAnimationFrame(frame);
})();
