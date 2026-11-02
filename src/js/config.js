/* config.js — the settings you are most likely to change. Loaded first; everything else reads CONFIG.
   After editing, rebuild with `python3 build.py` (see README.md). */
const CONFIG = {
  /* Longdo Map API key (https://map.longdo.com → "API Key"). Used by the "Longdo Map" base map.
     The key ends up in the public HTML, so in the Longdo console restrict it to your own domain (e.g. yourname.github.io).
     A visitor can still override it in ☰ → Longdo Map (stored in their own browser only). */
  LONGDO_KEY: '18bd75c0b38cd1aad0edf57da3c5d389',

  /* Servers that fit the bus / van / coach lines to real roads (OSRM-compatible: /match and /route). Tried in this order. */
  SNAP_HOSTS: ['https://router.project-osrm.org', 'https://routing.openstreetmap.de/routed-car'],

  /* Overpass mirrors (railway / ferry geometry, bus stops near a point, station exits). All are asked at once, first answer wins. */
  OVERPASS: ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
};
