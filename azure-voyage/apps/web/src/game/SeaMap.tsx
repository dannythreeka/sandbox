"use client";

import { useEffect, useRef, useState } from "react";
import { Application, Container, FederatedPointerEvent, Graphics, Text } from "pixi.js";
import {
  HEXMAP,
  hexNeighborInDirection,
  inBounds,
  isNavigable,
  portAtCoord,
  PORTS,
  TERRAIN,
  terrainAt,
  type OffsetCoord,
  type WindDirection,
} from "@azure-voyage/shared";
import { hexCorners, hexToPixel, pixelToHex } from "./hexPixel";

const TERRAIN_COLOR: Record<string, number> = {
  [TERRAIN.DEEP]: 0x0b2e4d,
  [TERRAIN.SHALLOW]: 0x1f6fa8,
  [TERRAIN.REEF]: 0x8a6d3b,
  [TERRAIN.LAND]: 0x2e5d3f,
  [TERRAIN.PORT]: 0xd9a441,
};

/** 航跡最長保留時間（毫秒）；點與點之間的取樣間隔 */
const TRAIL_TTL_MS = 2600;
const TRAIL_SAMPLE_MS = 90;
/** 單 tick 位移超過此距離視為「非航行的大跳」（戰敗拖回母港等）→ 瞬移不做動畫 */
const TELEPORT_DIST = 60;

export interface SeaMapProps {
  fleetPos: OffsetCoord;
  /** SAILING 時自動開啟鏡頭跟隨 */
  sailing: boolean;
  routeWaypoints: OffsetCoord[] | null;
  visitedPortIds: ReadonlySet<string>;
  onPortClick: (portId: string) => void;
  /** 點擊任一可航行海格（自由航行）；點到港口格會走 onPortClick */
  onSeaClick: (coord: OffsetCoord) => void;
  /**
   * M12：船隻靜止時（DOCKED/ANCHORED 瞄準中）要預覽的航向；null／undefined
   * 不套用。SAILING 中船隻本來就在移動，靠移動方向自然轉向，不需要這個。
   */
  previewHeading?: WindDirection | null;
}

/** 程式繪製的原創俯視帆船（船首朝 +x，rotation 對齊航向） */
function buildShipSprite(): Container {
  const ship = new Container();
  const hull = new Graphics()
    .poly([-7, -2.6, 3, -2.6, 7.5, 0, 3, 2.6, -7, 2.6, -8.5, 0])
    .fill(0x7a5230)
    .stroke({ width: 0.8, color: 0x3a2716, alpha: 0.9 });
  ship.addChild(hull);
  // 三面橫帆（俯視視角下呈垂直船身的橫條）
  for (const [x, w] of [
    [-3.5, 7],
    [0.5, 8],
    [4, 5.5],
  ] as const) {
    const sail = new Graphics()
      .roundRect(x - 1.1, -w / 2, 2.2, w, 1)
      .fill(0xf5eedc)
      .stroke({ width: 0.5, color: 0xb9ac8d });
    ship.addChild(sail);
  }
  return ship;
}

/** 手繪虛線折線（pixi 無內建 dash） */
function drawDashedPath(
  g: Graphics,
  pts: { x: number; y: number }[],
  dash = 5,
  gap = 4,
): void {
  let drawing = true;
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    let ax = pts[i - 1].x;
    let ay = pts[i - 1].y;
    const bx = pts[i].x;
    const by = pts[i].y;
    let seg = Math.hypot(bx - ax, by - ay);
    if (seg === 0) continue;
    const ux = (bx - ax) / seg;
    const uy = (by - ay) / seg;
    while (seg > 1e-6) {
      const budget = (drawing ? dash : gap) - carry;
      const step = Math.min(seg, budget);
      const nx = ax + ux * step;
      const ny = ay + uy * step;
      if (drawing) g.moveTo(ax, ay).lineTo(nx, ny);
      ax = nx;
      ay = ny;
      seg -= step;
      carry += step;
      if (carry >= (drawing ? dash : gap) - 1e-6) {
        drawing = !drawing;
        carry = 0;
      }
    }
  }
  g.stroke({ width: 1.2, color: 0xffe08a, alpha: 0.85 });
}

/**
 * PixiJS 海圖（docs/07 §3）。M10：船隻改為有航向的帆船圖形、tick 之間平滑內插移動、
 * 航跡漸淡、鏡頭跟隨、點擊任意海面自由航行、港口名稱標籤與目的地脈動標記。
 */
export function SeaMap({
  fleetPos,
  sailing,
  routeWaypoints,
  visitedPortIds,
  onPortClick,
  onSeaClick,
  previewHeading = null,
}: SeaMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const shipRef = useRef<Container | null>(null);
  const shipTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const trailRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const trailGfxRef = useRef<Graphics | null>(null);
  const routeGfxRef = useRef<Graphics | null>(null);
  const destGfxRef = useRef<Graphics | null>(null);
  const portVisualsRef = useRef<Map<string, { marker: Graphics; label: Text }>>(new Map());
  const followRef = useRef(true);
  const fleetPosRef = useRef(fleetPos);
  fleetPosRef.current = fleetPos;
  const previewHeadingRef = useRef(previewHeading);
  previewHeadingRef.current = previewHeading;
  const onPortClickRef = useRef(onPortClick);
  onPortClickRef.current = onPortClick;
  const onSeaClickRef = useRef(onSeaClick);
  onSeaClickRef.current = onSeaClick;
  const visitedRef = useRef(visitedPortIds);
  visitedRef.current = visitedPortIds;

  const [follow, setFollow] = useState(true);
  function setFollowBoth(v: boolean): void {
    followRef.current = v;
    setFollow(v);
  }

  useEffect(() => {
    let disposed = false;
    const app = new Application();

    void app
      .init({
        background: "#08111f",
        resizeTo: hostRef.current ?? undefined,
        antialias: true,
      })
      .then(() => {
        if (disposed || !hostRef.current) return;
        hostRef.current.appendChild(app.canvas);
        appRef.current = app;

        const world = new Container();
        worldRef.current = world;
        app.stage.addChild(world);

        // ── 地形（一次性烘焙）──
        const terrain = new Graphics();
        for (let row = 0; row < HEXMAP.height; row++) {
          for (let col = 0; col < HEXMAP.width; col++) {
            const t = terrainAt(HEXMAP, { col, row });
            const center = hexToPixel({ col, row });
            terrain.poly(hexCorners(center)).fill(TERRAIN_COLOR[t]);
          }
        }
        world.addChild(terrain);

        // ── 航跡（畫在航線與港口之下）──
        const trailGfx = new Graphics();
        trailGfxRef.current = trailGfx;
        world.addChild(trailGfx);

        // ── 航線預覽與目的地標記 ──
        const routeGfx = new Graphics();
        routeGfxRef.current = routeGfx;
        world.addChild(routeGfx);
        const destGfx = new Graphics()
          .circle(0, 0, 6)
          .stroke({ width: 1.4, color: 0xffe08a, alpha: 0.9 })
          .circle(0, 0, 1.6)
          .fill(0xffe08a);
        destGfx.visible = false;
        destGfxRef.current = destGfx;
        world.addChild(destGfx);

        // ── 港口標記 + 名稱標籤 ──
        for (const port of PORTS) {
          const center = hexToPixel(port.coord);
          const visited = visitedRef.current.has(port.id);
          const marker = new Graphics()
            .circle(0, 0, 4)
            .fill(visited ? 0xffe08a : 0x6b7280)
            .stroke({ width: 1, color: 0x000000, alpha: 0.4 });
          marker.position.set(center.x, center.y);
          marker.eventMode = "static";
          marker.cursor = "pointer";
          marker.on("pointerdown", (e: FederatedPointerEvent) => {
            e.stopPropagation();
            onPortClickRef.current(port.id);
          });
          world.addChild(marker);

          const label = new Text({
            text: port.name,
            style: {
              fontFamily: "system-ui, sans-serif",
              fontSize: 9,
              fill: 0xdbe7f3,
              stroke: { color: 0x08111f, width: 2 },
            },
            resolution: 2,
          });
          label.anchor.set(0.5, 1);
          label.position.set(center.x, center.y - 6);
          label.alpha = visited ? 0.95 : 0.5;
          world.addChild(label);

          portVisualsRef.current.set(port.id, { marker, label });
        }

        // ── 艦隊（帆船圖形）──
        const ship = buildShipSprite();
        shipRef.current = ship;
        world.addChild(ship);
        const initial = hexToPixel(fleetPosRef.current);
        ship.position.set(initial.x, initial.y);
        shipTargetRef.current = initial;

        // 初始鏡頭置中於艦隊
        world.position.set(
          (hostRef.current?.clientWidth ?? 600) / 2 - initial.x,
          (hostRef.current?.clientHeight ?? 400) / 2 - initial.y,
        );

        // ── 拖曳平移（拖動即暫停跟隨）/ 點擊海面設定航向 / 滾輪縮放 ──
        let dragging = false;
        let moved = false;
        let last = { x: 0, y: 0 };
        app.stage.eventMode = "static";
        app.stage.hitArea = app.screen;
        app.stage.on("pointerdown", (e) => {
          dragging = true;
          moved = false;
          last = { x: e.global.x, y: e.global.y };
        });
        const endDrag = (e: FederatedPointerEvent, isTap: boolean) => {
          // 港口標記的 pointerdown 會 stopPropagation（stage 收不到 down 但收得到 up），
          // 不檢查 dragging 的話，點港口標記會又觸發一次海面點擊，造成重複設定航向。
          if (!dragging) return;
          dragging = false;
          if (!isTap || moved) return;
          const local = world.toLocal(e.global);
          const hex = pixelToHex(local);
          if (!inBounds(HEXMAP, hex)) return;
          const t = terrainAt(HEXMAP, hex);
          if (t === TERRAIN.PORT) {
            const port = portAtCoord(hex);
            if (port) onPortClickRef.current(port.id);
          } else if (isNavigable(t)) {
            onSeaClickRef.current(hex);
          }
        };
        app.stage.on("pointerup", (e) => endDrag(e, true));
        app.stage.on("pointerupoutside", (e) => endDrag(e, false));
        app.stage.on("pointermove", (e) => {
          if (!dragging) return;
          const dx = e.global.x - last.x;
          const dy = e.global.y - last.y;
          if (!moved && Math.hypot(dx, dy) < 4) return; // 忽略手震，仍視為點擊
          moved = true;
          if (followRef.current) setFollowBoth(false); // 手動平移即暫停跟隨
          world.position.x += dx;
          world.position.y += dy;
          last = { x: e.global.x, y: e.global.y };
        });
        app.canvas.addEventListener(
          "wheel",
          (e) => {
            e.preventDefault();
            const scale = Math.min(3, Math.max(0.5, world.scale.x - e.deltaY * 0.001));
            world.scale.set(scale);
          },
          { passive: false },
        );

        // ── 主迴圈：船隻內插移動、轉向、航跡、目的地脈動、鏡頭跟隨 ──
        app.ticker.add(() => {
          const dt = app.ticker.deltaMS / 1000;
          const target = shipTargetRef.current;
          const dx = target.x - ship.position.x;
          const dy = target.y - ship.position.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.1) {
            const k = Math.min(1, dt * 3.2);
            ship.position.x += dx * k;
            ship.position.y += dy * k;
          }
          // 移動中靠位移方向自然轉向；靜止時（DOCKED/ANCHORED 瞄準）改用
          // M12 的 previewHeading 直接預覽選定航向，讓「轉舵」在出港前就看得到。
          const preview = previewHeadingRef.current;
          if (dist > 1.5 || preview !== null) {
            let targetAngle: number;
            if (dist > 1.5) {
              targetAngle = Math.atan2(dy, dx);
            } else {
              const from = hexToPixel(fleetPosRef.current);
              const to = hexToPixel(hexNeighborInDirection(fleetPosRef.current, preview!));
              targetAngle = Math.atan2(to.y - from.y, to.x - from.x);
            }
            let diff = targetAngle - ship.rotation;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            ship.rotation += diff * Math.min(1, dt * 6);
          }

          const now = performance.now();
          const trail = trailRef.current;
          if (dist > 0.6 && (trail.length === 0 || now - trail[trail.length - 1].t > TRAIL_SAMPLE_MS)) {
            trail.push({ x: ship.position.x, y: ship.position.y, t: now });
          }
          while (trail.length > 0 && now - trail[0].t > TRAIL_TTL_MS) trail.shift();
          const tg = trailGfxRef.current;
          if (tg) {
            tg.clear();
            for (let i = 1; i < trail.length; i++) {
              const age = (now - trail[i].t) / TRAIL_TTL_MS;
              tg.moveTo(trail[i - 1].x, trail[i - 1].y)
                .lineTo(trail[i].x, trail[i].y)
                .stroke({ width: 0.4 + 1.4 * (1 - age), color: 0xbfe8ff, alpha: 0.32 * (1 - age) });
            }
          }

          const dg = destGfxRef.current;
          if (dg?.visible) {
            const pulse = 0.8 + 0.25 * Math.sin(now / 280);
            dg.scale.set(pulse);
            dg.alpha = 0.55 + 0.3 * Math.sin(now / 280);
          }

          if (followRef.current) {
            const w = worldRef.current;
            if (w) {
              const cx = app.screen.width / 2 - ship.position.x * w.scale.x;
              const cy = app.screen.height / 2 - ship.position.y * w.scale.y;
              const kc = Math.min(1, dt * 4);
              w.position.x += (cx - w.position.x) * kc;
              w.position.y += (cy - w.position.y) * kc;
            }
          }
        });
      });

    return () => {
      disposed = true;
      portVisualsRef.current.clear();
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
    };
    // 僅初始化一次；後續更新透過下方 effect 操作既有物件（初次繪製用到的
    // props 皆以 ref 讀取，故意不放進 deps）
  }, []);

  // 艦隊位置更新：只更新內插目標，實際移動在 ticker 內完成；大跳直接瞬移
  useEffect(() => {
    const p = hexToPixel(fleetPos);
    shipTargetRef.current = p;
    const ship = shipRef.current;
    if (ship && Math.hypot(ship.position.x - p.x, ship.position.y - p.y) > TELEPORT_DIST) {
      ship.position.set(p.x, p.y);
      trailRef.current = [];
      trailGfxRef.current?.clear();
    }
  }, [fleetPos]);

  // 開始航行時自動恢復鏡頭跟隨
  useEffect(() => {
    if (sailing) setFollowBoth(true);
  }, [sailing]);

  // 港口標記／標籤隨造訪狀態更新
  useEffect(() => {
    for (const port of PORTS) {
      const vis = portVisualsRef.current.get(port.id);
      if (!vis) continue;
      const visited = visitedPortIds.has(port.id);
      vis.marker
        .clear()
        .circle(0, 0, 4)
        .fill(visited ? 0xffe08a : 0x6b7280)
        .stroke({ width: 1, color: 0x000000, alpha: 0.4 });
      vis.label.alpha = visited ? 0.95 : 0.5;
    }
  }, [visitedPortIds]);

  // 航線預覽更新（虛線 + 目的地標記）
  useEffect(() => {
    const g = routeGfxRef.current;
    const dg = destGfxRef.current;
    if (!g || !dg) return;
    g.clear();
    if (routeWaypoints && routeWaypoints.length > 1) {
      const pts = routeWaypoints.map(hexToPixel);
      drawDashedPath(g, pts);
      const dest = pts[pts.length - 1];
      dg.position.set(dest.x, dest.y);
      dg.visible = true;
    } else {
      dg.visible = false;
    }
  }, [routeWaypoints]);

  return (
    <div className="relative">
      <div
        ref={hostRef}
        className="h-[520px] w-full overflow-hidden rounded-md border border-foam/20 md:h-[60vh]"
      />
      <button
        className={
          follow
            ? "absolute right-2 top-2 rounded bg-gold/90 px-2 py-1 text-xs font-medium text-abyss"
            : "absolute right-2 top-2 rounded bg-slate-800/85 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700/85"
        }
        onClick={() => setFollowBoth(!followRef.current)}
      >
        {follow ? "鏡頭跟隨中" : "回到艦隊"}
      </button>
      <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-slate-900/70 px-2 py-1 text-xs text-slate-300">
        點港口或海面設定航向 · 拖曳平移 · 滾輪縮放
      </span>
    </div>
  );
}
