/* view3d.js: "3D" view. Leaflet cannot tilt, so this opens a second MapLibre GL map (OpenFreeMap "liberty": buildings drawn as 3D blocks)
   with the rail lines, stations and the selected route drawn on it. Standalone file only, and only when OpenFreeMap is reachable. */
const V3 = { on: false, map: null, ready: false, marks: [], key: null };
const v3Empty = { type: 'FeatureCollection', features: [] };
const v3Line = (pts, props) => ({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: pts.map(q => [q[1], q[0]]) } });
function v3Data() {
  const lines = [], stations = [], route = [], acc = [];
  for (const [lid, Ln] of Object.entries(LINES)) if (st.vis.has(lid)) for (const p of Ln.paths) lines.push(v3Line(trackLL(p), { c: Ln.color }));
  for (const [id, n] of Object.entries(NODES)) if (st.vis.has(n.line)) stations.push({ type: 'Feature', properties: { th: n.th, c: LINES[n.line].color, pl: n.place }, geometry: { type: 'Point', coordinates: [n.lng, n.lat] } });
  const r = st.route;
  if (r) {
    r.legs.forEach(lg => { route.push(v3Line(trackLL(lg.nodes), { c: LINES[lg.line].color })); lg.before.forEach(x => acc.push(v3Line([ll(x.from), ll(x.to)], {}))); });
    r.endWalk.forEach(x => acc.push(v3Line([ll(x.from), ll(x.to)], {})));
    for (const w of ['o', 'd']) { const a = accPts(r, w); if (a) acc.push(v3Line(a, {})); }
  }
  return { lines: { type: 'FeatureCollection', features: lines }, stations: { type: 'FeatureCollection', features: stations }, route: { type: 'FeatureCollection', features: route }, acc: { type: 'FeatureCollection', features: acc } };
}
function v3Marks() {
  V3.marks.forEach(m => m.remove()); V3.marks = []; const r = st.route; if (!V3.map || !r) return;
  const add = (pos, label, cls) => { const e = document.createElement('div'); e.className = 'pin ' + cls; e.textContent = label; V3.marks.push(new maplibregl.Marker({ element: e }).setLngLat([pos[1], pos[0]]).addTo(V3.map)); };
  const aO = r.acc && r.acc.o.pt, aD = r.acc && r.acc.d.pt;
  add(aO ? [aO.lat, aO.lng] : ll(r.path[0]), 'A', 'pa'); add(aD ? [aD.lat, aD.lng] : ll(r.path[r.path.length - 1]), 'B', 'pb');
}
function v3Refresh() {
  if (!V3.on || !V3.ready) return; const d = v3Data();
  for (const k of ['lines', 'stations', 'route', 'acc']) { const s = V3.map.getSource('v3' + k); if (s) s.setData(d[k]); }
  V3.map.setPaintProperty('v3stdot', 'circle-opacity', st.route ? .55 : 1);
  v3Marks();
}
function v3Layers() {
  const m = V3.map, d = v3Data();
  for (const k of ['lines', 'stations', 'route', 'acc']) m.addSource('v3' + k, { type: 'geojson', data: d[k] });
  const w = (a, b) => ['interpolate', ['linear'], ['zoom'], 10, a, 17, b];
  m.addLayer({ id: 'v3lc', type: 'line', source: 'v3lines', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': w(4, 14), 'line-opacity': .9 } });
  m.addLayer({ id: 'v3l', type: 'line', source: 'v3lines', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': w(2.4, 9) } });
  m.addLayer({ id: 'v3rc', type: 'line', source: 'v3route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#E24A14', 'line-width': w(7, 19) } });
  m.addLayer({ id: 'v3r', type: 'line', source: 'v3route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': w(3.5, 11) } });
  m.addLayer({ id: 'v3ac', type: 'line', source: 'v3acc', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#fff', 'line-width': 9 } });
  m.addLayer({ id: 'v3a', type: 'line', source: 'v3acc', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#1556d6', 'line-width': 5, 'line-dasharray': [.1, 2] } });
  m.addLayer({ id: 'v3stdot', type: 'circle', source: 'v3stations', paint: { 'circle-radius': w(3, 7), 'circle-color': '#fff', 'circle-stroke-color': ['get', 'c'], 'circle-stroke-width': 2.5 } });
  m.addLayer({ id: 'v3stlab', type: 'symbol', source: 'v3stations', minzoom: 12.5, layout: { 'text-field': ['get', 'th'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-anchor': 'left', 'text-offset': [.9, 0], 'text-optional': true }, paint: { 'text-color': isDarkMap() ? '#e6edf7' : '#1c2733', 'text-halo-color': isDarkMap() ? '#0e1726' : '#fff', 'text-halo-width': 1.6 } });
  m.on('click', 'v3stdot', e => { const f = e.features && e.features[0]; if (f) showStation(f.properties.pl); });
  m.on('mouseenter', 'v3stdot', () => { m.getCanvas().style.cursor = 'pointer'; }); m.on('mouseleave', 'v3stdot', () => { m.getCanvas().style.cursor = ''; });
}
const isDarkMap = () => tileKey() === 'night';
function v3Open() {
  if (V3.on) return; const k = tileKey(), style = 'https://tiles.openfreemap.org/styles/' + (k === 'night' ? 'fiord' : 'liberty'), c = map.getCenter();
  $('map3d').hidden = false; $('map').style.visibility = 'hidden'; V3.on = true; V3.ready = false; V3.key = k;
  try {
    V3.map = new maplibregl.Map({ container: 'map3d', style, center: [c.lng, c.lat], zoom: Math.max(map.getZoom() - 1, 9), pitch: 60, bearing: -17, maxPitch: 75, attributionControl: false });
    V3.map.on('load', () => { try { v3Layers(); V3.ready = true; v3Marks(); } catch (e) { v3Close(true); } });
    V3.map.on('error', e => { if (!V3.ready && e && e.error && /style|404|Failed/i.test(String(e.error.message || e.error))) v3Close(true); });
    $('attr').innerHTML = 'Leaflet | MapLibre GL | OpenFreeMap © OpenMapTiles · ข้อมูลจาก OpenStreetMap · 3D: ลากเมาส์ขวา/สองนิ้ว เพื่อหมุนและเอียง';
  } catch (e) { v3Close(true); }
}
function v3Fallback() { // 3D could not start: go back to the flat light map
  tstyle = 'light'; try { localStorage.setItem('rail-tiles6', 'light'); } catch (e) {} $('mapstyle').value = 'light'; tilesKey = null; draw();
  $('attr').textContent = 'เปิดโหมด 3 มิติไม่ได้ (เบราว์เซอร์ไม่รองรับ WebGL หรือโหลดแผนที่ไม่สำเร็จ) จึงกลับไปโหมดสว่าง';
}
function v3Close(failed, quiet) {
  if (!V3.on) return; V3.on = false; V3.ready = false; V3.marks.forEach(m => m.remove()); V3.marks = [];
  if (V3.map) { try { const c = V3.map.getCenter(), z = V3.map.getZoom(); V3.map.remove(); map.invalidateSize(); map.setView([c.lat, c.lng], z + 1, { animate: false }); } catch (e) {} V3.map = null; }
  $('map3d').hidden = true; $('map').style.visibility = '';
  if (quiet) return;
  if (failed) return v3Fallback();
  tilesKey = null; draw();
}
function v3Sync() { // called from draw(): the 3D map is open exactly while the "3 มิติ" mode is selected; keeps it in step with the route / line toggles
  const want = tstyle === '3d', can = TILES && srcOk.ofm && !!window.maplibregl;
  const o = $('mapstyle').querySelector('option[value="3d"]'); if (o) o.hidden = o.disabled = probed && !can;
  if (!want) { if (V3.on) v3Close(); return; }
  if (!probed) return;
  if (!can) { if (V3.on) v3Close(true); else v3Fallback(); return; }
  if (!V3.on) return v3Open();
  if (tileKey() !== V3.key) { v3Close(false, true); v3Open(); } else v3Refresh();
}
