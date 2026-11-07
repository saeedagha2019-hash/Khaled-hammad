/* Works — WebGL presentation views (raw WebGL, no library).

   "reel" (default) follows the projects-list technique of unseen.co, rebuilt in the site's identity:
     · each work is a landscape image plane plus a caption plane, laid out in a column (two on wide screens)
       inside a perspective scene whose camera matches CSS pixels;
     · smooth, bounded scrolling moves the planes up; in the vertex shader every vertex is pushed back in
       depth by its height on screen (smoothstep over a "bend point" band, plus noise), so cards fold away
       and recede into fog as they rise, while cards entering from below stay flat;
     · a constant diagonal ripple waves the planes and lifts the light where they crest;
     · a full-screen lens pass: barrel distortion with five-step spectral dispersion, vignette and grain;
     · hover zooms the image inside its frame.
   "canvas": an infinite draggable field of posters with depth parallax.
   The accessible list stays in the DOM; reduced-motion and no-WebGL visitors get it by default. */
(function () {
  'use strict';
  var root = document.querySelector('[data-wc]');
  if (!root) return;
  var doc = document, html = doc.documentElement, body = doc.body;
  var rtl = html.dir === 'rtl';
  var canvas = root.querySelector('[data-wc-canvas]');
  var gl = canvas.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  var toggles = [].slice.call(doc.querySelectorAll('[data-view]'));
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && matchMedia('(hover: none)').matches;
  if (!gl) { toggles.forEach(function (b) { if (b.dataset.view !== 'list') b.hidden = true; }); doc.querySelectorAll('.view-toggle').forEach(function (v) { v.hidden = true; }); return; }

  var RAW = JSON.parse(root.querySelector('[data-wc-data]').textContent);
  var DATA = (function (d) {   // featured works first, then spread the works that have posters evenly
    var feat = d.filter(function (x) { return x.f; }).sort(function (a, b) { return a.f - b.f; });
    d = d.filter(function (x) { return !x.f; });
    var withP = d.filter(function (x) { return x.i; }), rest = d.filter(function (x) { return !x.i; }), out = [];
    var step = withP.length ? Math.max(1, Math.round(d.length / withP.length)) : 1;
    while (withP.length || rest.length) { for (var k = 0; k < step - 1 && rest.length; k++) out.push(rest.shift()); if (withP.length) out.push(withP.shift()); else if (rest.length) out.push(rest.shift()); }
    return feat.concat(out);
  })(RAW.slice());
  var label = root.querySelector('[data-wc-label]'), cursor = root.querySelector('[data-wc-cursor]'), endCta = root.querySelector('[data-wc-end]');
  var lCat = label.querySelector('.wcl-cat'), lTitle = label.querySelector('.wcl-title'), lMeta = label.querySelector('.wcl-meta');
  var COL = { bg: [0.067, 0.09, 0.098], teal2: '#1B3836', char: '#111719', bronze: '#B39A70', ivory: '#F2EDE3', dim: '#C9CFCB' };
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
  function grid(nx, ny) { var a = []; for (var y = 0; y < ny; y++) for (var x = 0; x < nx; x++) { var x0 = x / nx, x1 = (x + 1) / nx, y0 = y / ny, y1 = (y + 1) / ny; a.push(x0, y0, x1, y0, x0, y1, x0, y1, x1, y0, x1, y1); } return a; }
  var quad = buf([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
  var meshArr = grid(24, 24), mesh = buf(meshArr), meshN = meshArr.length / 2;       // image planes
  var capArr = grid(24, 2), capMesh = buf(capArr), capN = capArr.length / 2;          // caption planes
  function uniforms(p, names) { var o = {}; names.forEach(function (n) { o[n] = gl.getUniformLocation(p, n); }); return o; }
  function attr(p, b) { var l = gl.getAttribLocation(p, 'aP'); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); }

  // reel planes: perspective scene in CSS pixels (origin at screen centre, y up)
  var reelProg = prog(
    'attribute vec2 aP;uniform vec4 uRect;uniform vec2 uRes;uniform float uCamZ;uniform vec2 uBendPoint;uniform float uTime;uniform float uHeightOffset;uniform vec2 uShift;uniform float uFlat;' +
    'varying vec2 vUv;varying float vDepth;varying float vRipple;' +
    'void main(){vUv=aP;' +
    'vec3 p=vec3(uRect.x+aP.x*uRect.z-uRes.x*.5,uRes.y*.5-(uRect.y+aP.y*uRect.w),0.);' +
    'float wave=1.-uFlat;' +
    'float noise=sin((p.x-p.y*.1)*.03-uTime*1.1+cos(p.z*.04)*10.)*50.;' +
    'float noise2=sin((p.x+p.y*.1)*.01-uTime*.4)*.5;' +
    'float ripple=sin((p.x-p.y)*.02-uTime*2.)*12.*wave;p.z+=ripple;' +
    'float b=smoothstep(uBendPoint.x,uBendPoint.y,p.y)*wave;' +
    'p.z-=1200.*b;p.z-=noise*b;' +
    'p.y-=(1.5-noise2)*smoothstep(uBendPoint.x*1.1,uBendPoint.y*.7,p.y)*uHeightOffset*wave;' +
    'p.xy+=uShift;' +
    'float w=(uCamZ-p.z)/uCamZ;vDepth=uCamZ-p.z;vRipple=ripple;' +
    'gl_Position=vec4(p.x/(uRes.x*.5),p.y/(uRes.y*.5),0.,w);}',
    'precision highp float;uniform sampler2D uTex;uniform float uInner;uniform float uOpacity;uniform float uCamZ;uniform float uLight;varying vec2 vUv;varying float vDepth;varying float vRipple;' +
    'void main(){vec2 uv=(vUv-.5)/uInner+.5;vec4 c=texture2D(uTex,uv);' +
    'c.rgb+=smoothstep(0.,10.,vRipple*.3)*uLight;' +                           /* light lifts where the wave crests */
    'float fog=smoothstep(uCamZ+150.,uCamZ+1150.,vDepth);c.rgb=mix(c.rgb,vec3(.067,.09,.098),fog);' +
    'c.a*=(1.-smoothstep(uCamZ+900.,uCamZ+1250.,vDepth))*uOpacity;gl_FragColor=c;}');
  var RU = uniforms(reelProg, ['uRect', 'uRes', 'uCamZ', 'uBendPoint', 'uTime', 'uHeightOffset', 'uShift', 'uFlat', 'uTex', 'uInner', 'uOpacity', 'uLight']);

  // free-canvas planes (2D)
  var itemProg = prog(
    'attribute vec2 aP;uniform vec4 uRect;uniform vec2 uRes;varying vec2 vUv;' +
    'void main(){vUv=aP;vec2 p=uRect.xy+aP*uRect.zw;gl_Position=vec4(p.x/uRes.x*2.-1.,1.-p.y/uRes.y*2.,0.,1.);}',
    'precision mediump float;uniform sampler2D uTex;uniform float uAlpha;uniform float uDim;uniform float uLift;varying vec2 vUv;' +
    'void main(){vec4 c=texture2D(uTex,vUv);float g=dot(c.rgb,vec3(.299,.587,.114));' +
    'c.rgb=mix(c.rgb,vec3(g)*vec3(.82,.9,.88),uDim*.7)*(1.-uDim*.45);c.rgb+=uLift*.035;' +
    'gl_FragColor=vec4(mix(vec3(.067,.09,.098),c.rgb,uAlpha),1.);}');
  var IU = uniforms(itemProg, ['uRect', 'uRes', 'uTex', 'uAlpha', 'uDim', 'uLift']);

  // lens pass (reel): barrel distortion with spectral dispersion, vignette, grain
  var lensProg = prog(
    'attribute vec2 aP;varying vec2 vUv;void main(){vUv=aP;gl_Position=vec4(aP*2.-1.,0.,1.);}',
    'precision highp float;uniform sampler2D uTex;uniform float uTime;uniform float uMaxDistort;uniform float uBendAmount;uniform float uVignette;varying vec2 vUv;' +
    'vec2 barrel(vec2 c,float a){vec2 cc=c-.5;float d=dot(cc,cc);return c+cc*d*a;}' +
    'float sat(float t){return clamp(t,0.,1.);}float linterp(float t){return sat(1.-abs(2.*t-1.));}float remap(float t,float a,float b){return sat((t-a)/(b-a));}' +
    'vec4 spectrum(float t){float lo=step(t,.5);float hi=1.-lo;float w=linterp(remap(t,1./6.,5./6.));return pow(vec4(lo,1.,hi,1.)*vec4(1.-w,w,1.-w,1.),vec4(1./2.2));}' +
    'float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}' +
    'void main(){vec4 sumc=vec4(0.),sumw=vec4(0.);' +
    'for(int i=0;i<5;i++){float t=float(i)/5.;vec4 w=spectrum(t);sumw+=w;sumc+=w*texture2D(uTex,barrel(vUv,uBendAmount*uMaxDistort*t));}' +
    'vec2 uv2=vUv*(1.-vUv.yx);float vig=pow(uv2.x*uv2.y*20.,uVignette);' +
    'vec4 col=mix(vec4(vec3(.0),1.),sumc/sumw,vig);' +
    'col+=vec4(vec3(hash12(gl_FragCoord.xy+uTime*60.)),.05)*.07;gl_FragColor=vec4(col.rgb,1.);}');
  var LU = uniforms(lensProg, ['uTex', 'uTime', 'uMaxDistort', 'uBendAmount', 'uVignette']);

  // speed post pass (free canvas)
  var postProg = prog(
    'attribute vec2 aP;varying vec2 vUv;void main(){vUv=aP;gl_Position=vec4(aP*2.-1.,0.,1.);}',
    'precision mediump float;uniform sampler2D uTex;uniform vec2 uRes;uniform vec2 uMouse;uniform vec2 uMVel;uniform float uSpeed;uniform float uTime;uniform float uLens;varying vec2 vUv;' +
    'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}' +
    'void main(){vec2 c=vUv-.5;float asp=uRes.x/uRes.y;float r2=dot(c*vec2(asp,1.),c*vec2(asp,1.));' +
    'float k=.035+.24*uSpeed;vec2 uv=.5+c*(1.-k*r2);' +
    'vec2 d=(uv-uMouse)*vec2(asp,1.);float m=exp(-dot(d,d)*14.)*uLens;uv-=d/vec2(asp,1.)*m*.05;' +
    'uv-=uMVel*exp(-dot(d,d)*9.)*.6;vec2 off=c*(.0015+.026*uSpeed);' +
    'vec3 col=vec3(texture2D(uTex,uv+off).r,texture2D(uTex,uv).g,texture2D(uTex,uv-off).b);' +
    'if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)col=vec3(.067,.09,.098);' +
    'float vig=1.-smoothstep(.25,1.05,length(c*vec2(1.,1.15)));col*=mix(.45,1.,vig);' +
    'col+=(h(vUv*uRes+uTime)-.5)*.05;gl_FragColor=vec4(col,1.);}');
  var PU = uniforms(postProg, ['uTex', 'uRes', 'uMouse', 'uMVel', 'uSpeed', 'uTime', 'uLens']);

  function newTex(src) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    return t;
  }
  function upload(t, src) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }
  var fbo = gl.createFramebuffer(), fboTex = newTex(null);

  /* ---------- artwork, drawn in the site's palette and fonts ---------- */
  function mk(w, h) { var c = doc.createElement('canvas'); c.width = w; c.height = h; return c; }
  function wrapText(ctx, text, maxW, maxL) {
    var words = text.split(/\s+/), lines = [], line = '';
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line); return lines.slice(0, maxL || 5);
  }
  function fit(ctx, text, maxW) { if (ctx.measureText(text).width <= maxW) return text; while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1); return text + '…'; }
  function setDir(x) { x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; }
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
  // landscape image plane, 820 × 430 like the reference: framed poster over its own blurred backdrop
  var IW = 1230, IH = 645;
  function reelImage(it, im) {
    var c = mk(IW, IH), x = c.getContext('2d');
    if (im) {
      var bs = Math.max(IW / im.width, IH / im.height), bw = im.width * bs, bh = im.height * bs;
      if ('filter' in x) { x.filter = 'blur(30px) saturate(.85) brightness(.7)'; x.drawImage(im, (IW - bw) / 2 - 50, (IH - bh) / 2 - 50, bw + 100, bh + 100); x.filter = 'none'; }
      else {
        var src = im; [[48, 26], [144, 76], [432, 226]].forEach(function (z, k) { var t = mk(z[0], z[1]), tx = t.getContext('2d');
          if (k === 0) { var q = Math.max(z[0] / im.width, z[1] / im.height); tx.drawImage(im, (z[0] - im.width * q) / 2, (z[1] - im.height * q) / 2, im.width * q, im.height * q); } else tx.drawImage(src, 0, 0, z[0], z[1]); src = t; });
        x.drawImage(src, 0, 0, IW, IH); x.fillStyle = 'rgba(17,23,25,.3)'; x.fillRect(0, 0, IW, IH);
      }
      var ph = IH * 0.84, pw = ph * im.width / im.height;
      x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 44; x.shadowOffsetY = 16; x.drawImage(im, (IW - pw) / 2, (IH - ph) / 2, pw, ph); x.shadowColor = 'transparent';
      return c;
    }
    var g = x.createLinearGradient(0, 0, IW, IH); g.addColorStop(0, COL.teal2); g.addColorStop(1, '#0E1415'); x.fillStyle = g; x.fillRect(0, 0, IW, IH);
    x.strokeStyle = 'rgba(179,154,112,.42)'; x.lineWidth = 2.5; x.strokeRect(26, 26, IW - 52, IH - 52);
    x.textAlign = 'center'; x.direction = rtl ? 'rtl' : 'ltr';
    x.fillStyle = COL.bronze; x.font = '500 ' + (rtl ? 32 : 26) + 'px ' + F.sans; x.fillText(rtl ? it.cl : it.cl.toUpperCase(), IW / 2, 104);
    x.fillStyle = COL.ivory; var fs = rtl ? 96 : 100; x.font = '400 ' + fs + 'px ' + F.disp;
    var lines = wrapText(x, it.t, IW - 220, 2), lh = fs * (rtl ? 1.35 : 1.05), y0 = IH / 2 + fs * .35 - (lines.length - 1) * lh / 2;
    lines.forEach(function (l, i) { x.fillText(l, IW / 2, y0 + i * lh); });
    x.fillStyle = 'rgba(201,207,203,.78)'; x.font = '400 30px Inter'; x.fillText(it.y ? String(it.y) : '—', IW / 2, IH - 70);
    return c;
  }
  // caption plane, 820 × 74 like the reference: bold title, description, hairline, corner arrow
  var CW = 1640, CH = 148;
  function reelCaption(it) {
    var c = mk(CW, CH), x = c.getContext('2d'), sx = rtl ? CW : 0; setDir(x); x.textBaseline = 'top';
    x.fillStyle = COL.ivory; x.font = (rtl ? '700 56px ' : '600 58px ') + F.disp; x.fillText(fit(x, it.t, CW - 120), sx, rtl ? -6 : 0);
    x.fillStyle = COL.dim; x.font = '400 40px ' + F.sans; x.fillText(fit(x, [it.cl, it.y, it.cr].filter(Boolean).join(' · '), CW - 120), sx, rtl ? 70 : 72);
    x.fillStyle = 'rgba(242,237,227,.55)'; x.fillRect(0, CH - 3, CW, 3);
    var ax = rtl ? 6 : CW - 6, ay = CH - 26, d = rtl ? 1 : -1;      // ↘ / ↙
    x.strokeStyle = COL.bronze; x.lineWidth = 3.5; x.lineCap = 'round'; x.beginPath();
    x.moveTo(ax + d * 28, ay - 28); x.lineTo(ax, ay); x.lineTo(ax + d * 20, ay); x.moveTo(ax, ay); x.lineTo(ax, ay - 20); x.stroke();
    return c;
  }
  var fontsReady = (doc.fonts && doc.fonts.load) ? Promise.all(['400 54px "Cormorant Garamond"', '600 50px "Cormorant Garamond"', '400 52px Amiri', '700 50px Amiri', '500 20px Inter', '400 34px Inter', '500 26px "IBM Plex Sans Arabic"', '400 34px "IBM Plex Sans Arabic"'].map(function (f) { return doc.fonts.load(f).catch(function () {}); })) : Promise.resolve();
  fontsReady = Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 1200); })]);

  /* textures are made only for cards on screen and released when unused (keeps phone GPU memory low) */
  var ready = false, frameNo = 0, budget = 0, liveTex = [], MAXT = { texI: 14, texC: 20, tex: 54 };
  fontsReady.then(function () { ready = true; });
  function make(it, key) { return key === 'texI' ? reelImage(it, it.img) : key === 'texC' ? reelCaption(it) : portrait(it, it.img); }
  function tex_(it, key) {
    if (it[key]) { it[key + 'U'] = frameNo; return it[key]; }
    if (!ready || budget <= 0) return null;
    budget--;
    it[key] = newTex(make(it, key)); it[key + 'U'] = frameNo; liveTex.push([it, key]);
    if (it.i && !it.img && !it.loading) {
      it.loading = true; var im = new Image(); im.decoding = 'async';
      im.onload = function () { it.img = im; if (it.tex) upload(it.tex, portrait(it, im)); if (it.texI) upload(it.texI, reelImage(it, im)); };
      im.src = it.i;
    }
    var mine = liveTex.filter(function (e) { return e[1] === key; });
    if (mine.length > MAXT[key]) {
      mine.sort(function (a, b) { return a[0][key + 'U'] - b[0][key + 'U']; });
      mine.slice(0, mine.length - MAXT[key]).forEach(function (e) { if (e[0][key + 'U'] < frameNo - 2) { gl.deleteTexture(e[0][key]); e[0][key] = null; liveTex.splice(liveTex.indexOf(e), 1); } });
    }
    return it[key];
  }

  /* ---------- layout ---------- */
  var W = 0, H = 0, DPR = 1, cells = [], SW = 0, SH = 0, cw = 0, chh = 0, items = DATA;
  var R = { cols: 1, w: 0, ih: 0, ch: 0, row: 0, gap: 0, top: 0, max: 0, camZ: 1000 };
  function rand(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function layout() {
    cells = [];
    var n = items.length || 1;
    if (mode === 'reel') {
      R.cols = W >= 900 ? 2 : 1; R.gap = R.cols > 1 ? 24 : 0;
      R.w = R.cols > 1 ? Math.min((W - 2 * Math.max(48, W * 0.08) - R.gap) / 2, 600) : Math.min(W - 32, 620);
      R.ih = R.w * 430 / 820; R.ch = R.w * 74 / 820; R.row = R.ih + 10 + R.ch + (R.cols > 1 ? 40 : 30);
      R.top = W < 700 ? 150 : 170;
      R.camZ = (H / 2) / Math.tan(17.5 * Math.PI / 180);           // ~35° field of view, 1 unit = 1 CSS px at z = 0
      var rows = Math.ceil(n / R.cols);
      R.max = Math.max(0, rows * R.row - (H - R.top) + 140);
      for (var i = 0; i < n; i++) {
        var col = i % R.cols, row = Math.floor(i / R.cols), cx = R.cols > 1 ? (rtl ? 1 - col : col) : 0;
        cells.push({ it: items[i], x: (W - (R.w * R.cols + R.gap * (R.cols - 1))) / 2 + cx * (R.w + R.gap), by: row * R.row, hov: 0, rects: [], delay: Math.min(i, 6) * 0.07 });
      }
      return;
    }
    var side = Math.max(5, Math.round(Math.sqrt(2 * n)));
    cw = Math.max(128, Math.min(232, W * 0.145)); chh = cw * 1.5;
    var sx = cw * 1.58, sy = chh * 1.24; SW = side * sx; SH = side * sy;
    for (var rr = 0; rr < side; rr++) for (var c = 0; c < side; c++) {
      var ii = rr * side + c, k = (c + rr * (n > 12 ? 7 : 2)) % n;
      cells.push({ it: items[k], bx: c * sx + (rand(ii + 7) - .5) * sx * .45, by: rr * sy + (rand(ii + 13) - .5) * sy * .35, d: 0.78 + rand(ii) * 0.4, hov: 0, rects: [], delay: rand(ii + 21) * 0.5 });
    }
    cells.sort(function (a, b) { return a.d - b.d; });
  }
  function resize() {
    var r = canvas.getBoundingClientRect(); DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    gl.bindTexture(gl.TEXTURE_2D, fboTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    layout(); if (mode === 'reel') tgt.y = Math.min(tgt.y, R.max);
  }
  window.addEventListener('resize', function () { if (!root.hidden) resize(); });

  /* ---------- input ---------- */
  var cam = { x: 0, y: 0 }, tgt = { x: 0, y: 0 }, prev = { x: 0, y: 0 }, speed = 0, time = 0;
  var mouse = { x: -1, y: -1, px: -1, py: -1, vx: 0, vy: 0, in: false, sx: 0, sy: 0 }, lens = 0;
  var drag = null, hovered = null, opening = null, appearT = 0, fade = 1, fadeTo = 1, pendingItems = null;
  function clampT() { if (mode === 'reel') tgt.y = Math.max(0, Math.min(R.max, tgt.y)); }
  canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: 0, vx: 0, vy: 0, t: performance.now() }; root.classList.add('is-dragging'); });
  canvas.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.in = e.pointerType === 'mouse' || !!drag;
    if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y, now = performance.now(), dt = Math.max(1, now - drag.t);
      if (mode !== 'reel') tgt.x -= dx * 1.15;
      tgt.y -= dy * (mode === 'reel' ? 1 : 1.15); clampT();
      drag.vx = dx / dt; drag.vy = dy / dt; drag.t = now; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    }
  });
  canvas.addEventListener('pointerleave', function () { mouse.in = false; });
  function endDrag(e) {
    if (!drag) return; var d = drag, click = d.moved < 6; drag = null; root.classList.remove('is-dragging');
    if (!click && !reduce) { tgt.y -= d.vy * 300; if (mode !== 'reel') tgt.x -= d.vx * 260; clampT(); }   // fling
    if (click && e.type === 'pointerup') { var r = canvas.getBoundingClientRect(); var h = hit(e.clientX - r.left, e.clientY - r.top); if (h) open(h); }
    if (e.pointerType !== 'mouse') mouse.in = false;
  }
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault(); var f = e.deltaMode === 1 ? 32 : 1;
    if (mode === 'reel') { tgt.y += (e.deltaY + e.deltaX) * f; clampT(); }
    else { tgt.x += (e.shiftKey ? e.deltaY : e.deltaX) * f; tgt.y += (e.shiftKey ? 0 : e.deltaY) * f; }
  }, { passive: false });
  canvas.addEventListener('keydown', function (e) {
    var k = e.key, s = mode === 'reel' ? R.row : 160;
    if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) tgt.y += s;
    else if (k === 'ArrowUp' || k === 'PageUp') tgt.y -= s;
    else if (k === 'Home') tgt.y = 0; else if (k === 'End' && mode === 'reel') tgt.y = R.max;
    else if (mode !== 'reel' && k === 'ArrowLeft') tgt.x -= s; else if (mode !== 'reel' && k === 'ArrowRight') tgt.x += s;
    else if (k === 'Enter') { var h = nearestCenter(); if (h) open(h); } else return;
    clampT(); e.preventDefault();
  });
  function hit(x, y) {
    for (var i = cells.length - 1; i >= 0; i--) { var rs = cells[i].rects;
      for (var j = 0; j < rs.length; j++) { var r = rs[j]; if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return { c: cells[i], r: r }; } }
    return null;
  }
  function nearestCenter() { var best = null, bd = 1e9, cy = mode === 'reel' ? R.top + R.ih / 2 : H / 2; cells.forEach(function (c) { c.rects.forEach(function (r) { var dx = r[0] + r[2] / 2 - W / 2, dy = r[1] + r[3] / 2 - cy, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = { c: c, r: r }; } }); }); return best; }
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
    var realDt = Math.min(0.5, (now - last) / 1000 || 0.016), dt = Math.min(0.05, realDt); last = now; time = now * 0.001;
    var ease = reduce ? 1 : 1 - Math.pow(mode === 'reel' ? 0.0035 : 0.0009, dt);   // smooth, ASScroll-like easing
    cam.x += (tgt.x - cam.x) * ease; cam.y += (tgt.y - cam.y) * ease;
    var v = Math.hypot(cam.x - prev.x, cam.y - prev.y) / (dt * 60); prev.x = cam.x; prev.y = cam.y;
    speed += (Math.min(1, v / 55) - speed) * 0.12; if (reduce) speed = 0;
    if (mouse.px >= 0) { mouse.vx += ((mouse.x - mouse.px) / W - mouse.vx) * 0.2; mouse.vy += ((mouse.y - mouse.py) / H - mouse.vy) * 0.2; }
    mouse.px = mouse.x; mouse.py = mouse.y; mouse.vx *= 0.9; mouse.vy *= 0.9;
    var mx = mouse.in && !touch ? (mouse.x / W - .5) : 0, my = mouse.in && !touch ? (mouse.y / H - .5) : 0;
    mouse.sx += (mx - mouse.sx) * 0.05; mouse.sy += (my - mouse.sy) * 0.05;
    lens += ((mouse.in && !drag ? 1 : 0) - lens) * 0.08;
    appearT = Math.min(1, appearT + realDt / (reduce ? 0.01 : 1.2));          // real time, so slow devices never stall the reveal
    fade += (fadeTo - fade) * (reduce ? 1 : Math.min(1, realDt * 11));
    if (pendingItems && fade < 0.03) { items = pendingItems; pendingItems = null; layout(); cam.y = tgt.y = prev.y = 0; appearT = 0; fadeTo = 1; }

    var hh = (!drag && mouse.in && !opening) ? hit(mouse.x, mouse.y) : null, hov = hh ? hh.c : null;
    if (hov !== hovered) { hovered = hov; showLabel(hov); }
    cursor.style.transform = 'translate(' + mouse.x + 'px,' + mouse.y + 'px)';
    label.style.transform = 'translate(' + mouse.x + 'px,' + mouse.y + 'px)';
    cursor.classList.toggle('is-on', mouse.in && !touch);
    if (endCta) endCta.classList.toggle('is-on', mode === 'reel' && R.max > 0 && cam.y > R.max - 60);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(COL.bg[0], COL.bg[1], COL.bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
    var op = opening; if (op) op.t = Math.min(1, op.t + realDt / 0.8);
    var ot = op ? (1 - Math.pow(1 - op.t, 3)) : 0;
    if (mode === 'reel') renderReel(time, ot, op); else renderField(ot, op);

    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fboTex);
    if (mode === 'reel') {
      gl.useProgram(lensProg); attr(lensProg, quad);
      gl.uniform1i(LU.uTex, 0); gl.uniform1f(LU.uTime, time % 100);
      gl.uniform1f(LU.uMaxDistort, reduce ? 0 : 0.4 + ot * 0.6); gl.uniform1f(LU.uBendAmount, -0.15); gl.uniform1f(LU.uVignette, 0.05);
    } else {
      gl.useProgram(postProg); attr(postProg, quad);
      gl.uniform1i(PU.uTex, 0); gl.uniform2f(PU.uRes, W, H);
      gl.uniform2f(PU.uMouse, mouse.x / W, 1 - mouse.y / H); gl.uniform2f(PU.uMVel, reduce ? 0 : mouse.vx, reduce ? 0 : -mouse.vy);
      gl.uniform1f(PU.uSpeed, speed + ot * 0.5); gl.uniform1f(PU.uTime, time % 100); gl.uniform1f(PU.uLens, reduce ? 0 : lens);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (op && op.t >= 1) { running = false; location.href = op.c.it.h; return; }
    requestAnimationFrame(frame);
  }

  function renderReel(t, ot, op) {
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(reelProg); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(RU.uTex, 0);
    gl.uniform2f(RU.uRes, W, H); gl.uniform1f(RU.uCamZ, R.camZ); gl.uniform1f(RU.uTime, reduce ? 0 : t);
    gl.uniform2f(RU.uBendPoint, H * 0.2, H * 0.85);                         // the band (above centre → past the top) where cards fold away
    gl.uniform2f(RU.uShift, -mouse.sx * 18, mouse.sy * 12);                 // gentle camera drift with the mouse
    var anyHover = hovered ? 1 : 0;
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i]; c.rects = [];
      c.hov += ((c === hovered ? 1 : 0) - c.hov) * 0.1;
      var a = Math.max(0, Math.min(1, (appearT - c.delay) / 0.6)), ae = 1 - Math.pow(1 - a, 3);
      var y = R.top + c.by - cam.y + (1 - ae) * 120;
      if (y > H + 60 || y + R.row < -H * 0.9) continue;                   // cards above the top are still drawn while they recede
      var isOp = op && op.c === c, alpha = ae * fade * (op && !isOp ? 1 - ot : 1);
      var rect = [c.x, y, R.w, R.ih];
      if (isOp) { var tw = Math.min(W, 1100), th = tw * 430 / 820, T = [(W - tw) / 2, (H - th) / 2, tw, th], f = op.from; rect = [f[0] + (T[0] - f[0]) * ot, f[1] + (T[1] - f[1]) * ot, f[2] + (T[2] - f[2]) * ot, f[3] + (T[3] - f[3]) * ot]; }
      if (y + R.ih > R.top * 0.6 && y < H) c.rects.push([c.x, y, R.w, R.ih + 10 + R.ch]);
      var ti = tex_(c.it, 'texI');
      if (ti) {
        gl.bindTexture(gl.TEXTURE_2D, ti); attr(reelProg, mesh);
        gl.uniform4f(RU.uRect, rect[0], rect[1], rect[2], rect[3]); gl.uniform1f(RU.uHeightOffset, 1); gl.uniform1f(RU.uFlat, isOp ? ot : 0);
        gl.uniform1f(RU.uInner, 1 + 0.08 * c.hov); gl.uniform1f(RU.uOpacity, alpha * (anyHover && !c.hov ? 0.75 : 1)); gl.uniform1f(RU.uLight, 0.16);
        gl.drawArrays(gl.TRIANGLES, 0, meshN);
      }
      var tc = !isOp && tex_(c.it, 'texC');
      if (tc) {
        gl.bindTexture(gl.TEXTURE_2D, tc); attr(reelProg, capMesh);
        gl.uniform4f(RU.uRect, c.x, y + R.ih + 10, R.w, R.ch); gl.uniform1f(RU.uHeightOffset, 430 / 74); gl.uniform1f(RU.uFlat, 0);
        gl.uniform1f(RU.uInner, 1); gl.uniform1f(RU.uOpacity, alpha); gl.uniform1f(RU.uLight, 0.06);
        gl.drawArrays(gl.TRIANGLES, 0, capN);
      }
    }
  }

  function renderField(ot, op) {
    gl.useProgram(itemProg); attr(itemProg, quad); gl.uniform2f(IU.uRes, W, H); gl.uniform1i(IU.uTex, 0); gl.activeTexture(gl.TEXTURE0);
    var anyHover = hovered ? 1 : 0;
    function draw(tx, r, alpha, dim, lift) { gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform4f(IU.uRect, r[0], r[1], r[2], r[3]); gl.uniform1f(IU.uAlpha, alpha); gl.uniform1f(IU.uDim, dim); gl.uniform1f(IU.uLift, lift); gl.drawArrays(gl.TRIANGLES, 0, 6); }
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i]; c.rects = [];
      c.hov += ((c === hovered ? 1 : 0) - c.hov) * 0.15;
      var a = Math.max(0, Math.min(1, (appearT - c.delay * 0.6) / 0.5)), ae = 1 - Math.pow(1 - a, 3), tx = null;
      var sc = c.d * (0.9 + 0.1 * ae) * (1 + 0.07 * c.hov), w = cw * sc, h = chh * sc;
      var px = wrapC(c.bx - cam.x * c.d, SW), py = wrapC(c.by - cam.y * c.d, SH);
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var x = W / 2 + px + ox * SW - w / 2, y = H / 2 + py + oy * SH - h / 2;
        if (x > W + 40 || y > H + 40 || x + w < -40 || y + h < -40) continue;
        tx = tx || tex_(c.it, 'tex'); if (!tx) continue;
        c.rects.push([x, y, w, h]);
        draw(tx, [x, y, w, h], ae * fade * (op ? 1 - ot : 1), anyHover * (1 - c.hov), c.hov);
      }
    }
    if (op) {
      var th = H * 0.86, tw = th / 1.5, f = op.from, T = [(W - tw) / 2, (H - th) / 2, tw, th], t2 = tex_(op.c.it, 'tex');
      if (t2) draw(t2, [f[0] + (T[0] - f[0]) * ot, f[1] + (T[1] - f[1]) * ot, f[2] + (T[2] - f[2]) * ot, f[3] + (T[3] - f[3]) * ot], 1, 0, 1);
    }
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted && opening) { opening = null; root.classList.remove('is-opening'); if (!root.hidden) { running = true; last = performance.now(); requestAnimationFrame(frame); } } });

  setView(view, false);
})();
