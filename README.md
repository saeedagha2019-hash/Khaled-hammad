# Khaled Hammad — Official Website · الموقع الرسمي · Официальный сайт

Implementation of the *Website Creative Direction, UX, Sitemap & Development Brief* (6 November 2026).
Direction: **Cinematic Legacy**: deep teal `#142B2A`, charcoal `#111719`, warm ivory `#F2EDE3` and a restrained bronze `#B39A70`.

---

## بالعربية — نظرة سريعة

- الموقع بثلاث لغات: `/ar/` (من اليمين لليسار)، `/en/`، `/ru/`، والصفحات متطابقة في كل لغة.
- الأقسام: الرئيسية، نبذة، الأعمال (فلترة حسب النوع والعقد والبحث، وصفحة لكل عمل)، استمع وشاهد، الحفلات، الأخبار والصحافة (مع الملف الصحفي)، تواصل (نموذج بخمسة مسارات)، بحث، الخصوصية، إتاحة الوصول، صفحة 404.
- لا يُشغَّل أي صوت تلقائيًا، وفيديوهات يوتيوب لا تُحمَّل إلا بعد الضغط على زر التشغيل.
- **تعديل المحتوى بدون مطوّر:** من لوحة التحكم `/admin/` (Decap CMS). كل حفظ يصبح نسخة محفوظة في GitHub، وبعدها يُعاد بناء الموقع ونشره تلقائيًا.
- **قبل الإطلاق** (حسب البند 9 و13 من الملخص): تأكيد النطاق الرسمي، ومراجعة الترجمة الروسية مع متحدث أصلي، ومراجعة قائمة الأعمال مع IMDb وelCinema، وتأكيد حقوق كل صورة وملصق ومقطع صوتي، ثم إيقاف خيار `show_media_pending_licence`.

---

## Structure

```
content/            ← all editable content (one JSON record per work / concert / article)
  works/*.json        90 works: title ×3 languages, original title, year, category, role,
                      director, cast, synopsis, score story, poster, audio, rights status,
                      awards, credit sources, featured flag, translation status
  concerts/*.json     events: date, status, venue, city, partners, tickets, photos, video
  press/*.json        coverage & interviews with publisher, byline, date
  awards.json  about.json  media.json (rights register)  settings.json
src/i18n.json       interface strings (en / ar / ru)
assets/             css, js, images, audio (extracted from the previous site)
tools/build.py      static site generator (Python standard library; Pillow optional)
admin/              Decap CMS (content editing UI + content model)
legacy/index.html   the previous single-file site, kept for reference
```

## Build & preview

```bash
python3 tools/build.py          # writes ./site
cd site && python3 -m http.server 8080
# open http://localhost:8080/en/
```

Environment overrides: `SITE_URL` (canonical origin), `BASE_PATH` (e.g. `/Khaled-hammad` for a
GitHub project page), `OUT_DIR`.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to **GitHub Pages** on every push to `main`
(enable *Settings → Pages → Source: GitHub Actions*). For the custom domain, add a `CNAME` file and set
the repository variable `SITE_URL=https://khaledhammad.com`. The output is plain static files, so any
host or CDN (Cloudflare Pages, Netlify, S3+CloudFront) works.

**Stack recommendation (brief §7).** Static generation plus a git-based headless CMS. Hosting costs
nothing on GitHub Pages or Cloudflare Pages. There is no server or database to patch, and every content
change is versioned. Decap's editorial workflow gives draft → review → publish, with branch previews when
hosted on Netlify or Cloudflare. The trade-off is that editors need a GitHub login, or an OAuth proxy such
as Netlify Identity or DecapBridge. If the team prefers a hosted editor, the same JSON schema maps onto
Sanity or Storyblok.

## Editing content

Open `/admin/`, sign in, and edit **Works**, **Concerts**, **News & Press** or **Site data**. Each record
has English / Arabic / Russian fields and a *translation status*. A Russian page shows a small "under
editorial review" note while its status is `draft-needs-native-review`.

- **Upcoming concerts:** add a concert with status `announced` / `on-sale` and a future date. It
  appears on Home and Live Concerts. Never publish speculative dates.
- **Featured works:** tick *Featured on home* and set the order (1–6).
- **Contact form delivery:** set `form_endpoint` in Site settings to a form service (Formspree,
  Basin, Web3Forms, or your own endpoint accepting JSON POST). Until then, the form opens the
  visitor's email app with the enquiry pre-filled and addressed to the right contact.

## What is implemented against the brief

| Brief | Implementation |
|---|---|
| §3 Sitemap | Home, About, Works + 90 detail pages, Listen & Watch, Live Concerts + event page, News & Press + Press kit, Contact, Search, Privacy, Accessibility, 404 |
| §4 Homepage | 01 hero (real concert photo, two CTAs) · selected works (6) · sound and story (accessible players) · live on stage (Cairo Opera House 2022, upcoming only if confirmed) · artist profile · recognition · journal/press with dates and publishers · contact choices |
| §5 Works | Filters: category, decade, keyword, sort; shareable URLs (`?cat=tv&decade=2000`); typographic placeholder where no poster permission exists |
| §5 Contact | Five paths (scoring, concerts, licensing, press, general): name, organisation, email, brief, project dates, optional budget band, consent, honeypot and time-trap spam protection. No private phone number is published. |
| §6 Multilingual | `/en/ /ar/ /ru/` with equivalent routes, `lang`/`dir="rtl"`, mirrored layout via logical CSS, persistent language switcher, reciprocal `hreflang` + `x-default`, language-specific canonicals, localised dates and metadata, no IP/browser redirect (the root page only *highlights* the browser language) |
| §7 SEO | `sitemap.xml` with alternates, `robots.txt`, JSON-LD Person / WebSite / Movie / TVSeries / MusicEvent / BreadcrumbList, Open Graph |
| §8 Accessibility & performance | WCAG 2.2 AA targets: skip link, visible focus, all text pairs ≥ 4.5:1, keyboard-operable players (play / seek / volume), labelled forms with error summary, reduced-motion support, no autoplay. Lazy images below the fold, responsive 800w variants, explicit dimensions (no CLS), hero `fetchpriority`. |

## Open items before launch (brief §9, §13)

1. **Domain:** confirm `khaledhammad.com` vs `khaledhmmad.net`, then update `settings.site_url`.
2. **Rights:** every poster, photo and audio excerpt is marked `used-on-previous-site-confirm-licence`
   in `content/`. Record the photographer or owner and the licence, then switch
   `show_media_pending_licence` off.
3. **Filmography:** the figures (59 films, 28 series, 30+ years) are provisional and must be reconciled
   with IMDb and elCinema. The year of *Tehheb Teshouf Ma'sah* is unknown.
4. **Russian copy:** every Russian string is a first draft. Film titles and names need native editorial review.
5. **Biography facts:** confirm the birth date, transliterations, awards evidence (`awards.json → evidence_url`) and affiliations.
6. **Showreel:** no scoring showreel video exists yet. Add its YouTube ID once it is produced.
7. **Fonts:** Cormorant Garamond, Inter, Amiri and IBM Plex Sans Arabic currently load from Google Fonts.
   Self-host them for production if preferred.
