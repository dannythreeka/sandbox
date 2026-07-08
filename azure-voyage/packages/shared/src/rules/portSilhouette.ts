/**
 * 港口剪影生成（docs/10 §M13）：純函式，依 portId + size 決定性產生一組
 * 建築矩形，供前端過場動畫畫成 SVG。零美術資產——每港靠確定性隨機讓外觀
 * 彼此不同但固定不變（同 portId 永遠長一樣）。
 */
import { Rng } from "./rng";

export interface PortBuilding {
  x: number;
  width: number;
  height: number;
  /** 屋頂三角形高度；0＝平頂 */
  roofPeak: number;
}

export interface PortSilhouette {
  buildings: PortBuilding[];
  dockWidth: number;
  /** 剪影總寬度（最後一棟建築的右緣），供 SVG viewBox 使用 */
  totalWidth: number;
}

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 港口規模 1–3 → 建築數量（規模越大，剪影越密集）。 */
export function buildingCountForSize(size: 1 | 2 | 3): number {
  return 4 + size * 3;
}

export function generatePortSilhouette(portId: string, size: 1 | 2 | 3): PortSilhouette {
  const rng = new Rng((hashString(portId) ^ Math.imul(size, 0x9e3779b1)) >>> 0);
  const count = buildingCountForSize(size);
  const buildings: PortBuilding[] = [];
  let cursor = 4;
  for (let i = 0; i < count; i++) {
    const width = rng.int(10, 22);
    const height = rng.int(18, 24 + size * 14);
    const roofPeak = rng.chance(0.5) ? rng.int(3, 10) : 0;
    buildings.push({ x: cursor, width, height, roofPeak });
    cursor += width + rng.int(2, 6);
  }
  const dockWidth = 24 + size * 16;
  return { buildings, dockWidth, totalWidth: Math.max(cursor, dockWidth) };
}
