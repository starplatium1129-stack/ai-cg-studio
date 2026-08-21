const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const natsumeSrc = 'E:/code/live2d/星光咖啡馆与死神之蝶—四季夏目';
const natsumeDestSounds = path.resolve('assets/live2d/natsume/sounds');
if (!fs.existsSync(natsumeDestSounds)) fs.mkdirSync(natsumeDestSounds, { recursive: true });

const natsumeWavs = fs.readdirSync(natsumeSrc).filter(f => f.endsWith('.wav'));
console.log('Encoding Natsume sounds:', natsumeWavs.length);

for (const wav of natsumeWavs) {
  const base = path.basename(wav, '.wav');
  const srcPath = path.join(natsumeSrc, wav);
  const destPath = path.join(natsumeDestSounds, base + '.mp3');
  const res = spawnSync('ffmpeg', ['-i', srcPath, '-b:a', '96k', '-y', destPath], { stdio: 'ignore' });
  if (res.status !== 0) {
    console.error('Failed to encode:', wav);
  }
}

const neneSrc = 'E:/code/live2d/AYACHI NENE/綾地寧々/vioce';
const neneDestSounds = path.resolve('assets/live2d/nene/sounds');
if (!fs.existsSync(neneDestSounds)) fs.mkdirSync(neneDestSounds, { recursive: true });

const neneWavs = fs.readdirSync(neneSrc).filter(f => f.endsWith('.wav'));
console.log('Encoding Nene sounds:', neneWavs.length);

for (const wav of neneWavs) {
  const base = path.basename(wav, '.wav');
  const srcPath = path.join(neneSrc, wav);
  let cleanName = base;
  if (base.includes('ReStart')) cleanName = 'song_restart';
  else if (base.includes('0721')) cleanName = 'tap_skirt_0721';
  else if (base.includes('啵央央')) cleanName = 'tap_face_boyang';
  else if (base.includes('来吧')) cleanName = 'tap_body_come';
  else if (base.includes('柊史')) cleanName = 'tap_head_shuji';
  else if (base.includes('盯')) cleanName = 'tap_chest_stare';
  else if (base.includes('今天真的很开心')) cleanName = 'intimacy_confess';

  const destPath = path.join(neneDestSounds, cleanName + '.mp3');
  const res = spawnSync('ffmpeg', ['-i', srcPath, '-b:a', '96k', '-y', destPath], { stdio: 'ignore' });
  if (res.status !== 0) {
    console.error('Failed to encode:', wav);
  }
}

console.log('Done!');
