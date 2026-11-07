#!/usr/bin/env python3
"""Static site generator for khaledhammad.com.

Reads structured content from content/ (edited by the team through the CMS at /admin/)
and UI strings from src/i18n.json, and writes a complete multilingual site to site/:

    /en/…  /ar/… (dir=rtl)  /ru/…   with equivalent routes, hreflang, canonical URLs,
    sitemap.xml, robots.txt, search indexes, JSON-LD (Person, CreativeWork, Event).

Usage:  python3 tools/build.py            (env SITE_URL / BASE_PATH override settings.json)

Two builds are produced:
  site/           production — only languages and records whose translation status is "approved"
  site/staging/   staging preview — every draft included, noindex (brief §6, §7)
Only depends on the Python standard library; Pillow (responsive images) and
python-docx (press-kit downloads) are used when installed.
"""
import html, json, os, re, shutil, glob, datetime, subprocess, sys, urllib.parse, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, os.environ.get('OUT_DIR', 'site'))
ALL_LANGS = ['en', 'ar', 'ru']
STAGING = os.environ.get('STAGING') == '1'


def load(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return json.load(f)


I18N = load('src/i18n.json')
SET = load('content/settings.json')
SITE_URL = os.environ.get('SITE_URL', SET['site_url']).rstrip('/')
BASE = os.environ.get('BASE_PATH', SET.get('base_path', '')).rstrip('/')
ASSET_BASE = os.environ.get('ASSET_BASE', BASE).rstrip('/')
PUBLISH_DRAFTS = STAGING or os.environ.get('PUBLISH_DRAFTS') == '1'
LANG_STATUS = SET.get('language_status', {})
LANGS = [l for l in ALL_LANGS if PUBLISH_DRAFTS or LANG_STATUS.get(l, 'approved') == 'approved']
ABOUT = load('content/about.json')
AWARDS = load('content/awards.json')
MEDIA = load('content/media.json')
WORKS = sorted([w for w in (load(p) for p in glob.glob(os.path.join(ROOT, 'content/works/*.json'))) if w.get('published')],
               key=lambda w: (-(w['year'] or 0), w['title']['en']))
PRESS = sorted([p for p in (load(f) for f in glob.glob(os.path.join(ROOT, 'content/press/*.json'))) if p.get('published')],
               key=lambda p: p['date'] or '0000', reverse=True)
NEWS = sorted([n for n in (load(f) for f in glob.glob(os.path.join(ROOT, 'content/news/*.json'))) if n.get('published')],
              key=lambda n: n['date'], reverse=True)
CONCERTS = sorted([c for c in (load(f) for f in glob.glob(os.path.join(ROOT, 'content/concerts/*.json'))) if c.get('published')],
                  key=lambda c: c['date'])
WBY = {w['slug']: w for w in WORKS}
AWARD_BY = {a['id']: a for a in AWARDS['items']}
SHOW_PENDING = SET.get('show_media_pending_licence', True)
TODAY = datetime.date.today().isoformat()
VERSION = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M')

e = lambda s: html.escape(str(s or ''), quote=True)


def avail(rec, lang):
    """A record is published in a language only when its translation is approved (drafts only on staging)."""
    if lang not in LANGS:
        return False
    st = (rec or {}).get('translation_status', {}).get(lang, 'approved')
    return PUBLISH_DRAFTS or st == 'approved'


def u(path=''):
    """Site-relative URL with base path (assets are shared between production and staging)."""
    p = path.lstrip('/')
    return (ASSET_BASE if p.startswith('assets/') else BASE) + '/' + p


SLUGS = {}  # (lang, section, en_slug) -> localised slug


def local_path(lang, path):
    parts = path.strip('/').split('/')
    if len(parts) == 2 and (lang, parts[0], parts[1]) in SLUGS:
        parts[1] = SLUGS[(lang, parts[0], parts[1])]
    return '/'.join(parts)


def lu(lang, path=''):
    path = local_path(lang, path.strip('/'))
    return u(f'{lang}/' + urllib.parse.quote(path + '/' if path else '', safe='/'))


def out(lang, path=''):
    """Output file for a language route (unquoted, without base path)."""
    rel = urllib.parse.unquote(lu(lang, path))[len(BASE):]
    return rel + 'index.html'


def tr(obj, lang):
    if obj is None:
        return ''
    if isinstance(obj, dict):
        return obj.get(lang) or obj.get('en') or ''
    return obj


def fmt_date(iso, lang):
    if not iso:
        return I18N[lang]['undated']
    y, m, d = iso.split('-')
    mon = I18N[lang]['months'][int(m) - 1]
    if lang == 'en':
        return f'{int(d)} {mon} {y}'
    return f'{int(d)} {mon} {y}'


IMG_SIZES = {}
try:
    from PIL import Image
except Exception:  # Pillow optional
    Image = None


def img_size(src):
    if src in IMG_SIZES:
        return IMG_SIZES[src]
    w = h = None
    if Image:
        try:
            with Image.open(os.path.join(ROOT, src.lstrip('/'))) as im:
                w, h = im.size
        except Exception:
            pass
    IMG_SIZES[src] = (w, h)
    return w, h


def img(src, alt, cls='', sizes='100vw', lazy=True, priority=False, extra=''):
    w, h = img_size(src)
    srcset = ''
    if w and w > 900 and Image:
        small = src.rsplit('.', 1)[0] + '-800.webp'
        srcset = f' srcset="{e(u(small))} 800w, {e(u(src))} {w}w" sizes="{e(sizes)}"'
    attrs = f' width="{w}" height="{h}"' if w else ''
    load_attr = ' fetchpriority="high"' if priority else (' loading="lazy"' if lazy else '')
    return (f'<img src="{e(u(src))}"{srcset} alt="{e(alt)}"{attrs}{load_attr} decoding="async"'
            f'{" class=" + chr(34) + cls + chr(34) if cls else ""}{extra}>')


def media_ok(path, rights):
    return bool(path) and (SHOW_PENDING or rights == 'licensed')


# ---------------------------------------------------------------- icons
ICON = {
    'search': '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    'menu': '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    'close': '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5l14 14M19 5 5 19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    'play': '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
    'arrow': '<svg class="arr" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'ext': '<svg class="ext" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 16 16 8M9 8h7v7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'vol': '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
}


# ---------------------------------------------------------------- layout
NAV = [('home', ''), ('about', 'about'), ('works', 'works'), ('listen', 'listen-watch'),
       ('concerts', 'concerts'), ('press', 'news-press'), ('contact', 'contact')]


def lang_href(l, path, alt_langs):
    return lu(l, path) if l in alt_langs else lu(l)


def header(lang, path, overlay, alt_langs=None):
    alt_langs = alt_langs or LANGS
    t = I18N[lang]
    cur = path.split('/')[0] if path else ''
    links = ''.join(
        f'<li><a href="{lu(lang, p)}"{" aria-current=" + chr(34) + "page" + chr(34) if cur == p else ""}>{e(t["nav"][k])}</a></li>'
        for k, p in NAV[1:])
    langs = ''.join(
        f'<li><a href="{lang_href(l, path, alt_langs)}" hreflang="{l}" lang="{l}"{" aria-current=" + chr(34) + "true" + chr(34) if l == lang else ""}>'
        f'<span class="lg-code" aria-hidden="true">{l.upper()}</span><span class="lg-name">{e(I18N[l]["lang_name"])}</span></a></li>'
        for l in LANGS)
    return f'''<a class="skip" href="#main">{e(t["skip"])}</a>
<header class="site-header{' is-overlay' if overlay else ''}" data-header>
 <div class="hd-in">
  <a class="brand" href="{lu(lang)}" aria-label="{e(t['site_name'])} — {e(t['nav']['home'])}">
   <span class="brand-name">{e(t['site_name'])}</span><span class="brand-sub">{e(t['descriptor'])}</span></a>
  <nav class="main-nav" aria-label="{e(t['menu'])}" id="site-nav">
   <ul class="nav-list">{links}</ul>
   <ul class="lang-list" aria-label="{e(t['language'])}">{langs}</ul>
  </nav>
  <div class="hd-tools">
   <a class="icon-btn" href="{lu(lang, 'search')}" aria-label="{e(t['search'])}">{ICON['search']}</a>
   <button class="icon-btn nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-open="{e(t['menu'])}" data-close="{e(t['close'])}" aria-label="{e(t['menu'])}">{ICON['menu']}{ICON['close']}</button>
  </div>
 </div>
</header>'''


def footer(lang, path, alt_langs=None):
    alt_langs = alt_langs or LANGS
    t = I18N[lang]
    soc = ''.join(f'<li><a href="{e(s["url"])}" rel="noopener" target="_blank">{e(s["name"])}</a></li>' for s in SET['social'])
    nav = ''.join(f'<li><a href="{lu(lang, p)}">{e(t["nav"][k])}</a></li>' for k, p in NAV)
    langs = ' · '.join(f'<a href="{lang_href(l, path, alt_langs)}" hreflang="{l}" lang="{l}">{e(I18N[l]["lang_name"])}</a>' for l in LANGS)
    yr = datetime.date.today().year
    return f'''<footer class="site-footer">
 <div class="wrap ft-grid">
  <div class="ft-brand"><p class="ft-name">{e(t['site_name'])}</p><p class="ft-desc">{e(t['descriptor'])}</p>
   <p class="ft-mail"><a href="mailto:{e(SET['contacts']['general'])}">{e(SET['contacts']['general'])}</a></p></div>
  <div><h2 class="ft-h">{e(t['menu'])}</h2><ul class="ft-list">{nav}</ul></div>
  <div><h2 class="ft-h">{e(t['official_links'])}</h2><ul class="ft-list ft-cols">{soc}</ul></div>
 </div>
 <div class="wrap ft-base">
  <p>© {yr} {e(t['site_name'])}. {e(t['footer_note'])}</p>
  <p class="ft-util"><a href="{lu(lang, 'privacy')}">{e(t['privacy'])}</a> · <a href="{lu(lang, 'accessibility')}">{e(t['accessibility'])}</a> · <span class="ft-langs">{langs}</span></p>
 </div>
</footer>'''


def page(lang, path, title, body, desc=None, jsonld=None, overlay=False, og_image=None, review=False, preload=None, body_class='', alt_langs=None, scripts=()):
    alt_langs = [l for l in (alt_langs or LANGS) if l in LANGS]
    t = I18N[lang]
    full_title = f'{title} | {t["site_name"]}' if title else f'{t["site_name"]} — {t["descriptor"]}'
    desc = desc or t['meta_desc']
    canon = SITE_URL + lu(lang, path)
    alts = ''.join(f'<link rel="alternate" hreflang="{l}" href="{SITE_URL + lu(l, path)}">' for l in alt_langs)
    if 'en' in alt_langs:
        alts += f'<link rel="alternate" hreflang="x-default" href="{SITE_URL + lu("en", path)}">'
    og = SITE_URL + u(og_image or '/assets/img/about-wide.webp')
    ld = ''
    for block in (jsonld or []):
        ld += '<script type="application/ld+json">' + json.dumps(block, ensure_ascii=False).replace('</', '<\\/') + '</script>'
    note = f'<p class="review-note" role="note">{e(t["translation_review"])}</p>' if review and t['translation_review'] else ''
    pre = f'<link rel="preload" as="image" href="{e(u(preload))}" fetchpriority="high">' if preload else ''
    og_alts = ''.join(f'<meta property="og:locale:alternate" content="{I18N[l]["locale"]}">' for l in alt_langs if l != lang)
    robots = '<meta name="robots" content="noindex, nofollow">' if STAGING else ''
    verify = f'<meta name="google-site-verification" content="{e(SET["google_site_verification"])}">' if SET.get('google_site_verification') and not STAGING else ''
    staging_bar = f'<p class="staging-bar" role="note">STAGING — {e(t["staging_note"])}</p>' if STAGING else ''
    return f'''<!doctype html>
<html lang="{lang}" dir="{t['dir']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(full_title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{canon}">
{alts}
<meta property="og:type" content="website"><meta property="og:site_name" content="{e(t['site_name'])}">
<meta property="og:title" content="{e(full_title)}"><meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{canon}"><meta property="og:image" content="{og}"><meta property="og:locale" content="{t['locale']}">{og_alts}
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#111719">{robots}{verify}
<link rel="icon" href="{u('/assets/icons/favicon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="{u('/assets/css/fonts.css')}?v={VERSION}">
{pre}
<link rel="stylesheet" href="{u('/assets/css/site.css')}?v={VERSION}">
{ld}
</head>
<body class="{body_class}{' has-staging' if STAGING else ''}">
{staging_bar}{header(lang, path, overlay, alt_langs)}
<main id="main" tabindex="-1">{note}{body}</main>
{footer(lang, path, alt_langs)}
{consent_banner(lang)}
<script>window.KH={{lang:"{lang}",base:"{BASE}",t:{json.dumps({k: t[k] for k in ('play', 'pause', 'results_one', 'results_many', 'copied', 'copy_text', 'search_none', 'err', 'sent', 'sent_mailto', 'cat', 'press_type', 'menu', 'close')}, ensure_ascii=False)},endpoint:{json.dumps(SET.get('form_endpoint', ''))},endpoints:{json.dumps(SET.get('form_endpoints', {}))},contacts:{json.dumps(SET['contacts'])},analytics:{json.dumps({} if STAGING else SET.get('analytics', {}))}}};</script>
<script src="{u('/assets/js/site.js')}?v={VERSION}" defer></script>{''.join(f'<script src="{u(sc)}?v={VERSION}" defer></script>' for sc in scripts)}
</body>
</html>'''


def consent_banner(lang):
    """Cookie controls — rendered only when an analytics provider is configured (brief §3, §7)."""
    a = SET.get('analytics', {})
    if STAGING or not a.get('id'):
        return ''
    t = I18N[lang]
    return f'''<div class="consent" data-consent hidden role="dialog" aria-labelledby="consent-h" aria-live="polite">
 <p id="consent-h" class="consent-t">{e(t['cookies'])}</p><p>{e(t['consent_text'])} <a href="{lu(lang, 'privacy')}">{e(t['privacy'])}</a></p>
 <div class="btn-row"><button type="button" class="btn btn-primary" data-consent-yes>{e(t['consent_yes'])}</button><button type="button" class="btn btn-line" data-consent-no>{e(t['consent_no'])}</button></div>
</div>'''


def draft_lang(lang):
    return LANG_STATUS.get(lang, 'approved') != 'approved'


def write(rel, content):
    p = os.path.join(OUT, rel.lstrip('/'))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(content)


# ---------------------------------------------------------------- components
def sec_head(label, title, intro='', link=None, hid=None):
    lk = f'<a class="link-more" href="{link[0]}">{e(link[1])}{ICON["arrow"]}</a>' if link else ''
    return (f'<div class="sec-head"><div><p class="eyebrow">{e(label)}</p><h2{" id=" + chr(34) + hid + chr(34) if hid else ""}>{e(title)}</h2>'
            f'{"<p class=" + chr(34) + "lede" + chr(34) + ">" + e(intro) + "</p>" if intro else ""}</div>{lk}</div>')


def poster(w, lang, sizes='(max-width: 700px) 50vw, 25vw', cls='poster'):
    t = I18N[lang]
    if media_ok(w.get('poster'), w.get('poster_rights')):
        return f'<div class="{cls}">{img(w["poster"], "", sizes=sizes)}</div>'
    return (f'<div class="{cls} is-placeholder" role="img" aria-label="{e(t["poster_pending"])}"><span class="ph-cat">{e(t["cat"][w["category"]])}</span>'
            f'<span class="ph-title">{e(tr(w["title"], lang))}</span><span class="ph-year">{e(w["year"] or "")}</span></div>')


def credit_line(w, lang):
    t = I18N[lang]
    parts = []
    if w.get('cast'):
        parts.append(tr(w['cast'], lang))
    if w.get('director'):
        parts.append(f'{t["director"]}: {tr(w["director"], lang)}')
    if w.get('credit_note') and not parts:
        parts.append(tr(w['credit_note'], lang))
    return ' · '.join(parts)


def work_card(w, lang, heading='h3'):
    t = I18N[lang]
    return (f'<article class="work-card reveal"><a href="{lu(lang, "works/" + w["slug"])}" class="wc-link">{poster(w, lang)}'
            f'<div class="wc-meta"><span class="wc-type">{e(t["cat"][w["category"]])}</span><span class="wc-year">{e(w["year"] or "")}</span></div>'
            f'<{heading} class="wc-title">{e(tr(w["title"], lang))}</{heading}>'
            f'<p class="wc-credit">{e(credit_line(w, lang))}</p></a></article>')


def player(track_id, src, title, sub, lang, dur=None):
    t = I18N[lang]
    return f'''<div class="player" data-player id="{e(track_id)}">
 <button class="pl-btn" type="button" aria-label="{e(t['play'])}: {e(title)}" data-label-play="{e(t['play'])}: {e(title)}" data-label-pause="{e(t['pause'])}: {e(title)}">{ICON['play']}</button>
 <div class="pl-body">
  <p class="pl-title">{e(title)}</p>{"<p class=" + chr(34) + "pl-sub" + chr(34) + ">" + e(sub) + "</p>" if sub else ""}
  <div class="pl-bar"><span class="pl-time" data-cur dir="ltr">0:00</span>
   <input class="pl-seek" type="range" min="0" max="{int(dur or 100)}" step="1" value="0" aria-label="{e(t['seek'])}: {e(title)}" dir="ltr">
   <span class="pl-time" data-dur dir="ltr">{fmt_dur(dur)}</span>
   <label class="pl-vol"><span class="sr">{e(t['volume'])}</span>{ICON['vol']}<input type="range" min="0" max="1" step="0.05" value="0.8" data-vol dir="ltr"></label>
  </div>
 </div>
 <audio preload="none" src="{e(u(src))}"></audio>
</div>'''


def fmt_dur(d):
    if not d:
        return '–:––'
    d = int(round(d))
    return f'{d // 60}:{d % 60:02d}'


DUR = {}
def audio_dur(src):
    if src in DUR:
        return DUR[src]
    d = None
    try:
        import subprocess
        r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
                            os.path.join(ROOT, src.lstrip('/'))], capture_output=True, text=True, timeout=20)
        d = float(r.stdout.strip())
    except Exception:
        pass
    DUR[src] = d
    return d


def video_facade(yt, title, poster_src, lang):
    t = I18N[lang]
    return f'''<figure class="video" data-yt="{e(yt)}" data-title="{e(title)}">
 <div class="video-frame">{img(poster_src, '', sizes='(max-width: 900px) 100vw, 50vw')}
  <button type="button" class="video-play"><span class="vp-ic">{ICON['play']}</span><span>{e(t['load_video'])}<span class="sr">: {e(title)}</span></span></button></div>
 <figcaption><span class="vc-title">{e(title)}</span><span class="vc-note">{e(t['video_consent'])}</span></figcaption>
</figure>'''


def news_row(n, lang, heading='h3'):
    """A first-party news post in the same list layout as press items."""
    t = I18N[lang]
    return (f'<article class="press-item is-news reveal"><div class="pi-meta"><time datetime="{e(n["date"])}">{e(fmt_date(n["date"], lang))}</time><span class="pi-type">{e(t["news"])}</span></div>'
            f'<div class="pi-body"><p class="pi-pub">{e(t["site_name"])}</p><{heading} class="pi-title"><a href="{lu(lang, "news-press/" + n["slug"])}">{e(tr(n["title"], lang))}</a></{heading}>'
            f'<p class="pi-sum">{e(tr(n["summary"], lang))}</p><p class="pi-by"><span class="pi-cta" aria-hidden="true">{e(t["read_more"])}{ICON["arrow"]}</span></p></div></article>')


def press_item(p, lang, heading='h3'):
    t = I18N[lang]
    pub = tr(p['publisher'], lang)
    cta = (t['watch'] if p['media'] == 'video' else t['read_article']).format(p=pub)
    by = f'<span>{e(tr(p["byline"], lang))}</span>' if p.get('byline') else ''
    date = f'<time datetime="{e(p["date"])}">{e(fmt_date(p["date"], lang))}</time>' if p['date'] else f'<span>{e(t["undated"])}</span>'
    return (f'<article class="press-item reveal" data-type="{e(p["type"])}"><div class="pi-meta">{date}<span class="pi-type">{e(t["press_type"][p["type"]])}</span></div>'
            f'<div class="pi-body"><p class="pi-pub">{e(pub)}</p><{heading} class="pi-title"><a href="{e(p["url"])}" target="_blank" rel="noopener">{e(tr(p["title"], lang))}'
            f'<span class="sr"> — {e(cta)}</span></a></{heading}><p class="pi-sum">{e(tr(p["summary"], lang))}</p>'
            f'<p class="pi-by">{by}<span class="pi-cta" aria-hidden="true">{e(cta)}{ICON["ext"]}</span></p></div></article>')


def person_ld(lang):
    t = I18N[lang]
    return {'@context': 'https://schema.org', '@type': 'Person', '@id': SITE_URL + '/#person', 'name': t['site_name'],
            'alternateName': [I18N[l]['site_name'] for l in LANGS if l != lang], 'jobTitle': t['descriptor'].split(' · '),
            'url': SITE_URL + lu(lang), 'image': SITE_URL + u('/assets/img/hero-portrait.webp'),
            'sameAs': [s['url'] for s in SET['social']], 'memberOf': [{'@type': 'Organization', 'name': 'SACEM'}]}


def crumb_ld(lang, items):
    return {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': SITE_URL + p} for i, (n, p) in enumerate(items)]}


def page_head(lang, eyebrow, title, intro='', image=None):
    bg = f'<div class="ph-bg">{img(image, "", priority=True, lazy=False)}</div>' if image else ''
    return (f'<section class="page-hero{" has-img" if image else ""}">{bg}<div class="wrap ph-in"><p class="eyebrow">{e(eyebrow)}</p>'
            f'<h1>{e(title)}</h1>{"<p class=" + chr(34) + "lede" + chr(34) + ">" + e(intro) + "</p>" if intro else ""}</div></section>')


# ---------------------------------------------------------------- pages
def featured_works():
    f = [w for w in WORKS if w.get('featured')]
    return sorted(f, key=lambda w: w.get('featured_order') or 99)[:6]


def audio_works():
    return [w for w in sorted(WORKS, key=lambda w: w['year'] or 0) if w.get('audio') and media_ok(w['audio']['src'], w['audio'].get('rights'))]


def build_home(lang):
    t = I18N[lang]
    fw = featured_works()
    cards = ''.join(work_card(w, lang) for w in fw)
    tracks = ''.join(player(f'track-{w["slug"]}', w['audio']['src'], tr(w['title'], lang), f'{t["cat"][w["category"]]} · {w["year"]}', lang, audio_dur(w['audio']['src'])) for w in audio_works())
    c = CONCERTS[-1] if CONCERTS else None
    upcoming = [x for x in CONCERTS if x['status'] != 'past' and x['date'] >= TODAY]
    up_html = ''.join(concert_card(x, lang) for x in upcoming) or f'<p class="empty-note">{e(t["no_upcoming"])}</p>'
    recog = [a for a in AWARDS['items'] if a.get('show_on_home')]
    recog = sorted(recog, key=lambda a: -a['year'])[:6]
    rec_html = ''.join(
        f'<li class="reveal"><span class="rc-year">{a["year"]}</span><span class="rc-name">{e(tr(a["name"], lang))}</span>'
        f'{"<span class=" + chr(34) + "rc-body" + chr(34) + ">" + e(tr(a["awarding_body"], lang)) + "</span>" if a.get("awarding_body") else ""}</li>' for a in recog)
    feed = sorted([('n', n['date'], n) for n in NEWS] + [('p', p['date'], p) for p in PRESS if p['date']], key=lambda x: x[1], reverse=True)[:4]
    press = ''.join(news_row(x, lang) if k == 'n' else press_item(x, lang) for k, _, x in feed)
    st = ABOUT['stats']
    body = f'''
<section class="hero" aria-labelledby="hero-title">
 <div class="hero-media">{img('/assets/img/about-wide.webp', I18N[lang]['live_intro'], priority=True, lazy=False, sizes='100vw')}</div>
 <div class="hero-shade" aria-hidden="true"></div>
 <div class="wrap hero-in">
  <p class="eyebrow">{e(t['descriptor'])}</p>
  <h1 id="hero-title"><span class="hero-name">{e(t['site_name'])}</span><span class="hero-tag">{e(t['hero_title'])}</span></h1>
  <p class="hero-lede">{e(t['hero_lede'])}</p>
  <div class="btn-row"><a class="btn btn-primary" href="{lu(lang, 'works')}">{e(t['cta_works'])}</a><a class="btn btn-ghost" href="{lu(lang, 'listen-watch')}">{e(t['cta_listen'])}</a></div>
 </div>
</section>

<section class="sec sec-ivory" aria-labelledby="sel-works">
 <div class="wrap">{sec_head('01', t['selected_works'], t['selected_works_intro'], (lu(lang, 'works'), t['all_works']), 'sel-works')}
  <div class="work-grid">{cards}</div></div>
</section>

<section class="sec sec-teal" aria-labelledby="sound">
 <div class="wrap split">
  <div>{sec_head('02', t['sound_story'], t['sound_story_intro'], None, 'sound')}
   <figure class="sound-fig">{img('/assets/img/gallery-04-studio.webp', I18N[lang]['behind_scenes'], sizes='(max-width: 900px) 100vw, 40vw')}</figure></div>
  <div class="tracks">{tracks}<p class="fine">{e(t['credit_note_audio'])}</p>
   <a class="link-more on-dark" href="{lu(lang, 'listen-watch')}">{e(t['cta_listen'])}{ICON['arrow']}</a></div>
 </div>
</section>

<section class="sec sec-stage" aria-labelledby="live">
 <div class="stage-media">{img('/assets/img/hero-portrait-2.webp', '', sizes='(max-width: 900px) 100vw, 45vw')}</div>
 <div class="wrap stage-in">
  {sec_head('03', t['live_on_stage'], '', None, 'live')}
  <p class="lede">{e(t['live_intro'])}</p>
  {f'<a class="link-more on-dark" href="{lu(lang, "concerts/" + c["slug"])}">{e(t["concert_details"])}{ICON["arrow"]}</a>' if c else ''}
  <div class="upcoming"><h3 class="mini-h">{e(t['upcoming'])}</h3>{up_html}</div>
  <a class="btn btn-ghost" href="{lu(lang, 'contact/concerts')}">{e(t['promoter_cta'])}</a>
 </div>
</section>

<section class="sec sec-ivory" aria-labelledby="profile">
 <div class="wrap profile">
  <figure class="profile-img reveal">{img(ABOUT['images']['profile'], t['site_name'], sizes='(max-width: 900px) 100vw, 45vw')}</figure>
  <div>{sec_head('04', t['artist_profile'], '', None, 'profile')}
   <p class="lede serif">{e(tr(ABOUT['short_bio'], lang))}</p>
   <dl class="stats"><div><dt>{st['feature_films']}</dt><dd>{e(t['stats_films'])}</dd></div><div><dt>{st['tv_series']}</dt><dd>{e(t['stats_series'])}</dd></div><div><dt>{st['years_active']}</dt><dd>{e(t['stats_years'])}</dd></div></dl>
   <p class="fine">{e(t['stats_note'])}</p>
   <a class="link-more" href="{lu(lang, 'about')}">{e(t['read_bio'])}{ICON['arrow']}</a></div>
 </div>
</section>

<section class="sec sec-paper" aria-labelledby="recog">
 <div class="wrap">{sec_head('05', t['recognition'], t['recognition_intro'], (lu(lang, 'about') + '#awards', t['all_recognition']), 'recog')}
  <ul class="recog-list">{rec_html}</ul></div>
</section>

<section class="sec sec-ivory" aria-labelledby="journal">
 <div class="wrap">{sec_head('06', t['journal'], '', (lu(lang, 'news-press'), t['all_press']), 'journal')}
  <div class="press-list">{press}</div></div>
</section>

{contact_cta(lang, '07')}'''
    ld = [person_ld(lang), {'@context': 'https://schema.org', '@type': 'WebSite', 'name': t['site_name'], 'url': SITE_URL + lu(lang), 'inLanguage': lang,
                             'potentialAction': {'@type': 'SearchAction', 'target': SITE_URL + lu(lang, 'search') + '?q={q}', 'query-input': 'required name=q'}}]
    write(out(lang, ''), page(lang, '', '', body, jsonld=ld, overlay=True, body_class='is-home'))


def contact_cta(lang, num=''):
    t = I18N[lang]
    opts = [('scoring', t['cta_commission'], t['form_hint']['scoring']), ('concerts', t['cta_concert'], t['form_hint']['concerts']), ('press', t['cta_press'], t['form_hint']['press'])]
    cards = ''.join(f'<li><a class="cta-card" href="{lu(lang, "contact/" + k)}"><span class="cta-t">{e(l)}</span><span class="cta-d">{e(d)}</span>{ICON["arrow"]}</a></li>' for k, l, d in opts)
    return f'''<section class="sec sec-teal cta-sec" aria-labelledby="cta-h"><div class="wrap">
 {sec_head(num, t['contact_cta_title'], t['contact_cta_intro'], None, 'cta-h')}
 <ul class="cta-grid">{cards}</ul></div></section>'''


def build_about(lang):
    t = I18N[lang]
    paras = ''.join(f'<p>{e(tr(p, lang))}</p>' for p in ABOUT['paragraphs'])
    edu = ''.join(f'<li><span class="tl-y">{x["year"]}</span><span>{e(tr(x["text"], lang))}</span></li>' for x in sorted(ABOUT['education'], key=lambda x: x['year']))
    ms = ''.join(f'<li class="reveal"><span class="tl-y">{x["year"]}</span><span>{e(tr(x["text"], lang))}</span></li>' for x in ABOUT['milestones'])
    act = ''.join(f'<li>{e(tr(x, lang))}</li>' for x in ABOUT['activities'])
    groups = ''
    for g in AWARDS['groups']:
        items = sorted([a for a in AWARDS['items'] if a['group'] == g['key']], key=lambda a: a['year'])
        lis = ''.join(f'<li><span class="tl-y">{a["year"]}</span><span><span class="aw-n">{work_link(a, lang)}</span>'
                      f'{"<span class=" + chr(34) + "aw-b" + chr(34) + ">" + e(tr(a["awarding_body"], lang)) + "</span>" if a.get("awarding_body") else ""}</span></li>' for a in items)
        gimg = f'<figure class="aw-img">{img(g["image"], tr(g["label"], lang), sizes="(max-width: 1000px) 100vw, 45vw")}</figure>' if g.get('image') and media_ok(g['image'], 'used-on-previous-site-confirm-licence') else ''
        groups += f'<div class="aw-group reveal">{gimg}<h3>{e(tr(g["label"], lang))}</h3><ul class="tl">{lis}</ul></div>'
    cats = [c for c in ('portraits', 'studio', 'concerts', 'tributes', 'events', 'behind') if any(a['category'] == c for a in MEDIA['assets'])]
    gchips = ''.join(f'<button type="button" class="chip" data-gcat="{c}" aria-pressed="{"true" if c == "all" else "false"}">{e(t["gcat"][c])}</button>' for c in ['all'] + cats)
    gitems = ''.join(f'<li data-gcat="{a["category"]}"><button type="button" class="g-item" data-full="{e(u(a["file"]))}" aria-label="{e(t["photo"])}: {e(tr(a["alt"], lang))}">{img(a["file"], tr(a["alt"], lang), sizes="(max-width: 700px) 50vw, 25vw")}</button></li>'
                     for a in MEDIA['assets'] if media_ok(a['file'], a['licence']))
    st = ABOUT['stats']
    body = f'''{page_head(lang, t['about_title'], t['site_name'], t['descriptor'], ABOUT['images']['wide'])}
<section class="sec sec-ivory"><div class="wrap profile">
 <figure class="profile-img">{img(ABOUT['images']['portrait'], t['site_name'], sizes='(max-width: 900px) 100vw, 45vw')}</figure>
 <div><p class="eyebrow">{e(t['biography'])}</p><p class="lede serif">{e(tr(ABOUT['short_bio'], lang))}</p>
  <dl class="stats"><div><dt>{st['feature_films']}</dt><dd>{e(t['stats_films'])}</dd></div><div><dt>{st['tv_series']}</dt><dd>{e(t['stats_series'])}</dd></div><div><dt>{st['years_active']}</dt><dd>{e(t['stats_years'])}</dd></div></dl>
  <p class="fine">{e(t['stats_note'])}</p></div></div></section>
<section class="sec sec-teal"><div class="wrap narrow"><p class="eyebrow">{e(t['approach'])}</p><blockquote class="pull">{e(tr(ABOUT['approach'], lang))}</blockquote></div></section>
<section class="sec sec-ivory" aria-labelledby="hist"><div class="wrap two-col">
 <div class="prose"><h2 id="hist">{e(t['full_history'])}</h2>{paras}</div>
 <aside class="side">
  <h2 class="side-h">{e(t['education'])}</h2><ul class="tl">{edu}</ul>
  <h2 class="side-h">{e(t['activities'])}</h2><ul class="bullets">{act}</ul>
 </aside></div></section>
<section class="sec sec-paper" id="milestones" aria-labelledby="ms"><div class="wrap">{sec_head(t['about_title'], t['milestones'], '', None, 'ms')}<ol class="milestones">{ms}</ol></div></section>
<section class="sec sec-ivory" id="awards" aria-labelledby="aw"><div class="wrap">{sec_head(t['recognition'], t['awards'], t['recognition_intro'], None, 'aw')}<div class="aw-grid">{groups}</div></div></section>
<section class="sec sec-paper" id="gallery" aria-labelledby="gal"><div class="wrap">{sec_head(t['about_title'], t['gallery'], t['gallery_intro'], None, 'gal')}
 <div class="chips" role="group" aria-label="{e(t['gallery'])}" data-gallery-filter>{gchips}</div><ul class="gallery" data-gallery>{gitems}</ul></div></section>
{contact_cta(lang)}{lightbox(lang)}'''
    ld = [person_ld(lang), crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['about_title'], lu(lang, 'about'))])]
    write(out(lang, 'about'), page(lang, 'about', t['about_title'], body, desc=tr(ABOUT['short_bio'], lang)[:155], jsonld=ld, review=draft_lang(lang)))


def work_link(a, lang):
    name = e(tr(a['name'], lang))
    if a.get('work') and a['work'] in WBY:
        return f'<a href="{lu(lang, "works/" + a["work"])}">{name}</a>'
    return name


def build_works(lang):
    t = I18N[lang]
    cats = ['all', 'film', 'tv', 'theatre', 'children', 'songs']
    counts = {c: sum(1 for w in WORKS if w['category'] == c) for c in cats[1:]}
    chips = ''.join(f'<button type="button" class="chip" data-cat="{c}" aria-pressed="{"true" if c == "all" else "false"}">{e(t["cat"][c])}'
                    f'{" <span class=" + chr(34) + "chip-n" + chr(34) + ">" + str(counts[c]) + "</span>" if c != "all" else ""}</button>' for c in cats)
    decades = sorted({(w['year'] // 10) * 10 for w in WORKS if w['year']}, reverse=True)
    dopts = ''.join(f'<option value="{d}">{d}s</option>' if lang != 'ar' else f'<option value="{d}">{d}–{d + 9}</option>' for d in decades)
    rows = ''
    for w in WORKS:
        hay = ' '.join([tr(w['title'], l) for l in LANGS] + [w.get('original_title') or ''] + [tr(w.get(k), l) for k in ('cast', 'director') for l in LANGS]).lower()
        thumb = poster(w, lang, sizes='80px', cls='wr-thumb')
        rows += (f'<li class="work-row" data-cat="{w["category"]}" data-year="{w["year"] or ""}" data-text="{e(hay)}">'
                 f'<a href="{lu(lang, "works/" + w["slug"])}">{thumb}<span class="wr-year">{e(w["year"] or "—")}</span>'
                 f'<span class="wr-main"><span class="wr-title">{e(tr(w["title"], lang))}</span><span class="wr-credit">{e(credit_line(w, lang))}</span></span>'
                 f'<span class="wr-cat">{e(t["cat"][w["category"]])}</span></a></li>')
    data = [{'t': tr(w['title'], lang), 'c': w['category'], 'cl': t['cat'][w['category']], 'y': w['year'], 'h': lu(lang, 'works/' + w['slug']),
             'i': u(w['poster']) if media_ok(w.get('poster'), w.get('poster_rights')) else None, 'cr': tr(w['director'], lang) if w.get('director') else '', 'f': w.get('featured_order') if w.get('featured') else None} for w in WORKS]
    wchips = ''.join(f'<li><button type="button" class="wc-chip" data-wc-cat="{c}" data-label="{e(t["cat"][c])}" aria-pressed="{"true" if c == "all" else "false"}"><span>{e(t["cat"][c])}</span><sup>{len(WORKS) if c == "all" else counts[c]}</sup></button></li>' for c in cats if c == 'all' or counts[c])
    vt = (f'<div class="view-toggle" role="group" aria-label="{e(t["wc_views"])}"><span class="vt-l">{e(t["wc_view_label"])}</span>'
          f'<button type="button" data-view="reel" aria-pressed="false">{e(t["wc_reel"])}</button><button type="button" data-view="canvas" aria-pressed="false">{e(t["wc_canvas"])}</button><button type="button" data-view="list" aria-pressed="true">{e(t["wc_list"])}</button></div>')
    canvas_sec = f'''<section class="works-canvas" data-wc hidden aria-label="{e(t['works_title'])} — {e(t['wc_canvas'])}">
 <canvas data-wc-canvas tabindex="0" role="img" aria-label="{e(t['wc_a11y'])}"></canvas>
 <div class="wc-cursor" data-wc-cursor aria-hidden="true"><span>{e(t['wc_open'])}</span></div>
 <div class="wc-label" data-wc-label aria-hidden="true"><span class="wcl-cat"></span><span class="wcl-title"></span><span class="wcl-meta"></span></div>
 <div class="wc-top"><h1 class="wc-title">{e(t['works_title'])}</h1><p class="wc-hint wc-hint-reel">{e(t['wc_hint_reel'])}</p><p class="wc-hint wc-hint-canvas">{e(t['wc_hint'])}</p></div>
 <div class="wc-filter"><button type="button" class="wc-filter-btn" data-wc-filter-btn aria-expanded="false" aria-haspopup="true">{e(t['wc_filter'])}<span class="wcf-cur" data-wc-filter-cur>{e(t['cat']['all'])}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
  <ul class="wc-filter-menu" data-wc-filter-menu hidden aria-label="{e(t['format'])}">{wchips}</ul></div>
 <div class="wc-end" data-wc-end><p>{e(t['work_cta'])}</p><a class="btn btn-primary" href="{lu(lang, 'contact/scoring')}">{e(t['cta_commission'])}</a></div>
 <div class="wc-bar">{vt}</div>
 <p class="sr" aria-live="polite" data-wc-live></p>
 <script type="application/json" data-wc-data>{json.dumps(data, ensure_ascii=False).replace('</', '<\\/')}</script>
</section>'''
    body = f'''{canvas_sec}<div class="works-listview">{page_head(lang, t['nav']['works'], t['works_title'], t['works_intro'])}
<section class="sec sec-ivory" aria-label="{e(t['works_title'])}"><div class="wrap">{vt}
 <div class="filters" data-filters>
  <div class="chips" role="group" aria-label="{e(t['format'])}">{chips}</div>
  <div class="filter-row">
   <label class="field-inline"><span class="sr">{e(t['decade'])}</span><select data-decade aria-label="{e(t['decade'])}"><option value="">{e(t['all_decades'])}</option>{dopts}</select></label>
   <label class="field-inline grow"><span class="sr">{e(t['keyword'])}</span><input type="search" data-q placeholder="{e(t['keyword'])}" aria-label="{e(t['keyword'])}"></label>
   <button type="button" class="chip" data-sort="new" data-l-new="{e(t['sort_new'])}" data-l-old="{e(t['sort_old'])}">{e(t['sort_new'])}</button>
  </div>
  <p class="count" data-count aria-live="polite"></p>
 </div>
 <ol class="work-list" data-list>{rows}</ol>
 <p class="empty-note" data-empty hidden>{e(t['no_results'])}</p>
</div></section>
{contact_cta(lang)}</div>'''
    ld = [crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['works_title'], lu(lang, 'works'))]),
          {'@context': 'https://schema.org', '@type': 'ItemList', 'numberOfItems': len(WORKS),
           'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': SITE_URL + lu(lang, 'works/' + w['slug'])} for i, w in enumerate(WORKS)]}]
    write(out(lang, 'works'), page(lang, 'works', t['works_title'], body, desc=t['works_intro'], jsonld=ld, review=draft_lang(lang), scripts=('/assets/js/works-canvas.js',), body_class='is-works'))
    for w in WORKS:
        build_work(lang, w)


def related(w):
    pool = [x for x in WORKS if x['slug'] != w['slug']]
    def score(x):
        s = 0 if x['category'] == w['category'] else 30
        if w.get('director') and x.get('director') and x['director']['en'] == w['director']['en']:
            s -= 25
        s += abs((x['year'] or 2000) - (w['year'] or 2000))
        s -= 4 if x.get('poster') else 0
        return s
    return sorted(pool, key=score)[:4]


def build_work(lang, w):
    t = I18N[lang]
    title = tr(w['title'], lang)
    facts = [(t['year'], w['year'] or t['year_tbc']), (t['format'], t['cat'][w['category']]), (t['credited_role'], t['role'][w['role']])]
    if w.get('director'):
        facts.append((t['director'], tr(w['director'], lang)))
    if w.get('cast'):
        facts.append((t['cast'], tr(w['cast'], lang)))
    if w.get('credit_note'):
        facts.append(('', tr(w['credit_note'], lang)))
    if w.get('original_title') and lang != 'ar':
        facts.append((t['original_title'], w['original_title']))
    dl = ''.join(f'<div><dt>{e(k)}</dt><dd{" lang=" + chr(34) + "ar" + chr(34) + " dir=" + chr(34) + "rtl" + chr(34) if k == t["original_title"] else ""}>{e(v)}</dd></div>' if k else f'<div class="wide"><dd>{e(v)}</dd></div>' for k, v in facts)
    story = tr(w.get('score_story'), lang)
    syn = tr(w.get('synopsis'), lang)
    audio = ''
    if w.get('audio') and media_ok(w['audio']['src'], w['audio'].get('rights')):
        audio = f'<div class="wd-block"><h2 class="mini-h">{e(t["music_sample"])}</h2>{player("track-" + w["slug"], w["audio"]["src"], title, tr(w["audio"].get("caption"), lang), lang, audio_dur(w["audio"]["src"]))}<p class="fine">{e(t["credit_note_audio"])}</p></div>'
    awards = [AWARD_BY[a] for a in w.get('awards', []) if a in AWARD_BY]
    aw = ''
    if awards:
        aw = f'<div class="wd-block"><h2 class="mini-h">{e(t["awards_for"])}</h2><ul class="tl">' + ''.join(
            f'<li><span class="tl-y">{a["year"]}</span><span>{e(tr(a["name"], lang))}{"<span class=" + chr(34) + "aw-b" + chr(34) + ">" + e(tr(a["awarding_body"], lang)) + "</span>" if a.get("awarding_body") else ""}</span></li>' for a in awards) + '</ul></div>'
    rel = ''.join(work_card(x, lang) for x in related(w))
    src = ''.join(f'<li>{e(tr(s["label"], lang))}</li>' for s in w.get('credit_sources', []))
    text = ''
    if syn:
        text += f'<p class="lede serif">{e(syn)}</p>'
    if story:
        text += f'<div class="wd-block"><h2 class="mini-h">{e(t["story_behind"])}</h2><p>{e(story)}</p></div>'
    body = f'''<section class="work-hero">
 <div class="wrap wh-in">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="{lu(lang, 'works')}">{e(t['works_title'])}</a><span aria-hidden="true"> / </span><span aria-current="page">{e(title)}</span></nav>
  <div class="wh-grid">
   {poster(w, lang, sizes='(max-width: 700px) 70vw, 30vw', cls='poster wh-poster')}
   <div class="wh-text"><p class="eyebrow">{e(t['cat'][w['category']])} · {e(w['year'] or t['year_tbc'])}</p><h1>{e(title)}</h1>
    {"<p class=" + chr(34) + "wh-orig" + chr(34) + " lang=" + chr(34) + "ar" + chr(34) + " dir=" + chr(34) + "rtl" + chr(34) + ">" + e(w["original_title"]) + "</p>" if w.get("original_title") and lang != "ar" else ""}
    <p class="wh-role">{e(t['role'][w['role']])}</p></div>
  </div>
 </div>
</section>
<section class="sec sec-ivory"><div class="wrap two-col">
 <div class="prose">{text}{audio}{aw}
  <div class="wd-cta"><p>{e(t['work_cta'])}</p><a class="btn btn-primary" href="{lu(lang, 'contact/scoring')}">{e(t['cta_commission'])}</a></div></div>
 <aside class="side"><dl class="facts">{dl}</dl><h2 class="side-h">{e(t['sources'])}</h2><ul class="bullets fine">{src}</ul></aside>
</div></section>
<section class="sec sec-paper" aria-labelledby="rel"><div class="wrap">{sec_head(t['works_title'], t['related'], '', (lu(lang, 'works'), t['all_works']), 'rel')}<div class="work-grid four">{rel}</div></div></section>'''
    typ = {'film': 'Movie', 'tv': 'TVSeries', 'theatre': 'TheaterEvent', 'children': 'TVSeries', 'songs': 'CreativeWork'}[w['category']]
    if typ == 'TheaterEvent':
        typ = 'CreativeWork'
    ld = {'@context': 'https://schema.org', '@type': typ, 'name': title, 'alternateName': w.get('original_title'),
          'url': SITE_URL + lu(lang, 'works/' + w['slug']), 'inLanguage': lang,
          'musicBy': {'@type': 'Person', '@id': SITE_URL + '/#person', 'name': t['site_name']}}
    if w['year']:
        ld['datePublished' if typ != 'TVSeries' else 'startDate'] = str(w['year'])
    if w.get('director'):
        ld['director'] = {'@type': 'Person', 'name': tr(w['director'], lang)}
    if w.get('cast'):
        ld['actor'] = [{'@type': 'Person', 'name': n.strip()} for n in tr(w['cast'], lang).replace(' و', ',').split(',') if n.strip()]
    if media_ok(w.get('poster'), w.get('poster_rights')):
        ld['image'] = SITE_URL + u(w['poster'])
    desc = f'{title} ({w["year"] or ""}) — {t["role"][w["role"]]}: {t["site_name"]}. {credit_line(w, lang)}'
    write(out(lang, 'works/' + w['slug']), page(lang, 'works/' + w['slug'], title, body, desc=desc[:160], jsonld=[ld, crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['works_title'], lu(lang, 'works')), (title, lu(lang, 'works/' + w['slug']))])],
                                                         og_image=w['poster'] if media_ok(w.get('poster'), w.get('poster_rights')) else None, review=w['translation_status'].get(lang, '').startswith('draft'), alt_langs=[l for l in LANGS if avail(w, l)]))


def build_listen(lang):
    t = I18N[lang]
    tracks = ''.join(player(f'lw-{w["slug"]}', w['audio']['src'], tr(w['title'], lang), f'{t["cat"][w["category"]]} · {w["year"]} · {credit_line(w, lang)}', lang, audio_dur(w['audio']['src'])) for w in audio_works())
    live = [p for p in PRESS if p['media'] == 'video' and p['type'] == 'tv']
    yt = lambda p: (re.search(r'youtu\.be/([\w-]+)|v=([\w-]+)', p['url']) or [None])
    vids = ''
    posters = ['/assets/img/gallery-07-concerts.webp', '/assets/img/gallery-01-concerts.webp']
    for i, p in enumerate(live):
        m = re.search(r'youtu\.be/([\w-]+)', p['url'])
        if m:
            vids += video_facade(m.group(1), f'{tr(p["title"], lang)} — {tr(p["publisher"], lang)}', posters[i % 2], lang)
    inter = ''.join(press_item(p, lang) for p in PRESS if p['type'] in ('interview', 'video-interview', 'radio', 'tv-interview'))
    bts = [a for a in MEDIA['assets'] if a['category'] in ('studio', 'behind') and media_ok(a['file'], a['licence'])]
    gal = ''.join(f'<li><button type="button" class="g-item" data-full="{e(u(a["file"]))}" aria-label="{e(t["photo"])}: {e(tr(a["alt"], lang))}">{img(a["file"], tr(a["alt"], lang), sizes="(max-width: 700px) 50vw, 25vw")}</button></li>' for a in bts)
    stream = ''.join(f'<li><a class="pill" href="{e(s["url"])}" target="_blank" rel="noopener">{e(s["name"])}{ICON["ext"]}</a></li>' for s in SET['social'] if s['name'] in ('Spotify', 'Apple Music', 'Anghami', 'Deezer', 'Amazon Music', 'SoundCloud', 'YouTube'))
    body = f'''{page_head(lang, t['nav']['listen'], t['listen_title'], t['listen_intro'])}
<section class="sec sec-teal" aria-labelledby="reel"><div class="wrap split">
 <div>{sec_head('01', t['showreel'], t['showreel_pending'], None, 'reel')}<ul class="pills">{stream}</ul></div>
 <div class="tracks"><h3 class="mini-h">{e(t['curated_audio'])}</h3>{tracks}<p class="fine">{e(t['credit_note_audio'])}</p></div>
</div></section>
<section class="sec sec-ivory" aria-labelledby="livep"><div class="wrap">{sec_head('02', t['live_perf'], '', None, 'livep')}<div class="video-grid">{vids}</div></div></section>
<section class="sec sec-paper" aria-labelledby="intv"><div class="wrap">{sec_head('03', t['interviews'], '', None, 'intv')}<div class="press-list">{inter}</div></div></section>
<section class="sec sec-ivory" aria-labelledby="bts"><div class="wrap">{sec_head('04', t['behind_scenes'], '', None, 'bts')}<ul class="gallery">{gal}</ul></div></section>
{lightbox(lang)}'''
    write(out(lang, 'listen-watch'), page(lang, 'listen-watch', t['listen_title'], body, desc=t['listen_intro'], review=draft_lang(lang),
                                                  jsonld=[crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['listen_title'], lu(lang, 'listen-watch'))])]))


def lightbox(lang):
    t = I18N[lang]
    return f'''<dialog class="lightbox" data-lightbox aria-label="{e(t['gallery'])}"><img alt=""><div class="lb-bar">
<button type="button" class="icon-btn" data-lb="prev" aria-label="{e(t['prev'])}">‹</button><button type="button" class="icon-btn" data-lb="next" aria-label="{e(t['next'])}">›</button>
<button type="button" class="icon-btn" data-lb="close" aria-label="{e(t['close'])}">{ICON['close']}</button></div></dialog>'''


def concert_card(c, lang):
    t = I18N[lang]
    d = fmt_date(c['date'], lang)
    return (f'<article class="concert-card reveal"><a href="{lu(lang, "concerts/" + c["slug"])}"><time datetime="{e(c["date"])}" class="cc-date">{e(d)}</time>'
            f'<span class="cc-status s-{e(c["status"])}">{e(t["status"][c["status"]])}</span><h3 class="cc-title">{e(tr(c["name"], lang))}</h3>'
            f'<p class="cc-venue">{e(tr(c["venue"], lang))} · {e(tr(c["city"], lang))}</p>{ICON["arrow"]}</a></article>')


def build_concerts(lang):
    t = I18N[lang]
    upcoming = [c for c in CONCERTS if c['status'] != 'past' and c['date'] >= TODAY]
    past = [c for c in CONCERTS if c not in upcoming]
    up = ''.join(concert_card(c, lang) for c in upcoming) or f'<p class="empty-note">{e(t["no_upcoming"])}</p>'
    pa = ''.join(concert_card(c, lang) for c in reversed(past))
    body = f'''{page_head(lang, t['nav']['concerts'], t['concerts_title'], t['concerts_intro'], '/assets/img/hero-portrait-2.webp')}
<section class="sec sec-ivory" aria-labelledby="up"><div class="wrap">{sec_head('01', t['upcoming'], '', None, 'up')}<div class="concert-list">{up}</div></div></section>
<section class="sec sec-paper" aria-labelledby="pa"><div class="wrap">{sec_head('02', t['past'], '', None, 'pa')}<div class="concert-list">{pa}</div></div></section>
{promoter_block(lang)}'''
    write(out(lang, 'concerts'), page(lang, 'concerts', t['concerts_title'], body, desc=t['concerts_intro'], review=draft_lang(lang),
                                              jsonld=[crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['concerts_title'], lu(lang, 'concerts'))])] + [event_ld(c, lang) for c in CONCERTS]))
    for c in CONCERTS:
        build_concert(lang, c)


def promoter_block(lang):
    t = I18N[lang]
    return f'''<section class="sec sec-teal" aria-labelledby="promo"><div class="wrap split">
 <div>{sec_head('', t['promoter_title'], '', None, 'promo')}</div>
 <div><p class="lede">{e(t['promoter_text'])}</p><a class="btn btn-primary" href="{lu(lang, 'contact/concerts')}">{e(t['cta_concert'])}</a></div></div></section>'''


def event_ld(c, lang):
    ld = {'@context': 'https://schema.org', '@type': 'MusicEvent', 'name': tr(c['name'], lang), 'startDate': c['date'] + (('T' + c['time']) if c.get('time') else ''),
          'eventStatus': {'cancelled': 'https://schema.org/EventCancelled', 'postponed': 'https://schema.org/EventPostponed'}.get(c['status'], 'https://schema.org/EventScheduled'),
          'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
          'location': {'@type': 'Place', 'name': tr(c['venue'], lang), 'address': tr(c['city'], lang)},
          'performer': [{'@type': 'Person', '@id': SITE_URL + '/#person', 'name': I18N[lang]['site_name']}, {'@type': 'MusicGroup', 'name': tr(c['partners'], lang)}],
          'image': [SITE_URL + u(p) for p in c.get('photos', [])[:3]], 'url': SITE_URL + lu(lang, 'concerts/' + c['slug'])}
    if c.get('ticket_url'):
        ld['offers'] = {'@type': 'Offer', 'url': c['ticket_url']}
    return ld


def build_concert(lang, c):
    t = I18N[lang]
    facts = [(t['date'], fmt_date(c['date'], lang) + (' · ' + c['time'] if c.get('time') else '')), (t['venue'], tr(c['venue'], lang)), (t['city'], tr(c['city'], lang)),
             (t['partners'], tr(c['partners'], lang))]
    if tr(c.get('accessibility'), lang):
        facts.append((t['accessibility_info'], tr(c['accessibility'], lang)))
    dl = ''.join(f'<div><dt>{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in facts)
    tickets = f'<a class="btn btn-primary" href="{e(c["ticket_url"])}" target="_blank" rel="noopener">{e(t["tickets"])}</a>' if c.get('ticket_url') and c['status'] != 'past' else ''
    photos = ''.join(f'<li><button type="button" class="g-item" data-full="{e(u(p))}" aria-label="{e(t["photo"])} {i + 1}">{img(p, tr(c["name"], lang) + " — " + str(i + 1), sizes="(max-width: 700px) 50vw, 25vw")}</button></li>' for i, p in enumerate(c.get('photos', [])) if media_ok(p, c.get('photo_rights')))
    vids = ''.join(video_facade(v['youtube'], tr(v['title'], lang), c['photos'][1] if len(c['photos']) > 1 else c['photos'][0], lang) for v in c.get('video', []))
    cov = ''.join(press_item(p, lang) for p in PRESS if p.get('related_concert') == c['slug'])
    title = tr(c['name'], lang)
    body = f'''{page_head(lang, t['status'][c['status']] + ' · ' + fmt_date(c['date'], lang), title, tr(c['venue'], lang), c['photos'][0] if c.get('photos') else None)}
<section class="sec sec-ivory"><div class="wrap two-col">
 <div class="prose"><p class="lede serif">{e(tr(c['summary'], lang))}</p>{tickets}<div class="video-grid one">{vids}</div></div>
 <aside class="side"><dl class="facts">{dl}</dl></aside></div></section>
<section class="sec sec-paper"><div class="wrap"><ul class="gallery">{photos}</ul></div></section>
<section class="sec sec-ivory" aria-labelledby="cov"><div class="wrap">{sec_head(t['nav']['press'], t['press_coverage'], '', None, 'cov')}<div class="press-list">{cov}</div></div></section>
{promoter_block(lang)}{lightbox(lang)}'''
    write(out(lang, 'concerts/' + c['slug']), page(lang, 'concerts/' + c['slug'], title, body, desc=tr(c['summary'], lang)[:160], og_image=c['photos'][0] if c.get('photos') else None,
                                                          jsonld=[event_ld(c, lang), crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['concerts_title'], lu(lang, 'concerts')), (title, lu(lang, 'concerts/' + c['slug']))])], review=draft_lang(lang), alt_langs=[l for l in LANGS if avail(c, l)]))


def news_card(n, lang, heading='h3'):
    t = I18N[lang]
    return (f'<article class="news-card reveal"><a href="{lu(lang, "news-press/" + n["slug"])}">'
            f'<div class="nc-img">{img(n["image"], tr(n.get("image_alt"), lang), sizes="(max-width: 700px) 100vw, 33vw")}</div>'
            f'<p class="nc-meta"><time datetime="{e(n["date"])}">{e(fmt_date(n["date"], lang))}</time><span>{e(t["news"])}</span></p>'
            f'<{heading} class="nc-title">{e(tr(n["title"], lang))}</{heading}><p class="nc-sum">{e(tr(n["summary"], lang))}</p>'
            f'<span class="link-more">{e(t["read_more"])}{ICON["arrow"]}</span></a></article>')


def build_press(lang):
    t = I18N[lang]
    types = ['all'] + [k for k in t['press_type'] if k != 'all' and any(p['type'] == k for p in PRESS)]
    chips = ''.join(f'<button type="button" class="chip" data-ptype="{k}" aria-pressed="{"true" if k == "all" else "false"}">{e(t["press_type"][k])}</button>' for k in types)
    items = ''.join(press_item(p, lang, 'h3') for p in PRESS)
    news = ''.join(news_card(n, lang) for n in NEWS)
    news_sec = ''
    if NEWS:
        news_sec = f'''<section class="sec sec-ivory" aria-labelledby="news-h"><div class="wrap">{sec_head('01', t['latest_news'], '', None, 'news-h')}<div class="news-grid">{news}</div></div></section>'''
    body = f'''{page_head(lang, t['nav']['press'], t['press_title'], t['press_intro'])}
{news_sec}
<section class="sec sec-paper" aria-labelledby="inpress"><div class="wrap">
 {sec_head('02', t['in_press'], '', None, 'inpress')}
 <div class="chips" role="group" aria-label="{e(t['in_press'])}" data-press-filter>{chips}</div>
 <div class="press-list" data-press-list>{items}</div></div></section>
<section class="sec sec-ivory"><div class="wrap"><div class="kit-banner reveal"><div><p class="eyebrow">{e(t['press_kit'])}</p><p>{e(t['press_kit_intro'])}</p></div><a class="btn btn-primary" href="{lu(lang, 'news-press/press-kit')}">{e(t['press_kit'])}</a></div></div></section>'''
    write(out(lang, 'news-press'), page(lang, 'news-press', t['press_title'], body, desc=t['press_intro'], review=draft_lang(lang),
                                        jsonld=[crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['press_title'], lu(lang, 'news-press'))])]))
    for n in NEWS:
        build_news(lang, n)
    build_press_kit(lang)


def build_news(lang, n):
    t = I18N[lang]
    title = tr(n['title'], lang)
    paras = ''.join(f'<p>{e(x)}</p>' for x in (n['body'].get(lang) or n['body']['en']))
    src = ''.join(f'<li><a href="{e(s["url"])}" target="_blank" rel="noopener">{e(tr(s["label"], lang))}{ICON["ext"]}</a></li>' for s in n.get('sources', []))
    rel = ''.join(work_card(WBY[w], lang) for w in n.get('related_works', []) if w in WBY)
    others = ''.join(news_card(x, lang) for x in NEWS if x['slug'] != n['slug'])
    rel_sec = ('<section class="sec sec-paper"><div class="wrap">' + sec_head(t['news'], t['news_related'], '', None, 'rel') + '<div class="work-grid four">' + rel + '</div></div></section>') if rel else ''
    more_sec = ('<section class="sec sec-paper" aria-labelledby="more-news"><div class="wrap">' + sec_head(t['news'], t['latest_news'], '', (lu(lang, 'news-press'), t['all_news']), 'more-news') + '<div class="news-grid">' + others + '</div></div></section>') if others else ''
    body = f'''<article>
<section class="page-hero has-img"><div class="ph-bg">{img(n['image'], '', priority=True, lazy=False)}</div><div class="wrap ph-in">
 <nav class="crumbs" aria-label="Breadcrumb"><a href="{lu(lang, 'news-press')}">{e(t['press_title'])}</a></nav>
 <p class="eyebrow"><time datetime="{e(n['date'])}">{e(fmt_date(n['date'], lang))}</time> · {e(t['news'])}</p><h1>{e(title)}</h1><p class="lede">{e(tr(n['summary'], lang))}</p></div></section>
<section class="sec sec-ivory"><div class="wrap two-col"><div class="prose article-body">{paras}</div>
 <aside class="side"><h2 class="side-h">{e(t['sources_label'])}</h2><ul class="bullets src-list">{src}</ul></aside></div></section>
</article>
{rel_sec}{more_sec}'''
    ld = {'@context': 'https://schema.org', '@type': 'NewsArticle', 'headline': title, 'datePublished': n['date'], 'inLanguage': lang,
          'image': [SITE_URL + u(n['image'])], 'about': {'@type': 'Person', '@id': SITE_URL + '/#person', 'name': t['site_name']},
          'author': {'@type': 'Person', '@id': SITE_URL + '/#person', 'name': t['site_name']},
          'isBasedOn': [s['url'] for s in n.get('sources', [])], 'mainEntityOfPage': SITE_URL + lu(lang, 'news-press/' + n['slug'])}
    write(out(lang, 'news-press/' + n['slug']), page(lang, 'news-press/' + n['slug'], title, body, desc=tr(n['summary'], lang)[:160], og_image=n['image'],
          jsonld=[ld, crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['press_title'], lu(lang, 'news-press')), (title, lu(lang, 'news-press/' + n['slug']))])],
          review=n['translation_status'].get(lang, '').startswith('draft'), alt_langs=[l for l in LANGS if avail(n, l)]))


def kit_credits():
    return sorted(featured_works() + [x for x in WORKS if x['slug'] in ('love-passion-and-seriousness', 'africano', 'the-fortune-teller')], key=lambda w: w['year'])


def make_kit_docx(lang, path):
    """Press-kit biography document (Word). Requires python-docx; skipped if unavailable."""
    try:
        from docx import Document
        from docx.shared import Pt, RGBColor
        from docx.oxml.ns import qn
        from docx.oxml import OxmlElement
    except Exception:
        return False
    t = I18N[lang]
    rtl = t['dir'] == 'rtl'
    font = {'ar': 'Arial', 'ru': 'Georgia', 'en': 'Georgia'}[lang]
    doc = Document()
    st = doc.styles['Normal']
    st.font.name = font
    st.font.size = Pt(11)
    st.element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:cs'), font)

    def para(text, size=11, bold=False, color=None, space=6):
        pg = doc.add_paragraph()
        if rtl:
            pg._p.get_or_add_pPr().append(OxmlElement('w:bidi'))
            pg.alignment = 2
        r = pg.add_run(text)
        r.font.size = Pt(size)
        r.bold = bold
        r.font.name = font
        rp = r._element.get_or_add_rPr()
        rp.get_or_add_rFonts().set(qn('w:cs'), font)
        if rtl:
            rp.append(OxmlElement('w:rtl'))
            cs = OxmlElement('w:szCs')
            cs.set(qn('w:val'), str(size * 2))
            rp.append(cs)
            if bold:
                rp.append(OxmlElement('w:bCs'))
        if color:
            r.font.color.rgb = RGBColor.from_string(color)
        pg.paragraph_format.space_after = Pt(space)
    para(t['site_name'], 24, color='142B2A', space=2)
    para(t['descriptor'], 11, color='6E5934', space=14)
    para(t['short_bio'], 14, True, '142B2A')
    para(tr(ABOUT['short_bio'], lang))
    para(t['long_bio'], 14, True, '142B2A')
    for x in ABOUT['paragraphs']:
        para(tr(x, lang))
    para(t['selected_credits'], 14, True, '142B2A')
    for w in kit_credits():
        para(f'{w["year"]} — {tr(w["title"], lang)} ({t["cat"][w["category"]]})', space=2)
    para(t['press_contact'], 14, True, '142B2A')
    para(SET['contacts']['press'])
    para(t['usage'], 14, True, '142B2A')
    para(t['usage_text'], 9, color='4A5251')
    doc.core_properties.title = f'{t["site_name"]} — {t["press_kit"]}'
    doc.core_properties.author = t['site_name']
    os.makedirs(os.path.dirname(path), exist_ok=True)
    doc.save(path)
    return True


def build_press_kit(lang):
    t = I18N[lang]
    long_bio = '\n\n'.join(tr(p, lang) for p in ABOUT['paragraphs'])
    credits = ''.join(f'<li><span class="tl-y">{w["year"]}</span><span>{e(tr(w["title"], lang))} <span class="aw-b">{e(t["cat"][w["category"]])}</span></span></li>' for w in kit_credits())
    portraits = [a for a in MEDIA['assets'] if a.get('press_kit') and media_ok(a['file'], a['licence'])]
    pics = ''.join(f'<li class="kit-pic"><figure>{img(a["file"], tr(a["alt"], lang), sizes="(max-width: 700px) 50vw, 25vw")}<figcaption><a href="{e(u(a["file"]))}" download>{e(t["download"])}</a> <span class="fine">{img_size(a["file"])[0]}×{img_size(a["file"])[1]}</span></figcaption></figure></li>' for a in portraits)
    downloads = []
    doc_rel = f'{lang}/press-kit/khaled-hammad-press-kit-{lang}.docx'
    if make_kit_docx(lang, os.path.join(OUT, doc_rel)):
        downloads.append((u(doc_rel), t['kit_doc'], 'DOCX', os.path.getsize(os.path.join(OUT, doc_rel))))
    zip_rel = 'press-kit/khaled-hammad-portraits.zip'
    zp = os.path.join(OUT, zip_rel)
    if portraits and not os.path.exists(zp):
        os.makedirs(os.path.dirname(zp), exist_ok=True)
        with zipfile.ZipFile(zp, 'w', zipfile.ZIP_STORED) as z:
            for a in portraits:
                z.write(os.path.join(ROOT, a['file'].lstrip('/')), os.path.basename(a['file']))
    if portraits:
        downloads.append((u(zip_rel), t['kit_zip'], 'ZIP', os.path.getsize(zp)))
    dl = ''.join(f'<li><a class="dl" href="{e(h)}" download><span class="dl-t">{e(lbl)}</span><span class="dl-m" dir="ltr">{kind} · {size // 1024:,} KB</span></a></li>' for h, lbl, kind, size in downloads)
    dl_block = f'<div class="kit-block"><h2>{e(t["kit_downloads"])}</h2><ul class="dl-list">{dl}</ul></div>' if dl else ''
    bio_long = ''.join('<p>' + e(x) + '</p>' for x in long_bio.split('\n\n'))
    body = f'''{page_head(lang, t['press_title'], t['press_kit'], t['press_kit_intro'])}
<section class="sec sec-ivory"><div class="wrap two-col">
 <div class="prose">
  {dl_block}
  <div class="kit-block"><div class="kit-h"><h2>{e(t['short_bio'])}</h2><button type="button" class="chip" data-copy="#bio-short">{e(t['copy_text'])}</button></div><p id="bio-short">{e(tr(ABOUT['short_bio'], lang))}</p></div>
  <div class="kit-block"><div class="kit-h"><h2>{e(t['long_bio'])}</h2><button type="button" class="chip" data-copy="#bio-long">{e(t['copy_text'])}</button></div><div id="bio-long">{bio_long}</div></div>
 </div>
 <aside class="side"><h2 class="side-h">{e(t['selected_credits'])}</h2><ul class="tl">{credits}</ul>
  <h2 class="side-h">{e(t['press_contact'])}</h2><p><a href="mailto:{e(SET['contacts']['press'])}">{e(SET['contacts']['press'])}</a></p>
  <p><a class="link-more" href="{lu(lang, 'contact/press')}">{e(t['forms']['press'])}{ICON['arrow']}</a></p>
  <h2 class="side-h">{e(t['usage'])}</h2><p class="fine">{e(t['usage_text'])}</p></aside>
</div></section>
<section class="sec sec-paper" aria-labelledby="portr"><div class="wrap">{sec_head(t['press_kit'], t['portraits'], '', None, 'portr')}<ul class="gallery kit">{pics}</ul></div></section>'''
    write(out(lang, 'news-press/press-kit'), page(lang, 'news-press/press-kit', t['press_kit'], body, desc=t['press_kit_intro'], review=draft_lang(lang)))


FORM_KINDS = ['scoring', 'concerts', 'licensing', 'press', 'general']


def fld(fid, label, kind='input', req=False, hint='', opts=None, attrs='', t=None):
    r = f'<span class="req" aria-hidden="true">*</span><span class="sr"> ({e(t["f"]["required"])})</span>' if req else ''
    desc = ' '.join(x for x in ((f'h-{fid}' if hint else ''), (f'e-{fid}' if req else '')) if x)
    da = f' aria-describedby="{desc}"' if desc else ''
    rq = ' required' if req else ''
    if kind == 'textarea':
        ctl = f'<textarea id="f-{fid}" name="{fid}" rows="6"{rq}{da}{attrs}></textarea>'
    elif kind == 'select':
        ctl = f'<select id="f-{fid}" name="{fid}"{da}{attrs}>' + ''.join(f'<option>{e(o)}</option>' for o in opts) + '</select>'
    else:
        ctl = f'<input id="f-{fid}" name="{fid}"{rq}{da}{attrs}>'
    h = f'<p class="hint" id="h-{fid}">{e(hint)}</p>' if hint else ''
    er = f'<p class="ferr" id="e-{fid}" data-err="{fid}"></p>' if req else ''
    return f'<div class="field"><label for="f-{fid}">{e(label)}{r}</label>{ctl}{h}{er}</div>'


def build_contact(lang):
    t = I18N[lang]
    f, ff = t['f'], t['ff']
    soc = ''.join(f'<li><a class="pill" href="{e(s["url"])}" target="_blank" rel="noopener">{e(s["name"])}{ICON["ext"]}</a></li>' for s in SET['social'])
    aside = f'''<aside class="side">
  <h2 class="side-h">{e(t['email_label'])}</h2><p><a href="mailto:{e(SET['contacts']['general'])}" class="mail">{e(SET['contacts']['general'])}</a></p>
  <h2 class="side-h">{e(t['official_links'])}</h2><ul class="pills">{soc}</ul>
 </aside>'''
    cards = ''.join(f'<li><a class="path-card" href="{lu(lang, "contact/" + k)}"><span class="pc-n">0{i + 1}</span><span class="pc-t">{e(t["forms"][k])}</span><span class="pc-d">{e(t["form_hint"][k])}</span><span class="link-more">{e(t["open_form"])}{ICON["arrow"]}</span></a></li>' for i, k in enumerate(FORM_KINDS))
    body = f'''{page_head(lang, t['nav']['contact'], t['contact_title'], t['contact_index_intro'])}
<section class="sec sec-ivory"><div class="wrap two-col"><ul class="path-list">{cards}</ul>{aside}</div></section>'''
    write(out(lang, 'contact'), page(lang, 'contact', t['contact_title'], body, desc=t['contact_index_intro'],
                                     jsonld=[crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['contact_title'], lu(lang, 'contact'))])]))
    budget = fld('budget', f['budget'], 'select', opts=f['budget_opts'], t=t)
    dates = fld('dates', f['dates'], hint=f['dates_hint'], t=t)
    specific = {
        'scoring': '<div class="grid2">' + fld('project_title', ff['project_title'], t=t) + fld('project_format', ff['project_format'], 'select', opts=ff['project_format_opts'], t=t) + '</div>'
                   + '<div class="grid2">' + fld('stage', ff['stage'], 'select', opts=ff['stage_opts'], t=t) + fld('director_producer', ff['director_prod'], t=t) + '</div>'
                   + '<div class="grid2">' + dates + budget + '</div>',
        'concerts': '<div class="grid2">' + fld('venue', ff['venue'], t=t) + fld('location', ff['location'], t=t) + '</div>'
                    + '<div class="grid2">' + fld('event_format', ff['event_format'], 'select', opts=ff['event_format_opts'], t=t) + fld('capacity', ff['capacity'], attrs=' inputmode="numeric"', t=t) + '</div>'
                    + '<div class="grid2">' + dates + budget + '</div>'
                    + f'<div class="field check"><input type="checkbox" id="f-rider" name="rider" value="yes"><label for="f-rider">{e(ff["rider"])}</label></div>',
        'licensing': fld('track', ff['track'], hint=ff['track_hint'], t=t)
                     + '<div class="grid2">' + fld('usage', ff['usage'], 'select', opts=ff['usage_opts'], t=t) + fld('territory', ff['territory'], t=t) + '</div>'
                     + '<div class="grid2">' + fld('term', ff['term'], t=t) + budget + '</div>',
        'press': '<div class="grid2">' + fld('outlet', ff['outlet'], t=t) + fld('request', ff['request'], 'select', opts=ff['request_opts'], t=t) + '</div>'
                 + fld('deadline', ff['deadline'], attrs=' type="date"', t=t),
        'general': fld('subject', ff['subject'], t=t),
    }
    for k in FORM_KINDS:
        others = ''.join(f'<li><a class="pill" href="{lu(lang, "contact/" + o)}">{e(t["forms"][o])}</a></li>' for o in FORM_KINDS if o != k)
        endpoint = (SET.get('form_endpoints') or {}).get(k) or SET.get('form_endpoint', '')
        rider = f'<p class="hint">{e(t["rider_note"])}</p>' if k == 'concerts' else ''
        form = f'''<form class="enquiry" data-enquiry data-kind="{k}" data-label="{e(t['forms'][k])}" data-endpoint="{e(endpoint)}" data-to="{e(SET['contacts'].get(k) or SET['contacts']['general'])}" novalidate method="post">
  <div class="form-error" data-summary role="alert" tabindex="-1" hidden></div>
  <p class="hint form-hint">{e(t['form_hint'][k])}</p>{rider}
  <div class="grid2">{fld('name', f['name'], req=True, attrs=' autocomplete="name"', t=t)}{fld('organisation', f['org'], attrs=' autocomplete="organization"', t=t)}</div>
  {fld('email', f['email'], req=True, attrs=' type="email" autocomplete="email" dir="ltr"', t=t)}
  {specific[k]}
  {fld('brief', f['brief'], 'textarea', req=True, hint=f['brief_hint'], t=t)}
  <div class="hp" aria-hidden="true"><label for="f-website">{e(f['honeypot'])}</label><input id="f-website" name="website" tabindex="-1" autocomplete="off"></div>
  <div class="field check"><input type="checkbox" id="f-consent" name="consent" required aria-describedby="e-consent"><label for="f-consent">{e(f['consent'])} <a href="{lu(lang, 'privacy')}">{e(t['privacy'])}</a><span class="req" aria-hidden="true">*</span></label><p class="ferr" id="e-consent" data-err="consent"></p></div>
  <button class="btn btn-primary" type="submit">{e(f['send'])}</button>
  <p class="form-ok" data-ok role="status" tabindex="-1" hidden></p>
 </form>'''
        body = f'''{page_head(lang, t['contact_title'], t['forms'][k], '')}
<section class="sec sec-ivory"><div class="wrap two-col"><div>{form}<div class="other-paths"><h2 class="side-h">{e(t['other_paths'])}</h2><ul class="pills">{others}</ul></div></div>{aside}</div></section>'''
        write(out(lang, 'contact/' + k), page(lang, 'contact/' + k, t['forms'][k], body, desc=t['form_hint'][k],
                                             jsonld=[crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['contact_title'], lu(lang, 'contact')), (t['forms'][k], lu(lang, 'contact/' + k))])]))


def build_search(lang):
    t = I18N[lang]
    idx = []
    for w in WORKS:
        idx.append({'t': tr(w['title'], lang), 's': f'{t["cat"][w["category"]]} · {w["year"] or ""} · {credit_line(w, lang)}', 'u': lu(lang, 'works/' + w['slug']),
                    'k': ' '.join([tr(w['title'], l) for l in LANGS] + [w.get('original_title') or '', str(w['year'] or '')] + [tr(w.get(x), l) for x in ('cast', 'director') for l in LANGS]).lower()})
    for p in PRESS:
        idx.append({'t': tr(p['title'], lang), 's': f'{tr(p["publisher"], lang)} · {fmt_date(p["date"], lang)}', 'u': p['url'], 'x': 1,
                    'k': (tr(p['title'], lang) + ' ' + tr(p['summary'], lang) + ' ' + tr(p['publisher'], lang)).lower()})
    for n in NEWS:
        idx.append({'t': tr(n['title'], lang), 's': f'{t["news"]} · {fmt_date(n["date"], lang)}', 'u': lu(lang, 'news-press/' + n['slug']),
                    'k': (tr(n['title'], lang) + ' ' + tr(n['summary'], lang)).lower()})
    for k in FORM_KINDS:
        idx.append({'t': t['forms'][k], 's': t['contact_title'], 'u': lu(lang, 'contact/' + k), 'k': (t['forms'][k] + ' ' + t['form_hint'][k]).lower()})
    for k, p in NAV + [('press_kit', 'news-press/press-kit'), ('privacy', 'privacy'), ('accessibility', 'accessibility')]:
        name = t['nav'].get(k) or t.get(k)
        idx.append({'t': name, 's': '', 'u': lu(lang, p), 'k': name.lower()})
    for c in CONCERTS:
        idx.append({'t': tr(c['name'], lang), 's': f'{tr(c["venue"], lang)} · {fmt_date(c["date"], lang)}', 'u': lu(lang, 'concerts/' + c['slug']), 'k': (tr(c['name'], lang) + ' ' + tr(c['venue'], lang) + ' ' + c['date']).lower()})
    write(f'{lang}/search-index.json', json.dumps(idx, ensure_ascii=False, separators=(',', ':')))
    body = f'''{page_head(lang, t['search_title'], t['search_title'], t['search_intro'])}
<section class="sec sec-ivory"><div class="wrap narrow" data-search data-index="{lu(lang)}search-index.json">
 <label class="field"><span class="sr">{e(t['search_ph'])}</span><input type="search" class="big-search" placeholder="{e(t['search_ph'])}" aria-label="{e(t['search_ph'])}" data-search-input autofocus></label>
 <p class="count" aria-live="polite" data-search-count></p><ol class="search-results" data-search-results></ol></div></section>'''
    write(out(lang, 'search'), page(lang, 'search', t['search_title'], body))


def build_utility(lang):
    t = I18N[lang]
    analytics_on = bool(SET.get('analytics', {}).get('id')) and not STAGING
    for key, path in (('privacy', 'privacy'), ('accessibility', 'accessibility')):
        paras = t['privacy_text'] if key == 'privacy' else t['a11y_text']
        extra = ''
        if key == 'privacy':
            extra = f'<h2>{e(t["cookies"])}</h2><p>{e(paras[0])}</p>'
            if analytics_on:
                extra += f'<p><button type="button" class="btn btn-primary" data-consent-open>{e(t["cookie_settings"])}</button></p>'
        text = ''.join('<p>' + e(p) + '</p>' for p in paras)
        body = f'''{page_head(lang, t[key], t[key])}<section class="sec sec-ivory"><div class="wrap narrow prose">{text}{extra}
<p><a href="{lu(lang, 'contact/general')}">{e(t['nav']['contact'])}</a> · <a href="mailto:{e(SET['contacts']['general'])}">{e(SET['contacts']['general'])}</a></p></div></section>'''
        write(out(lang, path), page(lang, path, t[key], body))


# Anchors of the previous single-page site, forwarded to the equivalent new page.
LEGACY_HASH = {'about': 'about', 'works': 'works', 'all-works': 'works', 'gallery': 'about#gallery', 'awards': 'about#awards',
               'timeline': 'about#milestones', 'press': 'news-press', 'news': 'news-press', 'contact': 'contact'}


def redirect_page(target):
    canon = SITE_URL + target if target.startswith('/') else target
    return (f'<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Redirecting…</title>'
            f'<link rel="canonical" href="{e(canon)}"><meta http-equiv="refresh" content="0; url={e(target)}"></head>'
            f'<body><p><a href="{e(target)}">{e(target)}</a></p></body></html>')


def build_root():
    # Language chooser: no automatic redirect (brief §6); the visitor's browser language is only highlighted.
    links = ''.join(f'<li><a href="{lu(l)}" hreflang="{l}" lang="{l}" data-l="{l}"><span class="rl-name">{e(I18N[l]["site_name"])}</span><span class="rl-lang">{e(I18N[l]["lang_name"])}</span></a></li>' for l in LANGS)
    alts = ''.join(f'<link rel="alternate" hreflang="{l}" href="{SITE_URL + lu(l)}">' for l in LANGS) + f'<link rel="alternate" hreflang="x-default" href="{SITE_URL + u("/")}">'
    hmap = json.dumps(LEGACY_HASH)
    langs = json.dumps(LANGS)
    robots = '<meta name="robots" content="noindex, nofollow">' if STAGING else ''
    write('index.html', f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">{robots}
<title>Khaled Hammad · خالد حماد · Халед Хаммад</title><meta name="description" content="{e(I18N['en']['meta_desc'])}">
<link rel="canonical" href="{SITE_URL + u('/')}">{alts}<link rel="icon" href="{u('/assets/icons/favicon.svg')}" type="image/svg+xml">
<meta property="og:title" content="Khaled Hammad · خالد حماد"><meta property="og:image" content="{SITE_URL + u('/assets/img/about-wide.webp')}">
<link rel="stylesheet" href="{u('/assets/css/fonts.css')}?v={VERSION}"><link rel="stylesheet" href="{u('/assets/css/site.css')}?v={VERSION}">
<script>(function(){{var h=location.hash.slice(1),m={hmap},L={langs};if(h&&m[h]){{var l=(navigator.language||'en').slice(0,2);if(L.indexOf(l)<0)l='en';var p=m[h].split('#');location.replace('{BASE}/'+l+'/'+p[0]+'/'+(p[1]?'#'+p[1]:''));}}}})();</script></head>
<body class="root-chooser"><main class="chooser"><div class="ch-bg">{img('/assets/img/about-wide.webp', '', priority=True, lazy=False)}</div>
<div class="ch-in"><p class="eyebrow">Composer · مؤلف موسيقي · Композитор</p><h1 class="sr">Khaled Hammad</h1><ul class="ch-list">{links}</ul></div></main>
<script>(function(){{var l=(navigator.language||'en').slice(0,2),a=document.querySelector('[data-l="'+l+'"]');if(a){{a.parentNode.parentNode.prepend(a.parentNode);a.classList.add('is-pref');}}}})();</script></body></html>''')
    blocks = ''.join(f'<section lang="{l}" dir="{I18N[l]["dir"]}"><h2>{e(I18N[l]["notfound_title"])}</h2><p>{e(I18N[l]["notfound_text"])}</p><a class="btn btn-primary" href="{lu(l)}">{e(I18N[l]["back_home"])}</a></section>' for l in LANGS)
    write('404.html', f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>404 · Khaled Hammad</title><link rel="icon" href="{u('/assets/icons/favicon.svg')}" type="image/svg+xml"><link rel="stylesheet" href="{u('/assets/css/fonts.css')}?v={VERSION}"><link rel="stylesheet" href="{u('/assets/css/site.css')}?v={VERSION}"></head>
<body class="nf"><main class="nf-in"><p class="eyebrow">404</p><h1 class="sr">404</h1><div class="nf-grid">{blocks}</div></main></body></html>''')
    # editor-defined redirects (old URLs, renamed works …): settings.redirects = [{"from": "/old/", "to": "/en/works/"}]
    for r in SET.get('redirects', []):
        src = r['from'].strip('/')
        if src:
            write(src + '/index.html', redirect_page(u(r['to']) if r['to'].startswith('/') else r['to']))


def build_seo(entries):
    """entries: list of (path, [languages the page exists in])."""
    urls = ''
    for p, ls in entries:
        alts = ''.join(f'<xhtml:link rel="alternate" hreflang="{l}" href="{SITE_URL + lu(l, p)}"/>' for l in ls)
        if 'en' in ls:
            alts += f'<xhtml:link rel="alternate" hreflang="x-default" href="{SITE_URL + lu("en", p)}"/>'
        for l in ls:
            urls += f'<url><loc>{SITE_URL + lu(l, p)}</loc><lastmod>{TODAY}</lastmod>{alts}</url>\n'
    write('sitemap.xml', f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n{urls}</urlset>\n')
    if STAGING:
        write('robots.txt', 'User-agent: *\nDisallow: /\n')
    else:
        write('robots.txt', f'User-agent: *\nAllow: /\nDisallow: {u("/admin/")}\nDisallow: {u("/staging/")}\n\nSitemap: {SITE_URL + u("/sitemap.xml")}\n')


def copy_static():
    for d in ('assets', 'admin'):
        src = os.path.join(ROOT, d)
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(OUT, d), dirs_exist_ok=True)
    if Image:  # responsive variants
        for f in glob.glob(os.path.join(OUT, 'assets/img/*.webp')):
            if f.endswith('-800.webp'):
                continue
            with Image.open(f) as im:
                if im.size[0] > 900:
                    r = 800 / im.size[0]
                    im.resize((800, round(im.size[1] * r)), Image.LANCZOS).save(f[:-5] + '-800.webp', 'WEBP', quality=80, method=6)
    cname = os.path.join(ROOT, 'CNAME')
    if os.path.exists(cname):
        shutil.copy(cname, OUT)
    open(os.path.join(OUT, '.nojekyll'), 'w').close()


ALL = {}


def set_scope(lang):
    """Restrict record lists to what is published in this language."""
    global WORKS, WBY, PRESS, NEWS, CONCERTS
    WORKS = [w for w in ALL['works'] if avail(w, lang)]
    WBY = {w['slug']: w for w in WORKS}
    PRESS = [p for p in ALL['press'] if avail(p, lang)]
    NEWS = [n for n in ALL['news'] if avail(n, lang)]
    CONCERTS = [c for c in ALL['concerts'] if avail(c, lang)]


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    if not STAGING:
        copy_static()
    ALL.update(works=WORKS, press=PRESS, news=NEWS, concerts=CONCERTS)
    for rec, sec in [(w, 'works') for w in WORKS] + [(n, 'news-press') for n in NEWS] + [(c, 'concerts') for c in CONCERTS]:
        for l, sl in (rec.get('slugs') or {}).items():
            if sl:
                SLUGS[(l, sec, rec['slug'])] = sl
    for lang in LANGS:
        set_scope(lang)
        build_home(lang); build_about(lang); build_works(lang); build_listen(lang); build_concerts(lang)
        build_press(lang); build_contact(lang); build_search(lang); build_utility(lang)
    build_root()
    static = ['', 'about', 'works', 'listen-watch', 'concerts', 'news-press', 'news-press/press-kit', 'contact', 'privacy', 'accessibility'] + ['contact/' + k for k in FORM_KINDS]
    entries = [(p, LANGS) for p in static]
    entries += [('works/' + w['slug'], [l for l in LANGS if avail(w, l)]) for w in ALL['works']]
    entries += [('news-press/' + n['slug'], [l for l in LANGS if avail(n, l)]) for n in ALL['news']]
    entries += [('concerts/' + c['slug'], [l for l in LANGS if avail(c, l)]) for c in ALL['concerts']]
    build_seo(entries)
    pages = sum(len(ls) for _, ls in entries)
    print(f'Built {pages} pages ({"staging" if STAGING else "production"}; languages: {", ".join(LANGS)}) into {os.path.relpath(OUT, ROOT)}/  base="{BASE}" site="{SITE_URL}"')
    if not STAGING and SET.get('build_staging', True) and os.environ.get('NO_STAGING') != '1':
        env = dict(os.environ, STAGING='1', BASE_PATH=BASE + '/staging', ASSET_BASE=BASE,
                   OUT_DIR=os.path.join(os.path.relpath(OUT, ROOT), 'staging'))
        subprocess.run([sys.executable, os.path.abspath(__file__)], env=env, check=True)


if __name__ == '__main__':
    main()
