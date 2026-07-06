import type { OffsetCoord } from "@azure-voyage/shared";

/** odd-r pointy-top 六角格像素座標換算（docs/07 §3）。 */
export const HEX_SIZE = 7;
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
export const HEX_HEIGHT = HEX_SIZE * 2;
export const HEX_VERT_SPACING = HEX_HEIGHT * 0.75;

export function hexToPixel({ col, row }: OffsetCoord): { x: number; y: number } {
  const x = HEX_WIDTH * (col + 0.5 * (row & 1));
  const y = HEX_VERT_SPACING * row;
  return { x, y };
}

/** 六角格頂點（pointy-top，供 Graphics.poly 使用） */
export function hexCorners(center: { x: number; y: number }): number[] {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30;
    const angleRad = (Math.PI / 180) * angleDeg;
    points.push(center.x + HEX_SIZE * Math.cos(angleRad), center.y + HEX_SIZE * Math.sin(angleRad));
  }
  return points;
}
