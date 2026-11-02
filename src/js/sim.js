/* sim.js: journey simulation. A marker rides the real track polylines; the clock runs; it pauses at every interchange
   and shows the platform / exit steps. Uses the plan timeline (waits, per-hop ride times, walks). */
const sim = { on: false, playing: false, t: 0, total: 0, ev: [], idx: 0, speed: 1, raf: 0, last: 0, marker: null, clock0: 0, route: null, held: -1 };
const SIM_RATE = 1.6; // simulated minutes per real second at 1x
const SPEEDS = [1, 2, 4, 8];
function plen(pts) { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot((pts[i][0] - pts[i - 1][0]) * 110574, (pts[i][1] - pts[i - 1][1]) * 108000)); return c; }
function simBuild(r) {
  const ev = []; let t = 0;
  const push = (o, dur) => { o.t0 = t; o.t1 = t + Math.max(dur, 0.01); t = o.t1; if (o.pts) o.cum = plen(o.pts); ev.push(o); };
  const first = r.legs[0];
  const accEv = (A, from, to) => push({ k: 'access', pts: A.road && A.road.pts && A.road.pts.length > 1 ? [from, ...A.road.pts, to] : [from, to], text: `${A.opt.mode === 'walk' ? '🚶 เดิน' : '🚕 ' + A.opt.label} ~${Math.round(A.opt.min)} นาที${A.opt.cost ? ' (~฿' + A.opt.cost + ')' : ''}`, line: first.line }, A.opt.min);
  if (r.acc && r.acc.o.pt) accEv(r.acc.o, [r.acc.o.pt.lat, r.acc.o.pt.lng], ll(first.from));
  r.legs.forEach((lg, i) => {
    const prev = i ? r.legs[i - 1] : null;
    lg.before.forEach(x => push({ k: prev ? 'xfer' : 'walk', x, lg, prev, pts: [ll(x.from), ll(x.to)], line: lg.line }, x.walk));
    push({ k: 'wait', lg, prev, pts: [ll(lg.from)], line: lg.line }, lg.wait);
    for (let h = 0; h < lg.nodes.length - 1; h++) {
      const a = lg.nodes[h], b = lg.nodes[h + 1], e = EDGE[a + '|' + b];
      push({ k: 'ride', lg, h, a, b, pts: trackLL([a, b]), line: lg.line }, e.min);
    }
  });
  r.endWalk.forEach(x => push({ k: 'walk', x, lg: r.legs[r.legs.length - 1], pts: [ll(x.from), ll(x.to)], line: r.legs[r.legs.length - 1].line }, x.walk));
  if (r.acc && r.acc.d.pt) { const lg = r.legs[r.legs.length - 1]; accEv(r.acc.d, ll(r.path[r.path.length - 1]), [r.acc.d.pt.lat, r.acc.d.pt.lng]); ev[ev.length - 1].dest = true; }
  sim.ev = ev; sim.total = t;
  sim.clock0 = r.depart != null ? r.depart : (st.plan && st.plan.minute != null ? st.plan.minute : 540);
}
function simPos(e, t) {
  const f = Math.max(0, Math.min(1, (t - e.t0) / (e.t1 - e.t0))), p = e.pts;
  if (p.length === 1) return p[0];
  const L = e.cum[e.cum.length - 1], d = f * L; let i = 1; while (i < e.cum.length - 1 && e.cum[i] < d) i++;
  const s = (d - e.cum[i - 1]) / ((e.cum[i] - e.cum[i - 1]) || 1);
  return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * s, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * s];
}
function simEvIdx(t) { const ev = sim.ev; for (let i = 0; i < ev.length; i++) if (t < ev[i].t1) return i; return ev.length - 1; }
const clockAt = t => fmt(sim.clock0 + t);
function simMsg(e, t) {
  const L = LINES[e.line];
  if (e.k === 'xfer') return xferHTML(e.x, e.lg, e.prev, true);
  if (e.k === 'access') return `<div class="smsg">${e.text}${e.dest ? '<br><b class="pf">' + esc(exitInfo(r_(e), st.toPt || st.fromPt).txt) + '</b>' : ''}</div>`;
  if (e.k === 'walk') return `<div class="smsg">🚶 เดิน ~${e.x.walk} นาที จาก ${esc(NODES[e.x.from].th)} ไป ${esc(NODES[e.x.to].th)}</div>`;
  if (e.k === 'wait') {
    const inf = e.prev ? xferInfo(e.prev && e.lg.before[0] || { from: e.lg.from, to: e.lg.from, walk: 0, note: '', info: {} }, e.lg, e.prev) : null;
    const bdT = inf ? inf.bdT : `ฝั่งไปทาง ${dirText(e.lg)}`;
    return `<div class="smsg">⏱ รอรถ ${lineChip(e.line, NODES[e.lg.from].code)} ที่สถานี${esc(NODES[e.lg.from].th)}<br><b class="pf">ชานชาลา: ${esc(bdT)}</b><br><small>รถมาทุก ~${Math.round(e.lg.hw)} นาที</small></div>`;
  }
  const left = e.lg.hops - e.h;
  return `<div class="smsg">🚆 ${lineChip(e.line, NODES[e.lg.from].code)} ${esc(L.th)} ไปทาง ${esc(dirText(e.lg))}<br>สถานีถัดไป <b>${esc(NODES[e.b].th)}</b> · ปลายทางของช่วงนี้ ${esc(NODES[e.lg.to].th)} (อีก ${left} สถานี)</div>`;
}
function simRender(force) {
  const e = sim.ev[sim.idx], t = Math.min(sim.t, sim.total);
  $('simclock').textContent = clockAt(t);
  $('simsub').textContent = e.k === 'ride' ? `${NODES[e.a].th} → ${NODES[e.b].th}` : e.k === 'xfer' ? 'จุดเปลี่ยนสาย' : e.k === 'access' ? 'เดิน/ต่อรถ' : e.k === 'wait' ? 'รอรถ' : 'เดิน';
  $('simfill').style.width = (t / sim.total * 100).toFixed(2) + '%';
  if (force || sim.shown !== sim.idx) { sim.shown = sim.idx; $('simmsg').innerHTML = simMsg(e, t); $('simmsg').scrollTop = 0; }
  const p = simPos(e, t); sim.marker.setLatLng(p);
  const col = e.k === 'ride' || e.k === 'wait' ? LINES[e.line].color : '#444';
  sim.marker.getElement() && (sim.marker.getElement().firstChild.style.background = col);
  if (!map.getBounds().pad(-0.3).contains(p)) map.panTo(p, { animate: true, duration: .5, easeLinearity: 1 });
}
function simSetIdx(i) { sim.idx = i; if (sim.ev[i].k === 'xfer') map.setView(simPos(sim.ev[i], sim.ev[i].t0), Math.max(map.getZoom(), 15), { animate: true }); else if (sim.ev[i].k === 'ride' && map.getZoom() > 14) map.setZoom(14, { animate: true }); }
function simFrame(ts) {
  if (!sim.playing) return;
  const dt = Math.min(0.1, (ts - sim.last) / 1000); sim.last = ts;
  sim.t += dt * SIM_RATE * sim.speed;
  const ni = simEvIdx(sim.t);
  if (ni !== sim.idx) {
    simSetIdx(ni);
    if (sim.ev[ni].k === 'xfer' && sim.held !== ni) { sim.held = ni; sim.t = sim.ev[ni].t0 + 0.001; simPause(); simRender(true); return; } // stop at every interchange
  }
  if (sim.t >= sim.total) { sim.t = sim.total; simPause(); simRender(true); $('simmsg').innerHTML = `<div class="smsg">🏁 ถึงปลายทาง <b>${esc(NODES[st.route.path[st.route.path.length - 1]].th)}</b> เวลา ${clockAt(sim.total)} (ใช้เวลารวม ${Math.round(sim.total)} นาที)</div>`; return; }
  simRender(); sim.raf = requestAnimationFrame(simFrame);
}
function simPlay() {
  if (sim.t >= sim.total) { sim.t = 0; sim.idx = 0; sim.held = -1; sim.shown = -1; simSetIdx(0); }
  sim.playing = true; $('simplay').textContent = '⏸'; $('simplay').setAttribute('aria-label', 'หยุด');
  if (sim.ev[sim.idx].k === 'xfer') sim.held = sim.idx; // continuing from an interchange card
  sim.last = performance.now(); cancelAnimationFrame(sim.raf); sim.raf = requestAnimationFrame(simFrame);
}
function simPause() { sim.playing = false; cancelAnimationFrame(sim.raf); $('simplay').textContent = '▶'; $('simplay').setAttribute('aria-label', 'เล่น'); }
function simSeek(t) { sim.t = Math.max(0, Math.min(sim.total, t)); sim.idx = simEvIdx(sim.t); sim.shown = -1; sim.held = sim.ev[sim.idx].k === 'xfer' ? sim.idx : -1; simRender(true); }
function simStart(r) {
  if (!r) return; simStop(); sim.route = r;
  if (st.route !== r) setRoute(r);
  simBuild(r); sim.on = true; sim.t = 0; sim.idx = 0; sim.held = -1; sim.shown = -1;
  $('sim').hidden = false; $('mapwrap').classList.add('simming'); $('stcard').hidden = true;
  $('simticks').innerHTML = sim.ev.filter(e => e.k === 'xfer').map(e => `<i style="left:${(e.t0 / sim.total * 100).toFixed(2)}%"></i>`).join('');
  sim.marker = L.marker(simPos(sim.ev[0], 0), { pane: 'labels', interactive: false, keyboard: false, icon: L.divIcon({ className: 'simpin', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(map);
  map.setView(simPos(sim.ev[0], 0), 14, { animate: false });
  simRender(true); simPlay();
}
function simStop() {
  if (!sim.on) return; simPause(); sim.on = false; $('sim').hidden = true; $('mapwrap').classList.remove('simming');
  if (sim.marker) { sim.marker.remove(); sim.marker = null; }
}
$('simx').onclick = () => { simStop(); if (st.route) fitTo(st.route.path, 48); };
$('simplay').onclick = () => sim.playing ? simPause() : simPlay();
$('simnext').onclick = () => { const wasPlaying = sim.playing; const i = Math.min(sim.ev.length - 1, sim.idx + 1); simSeek(sim.ev[i].t0 + 0.001); if (sim.ev[i].k === 'xfer') map.setView(simPos(sim.ev[i], sim.t), Math.max(map.getZoom(), 15)); if (wasPlaying && sim.ev[i].k !== 'xfer') simPlay(); };
$('simprev').onclick = () => { const e = sim.ev[sim.idx], i = sim.t - e.t0 > .4 ? sim.idx : Math.max(0, sim.idx - 1); simPause(); simSeek(sim.ev[i].t0 + 0.001); };
$('simspd').onclick = () => { sim.speed = SPEEDS[(SPEEDS.indexOf(sim.speed) + 1) % SPEEDS.length]; $('simspd').textContent = sim.speed + '×'; };
$('simbar').addEventListener('pointerdown', e => { const r = $('simbar').getBoundingClientRect(); simPause(); simSeek((e.clientX - r.left) / r.width * sim.total); });

function r_(e) { return st.sel && st.sel.acc && st.sel.acc.d.st ? st.sel.acc.d.st.place : NODES[st.sel.path[st.sel.path.length - 1]].place; }
