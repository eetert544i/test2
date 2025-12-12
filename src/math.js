export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function vec2(x = 0, y = 0) {
  return { x, y };
}

export function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
export function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
export function scale(v, s) { return { x: v.x * s, y: v.y * s }; }
export function dot(a, b) { return a.x * b.x + a.y * b.y; }
export function length(v) { return Math.hypot(v.x, v.y); }
export function normalize(v) {
  const len = length(v) || 1;
  return { x: v.x / len, y: v.y / len };
}
export function perp(v) { return { x: -v.y, y: v.x }; }
export function crossZ(a, b) { return a.x * b.y - a.y * b.x; }
