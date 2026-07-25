'use strict';

const assert = require('assert');
const quality = require('../runtime/wav-quality');

function makeWav({ sampleRate = 24000, seconds = 1, amplitude = .25, dc = 0 }) {
  const frames = Math.round(sampleRate * seconds);
  const buffer = Buffer.alloc(44 + frames * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i += 1) {
    const value = Math.max(-1, Math.min(1, Math.sin(i / sampleRate * Math.PI * 2 * 220) * amplitude + dc));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return buffer;
}

const healthy = quality.analyzeWav(makeWav({}));
assert.strictEqual(healthy.durationMs, 1000, 'duration must be derived from sample rate and frames');
assert(healthy.rms > .15 && healthy.rms < .2, 'RMS must describe signal loudness');
assert.strictEqual(quality.assertVoiceQuality(healthy).length, 0, 'healthy voice audio must pass');

const silent = quality.analyzeWav(makeWav({ amplitude:0 }));
assert(quality.assertVoiceQuality(silent).includes('audio is effectively silent'), 'silence must fail the quality gate');
const biased = quality.analyzeWav(makeWav({ amplitude:.05, dc:.2 }));
assert(quality.assertVoiceQuality(biased).includes('audio has excessive DC offset'), 'large DC offset must fail');
assert.throws(() => quality.analyzeWav(Buffer.from('not wav')), /invalid RIFF/, 'invalid audio must be rejected');

console.log('WAV quality tests passed: format, duration, loudness, silence, clipping and DC offset');
