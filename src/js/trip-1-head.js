/* trip.js: place search, map pins, point-to-point planning (nearest station, exit, bus / songthaew / taxi), live time. */
const ONLINE = TILES; // network features (place search, bus routes, exits) only work in the standalone file
const POIS = [ // well-known places, approximate positions (used when the online geocoder is unavailable)
  ['สยามพารากอน', 'Siam Paragon', 13.7461, 100.5347], ['เซ็นทรัลเวิลด์', 'CentralWorld', 13.7467, 100.5393], ['สยามดิสคัฟเวอรี่', 'Siam Discovery', 13.7468, 100.5312],
  ['เอ็มบีเค เซ็นเตอร์', 'MBK Center', 13.7446, 100.5300], ['สยามสแควร์', 'Siam Square', 13.7450, 100.5340], ['เซ็นทรัลชิดลม', 'Central Chidlom', 13.7437, 100.5428],
  ['พลาตินัม แฟชั่น มอลล์', 'Platinum Fashion Mall', 13.7513, 100.5405], ['สามย่านมิตรทาวน์', 'Samyan Mitrtown', 13.7329, 100.5290], ['ไอคอนสยาม', 'Iconsiam', 13.7265, 100.5100],
  ['เอเชียทีค', 'Asiatique', 13.7041, 100.5030], ['เทอร์มินอล 21 อโศก', 'Terminal 21 Asok', 13.7377, 100.5604], ['เอ็มโพเรียม', 'Emporium', 13.7305, 100.5696],
  ['เซ็นทรัล ลาดพร้าว', 'Central Ladprao', 13.8160, 100.5610], ['เซ็นทรัล พระราม 9', 'Central Rama 9', 13.7585, 100.5655], ['เมกา บางนา', 'Mega Bangna', 13.6467, 100.6800],
  ['เซ็นทรัล เวสต์เกต', 'Central Westgate', 13.8777, 100.4120], ['เซ็นทรัล ปิ่นเกล้า', 'Central Pinklao', 13.7773, 100.4780], ['ฟิวเจอร์พาร์ค รังสิต', 'Future Park Rangsit', 13.9896, 100.6172],
  ['ตลาดนัดจตุจักร', 'Chatuchak Weekend Market', 13.7999, 100.5503], ['สวนจตุจักร', 'Chatuchak Park', 13.8030, 100.5530], ['สวนลุมพินี', 'Lumphini Park', 13.7305, 100.5415], ['สวนเบญจกิติ', 'Benjakitti Park', 13.7245, 100.5580],
  ['ศูนย์การประชุมแห่งชาติสิริกิติ์', 'Queen Sirikit National Convention Center', 13.7233, 100.5600], ['อิมแพ็ค เมืองทองธานี', 'Impact Muang Thong Thani', 13.9124, 100.5476],
  ['จุฬาลงกรณ์มหาวิทยาลัย', 'Chulalongkorn University', 13.7384, 100.5320], ['มหาวิทยาลัยธรรมศาสตร์ ท่าพระจันทร์', 'Thammasat University Tha Prachan', 13.7570, 100.4900],
  ['มหาวิทยาลัยธรรมศาสตร์ รังสิต', 'Thammasat University Rangsit', 14.0710, 100.6030], ['มหาวิทยาลัยเกษตรศาสตร์ บางเขน', 'Kasetsart University', 13.8470, 100.5700],
  ['มหาวิทยาลัยมหิดล ศาลายา', 'Mahidol University Salaya', 13.7940, 100.3240], ['มหาวิทยาลัยศิลปากร วังท่าพระ', 'Silpakorn University Wang Tha Phra', 13.7510, 100.4890],
  ['มหาวิทยาลัยศรีนครินทรวิโรฒ ประสานมิตร', 'Srinakharinwirot University Prasarnmit', 13.7473, 100.5659], ['มหาวิทยาลัยรามคำแหง', 'Ramkhamhaeng University', 13.7556, 100.6212],
  ['มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี บางมด', 'KMUTT', 13.6503, 100.4943], ['สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง', 'KMITL', 13.7278, 100.7724],
  ['โรงพยาบาลศิริราช', 'Siriraj Hospital', 13.7590, 100.4850], ['โรงพยาบาลจุฬาลงกรณ์', 'King Chulalongkorn Memorial Hospital', 13.7335, 100.5370],
  ['โรงพยาบาลรามาธิบดี', 'Ramathibodi Hospital', 13.7655, 100.5285], ['โรงพยาบาลกรุงเทพ', 'Bangkok Hospital', 13.7490, 100.5850],
  ['พระบรมมหาราชวัง', 'Grand Palace', 13.7500, 100.4913], ['วัดโพธิ์', 'Wat Pho', 13.7465, 100.4930], ['วัดอรุณ', 'Wat Arun', 13.7437, 100.4888], ['ถนนข้าวสาร', 'Khao San Road', 13.7590, 100.4975],
  ['เยาวราช', 'Yaowarat', 13.7390, 100.5100], ['อนุสาวรีย์ชัยสมรภูมิ', 'Victory Monument', 13.7650, 100.5380], ['สนามศุภชลาศัย', 'Supachalasai Stadium', 13.7469, 100.5290],
  ['ราชมังคลากีฬาสถาน', 'Rajamangala Stadium', 13.7556, 100.6217], ['สนามบินสุวรรณภูมิ', 'Suvarnabhumi Airport', 13.6900, 100.7501], ['สนามบินดอนเมือง', 'Don Mueang Airport', 13.9126, 100.6068],
  ['โรงเรียนสวนกุหลาบวิทยาลัย', 'Suankularb Wittayalai School', 13.7497, 100.5083]];
const POI_N = POIS.map(p => ({ th: p[0], en: p[1], lat: p[2], lng: p[3], k: (p[0] + ' ' + p[1]).toLowerCase().replace(/\s/g, '') }));
const HOME_KEY = 'rail-home';
let home = null; try { home = JSON.parse(localStorage.getItem(HOME_KEY) || 'null'); } catch (e) {}
const OVP = CONFIG.OVERPASS;
async function overpass(q) {
  const one = async h => { const r = await fetch(h, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }); if (!r.ok) throw new Error(r.status); return r.json(); };
  try { return await Promise.any(OVP.map(one)); } catch (e) { return null; } // ask every mirror at once, take the first answer
}
const placeLL = id => { const n = NODES[PLACES[id][0]]; return { lat: n.lat, lng: n.lng }; };
const kmBetween = (a, b) => hav({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
const DIRS = ['เหนือ', 'ตะวันออกเฉียงเหนือ', 'ตะวันออก', 'ตะวันออกเฉียงใต้', 'ใต้', 'ตะวันตกเฉียงใต้', 'ตะวันตก', 'ตะวันตกเฉียงเหนือ'];
function compass(a, b) { const y = (b.lat - a.lat) * 110574, x = (b.lng - a.lng) * 108000; return DIRS[Math.round(((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360 / 45) % 8]; }
const fmtKm = km => km < 1 ? Math.round(km * 1000 / 10) * 10 + ' ม.' : km.toFixed(1) + ' กม.';

