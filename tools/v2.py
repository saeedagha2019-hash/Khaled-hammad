"""Page templates for the approved v2 identity (softened teal-grey gradient, black bars, framed images).

The generator in build.py loads content and calls these builders; `B` is that module, so the record lists
(B.WORKS, B.PRESS …) are always the ones scoped to the language being built.
"""
import datetime, json, os, re, urllib.parse

B = None  # set by build.py
V2 = None


def V(lang):
    base = dict(V2['en'])
    base.update(V2.get(lang, {}))
    return base


def e(s):
    return B.e(s)


IC = {
    'arr': '<svg class="arr" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'ext': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16 16 8M9 8h7v7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'play': '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    'pause': '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
    'l': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'r': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'chev': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'search': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    'x': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    'share': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12M7 9l5-5 5 5M5 14v6h14v-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'full': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'link': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'prev': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6v12M18 6l-8 6 8 6z" fill="currentColor"/></svg>',
    'next': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 6v12M6 6l8 6-8 6z" fill="currentColor"/></svg>',
    'vol': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    'dl': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 19h14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'note': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="16.5" cy="16" r="2.5" fill="currentColor"/></svg>',
    'down': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
}
SOC = {
    'Facebook': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h2.5V4.5H14A3.5 3.5 0 0 0 10.5 8v2.5H8V14h2.5v6.5H14V14h2.5l.5-3.5h-3V8.6c0-.3.3-.6.6-.6z" fill="currentColor"/></svg>',
    'Instagram': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="16.8" cy="7.2" r="1" fill="currentColor"/></svg>',
    'YouTube': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m10.5 9.5 4 2.5-4 2.5z" fill="currentColor"/></svg>',
    'Spotify': '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10c2.8-.9 5.8-.6 8.2.8M8.6 13c2.2-.6 4.4-.4 6.3.6M9.2 15.8c1.6-.4 3.1-.3 4.5.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
}
PLAT = [('Spotify', 'S'), ('Apple Music', '♪'), ('Anghami', 'A'), ('YouTube', '▶'), ('Deezer', 'D'), ('SoundCloud', '☁'), ('Amazon Music', 'a'), ('IMDb', 'i')]


def soc_url(name):
    for s in B.SET['social']:
        if s['name'] == name:
            return s['url']
    return ''


def im(src, alt='', cls='', sizes='100vw', lazy=True, pos=None, priority=False):
    extra = f' style="object-position:{e(pos)}"' if pos else ''
    return B.img(src, alt, cls=cls, sizes=sizes, lazy=lazy, priority=priority, extra=extra)


def fr(src, alt='', cls='', sizes='(max-width: 900px) 100vw, 50vw', pos=None, lazy=True, extra_cls='', shine=True, priority=False):
    return f'<div class="fr {cls}">{im(src, alt, sizes=sizes, lazy=lazy, pos=pos, priority=priority)}{"<span class=" + chr(34) + "shine" + chr(34) + "></span>" if shine else ""}</div>'


def lu(lang, p=''):
    return B.lu(lang, p)


def arrow_btn(cls='solid', href='#', label='', icon='arr', ext=False, attrs=''):
    tgt = ' target="_blank" rel="noopener"' if ext else ''
    return f'<a class="btn {cls}" href="{e(href)}"{tgt}{attrs}>{e(label)}{IC["ext" if ext else icon]}</a>'


def dig(lang, n):
    return B.AR_DIG(n) if lang == 'ar' else str(n)


def poster_src(w):
    return w['poster'] if w.get('poster') and B.media_ok(w.get('poster'), w.get('poster_rights')) else None


def poster_fr(w, lang, sizes='(max-width: 600px) 50vw, 200px', cls='', lazy=True):
    t = B.I18N[lang]
    p = poster_src(w)
    if p:
        return fr(p, '', cls=cls, sizes=sizes, lazy=lazy)
    return (f'<div class="fr {cls}"><div class="ph-empty"><span class="k">{e(t["cat"][w["category"]])}</span><b>{e(B.tr(w["title"], lang))}</b>'
            f'<small class="dim">{e(w["year"] or "")}</small></div></div>')


# ---------------------------------------------------------------- chrome
NAV = [('about', 'about'), ('works', 'works'), ('listen', 'listen-watch'), ('concerts', 'concerts'), ('press', 'news-press'), ('contact', 'contact')]


def header(lang, path, alt_langs):
    t = B.I18N[lang]
    cur = path.split('/')[0] if path else ''
    links = ''.join(f'<li><a href="{lu(lang, p)}"{" aria-current=" + chr(34) + "page" + chr(34) if cur == p else ""}>{e(t["nav"][k])}</a></li>' for k, p in NAV)
    langs = ''.join(f'<li><a href="{B.lang_href(l, path, alt_langs)}" hreflang="{l}" lang="{l}"{" aria-current=" + chr(34) + "true" + chr(34) if l == lang else ""} title="{e(B.I18N[l]["lang_name"])}">{l.upper()}</a></li>' for l in B.LANGS)
    return f'''<a class="skip" href="#main">{e(t["skip"])}</a>
<header class="hd" data-header><div class="wrap hd-in">
 <a class="brand" href="{lu(lang)}">{e(t["site_name"])}</a>
 <button class="burger" type="button" aria-expanded="false" aria-controls="nav" aria-label="{e(t["menu"])}"><span></span></button>
 <nav class="nav" id="nav" aria-label="{e(t["menu"])}"><ul class="ls">{links}</ul><ul class="lg" aria-label="{e(t["language"])}">{langs}</ul></nav>
</div></header>'''


def soc_icons():
    return '<ul class="soc">' + ''.join(f'<li><a href="{e(soc_url(n))}" target="_blank" rel="noopener" aria-label="{n}">{SOC[n]}</a></li>' for n in ('Instagram', 'Facebook', 'YouTube', 'Spotify') if soc_url(n)) + '</ul>'


def footer(lang, path, alt_langs):
    t, v = B.I18N[lang], V(lang)
    pl = ''.join(f'<li><a href="{e(soc_url(n))}" target="_blank" rel="noopener">{e(n)}</a></li>' for n in ('IMDb', 'Spotify', 'Apple Music', 'Anghami', 'YouTube', 'SoundCloud', 'Instagram', 'Facebook') if soc_url(n))
    langs = ' · '.join(f'<a href="{B.lang_href(l, path, alt_langs)}" hreflang="{l}" lang="{l}">{l.upper()}</a>' for l in B.LANGS)
    return f'''<footer class="ft"><div class="wrap">
 <div class="ft-top"><div><p class="nm" style="margin:0">{e(t["site_name"])}</p><p class="tg" style="margin-bottom:0">{e(v["tagline"])}</p></div><ul class="ft-links">{pl}</ul></div>
 <div class="ft-bt"><span>© {datetime.date.today().year} {e(t["site_name"])} · <a href="mailto:{e(B.SET["contacts"]["general"])}">{e(B.SET["contacts"]["general"])}</a></span>
  <span>{langs} &nbsp;·&nbsp; <a href="{lu(lang, "privacy")}">{e(t["privacy"])}</a> · <a href="{lu(lang, "accessibility")}">{e(t["accessibility"])}</a></span></div>
</div></footer>'''


def page(lang, path, title, body, desc=None, jsonld=None, og_image=None, review=False, alt_langs=None, noindex=False, body_class=''):
    alt_langs = [l for l in (alt_langs or B.LANGS) if l in B.LANGS]
    t = B.I18N[lang]
    full_title = f'{title} | {t["site_name"]}' if title else f'{t["site_name"]} — {V(lang)["descriptor"]}'
    desc = desc or t['meta_desc']
    canon = B.SITE_URL + lu(lang, path)
    alts = ''.join(f'<link rel="alternate" hreflang="{l}" href="{B.SITE_URL + lu(l, path)}">' for l in alt_langs)
    if 'en' in alt_langs:
        alts += f'<link rel="alternate" hreflang="x-default" href="{B.SITE_URL + lu("en", path)}">'
    og = B.SITE_URL + B.u(og_image or '/assets/img/d/hx-polowide-clean.webp')
    ld = ''.join('<script type="application/ld+json">' + json.dumps(b, ensure_ascii=False).replace('</', '<\\/') + '</script>' for b in (jsonld or []))
    note = f'<p class="review-note" role="note">{e(t["translation_review"])}</p>' if review and t['translation_review'] else ''
    robots = '<meta name="robots" content="noindex, nofollow">' if (B.STAGING or noindex) else ''
    verify = f'<meta name="google-site-verification" content="{e(B.SET["google_site_verification"])}">' if B.SET.get('google_site_verification') and not B.STAGING else ''
    staging_bar = f'<p class="staging-bar" role="note">STAGING — {e(t["staging_note"])}</p>' if B.STAGING else ''
    js_t = {k: t[k] for k in ('play', 'pause', 'copied', 'copy_text', 'search_none', 'err', 'sent', 'sent_mailto')}
    kh = {'lang': lang, 'base': B.BASE, 't': js_t, 'endpoint': B.SET.get('form_endpoint', ''), 'analytics': {} if B.STAGING else B.SET.get('analytics', {})}
    return f'''<!doctype html>
<html lang="{lang}" dir="{t['dir']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(full_title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{canon}">{alts}
<meta property="og:type" content="website"><meta property="og:site_name" content="{e(t['site_name'])}">
<meta property="og:title" content="{e(full_title)}"><meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{canon}"><meta property="og:image" content="{og}"><meta property="og:locale" content="{t['locale']}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#000000">{robots}{verify}
<link rel="icon" href="{B.u('/assets/icons/favicon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="{B.u('/assets/css/fonts.css')}?v={B.VERSION}">
<link rel="stylesheet" href="{B.u('/assets/css/v2.css')}?v={B.VERSION}">
{ld}
</head>
<body class="{body_class}">
{staging_bar}{header(lang, path, alt_langs)}
<main id="main" tabindex="-1">{note}{body}</main>
{footer(lang, path, alt_langs)}
{B.consent_banner(lang)}
<script>window.KH={json.dumps(kh, ensure_ascii=False)};</script>
<script src="{B.u('/assets/js/v2.js')}?v={B.VERSION}" defer></script>
</body>
</html>'''


def strip(left, right):
    return f'<div class="strip" aria-hidden="true"><div class="wrap"><span>{left}</span><span>{right}</span></div></div>'


def crumb(lang, items):
    t = B.I18N[lang]
    parts = [f'<a href="{lu(lang)}">{e(t["nav"]["home"])}</a>']
    for i, (n, h) in enumerate(items):
        parts.append(f'<b>{e(n)}</b>' if i == len(items) - 1 or not h else f'<a href="{h}">{e(n)}</a>')
    return '<nav class="crumb" aria-label="Breadcrumb">' + ' / '.join(parts) + '</nav>'


def write(lang, path, html):
    B.write(B.out(lang, path), html)


# ---------------------------------------------------------------- shared data
def fmt_d(iso, lang, prec='day'):
    if not iso:
        return B.I18N[lang]['undated']
    y, m, d = iso.split('-')
    if prec == 'year':
        return dig(lang, y)
    if prec == 'month':
        return f'{B.I18N[lang]["months"][int(m) - 1]} {dig(lang, y)}'
    s = B.fmt_date(iso, lang)
    return B.AR_DIG(s) if lang == 'ar' else s


NCAT = {'coverage': 'news', 'tv': 'news', 'feature': 'news', 'interview': 'interviews', 'video-interview': 'interviews', 'tv-interview': 'interviews', 'radio': 'podcasts', 'research': 'research'}


def feed(lang):
    """News posts (own pages) and press items (external) as one list, newest first."""
    t, v = B.I18N[lang], V(lang)
    out = []
    for n in B.NEWS:
        src = n.get('sources') or []
        out.append({'kind': 'news', 'date': n['date'], 'prec': 'day', 'title': B.tr(n['title'], lang), 'sum': B.tr(n['summary'], lang),
                    'pub': B.tr(src[0]['label'], lang).split(' — ')[0] if src else t['site_name'], 'type': t['news'], 'cat': 'news',
                    'img': n.get('image'), 'pos': 'center', 'href': lu(lang, 'news-press/' + n['slug']), 'ext': False, 'cta': v['read_story'], 'slug': n['slug']})
    news_urls = {s['url'] for n in B.NEWS for s in n.get('sources', [])}
    for p in B.PRESS:
        if p['url'] and p['url'] in news_urls:
            continue
        pub = B.tr(p['publisher'], lang)
        cta = (v['listen_at'] if p['type'] == 'radio' else v['watch_at'] if p['media'] == 'video' else v['read_at']).format(p=pub.split(' · ')[0])
        typ = t['press_type'].get(p['type']) or v['ncat'].get(NCAT.get(p['type'], 'news'), '')
        if p['type'] == 'feature':
            typ = 'Feature' if lang != 'ar' else 'مقال'
        if p['type'] == 'research':
            typ = v['ncat']['research']
        if p['type'] == 'radio':
            typ = v['ncat']['podcasts']
        out.append({'kind': 'press', 'date': p['date'] or '', 'prec': p.get('date_precision', 'day'), 'title': B.tr(p['title'], lang), 'sum': B.tr(p['summary'], lang),
                    'pub': pub, 'type': typ, 'cat': NCAT.get(p['type'], 'news'), 'img': p.get('image'), 'pos': p.get('image_position', 'center'),
                    'href': p['url'], 'ext': True, 'cta': cta, 'media': p['media'], 'rel_concert': p.get('related_concert'), 'url': p['url']})
    return sorted(out, key=lambda x: x['date'] or '0000', reverse=True)


def cta_link(x, cls='lk'):
    if not x['href']:
        return f'<span class="pend">{e(V_LANG[0]["link_pending"])}</span>'
    tgt = ' target="_blank" rel="noopener"' if x['ext'] else ''
    return f'<a class="{cls}" href="{e(x["href"])}"{tgt}>{e(x["cta"])}{IC["ext" if x["ext"] else "arr"]}</a>'


V_LANG = [None]


def meta_line(x, lang):
    return (f'<div class="meta"><span class="pub">{e(x["pub"])}</span><span aria-hidden="true">·</span><time datetime="{e(x["date"])}">{e(fmt_d(x["date"], lang, x["prec"]))}</time>'
            f'<span class="ty">{e(x["type"])}</span></div>')


def tracks(lang):
    """The real audio on the site: the showreel theme and the works with licensed samples."""
    t = B.I18N[lang]
    out = []
    if os.path.exists(os.path.join(B.ROOT, 'assets/audio/showreel-theme.mp3')):
        out.append({'src': B.u('/assets/audio/showreel-theme.mp3'), 'title': t['showreel'], 'sub': V(lang)['descriptor'].split(' · ')[0], 'img': B.u('/assets/img/d/hx-piano.webp'),
                    'thumb': '/assets/img/d/hx-piano.webp', 'dur': B.audio_dur('/assets/audio/showreel-theme.mp3'), 'w': None})
    for w in B.audio_works():
        p = poster_src(w)
        out.append({'src': B.u(w['audio']['src']), 'title': B.tr(w['title'], lang), 'sub': f'{t["cat"][w["category"]]} · {dig(lang, w["year"])}', 'img': B.u(p) if p else '',
                    'thumb': p, 'dur': B.audio_dur(w['audio']['src']), 'w': w})
    return out


def track_attrs(x):
    return f' data-track data-src="{e(x["src"])}" data-title="{e(x["title"])}" data-sub="{e(x["sub"])}" data-img="{e(x["img"])}"'


def pbar(lang, full=True):
    t = B.I18N[lang]
    side = (f'<button class="ib flip" type="button" data-step="-1" aria-label="{e(t["prev"])}">{IC["prev"]}</button>' if full else '')
    side2 = (f'<button class="ib flip" type="button" data-step="1" aria-label="{e(t["next"])}">{IC["next"]}</button>' if full else '')
    return (f'<div class="pbar" data-pbar>{side}<button class="pp" type="button" aria-label="{e(t["play"])}">{IC["play"]}{IC["pause"]}</button>{side2}'
            f'<span class="tm" data-cur>0:00</span><div class="seek" role="slider" tabindex="0" aria-label="{e(t["seek"])}" aria-valuemin="0"><i></i></div><span class="tm" data-dur>–:––</span>'
            f'<span class="vol"><button class="ib" type="button" data-mute aria-label="{e(t["volume"])}">{IC["vol"]}</button><input type="range" min="0" max="1" step="0.05" value="0.8" data-vol aria-label="{e(t["volume"])}"><span data-volv>80%</span></span></div>')


def videos(lang):
    """YouTube videos from concerts and press items (only real, embeddable videos)."""
    v = V(lang)
    out, seen = [], set()
    for c in B.CONCERTS:
        for vd in c.get('video', []):
            if vd['youtube'] in seen:
                continue
            seen.add(vd['youtube'])
            out.append({'yt': vd['youtube'], 'title': B.tr(vd['title'], lang), 'pub': B.tr(c['venue'], lang).split(' — ')[0], 'date': c['date'], 'cat': 'concerts',
                        'type': v['vcat']['concerts'], 'img': '/assets/img/d/lw-tv.webp'})
    for p in B.PRESS:
        m = re.search(r'youtu\.be/([\w-]+)|[?&]v=([\w-]+)', p['url'] or '')
        if not m:
            continue
        yid = m.group(1) or m.group(2)
        if yid in seen:
            continue
        seen.add(yid)
        cat = 'interviews' if p['type'] in ('radio', 'interview', 'tv-interview', 'video-interview') else ('concerts' if 'concert' in B.tr(p['title'], 'en').lower() else 'tv')
        out.append({'yt': yid, 'title': B.tr(p['title'], lang), 'pub': B.tr(p['publisher'], lang).split(' · ')[0], 'date': p['date'] or '', 'cat': cat,
                    'type': v['vcat'][cat], 'img': p.get('image') or '/assets/img/d/lw-concert.webp'})
    return sorted(out, key=lambda x: x['date'], reverse=True)


def vcard(x, lang, cls='vcard', sizes='(max-width: 600px) 100vw, 33vw', item=True):
    data = f' data-item data-cat="{x["cat"]}" data-y="{x["date"][:4]}" data-k="{e((x["title"] + " " + x["pub"]).lower())}"' if item else ''
    return (f'<article class="{cls} rv"{data} data-yt="{e(x["yt"])}" data-title="{e(x["title"])}"><button type="button" class="fr hov" data-yt-play style="display:block;width:100%" aria-label="{e(B.I18N[lang]["play"])}: {e(x["title"])}">'
            f'{im(x["img"], "", sizes=sizes)}<span class="pl">{IC["play"]}</span><span class="shine"></span></button>'
            f'<div class="meta"><span class="pub">{e(x["pub"])}</span><span aria-hidden="true">·</span><span>{e(x["type"])}</span></div><h3>{e(x["title"])}</h3></article>')


def contact_cta(lang, center=True, small=False):
    t, v = B.I18N[lang], V(lang)
    mail = B.SET['contacts']['general']
    phones = ' <span>·</span> '.join(f'<a href="tel:{e(p["number"].replace(" ", ""))}" dir="ltr">{e(p["number"])}</a> <span class="br">{e(B.tr(p["label"], lang))}</span>' for p in B.SET.get('phones', []))
    return f'''<section class="cta"><div class="wrap">
 <span class="k rv">{e(v["work_together"])}</span>
 <h2 class="h2 split-l">{e(v["create"])} <em class="br">{e(v["timeless"])}</em></h2>
 <div class="btns rv" style="--d:.2s">{arrow_btn("solid", lu(lang, "contact/scoring"), v["commission"])}{arrow_btn("line", lu(lang, "contact/concerts"), v["book_concert"])}{arrow_btn("line", lu(lang, "contact/press"), v["press_partner"])}</div>
 <p class="dir rv" style="--d:.3s">{e(v["write_directly"])} <a href="mailto:{e(mail)}">{e(mail)}</a></p>
 {f'<p class="ph rv" style="--d:.35s">{e(v["call"])} {phones}</p>' if phones else ''}
 <div class="rv" style="--d:.4s">{soc_icons()}</div>
</div></section>'''


def coverflow(ws, lang, view=True):
    t, v = B.I18N[lang], V(lang)
    items = ''
    for w in ws:
        items += (f'<div class="cf-item"><a href="{lu(lang, "works/" + w["slug"])}" aria-label="{e(B.tr(w["title"], lang))}">{poster_fr(w, lang, sizes="300px")}'
                  f'<span class="cap"><b>{e(B.tr(w["title"], lang))}</b><small>{dig(lang, w["year"] or "")} · {e(t["cat"][w["category"]])}</small>'
                  f'{"<span class=" + chr(34) + "vd" + chr(34) + ">" + e(v["view_details"]) + "</span>" if view else ""}</span></a></div>')
    return (f'<div class="cf" data-cf tabindex="0" aria-roledescription="carousel">{items}</div>'
            f'<div class="cf-nav"><button class="arw" type="button" data-cf-step="-1" aria-label="{e(v["prev"])}">{IC["l"]}</button><span class="cf-dots" aria-hidden="true"></span>'
            f'<button class="arw" type="button" data-cf-step="1" aria-label="{e(v["next"])}">{IC["r"]}</button></div>')


def award_rows(lang, items, lim_cls=True):
    rows = ''
    for a in items:
        name = B.tr(a['name'], lang)
        parts = name.split(' — ', 1)
        big, small = (parts[1], parts[0]) if len(parts) == 2 else (name, '')
        body = B.tr(a.get('awarding_body'), lang)
        sub = ' · '.join(x for x in (small, body) if x)
        href = lu(lang, 'works/' + a['work']) if a.get('work') and a['work'] in B.WBY else ''
        b = f'<a href="{href}">{e(big)}</a>' if href else e(big)
        src = f'<a class="src" href="{e(a["evidence_url"])}" target="_blank" rel="noopener">{e(V(lang)["source"])} ↗</a>' if a.get('evidence_url') else '<span></span>'
        rows += f'<li data-g="{e(a["group"])}"><span class="y">{dig(lang, a["year"])}</span><span><b>{b}</b><small>{e(sub)}</small></span>{src}</li>'
    return rows


def group_label(g, lang):
    return B.tr(g['label'], lang).split(' — ')[0]


# ---------------------------------------------------------------- home
def build_home(lang):
    t, v = B.I18N[lang], V(lang)
    V_LANG[0] = v
    fw = B.featured_works()
    extra = [w for w in B.WORKS if poster_src(w) and w not in fw][:9 - len(fw)]
    cf_works = [w for w in fw + extra if poster_src(w)] or fw
    tr_ = tracks(lang)
    ch = ''.join(f'<li><button type="button"{track_attrs(x)}><span class="n">{dig(lang, "%02d" % (i + 1))}</span><span class="th">{im(x["thumb"], "", sizes="52px") if x["thumb"] else ""}</span>'
                 f'<span><b>{e(x["title"])}</b><small>{e(x["sub"])}</small></span><span class="t">{B.fmt_dur(x["dur"])}</span></button></li>' for i, x in enumerate(tr_))
    first = tr_[0] if tr_ else None
    c = B.CONCERTS[-1] if B.CONCERTS else None
    slides = [('/assets/img/d/lv-stage.webp', 'Main Hall · Full house'), ('/assets/img/d/lp-n-hero.webp', ''), ('/assets/img/d/lv-p1.webp', ''), ('/assets/img/d/ab-bow.webp', ''), ('/assets/img/d/lv-aud.webp', '')]
    caps = {'en': ['Main Hall · Full house', 'The orchestra and the screen', 'At the piano', 'Curtain call', 'A full house'],
            'ar': ['المسرح الكبير · كامل العدد', 'الأوركسترا والشاشة', 'على البيانو', 'تحية الختام', 'جمهور كامل العدد']}
    cl = caps.get(lang, caps['en'])
    sl = ''.join(f'<img src="{e(B.u(s))}" alt="" data-cap="{e(cl[i])}"{" loading=" + chr(34) + "lazy" + chr(34) if i else ""} decoding="async">' for i, (s, _) in enumerate(slides))
    st = B.ABOUT['stats']
    yrs = str(st['years_active']).rstrip('+')
    recog = sorted(B.AWARDS['items'], key=lambda a: -a['year'])
    groups = [g for g in B.AWARDS['groups'] if any(a['group'] == g['key'] for a in recog)]
    gtabs = f'<button class="chip" type="button" data-aw-g="all" aria-pressed="true">{e(v["all"])}</button>' + ''.join(f'<button class="chip" type="button" data-aw-g="{g["key"]}" aria-pressed="false">{e(group_label(g, lang))}</button>' for g in groups[:3])
    fd = [x for x in feed(lang) if x['img']]
    feat = fd[0] if fd else None
    minis = ''.join(f'<article class="mini rv"><a href="{e(x["href"] or "#")}"{" target=" + chr(34) + "_blank" + chr(34) + " rel=" + chr(34) + "noopener" + chr(34) if x["ext"] else ""} class="hov">{fr(x["img"], "", "sm", "120px", x["pos"])}</a><div>{meta_line(x, lang)}<h3>{e(x["title"])}</h3>{cta_link(x)}</div></article>' for x in fd[1:4])
    featc = ''
    if feat:
        featc = (f'<a class="feat-card hov rv-img" href="{e(feat["href"] or "#")}"{" target=" + chr(34) + "_blank" + chr(34) + " rel=" + chr(34) + "noopener" + chr(34) if feat["ext"] else ""}>{fr(feat["img"], "", "", "(max-width: 900px) 100vw, 60vw", feat["pos"])}'
                 f'<div class="tx">{meta_line(feat, lang)}<h3 class="h3">{e(feat["title"])}</h3><p>{e(feat["sum"])}</p><span class="lk">{e(feat["cta"])}{IC["ext" if feat["ext"] else "arr"]}</span></div></a>')
    name = t['site_name'].split(' ', 1)
    h1 = f'<span class="ln">{e(name[0])}</span><span class="ln l2">{e(name[1])}</span>' if len(name) == 2 else e(t['site_name'])
    reel = lambda a: e(v['reel'].format(a=dig(lang, '%02d' % a), b=dig(lang, '08')))
    scroll = f'{e(v["scroll"])} <span class="cue">↓</span>'
    body = f'''
<section class="hero" aria-labelledby="hero-t">
 <div class="bg">{im('/assets/img/d/hx-polowide-clean.webp', '', sizes='100vw', lazy=False, priority=True)}</div>
 <div class="wrap in"><div class="tx">
  <span class="k rv">{e(v["hero_kicker"])}</span>
  <h1 class="h1 split-l" id="hero-t">{h1}</h1>
  <p class="sub rv" style="--d:.5s">{e(v["descriptor"])}</p>
  <p class="tg rv" style="--d:.6s">{e(v["tagline"])}</p>
  <div class="btns rv" style="--d:.75s">{arrow_btn("solid", lu(lang, "works"), v["explore_works"])}<a class="btn line" href="{lu(lang, "listen-watch")}">{IC["play"].replace('class="i-play"', 'class="i-play" style="width:12px;height:12px"')}{e(v["listen_watch"])}</a></div>
 </div></div>
</section>
{strip(e(v["since"]), scroll)}
{strip("02 · " + e(v["selected_works"]), reel(2))}
<section class="sec" aria-labelledby="sw-t" style="padding-top:clamp(50px,6vw,90px)"><div class="wrap">
 <div class="sec-hd"><div><span class="k rv">{e(v["film_tv"])}</span><h2 class="h2 split-l" id="sw-t">{e(v["selected_works"])}</h2><p class="lede rv">{e(v["selected_lede"])}</p></div>
  <div class="btns rv">{arrow_btn("solid", lu(lang, "works"), v["all_works"])}{arrow_btn("line", soc_url("IMDb"), v["filmography"], ext=True)}</div></div>
 <div class="rv-fade">{coverflow(cf_works, lang)}</div>
</div></section>
<div style="height:clamp(50px,6vw,90px)"></div>
{strip(e(v["scroll"]), e(v["since"]))}
{strip("03 · " + e(v["sound_story"]), reel(3))}
<section class="sec" aria-labelledby="ss-t" style="padding-top:clamp(50px,6vw,90px)"><div class="wrap">
 <div class="sec-hd"><div><span class="k rv">{e(v["showreel_k"])}</span><h2 class="h2 split-l" id="ss-t">{e(v["sound_story"])}</h2></div><p class="lede rv">{e(v["sound_lede"])}</p></div>
 <div class="ss" data-deck data-continue>
  <div class="stage rv-img">
   {fr('/assets/img/d/ab-stagew.webp', '', '', '(max-width: 900px) 100vw, 64vw', 'center 45%', shine=False)}
   <div class="badge"><span class="k" data-now-n>{dig(lang, "01")} · {e(v["now_showing"])}</span><b data-now-title>{e(first["title"]) if first else ""}</b><small data-now-sub>{e(first["sub"]) if first else ""}</small></div>
   <button class="bigplay" type="button" data-deck-play aria-label="{e(t["play"])}"><span class="c">{IC["play"]}{IC["pause"]}</span><span class="k">{e(v["play_showreel"])}</span></button>
   <div class="ctrl">{pbar(lang)}</div>
  </div>
  <div class="rv" style="--d:.15s"><span class="k">{e(v["chapters"])}</span><ul class="ch" style="margin-top:12px">{ch}</ul>
   <div class="box"><span class="k">{e(v["credits"])}</span>{e(v["credits_text"])}</div>
   <div class="btns" style="margin-top:18px">{arrow_btn("solid", lu(lang, "listen-watch"), v["listen_watch"])}</div></div>
 </div>
</div></section>
<div style="height:clamp(50px,6vw,90px)"></div>
{strip(e(v["scroll"]), e(v["since"]))}
{strip("04 · " + e(v["live_k"]), reel(4))}
<section class="live" data-slides aria-labelledby="lv-t">
 <div class="sl" aria-hidden="true">{sl}</div>
 <div class="wrap in">
  <span class="k rv">{e(v["live_k"])}</span>
  <h2 class="h2 split-l" id="lv-t">{e(v["from_screen"])}</h2>
  {f'<div class="ven rv" style="--d:.3s"><b>{e(B.tr(c["venue"], lang).split(" — ")[0])}</b><small>{e(B.tr(c["venue"], lang).split(" — ")[-1])} · {e(fmt_d(c["date"], lang))}<br>{e(B.tr(c["partners"], lang))}</small></div>' if c else ''}
  <div class="btns rv" style="--d:.4s">{arrow_btn("solid", lu(lang, "concerts"), v["live_concerts"])}{arrow_btn("line", lu(lang, "contact/concerts"), v["book_concert"])}</div>
 </div>
 <div class="wrap ft2"><button class="arw" type="button" data-sl-step="-1" aria-label="{e(v["prev"])}">{IC["l"]}</button>
  <span class="ix"><span data-ix>01</span> <small>/ {dig(lang, "%02d" % len(slides))}</small></span><span class="cap" data-cap></span>
  <button class="arw" type="button" data-sl-step="1" aria-label="{e(v["next"])}">{IC["r"]}</button><span class="cf-dots"></span></div>
</section>
{strip(e(v["scroll"]), e(B.tr(c["city"], lang).split("،")[0].split(",")[0]) + " · " + dig(lang, c["date"][:4]) if c else "")}
{strip("05 · " + e(v["artist_profile"]), reel(5))}
<section class="prof" aria-labelledby="pf-t">
 <div class="ph rv-fade">{im('/assets/img/d/hx-stool.webp', t['site_name'], sizes='(max-width: 760px) 100vw, 60vw')}</div>
 <div class="wrap in"><div class="tx">
  <span class="k rv">{e(v["profile_k"])}</span><h2 class="h2 split-l" id="pf-t">{e(v["artist_profile"])}</h2>
  <p class="serif-l rv">{e(v["profile_line"]).replace("{drama}", '<em class="br">' + e(v["drama"]) + '</em>')}</p>
  <p class="b rv">{e(B.tr(B.ABOUT["short_bio"], lang))}</p>
  <dl class="stats rv"><div><dt><span data-count="{st["feature_films"]}">{st["feature_films"]}</span></dt><dd>{e(v["films"])}</dd></div><div><dt><span data-count="{st["tv_series"]}">{st["tv_series"]}</span></dt><dd>{e(v["series"])}</dd></div><div><dt><span data-count="{yrs}">{yrs}</span><sup>+</sup></dt><dd>{e(v["years"])}</dd></div></dl>
  <div class="btns rv" style="margin-top:30px">{arrow_btn("solid", lu(lang, "about"), v["full_bio"])}{arrow_btn("line", lu(lang, "news-press/press-kit"), v["press_kit"])}</div>
 </div></div>
</section>
{strip(e(v["scroll"]), e(v["since"]))}
{strip("06 · " + e(v["recognition"]), reel(6))}
<section class="sec" aria-labelledby="rc-t" style="padding-top:clamp(50px,6vw,90px)"><div class="wrap recog" data-aw="6">
 <div><span class="k rv">{e(v["recog_k"])}</span><h2 class="h2 split-l" id="rc-t" style="margin-top:14px">{e(v["recognition"])}</h2>
  <div class="tabs rv" style="margin:26px 0">{gtabs}</div>
  <ol class="aw-list rv">{award_rows(lang, recog)}</ol>
  <div class="btns rv" style="margin-top:28px"><button class="btn solid" type="button" data-aw-all data-more="{e(v["all_awards"])}" data-less="{e(v["fewer_awards"])}"><span>{e(v["all_awards"])}</span>{IC["chev"]}</button>{arrow_btn("line", lu(lang, "about") + "#milestones", v["career_timeline"])}</div></div>
 <div class="pic rv-img">{fr('/assets/img/d/ab-wd2.webp', '', '', '(max-width: 900px) 100vw, 45vw', 'center 25%')}</div>
</div></section>
<div style="height:clamp(50px,6vw,90px)"></div>
{strip(e(v["scroll"]), e(v["since"]))}
{strip("07 · " + e(v["in_press"]), reel(7))}
<section class="sec" aria-labelledby="pr-t" style="padding-top:clamp(50px,6vw,90px)"><div class="wrap">
 <div class="sec-hd"><div><span class="k rv">{e(v["press_k"])}</span><h2 class="h2 split-l" id="pr-t">{e(v["in_press"])}</h2></div><p class="lede rv">{e(v["press_lede"])}</p></div>
 <div class="feed">{featc}<div>{minis}<div class="btns rv" style="margin-top:24px">{arrow_btn("solid", lu(lang, "news-press"), v["all_news"])}{arrow_btn("line", lu(lang, "news-press/press-kit"), v["press_kit"])}</div></div></div>
</div></section>
<div style="height:clamp(50px,6vw,90px)"></div>
{strip(e(v["scroll"]), e(v["since"]))}
{strip("08 · " + e(t["nav"]["contact"]), reel(8))}
{contact_cta(lang)}'''
    ld = [B.person_ld(lang), {'@context': 'https://schema.org', '@type': 'WebSite', 'name': t['site_name'], 'url': B.SITE_URL + lu(lang), 'inLanguage': lang}]
    write(lang, '', page(lang, '', '', body, jsonld=ld, body_class='is-home'))


# ---------------------------------------------------------------- about
def build_about(lang):
    t, v = B.I18N[lang], V(lang)
    V_LANG[0] = v
    st = B.ABOUT['stats']
    yrs = str(st['years_active']).rstrip('+')
    best = sum(1 for a in B.AWARDS['items'] if a['group'] == 'scoring' and 'best' in B.tr(a['name'], 'en').lower())
    paras = ''.join(f'<p>{e(B.tr(p, lang))}</p>' for p in B.ABOUT['paragraphs'])
    ms = ''.join(f'<li class="rv" style="--d:{i * .06:.2f}s"><span class="y">{dig(lang, x["year"])}</span><span class="dot"></span><p>{e(B.tr(x["text"], lang))}</p></li>' for i, x in enumerate(B.ABOUT['milestones']))
    edu = ''.join(f'<li><span class="y">{dig(lang, x["year"])}</span><span><b>{e(B.tr(x["text"], lang).split(" — ")[0])}</b><small>{e(" — ".join(B.tr(x["text"], lang).split(" — ")[1:]))}</small></span></li>' for x in sorted(B.ABOUT['education'], key=lambda x: x['year']))
    act = ''
    for x in B.ABOUT['activities']:
        s = B.tr(x, lang)
        m = re.search(r'(\d{4}|[٠-٩]{4})', s)
        head, _, tail = s.partition(' — ')
        act += f'<li><span class="y">{e(m.group(1)) if m else "—"}</span><span><b>{e(head)}</b><small>{e(tail)}</small></span></li>'
    aw = sorted(B.AWARDS['items'], key=lambda a: -a['year'])
    gal = B.MEDIA.get('gallery', [])
    cats = [c for c in B.MEDIA.get('gallery_categories', []) if any(c in g['categories'] for g in gal)]
    gtabs = f'<button class="chip" type="button" data-g-cat="all" aria-pressed="true">{e(v["gcat"]["all"])}<small>{dig(lang, len(gal))}</small></button>' + ''.join(
        f'<button class="chip" type="button" data-g-cat="{c}" aria-pressed="false">{e(v["gcat"][c])}<small>{dig(lang, sum(1 for g in gal if c in g["categories"]))}</small></button>' for c in cats)
    figs = ''
    for i, g in enumerate(gal):
        w, h = B.img_size(g['file'])
        port = ' port' if w and h and h > w else ''
        cap = B.tr(g['caption'], lang)
        tags = ' · '.join(v['gcat'][c] for c in g['categories'])
        figs += (f'<figure class="{port.strip()}" data-cats="{" ".join(g["categories"])}"><button type="button" class="hov" data-lb data-full="{e(B.u(g["file"]))}" data-thumb="{e(B.u(g["file"]))}" data-title="{e(cap)}" data-tag="{e(v["gcat"][g["categories"][0]])}" data-tags="{e(tags)}" aria-label="{e(v["photo"])}: {e(cap)}">'
                 f'{fr(g["file"], cap, "", "(max-width: 600px) 80vw, 40vw", g.get("position"))}</button><figcaption><b>{dig(lang, "%02d" % (i + 1))}</b>{e(cap)}</figcaption></figure>')
    kit = f'{lang}/press-kit/khaled-hammad-press-kit-{lang}.docx'
    name = t['site_name'].split(' ', 1)
    h1 = f'<span class="ln">{e(name[0])}</span><span class="ln">{e(name[1])}</span>' if len(name) == 2 else e(t['site_name'])
    body = f'''
<section class="wrap ab-hero">
 <div>{crumb(lang, [(t["about_title"], None)])}
  <h1 class="h1 split-l" style="margin-top:22px">{h1}</h1>
  <p class="sub rv k" style="color:var(--ivory)">{e(v["descriptor"])}</p>
  <p class="serif-l rv">{e(v["about_line"])}</p>
  <div class="facts3 rv"><div><small>{e(v["born"])}</small><b>{e(v["born_v"])}</b></div><div><small>{e(v["trained"])}</small><b>{e(v["trained_v"])}</b></div><div><small>{e(v["based"])}</small><b>{e(v["based_v"])}</b></div></div>
  <div class="btns rv"><a class="btn solid" href="{B.u(kit)}" download>{IC["dl"]}{e(v["download_bio"])}</a>{arrow_btn("line", lu(lang, "news-press/press-kit"), v["press_kit"])}</div>
 </div>
 <div class="rv-img">{fr('/assets/img/d/ab-stand.webp', t['site_name'], 'portrait', '(max-width: 900px) 100vw, 42vw', 'center 12%', lazy=False, priority=True)}<p class="cap-s">{e(v["portrait_cap"])}</p></div>
</section>
<div class="wrap"><dl class="bigstats" data-stagger=".1">
 <div><dt><span data-count="{st["feature_films"]}">{st["feature_films"]}</span></dt><dd>{e(v["films"])}</dd></div><div><dt><span data-count="{st["tv_series"]}">{st["tv_series"]}</span></dt><dd>{e(v["tv_series_l"])}</dd></div>
 <div><dt><span data-count="{yrs}">{yrs}</span><sup>+</sup></dt><dd>{e(v["years_screen"])}</dd></div><div><dt><span data-count="{best}">{best}</span></dt><dd>{e(v["best_score"])}</dd></div></dl></div>
<section class="sec"><div class="wrap bio"><div><span class="k rv">01 · {e(v["bio_k"])}</span><h2 class="h2 split-l" style="margin-top:14px">{e(v["life_music"])}</h2></div><div class="cols rv">{paras}</div></div></section>
<section class="sec"><div class="wrap appr">
 <div class="rv-img">{fr('/assets/img/d/ab-ctrl.webp', '', '', '(max-width: 900px) 100vw, 45vw', '70% 40%')}<p class="cap-s">{e(v["approach_cap"])}</p></div>
 <div><span class="k rv">02 · {e(v["approach_k"])}</span><p class="serif-l rv" style="margin-top:20px">{e(v["profile_line"]).replace("{drama}", '<em class="br">' + e(v["drama"]) + '</em>')}</p>
  <p class="b rv">{e(v["approach_text"])}</p><div class="tags rv">{"".join(f'<span class="tag">{e(x)}</span>' for x in v["approach_tags"])}</div></div>
</div></section>
<section class="sec" id="milestones"><div class="wrap"><span class="k rv">03 · {e(v["timeline_k"])}</span><h2 class="h2 split-l" style="margin:14px 0 40px">{e(v["milestones"])}</h2>
 <ol class="tl" style="--n:{len(B.ABOUT["milestones"])};margin:0;padding:0">{ms}</ol></div></section>
<section class="sec"><div class="wrap two">
 <div><span class="k rv">04 · {e(v["edu_k"])}</span><h2 class="h3 rv" style="margin-top:12px;font-size:clamp(32px,3.4vw,48px)">{e(v["training"])}</h2><ul class="rows rv">{edu}</ul></div>
 <div><span class="k rv">05 · {e(v["act_k"])}</span><h2 class="h3 rv" style="margin-top:12px;font-size:clamp(32px,3.4vw,48px)">{e(v["beyond"])}</h2><ul class="rows rv">{act}</ul></div>
</div></section>
<section class="sec" id="awards"><div class="wrap ab-aw" data-aw="5">
 <div class="rv-img">{fr('/assets/img/d/ab-award.webp', '', '', '(max-width: 900px) 100vw, 40vw', 'center 35%')}<p class="cap-s">{e(v["award_cap"])}</p></div>
 <div><span class="k rv">06 · {e(v["awards_k"])}</span><h2 class="h2 split-l" style="margin:14px 0 26px">{e(v["awards"])}</h2>
  <ol class="aw-list rv">{award_rows(lang, aw)}</ol>
  <div class="btns rv" style="margin-top:26px"><button class="btn line" type="button" data-aw-all data-more="{e(v["all_awards"])}" data-less="{e(v["fewer_awards"])}"><span>{e(v["all_awards"])}</span>{IC["chev"]}</button></div></div>
</div></section>
<section class="sec" id="gallery"><div class="wrap" data-rail>
 <div class="sec-hd"><div><span class="k rv">07 · {e(v["gallery_k"])}</span><h2 class="h2 split-l">{e(v["gallery"])}</h2></div>
  <div class="ctr rv"><span class="ix"><span data-rail-ix>01</span> <small>/ <span data-rail-tot>{len(gal):02d}</span></small></span><button class="arw" type="button" data-rail-step="-1" aria-label="{e(v["prev"])}">{IC["l"]}</button><button class="arw" type="button" data-rail-step="1" aria-label="{e(v["next"])}">{IC["r"]}</button></div></div>
 <div class="tabs rv" style="margin-bottom:24px">{gtabs}</div>
 <div class="rail rv-fade">{figs}</div><div class="rail-prog"><i></i></div>
</div></section>
<section class="sec"><div class="wrap req" style="margin-top:0;border-top:1px solid var(--rule-2)"><div><span class="k rv">{e(v["work_together"])}</span><h2 class="h2 split-l" style="margin-top:14px">{e(v["create"])} <em class="br">{e(v["timeless"])}</em></h2><p class="lede rv" style="margin-top:12px">{e(v["cta_lede"])}</p></div>
 <div class="btns rv">{arrow_btn("solid", lu(lang, "contact"), v["get_in_touch"])}{arrow_btn("line", lu(lang, "works"), v["explore_works"])}</div></div></section>
{lightbox(lang)}'''
    ld = [B.person_ld(lang), B.crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['about_title'], lu(lang, 'about'))])]
    write(lang, 'about', page(lang, 'about', t['about_title'], body, desc=B.tr(B.ABOUT['short_bio'], lang)[:155], jsonld=ld, review=B.draft_lang(lang), og_image='/assets/img/d/ab-stand.webp'))


def lightbox(lang):
    v = V(lang)
    return f'''<div class="lbx" data-lbx hidden role="dialog" aria-modal="true" aria-label="{e(v["gallery"])}">
 <div class="top"><span class="tg" data-lbx-tag></span><span class="ix"><span data-lbx-ix>01</span></span>
  <div class="tools"><button class="cb" type="button" data-lbx-share aria-label="{e(v["share"])}">{IC["share"]}</button><button class="cb" type="button" data-lbx-full aria-label="{e(v["fullscreen"])}">{IC["full"]}</button><button class="cb x" type="button" data-lbx-close aria-label="{e(v["close"])}">{IC["x"]}</button></div></div>
 <div class="mid"><button class="arw" type="button" data-lbx-step="-1" aria-label="{e(v["prev"])}">{IC["l"]}</button>
  <div class="ph"><div class="fr"><img data-lbx-img alt=""></div></div>
  <button class="arw" type="button" data-lbx-step="1" aria-label="{e(v["next"])}" style="background:var(--ivory);color:var(--char)">{IC["r"]}</button>
  <div class="side"><span class="k">{e(v["gallery_k"])}</span><h2 data-lbx-title></h2><div class="meta2"><div><span class="lbl">{e(v["category"])}</span><span data-lbx-cat></span></div><div><span class="lbl">{e(v["photo"])}</span>{e(v["archive"])}</div></div></div></div>
 <div class="thumbs" data-lbx-thumbs></div>
</div>'''


# ---------------------------------------------------------------- works
CATS = ['film', 'tv', 'theatre', 'children', 'songs']


def build_works(lang):
    t, v = B.I18N[lang], V(lang)
    V_LANG[0] = v
    W = B.WORKS
    counts = {c: sum(1 for w in W if w['category'] == c) for c in CATS}
    chips = f'<button class="chip" type="button" data-f-cat="all" aria-pressed="true">{e(t["cat"]["all"])}<small>{dig(lang, len(W))}</small></button>' + ''.join(
        f'<button class="chip" type="button" data-f-cat="{c}" aria-pressed="false">{e(t["cat"][c])}<small>{dig(lang, counts[c])}</small></button>' for c in CATS if counts[c])
    decades = sorted({(w['year'] // 10) * 10 for w in W if w['year']}, reverse=True)
    years = sorted({w['year'] for w in W if w['year']}, reverse=True)
    dfmt = '{d}–{e}' if lang == 'ar' else '{d}s'
    dopts = f'<button class="opt on" type="button" data-f-d="">{e(v["all_decades"])}</button>' + ''.join(
        f'<button class="opt" type="button" data-f-d="{d}"><span>{dig(lang, d)}{"s" if lang != "ar" else "–" + dig(lang, d + 9)}</span><small>{dig(lang, sum(1 for w in W if w["year"] and d <= w["year"] < d + 10))}</small></button>' for d in decades)
    yopts = f'<button type="button" data-f-y="" style="grid-column:1/-1">{e(v["all_years"])}</button>' + ''.join(f'<button type="button" data-f-y="{y}" data-y-of-d>{dig(lang, y)}</button>' for y in years)
    groups = ''
    for d in decades:
        ws = [w for w in W if w['year'] and d <= w['year'] < d + 10]
        cards = ''.join(work_card(w, lang) for w in ws)
        end = min(d + 9, max(w['year'] for w in ws))
        groups += (f'<section class="dec" data-group><div class="dec-hd"><h2>{dig(lang, d)} — {dig(lang, end)} <small><span data-g-count>{dig(lang, len(ws))}</span> {e(v["n_works"].replace("{n} ", "").replace("{n}", ""))}</small></h2></div>'
                   f'<div class="pgrid" data-stagger=".03">{cards}</div></section>')
    undated = [w for w in W if not w['year']]
    if undated:
        groups += f'<section class="dec" data-group><div class="dec-hd"><h2>{e(t["year_tbc"])}</h2></div><div class="pgrid">{"".join(work_card(w, lang) for w in undated)}</div></section>'
    cf_works = [w for w in W if poster_src(w)]
    st = B.ABOUT['stats']
    body = f'''
<div class="wrap page-hd">{crumb(lang, [(t["works_title"], None)])}
 <div class="row"><div><h1 class="h1 split-l">{e(t["works_title"])}</h1><p class="lede rv">{e(v["works_lede"])}</p></div>
  <div class="w-stats rv"><div><b>{st["feature_films"]}</b><small>{e(v["films"])}</small></div><div><b>{st["tv_series"]}</b><small>{e(v["series"])}</small></div><div><b>{st["years_active"]}</b><small>{e(v["years"])}</small></div></div></div>
</div>
<div class="wrap" data-list data-views="grid">
 <div class="fbar">
  <div class="tabs" data-flt>{chips}</div>
  <div class="dd" data-dd data-flt><button type="button" aria-expanded="false">{e(v["decade"])}: <b data-d-label data-all="{e(v["all"])}" data-fmt="{dfmt}">{e(v["all"])}</b>{IC["chev"]}</button><div class="menu"><div class="h">{e(v["choose_decade"])}</div>{dopts}</div></div>
  <div class="dd" data-dd data-flt><button type="button" aria-expanded="false">{e(v["year"])}: <b data-y-label data-all="{e(v["all"])}">{e(v["all"])}</b>{IC["chev"]}</button><div class="menu"><div class="h">{e(v["choose_year"])}</div><div class="ygrid">{yopts}</div></div></div>
  <label class="srch" data-flt>{IC["search"]}<span class="sr">{e(v["search_works"])}</span><input type="search" data-f-q placeholder="{e(v["search_works"])}"></label>
  <div class="end"><div class="vt" role="group"><button class="chip" type="button" data-view="carousel" aria-pressed="false">{e(v["carousel"])}</button><button class="chip" type="button" data-view="grid" aria-pressed="true">{e(v["grid"])}</button></div></div>
 </div>
 <div data-view-pane="grid">{groups}<p class="empty-note" data-empty hidden>{e(v["no_results"])}</p></div>
 <div data-view-pane="carousel" hidden style="padding-top:40px">{coverflow(cf_works, lang)}</div>
</div>
<style>[data-views="carousel"] [data-flt]{{display:none}}</style>
{contact_cta(lang)}'''
    ld = [B.crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['works_title'], lu(lang, 'works'))]),
          {'@context': 'https://schema.org', '@type': 'ItemList', 'numberOfItems': len(W), 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': B.SITE_URL + lu(lang, 'works/' + w['slug'])} for i, w in enumerate(W)]}]
    write(lang, 'works', page(lang, 'works', t['works_title'], body, desc=v['works_lede'], jsonld=ld, review=B.draft_lang(lang)))
    for i, w in enumerate(W):
        build_work(lang, w, i)


def work_card(w, lang):
    t = B.I18N[lang]
    k = ' '.join([B.tr(w['title'], l) for l in B.LANGS] + [w.get('original_title') or ''] + [B.tr(w.get(x), l) for x in ('cast', 'director') for l in B.LANGS]).lower()
    return (f'<a class="pcard" href="{lu(lang, "works/" + w["slug"])}" data-item data-cat="{w["category"]}" data-y="{w["year"] or ""}" data-k="{e(k)}">{poster_fr(w, lang)}'
            f'<h3>{e(B.tr(w["title"], lang))}</h3><small>{dig(lang, w["year"] or "")} · {e(t["cat"][w["category"]])}</small></a>')


def build_work(lang, w, i):
    t, v = B.I18N[lang], V(lang)
    W = B.WORKS
    title = B.tr(w['title'], lang)
    p = poster_src(w)
    prv, nxt = W[i - 1] if i > 0 else W[-1], W[(i + 1) % len(W)]
    facts = [(v['year'], dig(lang, w['year']) if w['year'] else t['year_tbc']), (v['format'], t['cat'][w['category']])]
    if w.get('director'):
        facts.append((v['director'], B.tr(w['director'], lang)))
    if w.get('cast'):
        facts.append((v['cast'], B.tr(w['cast'], lang)))
    facts.append((v['role'], t['role'][w['role']]))
    if w.get('original_title') and lang != 'ar':
        facts.append((v['original_title'], w['original_title']))
    dl = ''.join(f'<div><dt>{e(a)}</dt><dd>{e(b)}</dd></div>' for a, b in facts)
    top = [(v['music'], t['site_name'])]
    if w.get('director'):
        top.append((v['director'], B.tr(w['director'], lang)))
    if w.get('cast'):
        top.append((v['starring'], B.tr(w['cast'], lang)))
    tf = ''.join(f'<div><span class="lbl">{e(a)}</span><b>{e(b)}</b></div>' for a, b in top)
    syn = B.tr(w.get('synopsis'), lang)
    sp = [x for x in syn.split('\n\n') if x.strip()] if syn else []
    story_html = (f'<p class="lead">{e(sp[0])}</p>' + ''.join(f'<p>{e(x)}</p>' for x in sp[1:])) if sp else f'<p class="lead dim">{e(v["story_pending"])}</p>'
    if B.tr(w.get('score_story'), lang):
        story_html += f'<p>{e(B.tr(w["score_story"], lang))}</p>'
    score = ''
    if w.get('audio') and B.media_ok(w['audio']['src'], w['audio'].get('rights')):
        x = {'src': B.u(w['audio']['src']), 'title': title, 'sub': B.tr(w['audio'].get('caption'), lang) or t['role'][w['role']], 'img': B.u(p) if p else ''}
        score = f'''<section class="sec"><div class="wrap"><span class="k rv">{e(v["lw_k"])}</span><h2 class="h2 split-l" style="margin:14px 0 30px">{e(v["the_score"])}</h2>
 <div class="score-box rv" data-deck><span{track_attrs(x)} hidden></span><b data-now-title>{e(title)}</b><div class="meta" style="margin-top:8px"><span data-now-sub>{e(x["sub"])}</span></div>{pbar(lang, full=False)}<p class="vnote">{e(t["credit_note_audio"])}</p></div></div></section>'''
    aw = [B.AWARD_BY[a] for a in w.get('awards', []) if a in B.AWARD_BY]
    aw_html = f'<section class="sec"><div class="wrap" style="max-width:900px"><span class="k rv">{e(v["awards_k"])}</span><ol class="aw-list rv" style="margin-top:20px">{award_rows(lang, aw)}</ol></div></section>' if aw else ''
    rel = B.related(w)
    same_dir = [x for x in rel if w.get('director') and x.get('director') and x['director']['en'] == w['director']['en']]
    rel_t = v['with_dir'].format(d=B.tr(w['director'], lang)) if same_dir else v['same_era']
    rel_html = ''.join(work_card(x, lang) for x in rel)
    req = lu(lang, 'contact/licensing') + '?work=' + urllib.parse.quote(title)
    services = ''.join(f'<a class="svc" href="{e(soc_url(n))}" target="_blank" rel="noopener"><span class="ic">{ic}</span><span class="n">{e(n)}</span><span class="go">{e(v["play"])} ↗</span></a>' for n, ic in PLAT if soc_url(n) and n != 'IMDb')
    blur = f'<div class="blur" style="background-image:url({e(B.u(p))})"></div>' if p else ''
    body = f'''
<section class="wk-hero">{blur}<div class="wrap in">
 <div class="wk-top">{crumb(lang, [(t["works_title"], lu(lang, "works")), (t["cat"][w["category"]], lu(lang, "works") + "?cat=" + w["category"]), (title, None)])}
  <span style="display:flex;gap:10px;align-items:center"><span>{e(v["of_works"].format(a=dig(lang, "%02d" % (i + 1)), b=dig(lang, len(W))))}</span>
  <a class="arw" href="{lu(lang, "works/" + prv["slug"])}" aria-label="{e(v["prev"])}: {e(B.tr(prv["title"], lang))}">{IC["l"]}</a><a class="arw" href="{lu(lang, "works/" + nxt["slug"])}" aria-label="{e(v["next"])}: {e(B.tr(nxt["title"], lang))}">{IC["r"]}</a></span></div>
 <div class="wk-grid">
  <div class="rv-img">{poster_fr(w, lang, sizes="(max-width: 900px) 280px, 380px", lazy=False)}</div>
  <div><span class="k rv">{e(t["role"][w["role"]])} · {e(t["cat"][w["category"]])} · {dig(lang, w["year"] or "")}</span>
   <h1 class="h1 split-l">{e(title)}</h1>
   {f'<p class="rv dim" lang="ar" dir="rtl" style="margin:10px 0 0;font:400 24px var(--disp)">{e(w["original_title"])}</p>' if w.get("original_title") and lang != "ar" else ""}
   <div class="wk-facts rv">{tf}</div>
   <div class="wk-act rv"><button class="act solid" type="button" data-sheet-open="listen-sheet">{IC["play"]}<span><b>{e(v["listen"])}</b><small>{e(v["listen_sub"])}</small></span></button>
    <a class="act line" href="{e(req)}">{IC["note"]}<span><b>{e(v["request_music"])}</b><small>{e(v["request_sub"])}</small></span></a></div>
  </div>
 </div>
</div></section>
<section class="sec"><div class="wrap story">
 <div><span class="k rv">{e(v["about_work"])}</span><h2 class="h2 split-l" style="margin-top:14px">{e(v["the_story"])}</h2><div class="rv">{story_html}</div></div>
 <dl class="facts rv">{dl}</dl>
</div></section>
{score}{aw_html}
<section class="sec"><div class="wrap"><div class="sec-hd"><div><span class="k rv">{e(v["related_k"])}</span><h2 class="h2 split-l">{e(rel_t)}</h2></div>{arrow_btn("line", lu(lang, "works"), v["all_works"])}</div>
 <div class="pgrid rel4" data-stagger=".06">{rel_html}</div></div></section>
<section class="sec"><div class="wrap req" style="margin-top:0"><div><span class="k rv">{e(v["next_k"])}</span><h2 class="h2 split-l" style="margin-top:14px">{e(v["next_q"])}</h2><p class="lede rv" style="margin-top:12px">{e(v["next_lede"])}</p></div>
 <div class="btns rv">{arrow_btn("solid", lu(lang, "contact/scoring"), v["commission"])}{arrow_btn("line", req, v["licensing"])}</div></div></section>
<div style="height:60px"></div>
{strip(dig(lang, "%02d" % (i + 1)) + " / " + dig(lang, len(W)) + " · " + e(title), '<a href="' + lu(lang, "works/" + nxt["slug"]) + '">' + e(v["next_work"].format(t=B.tr(nxt["title"], lang))) + ' →</a>')}
<div class="sheet" id="listen-sheet" hidden role="dialog" aria-modal="true" aria-label="{e(v["choose_service"])}"><div class="pnl">
 <div class="hd2"><span class="k">{e(v["choose_service"])}</span><button class="cb x" type="button" data-sheet-close aria-label="{e(v["close"])}">{IC["x"]}</button></div>
 <p style="margin:0 0 10px;font:400 26px var(--disp)">{e(title)}</p>{services}
 <p class="vnote">{e(v["artist_page"])} · {e(t["site_name"])}</p></div></div>'''
    typ = {'film': 'Movie', 'tv': 'TVSeries', 'theatre': 'CreativeWork', 'children': 'TVSeries', 'songs': 'CreativeWork'}[w['category']]
    ld = {'@context': 'https://schema.org', '@type': typ, 'name': title, 'alternateName': w.get('original_title'), 'url': B.SITE_URL + lu(lang, 'works/' + w['slug']), 'inLanguage': lang,
          'musicBy': {'@type': 'Person', '@id': B.SITE_URL + '/#person', 'name': t['site_name']}}
    if w['year']:
        ld['datePublished' if typ != 'TVSeries' else 'startDate'] = str(w['year'])
    if w.get('director'):
        ld['director'] = {'@type': 'Person', 'name': B.tr(w['director'], lang)}
    if p:
        ld['image'] = B.SITE_URL + B.u(p)
    desc = f'{title} ({w["year"] or ""}) — {t["role"][w["role"]]}: {t["site_name"]}. {B.credit_line(w, lang)}'
    write(lang, 'works/' + w['slug'], page(lang, 'works/' + w['slug'], title, body, desc=desc[:160], og_image=p,
                                          jsonld=[ld, B.crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['works_title'], lu(lang, 'works')), (title, lu(lang, 'works/' + w['slug']))])],
                                          review=w['translation_status'].get(lang, '').startswith('draft'), alt_langs=[l for l in B.LANGS if B.avail(w, l)]))


# ---------------------------------------------------------------- listen & watch
def plat_grid(lang):
    v = V(lang)
    subs = {'YouTube': '@KhaledHammad', 'SoundCloud': 'khaled_hammad', 'IMDb': v['filmography']}
    return '<div class="plat" data-stagger=".05">' + ''.join(
        f'<a href="{e(soc_url(n))}" target="_blank" rel="noopener"><span class="ic">{ic}</span><span><b>{e(n)}</b><small>{e(subs.get(n, v["artist_page"]))}</small></span>{IC["ext"]}</a>' for n, ic in PLAT if soc_url(n)) + '</div>'


def build_listen(lang):
    t, v = B.I18N[lang], V(lang)
    V_LANG[0] = v
    tr_ = tracks(lang)
    cards = ''
    for x in tr_:
        img_ = fr(x['thumb'], '', '', '(max-width: 560px) 50vw, 200px') if x['thumb'] else '<div class="fr"><div class="ph-empty"></div></div>'
        img_ = img_.replace('</div>', f'<span class="pl" data-play>{IC["play"]}</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></div>', 1) if '<span class="shine">' in img_ else img_
        sub = x['sub']
        cards += (f'<div class="scard"{track_attrs(x)} data-item data-k="{e(x["title"].lower())}"><button type="button" class="hov" style="display:block;width:100%" aria-label="{e(t["play"])}: {e(x["title"])}">{img_}</button>'
                  f'<h3>{e(x["title"])}</h3><small>{e(sub)}</small>{f"<a class=" + chr(34) + "lk" + chr(34) + " style=" + chr(34) + "margin-top:10px;font-size:10px" + chr(34) + " href=" + chr(34) + lu(lang, "works/" + x["w"]["slug"]) + chr(34) + ">" + e(v["view_details"]) + "</a>" if x["w"] else ""}</div>')
    first = tr_[0] if tr_ else None
    vids = videos(lang)
    vf = vids[0] if vids else None
    rest = vids[1:]
    vcounts = {c: sum(1 for x in rest if x['cat'] == c) for c in ('concerts', 'interviews', 'tv')}
    vchips = f'<button class="chip" type="button" data-f-cat="all" aria-pressed="true">{e(v["all"])}<small>{dig(lang, len(rest))}</small></button>' + ''.join(
        f'<button class="chip" type="button" data-f-cat="{c}" aria-pressed="false">{e(v["vcat"][c])}<small>{dig(lang, n)}</small></button>' for c, n in vcounts.items() if n)
    feat = ''
    if vf:
        feat = (f'<div class="vfeat"><div class="vcard" data-yt="{e(vf["yt"])}" data-title="{e(vf["title"])}"><button type="button" class="fr hov" data-yt-play style="display:block;width:100%" aria-label="{e(t["play"])}: {e(vf["title"])}">'
                f'{im(vf["img"], "", sizes="(max-width: 900px) 100vw, 62vw")}<span class="pl">{IC["play"]}</span><span class="shine"></span></button></div>'
                f'<div class="rv"><div class="meta"><span class="pub">{e(v["latest"])}</span><span>·</span><span>{e(vf["type"])}</span><span>·</span><span>{dig(lang, vf["date"][:4])}</span></div><h3 class="h3" style="margin-top:12px">{e(vf["title"])}</h3><p class="dim" style="font-size:13px">{e(vf["pub"])}</p></div></div>')
    vgrid = ''.join(vcard(x, lang) for x in rest)
    body = f'''
<div class="wrap page-hd">{crumb(lang, [(t["listen_title"], None)])}
 <div class="row"><div><h1 class="h1 split-l">{e(t["listen_title"])}</h1><p class="lede rv">{e(v["lw_lede"])}</p></div>
  <div class="tabs rv" role="group"><button class="chip" type="button" data-tab="all" aria-pressed="true">{e(v["tab_all"])}</button><button class="chip" type="button" data-tab="listen" aria-pressed="false">{e(v["tab_listen"])}</button><button class="chip" type="button" data-tab="watch" aria-pressed="false">{e(v["tab_watch"])}</button></div></div>
</div>
<div data-tabbed="all">
<section class="sec" data-tab-show="listen"><div class="wrap" data-deck data-continue>
 <div class="sec-hd"><div><span class="k rv">01 · {e(v["listen_k"])}</span><h2 class="h2 split-l">{e(v["sel_scores"])}</h2></div>{arrow_btn("line", lu(lang, "works"), v["all_works"])}</div>
 <div class="scores" data-stagger=".06">{cards}</div>
 <div class="dock sticky rv"><div class="th"><img data-now-img src="{e(first["img"]) if first and first["img"] else ""}" alt=""></div>
  <div><div style="display:flex;justify-content:space-between;gap:12px"><b data-now-title>{e(first["title"]) if first else ""}</b><span class="k" data-now-n>{e(v["track_n"])} {dig(lang, "01")} / {dig(lang, "%02d" % len(tr_))}</span></div>
   <div class="meta" style="margin-top:4px"><span data-now-sub>{e(first["sub"]) if first else ""}</span></div>{pbar(lang)}</div></div>
 <p class="vnote">{e(t["credit_note_audio"])}</p>
</div></section>
<section class="sec" data-tab-show="watch"><div class="wrap" data-list data-page="9">
 <div class="sec-hd"><div><span class="k rv">02 · {e(v["watch_k"])}</span><h2 class="h2 split-l">{e(v["videos"])}</h2></div></div>
 {feat}
 <div class="fbar" style="position:static;margin:0 0 30px"><label class="srch">{IC["search"]}<span class="sr">{e(v["search_videos"])}</span><input type="search" data-f-q placeholder="{e(v["search_videos"])}"></label><div class="tabs">{vchips}</div>
  <span class="end dim" style="font-size:13px" data-count-out data-tpl="{e(v["showing"].replace("{a}", "{a}"))}"></span></div>
 <div class="vgrid">{vgrid}</div>
 <p class="empty-note" data-empty hidden>{e(v["no_results"])}</p>
 <div class="more-row"><button class="btn line" type="button" data-more>{e(v["load_more_v"])}{IC["down"]}</button></div>
 <p class="vnote">{e(v["video_note"])}</p>
</div></section>
<section class="sec" data-tab-show="listen"><div class="wrap"><span class="k rv">03 · {e(v["plat_k"])}</span><h2 class="h2 split-l" style="margin:14px 0 34px">{e(v["everywhere"])}</h2>{plat_grid(lang)}
 <div class="req"><div><span class="k rv">{e(v["lic_k"])}</span><h2 class="h2 split-l" style="margin-top:14px">{e(v["request_music"])}</h2><p class="lede rv" style="margin-top:12px">{e(v["req_lede"])}</p></div>
  <div class="btns rv"><a class="btn solid" href="{lu(lang, "contact/licensing")}">{IC["note"]}{e(v["request_music"])}</a>{arrow_btn("line", lu(lang, "contact"), v["contact"])}</div></div></div></section>
</div>'''
    write(lang, 'listen-watch', page(lang, 'listen-watch', t['listen_title'], body, desc=v['lw_lede'], review=B.draft_lang(lang),
                                     jsonld=[B.crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['listen_title'], lu(lang, 'listen-watch'))])]))


# ---------------------------------------------------------------- live concerts
def split_partners(s):
    for sep in (', conducted by ', ' بقيادة ', ', дирижёр — ', ', дирижёр '):
        if sep in s:
            a, b = s.split(sep, 1)
            return a, b
    return s, ''


def build_concerts(lang):
    t, v = B.I18N[lang], V(lang)
    V_LANG[0] = v
    up = [c for c in B.CONCERTS if c['status'] != 'past' and c['date'] >= B.TODAY]
    past = [c for c in B.CONCERTS if c not in up]
    if up:
        up_html = ''.join(f'<div class="empty rv" style="margin-bottom:14px"><span class="k">{e(t["status"][c["status"]])} · {e(fmt_d(c["date"], lang))}</span><b style="margin-top:8px">{e(B.tr(c["name"], lang))}</b><p>{e(B.tr(c["venue"], lang))} · {e(B.tr(c["city"], lang))}</p>'
                          f'{arrow_btn("solid", c["ticket_url"], t["tickets"], ext=True) if c.get("ticket_url") else ""}</div>' for c in up)
    else:
        up_html = f'<div class="empty rv"><b>{e(v["no_dates"])}</b><p>{e(v["no_dates_sub"])}</p></div>'
    fd = feed(lang)
    past_html, watch_html, cov_html = '', '', ''
    for c in reversed(past):
        orch, cond = split_partners(B.tr(c['partners'], lang))
        facts = [(v['date'], fmt_d(c['date'], lang)), (v['venue'], B.tr(c['venue'], lang)), (v['orchestra'], orch)] + ([(v['conductor'], cond)] if cond else [])
        dl = ''.join(f'<div><dt>{e(a)}</dt><dd>{e(b)}</dd></div>' for a, b in facts)
        past_html += f'''<section class="sec"><div class="wrap past">
 <div><span class="k rv">02 · {e(v["past_k"])}</span><h2 class="h2 split-l" style="margin-top:14px">{e(B.tr(c["venue"], lang).split(" — ")[0])}</h2>
  <p class="serif-l rv" style="margin:18px 0 26px;font-size:clamp(19px,1.6vw,23px)">{e(B.tr(c["summary"], lang))}</p><dl class="facts rv">{dl}</dl></div>
 <div class="col">
  <div class="a rv-img">{fr('/assets/img/d/ab-bow.webp', '', '', '(max-width: 900px) 100vw, 30vw', 'center 45%')}<p class="lbl-cap">{e(V(lang)["gcat"]["live"])}</p></div>
  <div class="rv-img" style="--d:.1s">{fr('/assets/img/d/lv-p1.webp', '', '', '(max-width: 900px) 50vw, 20vw')}</div>
  <div class="rv-img" style="--d:.2s">{fr('/assets/img/d/lv-aud.webp', '', '', '(max-width: 900px) 50vw, 20vw')}</div>
 </div></div></section>'''
        vids = c.get('video', [])
        if vids:
            vx = {'yt': vids[0]['youtube'], 'title': B.tr(vids[0]['title'], lang), 'pub': B.tr(c['venue'], lang).split(' — ')[0], 'date': c['date'], 'cat': 'concerts', 'type': v['vcat']['concerts'], 'img': '/assets/img/d/lp-n-vid.webp'}
            watch_html = f'''<section class="sec" id="watch"><div class="wrap"><div class="sec-hd"><div><span class="k rv">03 · {e(v["watch_k2"])}</span><h2 class="h2 split-l">{e(v["live_k"])}</h2></div>{arrow_btn("line", lu(lang, "listen-watch") + "?tab=watch", v["more_lw"])}</div>
 <div class="vfeat" style="grid-template-columns:1fr">{vcard(vx, lang, sizes="100vw", item=False)}</div><p class="vnote">{e(v["video_note"])}</p></div></section>'''
        cov = [x for x in fd if x.get('rel_concert') == c['slug'] or (x['date'][:7] == c['date'][:7] and x['kind'] == 'press')]
        if cov:
            cards = ''.join(f'<a href="{e(x["href"] or "#")}" target="_blank" rel="noopener" class="hov rv">{fr(x["img"] or "/assets/img/d/lv-stage.webp", "", "", "180px", x["pos"])}<div>{meta_line(x, lang)}<h3>{e(x["title"])}</h3><span class="lk">{e(x["cta"])}{IC["ext"]}</span></div></a>' for x in cov[:4])
            cov_html = f'<section class="sec"><div class="wrap"><span class="k rv">04 · {e(v["coverage_k"])}</span><h2 class="h2 split-l" style="margin:14px 0 34px">{e(v["coverage"])}</h2><div class="pr2">{cards}</div></div></section>'
    body = f'''
<section class="lc-hero"><div class="bg">{im('/assets/img/d/lp-n-hero.webp', '', sizes='100vw', lazy=False, priority=True)}</div><div class="wrap in">
 {crumb(lang, [(t["concerts_title"], None)])}
 <h1 class="h1 split-l">{e(v["from_screen"])}</h1><p class="lede rv">{e(v["lc_lede"])}</p>
 <div class="btns rv">{arrow_btn("solid", lu(lang, "contact/concerts"), v["book_concert"])}<a class="btn line" href="#watch">{IC["play"].replace('class="i-play"', 'class="i-play" style="width:12px;height:12px"')}{e(v["watch_concert"])}</a></div>
</div></section>
<section class="sec"><div class="wrap nd"><div><span class="k rv">01 · {e(v["up_k"])}</span><h2 class="h2 split-l" style="margin-top:14px">{e(v["next_dates"])}</h2></div>
 <div>{up_html}<div class="two2 rv"><div><span class="k">{e(v["promoters"])}</span><p>{e(v["promoters_t"])}</p></div><div><span class="k">{e(v["format"])}</span><p>{e(v["format_t"])}</p></div></div></div></div></section>
{past_html}{watch_html}{cov_html}
<section class="sec"><div class="wrap"><div class="book rv"><div><span class="k">{e(v["book_k"])}</span><h2 class="h2" style="margin-top:14px">{e(v["book_concert"])}</h2>
 <ol><li><b>01</b>{e(v["symphony"])}</li><li><b>02</b>{e(v["films_screen"])}</li><li><b>03</b>{e(v["tailored"])}</li></ol></div>{arrow_btn("solid", lu(lang, "contact/concerts"), v["request_booking"])}</div></div></section>'''
    write(lang, 'concerts', page(lang, 'concerts', t['concerts_title'], body, desc=v['lc_lede'], review=B.draft_lang(lang), og_image='/assets/img/d/lp-n-hero.webp',
                                 jsonld=[B.crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['concerts_title'], lu(lang, 'concerts'))])] + [B.event_ld(c, lang) for c in B.CONCERTS]))
    for c in B.CONCERTS:  # the old per-concert URL now forwards to the concerts page
        B.write(B.out(lang, 'concerts/' + c['slug']), B.redirect_page(lu(lang, 'concerts')))


# ---------------------------------------------------------------- news & press
ARCHIVE = [('Youm7', 'https://www.youm7.com/Tags/Index?id=130336&tag=%D8%AE%D8%A7%D9%84%D8%AF-%D8%AD%D9%85%D8%A7%D8%AF'),
           ('Al-Jarida', 'https://www.google.com/search?q=site%3Aaljarida.com+%22%D8%AE%D8%A7%D9%84%D8%AF+%D8%AD%D9%85%D8%A7%D8%AF%22'),
           ('Al-Ahram Gate', 'https://www.google.com/search?q=site%3Agate.ahram.org.eg+%22%D8%AE%D8%A7%D9%84%D8%AF+%D8%AD%D9%85%D8%A7%D8%AF%22'),
           ('YouTube', 'https://www.youtube.com/results?search_query=Khaled+Hammad+composer+interview')]


def nitem(x, lang, item=True):
    data = f' data-item data-cat="{x["cat"]}" data-y="{x["date"][:4]}" data-k="{e((x["title"] + " " + x["sum"] + " " + x["pub"]).lower())}"' if item else ''
    pp = f'<span class="pp">{IC["play"]}</span>' if x.get('media') in ('audio', 'video') else ''
    img_ = fr(x['img'] or '/assets/img/d/pr-studio.webp', '', 'sm', '(max-width: 760px) 110px, 200px', x['pos']).replace('<span class="shine">', pp + '<span class="shine">', 1)
    href = x['href']
    tgt = ' target="_blank" rel="noopener"' if x['ext'] else ''
    pic = f'<a href="{e(href)}"{tgt} class="hov" tabindex="-1" aria-hidden="true">{img_}</a>' if href else img_
    h = f'<a href="{e(href)}"{tgt}>{e(x["title"])}</a>' if href else e(x['title'])
    return f'<article class="nit"{data}>{pic}<div>{meta_line(x, lang)}<h3>{h}</h3><p>{e(x["sum"])}</p>{cta_link(x)}</div></article>'


def build_press(lang):
    t, v = B.I18N[lang], V(lang)
    V_LANG[0] = v
    fd = feed(lang)
    feat = next((x for x in fd if x['kind'] == 'news' and x['img']), fd[0] if fd else None)
    rest = [x for x in fd if x is not feat]
    cats = ['news', 'interviews', 'podcasts', 'research']
    chips = f'<button class="chip" type="button" data-f-cat="all" aria-pressed="true">{e(v["all"])}<small>{dig(lang, len(rest))}</small></button>' + ''.join(
        f'<button class="chip" type="button" data-f-cat="{c}" aria-pressed="false">{e(v["ncat"][c])}<small></small></button>' for c in cats if any(x['cat'] == c for x in rest))
    have = {x['date'][:4] for x in rest if x['date']}
    yopts = f'<button type="button" data-f-y="" style="grid-column:1/-1">{e(v["all_years"])}</button>' + ''.join(
        f'<button type="button" data-f-y="{y}" class="{"" if str(y) in have else "no"}">{dig(lang, y)}</button>' for y in range(datetime.date.today().year, 1992, -1))
    featc = ''
    if feat:
        tgt = ' target="_blank" rel="noopener"' if feat['ext'] else ''
        featc = (f'<div class="nfeat"><a href="{e(feat["href"])}"{tgt} class="hov rv-img">{fr(feat["img"], "", "", "(max-width: 760px) 100vw, 55vw", feat["pos"], lazy=False)}</a>'
                 f'<div class="rv">{meta_line(feat, lang)}<h2 class="h3">{e(feat["title"])}</h2><p>{e(feat["sum"])}</p>{cta_link(feat)}</div></div>')
    items = ''.join(nitem(x, lang) for x in rest)
    kit_doc = f'{lang}/press-kit/khaled-hammad-press-kit-{lang}.docx'
    body = f'''
<div class="wrap page-hd">{crumb(lang, [(t["press_title"], None)])}<h1 class="h1 split-l">{e(t["press_title"])}</h1><p class="lede rv">{e(v["np_lede"])}</p></div>
<div class="wrap" data-list data-page="8">
 <div class="fbar"><label class="srch">{IC["search"]}<span class="sr">{e(v["search_archive"])}</span><input type="search" data-f-q placeholder="{e(v["search_archive"])}"></label>
  <div class="tabs">{chips}</div>
  <div class="dd" data-dd><button type="button" aria-expanded="false">{e(v["year"])}: <b data-y-label data-all="{e(v["all"])}">{e(v["all"])}</b>{IC["chev"]}</button><div class="menu"><div class="h">{e(v["choose_year"])}</div><div class="ygrid">{yopts}</div><p class="vnote">{dig(lang, 1993)} – {dig(lang, datetime.date.today().year)} · {e(v["years_faded"])}</p></div></div>
  <span class="end dim" style="font-size:13px" data-count-out data-tpl="{e(v["results"])}"></span></div>
 {featc}
 <div class="nlist"><div class="lh"><span data-count-out data-tpl="{e(v["showing_r"])}"></span><span>{e(v["newest"])}</span></div>{items}
  <p class="empty-note" data-empty hidden>{e(v["no_results"])}</p>
  <div class="more-row"><button class="btn line" type="button" data-more>{e(v["load_more_s"])}{IC["down"]}</button></div></div>
 <div class="arch rv"><span class="k">{e(v["search_archive"])}</span><div class="btns">{"".join(f'<a class="chip" style="box-shadow:inset 0 0 0 1px var(--rule)" href="{e(h)}" target="_blank" rel="noopener">{e(n)} ↗</a>' for n, h in ARCHIVE)}</div></div>
</div>
<section class="sec"><div class="wrap kit"><div><span class="k rv">{e(v["press_kit"])}</span><h2 class="h2 split-l" style="margin-top:14px">{e(v["for_journalists"])}</h2><p class="lede rv" style="margin-top:14px">{e(v["kit_lede"])}</p>
 <div class="dl-l rv" style="margin-top:30px"><a href="{B.u(kit_doc)}" download><span><b>{e(v["kit_bio"])}</b><small>{e(v["kit_bio_s"])} · DOCX</small></span><span class="go">{e(v["download"])}</span></a>
  <a href="{B.u("press-kit/khaled-hammad-portraits.zip")}" download><span><b>{e(v["kit_photos"])}</b><small>{e(v["kit_photos_s"])} · ZIP</small></span><span class="go">{e(v["download"])}</span></a>
  <a href="{lu(lang, "news-press/press-kit")}"><span><b>{e(v["kit_page"])}</b><small>{e(v["kit_page_s"])}</small></span><span class="go">{e(v["open"])}</span></a></div></div>
 <div class="rv-img">{fr('/assets/img/d/pr-kit.webp', t['site_name'], '', '(max-width: 760px) 100vw, 40vw')}</div></div></section>
<div class="wrap"><div class="media-bar rv"><div><h2 class="h2" style="font-size:clamp(34px,3.6vw,52px)">{e(v["media_inq"])}</h2><p class="lede" style="margin-top:8px">{e(v["media_inq_s"])}</p></div>{arrow_btn("solid", lu(lang, "contact/press"), v["press_office"])}</div></div>'''
    write(lang, 'news-press', page(lang, 'news-press', t['press_title'], body, desc=v['np_lede'], review=B.draft_lang(lang),
                                   jsonld=[B.crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['press_title'], lu(lang, 'news-press'))])]))
    for n in B.NEWS:
        build_news(lang, n, fd)
    build_press_kit(lang)


def build_news(lang, n, fd):
    t, v = B.I18N[lang], V(lang)
    V_LANG[0] = v
    title = B.tr(n['title'], lang)
    src = n.get('sources') or []
    pub = B.tr(src[0]['label'], lang).split(' — ')[0] if src else t['site_name']
    paras = ''.join(f'<p>{e(x)}</p>' for x in (n['body'].get(lang) or n['body']['en']))
    url = B.SITE_URL + lu(lang, 'news-press/' + n['slug'])
    q = urllib.parse.quote
    share = (f'<button type="button" data-copy-link>{IC["link"]}<span>{e(v["copy_link"])}</span></button>'
             f'<a href="https://www.facebook.com/sharer/sharer.php?u={q(url)}" target="_blank" rel="noopener">{SOC["Facebook"]}Facebook</a>'
             f'<a href="https://twitter.com/intent/tweet?url={q(url)}&amp;text={q(title)}" target="_blank" rel="noopener">{IC["x"]}X</a>'
             f'<a href="https://wa.me/?text={q(title + " " + url)}" target="_blank" rel="noopener">{IC["share"]}WhatsApp</a>')
    srcbox = ''.join(f'<div class="srcbox"><div><span class="k">{e(v["orig_source"])}</span><b>{e(v["read_full"])}</b><small>{e(B.tr(s["label"], lang))}</small></div><a class="btn solid" href="{e(s["url"])}" target="_blank" rel="noopener">{e(v["open"])}{IC["ext"]}</a></div>' for s in src[:1])
    rel = [B.WBY[w] for w in n.get('related_works', []) if w in B.WBY]
    others = [x for x in B.NEWS if x['slug'] != n['slug']]
    relk = ''.join(f'<a href="{lu(lang, "works/" + w["slug"])}"><small>{e(t["cat"][w["category"]])} · {dig(lang, w["year"] or "")}</small><b>{e(B.tr(w["title"], lang))}</b></a>' for w in rel)
    relk += ''.join(f'<a href="{lu(lang, "news-press/" + x["slug"])}"><small>{e(t["news"])} · {e(fmt_d(x["date"], lang))}</small><b>{e(B.tr(x["title"], lang))}</b></a>' for x in others[:2])
    relk += f'<a href="{lu(lang, "about")}#awards"><small>{e(t["about_title"])}</small><b>{e(v["awards"])}</b></a>'
    older = [x for x in B.NEWS if x['date'] < n['date']]
    prev = older[0] if older else (others[0] if others else None)
    more = [x for x in fd if x.get('slug') != n['slug'] and x['img']][:3]
    g3 = ''.join(f'<article class="rv"><a href="{e(x["href"] or "#")}"{" target=" + chr(34) + "_blank" + chr(34) + " rel=" + chr(34) + "noopener" + chr(34) if x["ext"] else ""} class="hov">{fr(x["img"], "", "", "(max-width: 760px) 100vw, 33vw", x["pos"])}</a>{meta_line(x, lang)}<h3>{e(x["title"])}</h3><p>{e(x["sum"])}</p>{cta_link(x)}</article>' for x in more)
    body = f'''
<article>
<section class="wrap ar-hero"><div>{crumb(lang, [(t["press_title"], lu(lang, "news-press")), (t["news"], None)])}
  <div class="meta"><span class="pub">{e(pub)}</span><span>·</span><time datetime="{e(n["date"])}">{e(fmt_d(n["date"], lang))}</time><span class="ty">{e(t["news"])}</span></div>
  <h1 class="h1 split-l">{e(title)}</h1><p class="sf rv">{e(B.tr(n["summary"], lang))}</p>
  <div class="by rv"><div><span class="lbl">{e(v["publication"])}</span><b>{e(pub)}</b></div><div><span class="lbl">{e(v["published"])}</span><b>{e(fmt_d(n["date"], lang))}</b></div></div></div>
 <div class="rv-img">{fr(n["image"], B.tr(n.get("image_alt"), lang), "", "(max-width: 760px) 100vw, 50vw", lazy=False, priority=True)}<p class="cap-s">{e(B.tr(n.get("image_alt"), lang))}</p></div>
</section>
<div class="wrap ar-body">
 <aside class="rv"><span class="k">{e(v["share_k"])}</span><div class="sharel">{share}</div></aside>
 <div class="tx rv">{paras}{srcbox}</div>
 <aside class="relk rv"><span class="k">{e(v["mentioned"])}</span><div style="margin-top:12px">{relk}</div></aside>
</div>
</article>
<div class="wrap"><nav class="pn">{f'<a href="{lu(lang, "news-press/" + prev["slug"])}"><small>← {e(v["prev_story"])}</small><b>{e(B.tr(prev["title"], lang))}</b></a>' if prev else '<span></span>'}<a href="{lu(lang, "news-press")}"><small>{e(v["back_to"])}</small><b>{e(v["all_np"])}</b></a></nav></div>
<section class="sec"><div class="wrap"><div class="sec-hd"><div><span class="k rv">{e(v["keep_reading"])}</span><h2 class="h2 split-l">{e(v["more_stories"])}</h2></div><a class="lk" href="{lu(lang, "news-press")}">{e(v["view_all_news"])}{IC["arr"]}</a></div><div class="g3">{g3}</div></div></section>
<div class="wrap"><div class="media-bar rv"><div><h2 class="h2" style="font-size:clamp(34px,3.6vw,52px)">{e(v["media_inq"])}</h2><p class="lede" style="margin-top:8px">{e(v["media_inq_s"])}</p></div>{arrow_btn("solid", lu(lang, "contact/press"), v["press_office"])}</div></div>'''
    ld = {'@context': 'https://schema.org', '@type': 'NewsArticle', 'headline': title, 'datePublished': n['date'], 'inLanguage': lang, 'image': [B.SITE_URL + B.u(n['image'])],
          'about': {'@type': 'Person', '@id': B.SITE_URL + '/#person', 'name': t['site_name']}, 'isBasedOn': [s['url'] for s in src], 'mainEntityOfPage': url}
    write(lang, 'news-press/' + n['slug'], page(lang, 'news-press/' + n['slug'], title, body, desc=B.tr(n['summary'], lang)[:160], og_image=n['image'],
                                                jsonld=[ld, B.crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['press_title'], lu(lang, 'news-press')), (title, url)])],
                                                review=n['translation_status'].get(lang, '').startswith('draft'), alt_langs=[l for l in B.LANGS if B.avail(n, l)]))


def build_press_kit(lang):
    t, v = B.I18N[lang], V(lang)
    doc_rel = f'{lang}/press-kit/khaled-hammad-press-kit-{lang}.docx'
    B.make_kit_docx(lang, os.path.join(B.OUT, doc_rel))
    portraits = [a for a in B.MEDIA['assets'] if a.get('press_kit') and B.media_ok(a['file'], a['licence'])]
    zp = os.path.join(B.OUT, 'press-kit/khaled-hammad-portraits.zip')
    if portraits and not os.path.exists(zp):
        import zipfile
        os.makedirs(os.path.dirname(zp), exist_ok=True)
        with zipfile.ZipFile(zp, 'w', zipfile.ZIP_STORED) as z:
            for a in portraits:
                z.write(os.path.join(B.ROOT, a['file'].lstrip('/')), os.path.basename(a['file']))
    credits = ''.join(f'<li><span class="y">{dig(lang, w["year"])}</span><span><b>{e(B.tr(w["title"], lang))}</b><small>{e(t["cat"][w["category"]])}</small></span></li>' for w in B.kit_credits())
    pics = ''.join(f'<figure style="margin:0">{fr(a["file"], B.tr(a["alt"], lang), "sm", "(max-width: 600px) 50vw, 25vw")}<figcaption class="cap-s"><a class="lk" href="{e(B.u(a["file"]))}" download>{e(v["download"])}</a></figcaption></figure>' for a in portraits)
    long_bio = ''.join(f'<p>{e(B.tr(p, lang))}</p>' for p in B.ABOUT['paragraphs'])
    body = f'''
<div class="wrap page-hd">{crumb(lang, [(t["press_title"], lu(lang, "news-press")), (t["press_kit"], None)])}<h1 class="h1 split-l">{e(t["press_kit"])}</h1><p class="lede rv">{e(t["press_kit_intro"])}</p></div>
<section class="sec"><div class="wrap story">
 <div class="prose">
  <div class="dl-l rv"><a href="{B.u(doc_rel)}" download><span><b>{e(t["kit_doc"])}</b><small>DOCX</small></span><span class="go">{e(v["download"])}</span></a>{f'<a href="{B.u("press-kit/khaled-hammad-portraits.zip")}" download><span><b>{e(t["kit_zip"])}</b><small>ZIP</small></span><span class="go">{e(v["download"])}</span></a>' if portraits else ''}</div>
  <div class="rv"><div style="display:flex;justify-content:space-between;align-items:center;margin-top:40px"><h2 style="margin:0">{e(t["short_bio"])}</h2><button type="button" class="chip" style="box-shadow:inset 0 0 0 1px var(--rule)" data-copy-link>{IC["link"]}<span>{e(t["copy_text"])}</span></button></div><p id="bio-short">{e(B.tr(B.ABOUT["short_bio"], lang))}</p></div>
  <div class="rv"><h2>{e(t["long_bio"])}</h2>{long_bio}</div>
 </div>
 <aside class="rv"><span class="k">{e(t["selected_credits"])}</span><ul class="rows">{credits}</ul>
  <div style="margin-top:30px"><span class="k">{e(t["press_contact"])}</span><p><a class="lk" href="mailto:{e(B.SET["contacts"]["press"])}">{e(B.SET["contacts"]["press"])}</a></p></div>
  <div style="margin-top:24px"><span class="k">{e(t["usage"])}</span><p class="dim" style="font-size:13px">{e(t["usage_text"])}</p></div></aside>
</div></section>
{f'<section class="sec"><div class="wrap"><span class="k rv">{e(t["portraits"])}</span><div class="pgrid" style="margin-top:24px" data-stagger=".05">{pics}</div></div></section>' if pics else ''}'''
    write(lang, 'news-press/press-kit', page(lang, 'news-press/press-kit', t['press_kit'], body, desc=t['press_kit_intro'], review=B.draft_lang(lang)))


# ---------------------------------------------------------------- contact
FORM_IMG = {'scoring': ('/assets/img/d/ct-c-studio.webp', 'center 40%'), 'concerts': ('/assets/img/d/ct-c-concert.webp', 'center 50%'), 'press': ('/assets/img/d/ct-c-piano.webp', 'center 40%'),
            'licensing': ('/assets/img/d/lw-ctrl.webp', 'center 40%'), 'general': ('/assets/img/d/ct-stool.webp', 'center 25%')}


def fld(fid, label, kind='input', req=False, hint='', opts=None, attrs='', t=None, wide=False):
    r = f'<span class="rq" aria-hidden="true">*</span><span class="sr"> ({e(t["f"]["required"])})</span>' if req else ''
    rq = ' required' if req else ''
    da = f' aria-describedby="e-{fid}"' if req else ''
    if kind == 'textarea':
        ctl = f'<textarea id="f-{fid}" name="{fid}" rows="6"{rq}{da}{attrs}></textarea>'
    elif kind == 'select':
        ctl = f'<select id="f-{fid}" name="{fid}"{attrs}>' + ''.join(f'<option>{e(o)}</option>' for o in opts) + '</select>'
    elif kind == 'pills':
        ctl = '<div class="pills" role="radiogroup" aria-labelledby="l-' + fid + '">' + ''.join(f'<label><input type="radio" name="{fid}" value="{e(o)}"{" checked" if i == 0 else ""}><span>{e(o)}</span></label>' for i, o in enumerate(opts)) + '</div>'
        return f'<div class="fld w"><span class="lbl" id="l-{fid}">{e(label)}</span>{ctl}</div>'
    else:
        ctl = f'<input id="f-{fid}" name="{fid}"{rq}{da}{attrs}>'
    h = f'<p class="hint">{e(hint)}</p>' if hint else ''
    er = f'<p class="ferr" id="e-{fid}" data-err="{fid}"></p>' if req else ''
    return f'<div class="fld{" w" if wide else ""}"><label for="f-{fid}">{e(label)}{r}</label>{ctl}{h}{er}</div>'


def build_contact(lang):
    t, v = B.I18N[lang], V(lang)
    V_LANG[0] = v
    f, ff = t['f'], t['ff']
    mail = B.SET['contacts']['general']
    phones = ''.join(f'<div><span class="lbl">{e(B.tr(p["label"], lang))}</span><p><a href="tel:{e(p["number"].replace(" ", ""))}" dir="ltr">{e(p["number"])}</a></p></div>' for p in B.SET.get('phones', []))
    hub = f'''
<section class="ct-hub"><div class="bg">{im('/assets/img/d/ct-aud.webp', '', sizes='100vw', lazy=False)}</div><div class="wrap in">
 {crumb(lang, [(t["contact_title"], None)])}
 <span class="k rv" style="display:block;margin-top:40px">{e(v["work_together"])}</span>
 <h1 class="h1 split-l" style="margin-top:16px;font-size:clamp(44px,6.4vw,96px)">{e(v["create"])} <em class="br">{e(v["timeless"])}</em></h1>
 <div class="btns rv" style="justify-content:center;margin-top:38px">{arrow_btn("solid", lu(lang, "contact/scoring"), v["commission"])}{arrow_btn("line", lu(lang, "contact/concerts"), v["book_concert"])}{arrow_btn("line", lu(lang, "contact/press"), v["press_partner"])}</div>
 <p class="rv" style="margin-top:18px;font-size:14px"><a class="lk" href="{lu(lang, "contact/licensing")}">{e(v["request_music"])}{IC["arr"]}</a> &nbsp; <a class="lk" href="{lu(lang, "contact/general")}">{e(v["form_t"]["general"])}{IC["arr"]}</a></p>
 <p class="rv mut" style="margin-top:30px">{e(v["write_directly"])} <a href="mailto:{e(mail)}" style="color:var(--ivory);border-bottom:1px solid var(--rule)">{e(mail)}</a></p>
 <p class="rv mut">{e(v["call"])} {" <span class=br>·</span> ".join(f'<a href="tel:{e(p["number"].replace(" ", ""))}" dir="ltr" style="color:var(--ivory)">{e(p["number"])}</a> <span class="br">{e(B.tr(p["label"], lang))}</span>' for p in B.SET.get("phones", []))}</p>
 <div class="rv" style="display:flex;justify-content:center;margin-top:24px">{soc_icons()}</div>
</div></section>'''
    write(lang, 'contact', page(lang, 'contact', t['contact_title'], hub, desc=t['contact_index_intro'], jsonld=[B.crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['contact_title'], lu(lang, 'contact'))])]))
    budget = fld('budget', f['budget'], 'select', opts=f['budget_opts'], t=t)
    dates = fld('dates', f['dates'], hint=f['dates_hint'], t=t)
    who = (f'<fieldset><legend><small>{{n}}</small>{e(v["sec_details"])}</legend><div class="fgrid">{fld("name", f["name"], req=True, attrs=" autocomplete=" + chr(34) + "name" + chr(34), t=t)}'
           f'{fld("organisation", f["org"], attrs=" autocomplete=" + chr(34) + "organization" + chr(34), t=t)}{fld("email", f["email"], req=True, attrs=" type=" + chr(34) + "email" + chr(34) + " autocomplete=" + chr(34) + "email" + chr(34) + " dir=" + chr(34) + "ltr" + chr(34), t=t)}'
           f'{fld("phone", "رقم الهاتف (اختياري)" if lang == "ar" else "Phone (optional)", attrs=" type=" + chr(34) + "tel" + chr(34) + " autocomplete=" + chr(34) + "tel" + chr(34) + " dir=" + chr(34) + "ltr" + chr(34), t=t)}</div></fieldset>')
    brief = fld('brief', f['brief'], 'textarea', req=True, hint=f['brief_hint'], t=t, wide=True)
    spec = {
        'scoring': [(v['sec_project'], fld('project_format', ff['project_format'], 'pills', opts=ff['project_format_opts'], t=t) + fld('project_title', ff['project_title'], t=t) + fld('director_producer', ff['director_prod'], t=t)
                     + fld('stage', ff['stage'], 'select', opts=ff['stage_opts'], t=t) + brief), (v['sec_timeline'], dates + budget)],
        'concerts': [(v['sec_event'], fld('event_format', ff['event_format'], 'pills', opts=ff['event_format_opts'], t=t) + fld('location', ff['location'], t=t) + fld('venue', ff['venue'], t=t)
                      + dates + fld('capacity', ff['capacity'], attrs=' inputmode="numeric"', t=t) + budget
                      + f'<div class="fld w"><label class="chk"><input type="checkbox" name="rider" value="yes">{e(ff["rider"])}</label></div>' + brief)],
        'licensing': [(v['sec_music'], fld('work', v['req_work'], attrs=' data-prefill="work"', t=t, wide=True) + fld('track', ff['track'], hint=ff['track_hint'], t=t, wide=True)),
                      (v['sec_use'], fld('usage', ff['usage'], 'pills', opts=ff['usage_opts'], t=t) + fld('territory', ff['territory'], t=t) + fld('term', ff['term'], t=t) + dates + budget + brief)],
        'press': [(v['sec_request'], fld('request', ff['request'], 'pills', opts=ff['request_opts'], t=t) + fld('outlet', ff['outlet'], t=t) + fld('deadline', ff['deadline'], attrs=' type="date"', t=t) + brief)],
        'general': [(v['sec_request'], fld('subject', ff['subject'], t=t, wide=True) + brief)],
    }
    for k in B.FORM_KINDS:
        endpoint = (B.SET.get('form_endpoints') or {}).get(k) or B.SET.get('form_endpoint', '')
        secs = ''.join(f'<fieldset><legend><small>{dig(lang, "%02d" % (i + 1))}</small>{e(name)}</legend><div class="fgrid">{inner}</div></fieldset>' for i, (name, inner) in enumerate(spec[k]))
        n = len(spec[k]) + 1
        rider = f'<p class="hint" style="margin:-10px 0 24px">{e(t["rider_note"])}</p>' if k == 'concerts' else ''
        form = f'''<form class="enq rv" data-enquiry data-kind="{k}" data-label="{e(v["form_t"][k])}" data-endpoint="{e(endpoint)}" data-to="{e(B.SET["contacts"].get(k) or mail)}" novalidate method="post">
  <div class="form-error" data-summary role="alert" tabindex="-1" hidden></div>{rider}
  {secs}{who.replace("{n}", dig(lang, "%02d" % n))}
  <div class="hp" aria-hidden="true"><label for="f-website">{e(f["honeypot"])}</label><input id="f-website" name="website" tabindex="-1" autocomplete="off"></div>
  <label class="chk"><input type="checkbox" id="f-consent" name="consent" required aria-describedby="e-consent"><span>{e(f["consent"])} <a href="{lu(lang, "privacy")}">{e(t["privacy"])}</a></span></label><p class="ferr" id="e-consent" data-err="consent"></p>
  <div class="btns" style="margin-top:24px"><button class="btn solid" type="submit">{e(f["send"])}{IC["arr"]}</button>{f'<a class="btn line" href="{lu(lang, "works")}">{e(v["choose_other"])}</a>' if k == "licensing" else ""}</div>
  <p class="form-ok" data-ok role="status" tabindex="-1" hidden></p>
 </form>'''
        others = ''.join(f'<a href="{lu(lang, "contact/" + o)}">{e(v["form_t"][o])}<span>{IC["arr"]}</span></a>' for o in B.FORM_KINDS if o != k)
        after = (f'<div><span class="k">{e(v["after"])}</span><ol class="after">' + ''.join(f'<li><b>{dig(lang, i + 1)}</b><span><strong>{e(v["after" + str(i + 1)])}</strong>{e(v["after" + str(i + 1) + "s"])}</span></li>' for i in range(3)) + '</ol></div>') if k == 'licensing' else ''
        kit = (f'<div><span class="k">{e(v["press_kit"])}</span><p>{e(v["kit_page_s"])}</p><a class="lk" href="{lu(lang, "news-press/press-kit")}">{e(v["open"])}{IC["arr"]}</a></div>') if k == 'press' else ''
        side = f'''<aside class="ct-side rv">{after}<div><span class="k">{e(v["direct"])}</span><span class="lbl" style="margin-top:12px">{e(v["email"])}</span><a class="big" href="mailto:{e(mail)}">{e(mail)}</a></div>
  {f'<div>{phones}</div>' if phones else ''}{kit}<div class="lks"><span class="k">{e(v["other_inq"])}</span>{others}</div><div><span class="k">{e(v["follow"])}</span><div style="margin-top:12px">{soc_icons()}</div></div></aside>'''
        img_, pos = FORM_IMG[k]
        body = f'''
<div class="wrap page-hd"><a class="lk" href="{lu(lang, "contact")}" style="margin-bottom:24px">← {e(v["back_contact"])}</a><div style="margin-top:22px">{crumb(lang, [(t["contact_title"], lu(lang, "contact")), (v["form_t"][k], None)])}</div>
 <h1 class="h1 split-l">{e(v["form_t"][k])}</h1><span class="k rv" style="margin-top:16px">{e(v["form_k"][k])}</span>
 <div class="ct-photo rv-img">{fr(img_, '', '', '100vw', pos, lazy=False)}<span class="lbl-cap">{e(v["photo_cap"][k])}</span></div>
 <p class="lede rv" style="margin-top:30px">{e(t["form_hint"][k])}</p>
 <div class="ct-form">{form}{side}</div></div>'''
        write(lang, 'contact/' + k, page(lang, 'contact/' + k, v['form_t'][k], body, desc=t['form_hint'][k],
                                       jsonld=[B.crumb_ld(lang, [(t['nav']['home'], lu(lang)), (t['contact_title'], lu(lang, 'contact')), (v['form_t'][k], lu(lang, 'contact/' + k))])]))


# ---------------------------------------------------------------- utility
def build_search(lang):
    t = B.I18N[lang]
    B.build_search_index(lang)
    body = f'''<div class="wrap page-hd" style="max-width:900px">{crumb(lang, [(t["search_title"], None)])}<h1 class="h1 split-l">{e(t["search_title"])}</h1><p class="lede rv">{e(t["search_intro"])}</p>
<div data-search data-index="{lu(lang)}search-index.json" style="margin-top:30px"><label><span class="sr">{e(t["search_ph"])}</span><input type="search" class="big-search" placeholder="{e(t["search_ph"])}" data-search-input autofocus></label>
<p class="dim" aria-live="polite" data-search-count></p><ol class="sres" data-search-results></ol></div></div>'''
    write(lang, 'search', page(lang, 'search', t['search_title'], body, noindex=True))


def build_utility(lang):
    t = B.I18N[lang]
    for key, path in (('privacy', 'privacy'), ('accessibility', 'accessibility')):
        paras = t['privacy_text'] if key == 'privacy' else t['a11y_text']
        text = ''.join('<p>' + e(p) + '</p>' for p in paras)
        body = f'''<div class="wrap page-hd">{crumb(lang, [(t[key], None)])}<h1 class="h1 split-l">{e(t[key])}</h1></div>
<section class="sec" style="padding-top:40px"><div class="wrap"><div class="prose rv">{text}
<p><a href="{lu(lang, "contact/general")}">{e(t["nav"]["contact"])}</a> · <a href="mailto:{e(B.SET["contacts"]["general"])}">{e(B.SET["contacts"]["general"])}</a></p></div></div></section>'''
        write(lang, path, page(lang, path, t[key], body))


def build_404():
    lang = 'en'
    t, v = B.I18N[lang], V(lang)
    blocks = ''.join(f'<div lang="{l}" dir="{B.I18N[l]["dir"]}" style="margin-top:24px"><h2 class="h3">{e(B.I18N[l]["notfound_title"])}</h2><p class="mut">{e(B.I18N[l]["notfound_text"])}</p>'
                     f'<a class="btn solid" href="{lu(l)}">{e(B.I18N[l]["back_home"])}</a></div>' for l in B.LANGS)
    body = f'<section class="wrap nf-page"><div><p class="num">404</p>{blocks}</div></section>'
    html_ = page(lang, '', '404', body, noindex=True)
    B.write('404.html', html_)
