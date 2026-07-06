"use client";

import { useEffect, useRef } from "react";
import { Application, Container, FederatedPointerEvent, Graphics } from "pixi.js";
import { HEXMAP, PORTS, TERRAIN, terrainAt, type OffsetCoord } from "@azure-voyage/shared";
import { hexCorners, hexToPixel } from "./hexPixel";

const TERRAIN_COLOR: Record<string, number> = {
  [TERRAIN.DEEP]: 0x0b2e4d,
  [TERRAIN.SHALLOW]: 0x1f6fa8,
  [TERRAIN.REEF]: 0x8a6d3b,
  [TERRAIN.LAND]: 0x2e5d3f,
  [TERRAIN.PORT]: 0xd9a441,
};

export interface SeaMapProps {
  fleetPos: OffsetCoord;
  routeWaypoints: OffsetCoord[] | null;
  visitedPortIds: ReadonlySet<string>;
  onPortClick: (portId: string) => void;
}

/**
 * PixiJS 海圖（docs/07 §3）。M2 簡化：地形一次性烘成單一 Graphics（9600 格靜態不變，
 * 不需要每幀重繪）；船隻與航線用獨立 Graphics 隨 props 更新，避免整個 canvas 重建。
 */
export function SeaMap({ fleetPos, routeWaypoints, visitedPortIds, onPortClick }: SeaMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const fleetGraphicRef = useRef<Graphics | null>(null);
  const routeGraphicRef = useRef<Graphics | null>(null);
  const onPortClickRef = useRef(onPortClick);
  onPortClickRef.current = onPortClick;

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

        // ── 港口標記 ──
        for (const port of PORTS) {
          const center = hexToPixel(port.coord);
          const visited = visitedPortIds.has(port.id);
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
        }

        // ── 航線預覽 ──
        const routeGraphic = new Graphics();
        routeGraphicRef.current = routeGraphic;
        world.addChild(routeGraphic);

        // ── 艦隊標記 ──
        const fleetGraphic = new Graphics().circle(0, 0, 3.5).fill(0xff5555);
        fleetGraphicRef.current = fleetGraphic;
        world.addChild(fleetGraphic);
        const initial = hexToPixel(fleetPos);
        fleetGraphic.position.set(initial.x, initial.y);

        // 初始鏡頭置中於艦隊
        world.position.set(
          (hostRef.current?.clientWidth ?? 600) / 2 - initial.x,
          (hostRef.current?.clientHeight ?? 400) / 2 - initial.y,
        );

        // ── 拖曳平移 + 滾輪縮放 ──
        let dragging = false;
        let last = { x: 0, y: 0 };
        app.stage.eventMode = "static";
        app.stage.hitArea = app.screen;
        app.stage.on("pointerdown", (e) => {
          dragging = true;
          last = { x: e.global.x, y: e.global.y };
        });
        app.stage.on("pointerup", () => (dragging = false));
        app.stage.on("pointerupoutside", () => (dragging = false));
        app.stage.on("pointermove", (e) => {
          if (!dragging) return;
          world.position.x += e.global.x - last.x;
          world.position.y += e.global.y - last.y;
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
      });

    return () => {
      disposed = true;
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
    };
    // 僅初始化一次；後續更新透過下方 effect 操作既有 Graphics（fleetPos/visitedPortIds
    // 只用於初次繪製，故意不放進 deps）
  }, []);

  // 艦隊位置更新（tick 動畫：直接設位置，M2 先不做內插平滑）
  useEffect(() => {
    const g = fleetGraphicRef.current;
    if (!g) return;
    const p = hexToPixel(fleetPos);
    g.position.set(p.x, p.y);
  }, [fleetPos]);

  // 航線預覽更新
  useEffect(() => {
    const g = routeGraphicRef.current;
    if (!g) return;
    g.clear();
    if (routeWaypoints && routeWaypoints.length > 1) {
      const pts = routeWaypoints.map(hexToPixel);
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
      g.stroke({ width: 1, color: 0xffe08a, alpha: 0.8 });
    }
  }, [routeWaypoints]);

  return <div ref={hostRef} className="h-[420px] w-full overflow-hidden rounded-md border border-foam/20" />;
}
