#!/usr/bin/env python3
"""
Construit le site à partir du contenu (dossier content/, modifiable depuis /admin).

    python3 build.py

Génère :
  - index.html            la page d'accueil (à partir de templates/index.html)
  - chatbot/knowledge.md  ce que sait l'assistant IA (lu en ligne par le Worker)

Sur GitHub, ce script est lancé automatiquement à chaque modification
(.github/workflows/pages.yml). En local, lancez-le avant d'ouvrir index.html.

Dépendances : pip install -r requirements.txt  (PyYAML, Jinja2, Markdown)
"""
import datetime as dt
import html
import re
import runpy
import sys
from pathlib import Path

import markdown as mdlib
import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined
from markupsafe import Markup

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / 'content'
SITE_URL = 'https://lamine.mlndao.fr'
CHAT_API = 'https://lamine-chat.mlndao.workers.dev/chat'
NEWS_VISIBLE = 4  # actualités affichées avant « Voir toutes les actualités »

PUB_TYPES = [  # (clé, titre FR, titre EN, ouvert par défaut)
    ('journal', 'Revues internationales', 'International journals', True),
    ('international', 'Conférences internationales', 'International conferences', True),
    ('national', 'Conférences nationales', 'National conferences', False),
    ('chapter', 'Chapitres d’ouvrage', 'Book chapters', False),
    ('thesis', 'Thèse', 'PhD thesis', False),
    ('seminar', 'Séminaires', 'Seminars', False),
    ('other', 'Autres', 'Other', False),
]
MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
             'septembre', 'octobre', 'novembre', 'décembre']
MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
             'September', 'October', 'November', 'December']

warnings = []


# ------------------------------------------------------------------ lecture du contenu
def load(path):
    try:
        data = yaml.safe_load(path.read_text(encoding='utf-8')) or {}
    except yaml.YAMLError as e:
        sys.exit(f'Fichier illisible : {path.relative_to(ROOT)}\n{e}')
    return Obj(data)


def load_folder(name):
    folder = CONTENT / name
    items = []
    for p in sorted(folder.glob('*.y*ml')) if folder.exists() else []:
        item = load(p)
        item['_file'] = str(p.relative_to(ROOT))
        if item.get('draft'):
            continue
        items.append(item)
    return items


class Obj(dict):
    """Dictionnaire tolérant : un champ absent vaut '' (le CMS omet parfois les champs vides)."""

    def __init__(self, data):
        super().__init__({k: wrap(v) for k, v in (data or {}).items()})

    def __getattr__(self, k):
        return self.get(k, '')

    def __getitem__(self, k):
        return self.get(k, '')


def wrap(v):
    if isinstance(v, dict):
        return Obj(v)
    if isinstance(v, list):
        return [wrap(x) for x in v]
    return '' if v is None else v


# ------------------------------------------------------------------ filtres
_md = mdlib.Markdown(extensions=['sane_lists'], output_format='html')


def _links(h):
    # liens externes : nouvel onglet
    return re.sub(r'<a href="(https?://[^"]+)"', r'<a href="\1" target="_blank" rel="noopener"', h)


def f_md(text):
    if not text:
        return Markup('')
    _md.reset()
    return Markup(_links(_md.convert(str(text))))


def f_mdi(text):
    if not text:
        return Markup('')
    _md.reset()
    h = _md.convert(str(text)).strip()
    m = re.fullmatch(r'<p>(.*)</p>', h, re.S)
    if m:
        h = m.group(1)
    return Markup(_links(h.replace('\n', ' ')))


def f_plain(text):
    s = re.sub(r'<[^>]+>', '', str(f_mdi(text)))
    return html.unescape(re.sub(r'\s+', ' ', s)).strip()


def f_rel(path):
    s = str(path or '')
    return s[1:] if s.startswith('/') and not s.startswith('//') else s


def f_rel_or_url(s):
    return f_rel(s)


def f_authors(text):
    h = str(f_mdi(text))
    h = re.sub(r'(?<!<b>)(Ndao,\s*M\.\s*-?\s*L\.)', r'<b>\1</b>', h)
    return Markup(h)


def f_lines(text):
    return Markup('<br>'.join(html.escape(x.strip()) for x in str(text).strip().splitlines()))


# ------------------------------------------------------------------ préparation
def to_date(v, where):
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    try:
        return dt.date.fromisoformat(str(v)[:10])
    except ValueError:
        warnings.append(f'{where} : date illisible « {v} », actualité ignorée')
        return None


def prepare():
    p = load(CONTENT / 'profile.yml')
    research = load(CONTENT / 'research.yml')

    # actualités : plus récentes d'abord
    news = []
    for n in load_folder('news'):
        d = to_date(n.date, n._file)
        if not d or not (n.title_fr or n.title_en):
            continue
        n['date_iso'] = d.isoformat()
        n['date_fr'] = f'{MONTHS_FR[d.month - 1].capitalize()} {d.year}'
        n['date_en'] = f'{MONTHS_EN[d.month - 1]} {d.year}'
        n['title_fr'] = n.title_fr or n.title_en
        n['text_fr'] = n.text_fr or n.text_en
        news.append((d, n))
    news = [n for _, n in sorted(news, key=lambda x: x[0], reverse=True)]

    # publications regroupées par type, année décroissante
    pubs = load_folder('publications')
    known = {k for k, *_ in PUB_TYPES}
    for pub in pubs:
        if pub.type not in known:
            warnings.append(f'{pub._file} : type « {pub.type} » inconnu, classé dans « Autres »')
            pub['type'] = 'other'
        try:
            pub['year'] = int(pub.year)
        except (TypeError, ValueError):
            warnings.append(f'{pub._file} : année manquante')
            pub['year'] = 0
    groups = []
    for key, fr, en, open_ in PUB_TYPES:
        items = [x for x in pubs if x.type == key]
        # à année égale : « rank » le plus grand d'abord ; sans rank, en tête (ajout récent)
        items.sort(key=lambda x: (-x.year, -(x.rank if isinstance(x.rank, (int, float)) else 1e6)))
        if items:
            groups.append({'key': key, 'fr': fr, 'en': en, 'open': open_, 'items': items})

    def ordered(name):
        items = load_folder(name)
        return sorted(items, key=lambda x: (x.order if isinstance(x.order, (int, float)) else 999, x._file))

    return {
        'p': p,
        'research': research,
        'news': news,
        'news_visible': NEWS_VISIBLE,
        'pub_groups': groups,
        'teaching': ordered('teaching'),
        'experience': ordered('experience'),
        'year': dt.date.today().year,
        'site_url': SITE_URL,
        'chat_api': CHAT_API,
    }


def main():
    env = Environment(loader=FileSystemLoader(ROOT / 'templates'), autoescape=True,
                      undefined=StrictUndefined, trim_blocks=False, lstrip_blocks=False)
    env.filters.update(md=f_md, mdi=f_mdi, plain=f_plain, rel=f_rel, rel_or_url=f_rel_or_url,
                       authors=f_authors, lines=f_lines)
    ctx = prepare()
    out = env.get_template('index.html').render(**ctx)
    (ROOT / 'index.html').write_text(out, encoding='utf-8')

    n_pubs = sum(len(g['items']) for g in ctx['pub_groups'])
    print(f"index.html : {len(ctx['news'])} actualité(s), {n_pubs} publication(s), "
          f"{len(ctx['teaching'])} enseignement(s), {len(ctx['experience'])} expérience(s)")

    kb = ROOT / 'chatbot' / 'build_knowledge.py'
    if kb.exists():
        runpy.run_path(str(kb), run_name='__main__')

    for w in warnings:
        print('Attention :', w)


if __name__ == '__main__':
    main()
