'use strict';

function readAscii(buffer, offset, length) {
  return buffer.toString('ascii', offset, offset + length);
}

function parsePcmWav(input) {
  var buffer = Buffer.isBuffer(input) ? input : Buffer.from(input || []);
  if (buffer.length < 44 || readAscii(buffer, 0, 4) !== 'RIFF' || readAscii(buffer, 8, 4) !== 'WAVE') {
    throw new Error('invalid RIFF/WAVE audio');
  }
  var format = null;
  var dataOffset = 0;
  var dataLength = 0;
  var offset = 12;
  while (offset + 8 <= buffer.length) {
    var id = readAscii(buffer, offset, 4);
    var size = buffer.readUInt32LE(offset + 4);
    var start = offset + 8;
    var end = Math.min(start + size, buffer.length);
    if (id === 'fmt ' && size >= 16) {
      format = {
        audioFormat:buffer.readUInt16LE(start),
        channels:buffer.readUInt16LE(start + 2),
        sampleRate:buffer.readUInt32LE(start + 4),
        bitsPerSample:buffer.readUInt16LE(start + 14)
      };
    } else if (id === 'data') {
      dataOffset = start;
      dataLength = end - start;
      break;
    }
    offset = start + size + (size % 2);
  }
  if (!format || !dataOffset || !dataLength) throw new Error('WAV is missing fmt or data chunks');
  if (format.audioFormat !== 1 || format.bitsPerSample !== 16) throw new Error('only 16-bit PCM WAV is supported');
  if (!format.channels || !format.sampleRate) throw new Error('invalid WAV format values');
  var sampleCount = Math.floor(dataLength / 2);
  var samples = new Int16Array(sampleCount);
  for (var i = 0; i < sampleCount; i += 1) samples[i] = buffer.readInt16LE(dataOffset + i * 2);
  return Object.assign(format, { samples:samples, frames:Math.floor(sampleCount / format.channels) });
}

function analyzeWav(input) {
  var wav = parsePcmWav(input);
  var sum = 0;
  var sumSquares = 0;
  var peak = 0;
  var silent = 0;
  var clipped = 0;
  var crossings = 0;
  var previous = 0;
  var silenceThreshold = 32768 * 0.01;
  for (var i = 0; i < wav.samples.length; i += 1) {
    var sample = wav.samples[i];
    var absolute = Math.abs(sample);
    sum += sample;
    sumSquares += sample * sample;
    if (absolute > peak) peak = absolute;
    if (absolute <= silenceThreshold) silent += 1;
    if (absolute >= 32760) clipped += 1;
    if (i && ((sample >= 0) !== (previous >= 0))) crossings += 1;
    previous = sample;
  }
  var count = Math.max(1, wav.samples.length);
  return {
    durationMs:Math.round(wav.frames / wav.sampleRate * 10000) / 10,
    sampleRate:wav.sampleRate,
    channels:wav.channels,
    peak:Math.round(peak / 32768 * 10000) / 10000,
    rms:Math.round(Math.sqrt(sumSquares / count) / 32768 * 10000) / 10000,
    dcOffset:Math.round(sum / count / 32768 * 100000) / 100000,
    silenceRatio:Math.round(silent / count * 10000) / 10000,
    clippingRatio:Math.round(clipped / count * 100000) / 100000,
    zeroCrossingRate:Math.round(crossings / count * 10000) / 10000
  };
}

function assertVoiceQuality(metrics) {
  var issues = [];
  if (!(metrics.durationMs >= 180)) issues.push('audio is too short');
  if (!(metrics.rms >= 0.005)) issues.push('audio is effectively silent');
  if (metrics.clippingRatio > 0.005) issues.push('audio contains excessive clipping');
  if (Math.abs(metrics.dcOffset) > 0.05) issues.push('audio has excessive DC offset');
  return issues;
}

module.exports = { parsePcmWav:parsePcmWav, analyzeWav:analyzeWav, assertVoiceQuality:assertVoiceQuality };
