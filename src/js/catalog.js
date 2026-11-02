/* catalog.js: "ดูสายทั้งหมด" — browse every route that has data.
   Home (kinds) → groups (rail: operator · train: line · bus: operator · van/coach/songthaew: region) → rounded cards with the route number (ascending) → route page (stops in order, shown on the map).
   Needs transit.js (TR, KIND, trShowRoute …) and ui.js (esc, inkOn, showStation). Standalone file only. */
const PROVS = `กรุงเทพมหานคร|13.75|100.50|BM
นนทบุรี|13.86|100.51|BM
ปทุมธานี|14.02|100.53|BM
สมุทรปราการ|13.60|100.60|BM
สมุทรสาคร|13.55|100.27|BM
นครปฐม|13.82|100.06|BM
พระนครศรีอยุธยา|14.35|100.57|C
อ่างทอง|14.59|100.45|C
ลพบุรี|14.80|100.65|C
สิงห์บุรี|14.89|100.40|C
ชัยนาท|15.19|100.13|C
สระบุรี|14.53|100.91|C
นครนายก|14.21|101.21|C
สุพรรณบุรี|14.47|100.12|C
อุทัยธานี|15.38|100.02|C
ชลบุรี|13.36|100.98|E
ระยอง|12.68|101.28|E
จันทบุรี|12.61|102.10|E
ตราด|12.24|102.52|E
ฉะเชิงเทรา|13.69|101.07|E
ปราจีนบุรี|14.05|101.37|E
สระแก้ว|13.82|102.07|E
กาญจนบุรี|14.02|99.53|W
ราชบุรี|13.53|99.81|W
เพชรบุรี|13.11|99.94|W
ประจวบคีรีขันธ์|11.81|99.80|W
สมุทรสงคราม|13.41|100.00|W
ตาก|16.88|99.13|W
เชียงใหม่|18.79|98.98|N
เชียงราย|19.91|99.83|N
ลำปาง|18.29|99.49|N
ลำพูน|18.57|99.01|N
แม่ฮ่องสอน|19.30|97.97|N
น่าน|18.78|100.78|N
พะเยา|19.17|99.90|N
แพร่|18.14|100.14|N
อุตรดิตถ์|17.63|100.10|N
สุโขทัย|17.01|99.82|N
พิษณุโลก|16.82|100.26|N
พิจิตร|16.44|100.35|N
กำแพงเพชร|16.48|99.52|N
นครสวรรค์|15.70|100.14|N
เพชรบูรณ์|16.42|101.16|N
นครราชสีมา|14.97|102.10|NE
บุรีรัมย์|14.99|103.10|NE
สุรินทร์|14.88|103.49|NE
ศรีสะเกษ|15.12|104.32|NE
อุบลราชธานี|15.24|104.85|NE
ยโสธร|15.79|104.15|NE
ชัยภูมิ|15.81|102.03|NE
อำนาจเจริญ|15.86|104.63|NE
หนองบัวลำภู|17.20|102.44|NE
ขอนแก่น|16.44|102.83|NE
อุดรธานี|17.41|102.79|NE
เลย|17.49|101.72|NE
หนองคาย|17.88|102.74|NE
มหาสารคาม|16.18|103.30|NE
ร้อยเอ็ด|16.05|103.65|NE
กาฬสินธุ์|16.43|103.51|NE
สกลนคร|17.16|104.15|NE
นครพนม|17.41|104.78|NE
มุกดาหาร|16.54|104.72|NE
บึงกาฬ|18.36|103.65|NE
ชุมพร|10.49|99.18|S
ระนอง|9.96|98.64|S
สุราษฎร์ธานี|9.14|99.33|S
พังงา|8.45|98.53|S
ภูเก็ต|7.88|98.39|S
กระบี่|8.06|98.91|S
นครศรีธรรมราช|8.43|99.96|S
ตรัง|7.56|99.61|S
พัทลุง|7.62|100.08|S
สตูล|6.62|100.07|S
สงขลา|7.20|100.60|S
ปัตตานี|6.87|101.25|S
ยะลา|6.54|101.28|S
นราธิวาส|6.43|101.82|S
หาดใหญ่|7.01|100.47|=สงขลา
เกาะสมุย|9.51|100.00|=สุราษฎร์ธานี
เกาะเต่า|10.09|99.84|=สุราษฎร์ธานี
เกาะลันตา|7.62|99.05|=กระบี่
พีพี|7.74|98.77|=กระบี่
พัทยา|12.93|100.88|=ชลบุรี
เกาะสีชัง|13.15|100.81|=ชลบุรี
เกาะช้าง|12.05|102.35|=ตราด
หัวหิน|12.57|99.96|=ประจวบคีรีขันธ์
ชะอำ|12.80|99.97|=เพชรบุรี
อรัญประเทศ|13.69|102.50|=สระแก้ว
แม่สอด|16.72|98.57|=ตาก
ปากช่อง|14.70|101.42|=นครราชสีมา
แม่สาย|20.43|99.88|=เชียงราย
เบตง|5.77|101.07|=ยะลา
สุไหงโก-ลก|6.03|101.97|=นราธิวาส
ทุ่งสง|8.17|99.68|=นครศรีธรรมราช
สะเดา|6.64|100.42|=สงขลา
กันตัง|7.41|99.52|=ตรัง
น้ำตก|14.35|98.99|=กาญจนบุรี
หลังสวน|9.95|99.07|=ชุมพร
กบินทร์บุรี|13.99|101.72|=ปราจีนบุรี
ศิลาอาสน์|17.62|100.10|=อุตรดิตถ์
เด่นชัย|17.98|100.05|=แพร่
บ้านคลองลึก|13.70|102.55|=สระแก้ว
ตรัง|7.56|99.61|=ตรัง
ชุมทาง|9.14|99.33|=สุราษฎร์ธานี
บ้านตาขุน|8.95|98.95|=สุราษฎร์ธานี
ประจวบ|11.81|99.80|=ประจวบคีรีขันธ์
สุพรรณ|14.47|100.12|=สุพรรณบุรี
ศรีราชา|13.17|100.93|=ชลบุรี
แหลมฉบัง|13.09|100.89|=ชลบุรี
อยุธยา|14.35|100.57|=พระนครศรีอยุธยา
ภูเก็ต|7.88|98.39|=ภูเก็ต`;
const REGS = [['BM', 'กรุงเทพฯ และปริมณฑล'], ['C', 'ภาคกลาง'], ['N', 'ภาคเหนือ'], ['NE', 'ภาคตะวันออกเฉียงเหนือ (อีสาน)'], ['E', 'ภาคตะวันออก'], ['W', 'ภาคตะวันตก'], ['S', 'ภาคใต้']];
const CATP = [], CATREG = {};
PROVS.split('\n').forEach(l => { const [n, la, ln, r] = l.split('|'); if (r[0] === '=') CATP.push([n, +la, +ln, r.slice(1)]); else { CATP.push([n, +la, +ln, n]); CATREG[n] = r; } });
function catProv(la, ln) { let b = '', bd = 1e9; const k = Math.cos(la * Math.PI / 180); for (const [, pla, pln, prov] of CATP) { const d = (pla - la) ** 2 + ((pln - ln) * k) ** 2; if (d < bd) { bd = d; b = prov; } } return b; }

const CATK = [ // home tiles, in the order people look for them
  ['rail', 'รถไฟฟ้า', '🚇', '#1d4ed8'], ['t', 'รถไฟทางไกล', '🚆', '#b22222'], ['b', 'รถเมล์', '🚌', '#e8590c'], ['f', 'เรือ', '⛴', '#0b7fb3'],
  ['v', 'รถตู้', '🚐', '#c2255c'], ['p', 'รถปริมณฑล', '🚍', '#7048e8'], ['s', 'สองแถว / รถในซอย', '🛻', '#2f9e44'], ['i', 'รถทัวร์ / ต่างจังหวัด', '🚌', '#495057']];
const CATPAL = ['#1971c2', '#e8590c', '#2f9e44', '#c2255c', '#7048e8', '#0b7fb3', '#b08900', '#d6336c', '#0ca678', '#5c7cfa'];
const CAT = { st: [], idx: null, inited: false };

/* ---- facts about every route (cached): its main pattern, where it ends, which province / region ---- */
const catKm = (a, z) => dm(a[1], a[2], z[1], z[2]) / 1000;
function catInfo(ri) {
  const r = TR.R[ri]; if (r.ci) return r.ci;
  let best = r.pats[0]; for (const pi of r.pats) if (TR.P[pi].s.length > TR.P[best].s.length) best = pi;
  const s = TR.P[best].s.map(i => TR.S[i]); let far = s[0], fd = -1, la = 0, ln = 0;
  for (const t of s) { const d = dm(13.75, 100.52, t[1], t[2]); if (d > fd) { fd = d; far = t; } la += t[1]; ln += t[2]; }
  if (r.k === 't') { // the end of the line is named in the route name ("เชียงใหม่ - กรุงเทพ"): trust it over the few stops the feed lists
    for (const part of r.ln.split(';')[0].split(/\s*-\s*/)) { if (/กรุงเทพ|ธนบุรี|หัวลำโพง|วงเวียนใหญ่|บางซื่อ/.test(part)) continue; const m = CATP.filter(c => part.includes(c[0])).sort((a, b) => b[0].length - a[0].length)[0]; if (m) { const d = dm(13.75, 100.52, m[1], m[2]); if (d > fd) { fd = d; far = ['', m[1], m[2]]; } } }
  }
  const sg = TR.P[best].sh >= 0 ? trGeo(best) : null; // the feed lists only a few stops for some long-distance lines, so the drawn shape tells where the line really goes
  if (sg) for (let q = 0; q < sg.length; q += 2) { const d = dm(13.75, 100.52, sg[q], sg[q + 1]); if (d > fd) { fd = d; far = ['', sg[q], sg[q + 1]]; } }
  const span = catKm(s[0], s[s.length - 1]), cen = [la / s.length, ln / s.length];
  const at = span > 40 || r.k === 'i' || fd / 1000 > 60 ? far : null, prov = at ? catProv(at[1], at[2]) : catProv(cen[0], cen[1]);
  let km = 0; for (let k = 1; k < s.length; k++) km += dm(s[k - 1][1], s[k - 1][2], s[k][1], s[k][2]); // along the stops (a lower bound of the real distance)
  if (sg) { let L2 = 0; for (let q = 2; q < sg.length; q += 2) L2 += dm(sg[q - 2], sg[q - 1], sg[q], sg[q + 1]); km = Math.max(km, L2); }
  return r.ci = { best, far, prov, reg: CATREG[prov] || 'BM', farKm: fd / 1000, km: km / 1000, a: s[0], z: s[s.length - 1] };
}
function catTrainLine(ri) { // which main line a long-distance train belongs to, from where it ends
  const r = TR.R[ri], i = catInfo(ri), la = i.far[1], ln = i.far[2];
  if (/มหาชัย|แม่กลอง|วงเวียนใหญ่/.test(r.d) || i.farKm < 65) return ['sub', 'ชานเมือง / รอบกรุงเทพฯ'];
  if (la < 11.5) return ['s', 'สายใต้'];
  if (la > 13.7 && la < 14.6 && ln < 100.2) return ['w', 'สายตะวันตก (กาญจนบุรี – น้ำตก / สุพรรณบุรี)'];
  if (ln >= 100.95) return la > 14.4 ? ['ne', 'สายตะวันออกเฉียงเหนือ (อีสาน)'] : ['e', 'สายตะวันออก'];
  if (la >= 14.2) return ['n', 'สายเหนือ'];
  return ['s', 'สายใต้'];
}
const catKey = s => { const m = /(\d+)/.exec(s); return [/^\d/.test(s) ? 0 : 1, m ? +m[1] : 1e9]; };
const catCmp = (a, b) => { const x = catKey(a.label), y = catKey(b.label); return x[0] - y[0] || x[1] - y[1] || a.label.localeCompare(b.label, 'th'); };
function catLabel(r) {
  if (r.k === 'b') { const m = /\(([^)]+)\)\s*$/.exec(r.sn); if (m) return m[1].trim(); }
  if (r.k === 't') { const m = /^(\d+)\b/.exec(r.sn); if (m) return m[1]; }
  if (r.k === 'f' || r.sn.length > 12) return r.sn.length <= 12 ? r.sn : (r.ln.length <= 26 ? r.ln : r.ln.slice(0, 24) + '…');
  return r.sn;
}
const catColor = (r, fb) => /^#(?!808080$|000000$|ffffff$)[0-9a-f]{6}$/i.test(r.c) ? r.c : fb;

/* ---- the tree: kind → groups → cards (cards merge routes with the same number and operator) ---- */
function catGroups(k) {
  if (CAT.idx[k]) return CAT.idx[k];
  const groups = new Map(), add = (gid, gname, ri, sec) => { let g = groups.get(gid); if (!g) groups.set(gid, g = { id: gid, name: gname, cards: new Map(), n: 0 }); const r = TR.R[ri], lab = catLabel(r), key = lab + '|' + r.ag + '|' + (sec || ''); let c = g.cards.get(key); if (!c) { g.cards.set(key, c = { k, label: lab, ris: [], sec: sec || '', col: null }); } c.ris.push(ri); };
  if (k === 'rail') {
    const SY = { BTS: 'BTS', MRT: 'MRT', ARL: 'แอร์พอร์ต เรล ลิงก์', SRT: 'รถไฟสายสีแดง (SRT)', 'สายสีทอง': 'สายสีทอง' };
    for (const [lid, L] of Object.entries(LINES)) { const gid = L.sysname, g = groups.get(gid) || (groups.set(gid, { id: gid, name: SY[gid] || gid, cards: new Map(), n: 0 }), groups.get(gid)); g.cards.set(lid, { k, label: L.short, line: lid, ris: [], col: L.color, sec: '' }); }
  } else for (const ri of TR.byKind[k] || []) {
    const r = TR.R[ri];
    if (k === 't') { const [gid, gn] = catTrainLine(ri); add(gid, gn, ri); }
    else if (k === 'b') { const a = r.ag || ''; add(/ขนส่งมวลชน/.test(a) ? 'bmta' : /สมายล์/.test(a) ? 'tsb' : /กรุงเทพมหานคร/.test(a) ? 'bma' : 'oth', /ขนส่งมวลชน/.test(a) ? 'ขสมก.' : /สมายล์/.test(a) ? 'ไทย สมายล์ บัส' : /กรุงเทพมหานคร/.test(a) ? 'รถ Feeder (กทม.)' : 'อื่น ๆ', ri); }
    else if (k === 'f') { const n = (r.d || '').split(' ')[0] || 'เรือโดยสาร'; add(n, n, ri); }
    else { const i = catInfo(ri); add(i.reg, (REGS.find(x => x[0] === i.reg) || [, ''])[1], ri, i.prov); }
  }
  const out = [...groups.values()].map(g => { g.list = [...g.cards.values()].sort(catCmp); g.list.forEach((c, i) => { if (!c.col) c.col = catColor(TR.R[c.ris[0]], null); }); g.n = g.list.length; return g; });
  if (k === 'v' || k === 'p' || k === 's' || k === 'i') out.sort((a, b) => REGS.findIndex(x => x[0] === a.id) - REGS.findIndex(x => x[0] === b.id));
  else if (k === 't') out.sort((a, b) => ['n', 'ne', 'e', 's', 'w', 'sub'].indexOf(a.id) - ['n', 'ne', 'e', 's', 'w', 'sub'].indexOf(b.id));
  else if (k === 'rail') out.sort((a, b) => ['BTS', 'MRT', 'ARL', 'SRT', 'สายสีทอง'].indexOf(a.id) - ['BTS', 'MRT', 'ARL', 'SRT', 'สายสีทอง'].indexOf(b.id));
  else out.sort((a, b) => b.n - a.n);
  out.forEach((g, gi) => g.list.forEach(c => { if (!c.col) c.col = (k === 'b' || k === 'f') ? CATK.find(x => x[0] === k)[3] : CATPAL[gi % CATPAL.length]; }));
  return CAT.idx[k] = out;
}
const catCount = k => catGroups(k).reduce((n, g) => n + g.n, 0);

/* ---- drawing ---- */
const catEl = () => $('cat');
const chip = c => `<button type="button" class="ccard" data-cc="${c._id}" style="--c:${c.col};--i:${inkOn(c.col)}" title="${esc(c.k === 'rail' ? LINES[c.line].th : TR.R[c.ris[0]].ln)}"><b>${esc(c.label)}</b></button>`;
function catCards(list) { return `<div class="cgrid">${list.map(c => { c._id = CAT.cards.push(c) - 1; return chip(c); }).join('')}</div>`; }
function catSections(g) { // cards of one region, grouped by province
  const by = new Map(); g.list.forEach(c => { const a = by.get(c.sec) || by.set(c.sec, []).get(c.sec); a.push(c); });
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0], 'th')).map(([p, l]) => `<h4 class="csec">${esc(p || 'อื่น ๆ')} <small>${l.length} สาย</small></h4>${catCards(l)}`).join('');
}
function catHome() {
  return `<div class="ctiles">${CATK.map(([k, n, ic, col]) => `<button type="button" class="ctile" data-ck="${k}" style="--c:${col}"><span class="cic">${ic}</span><b>${n}</b><small>${catCount(k)} สาย</small></button>`).join('')}</div>
  <p class="chint">เลือกประเภท แล้วเลือกกลุ่ม จากนั้นแตะเลขสายเพื่อดูต้นทาง ปลายทาง และจุดจอดทุกแห่ง · ข้อมูล GTFS ของ สนข. (Namtang) ต.ค. 2569</p>`;
}
function catKind(k) {
  const gs = catGroups(k), kk = CATK.find(x => x[0] === k);
  if (gs.length === 1) return catCards(gs[0].list);
  return `<div class="cgroups">${gs.map(g => { const provs = new Set(g.list.map(c => c.sec).filter(Boolean)).size; return `<button type="button" class="cgrp" data-cg="${esc(g.id)}" style="--c:${kk[3]}"><b>${esc(g.name)}</b><small>${g.n} สาย${provs > 1 ? ' · ' + provs + ' จังหวัด' : ''}</small><i>›</i></button>`; }).join('')}</div>`;
}
function catGroup(k, gid) { const g = catGroups(k).find(x => String(x.id) === gid); return g.list.some(c => c.sec) ? catSections(g) : catCards(g.list); }
function catSearch(q) {
  q = q.trim().toLowerCase(); if (!q) return '';
  const out = []; for (const k of KORDER) for (const ri of TR.byKind[k] || []) { const r = TR.R[ri]; if (r.sn.toLowerCase().includes(q) || r.ln.toLowerCase().includes(q) || r.pats.some(pi => (TR.P[pi].hs || '').toLowerCase().includes(q))) { out.push(ri); if (out.length >= 80) break; } if (out.length >= 80) break; }
  if (!out.length) return '<p class="chint">ไม่พบสายที่ตรงกับคำค้น</p>';
  return `<div class="cres">${out.map(ri => { const r = TR.R[ri], K = KIND[r.k], c = { k: r.k, label: catLabel(r), ris: [ri], col: catColor(r, K.c), sec: '' }; c._id = CAT.cards.push(c) - 1; return `<button type="button" class="crow" data-cc="${c._id}"><span class="trc" style="background:${c.col};color:${inkOn(c.col)}">${K.ic} ${esc(c.label)}</span><span>${esc(r.ln)}</span><small>${K.th}</small></button>`; }).join('')}</div>`;
}
const tlist = (stops, col, tag) => `<ol class="ctl" style="--c:${col}">${stops.map((s, q) => `<li class="${q === 0 ? 'first' : q === stops.length - 1 ? 'last' : ''}"><button type="button" ${tag(s)}><i></i><span>${esc(s.name)}</span>${q === 0 ? '<em>ต้นทาง</em>' : q === stops.length - 1 ? '<em>ปลายทาง</em>' : ''}</button></li>`).join('')}</ol>`;
function catRailDetail(c) {
  const L = LINES[c.line], H = L.hw, hh = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const body = L.paths.map((p, pi) => { const st = p.map(id => ({ name: (NODES[id].code && NODES[id].code !== NODES[id].th ? NODES[id].code + ' · ' : '') + NODES[id].th, id })); return `<details ${pi === 0 ? 'open' : ''}><summary>${L.paths.length > 1 ? (pi === 0 ? 'สายหลัก' : 'ช่วงแยก') + ' · ' : ''}${esc(NODES[p[0]].th)} → ${esc(NODES[p[p.length - 1]].th)} · ${p.length} สถานี</summary>${tlist(st, L.color, s => `data-cn="${s.id}"`)}</details>`; }).join('');
  return `<div class="cdh"><span class="trc big" style="background:${L.color};color:${inkOn(L.color)}">${esc(L.short)}</span><div><b>${esc(L.th)}</b><small>${esc(L.fwd && L.back ? L.fwd + ' ↔ ' + L.back : 'รถไฟฟ้า')}</small></div></div>
  <div class="cdi"><span>ทุก ~${H[0]}–${H[1]} นาที (ชั่วโมงเร่งด่วน–ปกติ)</span>${L.hours ? `<span>เปิดให้บริการ ${hh(L.hours[0])}–${hh(L.hours[1])}</span>` : ''}</div>${body}`;
}
function fewNote(c) { // some lines (long-distance trains, coaches) have far fewer stops in the feed than they really serve
  const i = catInfo(c.ris[0]), n = TR.P[i.best].s.length, sg = TR.P[i.best].sh >= 0 ? trGeo(i.best) : null; let L2 = 0; if (sg) for (let q = 2; q < sg.length; q += 2) L2 += dm(sg[q - 2], sg[q - 1], sg[q], sg[q + 1]);
  return L2 / 1000 / Math.max(n, 1) > 30 ? `<p class="chint warn">⚠ ข้อมูล GTFS ของสายนี้ระบุจุดจอดไว้เพียง ${n} แห่งจากเส้นทางยาว ~${Math.round(L2 / 1000)} กม. (ไม่ใช่ทุกสถานีที่รถจอดจริง) · เส้นบนแผนที่คือแนวทางทั้งสาย</p>` : '';
}
function catDetail(c) {
  if (c.line) return catRailDetail(c);
  const r = TR.R[c.ris[0]], K = KIND[r.k], i = catInfo(c.ris[0]);
  const facts = [hwTxt(r), hrs(r) ? 'ช่วงเวลา ' + hrs(r) : '', i.km >= 1 ? `ระยะทางประมาณ ~${i.km.toFixed(i.km < 10 ? 1 : 0)} กม.` : ''].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('');
  const blocks = []; let first = true, all = c.ris.flatMap(ri => TR.R[ri].pats.map(pi => [ri, pi])).sort((a, b) => TR.P[b[1]].s.length - TR.P[a[1]].s.length);
  for (const [ri, pi] of all) { const R2 = TR.R[ri]; { const p = TR.P[pi], stops = p.s.map(s => ({ name: trName(s), id: s }));
    blocks.push(`<details ${first ? 'open' : ''}><summary>${c.ris.length > 1 ? esc(R2.ln) + (R2.k === 't' ? ' (' + esc((R2.d || '').replace('รถไฟแห่งประเทศไทย ', '')) + ')' : '') + ' · ' : ''}${p.hs ? 'ไปทาง ' + esc(p.hs) : 'เส้นทาง'} · ${stops.length} จุด</summary>${tlist(stops, c.col, s => `data-cs="${s.id}"`)}</details>`); first = false; } }
  return `<div class="cdh"><span class="trc big" style="background:${c.col};color:${inkOn(c.col)}">${K.ic} ${esc(c.label)}</span><div><b>${esc(r.ln)}</b><small>${K.th}${r.ag ? ' · ' + esc(r.ag) : ''}${r.d ? ' · ' + esc(r.d) : ''}</small></div></div>
  <div class="cdi">${facts}</div>${fewNote(c)}${c.ris.length > 1 ? `<p class="chint">${c.ris.length} เส้นทางใช้เลขสายนี้ (ต้นทางปลายทางต่างกัน) · แตะเพื่อดูแต่ละเส้น</p>` : ''}${blocks.join('')}<p class="chint">${GT_NOTE}</p>`;
}

/* ---- navigation ---- */
function catTitle(v) {
  const kk = CATK.find(x => x[0] === (v.k || (v.c && v.c.k)));
  if (v.t === 'home') return 'สายทั้งหมด'; if (v.t === 'kind') return kk[1]; if (v.t === 'search') return 'ค้นหาสาย';
  if (v.t === 'group') return kk[1] + ' › ' + catGroups(v.k).find(g => String(g.id) === v.g).name;
  return v.c.k === 'rail' ? LINES[v.c.line].th : kk[1] + ' › ' + v.c.label;
}
function catRender() {
  const v = CAT.st[CAT.st.length - 1], el = catEl(); CAT.cards = []; el.classList.toggle('deep', CAT.st.length > 1);
  $('cattitle').textContent = catTitle(v); $('catback').hidden = CAT.st.length < 2;
  $('catq').hidden = v.t === 'card'; let h = '';
  if (v.t === 'home') h = catHome(); else if (v.t === 'kind') h = catKind(v.k); else if (v.t === 'group') h = catGroup(v.k, v.g); else if (v.t === 'search') h = catSearch(v.q); else h = catDetail(v.c);
  $('catbody').innerHTML = h; $('catbody').scrollTop = 0;
}
function catGo(v) { CAT.st.push(v); catRender(); if (v.t === 'card') catMap(v.c); }
function catBack() { if (CAT.st.length > 1) { CAT.st.pop(); catRender(); const v = CAT.st[CAT.st.length - 1]; if (v.t !== 'card') trClearHL(); if (v.t !== 'search') $('catq').value = ''; } }
const catPad = () => innerWidth <= 899 ? { padL: 30, padB: Math.round(innerHeight * .5) } : { padL: 410, padB: 60 };
function catMap(c) {
  if (c.line) { const pts = []; LINES[c.line].paths.forEach(p => p.forEach(id => pts.push([NODES[id].lat, NODES[id].lng]))); const pd = catPad(); map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [pd.padL, 110], paddingBottomRight: [30, pd.padB], maxZoom: 14 }); return; }
  trShowRoute(c.ris, null, Object.assign({ quiet: true }, catPad()));
}
function catPoint(la, ln) {
  const pd = catPad(); TR.hs.clearLayers(); const p = L.latLng(la, ln);
  map.fitBounds(L.latLngBounds([p, p]), { paddingTopLeft: [pd.padL, 110], paddingBottomRight: [30, pd.padB], maxZoom: Math.max(map.getZoom(), 15) });
  TR.hs.addLayer(L.circleMarker(p, { pane: 'trhl', radius: 11, color: '#e03131', weight: 3, fillColor: '#fff', fillOpacity: .5, bubblingMouseEvents: false }));
}
async function catOpen() {
  const el = catEl(); el.hidden = false; $('catbtn').setAttribute('aria-expanded', 'true'); $('lyr').hidden = true; $('lyrbtn').setAttribute('aria-expanded', 'false');
  if (!CAT.inited) {
    $('catbody').innerHTML = '<p class="chint">กำลังโหลดข้อมูลสาย…</p>'; CAT.idx = {};
    if (!(await trLoad())) { $('catbody').innerHTML = '<p class="chint">โหลดข้อมูลสายไม่สำเร็จ (เบราว์เซอร์นี้อาจไม่รองรับการแตกไฟล์ข้อมูล)</p>'; return; }
    CAT.inited = true; CAT.st = [{ t: 'home' }];
  }
  catRender();
}
function catClose() { catEl().hidden = true; catEl().classList.remove('mini'); $('catbtn').setAttribute('aria-expanded', 'false'); TR.hs && TR.hs.clearLayers(); }
function catInit() {
  $('catbtn').onclick = () => catEl().hidden ? catOpen() : catClose();
  $('catx').onclick = catClose; $('catback').onclick = catBack;
  $('catmin').onclick = () => { const m = catEl().classList.toggle('mini'); $('catmin').textContent = m ? '▴ ขยายรายการ' : '▾ ซ่อนรายการ เพื่อดูแผนที่'; };
  let tm = 0; $('catq').addEventListener('input', e => { clearTimeout(tm); tm = setTimeout(() => { const q = e.target.value; if (!CAT.inited) return; if (!q.trim()) { while (CAT.st.length > 1 && CAT.st[CAT.st.length - 1].t === 'search') CAT.st.pop(); } else if (CAT.st[CAT.st.length - 1].t === 'search') CAT.st[CAT.st.length - 1].q = q; else CAT.st.push({ t: 'search', q }); catRender(); }, 180); });
  $('catbody').addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return; const v = CAT.st[CAT.st.length - 1];
    if (t.dataset.ck) catGo({ t: 'kind', k: t.dataset.ck });
    else if (t.dataset.cg) catGo({ t: 'group', k: v.k, g: t.dataset.cg });
    else if (t.dataset.cc) catGo({ t: 'card', c: CAT.cards[+t.dataset.cc] });
    else if (t.dataset.cs) { const s = TR.S[+t.dataset.cs]; catPoint(s[1], s[2]); }
    else if (t.dataset.cn) { const n = NODES[t.dataset.cn]; catPoint(n.lat, n.lng); if (typeof showStation === 'function') showStation(n.place); }
  });
}
