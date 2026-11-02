#!/usr/bin/env python3
"""Build Next Route:  python3 build.py   (Python 3 only, nothing to install)

Joins src/ into ready-to-publish files:
  index.html           full version (map tiles + nationwide GTFS routes). Loads config.js (same folder) at start. ← GitHub Pages serves this
  lite/rail-only.html  light version: BTS/MRT/ARL/SRT planner only, works offline, no key inside

You only need to run this after editing something under src/ or data/. Editing config.js needs no build.
"""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(ROOT, *a)
rd = lambda *a: open(P(*a), encoding='utf-8').read()

# order matters: later files use names declared by earlier ones
JS = ['js/config.js', 'vendor/leaflet.min.js', 'js/data.js', 'js/core.js', 'js/ui.js', 'js/sim.js',
      'js/trip-1-head.js', 'js/trip-2-mid.js', 'js/trip-3-tail.js',
      'js/transit.js', 'js/catalog.js', 'js/roads.js', 'js/view3d.js', 'js/boot.js']
CSS = ['vendor/leaflet.css', 'css/style.css']

js = '\n'.join(rd('src', f) for f in JS)
assert '</script' not in js, 'a script contains "</script": it would end the page early'
css = '\n'.join(rd('src', f) for f in CSS)
page = rd('src', 'index.template.html').replace('/*CSS*/', css).replace('/*JS*/', js)

# light version: no key, no GTFS, no tiles
os.makedirs(P('lite'), exist_ok=True)
open(P('lite', 'rail-only.html'), 'w', encoding='utf-8').write(page)

# full version. config.js is baked in as a fallback AND loaded again from the same folder so edits to it apply without a rebuild.
cfg = rd('config.js')
assert '</script' not in cfg
head = ('<!doctype html>\n<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>[hidden]{display:none!important}body{margin:0}html{color-scheme:light}</style></head><body>\n'
        '<script>' + cfg + '</script>\n<script src="config.js"></script>\n')
full = head + page.replace('/*TILES*/false', 'true').replace('/*GTFSDATA*/', rd('data', 'gtfs_data.js')) + '\n</body></html>\n'
open(P('index.html'), 'w', encoding='utf-8').write(full)
open(P('.nojekyll'), 'w').write('')
print('index.html           %.2f MB' % (len(full.encode()) / 1e6))
print('lite/rail-only.html  %.2f MB' % (len(page.encode()) / 1e6))
