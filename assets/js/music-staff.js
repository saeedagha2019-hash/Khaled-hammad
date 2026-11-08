/* Music-staff study — the works drawn by the lines of a musical staff.
   A five-line staff flows across the screen as a wave, right to left. Where a work passes, the staff opens
   and fills with more lines, and each line's thickness follows the poster's light (engraving-style), so the
   lines themselves draw the image in the poster's own colours. At the centre the image resolves; leaving,
   it dissolves back into the staff. Same base technique as the reel: curved-screen fold at the sides,
   cadence onto the nearest work, spectral lens, grain, the poster's light spilling onto the dark.
   Listen (opt-in only): the wave dances with the music — its height follows loudness, its shape follows the
   frequency spectrum (lows on the right, highs on the left), and the lines tremble with their bands.
   No notes, no clefs: only the staff, in the site's bronze and ivory. One full-screen shader, no library. */
(function () {
  'use strict';
  var root = document.querySelector('[data-ms]');
  if (!root) return;
  var doc = document;
  var canvas = root.querySelector('canvas');
  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WORKS = JSON.parse(root.querySelector('[data-mm-data]').textContent);
  var ui = {
    title: root.querySelector('[data-mm-title]'), mood: root.querySelector('[data-mm-mood]'), meter: root.querySelector('[data-mm-meter]'),
    listen: root.querySelector('[data-mm-listen]'), listenLabel: root.querySelector('[data-mm-listen-label]'), cut: root.querySelector('[data-mm-cut]'),
    cap: root.querySelector('[data-ms-cap]'), capT: root.querySelector('[data-ms-cap-t]'), capM: root.querySelector('[data-ms-cap-m]')
  };
  if (!gl) { root.classList.add('no-gl'); return; }
  doc.body.classList.add('wc-mode');
  var N = WORKS.length;

  /* ---------- GL ---------- */
  function sh(t, s) { var x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(x); return x; }
  function prog(v, f) { var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); return p; }
  function U(p, n) { var o = {}; n.forEach(function (k) { o[k] = gl.getUniformLocation(p, k); }); return o; }
  var quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  function attr(p) { var l = gl.getAttribLocation(p, 'aP'); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); }
  var VSQ = 'attribute vec2 aP;varying vec2 vUv;void main(){vUv=aP;gl_Position=vec4(aP*2.-1.,0.,1.);}';

  var staffProg = prog(VSQ,
    'precision highp float;varying vec2 vUv;uniform vec2 uRes;uniform float uTime;uniform float uPhase;uniform float uAmp;uniform float uK;uniform float uCam;uniform float uStep;uniform float uN;' +
    'uniform float uPw;uniform float uPh;uniform float uStaffH;uniform float uCy;uniform float uBands[18];uniform float uEq;uniform float uLift;uniform float uFold;uniform float uFill;uniform float uBreath;uniform sampler2D uAtlas;uniform vec3 uGlow[4];' +
    'float bandAt(float xn){float u=clamp(1.-(xn*.5+.5),0.,1.);float bp=u*16.999;float i0=floor(bp);float b0=0.,b1=0.;' +       /* lows on the right */
    'for(int i=0;i<18;i++){float fi=float(i);if(fi==i0)b0=uBands[i];if(fi==i0+1.)b1=uBands[i];}return mix(b0,b1,smoothstep(0.,1.,fract(bp)));}' +
    'vec3 poster(float wi,vec2 uv,float bias){return texture2D(uAtlas,vec2((wi+clamp(uv.x,.002,.998))/4.,clamp(uv.y,.002,.998)*.75),bias).rgb;}' +
    'void main(){vec2 px=vUv*uRes;float X=px.x-uRes.x*.5;float Xn=X/(uRes.x*.5);' +
    'float curve=uFold*Xn*Xn;float worldX=X*(1.+curve*.9);float sy=1./(1.+curve*.55);' +       /* curved screen: the sides recede */
    'float Y=(px.y-uRes.y*uCy)/sy;' +
    'float spec=bandAt(Xn)*uEq;' +
    'float wave=sin(worldX*uK+uPhase)*uAmp+sin(worldX*uK*2.3-uPhase*1.3+1.7)*uAmp*.35+spec*uLift;' +   /* the staff dances */
    'float s=worldX+uCam;float idx=floor(s/uStep+.5);float local=s-idx*uStep;float wi=mod(idx,uN);' +
    'float infl=1.-smoothstep(uPw*.4,uPw*.8,abs(local));' +
    'float halfB=mix(uStaffH*.5,uPh*.5,infl);float vy=(Y-wave)/halfB;' +
    'vec2 uv=vec2(local/uPw+.5,(1.-vy)*.5);' +
    'float inP=infl*step(0.,uv.x)*step(uv.x,1.);' +
    'float presence=1.-smoothstep(0.,uRes.x*.42,abs(X));' +
    'vec3 bg=vec3(.067,.09,.098);' +
    /* the poster's light on the dark */
    'vec3 col=bg;float dy2=(Y-wave)*(Y-wave)/(uPh*uPh*.55);' +                                   /* light from the three nearest works, blended: no seams */
    'for(int q=-1;q<=1;q++){float lq=local-float(q)*uStep;float wq=mod(idx+float(q),uN);' +
    'float glo=exp(-(lq*lq)/(uPw*uPw*.9)-dy2);float pq=1.-smoothstep(0.,uRes.x*.42,abs(X-lq*.0+(-local+lq)));' +
    'vec3 gc=uGlow[0];for(int g=1;g<4;g++){if(float(g)==wq)gc=uGlow[g];}col+=gc*glo*(.18+.5*presence)*(.85+.3*uBreath+spec);}' +
    /* the lines: 65 across the band; every 16th is a staff line, always visible */
    'float lv=(vy+1.)*32.;float j=floor(lv+.5);float d=abs(lv-j);float spacing=(2.*halfB/64.)*sy;float dpx=d*spacing;' +
    'float isStaff=step(mod(j,16.),.5);float inside=step(-.001,j)*step(j,64.001);' +
    'vec3 pc=poster(wi,uv,0.);float lum=dot(pc,vec3(.299,.587,.114));' +
    'float hw=mix(.55,mix(.1,.5,lum)*spacing,inP);' +                                       /* engraving: light makes a thicker line */
    'hw*=1.+spec*.6;' +
    'float a=(1.-smoothstep(hw-.6,hw+.6,dpx))*inside*max(isStaff,smoothstep(.15,.9,infl));' +
    'vec3 staffC=mix(vec3(.70,.60,.44),vec3(.95,.93,.89),.25+.2*uBreath);' +
    'vec3 lineC=mix(staffC,pc*1.35+.04,inP);' +
    'col=mix(col,lineC,a);' +
    'float fill=uFill*presence*presence*inP*(1.-smoothstep(.96,1.04,abs(vy)));' +            /* at the centre the image resolves */
    'col=mix(col,pc*(.92+.08*a),fill);' +
    'col*=1.-.55*smoothstep(.35,1.05,abs(Xn))*uFold;' +
    'gl_FragColor=vec4(col,1.);}');
  var SU = U(staffProg, ['uRes', 'uTime', 'uPhase', 'uAmp', 'uK', 'uCam', 'uStep', 'uN', 'uPw', 'uPh', 'uStaffH', 'uCy', 'uBands', 'uEq', 'uLift', 'uFold', 'uFill', 'uBreath', 'uAtlas', 'uGlow']);

  var lensProg = prog(VSQ,
    'precision highp float;uniform sampler2D uTex;uniform float uTime;uniform float uDistort;uniform float uDark;varying vec2 vUv;' +
    'vec2 barrel(vec2 c,float a){vec2 cc=c-.5;return c+cc*dot(cc,cc)*a;}float sat(float t){return clamp(t,0.,1.);}' +
    'vec4 spec(float t){float lo=step(t,.5);float w=sat(1.-abs(2.*sat((t-1./6.)/(4./6.))-1.));return pow(vec4(lo,1.,1.-lo,1.)*vec4(1.-w,w,1.-w,1.),vec4(1./2.2));}' +
    'float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}' +
    'void main(){vec4 s=vec4(0.),sw=vec4(0.);for(int i=0;i<5;i++){float t=float(i)/5.;vec4 w=spec(t);sw+=w;s+=w*texture2D(uTex,barrel(vUv,-.15*uDistort*t));}' +
    'vec2 u2=vUv*(1.-vUv.yx);float vig=pow(u2.x*u2.y*20.,.05);vec4 col=mix(vec4(0.,0.,0.,1.),s/sw,vig);' +
    'col.rgb+=vec3(hash(gl_FragCoord.xy+uTime*60.))*.035;gl_FragColor=vec4(col.rgb*(1.-uDark),1.);}');
  var LU = U(lensProg, ['uTex', 'uTime', 'uDistort', 'uDark']);

  function newTex() { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE); }); return t; }
  var fbo = gl.createFramebuffer(), fboTex = newTex();
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  /* the four posters share one atlas (power of two, mip-mapped: the blurred levels give the light spill) */
  var glowCols = new Float32Array([.11, .22, .21, .11, .22, .21, .11, .22, .21, .11, .22, .21]);
  var AW = 2048, AH = 1024, atlasCanvas = doc.createElement('canvas'); atlasCanvas.width = AW; atlasCanvas.height = AH;
  var actx = atlasCanvas.getContext('2d'); actx.fillStyle = '#1B3836'; actx.fillRect(0, 0, AW, AH);
  var atlas = newTex();
  function uploadAtlas() {
    gl.bindTexture(gl.TEXTURE_2D, atlas); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.generateMipmap(gl.TEXTURE_2D);
  }
  uploadAtlas();
  WORKS.slice(0, 4).forEach(function (w, i) {
    var im = new Image(); im.onload = function () {
      var s0 = Math.max(512 / im.width, 768 / im.height), dw = im.width * s0, dh = im.height * s0;
      actx.save(); actx.beginPath(); actx.rect(i * 512, 0, 512, 768); actx.clip(); actx.drawImage(im, i * 512 + (512 - dw) / 2, (768 - dh) / 2, dw, dh); actx.restore();
      uploadAtlas();
      var t = doc.createElement('canvas'); t.width = 6; t.height = 9; var tx = t.getContext('2d'); tx.drawImage(im, 0, 0, 6, 9);   // the poster's light: its mean colour, saturated
      var d = tx.getImageData(0, 0, 6, 9).data, r = 0, g = 0, b = 0; for (var k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
      var n = d.length / 4, m = (r + g + b) / (3 * n), sat = 1.6; glowCols.set([Math.max(0, m + (r / n - m) * sat) / 255, Math.max(0, m + (g / n - m) * sat) / 255, Math.max(0, m + (b / n - m) * sat) / 255], i * 3);
    }; im.src = w.img;
  });

  /* ---------- layout ---------- */
  var W = 0, H = 0, R = {}, DPR = 1;
  function resize() {
    var r = canvas.getBoundingClientRect(); DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = r.width; H = r.height; canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    gl.bindTexture(gl.TEXTURE_2D, fboTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    R.small = W < 700; R.k = R.small ? 0.65 : 1;
    R.pw = R.small ? Math.min(W * 0.6, H * 0.3) : Math.min(H * 0.36, 320); R.ph = R.pw * 1.5;
    R.step = R.pw * 1.95; R.staffH = R.small ? 46 : 66; R.cy = 0.55;              // centre line, measured from the bottom
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
  function fadeAll(to, dur) { var now = AC.currentTime; WORKS.forEach(function (w, i) { var g = w.gain.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(i === to ? 0.9 : 0, now + (i === to ? 1.8 : dur)); }); }
  function crossfade(to) {
    if (!AC) return; var w = WORKS[to]; if (w.audio.paused) w.audio.play().catch(function () {});
    fadeAll(to, 1.4); current = to;
    WORKS.forEach(function (o, i) { if (i !== to) setTimeout(function () { if (current !== i) o.audio.pause(); }, 1600); });
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
    if (!listening || !analyser) { level += (0 - level) * 0.05; pulse *= 0.9; for (var z = 0; z < 18; z++) bands[z] *= 0.94; return; }
    analyser.getByteFrequencyData(data);
    var sum = 0, low = 0, n = data.length; for (var i = 0; i < n; i++) { sum += data[i]; if (i < 12) low += data[i]; }
    for (var bi = 0; bi < 18; bi++) {
      var a0 = Math.floor(2 * Math.pow(n / 2, bi / 18)), a1 = Math.max(a0 + 1, Math.floor(2 * Math.pow(n / 2, (bi + 1) / 18))), acc = 0;
      for (var q = a0; q < a1 && q < n; q++) acc += data[q];
      var v0 = Math.max(0, acc / ((a1 - a0) * 255) - 0.15) / 0.85;
      bands[bi] += (v0 - bands[bi]) * (v0 > bands[bi] ? 0.3 : 0.06);          // softer than the equaliser: the staff flows
    }
    var lv = sum / (n * 255), lo = low / (12 * 255);
    level += (lv - level) * (lv > level ? 0.25 : 0.04);
    if (lo - lowPrev > 0.06) pulse = 1;
    lowPrev = lo; pulse *= 0.92;
  }

  /* ---------- input: works travel right → left ---------- */
  var cam = 0, tgt = 0, prev = 0, ens = 0, ring = 0, lastInput = performance.now(), drag = null, opening = null;
  function touchInput() { lastInput = performance.now(); }
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); var f = e.deltaMode === 1 ? 32 : 1; tgt += (e.deltaY - e.deltaX) * f; touchInput(); }, { passive: false });
  canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, v: 0, t: performance.now(), moved: 0 }; touchInput(); });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return; var dx = e.clientX - drag.x, now = performance.now();
    tgt -= dx; drag.v = dx / Math.max(1, now - drag.t); drag.t = now; drag.x = e.clientX; drag.moved += Math.abs(dx); touchInput();
  });
  canvas.addEventListener('pointerup', function (e) {
    if (!drag) return; var d = drag; drag = null;
    if (d.moved < 6) {
      var r = canvas.getBoundingClientRect(), X = e.clientX - r.left - W / 2, Xn = X / (W / 2), wx = X * (1 + 0.7 * Xn * Xn * 0.9);
      var idx = Math.round((wx + cam) / R.step);
      if (idx === Math.round(cam / R.step) && Math.abs(X) < R.pw * 0.7) open(focusWork); else tgt = idx * R.step;
    } else if (!reduce) tgt -= d.v * 260;
    touchInput();
  });
  canvas.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'PageDown') tgt = (Math.round(cam / R.step) + 1) * R.step;     // in Arabic the next work comes in from the right
    else if (e.key === 'ArrowRight' || e.key === 'PageUp') tgt = (Math.round(cam / R.step) - 1) * R.step;
    else if (e.key === 'Enter') { open(focusWork); return; } else return;
    touchInput(); e.preventDefault();
  });
  function open(wi) { if (opening) return; opening = { w: wi, t: 0 }; if (AC && listening) fadeAll(-1, 0.7); }

  /* ---------- frame ---------- */
  var last = performance.now(), focusWork = 0, shown = -1, phase = 0, amp = 10, tempo = WORKS[0].tempo, depth = WORKS[0].depth, calm = 1;
  function frame(now) {
    var dt = Math.min(0.5, (now - last) / 1000 || 0.016), t = now * 0.001; last = now;
    var idle = (now - lastInput) / 1000;
    if (!drag && !opening) {
      if (idle > 4 && !reduce) tgt += dt * 24;                                              // when left alone, the works keep flowing right → left
      else if (idle > 0.38) { var s = Math.round(cam / R.step) * R.step; if (Math.abs(tgt - s) > 0.5) tgt = s; }   // cadence
    }
    cam += (tgt - cam) * (reduce ? 1 : 1 - Math.pow(0.0035, Math.min(dt, 0.05)));
    var v = Math.abs(cam - prev) / (Math.min(dt, 0.05) * 60); prev = cam;
    var target = Math.min(1, v / 40);
    if (target > ens) ens += (target - ens) * 0.3; else { ring = Math.max(ring, ens); ens += (target - ens) * 0.035; }
    ring *= 0.985;
    listenFrame(); eq += ((listening ? 1 : 0) - eq) * 0.05;
    calm += ((listening ? 1 : (idle > 8 ? 0.45 : 1)) - calm) * 0.02;
    var fi = ((Math.round(cam / R.step) % N) + N) % N; focusWork = fi;
    if (focusWork !== shown) {
      shown = focusWork; var fw = WORKS[focusWork];
      ui.title.textContent = fw.t; ui.mood.textContent = fw.moodLabel;
      ui.cap.classList.remove('is-on'); setTimeout(function () { ui.capT.textContent = fw.t; ui.capM.textContent = [fw.cl, fw.y, fw.cr].filter(Boolean).join(' · '); ui.cap.classList.add('is-on'); }, 250);
      if (listening) crossfade(focusWork);
    }
    tempo += (WORKS[focusWork].tempo - tempo) * 0.03; depth += (WORKS[focusWork].depth - depth) * 0.03;
    var breath = 0.5 + 0.5 * Math.sin(t * tempo * 1.4);
    var targetAmp = reduce ? 0 : R.k * (listening ? 10 + level * 70 + pulse * 16 : (12 + 10 * breath) * depth * calm);
    amp += (targetAmp - amp) * 0.06;                                                                  // fluid, never jerky
    phase += dt * 1.9 * tempo * (listening ? 0.7 + level * 2.2 : calm);
    ui.meter.style.setProperty('--lv', (listening ? level * 2.2 : 0.18 * calm * breath).toFixed(3)); ui.meter.style.setProperty('--pulse', pulse.toFixed(3));
    root.classList.toggle('is-scrolled', Math.abs(cam) > 30 || listening);
    var centred = Math.abs(cam - Math.round(cam / R.step) * R.step) < R.step * 0.12; ui.cap.classList.toggle('is-away', !centred);
    var ot = 0; if (opening) { opening.t = Math.min(1, opening.t + dt / 0.75); ot = opening.t; }

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(staffProg); attr(staffProg);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlas); gl.uniform1i(SU.uAtlas, 0);
    gl.uniform2f(SU.uRes, W, H); gl.uniform1f(SU.uTime, t % 1000); gl.uniform1f(SU.uPhase, phase); gl.uniform1f(SU.uAmp, amp);
    gl.uniform1f(SU.uK, (2 * Math.PI) / (R.step * 1.15)); gl.uniform1f(SU.uCam, cam); gl.uniform1f(SU.uStep, R.step); gl.uniform1f(SU.uN, N);
    gl.uniform1f(SU.uPw, R.pw); gl.uniform1f(SU.uPh, R.ph); gl.uniform1f(SU.uStaffH, R.staffH); gl.uniform1f(SU.uCy, R.cy);
    gl.uniform1fv(SU.uBands, bands); gl.uniform1f(SU.uEq, eq); gl.uniform1f(SU.uLift, 90 * R.k); gl.uniform1f(SU.uFold, 0.7);
    gl.uniform3fv(SU.uGlow, glowCols); gl.uniform1f(SU.uFill, 0.86 * (1 - ens * 0.8)); gl.uniform1f(SU.uBreath, breath);                     // moving fast, the image breaks back into lines
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(lensProg); attr(lensProg); gl.bindTexture(gl.TEXTURE_2D, fboTex);
    gl.uniform1i(LU.uTex, 0); gl.uniform1f(LU.uTime, t % 100);
    gl.uniform1f(LU.uDistort, reduce ? 0 : 0.4 + ens * 1.1 + ring * 0.25 * Math.sin(t * 9) + (listening ? pulse * 0.3 : 0)); gl.uniform1f(LU.uDark, ot);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    ui.cut.style.opacity = ot;
    if (opening && opening.t >= 1) { location.href = WORKS[opening.w].href; return; }
    requestAnimationFrame(frame);
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted && opening) { opening = null; last = performance.now(); requestAnimationFrame(frame); } });
  resize(); canvas.focus({ preventScroll: true }); requestAnimationFrame(frame);
})();
