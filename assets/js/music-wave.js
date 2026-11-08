/* Music-wave study — the works laid out across the screen like a sound wave.
   Same technique as the vertical study (perspective planes, fold into depth, slatted posters, light spill,
   spectral lens), turned sideways:
     · a horizontal strip of posters that loops endlessly; in Arabic it runs right-to-left
     · works leaving to either side fold back into depth, like a curved cinema screen
     · ONE continuous transverse wave runs across the whole strip — through every slat of every poster —
       so the row of works reads as a single waveform; its tempo and depth come from the work in focus
     · listen (opt-in only): the screen becomes a frequency spectrum — lows on one side, highs on the other —
       and every slat rises and stretches with its band, so the works themselves become the moving sound
     · cadence, ring-out and silence as in the vertical study; nothing plays until the visitor asks */
(function () {
  'use strict';
  var root = document.querySelector('[data-mw]');
  if (!root) return;
  var doc = document, rtl = doc.documentElement.dir === 'rtl', DIR = rtl ? -1 : 1;
  var canvas = root.querySelector('canvas');
  var gl = canvas.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false });
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && matchMedia('(hover: none)').matches;
  var WORKS = JSON.parse(root.querySelector('[data-mm-data]').textContent);
  var ui = {
    title: root.querySelector('[data-mm-title]'), mood: root.querySelector('[data-mm-mood]'), meter: root.querySelector('[data-mm-meter]'),
    listen: root.querySelector('[data-mm-listen]'), listenLabel: root.querySelector('[data-mm-listen-label]'), cut: root.querySelector('[data-mm-cut]'),
    cursor: root.querySelector('[data-mm-cursor]')
  };
  if (!gl) { root.classList.add('no-gl'); return; }
  doc.body.classList.add('wc-mode');

  /* ---------- GL ---------- */
  function sh(t, s) { var x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(x); return x; }
  function prog(v, f) { var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); return p; }
  function buf(a) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.STATIC_DRAW); return b; }
  function grid(nx, ny) { var a = []; for (var y = 0; y < ny; y++) for (var x = 0; x < nx; x++) { var x0 = x / nx, x1 = (x + 1) / nx, y0 = y / ny, y1 = (y + 1) / ny; a.push(x0, y0, x1, y0, x0, y1, x0, y1, x1, y0, x1, y1); } return a; }
  function U(p, n) { var o = {}; n.forEach(function (k) { o[k] = gl.getUniformLocation(p, k); }); return o; }
  function attr(p, b) { var l = gl.getAttribLocation(p, 'aP'); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); }
  var quad = buf([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), mA = grid(28, 28), mesh = buf(mA), mN = mA.length / 2, cA = grid(36, 2), cmesh = buf(cA), cN = cA.length / 2;
  var NS = 14, GAP = 0.05, sA = [];                        // each poster as slats; the wave runs through all of them
  for (var si = 0; si < NS; si++) for (var sy = 0; sy < 24; sy++) {
    var w0 = (si + GAP / 2) / NS, w1 = (si + 1 - GAP / 2) / NS, ya = sy / 24, yb = (sy + 1) / 24;
    sA.push(w0, ya, w1, ya, w0, yb, w0, yb, w1, ya, w1, yb);
  }
  var smesh = buf(sA), sN = sA.length / 2;

  var VS = 'attribute vec2 aP;uniform vec4 uRect;uniform vec2 uRes;uniform float uCamZ;uniform vec2 uBend;uniform float uTime;uniform float uPhase;uniform float uAmp;uniform float uK;' +
    'uniform float uSlats;uniform float uBands[18];uniform float uEq;uniform float uDir;uniform float uLiftPx;' +
    'varying vec2 vUv;varying float vDepth;varying float vShade;varying float vBand;' +
    'float bandAt(float sx){float u=clamp(sx/uRes.x+.5,0.,1.);if(uDir<0.)u=1.-u;float bp=u*16.999;float i0=floor(bp);float b0=0.,b1=0.;' +
    'for(int i=0;i<18;i++){float fi=float(i);if(fi==i0)b0=uBands[i];if(fi==i0+1.)b1=uBands[i];}return mix(b0,b1,fract(bp))*uEq;}' +
    'void main(){vUv=aP;vec3 p=vec3(uRect.x+aP.x*uRect.z-uRes.x*.5,uRes.y*.5-(uRect.y+aP.y*uRect.w),0.);' +
    'float sx=p.x,lx=0.;if(uSlats>.5){float id=floor(aP.x*uSlats);float c=(id+.5)/uSlats;sx=uRect.x+c*uRect.z-uRes.x*.5;lx=(aP.x-c)*uRect.z;}' +
    'float k=sx*uK*uDir-uPhase;float wave=sin(k)*uAmp;float band=bandAt(sx);' +   /* one wave across the whole strip, plus the spectrum */
    'float cy=uRes.y*.5-(uRect.y+uRect.w*.5)+wave+band*uLiftPx;' +
    'p.y+=wave+band*uLiftPx;' +
    'if(uSlats>.5){p.y=cy+(p.y-cy)*(1.+band*.16);p.z+=cos(k)*uAmp*1.3+band*70.+lx*cos(k)*uAmp*.025;vShade=cos(k)*.35*min(uAmp/14.,1.5)+band*.45;}' +
    'else{p.z+=cos(k)*uAmp*.8;vShade=0.;}vBand=band;' +
    'float n=sin((p.x*.1-p.y)*.03-uTime*1.1)*40.;' +
    'float fold=smoothstep(uBend.x,uBend.y,abs(p.x));p.z-=900.*fold+n*fold;' +    /* works leaving to the sides fold back into depth */
    'float w=(uCamZ-p.z)/uCamZ;vDepth=uCamZ-p.z;gl_Position=vec4(p.x/(uRes.x*.5),p.y/(uRes.y*.5),0.,w);}';
  var planeProg = prog(VS,
    'precision highp float;uniform sampler2D uTex;uniform float uOpacity;uniform float uCamZ;uniform float uLight;uniform float uPresence;varying vec2 vUv;varying float vDepth;varying float vShade;varying float vBand;' +
    'void main(){vec4 c=texture2D(uTex,vUv);' +
    'float g=dot(c.rgb,vec3(.299,.587,.114));vec3 quiet=mix(vec3(g),c.rgb,.6)*.78;c.rgb=mix(quiet,c.rgb*1.04,uPresence);' +
    'c.rgb*=1.+clamp(vShade,-.6,.7)*.55;c.rgb+=vBand*uLight;' +
    'float fog=smoothstep(uCamZ+250.,uCamZ+1300.,vDepth)*.55;c.rgb=mix(c.rgb,vec3(.067,.09,.098),fog);' +
    'c.a*=(1.-smoothstep(uCamZ+1000.,uCamZ+1400.,vDepth))*uOpacity;gl_FragColor=c;}');
  var glowProg = prog(VS,
    'precision highp float;uniform sampler2D uTex;uniform float uGlow;uniform float uCamZ;varying vec2 vUv;varying float vDepth;varying float vBand;' +
    'void main(){vec2 q=(vUv-.5)*2.;float m=1.-smoothstep(.1,1.,length(q*vec2(1.,.94)));m*=m;' +
    'vec3 c=texture2D(uTex,vUv).rgb;float fog=smoothstep(uCamZ+150.,uCamZ+1150.,vDepth);' +
    'gl_FragColor=vec4(c*m*uGlow*(1.+vBand*1.5)*(1.-fog*.6),1.);}');
  var COMMON = ['uRect', 'uRes', 'uCamZ', 'uBend', 'uTime', 'uPhase', 'uAmp', 'uK', 'uSlats', 'uBands', 'uEq', 'uDir', 'uLiftPx', 'uTex'];
  var PU = U(planeProg, COMMON.concat(['uOpacity', 'uLight', 'uPresence'])), GU = U(glowProg, COMMON.concat(['uGlow']));

  var lensProg = prog(
    'attribute vec2 aP;varying vec2 vUv;void main(){vUv=aP;gl_Position=vec4(aP*2.-1.,0.,1.);}',
    'precision highp float;uniform sampler2D uTex;uniform float uTime;uniform float uDistort;uniform float uDark;varying vec2 vUv;' +
    'vec2 barrel(vec2 c,float a){vec2 cc=c-.5;return c+cc*dot(cc,cc)*a;}float sat(float t){return clamp(t,0.,1.);}' +
    'vec4 spec(float t){float lo=step(t,.5);float w=sat(1.-abs(2.*sat((t-1./6.)/(4./6.))-1.));return pow(vec4(lo,1.,1.-lo,1.)*vec4(1.-w,w,1.-w,1.),vec4(1./2.2));}' +
    'float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}' +
    'void main(){vec4 s=vec4(0.),sw=vec4(0.);for(int i=0;i<5;i++){float t=float(i)/5.;vec4 w=spec(t);sw+=w;s+=w*texture2D(uTex,barrel(vUv,-.15*uDistort*t));}' +
    'vec2 u2=vUv*(1.-vUv.yx);float vig=pow(u2.x*u2.y*20.,.05);vec4 col=mix(vec4(0.,0.,0.,1.),s/sw,vig);' +
    'col.rgb+=vec3(hash(gl_FragCoord.xy+uTime*60.))*.035;gl_FragColor=vec4(col.rgb*(1.-uDark),1.);}');
  var LU = U(lensProg, ['uTex', 'uTime', 'uDistort', 'uDark']);
  function tex(src) { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR); });
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE); });
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); return t; }
  var fbo = gl.createFramebuffer(), fboTex = tex(null);

  /* ---------- artwork ---------- */
  function mk(w, h) { var c = doc.createElement('canvas'); c.width = w; c.height = h; return c; }
  var PW = 600, PH = 900, CW = 1100, CH = 200;
  function posterTex(im) {
    var c = mk(PW, PH), x = c.getContext('2d');
    if (!im) { var g = x.createLinearGradient(0, 0, 0, PH); g.addColorStop(0, '#1B3836'); g.addColorStop(1, '#111719'); x.fillStyle = g; x.fillRect(0, 0, PW, PH); return c; }
    var s0 = Math.max(PW / im.width, PH / im.height); x.drawImage(im, (PW - im.width * s0) / 2, (PH - im.height * s0) / 2, im.width * s0, im.height * s0);
    return c;
  }
  function glowTex(im) {
    var small = mk(10, 14), sx = small.getContext('2d');
    if (im) sx.drawImage(im, 0, 0, 10, 14); else { sx.fillStyle = '#1B3836'; sx.fillRect(0, 0, 10, 14); }
    var mid = mk(40, 56); mid.getContext('2d').drawImage(small, 0, 0, 40, 56);
    var c = mk(160, 224), x = c.getContext('2d'); if ('filter' in x) x.filter = 'blur(10px) saturate(1.5)'; x.drawImage(mid, -10, -10, 180, 244);
    return c;
  }
  function caption(w) {
    var c = mk(CW, CH), x = c.getContext('2d'); x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = 'center'; x.textBaseline = 'top';
    x.fillStyle = '#F2EDE3'; var fs = 70; x.font = '700 ' + fs + 'px Amiri';
    while (x.measureText(w.t).width > CW - 40 && fs > 44) { fs -= 4; x.font = '700 ' + fs + 'px Amiri'; }
    x.fillText(w.t, CW / 2, 0);
    x.fillStyle = '#C9CFCB'; x.font = '400 40px "IBM Plex Sans Arabic"'; x.fillText([w.cl, w.y, w.cr].filter(Boolean).join(' · '), CW / 2, 102);
    x.fillStyle = 'rgba(179,154,112,.95)'; x.fillRect(CW / 2 - 70, CH - 8, 140, 3);
    return c;
  }
  var fonts = doc.fonts && doc.fonts.load ? Promise.all(['700 70px Amiri', '400 40px "IBM Plex Sans Arabic"'].map(function (f) { return doc.fonts.load(f).catch(function () {}); })) : Promise.resolve();
  Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1200); })]).then(function () {
    WORKS.forEach(function (w) {
      w.texI = tex(posterTex(null)); w.texG = tex(glowTex(null)); w.texC = tex(caption(w));
      var im = new Image(); im.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, w.texI); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, posterTex(im));
        gl.bindTexture(gl.TEXTURE_2D, w.texG); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glowTex(im));
      }; im.src = w.img;
    });
  });

  /* ---------- layout: an endless strip ---------- */
  var W = 0, H = 0, R = {}, cells = [];
  function resize() {
    var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.bindTexture(gl.TEXTURE_2D, fboTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    R.pw = W < 700 ? Math.min(W * 0.56, H * 0.3) : Math.min(H * 0.36, 320); R.ph = R.pw * 1.5;
    R.step = R.pw + (W < 700 ? 44 : 70);
    R.cw = R.step - 10; R.ch = R.cw * CH / CW; R.gap = 22;
    R.cy = H * (W < 700 ? 0.5 : 0.46);                         // poster centre line
    R.k = W < 700 ? 0.6 : 1;                                   // smaller screens get a gentler wave
    R.camZ = (H / 2) / Math.tan(17.5 * Math.PI / 180);
    var n = WORKS.length, reps = Math.max(2, Math.ceil((W * 3) / (n * R.step)));
    cells = []; for (var i = 0; i < n * reps; i++) cells.push(i % n);
    R.L = cells.length * R.step;
  }
  window.addEventListener('resize', resize);

  /* ---------- audio (opt-in) ---------- */
  var AC = null, analyser = null, data = null, listening = false, current = -1;
  function initAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return false;
    AC = new Ctx(); analyser = AC.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.6; data = new Uint8Array(analyser.frequencyBinCount);
    analyser.connect(AC.destination);
    WORKS.forEach(function (w) {
      w.audio = new Audio(); w.audio.src = w.track; w.audio.loop = true; w.audio.preload = 'none'; w.audio.crossOrigin = 'anonymous';
      w.gain = AC.createGain(); w.gain.gain.value = 0; AC.createMediaElementSource(w.audio).connect(w.gain); w.gain.connect(analyser);
    });
    return true;
  }
  function fadeAll(to, dur) { var now = AC.currentTime; WORKS.forEach(function (w, i) { var g = w.gain.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(i === to ? 0.9 : 0, now + (i === to ? 1.6 : dur)); }); }
  function crossfade(to) {
    if (!AC) return;
    var w = WORKS[to]; if (w.audio.paused) w.audio.play().catch(function () {});
    fadeAll(to, 1.2); current = to;
    WORKS.forEach(function (o, i) { if (i !== to) setTimeout(function () { if (current !== i) o.audio.pause(); }, 1400); });
  }
  ui.listen.addEventListener('click', function () {
    if (!AC && !initAudio()) return;
    if (AC.state === 'suspended') AC.resume();
    listening = !listening;
    ui.listen.setAttribute('aria-pressed', listening ? 'true' : 'false');
    ui.listenLabel.textContent = listening ? ui.listen.dataset.on : ui.listen.dataset.off;
    if (listening) { current = -1; crossfade(focusWork); }
    else { fadeAll(-1, 0.9); WORKS.forEach(function (w) { setTimeout(function () { w.audio.pause(); }, 1000); }); current = -1; }
  });
  var level = 0, pulse = 0, lowPrev = 0, bands = new Float32Array(18), eq = 0;
  function listenFrame() {
    if (!listening || !analyser) { level += (0 - level) * 0.05; pulse *= 0.9; for (var z = 0; z < 18; z++) bands[z] *= 0.92; return; }
    analyser.getByteFrequencyData(data);
    var sum = 0, low = 0, n = data.length; for (var i = 0; i < n; i++) { sum += data[i]; if (i < 12) low += data[i]; }
    for (var bi = 0; bi < 18; bi++) {
      var a0 = Math.floor(2 * Math.pow(n / 2, bi / 18)), a1 = Math.max(a0 + 1, Math.floor(2 * Math.pow(n / 2, (bi + 1) / 18))), acc = 0;
      for (var q = a0; q < a1 && q < n; q++) acc += data[q];
      var v0 = Math.max(0, acc / ((a1 - a0) * 255) - 0.15) / 0.85;
      bands[bi] += (v0 - bands[bi]) * (v0 > bands[bi] ? 0.5 : 0.08);
    }
    var lv = sum / (n * 255), lo = low / (12 * 255);
    level += (lv - level) * (lv > level ? 0.35 : 0.05);
    if (lo - lowPrev > 0.06) pulse = 1;
    lowPrev = lo; pulse *= 0.9;
  }

  /* ---------- input: horizontal ---------- */
  var cam = 0, tgt = 0, prev = 0, ens = 0, ring = 0, lastInput = performance.now(), drag = null, mouse = { x: -1, y: -1, in: false }, opening = null;
  function touchInput() { lastInput = performance.now(); }
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); var f = e.deltaMode === 1 ? 32 : 1; tgt += (e.deltaY + e.deltaX * DIR) * f; touchInput(); }, { passive: false });
  canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, v: 0, t: performance.now(), moved: 0 }; touchInput(); });
  canvas.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.in = e.pointerType === 'mouse';
    if (!drag) return; var dx = e.clientX - drag.x, now = performance.now();
    tgt -= DIR * dx; drag.v = dx / Math.max(1, now - drag.t); drag.t = now; drag.x = e.clientX; drag.moved += Math.abs(dx); touchInput();
  });
  canvas.addEventListener('pointerleave', function () { mouse.in = false; });
  canvas.addEventListener('pointerup', function (e) {
    if (!drag) return; var d = drag; drag = null;
    if (d.moved < 6) { var r = canvas.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top); if (h >= 0) open(h); }
    else if (!reduce) tgt -= DIR * d.v * 260;
    touchInput();
  });
  canvas.addEventListener('keydown', function (e) {
    var next = rtl ? 'ArrowLeft' : 'ArrowRight', back = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === next || e.key === 'PageDown') tgt = (Math.round(cam / R.step) + 1) * R.step;
    else if (e.key === back || e.key === 'PageUp') tgt = (Math.round(cam / R.step) - 1) * R.step;
    else if (e.key === 'Enter') { open(focusWork); return; } else return;
    touchInput(); e.preventDefault();
  });
  var rects = [];
  function hit(x, y) { for (var i = 0; i < rects.length; i++) { var r = rects[i]; if (r && x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return r[4]; } return -1; }
  function open(wi) { if (opening) return; opening = { w: wi, t: 0 }; if (AC && listening) fadeAll(-1, 0.7); }

  /* ---------- frame ---------- */
  var last = performance.now(), focusWork = 0, shown = -1, phase = 0, amp = 10, tempo = WORKS[0].tempo, depth = WORKS[0].depth, calm = 1;
  function frame(now) {
    var dt = Math.min(0.5, (now - last) / 1000 || 0.016), t = now * 0.001; last = now;
    if (!drag && now - lastInput > 380 && !opening) { var s = Math.round(cam / R.step) * R.step; if (Math.abs(tgt - s) > 0.5) tgt = s; }   // cadence
    cam += (tgt - cam) * (reduce ? 1 : 1 - Math.pow(0.0035, Math.min(dt, 0.05)));
    var v = Math.abs(cam - prev) / (Math.min(dt, 0.05) * 60); prev = cam;
    var target = Math.min(1, v / 40);
    if (target > ens) ens += (target - ens) * 0.3; else { ring = Math.max(ring, ens); ens += (target - ens) * 0.035; }
    ring *= 0.985;
    listenFrame(); eq += ((listening ? 1 : 0) - eq) * 0.06;
    var idle = (now - lastInput) / 1000, rest = listening ? 1 : (idle > 4 ? Math.max(0.15, 1 - (idle - 4) / 5) : 1);
    calm += (rest - calm) * 0.02;
    var fi = ((Math.round(cam / R.step) % cells.length) + cells.length) % cells.length; focusWork = cells[fi];
    if (focusWork !== shown) { shown = focusWork; var fw = WORKS[focusWork]; ui.title.textContent = fw.t; ui.mood.textContent = fw.moodLabel; if (listening) crossfade(focusWork); }
    // the wave takes its tempo and depth from the work in focus, gliding between them
    tempo += (WORKS[focusWork].tempo - tempo) * 0.03; depth += (WORKS[focusWork].depth - depth) * 0.03;
    var breath = 0.65 + 0.35 * Math.sin(t * tempo * 1.4);
    var targetAmp = reduce ? 0 : R.k * (listening ? 8 + level * 40 + pulse * 10 : 16 * depth * breath * calm);
    amp += (targetAmp - amp) * 0.08;
    phase += dt * 2.2 * tempo * (listening ? 0.7 + level * 2.5 : calm);
    ui.meter.style.setProperty('--lv', (listening ? level * 2.2 : 0.18 * calm * breath).toFixed(3)); ui.meter.style.setProperty('--pulse', pulse.toFixed(3));
    ui.cursor.style.transform = 'translate(' + mouse.x + 'px,' + mouse.y + 'px)'; ui.cursor.classList.toggle('is-on', mouse.in && !touch);
    root.classList.toggle('is-scrolled', Math.abs(cam) > 30 || listening);
    var ot = 0; if (opening) { opening.t = Math.min(1, opening.t + dt / 0.75); ot = opening.t; }

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.067, 0.09, 0.098, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.enable(gl.BLEND); gl.activeTexture(gl.TEXTURE0);
    var K = (2 * Math.PI) / (R.step * 1.35);
    function common(u) {
      gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uCamZ, R.camZ); gl.uniform2f(u.uBend, W * 0.24, W * 0.95); gl.uniform1f(u.uTime, reduce ? 0 : t);
      gl.uniform1f(u.uPhase, phase); gl.uniform1f(u.uK, K); gl.uniform1fv(u.uBands, bands); gl.uniform1f(u.uEq, eq); gl.uniform1f(u.uDir, DIR); gl.uniform1i(u.uTex, 0);
    }
    gl.useProgram(glowProg); common(GU); gl.useProgram(planeProg); common(PU);
    var hov = mouse.in ? hit(mouse.x, mouse.y) : -1; ui.cursor.classList.toggle('is-hover', hov >= 0);
    rects = [];
    var order = [];
    for (var c = 0; c < cells.length; c++) {
      var rel = ((c * R.step - cam) % R.L + R.L) % R.L; if (rel > R.L / 2) rel -= R.L;
      var cx = W / 2 + DIR * rel; if (cx < -R.step * 2 || cx > W + R.step * 2) continue;
      order.push([Math.abs(rel), cx, cells[c]]);
    }
    order.sort(function (a, b) { return b[0] - a[0]; });                 // far sides first, the focus last
    order.forEach(function (o) {
      var w = WORKS[o[2]]; if (!w.texI) return;
      var presence = 1 - Math.min(1, o[0] / (W * 0.5 + R.step * 0.4)); presence = presence * presence * (3 - 2 * presence);
      var x = o[1] - R.pw / 2, y = R.cy - R.ph / 2, alpha = 1 - ot, lift = hov === o[2] && o[0] < R.step / 2 ? 1 : 0;
      if (o[0] < R.step * 1.5) rects.push([x, y, R.pw, R.ph + R.gap + R.ch, o[2]]);
      // light spill
      gl.useProgram(glowProg); attr(glowProg, mesh); gl.blendFunc(gl.ONE, gl.ONE);
      var gw = R.pw * 2.3, gh = R.ph * 1.6;
      gl.uniform4f(GU.uRect, o[1] - gw / 2, R.cy - gh / 2, gw, gh); gl.uniform1f(GU.uAmp, amp * 0.6); gl.uniform1f(GU.uSlats, 0); gl.uniform1f(GU.uLiftPx, 40 * R.k);
      gl.uniform1f(GU.uGlow, (0.22 + 0.7 * presence) * (listening ? 0.8 + level * 1.6 : 0.85 + 0.15 * breath) * (1 + 0.25 * lift) * alpha);
      gl.bindTexture(gl.TEXTURE_2D, w.texG); gl.drawArrays(gl.TRIANGLES, 0, mN);
      // the poster, in slats
      gl.useProgram(planeProg); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      var grow = 1 + 0.035 * lift;
      gl.uniform4f(PU.uRect, o[1] - R.pw * grow / 2, R.cy - R.ph * grow / 2, R.pw * grow, R.ph * grow);
      gl.uniform1f(PU.uAmp, amp); gl.uniform1f(PU.uSlats, NS); gl.uniform1f(PU.uLiftPx, 70 * R.k);
      gl.uniform1f(PU.uPresence, 0.3 + 0.7 * presence); gl.uniform1f(PU.uOpacity, alpha); gl.uniform1f(PU.uLight, 0.25);
      attr(planeProg, smesh); gl.bindTexture(gl.TEXTURE_2D, w.texI); gl.drawArrays(gl.TRIANGLES, 0, sN);
      // caption rides the same wave
      gl.uniform4f(PU.uRect, o[1] - R.cw / 2, R.cy + R.ph / 2 + R.gap, R.cw, R.ch);
      gl.uniform1f(PU.uSlats, 0); gl.uniform1f(PU.uLiftPx, 70 * R.k); gl.uniform1f(PU.uPresence, Math.max(0.45, presence)); gl.uniform1f(PU.uLight, 0.08);
      attr(planeProg, cmesh); gl.bindTexture(gl.TEXTURE_2D, w.texC); gl.drawArrays(gl.TRIANGLES, 0, cN);
    });

    gl.disable(gl.BLEND); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(lensProg); attr(lensProg, quad); gl.bindTexture(gl.TEXTURE_2D, fboTex);
    gl.uniform1i(LU.uTex, 0); gl.uniform1f(LU.uTime, t % 100);
    gl.uniform1f(LU.uDistort, reduce ? 0 : 0.4 + ens * 1.1 + ring * 0.25 * Math.sin(t * 9) + (listening ? pulse * 0.35 : 0)); gl.uniform1f(LU.uDark, ot);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    ui.cut.style.opacity = ot;
    if (opening && opening.t >= 1) { location.href = WORKS[opening.w].href; return; }
    requestAnimationFrame(frame);
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted && opening) { opening = null; last = performance.now(); requestAnimationFrame(frame); } });
  resize(); canvas.focus({ preventScroll: true }); requestAnimationFrame(frame);
})();
