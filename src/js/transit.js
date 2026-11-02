/*GTFSDATA*/
/* transit.js: nationwide public-transport data (GTFS, Namtang / สนข.) — map layers (rail, boat, bus, van, songthaew, coach), route finder,
   stop cards, bus / boat lookup for the first and last leg, and door-to-door options that do not use the metro. Standalone file only. */
const KIND = {
  t: { th: 'รถไฟ ร.ฟ.ท.', ic: '🚆', c: '#b22222', w: 3.2 },
  f: { th: 'เรือ', ic: '⛴', c: '#0b7fb3', w: 3.6 },
  b: { th: 'รถเมล์', ic: '🚌', c: '#e8590c', w: 2 },
  p: { th: 'รถปริมณฑล', ic: '🚍', c: '#7048e8', w: 2 },
  v: { th: 'รถตู้', ic: '🚐', c: '#c2255c', w: 2 },
  s: { th: 'สองแถว / รถในซอย', ic: '🛻', c: '#2f9e44', w: 2 },
  i: { th: 'รถทัวร์ / ต่างจังหวัด', ic: '🚌', c: '#495057', w: 2 },
};
const KORDER = ['t', 'f', 'b', 'p', 'v', 's', 'i'], KSPEED = { b: 15, p: 26, v: 32, s: 15, i: 48, f: 17, t: 42 }, KWAIT = { b: 9, p: 15, v: 12, s: 8, i: 30, f: 15, t: 40 };
/* what each travel option may use (rail = BTS / MRT / ARL / SRT Red line planner; the rest = GTFS vehicles for the first/last leg or a whole trip) */
const MODEPRE = [
  ['all', 'ทุกแบบ', { rail: 1, k: 'tfbpvsi' }],
  ['rail', 'รถไฟ / รถไฟฟ้า อย่างเดียว', { rail: 1, k: 't' }],
  ['railboat', 'รถไฟ + เรือ', { rail: 1, k: 'tf' }],
  ['railbus', 'รถไฟ + รถเมล์ / รถตู้', { rail: 1, k: 'tbpvsi' }],
  ['nonrail', 'ไม่ใช้รถไฟฟ้า', { rail: 0, k: 'fbpvsi' }],
];
st.mode = 'all'; try { const m = localStorage.getItem('rail-mode'); if (MODEPRE.some(x => x[0] === m)) st.mode = m; } catch (e) {}
const modeDef = () => MODEPRE.find(x => x[0] === st.mode)[2];
const useRail = () => !!modeDef().rail;
const allowedKinds = () => new Set(modeDef().k.split(''));

const TR = { hlPats: new Set(), hlRedo: null, ready: false, loading: null, D: null, R: [], P: [], S: [], s2p: [], grid: new Map(), byKind: {}, on: new Set(['rail']), stops: false, parking: false, hl: null, g: null, shown: new Map(), opts: {}, pk: null, sdots: null };
try { const s = JSON.parse(localStorage.getItem('rail-lyr') || 'null'); if (s) { TR.on = new Set(s.on || ['rail']); TR.stops = !!s.stops; TR.parking = !!s.parking; } } catch (e) {}
const trSave = () => { try { localStorage.setItem('rail-lyr', JSON.stringify({ on: [...TR.on], stops: TR.stops, parking: TR.parking })); } catch (e) {} };
const dm = (a1, o1, a2, o2) => Math.hypot((o2 - o1) * Math.cos((a1 + a2) * Math.PI / 360) * 111320, (a2 - a1) * 110574);
const trName = s => TR.S[s][0] || 'จุดขึ้น-ลงรถ';
const ink = c => (typeof inkOn === 'function' ? inkOn(c) : '#fff');

function decodePoly(str) { // Google polyline (1e5) → Float64Array [lat, lng, lat, lng, …]
  const o = []; let i = 0, la = 0, ln = 0;
  while (i < str.length) {
    for (let k = 0; k < 2; k++) { let s = 0, r = 0, b; do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << s; s += 5; } while (b >= 32); const d = r & 1 ? ~(r >> 1) : r >> 1; if (k) ln += d; else la += d; }
    o.push(la / 1e5, ln / 1e5);
  }
  return Float64Array.from(o);
}
async function trLoad() {
  if (TR.loading) return TR.loading;
  return TR.loading = (async () => {
    if (typeof GTFS_Z === 'undefined' || !window.DecompressionStream) return false;
    const bin = Uint8Array.from(atob(GTFS_Z), c => c.charCodeAt(0));
    const D = JSON.parse(await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
    TR.D = D; TR.S = D.S.map(([n, la, ln]) => [D.N[n], la, ln]);
    TR.R = D.R.map(r => ({ sn: r[0], ln: r[1], k: r[2], c: '#' + (r[3] || KIND[r[2]].c.slice(1)), d: D.D[r[4]], ag: D.G[r[5]], hw: r[6], t0: r[7], t1: r[8], pats: [] }));
    TR.P = D.P.map(([r, hs, seq, sh], i) => { TR.R[r].pats.push(i); return { r, hs, s: seq, sh }; });
        const cnt = new Int32Array(TR.S.length); TR.P.forEach(p => p.s.forEach(s => cnt[s]++));
    TR.s2p = Array.from(cnt, n => new Int32Array(n * 2)); const fill = new Int32Array(TR.S.length);
    TR.P.forEach((p, pi) => p.s.forEach((s, q) => { const a = TR.s2p[s], k = fill[s]++ * 2; a[k] = pi; a[k + 1] = q; }));
    TR.S.forEach((s, i) => { const key = Math.floor(s[1] * 100) * 100000 + Math.floor(s[2] * 100); (TR.grid.get(key) || TR.grid.set(key, []).get(key)).push(i); });
    for (const k of KORDER) TR.byKind[k] = [];
    TR.R.forEach((r, i) => { if (TR.byKind[r.k]) TR.byKind[r.k].push(i); });
    TR.ready = true; return true;
  })().catch(e => { console.warn('GTFS', e); return false; });
}
function trGeo(pi) { // the line of one service pattern: the feed's shape when it follows the stops, otherwise the stops joined in order
  const p = TR.P[pi];
  if (!p.geo) {
    let a; if (p.sh >= 0) a = decodePoly(TR.D.H[p.sh]); else { a = new Float64Array(p.s.length * 2); p.s.forEach((s, q) => { a[2 * q] = TR.S[s][1]; a[2 * q + 1] = TR.S[s][2]; }); }
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let k = 0; k < a.length; k += 2) { if (a[k] < x0) x0 = a[k]; if (a[k] > x1) x1 = a[k]; if (a[k + 1] < y0) y0 = a[k + 1]; if (a[k + 1] > y1) y1 = a[k + 1]; }
    p.raw = a; p.geo = a; p.box = [x0, y0, x1, y1];
  }
  return p.geo;
}
const flatLL = a => { const o = new Array(a.length / 2); for (let k = 0; k < o.length; k++) o[k] = [a[2 * k], a[2 * k + 1]]; return o; };
function trNear(la, ln, rad) {
  const out = [], r = Math.ceil(rad / 1100), i0 = Math.floor(la * 100), j0 = Math.floor(ln * 100);
  for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) { const g = TR.grid.get(i * 100000 + j); if (!g) continue; for (const s of g) { const d = dm(la, ln, TR.S[s][1], TR.S[s][2]); if (d <= rad) out.push([s, d]); } }
  return out.sort((a, b) => a[1] - b[1]);
}
const pcum = pi => { const p = TR.P[pi]; if (!p.cum) { const c = new Float32Array(p.s.length); for (let q = 1; q < c.length; q++) { const a = TR.S[p.s[q - 1]], b = TR.S[p.s[q]]; c[q] = c[q - 1] + dm(a[1], a[2], b[1], b[2]) * 1.2 / 1000; } p.cum = c; } return p.cum; };
const rideMin = (pi, i, j) => { const k = TR.R[TR.P[pi].r].k, c = pcum(pi); return (c[j] - c[i]) / KSPEED[k] * 60 + 1.5; };
const waitMin = ri => { const r = TR.R[ri]; return r.hw ? Math.min(r.hw / 2, 30) : KWAIT[r.k]; };
const walkMin = m => m * 1.3 / 75;

/* direct services between the surroundings of A and B (stop order respected: boarding stop before alighting stop) */
function trDirect(A, B, kinds, rad) {
  const na = trNear(A.lat, A.lng, rad), nb = trNear(B.lat, B.lng, rad), by = new Map();
  for (const [s, d] of na) { const a = TR.s2p[s]; for (let k = 0; k < a.length; k += 2) { const p = a[k]; if (!kinds.has(TR.R[TR.P[p].r].k)) continue; let e = by.get(p); if (!e) by.set(p, e = { A: [], B: [] }); e.A.push([a[k + 1], d, s]); } }
  for (const [s, d] of nb) { const a = TR.s2p[s]; for (let k = 0; k < a.length; k += 2) { const e = by.get(a[k]); if (e) e.B.push([a[k + 1], d, s]); } }
  const best = new Map();
  for (const [p, e] of by) {
    let bo = null; for (const x of e.A) for (const y of e.B) if (y[0] > x[0]) { const w = x[1] + y[1]; if (!bo || w < bo.w) bo = { w, x, y }; }
    if (!bo) continue; const ri = TR.P[p].r, r = TR.R[ri], ride = rideMin(p, bo.x[0], bo.y[0]), wait = waitMin(ri), wk = walkMin(bo.w);
    const o = { type: 'direct', legs: [{ p, i: bo.x[0], j: bo.y[0], sa: bo.x[2], sb: bo.y[2] }], wA: bo.x[1], wB: bo.y[1], ride, wait, min: wk + wait + ride };
    const key = r.sn + '|' + r.k + '|' + r.ag, cur = best.get(key); if (!cur || o.min < cur.min) best.set(key, o);
  }
  return [...best.values()].sort((a, b) => a.min - b.min);
}
/* one change of vehicle: ride X from A, walk ≤ 250 m, ride Y to B */
function trXfer(A, B, kinds, rad) {
  const na = trNear(A.lat, A.lng, rad).slice(0, 40), nb = trNear(B.lat, B.lng, rad).slice(0, 40), okp = p => kinds.has(TR.R[TR.P[p].r].k);
  const bA = new Map(), bB = new Map();
  for (const [s, d] of na) { const a = TR.s2p[s]; for (let k = 0; k < a.length; k += 2) { const p = a[k]; if (!okp(p)) continue; const c = bA.get(p); if (!c || d < c[1]) bA.set(p, [a[k + 1], d, s]); } }
  for (const [s, d] of nb) { const a = TR.s2p[s]; for (let k = 0; k < a.length; k += 2) { const p = a[k]; if (!okp(p)) continue; const c = bB.get(p); if (!c || d < c[1]) bB.set(p, [a[k + 1], d, s]); } }
  const CS = 0.003, ck = (la, ln) => Math.floor(la / CS) * 1000000 + Math.floor(ln / CS), idx = new Map();
  for (const [p, y] of bB) { const seq = TR.P[p].s; for (let q = Math.max(0, y[0] - 150); q < y[0]; q++) { const s = TR.S[seq[q]], k = ck(s[1], s[2]); (idx.get(k) || idx.set(k, []).get(k)).push([p, q, seq[q], y]); } }
  const best = new Map();
  for (const [p, x] of bA) {
    const seq = TR.P[p].s, rA = TR.P[p].r;
    for (let q = x[0] + 1; q < Math.min(seq.length, x[0] + 150); q++) {
      const s = TR.S[seq[q]];
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const L = idx.get(ck(s[1] + di * CS, s[2] + dj * CS)); if (!L) continue;
        for (const [p2, q2, s2, y] of L) {
          if (TR.P[p2].r === rA) continue; const t = TR.S[s2], d = dm(s[1], s[2], t[1], t[2]); if (d > 250) continue;
          const ride1 = rideMin(p, x[0], q), ride2 = rideMin(p2, q2, y[0]), wait1 = waitMin(rA), wait2 = waitMin(TR.P[p2].r), wk = walkMin(x[1] + y[1] + d);
          const o = { type: 'xfer', legs: [{ p, i: x[0], j: q, sa: x[2], sb: seq[q] }, { p: p2, i: q2, j: y[0], sa: s2, sb: y[2] }], wA: x[1], wB: y[1], wX: d, ride: ride1 + ride2, wait: wait1 + wait2, min: wk + wait1 + wait2 + ride1 + ride2 };
          const a1 = TR.R[rA], a2 = TR.R[TR.P[p2].r], key = a1.sn + a1.k + '>' + a2.sn + a2.k, cur = best.get(key); if (!cur || o.min < cur.min) best.set(key, o);
        }
      }
    }
  }
  return [...best.values()].sort((a, b) => a.min - b.min);
}
function trFind(A, B, kinds, full) {
  for (const rad of [700, 1500, 3000]) {
    let o = trDirect(A, B, kinds, rad);
    if (full && o.length < 3) o = o.concat(trXfer(A, B, kinds, rad).filter(x => !o.length || x.min < o[0].min * 1.6 + 15).slice(0, 4));
    if (o.length) return { opts: o.sort((a, b) => a.min - b.min), rad };
  }
  return { opts: [], rad: 3000 };
}

/* ---------- text ---------- */
const legChip = l => { const r = TR.R[TR.P[l.p].r], K = KIND[r.k]; return `<span class="trc" style="background:${r.c};color:${ink(r.c)}">${K.ic} ${esc(r.sn)}</span>`; };
const hrs = r => r.t0 ? `${r.t0}–${r.t1}` : '';
const hwTxt = r => r.hw ? `ทุก ~${r.hw} นาที` : 'ตามตารางเดินรถ';
function optHTML(o, key, i) {
  const m = Math.round(o.min), legs = o.legs, f = legs[0], l = legs[legs.length - 1];
  const steps = legs.map((g, n) => { const r = TR.R[TR.P[g.p].r], K = KIND[r.k];
    return `<li>${legChip(g)} <b>${n ? 'ต่อ' : 'ขึ้น'}ที่ ${esc(trName(g.sa))}</b>${n ? ` <small>(เดินจากจุดลง ${Math.round(o.wX)} ม.)</small>` : o.wA ? ` <small>(เดินจากต้นทาง ~${Math.round(o.wA)} ม.)</small>` : ''} → ลงที่ <b>${esc(trName(g.sb))}</b><br><small>${K.th} · ${esc(r.ln)} · ${g.j - g.i} ป้าย/ท่า · ${hwTxt(r)}${hrs(r) ? ' · ' + hrs(r) : ''}${r.ag ? ' · ' + esc(r.ag) : ''}</small></li>`; }).join('');
  return `<div class="tro"><button type="button" class="trgo" data-tro="${key}:${i}"><span class="trchips">${legs.map(legChip).join('<i>➜</i>')}</span><b>~${m} นาที</b></button>
    <div class="trs">ขึ้น <b>${esc(trName(f.sa))}</b>${o.wA ? ` (เดิน ${Math.round(o.wA)} ม.)` : ''}${legs.length > 1 ? ' · ต่อรถ 1 ครั้ง' : ''} → ลง <b>${esc(trName(l.sb))}</b>${o.wB ? ` (เดิน ${Math.round(o.wB)} ม.)` : ''}</div>
    <details><summary>รายละเอียด</summary><ol class="trsteps">${steps}</ol><small>นั่ง ~${Math.round(o.ride)} นาที · รอ ~${Math.round(o.wait)} นาที · เดินรวม ~${Math.round(walkMin(o.wA + o.wB + (o.wX || 0)))} นาที (ประมาณการจากระยะทาง ไม่ใช่เวลารถจริง)</small></details></div>`;
}
const GT_NOTE = 'ข้อมูลสายรถ: GTFS ของ สนข. (Namtang) ฉบับ ต.ค. 2569 · ไม่มีข้อมูลค่าโดยสารและเวลารถสด';

/* ---------- map drawing ---------- */
let trCanvas, trDots;
function trInitMap() {
  trCanvas = L.canvas({ pane: 'tr', padding: .25, tolerance: 4 }); trDots = L.canvas({ pane: 'trs', padding: .2, tolerance: 6 });
  TR.g = L.layerGroup().addTo(map); TR.hl = L.layerGroup().addTo(map); TR.sg = L.layerGroup().addTo(map); TR.pg = L.layerGroup().addTo(map); TR.hs = L.layerGroup().addTo(map);
}

/* ---------- snapping the lines to the real roads / tracks ----------
   The feed's own shapes are coarse (stops joined by straight chords, some 5 km long). Each line is cut into chunks; chunks that are on screen
   (zoomed in) or belong to the selected route are fitted to OpenStreetMap on demand and remembered in this browser (IndexedDB):
   road vehicles → SNAPHOSTS map-matching (public servers, free); trains and boats → the railway / ferry ways from Overpass, joined by a shortest path. */
const SNAP = { q: [], act: 0, on: true, dirty: new Set(), timer: 0, fail: 0 };
try { SNAP.on = localStorage.getItem('rail-snap') !== '0'; } catch (e) {}
const SNAPHOSTS = CONFIG.SNAP_HOSTS;
const ROADK = 'bpvsi';
function encodePoly(a) { // Float64Array [lat,lng,…] → polyline string
  let o = '', pl = 0, pn = 0;
  for (let k = 0; k < a.length; k += 2) {
    const la = Math.round(a[k] * 1e5), ln = Math.round(a[k + 1] * 1e5);
    for (const d of [la - pl, ln - pn]) { let v = d < 0 ? ~(d << 1) : d << 1; while (v >= 32) { o += String.fromCharCode((32 | (v & 31)) + 63); v >>= 5; } o += String.fromCharCode(v + 63); }
    pl = la; pn = ln;
  }
  return o;
}
let kvDb = null;
const kvOpen = () => kvDb || (kvDb = new Promise(res => { try { const r = indexedDB.open('next-route-snap', 1); r.onupgradeneeded = () => r.result.createObjectStore('c'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }));
const kvGet = async k => { const db = await kvOpen(); return db ? new Promise(res => { try { const q = db.transaction('c').objectStore('c').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); } catch (e) { res(undefined); } }) : undefined; };
const kvSet = async (k, v) => { const db = await kvOpen(); if (db) try { db.transaction('c', 'readwrite').objectStore('c').put(v, k); } catch (e) {} };
async function jget(url) { const ac = new AbortController(), t = setTimeout(() => ac.abort(), 12000); try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(t); } }
function trChunks(pi) { // the line is cut where it gets long: ≤ 28 vertices and ≤ ~9 km (roads), ≤ 20 vertices (rail, boat); stretches with long straight hops ("lg") get their own chunks
  const p = TR.P[pi]; if (p.ch) return p.ch; trGeo(pi);
  const a = p.raw, n = a.length / 2, road = ROADK.includes(TR.R[p.r].k), LG = road ? 1500 : 3000, ch = [];
  const mk = (i, j, lg) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let k = i; k <= j; k++) { const la = a[2 * k], ln = a[2 * k + 1]; if (la < x0) x0 = la; if (la > x1) x1 = la; if (ln < y0) y0 = ln; if (ln > y1) y1 = ln; } return { a: i, b: j, box: [x0, y0, x1, y1], st: 0, sn: null, t: 0, lg }; };
  let s0 = 0, len = 0, lg = false;
  for (let k = 1; k < n; k++) {
    const d = dm(a[2 * k - 2], a[2 * k - 1], a[2 * k], a[2 * k + 1]); len += d; if (d >= LG) lg = true;
    const maxV = lg ? (road ? 24 : 10) : (road ? 28 : 20), maxL = lg ? (road ? 90000 : 60000) : (road ? 9000 : 15000);
    if (k - s0 >= maxV || len >= maxL || k === n - 1) { ch.push(mk(s0, k, lg)); s0 = k; len = 0; lg = false; }
  }
  return p.ch = ch;
}
function trRebuild(pi) { // line = snapped chunks where we have them, the feed's coordinates elsewhere
  const p = TR.P[pi], a = p.raw, out = [];
  for (const c of p.ch) { const g = c.sn || a.subarray(2 * c.a, 2 * c.b + 2); for (let k = out.length ? 2 : 0; k < g.length; k++) out.push(g[k]); }
  p.geo = Float64Array.from(out); p.arc = null; p.dirty = true;
}
const chunkLen = (a, c) => { let L2 = 0; for (let k = c.a + 1; k <= c.b; k++) L2 += dm(a[2 * k - 2], a[2 * k - 1], a[2 * k], a[2 * k + 1]); return L2; };
function fitOk(g, a, c) { // g = [[lng,lat],…]; plausible if the length and both ends agree with the feed's chunk (looser for long hops: roads wind, stops sit off the road)
  if (!g || g.length < 2) return false; let L2 = 0; for (let k = 1; k < g.length; k++) L2 += dm(g[k - 1][1], g[k - 1][0], g[k][1], g[k][0]);
  const raw = chunkLen(a, c), r = L2 / Math.max(raw, 1), lg = c.lg, end = lg ? 350 : 120;
  return r >= (lg ? .9 : .85) && r <= (lg ? 3.4 : (c.b - c.a > 1 ? 1.7 : 2.2)) && dm(g[0][1], g[0][0], a[2 * c.a], a[2 * c.a + 1]) < end && dm(g[g.length - 1][1], g[g.length - 1][0], a[2 * c.b], a[2 * c.b + 1]) < end;
}
const flatFromLngLat = g => { const o = new Float64Array(g.length * 2); g.forEach((q, k) => { o[2 * k] = Math.round(q[1] * 1e5) / 1e5; o[2 * k + 1] = Math.round(q[0] * 1e5) / 1e5; }); return o; };
async function snapRoad(p, c) {
  const a = p.raw, co = x => x.map(v => v[1].toFixed(5) + ',' + v[0].toFixed(5)).join(';');
  let q = null;
  if (!c.lg) { // dense chunk: map-match the line densified every 120 m
    const pts = [];
    for (let k = c.a; k < c.b; k++) { const la1 = a[2 * k], ln1 = a[2 * k + 1], la2 = a[2 * k + 2], ln2 = a[2 * k + 3], m = Math.max(1, Math.ceil(dm(la1, ln1, la2, ln2) / 120)); for (let j = 0; j < m; j++) pts.push([la1 + (la2 - la1) * j / m, ln1 + (ln2 - ln1) * j / m]); }
    pts.push([a[2 * c.b], a[2 * c.b + 1]]);
    q = pts; if (q.length > 100) { const st2 = Math.ceil(q.length / 99); q = q.filter((_, i) => i % st2 === 0); if (q[q.length - 1] !== pts[pts.length - 1]) q.push(pts[pts.length - 1]); q = q.slice(0, 100); }
  }
  let net = 0;
  for (const h of SNAPHOSTS) {
    if (q) try {
      const j = await jget(`${h}/match/v1/driving/${co(q)}?overview=full&geometries=geojson&gaps=ignore&radiuses=${q.map(() => 45).join(';')}`);
      if (j && j.code === 'Ok' && j.matchings && j.matchings.length) { const g = []; j.matchings.forEach(m => g.push(...m.geometry.coordinates)); if (fitOk(g, a, c)) return flatFromLngLat(g); }
    } catch (e) { net++; }
    try { // no clean match / long hops: let the router find the way between the feed's own vertices
      const v = []; const stp = c.lg ? 1 : Math.max(1, Math.ceil((c.b - c.a + 1) / 24)); for (let k = c.a; k <= c.b; k += stp) v.push([a[2 * k], a[2 * k + 1]]); if (v[v.length - 1][0] !== a[2 * c.b]) v.push([a[2 * c.b], a[2 * c.b + 1]]);
      const j = await jget(`${h}/route/v1/driving/${co(v)}?overview=full&geometries=geojson&continue_straight=true&alternatives=false&steps=false`);
      if (j && j.code === 'Ok' && j.routes && j.routes[0] && fitOk(j.routes[0].geometry.coordinates, a, c)) return flatFromLngLat(j.routes[0].geometry.coordinates);
    } catch (e) { net++; }
  }
  return net >= 3 ? undefined : null;   // undefined = servers unreachable (try again later); null = the feed's line is all we trust here
}
async function snapTrack(p, c) { // railway / ferry ways from Overpass → graph → shortest path between the feed's vertices
  const a = p.raw, k = TR.R[p.r].k, pad = c.lg ? .07 : .03;
  const sel = k === 'f' ? 'way["route"="ferry"]' : 'way["railway"~"^(rail|narrow_gauge|light_rail)$"]["service"!~"yard|siding|spur|crossover"]';
  const j = await overpass(`[out:json][timeout:${c.lg ? 60 : 25}];${sel}(${c.box[0] - pad},${c.box[1] - pad},${c.box[2] + pad},${c.box[3] + pad});out geom;`);
  if (!j) return undefined;
  const ids = new Map(), P = [], adj = [];
  const node = (la, ln) => { const key = la.toFixed(6) + ',' + ln.toFixed(6); let i = ids.get(key); if (i === undefined) { i = P.length; ids.set(key, i); P.push([la, ln]); adj.push([]); } return i; };
  for (const w of j.elements || []) { if (!w.geometry) continue; let prev = -1; for (const g of w.geometry) { const i = node(g.lat, g.lon); if (prev >= 0 && prev !== i) { const d = dm(P[prev][0], P[prev][1], g.lat, g.lon); adj[prev].push([i, d]); adj[i].push([prev, d]); } prev = i; } }
  if (P.length < 2) return null;
  const near = (la, ln) => { let b = -1, bd = 450; for (let i = 0; i < P.length; i++) { const d = dm(la, ln, P[i][0], P[i][1]); if (d < bd) { bd = d; b = i; } } return b; };
  const path = (s0, t0, lim) => { // Dijkstra with a binary heap (long hops pull in graphs of tens of thousands of nodes)
    const dist = new Map([[s0, 0]]), prev = new Map(), done = new Set(), hp = [];
    const hpush = x => { let i = hp.length; hp.push(x); while (i > 0) { const j = (i - 1) >> 1; if (hp[j][0] <= x[0]) break; hp[i] = hp[j]; i = j; } hp[i] = x; };
    const hpop = () => { const top = hp[0], last = hp.pop(); if (hp.length) { let i = 0; for (;;) { let l = 2 * i + 1; if (l >= hp.length) break; if (l + 1 < hp.length && hp[l + 1][0] < hp[l][0]) l++; if (hp[l][0] >= last[0]) break; hp[i] = hp[l]; i = l; } hp[i] = last; } return top; };
    hpush([0, s0]);
    while (hp.length) { const [d, u] = hpop(); if (done.has(u)) continue; done.add(u); if (u === t0) break; if (d > lim) return null;
      for (const [v, w] of adj[u]) { const nd = d + w; if (nd < (dist.has(v) ? dist.get(v) : 1e18)) { dist.set(v, nd); prev.set(v, u); hpush([nd, v]); } } }
    if (!prev.has(t0) && s0 !== t0) return null; const out = [t0]; let u = t0; while (u !== s0) { u = prev.get(u); out.push(u); } return out.reverse();
  };
  const out = []; const push = (la, ln) => { const l = out.length; if (!l || out[l - 1][0] !== la || out[l - 1][1] !== ln) out.push([la, ln]); };
  let any = false;
  for (let i = c.a; i < c.b; i++) {
    const la1 = a[2 * i], ln1 = a[2 * i + 1], la2 = a[2 * i + 2], ln2 = a[2 * i + 3], chord = dm(la1, ln1, la2, ln2);
    const n1 = near(la1, ln1), n2 = near(la2, ln2), pth = n1 >= 0 && n2 >= 0 ? path(n1, n2, chord * 2.5 + 600) : null;
    push(la1, ln1); if (pth) { any = true; pth.forEach(u => push(P[u][0], P[u][1])); }
  }
  push(a[2 * c.b], a[2 * c.b + 1]);
  if (!any) return null;
  const o = new Float64Array(out.length * 2); out.forEach((q, i) => { o[2 * i] = q[0]; o[2 * i + 1] = q[1]; }); return o;
}
async function snapChunk(pi, c) {
  const p = TR.P[pi], key = TR.D.v + '|' + (p.sh >= 0 ? 's' + p.sh : pi) + '|' + c.a + '-' + c.b, hit = await kvGet(key);
  if (typeof hit === 'string') return hit === '-' ? null : decodePoly(hit);
  const r = ROADK.includes(TR.R[p.r].k) ? await snapRoad(p, c) : await snapTrack(p, c);
  if (r !== undefined) kvSet(key, r ? encodePoly(r) : '-');
  return r;
}
function snapPump() {
  while (SNAP.act < (SNAP.fail > 3 ? 1 : 2) && SNAP.q.length) {
    const [pi, c] = SNAP.q.shift(); SNAP.act++;
    snapChunk(pi, c).catch(() => undefined).then(r => {
      SNAP.act--; c.t = Date.now();
      if (r === undefined) { c.st = 3; SNAP.fail++; } else { SNAP.fail = 0; c.st = 2; if (r) { c.sn = r; trRebuild(pi); SNAP.dirty.add(pi); trRefreshSoon(); } }
      setTimeout(snapPump, SNAP.fail ? 800 : 150);
      if (!SNAP.q.length && !SNAP.act) setTimeout(trSnapSync, 600); // keep going: fetch the next chunks on screen until everything in view is fitted
    });
  }
}
function trRefreshSoon() {
  clearTimeout(SNAP.timer);
  SNAP.timer = setTimeout(() => {
    for (const pi of SNAP.dirty) { const ly = TR.shown.get(pi); if (ly) ly.setLatLngs(flatLL(TR.P[pi].geo)); } SNAP.dirty.clear();
    if (TR.hlRedo) TR.hlRedo();
  }, 350);
}
function trSnapSync() {
  if (!SNAP.on || !TR.ready) return;
  const z = map.getZoom(), b = map.getBounds().pad(.1), now = Date.now(), ctr = map.getCenter();
  const inView = c => c.box[0] <= b.getNorth() && c.box[2] >= b.getSouth() && c.box[1] <= b.getEast() && c.box[3] >= b.getWest();
  SNAP.q = SNAP.q.filter(([pi, c]) => { if (inView(c) || TR.hlPats.has(pi)) return true; c.st = 0; return false; }); // scrolled away before we got to it
  const cand = [], few = TR.shown.size <= 120;
  const want = (pi, hi) => { for (const c of trChunks(pi)) if (inView(c) && (c.st === 0 || (c.st === 3 && now - c.t > 120000))) { if (!hi && !c.lg && !(z >= 12 && few)) continue; cand.push([hi ? 0 : 1, dm(ctr.lat, ctr.lng, (c.box[0] + c.box[2]) / 2, (c.box[1] + c.box[3]) / 2), pi, c]); } };
  TR.hlPats.forEach(pi => want(pi, true));
  for (const pi of TR.shown.keys()) if (!TR.hlPats.has(pi)) want(pi, false); // long hops are fitted at every zoom, dense chunks only when zoomed in
  cand.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  for (const [h, , pi, c] of cand) { if (SNAP.q.length >= 60 && h) break; c.st = 1; h ? SNAP.q.push([pi, c]) : SNAP.q.unshift([pi, c]); }
  snapPump();
}
function trSync() {
  if (!TR.ready || !TR.g) return;
  const z = map.getZoom(), b = map.getBounds().pad(.3), want = new Set(), hint = [];
  for (const k of TR.on) {
    if (!KIND[k]) continue; if ('bvsp'.includes(k) && z < 10.5) { hint.push(KIND[k].th); continue; }
    for (const ri of TR.byKind[k]) for (const pi of TR.R[ri].pats) {
      trGeo(pi); const bx = TR.P[pi].box;
      if (bx[0] <= b.getNorth() && bx[2] >= b.getSouth() && bx[1] <= b.getEast() && bx[3] >= b.getWest()) want.add(pi);
    }
  }
  for (const [pi, ly] of TR.shown) if (!want.has(pi)) { TR.g.removeLayer(ly); TR.shown.delete(pi); }
  const seen = new Set(); let n = 0;
  for (const pi of want) {
    if (TR.shown.has(pi)) continue; const p = TR.P[pi], r = TR.R[p.r], sk = (p.sh >= 0 ? 's' + p.sh : 'p' + pi) + '|' + r.sn; if (seen.has(sk)) continue; seen.add(sk); if (++n > 2500) break;
    const K = KIND[r.k], ly = L.polyline(flatLL(trGeo(pi)), { renderer: trCanvas, color: K.c, weight: z < 12 ? K.w * .8 : K.w, opacity: 'bvsp'.includes(r.k) ? .55 : .85, lineCap: 'round', lineJoin: 'round', bubblingMouseEvents: false, smoothFactor: 1.5 });
    ly.on('click', e => trShowRoute(p.r, e.latlng)); TR.g.addLayer(ly); TR.shown.set(pi, ly);
  }
  const msg = $('lyrhint'); if (msg) msg.textContent = hint.length ? `ซูมเข้าอีกเล็กน้อยเพื่อแสดง ${hint.join(', ')}` : '';
  trStopsSync(); trParkSync(); trSnapSync();
}
function trStopsSync() {
  if (!TR.sg) return; TR.sg.clearLayers(); if (!TR.stops || !TR.ready) return;
  const z = map.getZoom(); if (z < 15) { const m = $('lyrhint'); if (m && !m.textContent) m.textContent = 'ซูมเข้าให้ถึงระดับถนนเพื่อแสดงป้ายรถ/ท่าเรือ'; return; }
  const b = map.getBounds().pad(.05), kinds = TR.on.size ? TR.on : new Set(KORDER), out = [];
  for (let i = Math.floor(b.getSouth() * 100); i <= Math.floor(b.getNorth() * 100); i++) for (let j = Math.floor(b.getWest() * 100); j <= Math.floor(b.getEast() * 100); j++) { const g = TR.grid.get(i * 100000 + j); if (g) for (const s of g) { const t = TR.S[s]; if (b.contains([t[1], t[2]])) out.push(s); } }
  let n = 0;
  for (const s of out) {
    const a = TR.s2p[s]; let ks = ''; for (let k = 0; k < a.length; k += 2) ks += TR.R[TR.P[a[k]].r].k; if (![...kinds].some(k => ks.includes(k))) continue; if (++n > 900) break;
    const t = TR.S[s], f = ks.includes('f'), m = L.circleMarker([t[1], t[2]], { renderer: trDots, radius: f ? 5.5 : 4, color: f ? '#0b7fb3' : '#e8590c', weight: 1.6, fillColor: '#fff', fillOpacity: 1, bubblingMouseEvents: false });
    m.on('click', () => trShowStop(s)); if (z >= 17 && out.length < 150 && t[0]) m.bindTooltip(esc(t[0]), { permanent: true, direction: 'right', className: 'trtip', offset: [4, 0] });
    TR.sg.addLayer(m);
  }
}
function trParkSync() {
  if (!TR.pg) return; TR.pg.clearLayers(); if (!TR.parking || !TR.ready) return;
  for (const [nm, la, ln, ds] of TR.D.PK) TR.pg.addLayer(L.marker([la, ln], { icon: L.divIcon({ className: 'pkmk', html: '<span>P</span>', iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false }).bindPopup(`<b>${esc(nm)}</b><br><small>${esc((ds || '').replace(/<[^>]*>/g, ' '))}</small>`, { maxWidth: 260 }));
}
const trClearHL = () => { TR.hlPats.clear(); TR.hlRedo = null; if (TR.hl) TR.hl.clearLayers(); if (TR.hs) TR.hs.clearLayers(); };
function trLine(arr, color, w, g) {
  const o = { pane: 'trhl', interactive: false, lineCap: 'round', lineJoin: 'round', noClip: true };
  g.addLayer(L.polyline(arr, { ...o, color: '#fff', weight: w + 4, opacity: .95 })); g.addLayer(L.polyline(arr, { ...o, color, weight: w }));
}
function trPatSlice(g) { // the part of the pattern between the boarding and the alighting stop
  const p = TR.P[g.p], stopsLine = () => p.s.slice(g.i, g.j + 1).map(x => [TR.S[x][1], TR.S[x][2]]);
  if (p.sh < 0) return stopsLine();
  const a = trGeo(g.p), n = a.length / 2, c = pcum(g.p), tot = c[c.length - 1] || 1;
  if (!p.arc) { const ar = new Float64Array(n); for (let k = 1; k < n; k++) ar[k] = ar[k - 1] + dm(a[2 * k - 2], a[2 * k - 1], a[2 * k], a[2 * k + 1]); p.arc = ar; }
  const ar = p.arc, T = ar[n - 1] || 1;
  const proj = (st, f) => { let best = null, bd = 1e18; const kx = Math.cos(st[1] * Math.PI / 180) * 111320;
    for (let k = 0; k < n - 1; k++) { if (Math.abs(ar[k] / T - f) > .3) continue;
      const ax = a[2 * k + 1] * kx, ay = a[2 * k] * 110574, dx = a[2 * k + 3] * kx - ax, dy = a[2 * k + 2] * 110574 - ay, L2 = dx * dx + dy * dy || 1e-9;
      const u = Math.max(0, Math.min(1, ((st[2] * kx - ax) * dx + (st[1] * 110574 - ay) * dy) / L2)), d = Math.hypot(ax + dx * u - st[2] * kx, ay + dy * u - st[1] * 110574);
      if (d < bd) { bd = d; best = { k, pt: [a[2 * k] + (a[2 * k + 2] - a[2 * k]) * u, a[2 * k + 1] + (a[2 * k + 3] - a[2 * k + 1]) * u] }; } }
    return best; };
  const P1 = proj(TR.S[g.sa], c[g.i] / tot), P2 = proj(TR.S[g.sb], c[g.j] / tot);
  if (!P1 || !P2 || P2.k < P1.k) return stopsLine();
  const out = [P1.pt]; for (let k = P1.k + 1; k <= P2.k; k++) out.push([a[2 * k], a[2 * k + 1]]); out.push(P2.pt); return out;
}
const stopPin = (s, cls, txt) => L.marker([TR.S[s][1], TR.S[s][2]], { pane: 'labels', interactive: false, keyboard: false, icon: L.divIcon({ className: 'trpin ' + cls, html: `<span>${txt}</span>`, iconSize: [0, 0], iconAnchor: [-2, 10] }) });
function trDrawOpt(o, A, B) {
  trClearHL(); o.legs.forEach(g => TR.hlPats.add(g.p));
  const paint = fit => {
    TR.hl.clearLayers(); TR.hs.clearLayers(); const all = [];
    o.legs.forEach(g => { const p = TR.P[g.p], r = TR.R[p.r], pts = trPatSlice(g); trLine(pts, r.c, 6, TR.hl); all.push(...pts); TR.hs.addLayer(stopPin(g.sa, 'on', 'ขึ้น ' + esc(trName(g.sa)))); TR.hs.addLayer(stopPin(g.sb, 'off', 'ลง ' + esc(trName(g.sb)))); });
    const dash = (p, q) => { const o2 = { pane: 'trhl', interactive: false, lineCap: 'round', noClip: true }; TR.hl.addLayer(L.polyline([p, q], { ...o2, color: '#fff', weight: 8 })); TR.hl.addLayer(L.polyline([p, q], { ...o2, color: '#1556d6', weight: 4.5, dashArray: '.5 8' })); };
    const f = TR.S[o.legs[0].sa], l = TR.S[o.legs[o.legs.length - 1].sb];
    if (A) { dash([A.lat, A.lng], [f[1], f[2]]); all.push([A.lat, A.lng]); } if (B) { dash([l[1], l[2]], [B.lat, B.lng]); all.push([B.lat, B.lng]); }
    if (o.legs.length > 1) { const x = TR.S[o.legs[0].sb], y = TR.S[o.legs[1].sa]; dash([x[1], x[2]], [y[1], y[2]]); }
    if (fit && all.length) map.fitBounds(L.latLngBounds(all), { paddingTopLeft: [40, 150], paddingBottomRight: [40, 60], maxZoom: 16 });
  };
  paint(true); TR.hlRedo = () => paint(false); setPane('map');
  setTimeout(trSnapSync, 600); // after the fit: fit the visible part of the chosen lines to the road
}
function trShowRoute(ri, at, o) { // ri: one route index, or several (same number, e.g. from the catalog); o = { quiet, padL, padB }
  o = o || {}; const ris = [].concat(ri), r = TR.R[ris[0]], K = KIND[r.k], pats = ris.flatMap(i => TR.R[i].pats); trClearHL(); pats.forEach(pi => TR.hlPats.add(pi));
  const paint = fit => {
    TR.hl.clearLayers(); const all = [];
    pats.forEach(pi => { const p = TR.P[pi], pts = flatLL(trGeo(pi)); trLine(pts, r.c, 6, TR.hl); all.push(...pts);
      p.s.forEach((s, q) => { const t = TR.S[s]; const m = L.circleMarker([t[1], t[2]], { pane: 'trhl', radius: q === 0 || q === p.s.length - 1 ? 5.5 : 3.6, color: r.c, weight: 2, fillColor: '#fff', fillOpacity: 1, bubblingMouseEvents: false }); m.on('click', () => trShowStop(s)); m.bindTooltip(esc(t[0] || 'จุดขึ้น-ลงรถ'), { direction: 'top' }); TR.hl.addLayer(m); }); });
    if (fit && all.length) map.fitBounds(L.latLngBounds(all), { paddingTopLeft: [o.padL || 40, 150], paddingBottomRight: [40, o.padB || 60], maxZoom: 15 });
  };
  paint(!at); TR.hlRedo = () => paint(false); setTimeout(trSnapSync, 600);
  if (o.quiet) return;
  const dirs = r.pats.map(pi => { const p = TR.P[pi]; return `<details><summary>${p.hs ? 'ไปทาง ' + esc(p.hs) : 'สายนี้'} · ${p.s.length} จุด</summary><ol class="trsteps">${p.s.map(s => `<li><a href="#" data-trs="${s}">${esc(trName(s))}</a></li>`).join('')}</ol></details>`; }).join('');
  const c = $('stcard'); c.dataset.tr = '1'; delete c.dataset.pid;
  c.innerHTML = `<button class="x" aria-label="ปิด">×</button><div><h3><span class="trc" style="background:${r.c};color:${ink(r.c)}">${K.ic} ${esc(r.sn)}</span> ${esc(r.ln)}</h3><div class="en">${K.th}${r.ag ? ' · ' + esc(r.ag) : ''}${r.d ? ' · ' + esc(r.d) : ''}</div></div>
    <div class="ln"><span>${hwTxt(r)}${hrs(r) ? ' · ช่วงเวลา ' + hrs(r) : ''}</span></div>${dirs}<p class="hint">${GT_NOTE}</p>`;
  c.hidden = false;
}
function trShowStop(s) {
  const t = TR.S[s], a = TR.s2p[s], seen = new Map();
  for (let k = 0; k < a.length; k += 2) { const ri = TR.P[a[k]].r; if (!seen.has(ri)) seen.set(ri, a[k]); }
  const rs = [...seen.keys()].sort((x, y) => KORDER.indexOf(TR.R[x].k) - KORDER.indexOf(TR.R[y].k) || TR.R[x].sn.localeCompare(TR.R[y].sn, 'th', { numeric: true }));
  trClearHL(); TR.hl.addLayer(L.circleMarker([t[1], t[2]], { pane: 'trhl', radius: 8, color: '#E24A14', weight: 3, fillColor: '#fff', fillOpacity: 1, interactive: false }));
  const c = $('stcard'); c.dataset.tr = '1'; delete c.dataset.pid;
  c.innerHTML = `<button class="x" aria-label="ปิด">×</button><div><h3>${esc(t[0] || 'จุดขึ้น-ลงรถ')}</h3><div class="en">${rs.length} สายผ่านจุดนี้</div></div>
    <div class="trlist">${rs.slice(0, 40).map(ri => `<button type="button" class="trbtn" data-trr="${ri}">${legChip({ p: seen.get(ri) })}<small>${esc(TR.R[ri].ln.slice(0, 34))}</small></button>`).join('')}${rs.length > 40 ? `<small>และอีก ${rs.length - 40} สาย</small>` : ''}</div>
    <div class="acts"><button class="btn" data-trpin="from:${s}">ต้นทาง</button><button class="btn primary" data-trpin="to:${s}">ปลายทาง</button></div><p class="hint">${GT_NOTE}</p>`;
  c.hidden = false;
}
$('stcard').addEventListener('click', e => {
  if (e.target.closest('.x')) { trClearHL(); return; }
  const rb = e.target.closest('[data-trr]'); if (rb) { trShowRoute(+rb.dataset.trr); return; }
  const sa = e.target.closest('[data-trs]'); if (sa) { e.preventDefault(); const t = TR.S[+sa.dataset.trs]; map.setView([t[1], t[2]], Math.max(map.getZoom(), 16)); trShowStop(+sa.dataset.trs); return; }
  const pb = e.target.closest('[data-trpin]'); if (pb) { const [role, s] = pb.dataset.trpin.split(':'), t = TR.S[+s]; $('stcard').hidden = true; trClearHL(); dropPin(t[1], t[2], trName(+s), null, false, role); assign(role); }
}, true);

/* ---------- lookups used by the trip planner ---------- */
const endPt = w => st[w] ? placeLL(st[w]) : st[w + 'Pt'];
function trAccessFill() { // first / last leg of a metro trip: services between the pin and the station exit
  document.querySelectorAll('.busbox[data-k]').forEach(el => {
    if (el.dataset.done === String(TR.sig)) return; el.dataset.done = String(TR.sig);
    const kinds = allowedKinds(); kinds.delete('t');
    if (!kinds.size) { el.innerHTML = '<small>โหมดที่เลือกไม่รวมรถเมล์/เรือ เลือก “ทุกแบบ” เพื่อดูสายรถ</small>'; return; }
    if (!TR.ready) { el.innerHTML = '<small>กำลังโหลดข้อมูลสายรถ…</small>'; trLoad().then(() => { el.dataset.done = ''; trAccessFill(); }); return; }
    const [a1, a2, b1, b2] = el.dataset.k.split(',').map(Number), A = { lat: a1, lng: a2 }, B = { lat: b1, lng: b2 }, key = 'acc' + a1.toFixed(4) + b1.toFixed(4);
    const res = trFind(A, B, kinds, false); TR.opts[key] = res.opts; TR.ctx[key] = { A, B };
    if (!res.opts.length) { el.innerHTML = `<small>ไม่พบสายรถตรงระหว่างสองจุดนี้ในข้อมูล (ค้นรัศมี ${res.rad / 1000} กม.) ลองใช้วิน แท็กซี่ หรือปุ่ม Google Maps</small>`; return; }
    el.innerHTML = res.opts.slice(0, 4).map((o, i) => optHTML(o, key, i)).join('') + `<small>${GT_NOTE}</small>`;
  });
}
TR.ctx = {}; TR.sig = 0;
function trAltFill() { // whole-trip options without the metro
  const el = $('tralt'); if (!el || !el.dataset.k) return;
  const kinds = allowedKinds(); kinds.delete('t'); const body = el.querySelector('.trbody'), sum = el.querySelector('.trsum');
  if (!kinds.size) { body.innerHTML = '<small>โหมดที่เลือกไม่รวมรถเมล์/เรือ</small>'; sum.textContent = ''; return; }
  if (!TR.ready) { body.innerHTML = '<small>กำลังโหลดข้อมูลสายรถ…</small>'; trLoad().then(() => trAltFill()); return; }
  const [a1, a2, b1, b2] = el.dataset.k.split(',').map(Number), A = { lat: a1, lng: a2 }, B = { lat: b1, lng: b2 }, key = 'alt';
  const res = trFind(A, B, kinds, true); TR.opts[key] = res.opts; TR.ctx[key] = { A, B };
  if (!res.opts.length) { body.innerHTML = `<small>ไม่พบสายรถตรงหรือต่อรถ 1 ครั้งระหว่างสองจุดนี้ในข้อมูล (ค้นรัศมีถึง ${res.rad / 1000} กม.) ข้อมูลยังไม่ครอบคลุมทุกพื้นที่</small>`; sum.textContent = 'ไม่พบ'; return; }
  sum.textContent = `${res.opts.length} ทางเลือก · เร็วสุด ~${Math.round(res.opts[0].min)} นาที`;
  body.innerHTML = res.opts.slice(0, 6).map((o, i) => optHTML(o, key, i)).join('') + `<small>${GT_NOTE}</small>`;
}
function trAltHTML(open) {
  if (!TILES) return '';
  const A = endPt('from'), B = endPt('to'); if (!A || !B) return '';
  const kinds = allowedKinds(); kinds.delete('t'); if (!kinds.size) return '';
  return `<details class="card alts notes tralt" id="tralt" data-k="${A.lat},${A.lng},${B.lat},${B.lng}"${open ? ' open' : ''}><summary>🚌⛴ ไปโดยไม่ใช้รถไฟฟ้า (รถเมล์ · เรือ · รถตู้ · สองแถว) <span class="trsum"></span></summary><div class="trbody"><small>กำลังค้นหา…</small></div></details>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-tro]'); if (!b) return; const [key, i] = b.dataset.tro.split(':'), o = (TR.opts[key] || [])[+i]; if (!o) return;
  const c = TR.ctx[key] || {}; trDrawOpt(o, c.A, c.B);
});

/* ---------- layers panel (☰ next to the search) ---------- */
const LYR = [['rail', '🚇', 'รถไฟฟ้า (BTS · MRT · ARL · สายสีแดง · สายสีทอง)', '#1b9e5a'], ...KORDER.map(k => [k, KIND[k].ic, KIND[k].th, KIND[k].c])];
function setRail(on) { for (const lid of Object.keys(LINES)) on ? st.vis.add(lid) : st.vis.delete(lid); document.querySelectorAll('.lchip').forEach(b => b.setAttribute('aria-pressed', String(on))); }
function lyrRender() {
  const cnt = k => k === 'rail' ? Object.keys(LINES).length + ' สาย' : TR.ready ? TR.byKind[k].length + ' สาย' : '';
  $('lyrlist').innerHTML = LYR.map(([k, ic, th, c]) => `<label class="lk"><input type="checkbox" data-k="${k}"${TR.on.has(k) ? ' checked' : ''}><i style="background:${c}"></i><span>${ic} ${th}</span><small>${cnt(k)}</small></label>`).join('')
    + `<label class="lk"><input type="checkbox" data-k="stops"${TR.stops ? ' checked' : ''}><i style="background:#fff;border:2px solid #e8590c"></i><span>📍 ป้ายรถ / ท่าเรือ (ซูมใกล้)</span></label><label class="lk"><input type="checkbox" data-k="parking"${TR.parking ? ' checked' : ''}><i style="background:#1971c2"></i><span>🅿 ที่จอดรถใกล้สถานี</span></label>`;
}
function lyrApply() { setRail(TR.on.has('rail')); lyrRender(); trSave(); draw(); trSync(); }
function trInitUI() {
  trInitMap();
  const btn = $('lyrbtn'), pan = $('lyr');
  btn.onclick = () => { pan.hidden = !pan.hidden; btn.setAttribute('aria-expanded', String(!pan.hidden)); if (!pan.hidden) trLoad().then(() => { lyrRender(); }); };
  pan.querySelector('.x').onclick = () => { pan.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  const PRE = { all: ['rail', ...KORDER], rail: ['rail', 't'], boat: ['f'], bus: ['b', 'p'], none: [] };
  pan.querySelector('.lpre').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; TR.on = new Set(PRE[b.dataset.p]); lyrApply(); trLoad().then(() => trSync()); };
  $('lyrlist').onchange = e => { const k = e.target.dataset.k; if (k === 'stops' || k === 'parking') TR[k] = e.target.checked; else e.target.checked ? TR.on.add(k) : TR.on.delete(k); lyrApply(); trLoad().then(() => { lyrRender(); trSync(); }); };
  const q = $('lyrq'), res = $('lyrres');
  q.oninput = () => {
    const s = q.value.trim().toLowerCase(); if (!s) { res.innerHTML = ''; return; }
    trLoad().then(ok => {
      if (!ok) { res.innerHTML = '<li><small>ข้อมูลสายรถไม่พร้อมในเบราว์เซอร์นี้</small></li>'; return; }
      const hit = []; TR.R.forEach((r, i) => { const sc = r.sn.toLowerCase() === s ? 0 : r.sn.toLowerCase().startsWith(s) ? 1 : (r.ln + ' ' + r.sn + ' ' + r.ag).toLowerCase().includes(s) ? 2 : 9; if (sc < 9) hit.push([sc, KORDER.indexOf(r.k), i]); });
      hit.sort((a, b) => a[0] - b[0] || a[1] - b[1]); res.innerHTML = hit.slice(0, 25).map(([, , i]) => `<li><button type="button" data-r="${i}">${legChip({ p: TR.R[i].pats[0] })}<small>${esc(TR.R[i].ln.slice(0, 40))}</small></button></li>`).join('') || '<li><small>ไม่พบสาย</small></li>';
    });
  };
  res.onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; trShowRoute(+b.dataset.r); pan.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  lyrRender();
  // travel-mode buttons in the planner
  $('modes').innerHTML = MODEPRE.map(([k, l]) => `<button type="button" class="mbtn" data-m="${k}" aria-pressed="${k === st.mode}">${l}</button>`).join('');
  $('modes').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; st.mode = b.dataset.m; try { localStorage.setItem('rail-mode', st.mode); } catch (x) {} TR.sig++; $('modes').querySelectorAll('.mbtn').forEach(x => x.setAttribute('aria-pressed', String(x === b))); if (hasEnds()) go({ keep: true }); };
  $('lyrsnap').checked = SNAP.on; $('lyrsnap').onchange = e => { SNAP.on = e.target.checked; try { localStorage.setItem('rail-snap', SNAP.on ? '1' : '0'); } catch (x) {} if (SNAP.on) trSnapSync(); };
  map.on('moveend zoomend', trSync); map.on('click', trClearHL);
  trLoad().then(ok => { if (!ok) { $('lyrhint').textContent = 'ข้อมูลสายรถโหลดไม่ได้ (เบราว์เซอร์ไม่รองรับการแตกไฟล์ข้อมูล)'; return; } lyrRender(); trSync(); });
}
