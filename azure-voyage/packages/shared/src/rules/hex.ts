/**
 * 六角格幾何（docs/01 §4.1）。
 * 儲存採 odd-r offset（col,row，row-major 網格好存 JSON）；
 * 計算採 axial/cube（距離、直線好算）。兩者互轉在此統一。
 */

export interface OffsetCoord {
  col: number;
  row: number;
}

export interface AxialCoord {
  q: number;
  r: number;
}

export function oddrToAxial({ col, row }: OffsetCoord): AxialCoord {
  return { q: col - (row - (row & 1)) / 2, r: row };
}

export function axialToOddr({ q, r }: AxialCoord): OffsetCoord {
  return { col: q + (r - (r & 1)) / 2, row: r };
}

export function hexDistance(a: AxialCoord, b: AxialCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function offsetDistance(a: OffsetCoord, b: OffsetCoord): number {
  return hexDistance(oddrToAxial(a), oddrToAxial(b));
}

/** odd-r offset 的六個鄰居（偶數列與奇數列的位移不同）。 */
const NEIGHBORS_EVEN: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1],
];
const NEIGHBORS_ODD: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1],
];

export function hexNeighbors({ col, row }: OffsetCoord): OffsetCoord[] {
  const deltas = row & 1 ? NEIGHBORS_ODD : NEIGHBORS_EVEN;
  return deltas.map(([dc, dr]) => ({ col: col + dc, row: row + dr }));
}

export function coordEquals(a: OffsetCoord, b: OffsetCoord): boolean {
  return a.col === b.col && a.row === b.row;
}

export function coordKey({ col, row }: OffsetCoord): string {
  return `${col},${row}`;
}
