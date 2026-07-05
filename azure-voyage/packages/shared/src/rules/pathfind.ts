import { coordKey, hexNeighbors, offsetDistance, type OffsetCoord } from "./hex";
import { inBounds, isNavigable, moveCost, terrainAt, type HexMap } from "./hexmap";

/** 簡單二元堆積（min-heap），A* 用 */
class MinHeap<T> {
  private items: { priority: number; value: T }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(priority: number, value: T): void {
    this.items.push({ priority, value });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= this.items[i].priority) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): T | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0 && last) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.items.length && this.items[l].priority < this.items[smallest].priority)
          smallest = l;
        if (r < this.items.length && this.items[r].priority < this.items[smallest].priority)
          smallest = r;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top?.value;
  }
}

/**
 * A* 尋路（docs/05 §3）。回傳含起點與終點的路徑；不可達回 null。
 * 前端預覽與後端驗證共用同一實作，結果必須一致。
 */
export function findPath(
  map: HexMap,
  start: OffsetCoord,
  goal: OffsetCoord,
): OffsetCoord[] | null {
  if (!inBounds(map, start) || !inBounds(map, goal)) return null;
  if (!isNavigable(terrainAt(map, start)) || !isNavigable(terrainAt(map, goal))) return null;

  const startKey = coordKey(start);
  const goalKey = coordKey(goal);
  const cameFrom = new Map<string, OffsetCoord>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const open = new MinHeap<OffsetCoord>();
  open.push(offsetDistance(start, goal), start);

  while (open.size > 0) {
    const current = open.pop()!;
    const currentKey = coordKey(current);
    if (currentKey === goalKey) {
      const path: OffsetCoord[] = [current];
      let key = currentKey;
      while (key !== startKey) {
        const prev = cameFrom.get(key)!;
        path.push(prev);
        key = coordKey(prev);
      }
      return path.reverse();
    }
    const currentG = gScore.get(currentKey)!;
    for (const next of hexNeighbors(current)) {
      if (!inBounds(map, next)) continue;
      const terrain = terrainAt(map, next);
      if (!isNavigable(terrain)) continue;
      const tentative = currentG + moveCost(terrain);
      const nextKey = coordKey(next);
      const known = gScore.get(nextKey);
      if (known === undefined || tentative < known) {
        gScore.set(nextKey, tentative);
        cameFrom.set(nextKey, current);
        open.push(tentative + offsetDistance(next, goal), next);
      }
    }
  }
  return null;
}
