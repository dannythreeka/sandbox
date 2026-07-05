/**
 * 海圖產生腳本（docs/03 §4）。
 * 執行：pnpm --filter @azure-voyage/shared mapgen
 * 輸出：src/content/map/hexmap.json（commit 進 repo；遊戲執行期不重生成）
 *
 * 演算法（固定 seed，完全可重現）：
 * 1. 全圖深海；北/西/東畫大陸邊緣（南方為開放的暮色洋）
 * 2. 每個港口旁生成 1 塊隨機走行的陸地 blob（規模與港口 size 成正比）
 * 3. 淺海帶：任何鄰接陸地的深海 → 淺海
 * 4. 珊瑚環弧與暮色洋撒暗礁（避開港口近域）
 * 5. 港口格標記 P，並保證至少 2 個可航行鄰格
 * 6. 連通性保證：BFS 檢查所有港口互通，不通則開鑿水道
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PORTS } from "../src/content/ports";
import { regionById } from "../src/content/regions";
import { coordKey, hexNeighbors, offsetDistance, type OffsetCoord } from "../src/rules/hex";
import { Rng } from "../src/rules/rng";

const WIDTH = 120;
const HEIGHT = 80;
const MAP_SEED = 0x5ea_f00d;

const rng = new Rng(MAP_SEED);
// grid[row][col]
const grid: string[][] = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill("D"));

const inBounds = ({ col, row }: OffsetCoord) =>
  col >= 0 && col < WIDTH && row >= 0 && row < HEIGHT;
const get = (c: OffsetCoord) => grid[c.row][c.col];
const set = (c: OffsetCoord, t: string) => {
  grid[c.row][c.col] = t;
};

// ── 1. 大陸邊緣 ──
for (let col = 0; col < WIDTH; col++) {
  set({ col, row: 0 }, "L");
  set({ col, row: 1 }, "L");
}
for (let row = 0; row < HEIGHT - 6; row++) {
  set({ col: 0, row }, "L");
  set({ col: 1, row }, "L");
  set({ col: WIDTH - 1, row }, "L");
  set({ col: WIDTH - 2, row }, "L");
}

// ── 2. 港口旁陸地 blob ──
const portCells = new Set(PORTS.map((p) => coordKey(p.coord)));
const nearPort = (c: OffsetCoord, radius: number) =>
  PORTS.some((p) => offsetDistance(c, p.coord) <= radius);

for (const port of PORTS) {
  const start = rng.pick(
    hexNeighbors(port.coord).filter((n) => inBounds(n) && !portCells.has(coordKey(n))),
  );
  let cursor = start;
  const steps = 10 + port.size * 14;
  for (let i = 0; i < steps; i++) {
    if (inBounds(cursor) && !portCells.has(coordKey(cursor))) set(cursor, "L");
    const nexts = hexNeighbors(cursor).filter(
      (n) => inBounds(n) && !portCells.has(coordKey(n)) && !nearPort(n, 0),
    );
    if (nexts.length === 0) break;
    // 偏向遠離港口方向擴張，避免把港口圍死
    cursor = rng.pick(nexts);
  }
}

// ── 3. 淺海帶 ──
for (let row = 0; row < HEIGHT; row++) {
  for (let col = 0; col < WIDTH; col++) {
    const c = { col, row };
    if (get(c) === "D" && hexNeighbors(c).some((n) => inBounds(n) && get(n) === "L")) {
      set(c, "S");
    }
  }
}

// ── 4. 暗礁 ──
for (const regionId of ["region.coral_arc", "region.dusk_expanse"]) {
  const { bounds } = regionById(regionId);
  for (let row = bounds.rowMin; row <= Math.min(bounds.rowMax, HEIGHT - 1); row++) {
    for (let col = bounds.colMin; col <= Math.min(bounds.colMax, WIDTH - 1); col++) {
      const c = { col, row };
      if (get(c) === "D" && !nearPort(c, 2) && rng.chance(0.035)) set(c, "R");
    }
  }
}

// ── 5. 港口格與出海口 ──
for (const port of PORTS) {
  set(port.coord, "P");
  const neighbors = hexNeighbors(port.coord).filter(inBounds);
  const navigable = neighbors.filter((n) => get(n) !== "L");
  for (let i = navigable.length; i < 2; i++) {
    const landNeighbor = neighbors.find((n) => get(n) === "L");
    if (landNeighbor) set(landNeighbor, "S");
  }
}

// ── 6. 連通性 ──
function bfsReachable(from: OffsetCoord): Set<string> {
  const seen = new Set<string>([coordKey(from)]);
  const queue = [from];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    for (const n of hexNeighbors(cur)) {
      const key = coordKey(n);
      if (inBounds(n) && !seen.has(key) && get(n) !== "L") {
        seen.add(key);
        queue.push(n);
      }
    }
  }
  return seen;
}

function carveToward(from: OffsetCoord, targets: Set<string>): void {
  // 朝最近的已連通水域直線開鑿
  let best: OffsetCoord | null = null;
  let bestDist = Infinity;
  for (const key of targets) {
    const [col, row] = key.split(",").map(Number);
    const d = offsetDistance(from, { col, row });
    if (d < bestDist) {
      bestDist = d;
      best = { col, row };
    }
  }
  if (!best) throw new Error("carveToward: no target water");
  let cursor = from;
  while (!targets.has(coordKey(cursor))) {
    const next = hexNeighbors(cursor)
      .filter(inBounds)
      .sort((a, b) => offsetDistance(a, best!) - offsetDistance(b, best!))[0];
    if (get(next) === "L") set(next, "S");
    cursor = next;
  }
}

for (let guard = 0; guard < 50; guard++) {
  const reachable = bfsReachable(PORTS[0].coord);
  const unreachable = PORTS.filter((p) => !reachable.has(coordKey(p.coord)));
  if (unreachable.length === 0) break;
  carveToward(unreachable[0].coord, reachable);
  if (guard === 49) throw new Error("mapgen: connectivity not achieved");
}

// ── 驗證 + 輸出 ──
const finalReachable = bfsReachable(PORTS[0].coord);
for (const port of PORTS) {
  if (!finalReachable.has(coordKey(port.coord))) {
    throw new Error(`mapgen: port unreachable after carving: ${port.id}`);
  }
}

const rows = grid.map((r) => r.join(""));
const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/content/map/hexmap.json",
);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ width: WIDTH, height: HEIGHT, rows }, null, 0) + "\n");

const counts: Record<string, number> = {};
for (const row of rows) for (const ch of row) counts[ch] = (counts[ch] ?? 0) + 1;
console.log(`hexmap.json written (${WIDTH}x${HEIGHT})`, counts);
