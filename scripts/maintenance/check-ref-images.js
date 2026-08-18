const fs = require('fs');
const path = require('path');

const ROOT = path.resolve('.');
const refDir = path.join(ROOT, 'assets', 'character-references');

function checkDir(charId) {
  const cDir = path.join(refDir, charId);
  if (!fs.existsSync(cDir)) return console.log(`${charId} dir does not exist`);
  const outfits = fs.readdirSync(cDir);
  console.log(`=== ${charId} outfits (${outfits.length}) ===`);
  outfits.forEach(o => {
    const oDir = path.join(cDir, o);
    const files = fs.readdirSync(oDir);
    console.log(`  - [${o}]: ${files.join(', ')}`);
  });
}

checkDir('jeanne_alter');
checkDir('mimori_byakuya');
checkDir('fern_frieren');
