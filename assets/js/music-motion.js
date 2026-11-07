/* Music-motion study — four works, motion that behaves like a film score.
   Builds on the works reel (perspective planes that fold away as they rise, ripple, spectral lens) and adds:
     · breath   — each work has its own tempo and depth; the ripple swells and settles like a phrase
     · arc      — a card enters dim, reaches its peak at the focus line, and fades as it leaves (crescendo → diminuendo)
     · ensemble — scroll speed brings the "full orchestra" (stronger dispersion and fold); stopping lets it ring out
     · cadence  — after a gesture the reel resolves gently onto the nearest work, like a phrase resolving
     · listen   — opt-in only: the focused work's own excerpt plays, the motion follows its loudness and pulse,
                  and moving to another work cross-fades to its music
     · silence  — with no input and no music, the motion slowly comes to rest
   Raw WebGL + Web Audio, no library. Nothing plays until the visitor presses the listen button. */
(function () {
  'use strict';
  var root = document.querySelector('[data-mm]');
  if (!root) return;
  var doc = document, rtl = doc.documentElement.dir === 'rtl';
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
  var quad = buf([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), mA = grid(28, 28), mesh = buf(mA), mN = mA.length / 2, cA = grid(28, 2), cmesh = buf(cA), cN = cA.length / 2;

  var VS =     'attribute vec2 aP;uniform vec4 uRect;uniform vec2 uRes;uniform float uCamZ;uniform vec2 uBend;uniform float uTime;uniform float uPhase;uniform float uAmp;uniform float uFold;uniform float uHOff;' +
    'varying vec2 vUv;varying float vDepth;varying float vRipple;' +
    'void main(){vUv=aP;vec3 p=vec3(uRect.x+aP.x*uRect.z-uRes.x*.5,uRes.y*.5-(uRect.y+aP.y*uRect.w),0.);' +
    'float n=sin((p.x-p.y*.1)*.03-uTime*1.1+cos(p.z*.04)*10.)*50.;float n2=sin((p.x+p.y*.1)*.01-uTime*.4)*.5;' +
    'float r=sin((p.x-p.y)*.02-uPhase)*12.*uAmp;p.z+=r;' +                         /* the phrase: amplitude and tempo per work */
    'float b=smoothstep(uBend.x,uBend.y,p.y);p.z-=1200.*uFold*b+n*b;' +
    'p.y-=(1.5-n2)*smoothstep(uBend.x*1.1,uBend.y*.7,p.y)*uHOff;' +
    'float w=(uCamZ-p.z)/uCamZ;vDepth=uCamZ-p.z;vRipple=r;gl_Position=vec4(p.x/(uRes.x*.5),p.y/(uRes.y*.5),0.,w);}';
  var planeProg = prog(VS,
    'precision highp float;uniform sampler2D uTex;uniform float uInner;uniform float uOpacity;uniform float uCamZ;uniform float uLight;uniform float uPresence;varying vec2 vUv;varying float vDepth;varying float vRipple;' +
    'void main(){vec4 c=texture2D(uTex,(vUv-.5)/uInner+.5);' +
    'float g=dot(c.rgb,vec3(.299,.587,.114));vec3 quiet=mix(vec3(g),c.rgb,.35)*.42;' +   /* entering / leaving: muted */
    'c.rgb=mix(quiet,c.rgb*1.04,uPresence);' +                                            /* at the focus: full colour */
    'c.rgb+=smoothstep(0.,10.,vRipple*.3)*uLight;' +
    'float fog=smoothstep(uCamZ+150.,uCamZ+1150.,vDepth);c.rgb=mix(c.rgb,vec3(.067,.09,.098),fog);' +
    'c.a*=(1.-smoothstep(uCamZ+900.,uCamZ+1250.,vDepth))*uOpacity;gl_FragColor=c;}');
  // light spill: the poster lights the dark room around it like a screen — soft elliptical falloff, no edges
  var glowProg = prog(VS,
    'precision highp float;uniform sampler2D uTex;uniform float uGlow;uniform float uCamZ;varying vec2 vUv;varying float vDepth;' +
    'void main(){vec2 q=(vUv-.5)*2.;float m=1.-smoothstep(.1,1.,length(q*vec2(1.,.94)));m*=m;' +
    'vec3 c=texture2D(uTex,vUv).rgb;float fog=smoothstep(uCamZ+150.,uCamZ+1150.,vDepth);' +
    'gl_FragColor=vec4(c*m*uGlow*(1.-fog),1.);}');
  var GU = U(glowProg, ['uRect', 'uRes', 'uCamZ', 'uBend', 'uTime', 'uPhase', 'uAmp', 'uFold', 'uHOff', 'uTex', 'uGlow']);
  var PU = U(planeProg, ['uRect', 'uRes', 'uCamZ', 'uBend', 'uTime', 'uPhase', 'uAmp', 'uFold', 'uHOff', 'uTex', 'uInner', 'uOpacity', 'uLight', 'uPresence']);

  var lensProg = prog(
    'attribute vec2 aP;varying vec2 vUv;void main(){vUv=aP;gl_Position=vec4(aP*2.-1.,0.,1.);}',
    'precision highp float;uniform sampler2D uTex;uniform float uTime;uniform float uDistort;uniform float uDark;varying vec2 vUv;' +
    'vec2 barrel(vec2 c,float a){vec2 cc=c-.5;return c+cc*dot(cc,cc)*a;}float sat(float t){return clamp(t,0.,1.);}' +
    'vec4 spec(float t){float lo=step(t,.5);float w=sat(1.-abs(2.*sat((t-1./6.)/(4./6.))-1.));return pow(vec4(lo,1.,1.-lo,1.)*vec4(1.-w,w,1.-w,1.),vec4(1./2.2));}' +
    'float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}' +
    'void main(){vec4 s=vec4(0.),sw=vec4(0.);for(int i=0;i<5;i++){float t=float(i)/5.;vec4 w=spec(t);sw+=w;s+=w*texture2D(uTex,barrel(vUv,-.15*uDistort*t));}' +
    'vec2 u2=vUv*(1.-vUv.yx);float vig=pow(u2.x*u2.y*20.,.05);vec4 col=mix(vec4(0.,0.,0.,1.),s/sw,vig);' +
    'col.rgb+=vec3(hash(gl_FragCoord.xy+uTime*60.))*.07*.05+vec3(hash(gl_FragCoord.xy+uTime*60.))*.035;' +
    'gl_FragColor=vec4(col.rgb*(1.-uDark),1.);}');                                       /* uDark: the "cut to black" */
  var LU = U(lensProg, ['uTex', 'uTime', 'uDistort', 'uDark']);

  function tex(src) { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR); });
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE); });
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); return t; }
  var fbo = gl.createFramebuffer(), fboTex = tex(null);

  /* ---------- artwork (site palette & fonts) ---------- */
  function mk(w, h) { var c = doc.createElement('canvas'); c.width = w; c.height = h; return c; }
  var PW = 600, PH = 900, CW = 1200, CH = 210;
  function posterTex(im) {                       // the poster itself, untouched, as the moving surface
    var c = mk(PW, PH), x = c.getContext('2d');
    if (!im) { var g = x.createLinearGradient(0, 0, 0, PH); g.addColorStop(0, '#1B3836'); g.addColorStop(1, '#111719'); x.fillStyle = g; x.fillRect(0, 0, PW, PH); return c; }
    var s0 = Math.max(PW / im.width, PH / im.height); x.drawImage(im, (PW - im.width * s0) / 2, (PH - im.height * s0) / 2, im.width * s0, im.height * s0);
    return c;
  }
  function glowTex(im) {                         // the poster's own colours, diffused, for the light it casts
    var small = mk(10, 14), sx = small.getContext('2d');
    if (im) sx.drawImage(im, 0, 0, 10, 14); else { sx.fillStyle = '#1B3836'; sx.fillRect(0, 0, 10, 14); }
    var mid = mk(40, 56), mx = mid.getContext('2d'); mx.imageSmoothingEnabled = true; mx.drawImage(small, 0, 0, 40, 56);
    var c = mk(160, 224), x = c.getContext('2d'); x.imageSmoothingEnabled = true;
    if ('filter' in x) x.filter = 'blur(10px) saturate(1.5)';
    x.drawImage(mid, -10, -10, 180, 244);
    return c;
  }
  function caption(w) {
    var c = mk(CW, CH), x = c.getContext('2d'); x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = 'center'; x.textBaseline = 'top';
    x.fillStyle = '#F2EDE3'; x.font = '700 70px Amiri'; x.fillText(w.t, CW / 2, 0);
    x.fillStyle = '#C9CFCB'; x.font = '400 40px "IBM Plex Sans Arabic"'; x.fillText([w.cl, w.y, w.cr].filter(Boolean).join(' · '), CW / 2, 104);
    x.fillStyle = 'rgba(179,154,112,.95)'; x.fillRect(CW / 2 - 70, CH - 8, 140, 3);   // the leitmotif: a short bronze line
    return c;
  }
  var fonts = doc.fonts && doc.fonts.load ? Promise.all(['700 56px Amiri', '400 40px "IBM Plex Sans Arabic"'].map(function (f) { return doc.fonts.load(f).catch(function () {}); })) : Promise.resolve();
  Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1200); })]).then(function () {
    WORKS.forEach(function (w) {
      w.texI = tex(posterTex(null)); w.texG = tex(glowTex(null)); w.texC = tex(caption(w));
      var im = new Image(); im.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, w.texI); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, posterTex(im));
        gl.bindTexture(gl.TEXTURE_2D, w.texG); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glowTex(im));
      }; im.src = w.img;
    });
  });

  /* ---------- layout ---------- */
  var W = 0, H = 0, R = {};
  function resize() {
    var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.bindTexture(gl.TEXTURE_2D, fboTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    R.pw = W < 700 ? Math.min(W * 0.6, 300) : Math.min(H * 0.4, 360); R.ph = R.pw * 1.5;
    R.cw = Math.min(W - 32, R.pw * 1.8); R.ch = R.cw * CH / CW; R.gap = 18;
    R.h = R.ph + R.gap + R.ch; R.row = R.h + (W < 700 ? 70 : 90);
    R.focus = H * 0.48;                                         // the "now" line where a work reaches its peak
    R.top = R.focus - R.h / 2;                                  // the first work starts on the focus line
    R.max = (WORKS.length - 1) * R.row;
    R.camZ = (H / 2) / Math.tan(17.5 * Math.PI / 180);
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
  function crossfade(to) {                                     // like a dissolve between two scenes' music
    if (!AC) return; var now = AC.currentTime;
    WORKS.forEach(function (w, i) {
      var g = w.gain.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
      if (i === to) { if (w.audio.paused) w.audio.play().catch(function () {}); g.linearRampToValueAtTime(0.9, now + 1.6); }
      else { g.linearRampToValueAtTime(0, now + 1.2); (function (a) { setTimeout(function () { if (current !== WORKS.indexOf(w)) a.pause(); }, 1400); })(w.audio); }
    });
    current = to;
  }
  ui.listen.addEventListener('click', function () {
    if (!AC && !initAudio()) return;
    if (AC.state === 'suspended') AC.resume();
    listening = !listening;
    ui.listen.setAttribute('aria-pressed', listening ? 'true' : 'false');
    ui.listenLabel.textContent = listening ? ui.listen.dataset.on : ui.listen.dataset.off;
    if (listening) { current = -1; crossfade(focusIdx); }
    else { var now = AC.currentTime; WORKS.forEach(function (w) { w.gain.gain.cancelScheduledValues(now); w.gain.gain.setValueAtTime(w.gain.gain.value, now); w.gain.gain.linearRampToValueAtTime(0, now + 0.9); setTimeout(function () { w.audio.pause(); }, 1000); }); current = -1; }
  });
  var level = 0, pulse = 0, lowPrev = 0;
  function listenFrame() {
    if (!listening || !analyser) { level += (0 - level) * 0.05; pulse *= 0.9; return; }
    analyser.getByteFrequencyData(data);
    var sum = 0, low = 0, n = data.length; for (var i = 0; i < n; i++) { sum += data[i]; if (i < 12) low += data[i]; }
    var lv = sum / (n * 255), lo = low / (12 * 255);
    level += (lv - level) * (lv > level ? 0.35 : 0.05);           // envelope follower: quick attack, slow release
    if (lo - lowPrev > 0.06) pulse = 1;                            // an onset in the low strings / percussion
    lowPrev = lo; pulse *= 0.9;
  }

  /* ---------- input: scroll, drag, keys, cadence ---------- */
  var cam = 0, tgt = 0, prev = 0, ens = 0, ring = 0, lastInput = performance.now(), drag = null, mouse = { x: -1, y: -1, in: false }, opening = null;
  function clamp() { tgt = Math.max(0, Math.min(R.max, tgt)); }
  function touchInput() { lastInput = performance.now(); }
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); tgt += e.deltaY * (e.deltaMode === 1 ? 32 : 1); clamp(); touchInput(); }, { passive: false });
  canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); drag = { y: e.clientY, v: 0, t: performance.now(), moved: 0 }; touchInput(); });
  canvas.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.in = e.pointerType === 'mouse';
    if (!drag) return; var dy = e.clientY - drag.y, now = performance.now();
    tgt -= dy; clamp(); drag.v = dy / Math.max(1, now - drag.t); drag.t = now; drag.y = e.clientY; drag.moved += Math.abs(dy); touchInput();
  });
  canvas.addEventListener('pointerleave', function () { mouse.in = false; });
  canvas.addEventListener('pointerup', function (e) {
    if (!drag) return; var d = drag; drag = null;
    if (d.moved < 6) { var r = canvas.getBoundingClientRect(), i = hit(e.clientY - r.top, e.clientX - r.left); if (i >= 0) open(i); }
    else if (!reduce) { tgt -= d.v * 280; clamp(); }
    touchInput();
  });
  canvas.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') tgt = Math.round(cam / R.row + 1) * R.row;
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') tgt = Math.round(cam / R.row - 1) * R.row;
    else if (e.key === 'Enter') { open(focusIdx); return; } else return;
    clamp(); touchInput(); e.preventDefault();
  });
  var rects = [];
  function hit(y, x) { for (var i = 0; i < rects.length; i++) { var r = rects[i]; if (r && x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return i; } return -1; }
  function open(i) {                                            // a cut: music and picture dip to black together
    if (opening) return; opening = { i: i, t: 0 };
    if (AC && listening) { var now = AC.currentTime; WORKS.forEach(function (w) { w.gain.gain.cancelScheduledValues(now); w.gain.gain.setValueAtTime(w.gain.gain.value, now); w.gain.gain.linearRampToValueAtTime(0, now + 0.7); }); }
  }

  /* ---------- frame ---------- */
  var last = performance.now(), focusIdx = 0, shownIdx = -1, phase = WORKS.map(function () { return 0; }), amp = WORKS.map(function () { return 1; }), calm = 1;
  function frame(now) {
    var dt = Math.min(0.5, (now - last) / 1000 || 0.016), t = now * 0.001; last = now;
    // cadence: shortly after the last gesture, resolve onto the nearest work
    if (!drag && now - lastInput > 380 && !opening) { var s = Math.round(cam / R.row) * R.row; if (Math.abs(tgt - s) > 0.5) tgt = s; }
    cam += (tgt - cam) * (reduce ? 1 : 1 - Math.pow(0.0035, Math.min(dt, 0.05)));
    var v = Math.abs(cam - prev) / (Math.min(dt, 0.05) * 60); prev = cam;
    // ensemble: speed brings in the full orchestra; on release it rings out slowly
    var target = Math.min(1, v / 40);
    if (target > ens) ens += (target - ens) * 0.3; else { ring = Math.max(ring, ens); ens += (target - ens) * 0.035; }
    ring *= 0.985;
    listenFrame();
    // silence: with no gesture and no music, the motion comes to rest
    var idle = (now - lastInput) / 1000, rest = listening ? 1 : (idle > 4 ? Math.max(0.12, 1 - (idle - 4) / 5) : 1);
    calm += (rest - calm) * 0.02;
    focusIdx = Math.max(0, Math.min(WORKS.length - 1, Math.round(cam / R.row)));
    if (focusIdx !== shownIdx) {
      shownIdx = focusIdx; var w = WORKS[focusIdx];
      ui.title.textContent = w.t; ui.mood.textContent = w.moodLabel;
      if (listening) crossfade(focusIdx);
    }
    ui.meter.style.setProperty('--lv', (listening ? level * 2.2 : 0.18 * calm * (0.6 + 0.4 * Math.sin(t * WORKS[focusIdx].tempo * 2.4))).toFixed(3));
    ui.meter.style.setProperty('--pulse', pulse.toFixed(3));
    ui.cursor.style.transform = 'translate(' + mouse.x + 'px,' + mouse.y + 'px)'; ui.cursor.classList.toggle('is-on', mouse.in && !touch);
    var ot = 0; if (opening) { opening.t = Math.min(1, opening.t + dt / 0.75); ot = opening.t; }

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.067, 0.09, 0.098, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(planeProg); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(PU.uTex, 0);
    gl.uniform2f(PU.uRes, W, H); gl.uniform1f(PU.uCamZ, R.camZ); gl.uniform2f(PU.uBend, H * 0.2, H * 0.85); gl.uniform1f(PU.uTime, reduce ? 0 : t);
    var hov = mouse.in ? hit(mouse.y, mouse.x) : -1; ui.cursor.classList.toggle('is-hover', hov >= 0);
    rects = [];
    WORKS.forEach(function (w, i) {
      // breath: each work's own tempo and depth; with music, its loudness and pulses drive the phrase
      var music = listening && i === focusIdx;
      var breath = 0.6 + 0.4 * Math.sin(t * w.tempo * 1.6 + i);
      var targetAmp = reduce ? 0 : (music ? w.depth * (0.35 + level * 3.2 + pulse * 0.8) : w.depth * breath * calm);
      amp[i] += (targetAmp - amp[i]) * 0.08;
      phase[i] += dt * 2 * w.tempo * (music ? 0.7 + level * 2.5 : calm);
      var y = R.top + i * R.row - cam;
      if (y > H + 40 || y + R.row < -H * 0.9 || !w.texI) { rects[i] = null; return; }
      // arc: presence peaks on the focus line, muted while entering and leaving
      var cy = y + R.h / 2, presence = 1 - Math.min(1, Math.abs(cy - R.focus) / (H * 0.42)); presence = presence * presence * (3 - 2 * presence);
      var px = (W - R.pw) / 2, alpha = 1 - ot, lift = hov === i ? 1 : 0;
      rects[i] = [Math.min(px, (W - R.cw) / 2), y, Math.max(R.pw, R.cw), R.h];
      var glow = (0.22 + 0.75 * presence) * (music ? 0.75 + level * 2.4 + pulse * 0.7 : 0.82 + 0.18 * breath * calm) * (1 + 0.25 * lift) * alpha;
      // light spill, folding and waving with the poster
      gl.useProgram(glowProg); attr(glowProg, mesh); gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform2f(GU.uRes, W, H); gl.uniform1f(GU.uCamZ, R.camZ); gl.uniform2f(GU.uBend, H * 0.2, H * 0.85); gl.uniform1f(GU.uTime, reduce ? 0 : t); gl.uniform1i(GU.uTex, 0);
      gl.uniform1f(GU.uPhase, phase[i]); gl.uniform1f(GU.uAmp, amp[i] * 0.6); gl.uniform1f(GU.uFold, 1); gl.uniform1f(GU.uHOff, 1);
      var gw = R.pw * 2.5, gh = R.ph * 1.75;
      gl.uniform4f(GU.uRect, (W - gw) / 2, y + R.ph / 2 - gh / 2, gw, gh); gl.uniform1f(GU.uGlow, glow);
      gl.bindTexture(gl.TEXTURE_2D, w.texG); gl.drawArrays(gl.TRIANGLES, 0, mN);
      // the poster itself
      gl.useProgram(planeProg); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(PU.uPhase, phase[i]); gl.uniform1f(PU.uAmp, amp[i]); gl.uniform1f(PU.uFold, 1); gl.uniform1f(PU.uPresence, presence);
      gl.bindTexture(gl.TEXTURE_2D, w.texI); attr(planeProg, mesh);
      var grow = 1 + 0.035 * lift + (music ? pulse * 0.012 : 0), gpw = R.pw * grow, gph = R.ph * grow;
      gl.uniform4f(PU.uRect, (W - gpw) / 2, y + (R.ph - gph) / 2, gpw, gph); gl.uniform1f(PU.uHOff, 1); gl.uniform1f(PU.uInner, 1);
      gl.uniform1f(PU.uOpacity, alpha); gl.uniform1f(PU.uLight, 0.1 + (music ? level * 0.45 + pulse * 0.1 : 0));
      gl.drawArrays(gl.TRIANGLES, 0, mN);
      // caption
      gl.bindTexture(gl.TEXTURE_2D, w.texC); attr(planeProg, cmesh);
      gl.uniform4f(PU.uRect, (W - R.cw) / 2, y + R.ph + R.gap, R.cw, R.ch); gl.uniform1f(PU.uHOff, R.ph / R.ch); gl.uniform1f(PU.uInner, 1);
      gl.uniform1f(PU.uPresence, Math.max(presence, 0.35)); gl.uniform1f(PU.uLight, music ? pulse * 0.25 : 0.03); gl.drawArrays(gl.TRIANGLES, 0, cN);
    });

    gl.disable(gl.BLEND); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(lensProg); attr(lensProg, quad); gl.bindTexture(gl.TEXTURE_2D, fboTex);
    gl.uniform1i(LU.uTex, 0); gl.uniform1f(LU.uTime, t % 100);
    var distort = reduce ? 0 : 0.4 + ens * 1.1 + ring * 0.25 * Math.sin(t * 9) + (listening ? pulse * 0.35 : 0);
    gl.uniform1f(LU.uDistort, distort); gl.uniform1f(LU.uDark, ot);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    ui.cut.style.opacity = ot;
    if (opening && opening.t >= 1) { location.href = WORKS[opening.i].href; return; }
    requestAnimationFrame(frame);
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted && opening) { opening = null; last = performance.now(); requestAnimationFrame(frame); } });
  resize(); canvas.focus({ preventScroll: true }); requestAnimationFrame(frame);
})();
