/* roads.js: Google-Maps-like street + soi lines drawn from OpenStreetMap (standalone file only, style "แผนที่ซอย"). */
const RD = { Z: 15, grp: L.layerGroup(), labs: L.layerGroup(), on: false, key: null, tiles: new Map(), ids: new Set(), ways: [], z: null };
RD.cv1 = L.canvas({ pane: 'osmroads', padding: .4 }); RD.cv2 = L.canvas({ pane: 'osmroads2', padding: .4 }); // casings under, fills over, so junctions look right
// [width in px at zoom 17, colour group: 0 motorway/primary, 1 secondary, 2 minor streets, 3 service/footpaths]
const RD_W = { motorway: [15, 0], trunk: [14, 0], primary: [13, 0], secondary: [11, 1], tertiary: [9, 2], unclassified: [6.5, 2], residential: [6.5, 2], living_street: [5, 2], service: [3.6, 3], pedestrian: [3.6, 3] };
const RD_PAL = { // [fill, casing] per group, for each map style
  light: [['#f9b872', '#d98f3f'], ['#fddc8f', '#e0b84f'], ['#ffffff', '#cfd3d9'], ['#ffffff', '#dfe2e6']],
  dark: [['#58626f', '#2a3039'], ['#4c5561', '#2a3039'], ['#3d4550', '#2a3039'], ['#363d47', '#262b33']],
  night: [['#3d5f8c', '#17263d'], ['#35547d', '#17263d'], ['#2b4468', '#17263d'], ['#243a58', '#15202f']],
};
const rdW = (b, z) => Math.max(1.3, b * Math.pow(2, z - 17)), rdC = w => w + (w > 2.6 ? 2.6 : 1.6);
RD_PAL.bright = RD_PAL.positron = RD_PAL.light;
function rdStyle(w, key, z) { const p = RD_PAL[key][w.g]; w.c.setStyle({ color: p[1], weight: rdC(rdW(w.base, z)) }); w.l.setStyle({ color: p[0], weight: rdW(w.base, z) }); }
function rdAdd(e) {
  if (!e.geometry || e.geometry.length < 2 || RD.ids.has(e.id)) return; RD.ids.add(e.id);
  const t = e.tags || {}, cls = (t.highway || '').replace('_link', ''), spec = RD_W[cls]; if (!spec) return;
  const pts = e.geometry.map(g => [g.lat, g.lon]), link = /_link$/.test(t.highway || ''), base = spec[0] * (link ? .7 : 1), key = RD.key || 'light', z = map.getZoom();
  const o = { interactive: false, lineCap: 'round', lineJoin: 'round' };
  const c = L.polyline(pts, { ...o, pane: 'osmroads', renderer: RD.cv1 }), l = L.polyline(pts, { ...o, pane: 'osmroads2', renderer: RD.cv2 });
  const w = { c, l, base, g: spec[1], pts, name: t['name:th'] || t.name || '', cls, len: 0 }; rdStyle(w, key, z);
  RD.grp.addLayer(c); RD.grp.addLayer(l);
  for (let i = 1; i < pts.length; i++) w.len += kmBetween({ lat: pts[i - 1][0], lng: pts[i - 1][1] }, { lat: pts[i][0], lng: pts[i][1] }) * 1000;
  RD.ways.push(w);
}
const rdTile = (lat, lng) => { const n = 2 ** RD.Z, r = lat * Math.PI / 180; return [Math.floor((lng + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)]; };
const rdBBox = (x, y) => { const n = 2 ** RD.Z, la = t => Math.atan(Math.sinh(Math.PI * (1 - 2 * t / n))) * 180 / Math.PI; return [la(y + 1), x / n * 360 - 180, la(y), (x + 1) / n * 360 - 180]; };
const RD_Q = b => `[out:json][timeout:40];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]["service"!~"^(parking_aisle|driveway|drive-through)$"](${b.map(v => v.toFixed(5)).join(',')});out geom;`;
async function rdLoad() {
  const bb = map.getBounds().pad(.1), a = rdTile(bb.getNorth(), bb.getWest()), c = rdTile(bb.getSouth(), bb.getEast()), want = [];
  for (let x = a[0]; x <= c[0]; x++) for (let y = a[1]; y <= c[1]; y++) { const k = x + ':' + y, s = RD.tiles.get(k); if (!s) want.push([x, y, k]); }
  if (want.length > 20) return;
  for (const [x, y, k] of want) {
    if (RD.tiles.get(k) === 'busy') continue; RD.tiles.set(k, 'busy'); RD.busy++;
    overpass(RD_Q(rdBBox(x, y))).then(j => {
      RD.busy--;
      if (!j) { RD.tiles.set(k, 'fail'); setTimeout(() => RD.tiles.delete(k), 45000); return; }
      RD.tiles.set(k, 'ok'); (j.elements || []).forEach(rdAdd); rdLabels(true);
    });
  }
}
function rdLabels(force) {
  const z = map.getZoom(); RD.labs.clearLayers(); if (!RD.on || z < 16.5) return;
  const b = map.getBounds().pad(.15), c = map.getCenter(), cand = [];
  for (const w of RD.ways) {
    if (!w.name || w.cls === 'service' || w.len < 28 + w.name.length * 3.2) continue;
    const m = w.pts[Math.floor(w.pts.length / 2)], p = L.latLng(m[0], m[1]); if (!b.contains(p)) continue;
    cand.push([p.distanceTo(c), w, p]);
  }
  cand.sort((a, b2) => a[0] - b2[0]); const used = [];
  for (const [, w, p] of cand) {
    if (used.length >= 220) break;
    if (used.some(u => u.name === w.name && u.p.distanceTo(p) < 120)) continue; used.push({ name: w.name, p });
    const i = Math.max(1, Math.floor(w.pts.length / 2)), A = map.project(L.latLng(w.pts[i - 1]), 17), B = map.project(L.latLng(w.pts[i]), 17);
    let ang = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    RD.labs.addLayer(L.marker(p, { pane: 'reflab', interactive: false, keyboard: false, icon: L.divIcon({ className: 'rdl', html: `<span style="transform:translate(-50%,-50%) rotate(${ang.toFixed(1)}deg)">${esc(w.name)}</span>`, iconSize: [0, 0] }) }));
  }
}
function roadsSync() {
  const key = tileKey(), want = TILES && probed && !netOf(key) && !!RD_PAL[key] && map.getZoom() >= 15;
  if (want !== RD.on) { RD.on = want; want ? (RD.grp.addTo(map), RD.labs.addTo(map)) : (RD.grp.remove(), RD.labs.remove()); }
  if (!want) return;
  map.getContainer().dataset.base = key;
  const z = map.getZoom(); if (z !== RD.z || key !== RD.key) { RD.z = z; RD.key = key; for (const w of RD.ways) rdStyle(w, key, z); }
  rdLoad(); rdLabels();
}
map.on('moveend zoomend', roadsSync);
roadsReady = true; roadsSync();
