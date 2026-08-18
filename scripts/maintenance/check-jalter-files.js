const fs = require('fs');
const path = require('path');

const showDir = 'E:/code/2/lora/AI/SceneShowcase/2026-08-15_v23';
const id1 = 'pc_jeanne_alter_jalter_r18_bedroom_soles_leather_boots';
const id2 = 'pc_jeanne_alter_jalter_r18_hotel_mirror_back_curves';

const f1 = path.join(showDir, 'images', `${id1}.jpg`);
const f2 = path.join(showDir, 'images', `${id2}.jpg`);

console.log(id1, 'exists:', fs.existsSync(f1));
console.log(id2, 'exists:', fs.existsSync(f2));

if (fs.existsSync(f1) && fs.existsSync(f2)) {
  const buf1 = fs.readFileSync(f1);
  const buf2 = fs.readFileSync(f2);
  console.log('Are files byte-for-byte identical?', buf1.equals(buf2));
}
