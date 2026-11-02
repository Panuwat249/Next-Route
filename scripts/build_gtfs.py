# usage: python3 -I build_gtfs.py <namtang_gtfs_dir> <parking.txt> <out.js>
# Compacts the Namtang GTFS feed (whole Thailand) into one gzip+base64 JS constant for the standalone build.
import csv, sys, json, collections, statistics, os, gzip, base64, math
src, parking, out = sys.argv[1:4]
rd = lambda n: csv.DictReader(open(os.path.join(src, n), encoding='utf-8'))
th = lambda s: (s or '').split(';')[0].strip()
A = {a['agency_id']: th(a['agency_name']) for a in rd('agency.txt')}
R = {r['route_id']: r for r in rd('routes.txt')}
def kind(r):
    ag, ty, d = r['agency_id'], r['route_type'], th(r['route_desc'])
    if ty in ('0', '1') or ag == 'SRTET': return None          # BTS / MRT / ARL / SRT Red lines: already in the planner
    if ty == '4': return 'f'
    if ty == '2': return 't'
    if ag in ('BMTA', 'TSB', 'BTK', 'PMCU') or 'BMA Feeder' in d: return 'b'
    if 'รถตู้' in d: return 'v'
    if 'ในซอย' in d: return 's'
    if 'ปริมณฑล' in d: return 'p'
    return 'i'
trips = collections.defaultdict(list); tinfo = {}
for t in rd('trips.txt'):
    if kind(R[t['route_id']]): trips[t['route_id']].append(t['trip_id']); tinfo[t['trip_id']] = t
need = set(tinfo); seq = collections.defaultdict(list)
for x in rd('stop_times.txt'):
    if x['trip_id'] in need: seq[x['trip_id']].append((int(x['stop_sequence']), x['stop_id']))
hw = collections.defaultdict(list); win = collections.defaultdict(lambda: [10**9, -1])
mins = lambda s: int(s[:2]) * 60 + int(s[3:5])
for f in rd('frequencies.txt'):
    t = tinfo.get(f['trip_id'])
    if not t: continue
    rid = t['route_id']; hw[rid].append(int(f['headway_secs']) / 60)
    w = win[rid]; w[0] = min(w[0], mins(f['start_time'])); w[1] = max(w[1], mins(f['end_time']))
S = {s['stop_id']: s for s in rd('stops.txt')}
names, nidx = [], {}
def nm(i):
    n = th(S[i]['stop_name'])
    if 'visual stop' in S[i]['stop_name']: n = ''
    if n not in nidx: nidx[n] = len(names); names.append(n)
    return nidx[n]
stops, sidx = [], {}
def si(i):
    if i not in sidx: s = S[i]; sidx[i] = len(stops); stops.append([nm(i), round(float(s['stop_lat']), 5), round(float(s['stop_lon']), 5)])
    return sidx[i]
# shapes -> simplified (Douglas-Peucker ~10 m) -> Google polyline strings
need_shapes = {t['shape_id'] for t in tinfo.values() if t['shape_id']}
raw = collections.defaultdict(list)
for r in rd('shapes.txt'):
    if r['shape_id'] in need_shapes: raw[r['shape_id']].append((int(r['shape_pt_sequence']), float(r['shape_pt_lat']), float(r['shape_pt_lon'])))
TOL = 10.0
def dp(pts):
    n = len(pts); 
    if n < 3: return pts
    k = math.cos(math.radians(pts[0][0])) * 111320.0; m = 110574.0
    xy = [((p[1]) * k, p[0] * m) for p in pts]; keep = [False] * n; keep[0] = keep[-1] = True; st = [(0, n - 1)]
    while st:
        a, b = st.pop()
        if b <= a + 1: continue
        ax, ay = xy[a]; bx, by = xy[b]; dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy; best = -1; bi = -1
        for i in range(a + 1, b):
            px, py = xy[i]
            if L2 == 0: d = math.hypot(px - ax, py - ay)
            else:
                u = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2)); d = math.hypot(px - ax - u * dx, py - ay - u * dy)
            if d > best: best = d; bi = i
        if best > TOL: keep[bi] = True; st.append((a, bi)); st.append((bi, b))
    return [p for p, k2 in zip(pts, keep) if k2]
def enc(pts):
    o = []; pl = pn = 0
    for la, lo in pts:
        a, b = round(la * 1e5), round(lo * 1e5)
        for v in (a - pl, b - pn):
            v = ~(v << 1) if v < 0 else v << 1
            while v >= 0x20: o.append(chr((0x20 | (v & 0x1f)) + 63)); v >>= 5
            o.append(chr(v + 63))
        pl, pn = a, b
    return ''.join(o)
import numpy as np
shp, shidx, simp, npts = [], {}, {}, [0, 0]
def simplified(sid):
    if sid not in simp:
        p = [(la, lo) for _, la, lo in sorted(raw[sid])]; q = dp(p); npts[0] += len(p); npts[1] += len(q); simp[sid] = q
    return simp[sid]
def good(q, stp, loose=False):  # does the feed's shape really follow the stops? (some routes ship a coarse zig-zag line)
    if len(q) < 2: return False
    k = math.cos(math.radians(q[0][0])) * 111320.0
    P = np.array([[(o) * k, a * 110574.0] for a, o in q]); S_ = np.array([[o * k, a * 110574.0] for a, o in stp])
    A, B = P[:-1], P[1:]; D = B - A; L2 = (D ** 2).sum(1); L2[L2 == 0] = 1e-9
    dmin = np.full(len(S_), 1e9)
    for i, s_ in enumerate(S_):
        u = np.clip(((s_ - A) * D).sum(1) / L2, 0, 1); C = A + D * u[:, None]; dmin[i] = np.sqrt(((C - s_) ** 2).sum(1)).min()
    if loose: return np.percentile(dmin, 90) <= 700 and dmin.max() <= 3000   # trains: the feed lists only a few stops near Bangkok, but the shape runs the whole way
    return np.percentile(dmin, 90) <= 80 and dmin.max() <= 300
def sh(sid, stp, loose=False):
    q = simplified(sid)
    if not good(q, stp, loose): return -1
    if sid not in shidx: shidx[sid] = len(shp); shp.append(enc(q))
    return shidx[sid]
descs, didx = [], {}; ags, agx = [], {}
routes, ridx, pats = [], {}, []
fm = lambda m: '%02d:%02d' % ((m // 60) % 24, m % 60)
SVC = {'1': 'wd', '2': 'we', '3': 'all'}
for rid, ts in trips.items():
    r = R[rid]; d = th(r['route_desc']).replace('รถโดยสารประจำทาง ', '')
    if d not in didx: didx[d] = len(descs); descs.append(d)
    if r['agency_id'] not in agx: agx[r['agency_id']] = len(ags); ags.append(A.get(r['agency_id'], r['agency_id']))
    h = hw.get(rid); w = win.get(rid); ok = w and w[1] >= 0
    ridx[rid] = len(routes)
    routes.append([r['route_short_name'].strip(), th(r['route_long_name']), kind(r), r['route_color'].lstrip('#').lower(), didx[d], agx[r['agency_id']], round(statistics.median(h)) if h else 0, fm(w[0]) if ok else '', fm(w[1]) if ok else ''])
    seen = set()
    for t in ts:
        s = tuple(si(i) for _, i in sorted(seq[t]))
        if len(s) < 2 or s in seen: continue
        seen.add(s); pats.append([ridx[rid], th(tinfo[t]['trip_headsign']), list(s), sh(tinfo[t]['shape_id'], [(stops[i][1], stops[i][2]) for i in s], kind(r) == 't')])
PK = []
for l in open(parking, encoding='utf-8'):
    if not l.strip(): continue
    c = next(csv.reader([l.strip()], quotechar="'", skipinitialspace=True))
    PK.append([c[1], round(float(c[3]), 5), round(float(c[4]), 5), (c[6] or '').replace('<br>', ' · '), c[10] if len(c) > 10 else ''])
data = dict(v='2569-11-02', N=names, S=stops, D=descs, G=ags, R=routes, P=pats, H=shp, PK=PK)
js = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
z = base64.b64encode(gzip.compress(js, 9)).decode()
open(out, 'w', encoding='utf-8').write('const GTFS_Z="' + z + '";\n')
print('noshape', sum(1 for p in pats if p[3] < 0), 'routes', len(routes), 'patterns', len(pats), 'stops', len(stops), 'shapes', len(shp), 'pts', npts, 'json', len(js), 'b64', len(z), 'parking', len(PK))
