"""One-off: extract content + embedded media from the legacy single-file site
(legacy/index.html) into assets/ and an intermediate content/legacy-extract.json (since migrated
into content/works, press, concerts, awards.json, about.json, media.json). Kept for provenance."""
import re, json, base64, hashlib, sys, os
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'legacy/index.html'), encoding='utf-8').read()
soup = BeautifulSoup(src, 'html.parser')
os.makedirs(os.path.join(ROOT, 'assets/img'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'assets/audio'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'content'), exist_ok=True)

def slug(s):
    s = s.lower().replace("'", '').replace('’', '')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

def save(uri, name):
    m = re.match(r'data:([a-z/+]+);base64,(.*)', uri, re.S)
    mime, data = m.group(1), base64.b64decode(m.group(2))
    ext = {'image/webp': 'webp', 'audio/mpeg': 'mp3'}[mime]
    sub = 'img' if ext == 'webp' else 'audio'
    rel = f'assets/{sub}/{name}.{ext}'
    open(os.path.join(ROOT, rel), 'wb').write(data)
    return '/' + rel

def t(el):
    return {'en': el.get('data-en', el.get_text(strip=True)), 'ar': el.get('data-ar', '')}

out = {}
hero = soup.select_one('.hero')
out['hero'] = {'portrait': save(hero.select_one('img.portrait')['src'], 'hero-portrait'),
               'alt': save(hero.select_one('.slide2 img')['src'], 'hero-portrait-2')}
about = soup.select_one('#about')
out['about'] = {'photo': save(about.select_one('figure img')['src'], 'about-wide'),
                'paragraphs': [t(p) for p in about.select('.about p')]}

# featured works (posters + audio)
featured = []
for a in soup.select('#works .works article.work'):
    title = t(a.select_one('h3'))
    s = slug(title['en'])
    item = {'slug': s, 'title': title, 'credit': t(a.select_one('p')),
            'format': a.select_one('.frame b').get_text(strip=True).lower(),
            'year': int(a.select_one('.frame span').get_text(strip=True)),
            'poster': save(a.select_one('img')['src'], 'poster-' + s)}
    if a.get('data-track'):
        item['audio'] = save(a['data-track'], 'track-' + s)
    featured.append(item)
out['featured'] = featured
out['complete_works_photo'] = save(soup.select_one('#all-works figure img')['src'], 'studio-complete-works')

works = []
for g in soup.select('#all-works .grp'):
    for li in g.select('li'):
        d = li.select_one('.tt > div')
        by = li.select_one('.by')
        works.append({'group': g['data-t'], 'group_label': t(g.select_one('h3')),
                      'year': li.select_one('span').get_text(strip=True), 'title': t(d),
                      'credit': t(by) if by else None})
out['works'] = works

gal = []
for i, b in enumerate(soup.select('#gallery .g-item')):
    im = b.select_one('img')
    gal.append({'cat': b['data-c'], 'alt': im.get('alt', ''), 'src': save(im['src'], f'gallery-{i+1:02d}-{b["data-c"]}')})
out['gallery'] = gal

aw = []
for gi, g in enumerate(soup.select('#awards .awgrp')):
    fig = g.select_one('figure img')
    grp = {'label': t(g.select_one('.awlabel')), 'image': save(fig['src'], f'awards-{gi+1}') if fig else None,
           'image_alt': fig.get('alt', '') if fig else '', 'items': []}
    for li in g.select('li'):
        av = li.select_one('.av')
        grp['items'].append({'year': li.select_one('.ay').get_text(strip=True), 'name': t(li.select_one('.ab > div')),
                             'body': t(av) if av else None})
    aw.append(grp)
out['awards'] = aw
out['timeline_photo'] = save(soup.select_one('#timeline img')['src'], 'timeline')
out['timeline'] = [{'year': li.select_one('span').get_text(strip=True), 'text': t(li.select_one('div'))}
                   for li in soup.select('#timeline li')]

press = []
for c in soup.select('#press .mx-card'):
    meta_by = [s for s in c.select('.mx-meta > span[data-en]')]
    press.append({'cat': c['data-c'], 'date': c.get('data-date', ''), 'url': c.select_one('a')['href'],
                  'video': 'mx-video' in c.get('class', []),
                  'source': t(c.select_one('.mx-src > span')), 'kind': t(c.select_one('.mx-chip')),
                  'title': t(c.select_one('.mx-title')), 'deck': t(c.select_one('.mx-deck')),
                  'byline': t(meta_by[0]) if meta_by else None})
out['press'] = press
out['social'] = [{'name': a['aria-label'], 'url': a['href']} for a in soup.select('#contact .social a')]
out['email'] = soup.select_one('#mail').get_text(strip=True)
out['showreel_audio'] = save(soup.select_one('#bgm')['src'], 'showreel-theme')
json.dump(out, open(os.path.join(ROOT, 'content/legacy-extract.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(featured), len(works), len(gal), len(press))
