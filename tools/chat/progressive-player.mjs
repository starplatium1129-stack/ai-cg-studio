var FADE_S = 0.03;
var INITIAL_S = 3;

function findData(buf) {
  var v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  var p = 12;
  while (p + 8 <= buf.length) {
    if (v.getUint32(p, false) === 0x64617461) return p + 8;
    p += 8 + v.getUint32(p + 4, true);
    if ((p - 8) % 2) p++;
  }
  return -1;
}

function toF32(buf, bps, ch) {
  var n = Math.floor(buf.length / bps);
  var o = new Float32Array(n);
  var v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (var i = 0; i < n; i++) o[i] = (bps === 2 ? v.getInt16(i * 2, true) : v.getInt8(i)) / (bps === 2 ? 32768 : 128);
  return o;
}

export function isStreamingSupported() {
  return typeof ReadableStream !== 'undefined' && typeof Response !== 'undefined';
}

export function concatBufs(list) {
  if (!list || !list.length) return new ArrayBuffer(0);
  var len = 0;
  for (var i = 0; i < list.length; i++) len += list[i].byteLength;
  var r = new Uint8Array(len);
  var pos = 0;
  for (var i = 0; i < list.length; i++) { r.set(new Uint8Array(list[i]), pos); pos += list[i].byteLength; }
  return r.buffer;
}

export class ProgressivePlayer {
  constructor(audioContext, targetNode) {
    this.ctx = audioContext;
    this.target = targetNode;
    this.buf = null;
    this.written = 0;
    this.sr = 24000;
    this.ch = 1;
    this.bps = 2;
    this.playing = false;
    this._ready = false;
    this._hdr = new Uint8Array(0);
    this._off = -1;
    this._src = null;
    this._gain = null;
    this._dead = false;
    this.onDone = null;
  }

  ingest(chunk) {
    if (this._dead || !chunk || !chunk.byteLength) return;
    var b = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    if (!this._ready) {
      this._hdr = this._cat(this._hdr, b);
      if (this._hdr.length >= 44 && this._parse()) {
        var off = this._off;
        if (off > 0 && this._hdr.length > off) {
          var pcm = toF32(this._hdr.slice(off), this.bps, this.ch);
          if (pcm.length) this._push(pcm);
        }
        this._hdr = null;
      }
      return;
    }
    var pcm = toF32(b, this.bps, this.ch);
    if (pcm.length) this._push(pcm);
  }

  _parse() {
    var v = new DataView(this._hdr.buffer, this._hdr.byteOffset, this._hdr.byteLength);
    if (v.getUint32(0, false) !== 0x52494646) return false;
    this.sr = v.getUint32(24, true);
    this.ch = v.getUint16(22, true) || 1;
    this.bps = Math.max(1, Math.ceil((v.getUint16(34, true) || 16) / 8));
    this._off = findData(this._hdr);
    if (this._off < 0) return false;
    this._ready = true;
    return true;
  }

  _push(pcm) {
    var fr = Math.floor(pcm.length / this.ch);
    if (!fr) return;
    if (!this.buf) {
      this.buf = this.ctx.createBuffer(this.ch, Math.max(this.sr * INITIAL_S, fr * 2), this.sr);
    }
    while (this.written + fr > this.buf.length) this._grow();
    for (var ch = 0; ch < this.ch; ch++) {
      var d = this.buf.getChannelData(ch);
      for (var i = 0; i < fr; i++) d[this.written + i] = pcm[i * this.ch + ch];
    }
    this.written += fr;
    this._play();
  }

  _grow() {
    var nl = this.buf.length * 2;
    var nb = this.ctx.createBuffer(this.ch, nl, this.sr);
    for (var ch = 0; ch < this.ch; ch++) {
      var s = this.buf.getChannelData(ch);
      var d = nb.getChannelData(ch);
      for (var i = 0; i < this.written; i++) d[i] = s[i];
    }
    this.buf = nb;
  }

  _play() {
    var ctx = this.ctx;
    var now = ctx.currentTime;
    var fade = FADE_S;

    if (this._src) {
      try {
        this._gain.gain.cancelScheduledValues(now);
        this._gain.gain.setValueAtTime(this._gain.gain.value, now);
        this._gain.gain.linearRampToValueAtTime(0, now + fade);
        this._src.stop(now + fade);
      } catch (e) {}
    }

    var src = ctx.createBufferSource();
    src.buffer = this.buf;

    var g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(1, now + fade);
    src.connect(g);
    g.connect(this.target);

    var dur = this.written / this.sr;
    src.start(0, 0, dur);
    src.onended = (function (self, src, g) {
      return function () {
        if (self._src === src) {
          try { g.disconnect(); } catch (e) {}
          self._src = null;
          self._gain = null;
          self.playing = false;
          if (self._dead && typeof self.onDone === 'function') self.onDone();
        }
      };
    })(this, src, g);

    this._src = src;
    this._gain = g;
    this.playing = true;
  }

  finish() {
    this._dead = true;
  }

  stop() {
    this._dead = true;
    if (this._src) { try { this._src.stop(); } catch (e) {} try { this._gain.disconnect(); } catch (e) {} }
    this._src = null;
    this._gain = null;
    this.buf = null;
    this.playing = false;
    this._ready = false;
    this._hdr = new Uint8Array(0);
    this.written = 0;
  }

  _cat(a, b) {
    if (!a || !a.length) return b || new Uint8Array(0);
    if (!b || !b.length) return a;
    var r = new Uint8Array(a.length + b.length);
    r.set(a); r.set(b, a.length);
    return r;
  }
}
