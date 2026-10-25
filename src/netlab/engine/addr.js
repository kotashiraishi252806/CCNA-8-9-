// IPv4 / MAC helpers. IPs are handled as unsigned 32-bit numbers internally.

export function parseIp(str) {
  if (typeof str !== "string") return null;
  const parts = str.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

export function ipToStr(n) {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function isValidMask(str) {
  const m = parseIp(str);
  if (m === null || m === 0) return false;
  const inv = ~m >>> 0;
  return (inv & (inv + 1)) === 0;
}

export function maskToPrefix(str) {
  const m = parseIp(str);
  if (m === null) return null;
  let bits = 0;
  for (let i = 31; i >= 0 && (m >>> i) & 1; i--) bits++;
  return bits;
}

export function sameSubnet(ipA, ipB, mask) {
  const a = parseIp(ipA);
  const b = parseIp(ipB);
  const m = parseIp(mask);
  if (a === null || b === null || m === null) return false;
  return ((a & m) >>> 0) === ((b & m) >>> 0);
}

export const BROADCAST_MAC = "ffff.ffff.ffff";

// Deterministic MAC derived from the device id, in Cisco dotted notation (0001.xxxx.xxxx).
export function makeMac(seed) {
  let h = 0x811c9dc5;
  const bytes = [];
  for (let round = 0; round < 4; round++) {
    for (const ch of `${seed}:${round}`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    bytes.push(h & 255);
  }
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0001.${hex.slice(0, 4)}.${hex.slice(4, 8)}`;
}

// 0001.a2b3.c4d5 -> 00-01-a2-b3-c4-d5
export function macWin(mac) {
  return mac.replace(/\./g, "").replace(/(..)(?=.)/g, "$1-");
}
