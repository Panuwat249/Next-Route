#!/usr/bin/env python3
"""Build Next Route.  Run from anywhere:  python3 build.py

Concatenates src/ into two self-contained HTML files:
  dist/site/index.html   full version (map tiles + nationwide GTFS routes)  -> this is what GitHub Pages serves
  dist/rail-only.html    light version: BTS/MRT/ARL/SRT planner only, no network features, no Longdo key inside

Optional: LONGDO_KEY=xxxx python3 build.py   overrides the key in src/js/config.js for this build only.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(ROOT, *a)
rd = lambda *a: open(P(*a), encoding='utf-8').read()

# order matters: later files use names declared by earlier ones
JS = ['js/config.js', 'vendor/leaflet.min.js', 'js/data.js', 'js/core.js', 'js/ui.js', 'js/sim.js',
      'js/trip-1-head.js', 'js/trip-2-mid.js', 'js/trip-3-tail.js',
      'js/transit.js', 'js/catalog.js', 'js/roads.js', 'js/view3d.js', 'js/boot.js']
CSS = ['vendor/leaflet.css', 'css/style.css']
KEY = re.compile(r"LONGDO_KEY:\s*'[^']*'")

def js_text(key=None):
    parts = []
    for f in JS:
        t = rd('src', f)
        if f.endswith('config.js') and key is not None:
            t = KEY.sub("LONGDO_KEY: '%s'" % key.replace("'", ''), t)
        parts.append(t)
    js = '\n'.join(parts)
    assert '</script' not in js, 'a script contains "</script": it would end the page early'
    return js

def page(js, css):
    return rd('src', 'index.template.html').replace('/*CSS*/', css).replace('/*JS*/', js)

css = '\n'.join(rd('src', f) for f in CSS)
env_key = os.environ.get('LONGDO_KEY')

# 1) light version: no key, no GTFS, no tiles
light = page(js_text(''), css)

# 2) full version
head = ('<!doctype html>\n<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>[hidden]{display:none!important}body{margin:0}html{color-scheme:light}</style></head><body>\n')
full = head + page(js_text(env_key), css).replace('/*TILES*/false', 'true').replace('/*GTFSDATA*/', rd('data', 'gtfs_data.js')) + '\n</body></html>\n'

os.makedirs(P('dist', 'site'), exist_ok=True)
open(P('dist', 'site', 'index.html'), 'w', encoding='utf-8').write(full)
open(P('dist', 'rail-only.html'), 'w', encoding='utf-8').write(light)
open(P('dist', 'site', '.nojekyll'), 'w').write('')
print('dist/site/index.html  %.2f MB' % (len(full.encode()) / 1e6))
print('dist/rail-only.html   %.2f MB' % (len(light.encode()) / 1e6))
