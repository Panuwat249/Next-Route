/* ---------- access legs (to / from the station) ---------- */
function nearestStations(pt, k = 3, maxKm = 3.5) { // the nearest station always first; others only if almost as close
  const all = PL.map(p => ({ place: p.id, km: kmBetween(placeLL(p.id), pt) })).sort((a, b) => a.km - b.km), n0 = all[0];
  const out = all.filter(x => x === n0 || (x.km <= maxKm && x.km <= n0.km + .35)).slice(0, k); // the nearest station always counts, however far (anywhere in Thailand)
  out.forEach(x => { x.nearest = n0; });
  return out;
}
function accessVariants(km) {
  const road = km * 1.3, far = road > 15; // beyond ~15 km the bus/van/taxi run at road speed, not city speed
  const W = { mode: 'walk', label: 'เดิน', min: road / 4.8 * 60, cost: 0 };
  const B = { mode: 'bus', label: far ? 'รถตู้/รถเมล์/สองแถว' : 'รถเมล์/สองแถว', min: 8 + road / (far ? 32 : 14) * 60, cost: far ? Math.round((20 + road * 1.1) / 5) * 5 : road < 3 ? 10 : road < 6 ? 15 : 20 };
  const V = { mode: 'win', label: 'วินมอเตอร์ไซค์', min: 3 + road / 25 * 60, cost: Math.round((20 + Math.max(0, road - 1.5) * 8) / 5) * 5 };
  const T = { mode: 'taxi', label: 'แท็กซี่/รถรับจ้าง', min: 4 + road / (far ? 45 : 20) * 60, cost: Math.round(35 + Math.max(0, road - 1) * 7 + road * 1.5) };
  if (road <= .15) return [{ mode: 'walk', label: 'เดิน', min: 1, cost: 0 }];
  const cheap = road <= 1.6 ? W : B, fast = road <= .7 ? W : road <= 6 ? V : T;
  return cheap.mode === fast.mode ? [cheap] : [cheap, fast];
}
const ZERO = [{ mode: 'none', label: '', min: 0, cost: 0 }];
function planPoints(minute, weekend) {
  const O = st.fromPt, D = st.toPt, now = Date.now();
  const oc = O ? nearestStations(O) : [{ place: st.from, km: 0 }], dc = D ? nearestStations(D) : [{ place: st.to, km: 0 }];
  const combos = []; let anyPair = false;
  for (const a of oc) for (const b of dc) {
    if (a.place === b.place) continue; anyPair = true;
    const ao = O ? accessVariants(a.km) : ZERO, bo = D ? accessVariants(b.km) : ZERO, m0 = minute + ao[0].min;
    const pl = planRoutes(a.place, b.place, m0, weekend, now); if (!pl) continue;
    const set = new Set([...Object.values(pl.picks), ...pl.routes.slice().sort((x, y) => x.total - y.total).slice(0, 4)]);
    for (const r of set) for (const x of ao) for (const y of bo) {
      const last = r.legs[r.legs.length - 1], arrive = last.alight + r.endWalk.reduce((s, w) => s + w.walk, 0) + y.min + (x.min - ao[0].min);
      const groups = [].concat(O && x.cost ? [{ label: x.label + ' ไปสถานี (ประมาณ)', fare: x.cost, hops: 0, adj: [], note: '', access: true }] : [], r.fare.groups, D && y.cost ? [{ label: y.label + ' จากสถานี (ประมาณ)', fare: y.cost, hops: 0, adj: [], note: '', access: true }] : []);
      combos.push(Object.assign({}, r, { total: x.min + r.total + y.min, arrive, depart: minute, fare: Object.assign({}, r.fare, { total: r.fare.total + x.cost + y.cost, groups }),
        acc: { o: { st: O ? a : null, pt: O, opt: x }, d: { st: D ? b : null, pt: D, opt: y } },
        walkAll: r.walk + (x.mode === 'walk' ? x.min : 0) + (y.mode === 'walk' ? y.min : 0) }));
    }
  }
  if (!combos.length) return { err: anyPair ? 'ไม่พบเส้นทางรถไฟฟ้าระหว่างสองจุดนี้' : 'ต้นทางและปลายทางอยู่ใกล้สถานีเดียวกัน ไม่จำเป็นต้องนั่งรถไฟฟ้า ให้เดินหรือใช้ Google Maps (ปุ่มด้านล่างหมุด)' };
  const best = f => combos.slice().sort(f)[0], score = r => r.fare.total + .8 * r.total + 4 * r.transfers;
  const picks = {
    cheapest: best((a, b) => a.fare.total - b.fare.total || a.total - b.total),
    fastest: best((a, b) => a.total - b.total || a.fare.total - b.fare.total),
    fewest: best((a, b) => a.transfers - b.transfers || a.walkAll - b.walkAll || a.total - b.total),
    value: best((a, b) => score(a) - score(b))
  };
  const seen = new Set(), routes = combos.slice().sort((a, b) => a.total - b.total).filter(r => { const k = sigOf(r); if (seen.has(k)) return false; seen.add(k); return true; });
  for (const p of Object.values(picks)) if (!routes.includes(p)) routes.push(p);
  return { routes, picks, count: routes.length };
}

