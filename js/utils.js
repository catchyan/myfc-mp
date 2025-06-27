export function ab2str(buf) {
  const uint8Arr = new Uint8Array(buf);
  let str = '';
  const chunkSize = 0x8000; // 32KB
  for (let i = 0; i < uint8Arr.length; i += chunkSize) {
    str += String.fromCharCode.apply(null, uint8Arr.subarray(i, i + chunkSize));
  }
  return str;
}

export function isInBtn(x, y, btnX, btnY, btnRadius) {
  return Math.sqrt((x - btnX) ** 2 + (y - btnY) ** 2) <= btnRadius;
}

export function getDirections(x, y, dpadX, dpadY, dpadSize) {
  const dx = x - dpadX;
  const dy = y - dpadY;
  const r = dpadSize / 2;
  if (Math.sqrt(dx * dx + dy * dy) > r) return [];
  const threshold = r * 0.3; // 斜方向判定灵敏度
  let dirs = [];
  if (dy < -threshold) dirs.push('UP');
  if (dy > threshold) dirs.push('DOWN');
  if (dx < -threshold) dirs.push('LEFT');
  if (dx > threshold) dirs.push('RIGHT');
  return dirs;
}
