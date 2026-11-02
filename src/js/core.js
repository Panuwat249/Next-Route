/* core.js: graph, route search and fares. No DOM access, so it can be tested in Node. */
const NODES = DATA.nodes, LINES = DATA.lines, PLACES = DATA.places;
const ADJ = {}, EDGE = {};
const RAD = Math.PI / 180;

function hav(a, b) {
  const dLat = (b.lat - a.lat) * RAD, dLng = (b.lng - a.lng) * RAD;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}
function link(a, b, e) {
  (ADJ[a] = ADJ[a] || []).push(b); (ADJ[b] = ADJ[b] || []).push(a);
  EDGE[a + '|' + b] = Object.assign({ a, b }, e); EDGE[b + '|' + a] = Object.assign({ a: b, b: a }, e);
}
for (const [lid, L] of Object.entries(LINES)) {
  for (const p of L.paths) for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    if (EDGE[a + '|' + b]) continue;
    const d = hav(NODES[a], NODES[b]);
    link(a, b, { kind: 'ride', line: lid, min: L.fixed != null ? L.fixed : Math.max(1.3, d / L.v * 60), dist: d });
  }
}
for (const x of DATA.xfer) link(x.a, x.b, { kind: 'xfer', min: x.min, note: x.note, info: x });

/* ---------- service pattern (estimated headways, not live data) ---------- */
function isPeak(minute, weekend) { return !weekend && ((minute >= 390 && minute < 570) || (minute >= 990 && minute < 1170)); }
function headway(lid, minute, weekend) {
  const h = LINES[lid].hw;
  return weekend ? h[2] : (isPeak(minute, weekend) ? h[0] : h[1]);
}

/* ---------- fares (baht). Rates as of Oct 2026; see notes in the page ---------- */
const FARE_CAP_END = Date.UTC(2026, 11, 1); // 40-baht Purple/Red daily cap runs to 30 Nov 2026
const BTS_CORE = [0, 17, 25, 28, 32, 35, 40, 45, 47];
const BLUE_TAB = [0, 17, 20, 22, 25, 27, 29, 32, 34, 37, 39, 42, 44];
const MRTA = new Set(['BLUE', 'PURPLE', 'YELLOW', 'PINK']);
const BTS_EXT = new Set();
for (let n = 9; n <= 24; n++) if (n !== 6) BTS_EXT.add('N' + n);
for (let n = 15; n <= 23; n++) BTS_EXT.add('E' + n);
for (let n = 7; n <= 12; n++) BTS_EXT.add('S' + n);

function groupFare(g) {
  const n = g.hops;
  switch (g.sys) {
    case 'BTS': {
      const core = g.core ? BTS_CORE[Math.min(g.core, 8)] : 0;
      const ext = g.ext ? Math.min(45, 17 + 3 * (g.ext - 1)) : 0;
      const sum = core + ext;
      return { fare: g.core && g.ext ? Math.min(65, sum) : sum, note: g.core && g.ext ? 'ผสมส่วนหลัก+ส่วนต่อขยาย (สูงสุด 65)' : (g.ext ? 'ส่วนต่อขยาย คิดตามระยะ' : '') };
    }
    case 'GOLD': return { fare: 16, note: 'อัตราเดียว' };
    case 'BLUE': return { fare: BLUE_TAB[Math.min(n, 12)], note: '' };
    case 'PURPLE': return { fare: Math.min(42, 14 + 2 * (n - 1)), note: '' };
    case 'YELLOW': case 'PINK': return { fare: Math.min(45, Math.round(15 + 2.3 * n)), note: 'ประมาณการตามระยะทาง' };
    case 'ARL': return { fare: 10 + 5 * n, note: '' };
    case 'RED': return { fare: Math.min(42, Math.round(12 + 3.75 * (n - 1))), note: 'ประมาณการตามระยะทาง' };
  }
  return { fare: 0, note: '' };
}
const SYS_LABEL = { BTS: 'BTS', GOLD: 'สายสีทอง', BLUE: 'MRT สีน้ำเงิน', PURPLE: 'MRT สีม่วง', YELLOW: 'MRT สีเหลือง', PINK: 'MRT สีชมพู', ARL: 'ARL', RED: 'SRT สายสีแดง' };

function computeFare(legs, now) {
  const groups = [];
  legs.forEach((leg, i) => {
    const sys = LINES[leg.line].sys, last = groups[groups.length - 1];
    const sameStation = leg.before.length > 0 && leg.before.every(x => NODES[x.from].place === NODES[x.to].place);
    let g = last && last.sys === sys && (sys === 'BTS' || sys === 'RED' || sys === 'BLUE') && sameStation ? last : null;
    if (!g) { g = { sys, hops: 0, core: 0, ext: 0, legs: [] }; groups.push(g); }
    g.legs.push(i); g.hops += leg.hops;
    for (let k = 0; k < leg.nodes.length - 1; k++) {
      if (BTS_EXT.has(leg.nodes[k]) || BTS_EXT.has(leg.nodes[k + 1])) g.ext++; else g.core++;
    }
  });
  const out = groups.map(g => { const f = groupFare(g); return { sys: g.sys, label: SYS_LABEL[g.sys], hops: g.hops, fare: f.fare, note: f.note, legs: g.legs, adj: [] }; });
  for (let i = 1; i < out.length; i++) {
    if (MRTA.has(out[i].sys) && MRTA.has(out[i - 1].sys)) {
      const nf = Math.max(3, out[i].fare - 14);
      out[i].adj.push('ส่วนลดเปลี่ยนสาย MRT −' + (out[i].fare - nf)); out[i].fare = nf;
    }
  }
  if (now < FARE_CAP_END) {
    let run = 0;
    for (const g of out) {
      if (g.sys !== 'PURPLE' && g.sys !== 'RED') continue;
      const allowed = Math.max(0, 40 - run);
      if (g.fare > allowed) { g.adj.push('เพดาน 40 บาท/วัน (บัตร EMV) −' + (g.fare - allowed)); g.fare = allowed; }
      run += g.fare;
    }
  }
  return { total: out.reduce((s, g) => s + g.fare, 0), groups: out };
}

/* ---------- shortest paths ---------- */
class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}
const FARE_HOP = { BTS: 3.6, GOLD: 8, BLUE: 2.6, PURPLE: 2, YELLOW: 2.3, PINK: 2.3, ARL: 5, RED: 3 };
function xferCost(e) {
  const a = LINES[NODES[e.a].line].sys, b = LINES[NODES[e.b].line].sys;
  if ((a === 'BTS' && b === 'BTS') || (a === 'RED' && b === 'RED')) return 0.5;
  if (MRTA.has(a) && MRTA.has(b)) return 3;
  return 16;
}
const MODES = {
  time: (e, c) => e.kind === 'ride' ? e.min : e.min + headway(NODES[e.b].line, c.minute, c.weekend) / 2,
  few: e => e.kind === 'ride' ? 1 + 0.03 * e.min : 15,
  fare: e => e.kind === 'ride' ? FARE_HOP[LINES[e.line].sys] + 0.05 * e.min : xferCost(e) + 0.05 * e.min,
};
function edgeW(a, b, c, mode) {
  if (a === '__S' || b === '__T') return 0;
  return MODES[mode](EDGE[a + '|' + b], c);
}
function dijkstra(c, mode, banN, banE, start) {
  const dist = new Map([[start, 0]]), prev = new Map(), h = new Heap();
  h.push(0, start);
  while (h.size) {
    const [d, u] = h.pop();
    if (d > dist.get(u)) continue;
    if (u === '__T') break;
    const nb = u === '__S' ? c.src : (c.dst.has(u) ? ADJ[u].concat('__T') : ADJ[u]);
    for (const v of nb) {
      if (banN.has(v) || banE.has(u + '|' + v)) continue;
      const nd = d + edgeW(u, v, c, mode);
      if (nd < (dist.has(v) ? dist.get(v) : Infinity)) { dist.set(v, nd); prev.set(v, u); h.push(nd, v); }
    }
  }
  if (!dist.has('__T')) return null;
  const path = ['__T']; while (path[0] !== start) path.unshift(prev.get(path[0]));
  return path;
}
function pathCost(p, c, mode) { let s = 0; for (let i = 0; i < p.length - 1; i++) s += edgeW(p[i], p[i + 1], c, mode); return s; }
function yen(c, mode, K) {
  const first = dijkstra(c, mode, new Set(), new Set(), '__S');
  if (!first) return [];
  const A = [first], B = [], seen = new Set([first.join()]);
  for (let k = 1; k < K; k++) {
    const prev = A[k - 1];
    for (let i = 0; i < prev.length - 1; i++) {
      const root = prev.slice(0, i + 1), banN = new Set(root.slice(0, -1)), banE = new Set();
      for (const p of A) if (p.length > i + 1 && root.every((x, j) => p[j] === x)) banE.add(p[i] + '|' + p[i + 1]);
      const sp = dijkstra(c, mode, banN, banE, prev[i]);
      if (!sp) continue;
      const total = root.slice(0, -1).concat(sp), key = total.join();
      if (!seen.has(key)) { seen.add(key); B.push({ p: total, w: pathCost(total, c, mode) }); }
    }
    if (!B.length) break;
    B.sort((x, y) => x.w - y.w);
    A.push(B.shift().p);
  }
  return A;
}

/* ---------- describing a path ---------- */
function describe(path, c) {
  const legs = []; let pending = [];
  let i = 0;
  while (i < path.length - 1) {
    const e = EDGE[path[i] + '|' + path[i + 1]];
    if (e.kind === 'xfer') { pending.push({ from: path[i], to: path[i + 1], walk: e.min, note: e.note, info: e.info }); i++; continue; }
    const nodes = [path[i]]; let ride = 0, j = i;
    while (j < path.length - 1) {
      const ee = EDGE[path[j] + '|' + path[j + 1]];
      if (ee.kind !== 'ride' || ee.line !== e.line) break;
      nodes.push(path[j + 1]); ride += ee.min; j++;
    }
    legs.push({ line: e.line, nodes, from: nodes[0], to: nodes[nodes.length - 1], hops: nodes.length - 1, ride, before: pending });
    pending = []; i = j;
  }
  if (!legs.length) return null;
  // timeline
  let cur = c.minute, wait = 0, walk = 0, ride = 0; const warns = [];
  legs.forEach((lg, k) => {
    const w = lg.before.reduce((s, x) => s + x.walk, 0); cur += w; walk += w;
    lg.walk = w;
    lg.hw = headway(lg.line, cur % 1440, c.weekend);
    lg.wait = lg.hw / 2; wait += lg.wait; cur += lg.wait;
    lg.board = cur; cur += lg.ride; lg.alight = cur; ride += lg.ride;
    const L = LINES[lg.line];
    if (lg.board % 1440 < L.hours[0] || lg.board % 1440 > L.hours[1]) warns.push(L.short);
  });
  const endWalk = pending.reduce((s, x) => s + x.walk, 0); cur += endWalk; walk += endWalk;
  const fare = computeFare(legs, c.now);
  return { path, legs, endWalk: pending, total: cur - c.minute, ride, wait, walk, transfers: legs.length - 1, fare, warns };
}
function cleanPath(p, oPlace, dPlace) {
  p = p.filter(x => x !== '__S' && x !== '__T');
  while (p.length > 1 && EDGE[p[0] + '|' + p[1]].kind === 'xfer' && NODES[p[0]].place === oPlace && NODES[p[1]].place === oPlace) p.shift();
  while (p.length > 1 && EDGE[p[p.length - 2] + '|' + p[p.length - 1]].kind === 'xfer' && NODES[p[p.length - 1]].place === dPlace && NODES[p[p.length - 2]].place === dPlace) p.pop();
  return p;
}

/* ---------- public: plan routes ---------- */
function planRoutes(oPlace, dPlace, minute, weekend, now) {
  if (oPlace === dPlace) return null;
  const c = { src: PLACES[oPlace], dst: new Set(PLACES[dPlace]), minute, weekend, now: now || Date.now() };
  const seen = new Set(), routes = [];
  for (const [mode, K] of [['time', 40], ['few', 14], ['fare', 28]]) {
    for (const p0 of yen(c, mode, K)) {
      const p = cleanPath(p0, oPlace, dPlace);
      if (p.length < 2) continue;
      const key = p.join();
      if (seen.has(key)) continue;
      seen.add(key);
      const r = describe(p, c);
      if (r) routes.push(r);
    }
  }
  if (!routes.length) return null;
  const best = (f) => routes.slice().sort(f)[0];
  const cheapest = best((a, b) => a.fare.total - b.fare.total || a.total - b.total || a.transfers - b.transfers);
  const fastest = best((a, b) => a.total - b.total || a.fare.total - b.fare.total);
  const fewest = best((a, b) => a.transfers - b.transfers || a.total - b.total || a.fare.total - b.fare.total);
  const score = r => r.fare.total + 0.8 * r.total + 4 * r.transfers;
  const value = best((a, b) => score(a) - score(b));
  return { routes, picks: { cheapest, fastest, fewest, value }, count: routes.length };
}
