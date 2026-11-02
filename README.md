# Next Route

เว็บวางแผนการเดินทางหลายรูปแบบของไทย (BTS · MRT · ARL · SRT · สายสีทอง + รถไฟทางไกล รถเมล์ เรือ รถตู้ รถทัวร์ ทั่วประเทศ)
หน้าเว็บไฟล์เดียว (index.html) เปิดได้ทั้งคอมและมือถือ ธีมสว่าง/มืด/อัตโนมัติ

---

## 1. โครงสร้างโฟลเดอร์ — แต่ละไฟล์วางที่ไหนบน GitHub

วางทุกอย่าง **ที่รากของ repo** ตามนี้ (ไม่มี dist ไม่มี GitHub Actions):

```
(ราก repo)
├─ index.html            ← ★ หน้าเว็บจริง (สร้างโดย build.py) GitHub Pages เปิดไฟล์นี้
├─ config.js             ← ★ ไฟล์ตั้งค่า: Longdo key ฯลฯ  แก้แล้ว commit ได้เลย ไม่ต้อง build ใหม่
├─ .nojekyll             ← ไฟล์ว่าง บอก GitHub Pages ไม่ต้องประมวลผลเพิ่ม
├─ README.md
├─ build.py              ← ประกอบ src/ → index.html   (python3 build.py)
├─ .gitignore
├─ lite/
│  └─ rail-only.html     ← เวอร์ชันเบา เฉพาะรถไฟฟ้า ไม่ใช้เน็ต (ไม่จำเป็นต้องอัปโหลดก็ได้)
├─ data/
│  └─ gtfs_data.js       ← ข้อมูลสายรถทั่วประเทศแบบบีบอัด ~2 MB
├─ scripts/
│  └─ build_gtfs.py      ← แปลงไฟล์ GTFS ดิบ → data/gtfs_data.js
└─ src/                  ← โค้ดต้นฉบับ (แก้ตรงนี้ แล้วรัน build.py)
   ├─ index.template.html   โครงหน้าเว็บ (ปุ่ม แผง ช่องค้นหา)
   ├─ css/style.css         หน้าตาทั้งหมด
   ├─ vendor/               ไลบรารี Leaflet (ไม่ต้องแก้)
   └─ js/
      ├─ config.js          ค่าเริ่มต้น (อย่าแก้ — ไปแก้ config.js ที่ราก)
      ├─ data.js            ข้อมูลสถานี/สายรถไฟฟ้า BTS MRT ARL SRT สีทอง
      ├─ core.js            กราฟเส้นทาง ค่าโดยสาร
      ├─ ui.js              แผนที่ โหมดแผนที่ (OpenFreeMap/Longdo/ดาวเทียม ฯลฯ) ผลลัพธ์การเดินทาง
      ├─ sim.js             โหมดจำลองการเดินรถ
      ├─ trip-1-head.js, trip-2-mid.js, trip-3-tail.js   ค้นหาสถานที่ ปักหมุด เดินเท้า/ต่อรถไปสถานี
      ├─ transit.js         สายรถทั่วประเทศ (GTFS): วาดเส้น ค้นหา วางแผน ลากเส้นตามถนน/ราง แผง ☰
      ├─ catalog.js         ปุ่ม ▦ "ดูสายทั้งหมด"
      ├─ roads.js           ถนนเสริมบนแผนที่
      ├─ view3d.js          โหมดแผนที่ 3 มิติ
      └─ boot.js            จุดเริ่มต้น เชื่อมปุ่มทั้งหมด
```

ไฟล์ GTFS ดิบ (หลายร้อย MB) **ไม่ต้องอัปโหลด**

**ขั้นต่ำที่ต้องมีบน GitHub เพื่อให้เว็บทำงาน:** `index.html`, `config.js`, `.nojekyll`
ส่วน `src/`, `data/`, `scripts/`, `build.py` เป็นต้นฉบับไว้แก้/สร้างใหม่ (แนะนำให้อัปโหลดไว้ด้วย)

## 2. อัปโหลดขึ้น GitHub และเปิดเว็บ (ไม่ใช้ Actions)

1. github.com → New repository → ตั้งชื่อ เช่น `next-route` → Public → Create
2. Add file → **Upload files** → ลากทุกไฟล์/โฟลเดอร์ใน zip (ข้างใน `next-route/`) ไปวางที่หน้า repo → Commit
   - `index.html` ใหญ่ ~2.5 MB อัปโหลดทางเว็บได้ (จำกัด 25 MB ต่อไฟล์)
   - `.nojekyll` เป็นไฟล์ซ่อน ถ้าลากไม่ติด: Add file → Create new file → ตั้งชื่อ `.nojekyll` → Commit (เนื้อหาว่างได้)
3. Settings → **Pages** → Build and deployment → Source: **Deploy from a branch** → Branch: **main** / folder: **/ (root)** → Save
4. รอ ~1 นาที เว็บอยู่ที่ `https://<ชื่อผู้ใช้>.github.io/<ชื่อ repo>/`

ทางคำสั่งแทน:
```bash
cd next-route
git init -b main && git add . && git commit -m "Next Route"
git remote add origin https://github.com/<ชื่อผู้ใช้>/<ชื่อ repo>.git
git push -u origin main
```

## 3. สร้าง index.html ใหม่เมื่อแก้โค้ดใน src/

```bash
python3 build.py     # ต้องมี Python 3 เท่านั้น ไม่ต้องติดตั้งอะไรเพิ่ม
```
แล้วอัปโหลด `index.html` (และไฟล์ที่แก้) ทับของเดิมบน GitHub — เปิด `index.html` ในเครื่องก็ใช้งานได้เลย (ให้ `config.js` อยู่โฟลเดอร์เดียวกัน)

## 4. ถ้าอนาคตต้องเปลี่ยนค่าต่าง ๆ — ไปแก้ตรงไหน

| อยากเปลี่ยน | ไฟล์ / ตำแหน่ง | ต้อง build ใหม่? |
|---|---|---|
| **Longdo API key** | `config.js` (ราก) → `LONGDO_KEY: '...'` — บนเว็บ GitHub: เปิดไฟล์ → ไอคอนดินสอ → แก้ → Commit | **ไม่ต้อง** (เว็บอ่าน config.js ตอนเปิดหน้า; ถ้าไม่เห็นผล กด Ctrl+F5 เพราะแคช) |
| ทดลองคีย์อื่นเฉพาะเครื่องตัวเอง | บนเว็บ: ปุ่ม ☰ → "Longdo Map" → วางคีย์ → ใช้ | ไม่ — เก็บในเบราว์เซอร์ของคนนั้น ใช้แทน config.js |
| เซิร์ฟเวอร์ลากเส้นตามถนน (OSRM) | `config.js` → `SNAP_HOSTS` | ไม่ |
| เซิร์ฟเวอร์ Overpass | `config.js` → `OVERPASS` | ไม่ |
| รายการโหมดแผนที่ / URL ไทล์ | `src/js/ui.js` → `MAPMODES` (ชื่อในเมนู) และ `STYLES` (URL ไทล์) | ต้อง |
| สี / ไอคอน / ชื่อประเภทรถ | `src/js/transit.js` → `KIND` | ต้อง |
| การจัดกลุ่มในปุ่ม "ดูสายทั้งหมด" | `src/js/catalog.js` → `catGroups`, `catTrainLine`, `PROVS` | ต้อง |
| หน้าตา | `src/css/style.css` | ต้อง |
| ข้อความ/ปุ่มบนหน้า | `src/index.template.html` | ต้อง |

> ⚠ ทุกอย่างใน `config.js` มองเห็นได้โดยทุกคนที่เปิดซอร์สเว็บ — ที่ console ของ Longdo ควร **จำกัดคีย์ให้ใช้ได้เฉพาะโดเมนของคุณ** (เช่น `<ชื่อผู้ใช้>.github.io`) เพื่อไม่ให้คนอื่นนำไปใช้โควตาของคุณ

## 5. อัปเดตข้อมูลสายรถ (GTFS) เมื่อ สนข. ออกไฟล์ใหม่

```bash
# 1) ดาวน์โหลดและแตกไฟล์ GTFS ใหม่ไว้ที่ ./gtfs-raw/   (โฟลเดอร์นี้ถูก .gitignore กันไว้)
# 2) ไฟล์จุดจอดรถ park-and-ride (ถ้ามี) เป็นไฟล์ txt เดิม
pip install numpy
python3 -I scripts/build_gtfs.py gtfs-raw/ parking.txt data/gtfs_data.js
python3 build.py
# 3) อัปโหลด data/gtfs_data.js และ index.html ทับของเดิม
```
แก้วันที่ฉบับข้อมูลที่ `v='…'` ในสคริปต์ (บรรทัดสร้าง `data = dict(v=…)`) — ตัวเลขนี้เป็นกุญแจแคชของเส้นที่ลากตามถนนแล้ว เมื่อเปลี่ยน แคชในเบราว์เซอร์ผู้ใช้จะถูกสร้างใหม่

## 6. เส้นที่ "ตามถนนจริง" ทำงานอย่างไร

ไฟล์ GTFS ให้เส้นมาหยาบ (บางช่วงเป็นเส้นตรงยาวหลายสิบ กม.) เว็บจึงปรับเส้นในเบราว์เซอร์ผู้ใช้ตอนใช้งาน:
- รถเมล์/รถตู้/รถทัวร์: ส่งให้ OSRM (`SNAP_HOSTS` ใน `config.js`) หาเส้นทางตามถนน — ช่วงสั้นใช้ map-matching, ช่วงข้ามไกล (≥1.5 กม.) ใช้ routing ระหว่างจุดจอด
- รถไฟ/เรือ: ดึงรางรถไฟ/เส้นทางเรือจาก OpenStreetMap (Overpass) แล้วหาทางสั้นสุดตามรางระหว่างจุด
- ผลที่ได้เก็บใน IndexedDB ของเบราว์เซอร์ (ชื่อฐาน `next-route-snap`) จึงลากครั้งแรกเท่านั้น ครั้งต่อไปเร็ว
- เปิด/ปิดได้ที่ ☰ → "ปรับเส้นให้ตรงถนน/รางจริง"
- เส้นจะค่อย ๆ ปรับตามที่เห็นบนหน้าจอ (แผนที่ขยับ = ดึงเพิ่ม) และเส้นที่เลือกในหน้า "สายทั้งหมด" จะถูกปรับก่อน
- เซิร์ฟเวอร์ OSRM/Overpass สาธารณะมีข้อจำกัดความถี่ ถ้าใช้งานหนักแนะนำตั้งเซิร์ฟเวอร์ของตัวเองแล้วใส่ใน `config.js`

## 7. ข้อจำกัดที่ควรรู้
- ข้อมูล GTFS ของรถไฟทางไกลบางสาย (เช่น สาย 102 เชียงใหม่–กรุงเทพ) ระบุจุดจอดไว้ในไฟล์เพียงไม่กี่แห่ง เส้นบนแผนที่ครบทั้งสายแต่รายชื่อสถานีไม่ครบ (หน้ารายละเอียดมีคำเตือนให้)
- ไม่มีข้อมูลรถสด/ค่าโดยสารของรถนอกเหนือจาก BTS/MRT/ARL/SRT — เวลาเป็นค่าประมาณ
- ไทล์ Longdo: ใช้ URL `https://ms.longdo.com/mmmap/tile.php?key=…&proj=epsg3857&zoom={z}&x={x}&y={y}` ตามเอกสารของ Longdo ถ้า Longdo เปลี่ยนรูปแบบ ให้แก้ฟังก์ชัน `styleOf` ใน `src/js/ui.js` แล้ว build ใหม่

## 8. แหล่งข้อมูล / เครดิต
GTFS: สำนักงานนโยบายและแผนการขนส่งและจราจร (สนข.) ผ่าน Namtang · แผนที่: OpenFreeMap, © OpenStreetMap contributors, Esri World Imagery, OpenTopoMap, CARTO, Longdo Map · ไลบรารี: Leaflet, MapLibre GL
