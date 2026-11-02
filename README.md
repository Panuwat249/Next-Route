# Next Route

เว็บวางแผนการเดินทางหลายรูปแบบของไทย (BTS · MRT · ARL · SRT · สายสีทอง + รถไฟทางไกล รถเมล์ เรือ รถตู้ รถทัวร์ ทั่วประเทศ)
ไฟล์เดียว เปิดได้ทั้งคอมและมือถือ ธีมสว่าง/มืด/อัตโนมัติ

---

## 1. โครงสร้างโฟลเดอร์ และแต่ละไฟล์ต้องวางที่ไหนบน GitHub

```
next-route/                      ← ราก repo (วางตามนี้ทั้งหมด)
├─ README.md                     ← ไฟล์นี้
├─ build.py                      ← สคริปต์ประกอบเว็บ  (python3 build.py)
├─ .gitignore
├─ .github/workflows/pages.yml   ← สั่ง GitHub สร้างและเผยแพร่เว็บอัตโนมัติ  (ต้องอยู่ path นี้เป๊ะ ๆ)
├─ src/                          ← ★ โค้ดต้นฉบับ แก้ที่นี่
│  ├─ index.template.html        ← โครงหน้าเว็บ (ปุ่ม แผง ช่องค้นหา)
│  ├─ css/style.css              ← หน้าตาทั้งหมด
│  ├─ vendor/                    ← ไลบรารีที่ไม่ต้องแก้ (Leaflet)
│  └─ js/
│     ├─ config.js               ← ★ ค่าที่ต้องแก้บ่อย: Longdo key, เซิร์ฟเวอร์ลากเส้นตามถนน, Overpass
│     ├─ data.js                 ← ข้อมูลสถานี/สายรถไฟฟ้า (BTS MRT ARL SRT สีทอง)
│     ├─ core.js                 ← กราฟเส้นทาง ค่าโดยสาร (ไม่แตะ DOM)
│     ├─ ui.js                   ← แผนที่ Leaflet, โหมดแผนที่ (OpenFreeMap/Longdo/ดาวเทียม ฯลฯ), ผลลัพธ์การเดินทาง
│     ├─ sim.js                  ← โหมดจำลองการเดินรถ
│     ├─ trip-1-head.js / trip-2-mid.js / trip-3-tail.js   ← ค้นหาสถานที่ ปักหมุด เดินเท้า/ต่อรถไปสถานี
│     ├─ transit.js              ← สายรถทั่วประเทศ (GTFS): วาดเส้น, ค้นหา, วางแผน, ลากเส้นตามถนน/ราง, แผงชั้นแผนที่ ☰
│     ├─ catalog.js              ← ปุ่ม ▦ "ดูสายทั้งหมด" (ประเภท → กลุ่ม → การ์ดเลขสาย → จุดจอด)
│     ├─ roads.js                ← ถนนเสริมบนแผนที่
│     ├─ view3d.js               ← โหมดแผนที่ 3 มิติ (MapLibre + OpenFreeMap)
│     └─ boot.js                 ← จุดเริ่มต้น เชื่อมปุ่มทั้งหมด
├─ data/
│  └─ gtfs_data.js               ← ข้อมูลสายรถทั่วประเทศแบบบีบอัด (สร้างด้วย scripts/build_gtfs.py) ~2 MB
├─ scripts/
│  └─ build_gtfs.py              ← แปลงไฟล์ GTFS ดิบของ สนข. (Namtang) → data/gtfs_data.js
└─ dist/                         ← ผลลัพธ์จาก build.py (ไม่ต้อง commit — .gitignore กันไว้แล้ว)
   ├─ site/index.html            ← เวอร์ชันเต็ม → นี่คือไฟล์ที่ GitHub Pages เผยแพร่
   └─ rail-only.html             ← เวอร์ชันเบา เฉพาะรถไฟฟ้า ไม่ใช้เน็ต ไม่มี key
```

ไฟล์ดิบ GTFS (หลายร้อย MB) **ไม่ต้องอัปโหลด** — ใช้แค่ `data/gtfs_data.js` ที่สร้างไว้แล้ว

## 2. อัปโหลดขึ้น GitHub (ครั้งแรก)

**ทางเว็บ (ไม่ต้องใช้ git)**
1. github.com → New repository → ตั้งชื่อ เช่น `next-route` → Public → Create
2. แตกไฟล์ zip ที่ได้ แล้วลากโฟลเดอร์/ไฟล์ **ข้างใน** `next-route/` ทั้งหมดไปวางในหน้า repo (Add file → Upload files) → Commit
   - โฟลเดอร์ `.github` เป็นโฟลเดอร์ซ่อน (ขึ้นต้นด้วยจุด) ถ้าลากไม่ติด ให้ Add file → Create new file → พิมพ์ชื่อ `.github/workflows/pages.yml` แล้ววางเนื้อหาจากไฟล์ในชุดนี้
3. Settings → **Pages** → Build and deployment → Source เลือก **GitHub Actions**
4. แท็บ Actions จะรัน "Deploy Next Route to GitHub Pages" (~1 นาที) → เสร็จแล้วเว็บอยู่ที่ `https://<ชื่อผู้ใช้>.github.io/next-route/`

**ทางคำสั่ง**
```bash
cd next-route
git init -b main && git add . && git commit -m "Next Route"
git remote add origin https://github.com/<ชื่อผู้ใช้>/next-route.git
git push -u origin main
```
จากนั้นทำข้อ 3 เหมือนกัน หลังจากนี้ทุกครั้งที่ push / แก้ไฟล์บนเว็บ GitHub แล้ว commit เว็บจะสร้างใหม่เองอัตโนมัติ

ถ้าไม่อยากใช้ GitHub Actions: รัน `python3 build.py` แล้วนำ `dist/site/index.html` ไปวางที่ไหนก็ได้ (ใช้เปิดไฟล์ตรง ๆ หรืออัปโหลดขึ้นโฮสต์ใดก็ได้)

## 3. สร้างเว็บบนเครื่อง

```bash
python3 build.py          # ต้องมี Python 3 เท่านั้น ไม่ต้องติดตั้งแพ็กเกจเพิ่ม
# เปิด dist/site/index.html ในเบราว์เซอร์ได้เลย
```

## 4. ถ้าอนาคตต้องเปลี่ยนค่าต่าง ๆ — ไปแก้ตรงไหน

| อยากเปลี่ยน | ไฟล์ / ตำแหน่ง | วิธี |
|---|---|---|
| **Longdo API key** | `src/js/config.js` → `LONGDO_KEY` | แก้ข้อความในเครื่องหมายคำพูด → commit (บนเว็บ GitHub: เปิดไฟล์ → ไอคอนดินสอ → Commit) → เว็บสร้างใหม่เอง |
| Longdo key แบบไม่แตะโค้ด | GitHub → Settings → Secrets and variables → Actions → **Variables** → New → ชื่อ `LONGDO_KEY` | ค่านี้จะทับค่าใน config.js ตอน build |
| ทดลองคีย์อื่นแบบชั่วคราว (เฉพาะเบราว์เซอร์ตัวเอง) | บนเว็บ: ปุ่ม ☰ → "Longdo Map" → วางคีย์ → ใช้ | เก็บใน localStorage ของคนนั้นเท่านั้น และใช้แทนค่าใน config.js |
| เซิร์ฟเวอร์ลากเส้นตามถนน (OSRM) | `src/js/config.js` → `SNAP_HOSTS` | ใส่ URL เซิร์ฟเวอร์ OSRM ของตัวเอง (รองรับ `/match/v1/driving` และ `/route/v1/driving`) |
| เซิร์ฟเวอร์ Overpass | `src/js/config.js` → `OVERPASS` | เพิ่ม/ลบ mirror |
| รายการโหมดแผนที่ / URL ไทล์ | `src/js/ui.js` → `MAPMODES` (ชื่อในเมนู) และ `STYLES` (URL ไทล์) | เพิ่มบรรทัดใหม่ในสองที่นี้ |
| สี / ไอคอน / ชื่อประเภทรถ | `src/js/transit.js` → `KIND` | |
| การจัดกลุ่มในปุ่ม "ดูสายทั้งหมด" | `src/js/catalog.js` → `catGroups`, `catTrainLine`, `PROVS` | |
| หน้าตา | `src/css/style.css` | ตัวแปรสีอยู่บนสุดของไฟล์ |
| ข้อความ/ปุ่มบนหน้า | `src/index.template.html` | |

> ⚠ ทุกอย่างที่อยู่ใน `config.js` จะเห็นได้ในซอร์สของเว็บ (ใครก็เปิดดูได้) — ที่ console ของ Longdo ควร **จำกัดคีย์ให้ใช้ได้เฉพาะโดเมนของคุณ** (เช่น `<ชื่อผู้ใช้>.github.io`) เพื่อไม่ให้คนอื่นนำไปใช้โควตาของคุณ

## 5. อัปเดตข้อมูลสายรถ (GTFS) เมื่อ สนข. ออกไฟล์ใหม่

```bash
# 1) ดาวน์โหลดและแตกไฟล์ GTFS ใหม่ไว้ที่ ./gtfs-raw/   (โฟลเดอร์นี้ถูก .gitignore กันไว้)
# 2) ไฟล์จุดจอดรถ park-and-ride (ถ้ามี) เป็นไฟล์ txt เดิม
pip install numpy
python3 -I scripts/build_gtfs.py gtfs-raw/ parking.txt data/gtfs_data.js
python3 build.py
# 3) commit data/gtfs_data.js
```
แก้วันที่ฉบับข้อมูลที่ `v='…'` ในสคริปต์ (บรรทัดสร้าง `data = dict(v=…)`) — ตัวเลขนี้เป็นกุญแจแคชของเส้นที่ลากตามถนนแล้ว เมื่อเปลี่ยน แคชในเบราว์เซอร์ผู้ใช้จะถูกสร้างใหม่

## 6. เส้นที่ "ตามถนนจริง" ทำงานอย่างไร

ไฟล์ GTFS ให้เส้นมาหยาบ (บางช่วงเป็นเส้นตรงยาวหลายสิบ กม.) เว็บจึงปรับเส้นในเบราว์เซอร์ผู้ใช้ตอนใช้งาน:
- รถเมล์/รถตู้/รถทัวร์: ส่งให้ OSRM (`SNAP_HOSTS`) หาเส้นทางตามถนน — ช่วงสั้นใช้ map-matching, ช่วงข้ามไกล (≥1.5 กม.) ใช้ routing ระหว่างจุดจอด
- รถไฟ/เรือ: ดึงรางรถไฟ/เส้นทางเรือจาก OpenStreetMap (Overpass) แล้วหาทางสั้นสุดตามรางระหว่างจุด
- ผลที่ได้เก็บใน IndexedDB ของเบราว์เซอร์ (ชื่อฐาน `next-route-snap`) จึงลากครั้งแรกเท่านั้น ครั้งต่อไปเร็ว
- เปิด/ปิดได้ที่ ☰ → "ปรับเส้นให้ตรงถนน/รางจริง"
- เส้นจะค่อย ๆ ปรับตามที่เห็นบนหน้าจอ (แผนที่ขยับ = ดึงเพิ่ม) และเส้นที่เลือกในหน้า "สายทั้งหมด" จะถูกปรับก่อน
- เซิร์ฟเวอร์ OSRM/Overpass สาธารณะมีข้อจำกัดความถี่ ถ้าใช้งานหนักแนะนำตั้งเซิร์ฟเวอร์ของตัวเองแล้วใส่ใน `config.js`

## 7. ข้อจำกัดที่ควรรู้
- ข้อมูล GTFS ของรถไฟทางไกลบางสาย (เช่น สาย 102 เชียงใหม่–กรุงเทพ) ระบุจุดจอดไว้ในไฟล์เพียงไม่กี่แห่ง เส้นบนแผนที่ครบทั้งสายแต่รายชื่อสถานีไม่ครบ (หน้ารายละเอียดมีคำเตือนให้)
- ไม่มีข้อมูลรถสด/ค่าโดยสารของรถนอกเหนือจาก BTS/MRT/ARL/SRT — เวลาเป็นค่าประมาณ
- ไทล์ Longdo: ใช้ URL `https://ms.longdo.com/mmmap/tile.php?key=…&proj=epsg3857&zoom={z}&x={x}&y={y}` ตามเอกสารของ Longdo ถ้า Longdo เปลี่ยนรูปแบบ ให้แก้ฟังก์ชัน `styleOf` ใน `src/js/ui.js`

## 8. แหล่งข้อมูล / เครดิต
GTFS: สำนักงานนโยบายและแผนการขนส่งและจราจร (สนข.) ผ่าน Namtang · แผนที่: OpenFreeMap, © OpenStreetMap contributors, Esri World Imagery, OpenTopoMap, CARTO, Longdo Map · ไลบรารี: Leaflet, MapLibre GL
