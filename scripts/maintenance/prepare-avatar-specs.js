const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const POPULAR_FILE = path.join(ROOT, 'data', 'popular-characters.json');
const popData = JSON.parse(fs.readFileSync(POPULAR_FILE, 'utf8'));
const popList = popData.characters || popData;

const newCharIds = new Set([
  'fern_frieren', 'jeanne_alter', 'matou_sakura', 'mimori_byakuya',
  'reze_chainsaw', 'saint_cecilia', 'sylphiette', 'yor_forger', 'yuigahama_yui'
]);

const earliestChars = popList.filter(c => !newCharIds.has(c.id));

console.log(`=== 待重绘头像的前期热门角色清单 (${earliestChars.length} 位) ===`);

const avatarSpecs = earliestChars.map(c => {
  const defaultOutfit = c.outfits?.find(o => o.isDefault) || c.outfits?.[0];
  const outfitTokens = defaultOutfit?.tokens?.join(', ') || '';
  const outfitProse = defaultOutfit?.prose || '';
  const idTokens = c.identityTokens?.join(', ') || '';

  return {
    id: c.id,
    displayName: c.displayName || c.name,
    franchise: c.franchise,
    prompt: `@rella, 1girl, solo, ${idTokens}, ${outfitTokens}, upper body portrait, looking at viewer, pristine anime aesthetic, clean studio lighting, soft subtle background, masterpiece, best quality`,
    negative: 'bad anatomy, bad hands, lowres, blurry, multiple characters, text, signature, watermark',
    seed: 8800000 + Math.floor(Math.random() * 1000000)
  };
});

fs.writeFileSync(path.join(ROOT, 'runtime', 'earliest-popular-avatar-specs.json'), JSON.stringify(avatarSpecs, null, 2) + '\n', 'utf8');
console.log('Avatar generation specs saved to runtime/earliest-popular-avatar-specs.json');
