/* ui.js: planner, results and the Leaflet map. */
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function inkOn(hex) { const n = parseInt(hex.slice(1), 16), l = .299 * (n >> 16) + .587 * ((n >> 8) & 255) + .114 * (n & 255); return l > 150 ? '#10201A' : '#FFFFFF'; }
const lineChip = (lid, code) => `<span class="chip" style="background:${LINES[lid].color};color:${inkOn(LINES[lid].color)}">${esc(LINES[lid].short)}${code ? ` <span class="code">${esc(code)}</span>` : ''}</span>`;
const fmt = m => { m = Math.round(m) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
function bkk() { const d = new Date(Date.now() + 7 * 3600e3); return { minute: d.getUTCHours() * 60 + d.getUTCMinutes(), weekend: d.getUTCDay() === 0 || d.getUTCDay() === 6 }; }

/* ---------- places ---------- */
const PL = Object.entries(PLACES).map(([id, mem]) => {
  const n = NODES[mem[0]];
  return { id, th: n.th, en: n.en, nodes: mem, codes: [...new Set(mem.map(m => NODES[m].code))], lines: [...new Set(mem.map(m => NODES[m].line))] };
});
const PLBY = Object.fromEntries(PL.map(p => [p.id, p]));
function findPlaces(q) {
  q = q.trim().toLowerCase(); if (!q) return [];
  const sc = p => {
    const t = p.th.toLowerCase(), e = p.en.toLowerCase(), c = p.codes.map(x => x.toLowerCase());
    if (c.includes(q) || t === q || e === q) return 0;
    if (t.startsWith(q) || e.startsWith(q) || c.some(x => x.startsWith(q))) return 1;
    if (t.includes(q) || e.includes(q)) return 2;
    return 9;
  };
  return PL.map(p => [sc(p), p]).filter(x => x[0] < 9).sort((a, b) => a[0] - b[0] || a[1].th.localeCompare(b[1].th, 'th')).slice(0, 8).map(x => x[1]);
}
const dots = p => p.lines.map(l => `<i class="dot" style="background:${LINES[l].color}"></i>`).join('');

function picker(inp, list, onPick) {
  let items = [], sel = 0;
  const draw = () => {
    list.innerHTML = items.map((it, i) => itemRow(it, i, sel)).join('');
    list.hidden = !items.length; inp.setAttribute('aria-expanded', String(!!items.length));
  };
  inp.addEventListener('input', () => {
    onPick(null, true); sel = 0; const q = inp.value.trim();
    if (!q) { items = []; draw(); return; }
    searchAll(q, r => { items = r; draw(); }, 4);
  });
  inp.addEventListener('focus', () => { inp.select(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % Math.max(items.length, 1); draw(); }
    else if (e.key === 'Enter' && items.length) { e.preventDefault(); choose(items[sel]); }
    else if (e.key === 'Escape') { items = []; draw(); }
  });
  list.addEventListener('pointerdown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); choose(items[+li.dataset.i]); } });
  inp.addEventListener('blur', () => setTimeout(() => { items = []; draw(); }, 150));
  function choose(it) { items = []; draw(); onPick(asSel(it), false); }
  return { set(id) { inp.value = id ? PLBY[id].th : ''; } };
}

/* ---------- state ---------- */
const st = { live: true, names: true, from: null, to: null, fromPt: null, toPt: null, plan: null, route: null, vis: new Set(Object.keys(LINES)), pendingFit: false, touched: false };

/* ---------- map: Leaflet, real station positions and real track geometry ---------- */
const TILES = /*TILES*/false; // true only in the standalone file, where map tiles may load
const wrap = $('mapwrap'), ALL = Object.keys(NODES);
const GEOM = {}; // per hop: intermediate [lat,lng] points that follow the real track
for (const [k, pts] of Object.entries(DATA.geom || {})) { GEOM[k] = pts; const [a, b] = k.split('|'); GEOM[b + '|' + a] = pts.slice().reverse(); }
const map = L.map('map', { zoomControl: false, attributionControl: false, minZoom: 6, maxZoom: 19, zoomSnap: .25, zoomDelta: .5, wheelPxPerZoomLevel: 100, worldCopyJump: false });
map.setView([13.77, 100.56], 11);
[['osmroads', 205], ['osmroads2', 206], ['reflab', 207], ['tr', 405], ['trs', 408], ['lines', 410], ['trhl', 418], ['route', 420], ['wave', 425], ['dots', 430], ['hits', 440], ['labels', 450]].forEach(([n, z]) => { map.createPane(n).style.zIndex = z; });
map.getPane('labels').style.pointerEvents = 'none'; map.getPane('reflab').style.pointerEvents = 'none';
const ll = id => [NODES[id].lat, NODES[id].lng];
function trackLL(ids) { // station → real track vertices → station
  const out = [ll(ids[0])];
  for (let i = 1; i < ids.length; i++) { const g = GEOM[ids[i - 1] + '|' + ids[i]]; if (g) for (const q of g) out.push(q); out.push(ll(ids[i])); }
  return out;
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lwAt = z => clamp(3.2 + .7 * (z - 10), 3.6, 9), rAt = z => clamp(2.4 + .5 * (z - 10), 3, 8);
const lineGroups = {}, lineEls = [];
for (const [lid, Ln] of Object.entries(LINES)) {
  const g = lineGroups[lid] = L.layerGroup(); g._on = false;
  for (const p of Ln.paths) {
    const pts = trackLL(p), base = { pane: 'lines', interactive: false, lineCap: 'round', lineJoin: 'round', smoothFactor: .6, noClip: true };
    const o = L.polyline(pts, { ...base, color: '#000', className: 'ln-o' }), c = L.polyline(pts, { ...base, color: '#fff', className: 'ln-c' }), l = L.polyline(pts, { ...base, color: Ln.color });
    [o, c, l].forEach(x => g.addLayer(x)); lineEls.push({ lid, o, c, l });
  }
}
const placeTier = {};
for (const Ln of Object.values(LINES)) for (const p of Ln.paths) p.forEach((id, i) => {
  const pl = NODES[id].place, t = (PLACES[pl].length > 1 || i === 0 || i === p.length - 1) ? 0 : (i % 2 === 0 ? 1 : 2);
  placeTier[pl] = Math.min(placeTier[pl] ?? 9, t);
});
for (const pl of PL) if (pl.nodes.some(n => EDGE_HAS_XFER(n))) placeTier[pl.id] = 0;
function EDGE_HAS_XFER(n) { return (ADJ[n] || []).some(m => EDGE[n + '|' + m].kind === 'xfer'); }
const dotEls = [];
for (const [id, n] of Object.entries(NODES)) {
  const big = PLACES[n.place].length > 1 || EDGE_HAS_XFER(id), g = lineGroups[n.line];
  const dot = L.circleMarker(ll(id), { pane: 'dots', radius: 4, color: LINES[n.line].color, weight: 3, fill: true, fillOpacity: 1, className: 'st-dot', interactive: false });
  const hit = L.circleMarker(ll(id), { pane: 'hits', radius: 13, stroke: false, fill: true, fillOpacity: 0, className: 'st-hit', bubblingMouseEvents: false });
  hit.on('click', () => showStation(n.place));
  g.addLayer(dot); g.addLayer(hit); dotEls.push({ id, n, dot, big });
}
const labEls = PL.map(p => ({ p, on: false, m: L.marker(ll(p.nodes[0]), { pane: 'labels', interactive: false, keyboard: false, icon: L.divIcon({ className: 'stlab', html: `<span>${esc(p.th)}</span>`, iconSize: [0, 0], iconAnchor: [-12, 0] }) }) }));
const LM = [['สวนจตุจักร', 13.8000, 100.5505], ['สวนลุมพินี', 13.7305, 100.5415], ['สวนเบญจกิติ', 13.7245, 100.5580], ['สนามบินดอนเมือง', 13.9126, 100.6068], ['เกาะรัตนโกสินทร์', 13.7515, 100.4950]]
  .map(([t, la, ln]) => ({ on: false, m: L.marker([la, ln], { pane: 'labels', interactive: false, keyboard: false, icon: L.divIcon({ className: 'stlab lm', html: `<span>${esc(t)}</span>`, iconSize: [0, 0], iconAnchor: [30, 0] }) }) }));

/* basemap tiles: only in the standalone file */
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const T = n => ESRI + n + '/MapServer/tile/{z}/{y}/{x}';
const ROADS = [T('Reference/World_Transportation'), 18, .8]; // road + soi lines and names drawn over the base map
const CR = 'Esri, HERE, Garmin, © OpenStreetMap contributors';
const GREF = [T('Canvas/World_Dark_Gray_Reference'), 16, .85, 'reflab'];
/* Detailed basemaps come from OpenStreetMap-based tile servers, tried in order. Each one is tested at start-up with a real tile (a browser can show
   the "access blocked" picture that OSM sends to pages without a Referer, so a plain image error is not enough). The first one that answers is used;
   if none does, the Esri tiles below are used instead, with street and soi lines drawn on top from OpenStreetMap data (roads.js). */
/* 1st choice: OpenFreeMap (free, no key, no Referer needed). Vector tiles drawn by MapLibre GL, loaded from a CDN at run time; styles: liberty / dark / fiord. */
const ML = { js: ['https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js', 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js'],
  plugin: ['https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.3/leaflet-maplibre-gl.js', 'https://cdn.jsdelivr.net/npm/@maplibre/maplibre-gl-leaflet@0.1.3/leaflet-maplibre-gl.js'],
  css: ['https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css', 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css'] };
const loadScript = async urls => { for (const u of urls) { const ok = await new Promise(res => { const e = document.createElement('script'); e.src = u; e.onload = () => res(true); e.onerror = () => { e.remove(); res(false); }; document.head.appendChild(e); }); if (ok) return true; } return false; };
const loadCss = urls => { const e = document.createElement('link'); e.rel = 'stylesheet'; e.href = urls[0]; e.onerror = () => { e.href = urls[1]; }; document.head.appendChild(e); };
let mlP = null;
const loadML = () => mlP || (mlP = (async () => { if (!(window.maplibregl || await loadScript(ML.js))) return false; loadCss(ML.css); return !!(L.maplibreGL || await loadScript(ML.plugin)) && !!L.maplibreGL; })().catch(() => false));
const SRC = {
  ofm: { name: 'OpenFreeMap', ml: true, probe: 'https://tiles.openfreemap.org/styles/liberty', strict: true, cr: 'OpenFreeMap © OpenMapTiles · ข้อมูลจาก OpenStreetMap' },
  osm: { name: 'OpenStreetMap', u: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', probe: 'https://tile.openstreetmap.org/12/3191/1890.png', strict: true, sub: 'abc', cr: '© OpenStreetMap contributors' },
  osmfr: { name: 'OpenStreetMap France', u: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', probe: 'https://a.tile.openstreetmap.fr/osmfr/12/3191/1890.png', strict: false, sub: 'abc', cr: '© OpenStreetMap contributors, tiles OSM France' },
  carto: { name: 'CARTO Dark Matter', u: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', probe: 'https://a.basemaps.cartocdn.com/dark_all/12/3191/1890.png', strict: true, sub: 'abcd', cr: '© OpenStreetMap contributors © CARTO' },
};
const NET = { osm: ['OpenStreetMap', ['osm', 'osmfr']], light: ['สว่าง', ['ofm', 'osm', 'osmfr']], bright: ['สว่าง', ['ofm', 'osm', 'osmfr']], positron: ['สว่าง', ['ofm', 'osm', 'osmfr']], night: ['กลางคืน', ['ofm', 'carto']] };
const OFM_STYLE = { light: 'liberty', bright: 'bright', positron: 'positron', night: 'fiord' }; // OpenFreeMap styles (its black "dark" style is left out on purpose)
const MAPMODES = [ // [key, label, group]
  ['light', 'สว่าง (Liberty)', 'OpenFreeMap'], ['bright', 'สว่าง สดใส (Bright)', 'OpenFreeMap'], ['positron', 'เรียบ สว่าง (Positron)', 'OpenFreeMap'], ['night', 'กลางคืน (Fiord)', 'OpenFreeMap'], ['3d', '3 มิติ (OpenFreeMap 3D)', 'OpenFreeMap'],
  ['osm', 'OpenStreetMap มาตรฐาน', 'แผนที่ถนน'], ['voyager', 'CARTO Voyager', 'แผนที่ถนน'], ['street', 'Esri ถนน', 'แผนที่ถนน'], ['gray', 'เทาอ่อน (เน้นเส้นทาง)', 'แผนที่ถนน'],
  ['topo', 'ภูมิประเทศ (Esri)', 'ภูมิประเทศ'], ['otm', 'OpenTopoMap (เส้นชั้นความสูง)', 'ภูมิประเทศ'],
  ['sat', 'ภาพถ่ายดาวเทียม', 'ดาวเทียม'], ['hybrid', 'ดาวเทียม + ชื่อถนน', 'ดาวเทียม'],
  ['longdo', 'Longdo Map', 'Longdo']];
let longdoKey = CONFIG.LONGDO_KEY || ''; try { longdoKey = localStorage.getItem('rail-longdo') || longdoKey; } catch (e) {}
const srcOk = {}; let probed = !TILES;
function probeSrc(g) {
  const c = SRC[g];
  return new Promise(res => {
    let done = false; const fin = v => { if (!done) { done = true; srcOk[g] = v; res(v); } };
    setTimeout(() => fin(false), c.ml ? 9000 : 3500);
    if (c.ml) { Promise.all([fetch(c.probe, { cache: 'no-store' }).then(r => r.ok).catch(() => false), loadML()]).then(([a, b]) => fin(a && b)); return; }
    fetch(c.probe, { cache: 'no-store' }).then(r => fin(r.ok)).catch(() => { if (c.strict) return fin(false); const im = new Image(); im.onload = () => fin(true); im.onerror = () => fin(false); im.src = c.probe; });
  });
}
const netOf = key => { const n = NET[key], g = n && n[1].find(x => srcOk[x]); return g ? [n[0], [SRC[g].u], 19, SRC[g].cr, g, SRC[g].sub, SRC[g].ml ? 'https://tiles.openfreemap.org/styles/' + OFM_STYLE[key] : null] : null; };
const STYLES = { // Esri tile services (these load without a referrer, unlike OSM/CARTO)
  light: ['สว่าง', [T('World_Topo_Map')], 18, CR],
  bright: ['สว่าง', [T('World_Topo_Map')], 18, CR],
  positron: ['สว่าง', [T('World_Topo_Map')], 18, CR],
  night: ['กลางคืน', [T('Canvas/World_Dark_Gray_Base'), GREF], 16, CR],
  osm: ['OpenStreetMap', [T('World_Street_Map')], 19, CR],
  voyager: ['CARTO Voyager', [['https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', 19]], 19, '© OpenStreetMap contributors © CARTO', null, 'abcd'],
  street: ['Esri ถนน', [T('World_Street_Map')], 19, CR],
  gray: ['เทาอ่อน', [T('Canvas/World_Light_Gray_Base'), [T('Canvas/World_Light_Gray_Reference'), 16, .9, 'reflab']], 16, CR],
  topo: ['ภูมิประเทศ', [T('World_Topo_Map')], 18, CR],
  otm: ['OpenTopoMap', [['https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', 17]], 17, '© OpenStreetMap contributors, SRTM · OpenTopoMap (CC-BY-SA)', null, 'abc'],
  sat: ['ภาพถ่ายดาวเทียม', [T('World_Imagery')], 19, 'Imagery © Esri, Maxar, Earthstar Geographics'],
  hybrid: ['ดาวเทียม + ชื่อถนน', [T('World_Imagery'), ROADS], 19, 'Imagery © Esri, Maxar, Earthstar Geographics'],
};
let tstyle = 'light'; try { tstyle = localStorage.getItem('rail-tiles6') || 'light'; } catch (e) {} // new key: everyone starts on "สว่าง"
if (tstyle !== 'auto' && !MAPMODES.some(m => m[0] === tstyle)) tstyle = 'light';
const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
const tileKey = () => tstyle !== 'auto' && tstyle !== '3d' ? tstyle : (isDark() ? 'night' : 'light'); // 3D follows the theme (Liberty / Fiord)
const styleOf = key => key === 'longdo' ? ['Longdo Map', [[`https://ms.longdo.com/mmmap/tile.php?key=${encodeURIComponent(longdoKey)}&proj=epsg3857&zoom={z}&x={x}&y={y}`, 19]], 19, '© Longdo Map', null, 'abc'] : (netOf(key) || STYLES[key] || STYLES.light);
let tileGrp = null, tilesKey = null, tOk = 0, tErr = 0;
const dropGL = () => { // remove the basemap layer completely, including any MapLibre canvas left in the map (it would hide the next basemap, e.g. satellite)
  if (tileGrp) { tileGrp.remove(); tileGrp = null; }
  try { map.getContainer().querySelectorAll('.leaflet-gl-layer,.maplibregl-map,.maplibregl-canvas-container').forEach(e => e.remove()); } catch (e) {}
};
function applyTiles() {
  if (!TILES || !probed) return;
  if (tstyle === '3d') { dropGL(); tilesKey = null; return; } // the 3D view is a separate map (view3d.js); the flat map sleeps behind it
  const key = tileKey(), kk = key + '+' + ((netOf(key) || [])[4] || 'esri'); if (kk === tilesKey) return;
  tilesKey = kk; tOk = tErr = 0; dropGL();
  const S = styleOf(key), osm = !!S[4]; $('attr').innerHTML = 'Leaflet | ' + esc(S[3]) + (osm ? '' : ' · แผนที่สำรอง');
  if (S[6]) { // vector basemap (OpenFreeMap through MapLibre GL); drop back to the next source if it never finishes loading
    const gl = L.maplibreGL({ style: S[6], attribution: '' }); tileGrp = L.layerGroup([gl]).addTo(map);
    let ready = false; const bad = () => { if (!ready && tilesKey === kk) { srcOk.ofm = false; draw(); } };
    try { const m = gl.getMaplibreMap(); m.on('load', () => { ready = true; }); m.on('error', e => { if (!ready && e && e.error && /style|404|Failed/i.test(String(e.error.message || e.error))) bad(); }); } catch (e) { bad(); }
    setTimeout(bad, 10000); return;
  }
  tileGrp = L.layerGroup(S[1].map((u, i) => {
    const [url, nz, op, pane] = Array.isArray(u) ? u : [u, S[2]];
    const t = L.tileLayer(url, { maxNativeZoom: nz, maxZoom: 19, minZoom: 5, opacity: op || 1, ...(pane ? { pane } : {}), zIndex: i + 1, keepBuffer: 3, updateWhenIdle: false, subdomains: S[5] || 'abc', className: i === 0 ? (osm ? 'osm-' : 'fb-') + key : '' });
    t.on('tileload', () => { tOk++; }); t.on('tileerror', () => { if (osm && !tOk && ++tErr > 5) { srcOk[S[4]] = false; draw(); return; } if (++tErr > 8 && !tOk) $('attr').textContent = 'โหลดภาพแผนที่ไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ต หรือเลือกรูปแบบอื่น'; });
    return t;
  })).addTo(map);
}
if (TILES) {
  $('mapstyle').hidden = false; $('attr').hidden = false;
  const grp = [...new Set(MAPMODES.map(m => m[2]))];
  $('mapstyle').innerHTML = '<option value="auto">ตามธีม</option>' + grp.map(g => `<optgroup label="${g}">${MAPMODES.filter(m => m[2] === g).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</optgroup>`).join('');
  $('mapstyle').value = tstyle;
  $('mapstyle').onchange = e => { tstyle = e.target.value; if (tstyle === 'longdo' && !longdoKey) { tstyle = 'light'; e.target.value = 'light'; $('lyr').hidden = false; $('lyrkey').focus(); return; } if (tstyle !== '3d') try { localStorage.setItem('rail-tiles6', tstyle); } catch (x) {} draw(); }; // 3D is not remembered: the page always starts flat
}

if (TILES) { // start as soon as the probes are in (or after 3.8 s); a better source that answers later takes over
  const ps = Object.keys(SRC).map(probeSrc); let n = 0;
  ps.forEach(p => p.then(() => { if (++n === ps.length) probed = true; if (probed) draw(); }));
  setTimeout(() => { probed = true; draw(); }, 3800);
}

const TH = [10.6, 12.3, 13.6];
var roadsReady = false;
let routeLayers = [], routeG = L.layerGroup().addTo(map);
function draw() {
  const z = map.getZoom(), active = !!st.route, lw = lwAt(z), r = rAt(z);
  applyTiles();
  for (const [lid, g] of Object.entries(lineGroups)) { const on = st.vis.has(lid); if (on !== g._on) { g._on = on; on ? g.addTo(map) : g.remove(); } }
  const op = active ? .5 : 1;
  for (const x of lineEls) { x.o.setStyle({ weight: lw + 5, opacity: op }); x.c.setStyle({ weight: lw + 2.5, opacity: op }); x.l.setStyle({ weight: lw, opacity: op }); }
  const rset = active ? new Set(st.route.path) : null;
  for (const d of dotEls) { const dim = active && !rset.has(d.id); d.dot.setStyle({ radius: d.big ? r + 1.8 : r, opacity: dim ? .35 : 1, fillOpacity: dim ? .35 : 1 }); }
  const keep = new Set(); if (st.route) st.route.legs.forEach(l => { keep.add(NODES[l.from].place); keep.add(NODES[l.to].place); });
  if (st.from) keep.add(st.from); if (st.to) keep.add(st.to);
  for (const x of labEls) {
    const any = x.p.nodes.some(i => st.vis.has(NODES[i].line)), show = any && st.names && (keep.has(x.p.id) || z >= TH[placeTier[x.p.id] ?? 2]);
    if (show !== x.on) { x.on = show; show ? x.m.addTo(map) : x.m.remove(); }
  }
  for (const x of LM) { const show = !TILES && z >= 11.5; if (show !== x.on) { x.on = show; show ? x.m.addTo(map) : x.m.remove(); } }
  for (const x of routeLayers) x.set(lw);
  for (const x of waveLayers) x.set(lw);
  if (roadsReady) { roadsSync(); v3Sync(); }
}
map.on('zoomend', draw);
map.on('click', e => { $('stcard').hidden = true; dropPin(e.latlng.lat, e.latlng.lng); });
function accPts(r, w) { // origin/destination → station along the real road when we have it
  const A = r.acc && r.acc[w]; if (!A || !A.pt) return null;
  const p = [A.pt.lat, A.pt.lng], s = ll(w === 'o' ? r.path[0] : r.path[r.path.length - 1]), mid = A.road && A.road.pts ? A.road.pts : [];
  return w === 'o' ? [p, ...mid, s] : [s, ...mid, p];
}
let waveLayers = [];
function setRoute(r, quiet) {
  if (typeof simStop === 'function' && !(r && r === st.route)) simStop();
  st.route = r; routeG.clearLayers(); routeLayers = []; waveLayers = [];
  if (r) {
    const seq = []; // the whole journey in travel order, for the wave
    const add = pts => { for (const q of pts) { const l = seq[seq.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seq.push(q); } };
    const dashLine = pts => { // walking / bus / taxi legs: blue dots on a white casing, readable on any map colour
      const o = { pane: 'route', interactive: false, lineCap: 'round', lineJoin: 'round', noClip: true };
      const c = L.polyline(pts, { ...o, color: '#fff', className: 'rt-acc-c' }), l = L.polyline(pts, { ...o, color: '#1556d6', className: 'rt-acc', dashArray: '.5 9' });
      routeG.addLayer(c); routeG.addLayer(l); routeLayers.push({ set: () => { c.setStyle({ weight: 10, opacity: .92 }); l.setStyle({ weight: 5.5 }); } }); };
    const mk = (ids, color, dash) => {
      const pts = dash ? ids.map(ll) : trackLL(ids), base = { pane: 'route', interactive: false, lineCap: 'round', lineJoin: 'round', noClip: true };
      add(pts);
      if (dash) { dashLine(pts); return; }
      const c = L.polyline(pts, { ...base, color: '#E24A14', className: 'rt-c' }), l = L.polyline(pts, { ...base, color });
      routeG.addLayer(c); routeG.addLayer(l);
      routeLayers.push({ set: lw => { c.setStyle({ weight: lw + 7 }); l.setStyle({ weight: lw + 1 }); } });
    };
    const po = accPts(r, 'o'), pd = accPts(r, 'd');
    if (po) { add(po); dashLine(po); }
    r.legs.forEach(lg => { lg.before.forEach(x => mk([x.from, x.to], null, true)); mk(lg.nodes, LINES[lg.line].color, false); });
    r.endWalk.forEach(x => mk([x.from, x.to], null, true));
    if (pd) { add(pd); dashLine(pd); }
    // travelling wave, origin → destination
    if (seq.length > 1) {
      const g = L.polyline(seq, { pane: 'wave', interactive: false, lineCap: 'round', lineJoin: 'round', color: '#fff', className: 'rt-wave glow', dashArray: '70 230', noClip: true });
      const k = L.polyline(seq, { pane: 'wave', interactive: false, lineCap: 'round', lineJoin: 'round', color: '#fff', className: 'rt-wave core', dashArray: '16 284', noClip: true });
      routeG.addLayer(g); routeG.addLayer(k);
      waveLayers.push({ set: lw => { g.setStyle({ weight: lw + 5 }); k.setStyle({ weight: Math.max(2.5, lw * .55) }); } });
    }
    const aO = r.acc && r.acc.o.pt, aD = r.acc && r.acc.d.pt, pO = aO ? [aO.lat, aO.lng] : ll(r.path[0]), pD = aD ? [aD.lat, aD.lng] : ll(r.path[r.path.length - 1]);
    const pin = (pos, label, cls) => routeG.addLayer(L.marker(pos, { pane: 'labels', interactive: false, keyboard: false, icon: L.divIcon({ className: 'pin ' + cls, html: label, iconSize: [24, 24], iconAnchor: [12, 12] }) }));
    pin(pO, 'A', 'pa'); if (!aD) pin(pD, 'B', 'pb');
    for (const w of ['o', 'd']) { // station exit that leads to the origin / destination
      const A = r.acc && r.acc[w]; if (!A || !A.pt || !A.st) continue;
      const ex = exitInfo(A.st.place, A.pt);
      if (ex.ll) routeG.addLayer(L.marker([ex.ll.lat, ex.ll.lng], { pane: 'labels', interactive: false, keyboard: false, icon: L.divIcon({ className: 'exmk', html: '<span>ทางออก ' + esc(ex.ref) + '</span>', iconSize: [0, 0], iconAnchor: [-4, 8] }) }));
    }
    if (!quiet) fitTo(r.path.concat(aO ? [pO] : [], aD ? [pD] : []), 48);
  }
  drawEnds(); draw();
}
function fitTo(ids, pad) {
  if (!map.getSize().x) { st.pendingFit = ids; return; }
  const b = L.latLngBounds(ids.map(x => Array.isArray(x) ? x : ll(x)));
  map.fitBounds(b, { paddingTopLeft: [pad, pad + 118], paddingBottomRight: [pad, pad], maxZoom: 16, animate: false });
  draw();
}
const fitAll = () => fitTo(ALL, 16);
$('zin').onclick = () => V3.on ? V3.map.zoomIn() : map.zoomIn(); $('zout').onclick = () => V3.on ? V3.map.zoomOut() : map.zoomOut();
$('names').onclick = e => { st.names = !st.names; e.currentTarget.setAttribute('aria-pressed', String(st.names)); draw(); };
$('fit').onclick = () => {
  if (V3.on && V3.ready) { const ids = st.route ? st.route.path : ALL, b = ids.reduce((a, id) => a.extend([NODES[id].lng, NODES[id].lat]), new maplibregl.LngLatBounds()); V3.map.fitBounds(b, { padding: { top: 150, left: 40, right: 40, bottom: 60 }, pitch: 60, bearing: -17, maxZoom: 15 }); return; }
  fitAll(); if (st.route) fitTo(st.route.path, 48);
};
let sized = false;
function onSize() {
  if (!wrap.getBoundingClientRect().width) return;
  map.invalidateSize({ animate: false });
  if (!sized) { sized = true; st.pendingFit = false; fitAll(); if (st.route) fitTo(st.route.path, 48); }
  else if (st.pendingFit) { const ids = st.pendingFit; st.pendingFit = false; fitTo(ids, 48); }
  draw();
}
new ResizeObserver(onSize).observe(wrap);

/* line chips */
$('chips').innerHTML = Object.entries(LINES).map(([lid, L]) => `<button class="lchip" data-l="${lid}" aria-pressed="true" title="${esc(L.th)}"><i class="dot" style="background:${L.color}"></i>${esc(L.short)}</button>`).join('');
$('chips').addEventListener('click', e => {
  const b = e.target.closest('.lchip'); if (!b) return;
  const lid = b.dataset.l, on = !st.vis.has(lid); on ? st.vis.add(lid) : st.vis.delete(lid);
  b.setAttribute('aria-pressed', String(on)); draw();
});

/* station card */
function showStation(pid) {
  const p = PLBY[pid], { minute, weekend } = bkk(), c = $('stcard');
  const rows = p.nodes.map(id => {
    const n = NODES[id], L = LINES[n.line], hw = headway(n.line, minute, weekend);
    return `<div class="ln">${lineChip(n.line, n.code)}<span>รถมาทุก ~${hw % 1 ? hw.toFixed(1) : hw} นาที · ${fmt(L.hours[0])}–24:00</span><span class="hint">ปลายทาง ${esc(L.fwd || 'ท่าพระ / หลักสอง')} · ${esc(L.back || 'วงแหวนสายสีน้ำเงิน')}</span></div>`;
  }).join('');
  c.innerHTML = `<button class="x" aria-label="ปิด">×</button><div><h3>${esc(p.th)}</h3><div class="en">${esc(p.en)}</div></div>${rows}${exitListHTML(pid)}${nearbyHTML(pid)}<p class="hint">ความถี่เป็นค่าประมาณตามช่วงเวลา ยังไม่ใช่ตำแหน่งรถสด</p><div class="acts"><button class="btn" data-a="from">ต้นทาง</button><button class="btn primary" data-a="to">ปลายทาง</button></div>${ext(gmapPlace(p.nodes[0]), 'เปิดใน Google Maps')}`;
  c.dataset.pid = pid; c.hidden = false;
}
$('stcard').addEventListener('click', e => {
  if (e.target.closest('.x')) { $('stcard').hidden = true; return; }
  const b = e.target.closest('[data-a]'); if (!b) return;
  const pid = $('stcard').dataset.pid;
  setEnd(b.dataset.a === 'from' ? 'from' : 'to', { place: pid }, false); $('stcard').hidden = true; if (!hasEnds()) setPane('plan');
});

/* Google Maps links (open in a new tab; the page itself cannot embed Google Maps) */
function gq(id) {
  const n = NODES[id];
  return encodeURIComponent(n.approx ? 'สถานี' + n.th + ' ' + LINES[n.line].th : n.lat + ',' + n.lng);
}
const gmapDir = (o, d, mode) => `https://www.google.com/maps/dir/?api=1&origin=${gq(o)}&destination=${gq(d)}&travelmode=${mode}`;
const gmapPlace = id => `https://www.google.com/maps/search/?api=1&query=${gq(id)}`;
const ext = (href, text) => `<a class="btn lnk" href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;

/* ---------- planner ---------- */
const setEnd = (w, sel, typing) => { // w: 'from' | 'to'
  const P = w + 'Pt'; st[w] = null; st[P] = null;
  if (typing || !sel) return;
  if (sel.place) st[w] = sel.place; else st[P] = sel.pt;
  syncInputs(); if (hasEnds()) go(); else { st.plan = null; st.sel = null; setRoute(null); $('results').innerHTML = pendingHTML(); }
};
const pf = picker($('from'), $('fromList'), (sel, typing) => setEnd('from', sel, typing));
const pt = picker($('to'), $('toList'), (sel, typing) => setEnd('to', sel, typing));
function syncInputs() { st.fromPt ? $('from').value = '📍 ' + st.fromPt.name : pf.set(st.from); st.toPt ? $('to').value = '📍 ' + st.toPt.name : pt.set(st.to); drawEnds(); }
let endMk = []; // A / B markers for the ends that are chosen while there is no route yet
function drawEnds() {
  endMk.forEach(m => m.remove()); endMk = []; if (st.route) return;
  for (const [w, cls, lab] of [['from', 'pa', 'A'], ['to', 'pb', 'B']]) {
    const pl = st[w], pp = st[w + 'Pt'], pos = pl ? ll(PLBY[pl].nodes[0]) : pp ? [pp.lat, pp.lng] : null; if (!pos) continue;
    if (w === 'to' && pp && st.dest && Math.abs(st.dest.lat - pp.lat) < 1e-7 && Math.abs(st.dest.lng - pp.lng) < 1e-7) continue; // the pin itself is already there
    endMk.push(L.marker(pos, { pane: 'labels', interactive: false, keyboard: false, icon: L.divIcon({ className: 'pin ' + cls, html: lab, iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(map));
  }
}
const pendingHTML = () => { const f = !!(st.from || st.fromPt); return `<div class="card empty"><b>เลือก${f ? 'ต้นทาง' : 'ปลายทาง'}แล้ว</b><span>แตะบนแผนที่หรือค้นหาเพื่อเลือก${f ? 'ปลายทาง' : 'ต้นทาง'}ต่อ</span></div>`; };
const hasEnds = () => (st.from || st.fromPt) && (st.to || st.toPt);
$('swap').onclick = () => { [st.from, st.to] = [st.to, st.from]; [st.fromPt, st.toPt] = [st.toPt, st.fromPt]; syncInputs(); if (hasEnds()) go(); };
function nowMinute() { const d = new Date(Date.now() + 7 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60; }
function setDefaultTime() { const t = bkk(); $('time').value = fmt(t.minute); $('day').value = t.weekend ? 'we' : 'wd'; }
$('now').onclick = () => { st.live = !st.live; if (st.live) setDefaultTime(); syncLive(); if (hasEnds()) go({ keep: true }); }; // toggles: on = follows the clock, off = keeps the time shown
$('time').addEventListener('input', () => { st.live = false; syncLive(); });
$('day').addEventListener('change', () => { st.live = false; syncLive(); });
function syncLive() { $('now').classList.toggle('on', !!st.live); $('now').setAttribute('aria-pressed', String(!!st.live)); $('now').textContent = st.live ? '● ตอนนี้ (สด)' : '○ ตอนนี้ (ปิด)'; }
$('planner').addEventListener('submit', e => { e.preventDefault(); go(); });

const EMPTY = '<div class="card empty"><b>ยังไม่ได้เลือกต้นทางและปลายทาง</b><span>พิมพ์ชื่อสถานี ห้าง หรือสถานที่ในช่องด้านบน แตะสถานีบนแผนที่ หรือแตะจุดใดก็ได้บนแผนที่เพื่อปักหมุด</span></div>';
const PICKS = [['cheapest', 'ถูกที่สุด'], ['fastest', 'เร็วที่สุด'], ['fewest', 'เปลี่ยนสายน้อยสุด'], ['value', 'คุ้มค่าที่สุด']];
const sigOf = r => r.path.join() + '|' + (r.acc ? [r.acc.o.st && r.acc.o.st.place, r.acc.d.st && r.acc.d.st.place, r.acc.o.opt.mode, r.acc.d.opt.mode].join() : '');
function go(opt) {
  const out = $('results');
  if (!hasEnds()) { out.innerHTML = '<div class="err">เลือกต้นทางและปลายทาง (สถานี สถานที่ หรือปักหมุดบนแผนที่) ก่อน</div>'; return; }
  if (!st.fromPt && !st.toPt && st.from === st.to) { out.innerHTML = '<div class="err">ต้นทางและปลายทางเป็นสถานีเดียวกัน</div>'; return; }
  let minute; const weekend = $('day').value === 'we';
  if (st.live) { setDefaultTime(); minute = nowMinute(); } else { const [h, m] = ($('time').value || '09:00').split(':').map(Number); minute = h * 60 + m; }
  if (!useRail()) { st.plan = null; st.sel = null; setRoute(null); out.innerHTML = trAltHTML(true) || '<div class="err">โหมดนี้ใช้ได้ในไฟล์เดี่ยว (Next-Route.html) เท่านั้น</div>'; trAltFill(); return; }
  const keep = opt && opt.keep && st.sel ? sigOf(st.sel) : null, keepPick = opt && opt.keep ? st.selKey : null;
  syncLive();
  const plan = (st.fromPt || st.toPt) ? planPoints(minute, weekend) : planRoutes(st.from, st.to, minute, weekend, Date.now());
  if (!plan || plan.err) { out.innerHTML = `<div class="err">${plan && plan.err ? plan.err : 'ไม่พบเส้นทางระหว่างสองจุดนี้ด้วยโครงข่ายรถไฟฟ้า'}</div>` + trAltHTML(true); trAltFill(); setRoute(null); st.plan = null; return; }
  plan.minute = minute; st.plan = plan; st.selKey = 'cheapest'; st.sel = plan.picks.cheapest;
  if (keepPick && plan.picks[keepPick] && keep === null) { st.selKey = keepPick; st.sel = plan.picks[keepPick]; }
  if (keep) { const f = plan.routes.find(r => sigOf(r) === keep); if (f) { st.sel = f; st.selKey = keepPick; } }
  renderResults();
}
function chain(r) { return r.legs.map(l => `<i style="background:${LINES[l.line].color}"></i>`).join(''); }
function renderResults(opt) {
  const quiet = !!(opt && opt.quiet), { picks, routes } = st.plan, r = st.sel;
  const PK = PICKS.map(([k, l]) => [k, k === 'fewest' && r.acc ? 'สะดวกที่สุด' : l]);
  const tags = new Map(); PK.forEach(([k, label]) => { const x = picks[k]; tags.set(x, (tags.get(x) || []).concat(label)); });
  if (quiet && $('detail')) { $('detail').innerHTML = detail(r, tags.get(r) || []); setRoute(r, true); fillBus(); return; }
  $('results').innerHTML = `<div class="picks" role="group" aria-label="เรียงตามความคุ้มค่า"${new Set(PK.map(([k]) => picks[k])).size === 1 ? ' style="grid-template-columns:1fr"' : ''}>${PK.filter(([k]) => PK.findIndex(([k2]) => picks[k2] === picks[k]) === PK.findIndex(([k2]) => k2 === k)).map(([k]) => { const x = picks[k], label = (tags.get(x) || []).join(' · '); return `<button class="pick" data-k="${k}" aria-pressed="${x === r}"><span class="tag">${label}</span><span class="big">${Math.round(x.total)} นาที · ฿${x.fare.total}</span><span class="sub">เปลี่ยนสาย/ขบวน ${x.transfers} ครั้ง</span><span class="chain">${chain(x)}</span></button>`; }).join('')}</div>
  <div class="card detail" id="detail">${detail(r, tags.get(r) || [])}</div>
  <details class="card alts notes"><summary>เส้นทางอื่นที่เป็นไปได้ (${routes.length})</summary><ul>${routes.slice().sort((a, b) => a.total - b.total).slice(0, 14).map((x, i) => `<li><button data-i="${routes.indexOf(x)}"><span class="chain" style="display:flex;gap:3px">${chain(x)}</span><span>${Math.round(x.total)} นาที · ฿${x.fare.total} · ต่อ ${x.transfers}</span></button></li>`).join('')}</ul></details>${trAltHTML(false)}`;
  setRoute(r, quiet);
  fillBus(); trAltFill(); ensureRoad(r);
}
$('results').addEventListener('click', e => {
  const pk = e.target.closest('.pick'); if (pk) { st.selKey = pk.dataset.k; st.sel = st.plan.picks[pk.dataset.k]; renderResults(); return; }
  const al = e.target.closest('.alts li button'); if (al) { st.selKey = null; st.sel = st.plan.routes[+al.dataset.i]; renderResults(); return; }
  if (e.target.closest('[data-showmap]')) setPane('map');
  if (e.target.closest('[data-sim]')) { setPane('map'); const r = st.sel; Promise.race([ensureRoad(r), new Promise(k => setTimeout(k, 2500))]).then(() => setTimeout(() => st.sel === r && simStart(r), 300)); }
});
function dirText(lg) {
  const L = LINES[lg.line];
  if (!L.fwd) return NODES[lg.nodes[1]].th;
  const p = L.paths[0]; return p.indexOf(lg.to) > p.indexOf(lg.from) ? L.fwd : L.back;
}
const GATE = { out: 'ออกจากเขตชำระเงินแล้วแตะบัตรใหม่ที่อีกฝั่ง', in: 'ไม่ต้องออกจากเขตชำระเงิน' };
/* Interchange card: which platform to alight at, where to walk, which exit, which platform to wait at. */
function xferInfo(x, lg, prev) {
  const f = NODES[x.from], t = NODES[x.to], inf = x.info || {}, same = f.place === t.place;
  const pn = prev && prev.nodes.length > 1 ? prev.nodes[prev.nodes.length - 2] : null, nn = lg.nodes[1];
  const al = pn && inf.al ? inf.al[x.from + '|' + pn] : null, bd = inf.bd ? inf.bd[x.to + '|' + nn] : null;
  const sameLine = prev && prev.line === lg.line;
  const alT = al ? `${al.lv} · ${al.t}` : (prev ? `ฝั่งที่ขบวน${LINES[prev.line].short}จอด (รถไปทาง ${dirText(prev)})` : '');
  const bdT = bd ? `${bd.lv} · ${bd.t}` : `ฝั่งไปทาง ${dirText(lg)} (ดูป้ายปลายทางเหนือชานชาลา)`;
  const lvl = al && bd ? (al.lv === bd.lv ? (inf.cross ? 'ชานชาลาเดียวกัน ข้ามไปอีกฝั่งของเกาะชานชาลา' : 'ชั้นเดียวกัน') : `เปลี่ยนจาก${al.lv}ไป${bd.lv}`) : '';
  const exitT = inf.exit || 'ตามป้ายสถานีเชื่อมต่อ', verified = !!(inf.ver || al || bd);
  const head = prev ? (sameLine && same ? `เปลี่ยนขบวนที่สถานี${f.th}` : `เปลี่ยนสายที่สถานี${f.th}${same ? '' : ' → ' + t.th}`) : `เดินไปสถานี${t.th}`;
  return { x, f, t, inf, same, al, bd, alT, bdT, lvl, exitT, verified, head, prev, lg, sameLine };
}
function xferHTML(x, lg, prev, compact) {
  const q = xferInfo(x, lg, prev), inf = q.inf, row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
  const steps = [];
  if (prev) steps.push(`<b>ลงจากรถ</b> ${lineChip(prev.line, NODES[prev.to].code)} ที่สถานี${esc(q.f.th)} — <b class="pf">${esc(q.alT)}</b>`);
  steps.push(`<b>เดิน</b> ~${x.walk} นาที · ${esc(x.note)}${q.lvl ? ` · <b>${esc(q.lvl)}</b>` : ''}`);
  steps.push(`<b>ทางออก / ทางเชื่อม</b> <span class="xexit">${esc(q.exitT)}</span>`);
  steps.push(`<b>ตั๋ว</b> ${esc(GATE[inf.gate] || 'ตามป้ายในสถานี')}`);
  steps.push(`<b>ไปรอรถ</b> ${lineChip(lg.line, NODES[lg.from].code)} — <b class="pf">${esc(q.bdT)}</b> · รถมาทุก ~${Math.round(lg.hw)} นาที`);
  return `<div class="xfer2${q.verified ? '' : ' unv'}"><div class="xh">${esc(q.head)}</div>
    ${prev ? `<div class="xflow"><div><small>ลงที่</small><b>${esc(q.al ? q.al.t.split(' (')[0] : 'ชานชาลาที่รถจอด')}</b><span>${esc(q.al ? q.al.lv : '')}</span></div><i>➜</i><div class="to"><small>ขึ้นที่</small><b>${esc(q.bd ? q.bd.t.split(' (')[0] : 'ชานชาลา ' + dirText(lg))}</b><span>${esc(q.bd ? q.bd.lv : '')}</span></div></div>` : ''}
    <ol class="xsteps">${steps.map(t => `<li>${t}</li>`).join('')}</ol>
    ${compact ? '' : `<dl>${row('รายละเอียด', esc(inf.how || ''))}${row('หมายเหตุ', esc(inf.cross || ''))}</dl>`}
    ${q.verified ? '' : '<p class="hint">เลขชานชาลาและเลขทางออกของจุดนี้ยังไม่มีในแหล่งข้อมูลที่ตรวจสอบได้ ให้ยึดป้ายในสถานี</p>'}
    ${compact ? '' : ext(gmapDir(x.from, x.to, 'walking'), 'ดูทางเดินใน Google Maps')}</div>`;
}
function briefHTML(r) { // one line per step: what to do, which platform / exit — the long version is behind the "ขั้นตอนละเอียด" dropdown
  const rows = [], A = r.acc && r.acc.o, D = r.acc && r.acc.d;
  const accRow = (X, first) => { if (!X || !X.pt) return; const stN = PLBY[X.st.place], ex = exitInfo(X.st.place, X.pt), o = X.opt, how = o.mode === 'walk' ? 'เดิน' : o.label;
    rows.push(first ? ['🚶', `<b>${esc(X.pt.name)}</b> → ${esc(how)} ~${Math.round(o.min)} นาที → สถานี${esc(stN.th)} <b class="pf">${esc(ex.txt)}</b>`] : ['🚶', `ออกสถานี${esc(stN.th)} <b class="pf">${esc(ex.txt)}</b> → ${esc(how)} ~${Math.round(o.min)} นาที → <b>${esc(X.pt.name)}</b>`]); };
  accRow(A, true);
  r.legs.forEach((lg, i) => {
    if (i) { const x = lg.before[0]; if (x) { const q = xferInfo(x, lg, r.legs[i - 1]);
      rows.push(['🔄', `เปลี่ยนที่ <b>${esc(q.f.th)}</b> · ลง ${esc(q.al ? q.al.t.split(' (')[0] + ' ' + q.al.lv : 'ชานชาลาที่รถจอด')} → ขึ้น <b class="pf">${esc(q.bd ? q.bd.t.split(' (')[0] + ' ' + q.bd.lv : 'ฝั่งไป' + dirText(lg))}</b> · ทางออก: ${esc(q.exitT)} · เดิน ~${x.walk} นาที`]); } }
    rows.push(['🚇', `${lineChip(lg.line, NODES[lg.from].code)} <b>${esc(NODES[lg.from].th)}</b> → <b>${esc(NODES[lg.to].th)}</b> · ไปทาง ${esc(dirText(lg))} · ${lg.hops} สถานี ${Math.round(lg.ride)} นาที · ${fmt(lg.board)}–${fmt(lg.alight)}`]);
  });
  r.endWalk.forEach(x => rows.push(['🚶', `เดิน ~${x.walk} นาที จาก ${esc(NODES[x.from].th)} ไป ${esc(NODES[x.to].th)}`]));
  accRow(D, false);
  return `<ol class="brief">${rows.map(([ic, t]) => `<li><span class="bi">${ic}</span><span>${t}</span></li>`).join('')}</ol>`;
}
function xferBrief(r) {
  const out = [];
  r.legs.forEach((lg, i) => { if (!i) return; const x = lg.before[0]; if (!x) return; const q = xferInfo(x, lg, r.legs[i - 1]);
    out.push(`<li><b>${esc(q.f.th)}</b>: ลง <b>${esc(q.al ? q.al.t.split(' (')[0] + ' ' + q.al.lv : 'ชานชาลาที่รถจอด')}</b> → ขึ้น <b>${esc(q.bd ? q.bd.t.split(' (')[0] + ' ' + q.bd.lv : dirText(lg))}</b> · ทางออก: ${esc(q.exitT)}</li>`); });
  return out.length ? `<div class="xbrief"><h3>จุดเปลี่ยนสาย ${out.length} จุด</h3><ol>${out.join('')}</ol></div>` : '';
}
const endName = (r, w) => r.acc && r.acc[w].pt ? r.acc[w].pt.name : NODES[w === 'o' ? r.path[0] : r.path[r.path.length - 1]].th;
const arriveOf = r => r.arrive != null ? r.arrive : r.legs[r.legs.length - 1].alight + r.endWalk.reduce((s, x) => s + x.walk, 0);
function detail(r, tags) {
  const f = r.fare, first = r.legs[0], last = r.legs[r.legs.length - 1];
  let h = `<div class="badges">${tags.map(t => `<span class="badge">${t}</span>`).join('')}</div>
  <h2>${esc(endName(r, 'o'))} → ${esc(endName(r, 'd'))}</h2>
  <div class="sum"><span>${st.live ? '<span class="live">● สด</span> ' : ''}ถึงโดยประมาณ <b>${fmt(arriveOf(r))}</b></span><span>รวม <b>${Math.round(r.total)} นาที</b></span><span>นั่งรถ ${Math.round(r.ride)} · รอ ${Math.round(r.wait)} · เดิน ${Math.round(r.walk)}</span><span>ค่าโดยสาร <b>฿${f.total}</b></span></div>`;
  if (r.warns.length) h += `<div class="warn">เวลาออกเดินทางนี้อยู่นอกช่วงเปิดให้บริการของสาย ${esc([...new Set(r.warns)].join(', '))}</div>`;
  h += briefHTML(r) + '<details class="more"><summary>ขั้นตอนละเอียด (ชานชาลา ทางออก สถานีระหว่างทาง ทางเดิน)</summary><div class="steps">' + accessHTML(r, 'o');
  r.legs.forEach((lg, i) => {
    const L = LINES[lg.line], mid = lg.nodes.slice(1, -1);
    lg.before.forEach(x => { h += xferHTML(x, lg, i ? r.legs[i - 1] : null); });
    h += `<div class="leg" style="--c:${L.color}"><div class="lhead">${lineChip(lg.line, NODES[lg.from].code)}<b>ขึ้นที่ ${esc(NODES[lg.from].th)}</b></div>
      <div class="lmeta">${fmt(lg.board)} · ${esc(L.th)} ทิศ ${esc(dirText(lg))}<br>รอรถ ≤ ${Math.round(lg.hw)} นาที (เฉลี่ย ~${Math.round(lg.wait)}) · นั่ง ${lg.hops} สถานี ${Math.round(lg.ride)} นาที</div>
      ${mid.length ? `<details><summary>สถานีระหว่างทาง ${mid.length} สถานี</summary><ol>${mid.map(id => `<li>${esc(NODES[id].th)} <span class="code">${esc(NODES[id].code)}</span></li>`).join('')}</ol></details>` : ''}
      <div class="lend">${fmt(lg.alight)} ลงที่ ${esc(NODES[lg.to].th)} <span class="code">${esc(NODES[lg.to].code)}</span></div></div>`;
  });
  r.endWalk.forEach(x => { h += `<div class="walk">เดิน ~${x.walk} นาที จาก ${esc(NODES[x.from].th)} ไป ${esc(NODES[x.to].th)}<br>${esc(x.note)}</div>`; });
  h += accessHTML(r, 'd') + '</div></details><details class="more"><summary>ค่าโดยสารรายสาย</summary><div class="fare">';
  f.groups.forEach(g => { h += `<div class="row"><span>${esc(g.label)}${g.access ? '' : ' · ' + g.hops + ' สถานี'}<small>${[g.note, ...g.adj].filter(Boolean).map(esc).join(' · ')}</small></span><span>฿${g.fare}</span></div>`; });
  h += `<div class="row tot"><span>รวมโดยประมาณ</span><span>฿${f.total}</span></div></div></details><div class="btnrow"><button class="btn primary" data-sim type="button">▶ จำลองการเดินทาง</button><button class="btn" data-showmap type="button">ดูเส้นทางบนแผนที่</button>${ext(gmapDir(r.path[0], r.path[r.path.length - 1], 'transit'), 'เทียบกับ Google Maps')}</div>`;
  return h;
}

/* ---------- panes, theme ---------- */
function setPane(p) {
  document.querySelector('.main').dataset.pane = p;
  $('tabPlan').setAttribute('aria-selected', String(p === 'plan')); $('tabMap').setAttribute('aria-selected', String(p === 'map'));
  if (p === 'map') requestAnimationFrame(onSize);
}
$('tabPlan').onclick = () => setPane('plan'); $('tabMap').onclick = () => setPane('map');
const THEMES = ['auto', 'light', 'dark'], TL = { auto: 'ธีม: อัตโนมัติ', light: 'ธีม: สว่าง', dark: 'ธีม: มืด' };
let theme = 'auto'; try { theme = localStorage.getItem('rail-theme') || 'auto'; } catch (e) {}
function applyTheme() { theme === 'auto' ? document.documentElement.removeAttribute('data-theme') : document.documentElement.setAttribute('data-theme', theme); $('theme').textContent = TL[theme]; draw(); }
$('theme').onclick = () => { theme = THEMES[(THEMES.indexOf(theme) + 1) % 3]; try { localStorage.setItem('rail-theme', theme); } catch (e) {} applyTheme(); };
applyTheme();

