'use strict';
// The part of Node's Buffer that the shared report and import code uses (src/report, src/import), for the
// Tauri window: a Uint8Array with little-endian reads/writes, UTF-8 / base64 / latin1 text and byte search.
(function () {
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8');
  function fromBase64(s) { const bin = atob(String(s).replace(/[^A-Za-z0-9+/=]/g, '')); const out = new Buffer(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  function toBase64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  class Buffer extends Uint8Array {
    static from(v, encoding) {
      if (typeof v === 'string') {
        if (encoding === 'base64') return fromBase64(v);
        if (encoding === 'latin1' || encoding === 'binary') { const b = new Buffer(v.length); for (let i = 0; i < v.length; i++) b[i] = v.charCodeAt(i) & 0xff; return b; }
        const u = enc.encode(v); return new Buffer(u.buffer, u.byteOffset, u.length);
      }
      if (v instanceof ArrayBuffer) return new Buffer(v.slice(0));
      if (ArrayBuffer.isView(v)) { const b = new Buffer(v.byteLength); b.set(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); return b; }
      if (Array.isArray(v)) { const b = new Buffer(v.length); b.set(v); return b; }
      throw new TypeError('Buffer.from: неподдерживаемое значение');
    }
    static alloc(n) { return new Buffer(n); }
    static isBuffer(v) { return v instanceof Buffer; }
    static byteLength(s) { return typeof s === 'string' ? enc.encode(s).length : s.byteLength; }
    static concat(list, total) {
      const n = total ?? list.reduce((a, b) => a + b.length, 0), out = new Buffer(n);
      let off = 0; for (const b of list) { out.set(b.subarray(0, Math.max(0, Math.min(b.length, n - off))), off); off += b.length; if (off >= n) break; }
      return out;
    }
    readUInt8(o = 0) { return this[o]; }
    readUInt16LE(o = 0) { return this[o] | (this[o + 1] << 8); }
    readUInt32LE(o = 0) { return (this[o] | (this[o + 1] << 8) | (this[o + 2] << 16)) + this[o + 3] * 0x1000000; }
    readInt32LE(o = 0) { return this[o] | (this[o + 1] << 8) | (this[o + 2] << 16) | (this[o + 3] << 24); }
    writeUInt8(v, o = 0) { this[o] = v & 0xff; return o + 1; }
    writeUInt16LE(v, o = 0) { this[o] = v & 0xff; this[o + 1] = (v >>> 8) & 0xff; return o + 2; }
    writeUInt32LE(v, o = 0) { this[o] = v & 0xff; this[o + 1] = (v >>> 8) & 0xff; this[o + 2] = (v >>> 16) & 0xff; this[o + 3] = (v >>> 24) & 0xff; return o + 4; }
    toString(encoding = 'utf8', start = 0, end = this.length) {
      const part = this.subarray(start, end);
      if (encoding === 'base64') return toBase64(part);
      if (encoding === 'latin1' || encoding === 'binary') { let s = ''; for (let i = 0; i < part.length; i++) s += String.fromCharCode(part[i]); return s; }
      if (encoding === 'hex') return [...part].map(b => b.toString(16).padStart(2, '0')).join('');
      return dec.decode(part);
    }
    // Node's slice is a view, like subarray.
    slice(start, end) { return this.subarray(start, end); }
    equals(other) { if (this.length !== other.length) return false; for (let i = 0; i < this.length; i++) if (this[i] !== other[i]) return false; return true; }
    // Search for a byte sequence (Node) or a single byte.
    indexOf(needle, from = 0) {
      if (typeof needle === 'number') return super.indexOf(needle, from);
      const n = typeof needle === 'string' ? Buffer.from(needle) : needle;
      outer: for (let i = Math.max(0, from); i <= this.length - n.length; i++) { for (let k = 0; k < n.length; k++) if (this[i + k] !== n[k]) continue outer; return i; }
      return -1;
    }
    lastIndexOf(needle, from = this.length) {
      if (typeof needle === 'number') return super.lastIndexOf(needle, from);
      const n = typeof needle === 'string' ? Buffer.from(needle) : needle;
      outer: for (let i = Math.min(from, this.length - n.length); i >= 0; i--) { for (let k = 0; k < n.length; k++) if (this[i + k] !== n[k]) continue outer; return i; }
      return -1;
    }
    includes(needle, from) { return this.indexOf(needle, from) !== -1; }
  }
  window.Buffer = Buffer;
})();
