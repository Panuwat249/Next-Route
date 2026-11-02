/* config.js — ไฟล์ตั้งค่าของ Next Route  (แก้ไฟล์นี้ แล้ว commit ได้เลย ไม่ต้อง build ใหม่)
   ค่าที่ไม่ได้ใส่ไว้ที่นี่ จะใช้ค่าเริ่มต้นในโปรแกรม */
window.CONFIG = {
  /* Longdo Map API key (https://map.longdo.com → API Key) ใช้กับโหมดแผนที่ "Longdo Map"
     คีย์นี้ใครเปิดซอร์สเว็บก็เห็นได้ → ที่ console ของ Longdo ให้จำกัดโดเมนที่ใช้ได้เป็นเว็บของคุณ (เช่น ชื่อผู้ใช้.github.io) */
  LONGDO_KEY: '18bd75c0b38cd1aad0edf57da3c5d389',

  /* เซิร์ฟเวอร์ OSRM สำหรับลากเส้นรถเมล์/รถตู้/รถทัวร์ให้ตามถนน (ต้องรองรับ /match/v1/driving และ /route/v1/driving) ลองตามลำดับ */
  SNAP_HOSTS: ['https://router.project-osrm.org', 'https://routing.openstreetmap.de/routed-car'],

  /* เซิร์ฟเวอร์ Overpass (ราง/เส้นทางเรือจาก OpenStreetMap, ป้ายรถเมล์ใกล้จุด, ทางออกสถานี) ถามทุกตัวพร้อมกัน ใช้คำตอบแรก */
  OVERPASS: ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
};
