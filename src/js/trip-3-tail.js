/* ---------- station exits + nearby places (OpenStreetMap, standalone only) ---------- */
const EXIT_KEY = 'rail-exits-v2', POI_KEY = 'rail-pois-v1', BB = '13.45,100.25,14.10,100.90';
let EXITS = null, exitsState = ONLINE ? 'loading' : 'off';
// exit labels that come from the station pages cited in this project (BTS Asok exit 3 leads to MRT Sukhumvit, etc.)
const EXIT_LABELS = { P_E4: { 1: 'ซอยสุขุมวิท 19', 2: 'ซอยสุขุมวิท 12', 3: 'ทางเชื่อมไป MRT สุขุมวิท', 4: 'ซอยสุขุมวิท 14–16 / ถนนรัชดาภิเษก' } };
const ICON = { st: '🚉', poi: '📍', web: '🔎' };
function exitsProcess(j) {
  const out = {};
  for (const e of j.elements || []) {
    if (e.type !== 'node' || !e.tags) continue;
    const t = e.tags, m = /(\d{1,2})\s*([A-Za-z]?)/.exec(t.ref || t['name:th'] || t.name || t['name:en'] || '');
    if (!m) continue;
    const ref = m[1] + m[2].toUpperCase(), pt = { lat: e.lat, lng: e.lon };
    const cand = PL.map(p => [kmBetween(placeLL(p.id), pt), p.id]).filter(x => x[0] < .3).sort((a, b) => a[0] - b[0]);
    for (const [d, id] of cand) if (d - cand[0][0] < .08) {
      const arr = out[id] = out[id] || [];
      if (!arr.some(x => x.ref === ref && Math.abs(x.lat - pt.lat) < 1e-4 && Math.abs(x.lng - pt.lng) < 1e-4)) arr.push({ ref, lat: +pt.lat.toFixed(6), lng: +pt.lng.toFixed(6), name: t['name:th'] || t.name || '' });
    }
  }
  return out;
}
function mergePois(arr) {
  const norm = s => s.toLowerCase().replace(/\s/g, ''), base = POI_N.slice(); // same name within 500 m = the baked place; OSM only refines its position
  for (const [th, en, lat, lng] of arr) {
    const nt = norm(th), old = base.find(p => { const a = norm(p.th); return (a === nt || a.includes(nt) || nt.includes(a)) && kmBetween(p, { lat, lng }) < .5; });
    if (old) { Object.assign(old, { lat, lng, osm: true }); continue; }
    POI_N.push({ th, en, lat, lng, k: norm(th + ' ' + en), osm: true });
  }
}
async function loadExits() {
  if (!ONLINE) return;
  let ok = false;
  try { const c = JSON.parse(localStorage.getItem(EXIT_KEY) || 'null'); if (c && Date.now() - c.t < 30 * 864e5) { EXITS = c.d; ok = true; } } catch (e) {}
  if (!ok) {
    const j = await overpass(`[out:json][timeout:90];(node["railway"="subway_entrance"](${BB});node["railway"="train_station_entrance"](${BB});node["railway"="station"]["entrance"](${BB}););out body;`);
    if (j) { EXITS = exitsProcess(j); ok = true; try { localStorage.setItem(EXIT_KEY, JSON.stringify({ t: Date.now(), d: EXITS })); } catch (e) {} }
  }
  exitsState = ok ? 'ok' : 'fail';
}
async function loadPois() {
  if (!ONLINE) return;
  let arr = null;
  try { const c = JSON.parse(localStorage.getItem(POI_KEY) || 'null'); if (c && Date.now() - c.t < 30 * 864e5) arr = c.d; } catch (e) {}
  if (!arr) {
    const j = await overpass(`[out:json][timeout:120];(nwr["shop"~"^(mall|department_store)$"]["name"](${BB});nwr["tourism"~"^(attraction|museum|zoo|theme_park|gallery|aquarium)$"]["name"](${BB});nwr["amenity"~"^(university|hospital|marketplace)$"]["name"](${BB}););out center tags 4000;`);
    if (!j) return;
    const seen = new Set(); arr = [];
    for (const e of j.elements) {
      const t = e.tags || {}, la = e.lat != null ? e.lat : e.center && e.center.lat, ln = e.lon != null ? e.lon : e.center && e.center.lon, th = t['name:th'] || t.name;
      if (!th || la == null) continue;
      const k = th + Math.round(la * 200) + Math.round(ln * 200); if (seen.has(k)) continue; seen.add(k);
      arr.push([th, t['name:en'] || '', +la.toFixed(5), +ln.toFixed(5)]);
    }
    try { localStorage.setItem(POI_KEY, JSON.stringify({ t: Date.now(), d: arr })); } catch (e) {}
  }
  mergePois(arr);
}
function poisNear(pt, m, k) {
  return POI_N.filter(p => p.osm).map(p => [kmBetween(p, pt) * 1000, p]).filter(x => x[0] <= m).sort((a, b) => a[0] - b[0]).slice(0, k).map(x => x[1]);
}
function exitInfo(placeId, pt) {
  const c = placeLL(placeId), km = kmBetween(c, pt), list = EXITS && EXITS[placeId], dir = compass(c, pt);
  if (list && list.length) {
    const sorted = list.map(x => [kmBetween(x, pt), x]).sort((a, b) => a[0] - b[0]), bd = sorted[0][0], b = sorted[0][1];
    const lab = (EXIT_LABELS[placeId] || {})[b.ref], near = poisNear(b, 170, 3).map(p => p.th);
    const others = [...new Set(sorted.map(x => x[1].ref))].filter(r => r !== b.ref).slice(0, 2);
    return { ref: b.ref, txt: 'ทางออก ' + b.ref, ll: b, dir, src: 'osm',
      sub: `เลือกทางออกที่ใกล้หมุดที่สุด (จากทางออกถึงหมุด ~${fmtKm(bd)})${lab ? ' · ' + lab : ''}${near.length ? ' · ใกล้ ' + near.join(', ') : ''}${others.length ? ' · ทางออกอื่นใกล้เคียง: ' + others.join(', ') : ''} · เลขทางออกจาก OpenStreetMap ตรวจกับป้ายในสถานีอีกครั้ง` };
  }
  const why = exitsState === 'loading' ? 'กำลังโหลดเลขทางออกจาก OpenStreetMap…' : exitsState === 'ok' ? 'สถานีนี้ยังไม่มีข้อมูลทางออกใน OpenStreetMap' : exitsState === 'fail' ? 'โหลดเลขทางออกจาก OpenStreetMap ไม่สำเร็จ' : 'หน้านี้ไม่มีเลขทางออก (เปิดไฟล์เดี่ยวที่ต่ออินเทอร์เน็ต)';
  return { ref: null, ll: null, dir, src: 'dir', txt: km < .12 ? 'ออกทางออกใดก็ได้ (หมุดอยู่ติดสถานี)' : `ทางออกฝั่งทิศ${dir}`,
    sub: `หมุดอยู่ทิศ${dir}ของสถานี ห่าง ~${fmtKm(km)} · ${why} ให้ดูผังทางออกที่ป้ายในสถานีแล้วเลือกฝั่งนี้` };
}
function exitListHTML(pid) {
  const list = EXITS && EXITS[pid]; if (!list || !list.length) return '';
  const byRef = new Map(); for (const x of list) if (!byRef.has(x.ref)) byRef.set(x.ref, x);
  const rows = [...byRef.values()].sort((a, b) => parseInt(a.ref) - parseInt(b.ref) || a.ref.localeCompare(b.ref)).map(x => {
    const lab = (EXIT_LABELS[pid] || {})[x.ref], near = poisNear(x, 170, 2).map(p => p.th);
    return `<li><b>${esc(x.ref)}</b> ${esc([lab, ...near].filter(Boolean).join(' · ') || x.name || '')}</li>`;
  });
  return `<div class="exl"><b>ทางออก (OpenStreetMap)</b><ul>${rows.join('')}</ul></div>`;
}

/* ---------- real road geometry for the legs outside the rail network (OSRM, standalone only) ---------- */
const OSRM = { walk: ['https://routing.openstreetmap.de/routed-foot/route/v1/foot/'], drive: ['https://routing.openstreetmap.de/routed-car/route/v1/driving/', 'https://router.project-osrm.org/route/v1/driving/'] };
const roadMem = {};
function roadGet(a, b, mode) {
  if (!ONLINE) return Promise.resolve(null);
  const k = [mode, a.lat.toFixed(5), a.lng.toFixed(5), b.lat.toFixed(5), b.lng.toFixed(5)].join();
  if (!roadMem[k]) roadMem[k] = (async () => {
    const q = `${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    for (const base of OSRM[mode]) {
      try { const r = await fetch(base + q); if (!r.ok) continue; const j = await r.json(), rt = j.routes && j.routes[0];
        if (rt) return { pts: rt.geometry.coordinates.map(c => [c[1], c[0]]), km: rt.distance / 1000, min: rt.duration / 60 }; } catch (e) {}
    }
    return null;
  })();
  return roadMem[k];
}
function accEnd(A) { const ex = exitInfo(A.st.place, A.pt); return ex.ll ? { lat: ex.ll.lat, lng: ex.ll.lng } : placeLL(A.st.place); }
function ensureRoad(r) { // fetch the real road line for the walk / bus / taxi legs; redraw the map + simulation path when it arrives
  if (!r || !r.acc || !ONLINE) return Promise.resolve();
  const all = [];
  for (const w of ['o', 'd']) {
    const A = r.acc[w]; if (!A.pt) continue;
    if (A.road === undefined) {
      const s = accEnd(A), a = w === 'o' ? A.pt : s, b = w === 'o' ? s : A.pt;
      A.road = null;
      A.roadP = roadGet(a, b, A.opt.mode === 'walk' ? 'walk' : 'drive').then(road => { A.road = road || false; return true; });
    }
    if (A.roadP) all.push(A.roadP);
  }
  const fresh = r.acc.o.roadP && !r.acc.o.shown || r.acc.d.roadP && !r.acc.d.shown;
  return Promise.all(all).then(() => {
    for (const w of ['o', 'd']) r.acc[w].shown = true;
    if (fresh && st.sel === r) renderResults({ quiet: true });
  });
}
function nearbyHTML(pid) { // well-known places around a station, each with the exit that leads to it
  const c = placeLL(pid), rows = POI_N.map(p => [kmBetween(c, p) * 1000, p]).filter(x => x[0] <= 650).sort((a, b) => a[0] - b[0]).slice(0, 6).map(([m, p]) => {
    const ex = exitInfo(pid, p);
    return `<li><b>${esc(p.th)}</b> · ${ex.ref ? '<span class="xexit">ทางออก ' + esc(ex.ref) + '</span>' : 'ทางออกฝั่งทิศ' + esc(compass(c, p))} <small>~${Math.round(m / 10) * 10} ม.</small></li>`;
  });
  return rows.length ? `<div class="exl"><b>สถานที่ใกล้สถานี</b><ul>${rows.join('')}</ul></div>` : '';
}

/* ---------- bus / boat / van / songthaew services for the first and last leg: from the bundled GTFS data (transit.js) ---------- */
function fillBus() { if (typeof trAccessFill === 'function') trAccessFill(); }
function gmapDirLL(a, b, mode) { const q = p => encodeURIComponent(p.lat + ',' + p.lng); return `https://www.google.com/maps/dir/?api=1&origin=${q(a)}&destination=${q(b)}&travelmode=${mode}`; }
function accessHTML(r, w) {
  if (!r.acc) return '';
  const A = r.acc[w]; if (!A.pt) return '';
  const first = w === 'o', stP = A.st.place, stN = PLBY[stP], o = A.opt, km = A.st.km, rk = A.road && A.road.km, sc = placeLL(stP);
  const notNear = A.st.nearest && A.st.place !== A.st.nearest.place, ex = exitInfo(stP, A.pt), ep = ex.ll || sc;
  const link = first ? gmapDirLL(A.pt, ep, 'transit') : gmapDirLL(ep, A.pt, 'transit');
  const dist = rk ? `ระยะตามถนน ~${fmtKm(rk)}` : `ระยะ ~${fmtKm(km)} (เส้นตรง)`;
  const mode = o.mode === 'walk' ? `เดิน ~${Math.round(o.min)} นาที` : `${o.label} ~${Math.round(o.min)} นาที (~฿${o.cost}, ประมาณการ)`;
  const far = km > 15 ? `<li class="farnote">จุดนี้อยู่ไกลจากรถไฟฟ้า (~${fmtKm(km)}) ใช้ได้เฉพาะช่วงจากจุดนี้ไปสถานี ส่วนรถไฟทางไกลจะเพิ่มในอนาคต</li>` : '';
  const kk = (first ? [A.pt.lat, A.pt.lng, ep.lat, ep.lng] : [ep.lat, ep.lng, A.pt.lat, A.pt.lng]).join(',');
  const bus = o.mode !== 'walk' ? `<li><b>รถเมล์ · เรือ · รถตู้ · สองแถว</b> <div class="busbox" ${ONLINE ? `data-k="${kk}"><small>กำลังค้นหาสายรถ…</small>` : '"><small>ค้นหาสายรถได้เฉพาะในไฟล์เดี่ยว (Next-Route.html) ใช้ปุ่ม Google Maps ด้านล่างแทน</small>'}</div></li>` : '';
  const nn = notNear ? ` <small>ไม่ใช่สถานีที่ใกล้ที่สุด (ใกล้สุดคือสถานี${esc(PLBY[A.st.nearest.place].th)} ${fmtKm(A.st.nearest.km)})</small>` : ' · สถานีที่ใกล้ที่สุด';
  const src = A.pt.kind === 'gps' ? 'ตำแหน่งปัจจุบัน' : A.pt.kind === 'home' ? 'บ้าน' : 'จุดที่เลือก';
  if (first) return `<div class="xfer2 acc"><div class="xh">ออกจาก “${esc(A.pt.name)}” ไปขึ้นรถไฟฟ้าที่สถานี${esc(stN.th)}</div>
    <div class="xflow"><div><small>เริ่มที่</small><b>${esc(A.pt.name)}</b><span>${src}</span></div><i>➜</i><div class="to"><small>ขึ้นรถไฟฟ้าที่</small><b>สถานี${esc(stN.th)}</b><span>${esc(stN.codes.join(' · '))}</span></div></div>
    <ol class="xsteps"><li><b>ไปสถานี</b> ${dist} · ${mode}${nn}</li>${far}<li><b>เข้าสถานีทาง</b> <span class="xexit">${esc(ex.txt)}</span> <small>${esc(ex.sub)}</small></li>${bus}</ol>
    ${ext(link, 'ดูเส้นทางไปสถานีใน Google Maps')}</div>`;
  return `<div class="xfer2 acc dest"><div class="xh">ถึงสถานี${esc(stN.th)} → ไป “${esc(A.pt.name)}”</div>
    <div class="xflow"><div><small>ลงรถไฟฟ้าที่</small><b>สถานี${esc(stN.th)}</b><span>${esc(stN.codes.join(' · '))}</span></div><i>➜</i><div class="to"><small>ออกจากสถานีทาง</small><b>${esc(ex.txt)}</b><span>${ex.ref ? 'เลขทางออก ' + esc(ex.ref) : 'ตามทิศของหมุด'}</span></div></div>
    <ol class="xsteps"><li><b>ทางออก</b> <span class="xexit">${esc(ex.txt)}</span> <small>${esc(ex.sub)}</small></li><li><b>จากสถานีถึงหมุด</b> ${dist} · ${mode}${nn}</li>${far}${bus}</ol>
    ${ext(link, 'ดูทางจากสถานีไปหมุดใน Google Maps')}</div>`;
}

/* ---------- search (stations + well-known places + OpenStreetMap geocoder) ---------- */
function localQ(q, ns = 3) {
  const k = q.toLowerCase().replace(/\s/g, ''), out = [];
  for (const p of findPlaces(q).slice(0, ns)) out.push({ t: 'st', name: 'สถานี' + p.th, sub: p.codes.join(' · ') + ' · ' + p.lines.map(l => LINES[l].short).join(', '), place: p.id, ...placeLL(p.id) });
  const hits = POI_N.filter(p => p.k.includes(k)).sort((a, b) => (a.k.startsWith(k) ? 0 : 1) - (b.k.startsWith(k) ? 0 : 1)).slice(0, 6);
  for (const p of hits) out.push({ t: 'poi', name: p.th, sub: (p.en || '') + (p.osm ? '' : ' · ตำแหน่งประมาณ'), lat: p.lat, lng: p.lng, approx: !p.osm });
  return out;
}
async function webQ(q) {
  try {
    const r = await fetch(`https://photon.komoot.io/api/?limit=7&lat=13.75&lon=100.52&bbox=97.3,5.5,105.7,20.5&q=${encodeURIComponent(q)}`), j = await r.json();
    const out = (j.features || []).filter(f => f.geometry).map(f => { const p = f.properties || {}; return { t: 'web', name: p.name || p.street || '', sub: [p.name && p.street ? p.street : '', p.district || p.suburb, p.city || p.county, p.state].filter(Boolean).join(' · '), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }; }).filter(x => x.name);
    if (out.length) return out;
  } catch (e) {}
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=th&accept-language=th&viewbox=97.3,20.5,105.7,5.5&q=${encodeURIComponent(q)}`), j = await r.json();
    return j.map(x => ({ t: 'web', name: x.name || (x.display_name || '').split(',')[0], sub: (x.display_name || '').split(',').slice(1, 4).join(',').trim(), lat: +x.lat, lng: +x.lon }));
  } catch (e) {}
  return [];
}
let sSeq = 0, sTimer = 0;
function searchAll(q, cb, ns) { // cb gets local results at once, then local + online results
  const seq = ++sSeq, loc = localQ(q, ns); cb(loc); clearTimeout(sTimer);
  if (!ONLINE || q.trim().length < 2) return;
  sTimer = setTimeout(async () => {
    const w = (await webQ(q.trim())).filter(x => !loc.some(l => l.name.replace(/^สถานี/, '') === x.name.replace(/^สถานี/, '') && kmBetween(l, x) < .6)); // drop what the local list already has
    if (seq === sSeq && w.length) cb(loc.concat(w).slice(0, 11));
  }, 380);
}
const itemRow = (it, i, sel) => `<li role="option" data-i="${i}" aria-selected="${i === sel}"><span class="ic">${ICON[it.t]}</span><span class="nm">${esc(it.name)}<small>${esc(it.sub || '')}</small></span></li>`;
const asSel = it => it.t === 'st' ? { place: it.place } : { pt: { kind: 'point', name: it.name, lat: it.lat, lng: it.lng } };
async function reverseName(lat, lng) {
  try { const r = await fetch(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`), j = await r.json(), p = j.features && j.features[0] && j.features[0].properties; if (p && (p.name || p.street)) return p.name || p.street; } catch (e) {}
  try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=th&lat=${lat}&lon=${lng}`), j = await r.json(); return j.name || (j.display_name || '').split(',').slice(0, 2).join(' ').trim() || null; } catch (e) {}
  return null;
}

/* ---------- pin + popup ---------- */
let pinMk = null, pinBusy = false; st.dest = null;
const pinIcon = L.divIcon({ className: 'dpin', html: '<span></span>', iconSize: [30, 40], iconAnchor: [15, 38], popupAnchor: [0, -34] });
function removePin() { if (pinMk) { pinMk.remove(); pinMk = null; } st.dest = null; $('qx').hidden = !$('q').value; }
function popupEl() {
  const d = st.dest, el = document.createElement('div'), LBL = { from: 'ต้นทาง', to: 'ปลายทาง' }, role = d.role, other = role === 'from' ? 'to' : 'from', need = role === 'to' && !(st.from || st.fromPt); el.className = 'pp';
  el.innerHTML = `<b class="ppn">${esc(d.name)}</b><small class="ppc">${d.approx ? 'ตำแหน่งประมาณ · ' : ''}${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}</small>
    <div class="pph">${role === 'from' ? 'ใช้จุดนี้เป็นต้นทาง?' : 'ใช้จุดนี้เป็นปลายทาง?'}</div>
    <div class="ppb2"><button type="button" class="pri" data-r="${role}">✓ ใช้เป็น${LBL[role]}</button><button type="button" data-r="${other}">ใช้เป็น${LBL[other]}แทน</button></div>
    ${need ? `<div class="pph">หรือเลือกต้นทางให้เลย:</div>
    <div class="ppb"><button type="button" data-o="gps">📍 ตำแหน่งปัจจุบัน</button><button type="button" data-o="home">🏠 ${home ? 'บ้าน: ' + esc(home.name) : 'บ้าน (ยังไม่ได้ตั้ง)'}</button></div>
    <div class="ppst"><input type="text" placeholder="🔎 ค้นหาต้นทาง: สถานี ห้าง ที่อยู่ ฯลฯ" autocomplete="off" aria-label="ค้นหาต้นทาง"><ul hidden></ul></div>` : ''}
    <div class="ppm"></div><div class="ppx"><button type="button" data-a="sethome">ตั้งจุดนี้เป็นบ้าน</button></div>`;
  const msg = t => { el.querySelector('.ppm').textContent = t; };
  const inp = el.querySelector('input'), ul = el.querySelector('ul'); let items = [];
  const draw = () => { ul.innerHTML = items.map((it, i) => itemRow(it, i, -1)).join(''); ul.hidden = !items.length; };
  if (inp) {
    inp.addEventListener('input', () => { const q = inp.value.trim(); if (!q) { items = []; draw(); return; } searchAll(q, r => { items = r; draw(); }, 5); });
    ul.addEventListener('click', e => { const li = e.target.closest('li'); if (li) setOrigin(asSel(items[+li.dataset.i])); });
  }
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.r) assign(b.dataset.r);
    else if (b.dataset.o === 'gps') {
      if (!navigator.geolocation) return msg('เบราว์เซอร์นี้อ่านตำแหน่งปัจจุบันไม่ได้');
      msg('กำลังอ่านตำแหน่งปัจจุบัน…');
      navigator.geolocation.getCurrentPosition(p => setOrigin({ pt: { kind: 'gps', name: 'ตำแหน่งปัจจุบัน', lat: p.coords.latitude, lng: p.coords.longitude } }), () => msg('อ่านตำแหน่งไม่ได้ ตรวจว่าอนุญาตตำแหน่งให้เบราว์เซอร์แล้ว หรือเลือกสถานี/บ้านแทน'), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
    } else if (b.dataset.o === 'home') {
      if (!home) return msg('ยังไม่ได้ตั้งบ้าน: ปักหมุดที่บ้านแล้วกด "ตั้งจุดนี้เป็นบ้าน"');
      setOrigin({ pt: { kind: 'home', name: home.name, lat: home.lat, lng: home.lng } });
    } else if (b.dataset.a === 'sethome') {
      home = { name: d.name.length > 28 ? d.name.slice(0, 28) + '…' : d.name, lat: d.lat, lng: d.lng }; try { localStorage.setItem(HOME_KEY, JSON.stringify(home)); } catch (x) {}
      msg('บันทึกเป็นบ้านแล้ว'); el.querySelector('[data-o=home]').textContent = '🏠 บ้าน: ' + home.name;
    }
  });
  L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el);
  return el;
}
// the pin becomes the origin or the destination (map taps suggest: nothing chosen → origin first, then destination)
function assign(role) {
  const d = st.dest; if (!d) return;
  d.committed = true; map.closePopup();
  const sel = d.place ? { place: d.place } : { pt: { kind: 'point', name: d.name, lat: d.lat, lng: d.lng } };
  if (role === 'from') removePin();
  setEnd(role, sel, false);
  if (hasEnds() && matchMedia('(max-width:899px)').matches) setPane('plan');
}
function setOrigin(o) {
  const d = st.dest; if (!d) return;
  d.committed = true; map.closePopup();
  if (o.swap) { st.fromPt = o.pt; st.from = null; syncInputs(); $('to').focus(); setPane('plan'); return; }
  if (o.place) { st.from = o.place; st.fromPt = null; } else { st.from = null; st.fromPt = o.pt; }
  if (d.place) { st.to = d.place; st.toPt = null; } else { st.to = null; st.toPt = d; }
  syncInputs(); go();
  if (matchMedia('(max-width:899px)').matches) setPane('plan');
}
function showPin() {
  if (!st.dest) return; pinBusy = true;
  try { pinMk.setLatLng([st.dest.lat, st.dest.lng]).bindPopup(popupEl, { className: 'ppwrap', minWidth: 230, maxWidth: 300, autoPanPaddingTopLeft: [10, 130] }).openPopup(); } finally { pinBusy = false; }
  setTimeout(() => { // safety net: keep the whole popup below the search bar even if the first auto-pan was cut short
    const pop = pinMk && pinMk.getPopup(), el = pop && pop.isOpen() && pop.getElement(); if (!el) return;
    const need = map.getContainer().getBoundingClientRect().top + 125 - el.getBoundingClientRect().top;
    if (need > 4) map.panBy([0, -need], { animate: true });
  }, 400);
}
function dropPin(lat, lng, name, place, approx, role) {
  if (typeof sim !== 'undefined' && sim.on) return;
  role = role || (!(st.from || st.fromPt) ? 'from' : 'to'); // nothing chosen → 1st tap = origin; origin known → destination; only a destination known → origin
  st.dest = { name: name || 'หมุดที่ปักไว้', lat, lng, place: place || null, approx: !!approx, committed: false, role };
  if (!pinMk) pinMk = L.marker([lat, lng], { icon: pinIcon, keyboard: false, zIndexOffset: 900 }).addTo(map);
  showPin(); $('qx').hidden = false;
  if (!name && ONLINE) reverseName(lat, lng).then(n => { if (n && st.dest && st.dest.lat === lat && st.dest.lng === lng) { st.dest.name = n; pinMk.getPopup() && pinMk.getPopup().setContent(popupEl()); } });
  else if (!name) st.dest.name = 'หมุดที่ปักไว้ (ตำแหน่งบนแผนที่)';
}
// closing the popup (the × or tapping the map) without choosing an origin removes the pin again
map.on('popupclose', () => { if (!pinBusy && st.dest && !st.dest.committed) removePin(); });

/* ---------- search island ---------- */
const qEl = $('q'), qList = $('qlist'); let qItems = [], qSel = 0;
function drawQ() {
  qList.innerHTML = qItems.map((it, i) => itemRow(it, i, qSel)).join('');
  qList.hidden = !qItems.length; $('qx').hidden = !qEl.value && !st.dest; qEl.setAttribute('aria-expanded', String(!!qItems.length));
}
qEl.addEventListener('input', () => { const q = qEl.value.trim(); qSel = 0; if (!q) { qItems = []; drawQ(); return; } searchAll(q, r => { qItems = r; drawQ(); }, 3); });
function pickQ(it) {
  qEl.value = it.name; qItems = []; drawQ(); qEl.blur();
  map.setView([it.lat, it.lng], Math.max(map.getZoom(), 16), { animate: true });
  dropPin(it.lat, it.lng, it.name, it.place || null, it.approx, 'to');
}
qEl.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); qSel = (qSel + (e.key === 'ArrowDown' ? 1 : qItems.length - 1)) % Math.max(qItems.length, 1); drawQ(); }
  else if (e.key === 'Enter' && qItems.length) { e.preventDefault(); pickQ(qItems[qSel]); }
  else if (e.key === 'Escape') { qItems = []; drawQ(); }
});
qList.addEventListener('pointerdown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pickQ(qItems[+li.dataset.i]); } });
qEl.addEventListener('blur', () => setTimeout(() => { qItems = []; drawQ(); }, 150));
// × clears the text and the pin; if the pin was the destination, the route goes too
$('qx').onclick = () => {
  qEl.value = ''; qItems = []; map.closePopup();
  const was = st.toPt && st.dest && st.toPt.lat === st.dest.lat && st.toPt.lng === st.dest.lng;
  removePin(); drawQ();
  if (was) { st.toPt = null; syncInputs(); if (!hasEnds()) { st.plan = null; st.sel = null; setRoute(null); $('results').innerHTML = EMPTY; } else go(); }
  qEl.focus();
};
L.DomEvent.disableClickPropagation($('island')); L.DomEvent.disableScrollPropagation($('island'));
function clearAll() {
  st.from = st.to = st.fromPt = st.toPt = null; st.plan = null; st.sel = null;
  map.closePopup(); removePin(); qEl.value = ''; qItems = []; drawQ(); $('stcard').hidden = true;
  syncInputs(); setRoute(null); $('results').innerHTML = EMPTY; fitAll();
}
$('clearall').onclick = clearAll;

/* ---------- live clock: recompute every minute while "now" is on ---------- */
let lastMin = -1;
setInterval(() => {
  if (!st.live || document.hidden || (typeof sim !== 'undefined' && sim.on)) return;
  const m = Math.floor(nowMinute()); if (m === lastMin) return; lastMin = m;
  if (document.activeElement !== $('time')) setDefaultTime();
  if (st.plan && hasEnds()) go({ keep: true });
}, 5000);
if (ONLINE) Promise.all([loadExits(), loadPois()]).then(() => { if (st.plan && st.sel) renderResults({ quiet: true }); });
