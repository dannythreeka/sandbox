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
  type WeatherKind,
  type WindDirection,
} from "@azure-voyage/shared";
import { hexCorners, hexToPixel, pixelToHex } from "./hexPixel";

const TERRAIN_COLOR: Record<string, number> = {
  [TERRAIN.DEEP]: 0x0c3050,
  [TERRAIN.SHALLOW]: 0x1d5f92,
  [TERRAIN.REEF]: 0x8a6d3b,
  [TERRAIN.LAND]: 0x35543a,
  [TERRAIN.PORT]: 0xd9a441,
};
/** M15 古典海圖風：每種地形的抖動替代色（約 1/4 格），打破整片平色的塑膠感 */
const TERRAIN_COLOR_ALT: Record<string, number> = {
  [TERRAIN.DEEP]: 0x0e3558,
  [TERRAIN.SHALLOW]: 0x216aa0,
  [TERRAIN.REEF]: 0x7d6236,
  [TERRAIN.LAND]: 0x2e4a34,
  [TERRAIN.PORT]: 0xd9a441,
};
/**
 * hex 邊 e（連接 hexCorners 的第 e 與 e+1 個頂點）對應的鄰居方位。
 * pointy-top 頂點自 -30° 起每 60° 一個（螢幕座標 y 向下），邊中點依序落在
 * 0°/60°/120°/180°/240°/300° → 東、東南、西南、西、西北、東北。
 */
const EDGE_TO_DIR = [0, 5, 4, 3, 2, 1] as const;

/** 航跡最長保留時間（毫秒）；點與點之間的取樣間隔 */
const TRAIL_TTL_MS = 2600;
const TRAIL_SAMPLE_MS = 90;
/** 單 tick 位移超過此距離視為「非航行的大跳」（戰敗拖回母港等）→ 瞬移不做動畫 */
const TELEPORT_DIST = 60;

// ── M14 天氣視覺：粒子數量上限常數化，避免無節制成長吃效能 ──
const SPARKLE_COUNT = 220;
const WIND_STREAK_COUNT = 36;
const RAIN_STREAK_COUNT = 60;
const WEATHER_EFFECTS_KEY = "azure-voyage:weather-effects-off";

function weatherEffectsDisabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(WEATHER_EFFECTS_KEY) === "1";
}

export interface OtherFleetMarker {
  id: string;
  pos: OffsetCoord;
  name: string;
}

export interface SeaMapProps {
  fleetPos: OffsetCoord;
  /** SAILING 時自動開啟鏡頭跟隨 */
  sailing: boolean;
  routeWaypoints: OffsetCoord[] | null;
  visitedPortIds: ReadonlySet<string>;
  /**
   * M30：玩家其他艦隊（非目前操作中）的位置——只畫簡化標記＋名稱標籤，
   * 不做逐幀內插動畫（每次快照更新才重繪一次，不像主力艦隊那樣平滑移動）。
   */
  otherFleets?: OtherFleetMarker[];
  onPortClick: (portId: string) => void;
  /** 點擊任一可航行海格（自由航行）；點到港口格會走 onPortClick */
  onSeaClick: (coord: OffsetCoord) => void;
  /**
   * M12：船隻靜止時（DOCKED/ANCHORED 瞄準中）要預覽的航向；null／undefined
   * 不套用。SAILING 中船隻本來就在移動，靠移動方向自然轉向，不需要這個。
   */
  previewHeading?: WindDirection | null;
  /** M14：艦隊目前所在海域的當日風向／天氣，驅動風紋與天氣視覺效果 */
  windDir?: WindDirection | null;
  weather?: WeatherKind | null;
  /** M14：每次遞增即觸發一次「風暴事件實際觸發」的全屏閃光＋震動（與 STORM_BREWING 天氣預兆是兩回事） */
  stormFlashTrigger?: number;
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

/** 港口標記外環（visited 狀態變化時重繪） */
function drawPortRing(g: Graphics, visited: boolean): void {
  g.clear()
    .circle(0, 0, 5.5)
    .fill({ color: 0x08111f, alpha: 0.6 })
    .stroke({ width: 1.4, color: visited ? 0xd9a441 : 0x6b7280, alpha: 0.95 });
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
  windDir = null,
  weather = null,
  stormFlashTrigger = 0,
  otherFleets = [],
}: SeaMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const shipRef = useRef<Container | null>(null);
  const otherFleetsContainerRef = useRef<Container | null>(null);
  const shipTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const trailRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const trailGfxRef = useRef<Graphics | null>(null);
  const routeGfxRef = useRef<Graphics | null>(null);
  const destGfxRef = useRef<Graphics | null>(null);
  const portVisualsRef = useRef<Map<string, { marker: Graphics; anchorGlyph: Text; label: Text }>>(
    new Map(),
  );
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
  const windDirRef = useRef(windDir);
  windDirRef.current = windDir;
  const weatherRef = useRef(weather);
  weatherRef.current = weather;
  // M14：天氣效果圖層與觸發狀態；粒子位置存在 ref 裡，ticker 內逐幀更新，
  // 不透過 React state（每幀都 setState 會炸 render）。
  const sparkleGfxRef = useRef<Graphics | null>(null);
  const windStreakGfxRef = useRef<Graphics | null>(null);
  const windStreaksRef = useRef<{ x: number; y: number }[]>([]);
  const fogGfxRef = useRef<Graphics | null>(null);
  const stormTintGfxRef = useRef<Graphics | null>(null);
  const rainGfxRef = useRef<Graphics | null>(null);
  const rainStreaksRef = useRef<{ x: number; y: number }[]>([]);
  const lightningUntilRef = useRef(0);
  const stormFlashGfxRef = useRef<Graphics | null>(null);
  const stormFlashAtRef = useRef(0);
  const stormFlashTriggerRef = useRef(stormFlashTrigger);

  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const effectsEnabledRef = useRef(true);
  useEffect(() => {
    const enabled = !weatherEffectsDisabled();
    effectsEnabledRef.current = enabled;
    setEffectsEnabled(enabled);
  }, []);
  function toggleEffects(): void {
    const next = !effectsEnabledRef.current;
    effectsEnabledRef.current = next;
    setEffectsEnabled(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WEATHER_EFFECTS_KEY, next ? "0" : "1");
    }
  }

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

        // ── 地形（一次性烘焙；M15 古典海圖風：雙色抖動＋水面細格線）──
        const terrain = new Graphics();
        for (let row = 0; row < HEXMAP.height; row++) {
          for (let col = 0; col < HEXMAP.width; col++) {
            const t = terrainAt(HEXMAP, { col, row });
            const center = hexToPixel({ col, row });
            const alt = ((col * 7 + row * 13) & 3) === 0; // 確定性抖動：不用亂數，重繪必一致
            terrain.poly(hexCorners(center)).fill(alt ? TERRAIN_COLOR_ALT[t] : TERRAIN_COLOR[t]);
            if (isNavigable(t)) {
              terrain.poly(hexCorners(center)).stroke({ width: 0.4, color: 0x08111f, alpha: 0.16 });
            }
          }
        }
        world.addChild(terrain);

        // ── 海岸線描邊（M15）：陸地格朝水域的每一條邊畫砂色筆觸，
        // 大陸輪廓立刻有手繪海圖的清晰感 ──
        const coast = new Graphics();
        for (let row = 0; row < HEXMAP.height; row++) {
          for (let col = 0; col < HEXMAP.width; col++) {
            if (terrainAt(HEXMAP, { col, row }) !== TERRAIN.LAND) continue;
            const corners = hexCorners(hexToPixel({ col, row }));
            for (let e = 0; e < 6; e++) {
              const n = hexNeighborInDirection({ col, row }, EDGE_TO_DIR[e]);
              if (!inBounds(HEXMAP, n) || !isNavigable(terrainAt(HEXMAP, n))) continue;
              const e2 = ((e + 1) % 6) * 2;
              coast.moveTo(corners[e * 2], corners[e * 2 + 1]).lineTo(corners[e2], corners[e2 + 1]);
            }
          }
        }
        coast.stroke({ width: 1.2, color: 0xc8b98a, alpha: 0.75 });
        world.addChild(coast);

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

        // ── 港口標記（金環＋錨徽）+ 名稱標籤 ──
        for (const port of PORTS) {
          const center = hexToPixel(port.coord);
          const visited = visitedRef.current.has(port.id);
          const marker = new Graphics();
          drawPortRing(marker, visited);
          marker.position.set(center.x, center.y);
          marker.eventMode = "static";
          marker.cursor = "pointer";
          marker.on("pointerdown", (e: FederatedPointerEvent) => {
            e.stopPropagation();
            onPortClickRef.current(port.id);
          });
          world.addChild(marker);

          const anchorGlyph = new Text({
            text: "⚓",
            style: { fontSize: 6.5, fill: visited ? 0xffe08a : 0x9aa4b2 },
            resolution: 3,
          });
          anchorGlyph.anchor.set(0.5);
          anchorGlyph.position.set(center.x, center.y);
          anchorGlyph.eventMode = "none";
          world.addChild(anchorGlyph);

          const label = new Text({
            text: port.name,
            style: {
              fontFamily: "Palatino, Georgia, 'Noto Serif TC', serif",
              fontSize: 9,
              fill: 0xe8dcc0,
              stroke: { color: 0x08111f, width: 2 },
            },
            resolution: 2,
          });
          label.anchor.set(0.5, 1);
          label.position.set(center.x, center.y - 7);
          label.alpha = visited ? 0.95 : 0.5;
          world.addChild(label);

          portVisualsRef.current.set(port.id, { marker, anchorGlyph, label });
        }

        // ── M14 天氣視覺（世界座標圖層：隨地圖平移縮放）──
        let mapPixelW = 0;
        let mapPixelH = 0;
        for (let row = 0; row < HEXMAP.height; row++) {
          for (let col = 0; col < HEXMAP.width; col++) {
            const p = hexToPixel({ col, row });
            if (p.x > mapPixelW) mapPixelW = p.x;
            if (p.y > mapPixelH) mapPixelH = p.y;
          }
        }
        // 波光：固定散佈在可航行海面上的小白點，只用整層透明度做「閃爍」動畫
        // （不逐點動畫、不逐幀重繪座標，效能成本趨近於零）。
        const sparkleGfx = new Graphics();
        for (let i = 0; i < SPARKLE_COUNT; i++) {
          const x = Math.random() * mapPixelW;
          const y = Math.random() * mapPixelH;
          const hex = pixelToHex({ x, y });
          if (!inBounds(HEXMAP, hex) || !isNavigable(terrainAt(HEXMAP, hex))) continue;
          sparkleGfx.circle(x, y, 0.6).fill(0xdbe7f3);
        }
        sparkleGfx.alpha = 0.22;
        sparkleGfxRef.current = sparkleGfx;
        world.addChild(sparkleGfx);

        // 風紋：沿當日風向緩慢平移的短弧線（世界座標，跟著地圖一起縮放平移）
        const windStreakGfx = new Graphics();
        windStreakGfxRef.current = windStreakGfx;
        world.addChild(windStreakGfx);
        windStreaksRef.current = Array.from({ length: WIND_STREAK_COUNT }, () => ({
          x: Math.random() * mapPixelW,
          y: Math.random() * mapPixelH,
        }));

        // ── 艦隊（帆船圖形）──
        const ship = buildShipSprite();
        shipRef.current = ship;
        world.addChild(ship);
        const initial = hexToPixel(fleetPosRef.current);
        ship.position.set(initial.x, initial.y);
        shipTargetRef.current = initial;

        // ── M30：其他艦隊的簡化標記（不逐幀動畫，快照更新時整層重繪）──
        const otherFleetsContainer = new Container();
        otherFleetsContainerRef.current = otherFleetsContainer;
        world.addChild(otherFleetsContainer);

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

        // ── M14 天氣視覺（螢幕座標圖層：蓋在畫面上，不隨地圖平移縮放）──
        const fogGfx = new Graphics();
        fogGfx.eventMode = "none";
        fogGfxRef.current = fogGfx;
        app.stage.addChild(fogGfx);

        const stormTintGfx = new Graphics();
        stormTintGfx.eventMode = "none";
        stormTintGfxRef.current = stormTintGfx;
        app.stage.addChild(stormTintGfx);

        const rainGfx = new Graphics();
        rainGfx.eventMode = "none";
        rainGfxRef.current = rainGfx;
        app.stage.addChild(rainGfx);
        rainStreaksRef.current = Array.from({ length: RAIN_STREAK_COUNT }, () => ({
          x: Math.random() * app.screen.width,
          y: Math.random() * app.screen.height,
        }));

        const stormFlashGfx = new Graphics();
        stormFlashGfx.eventMode = "none";
        stormFlashGfxRef.current = stormFlashGfx;
        app.stage.addChild(stormFlashGfx);

        let fogAlpha = 0;
        let stormTintAlpha = 0;

        // ── M15 地圖裝飾（螢幕座標）：雙金線外框 + 風向羅盤 ──
        const frame = new Graphics();
        frame.eventMode = "none";
        app.stage.addChild(frame);
        let frameW = 0;
        let frameH = 0;

        const compass = new Container();
        compass.eventMode = "none";
        const compassBase = new Graphics()
          .circle(0, 0, 26)
          .fill({ color: 0x08111f, alpha: 0.55 })
          .stroke({ width: 1.5, color: 0xd9a441, alpha: 0.8 })
          .circle(0, 0, 20)
          .stroke({ width: 0.6, color: 0xd9a441, alpha: 0.45 });
        // 八芒星刻度（古典羅盤的星芒）
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI / 4) * i;
          const len = i % 2 === 0 ? 18 : 11;
          compassBase.moveTo(0, 0).lineTo(Math.cos(a) * len, Math.sin(a) * len);
        }
        compassBase.stroke({ width: 0.8, color: 0x9fc3e0, alpha: 0.55 });
        compass.addChild(compassBase);
        const windNeedle = new Graphics()
          .poly([15, 0, -6, -4.5, -2, 0, -6, 4.5])
          .fill(0xffe08a)
          .stroke({ width: 0.6, color: 0x7a5230 });
        compass.addChild(windNeedle);
        app.stage.addChild(compass);

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

          // ── M14 天氣視覺 ──
          if (effectsEnabledRef.current) {
            const weatherNow = weatherRef.current;
            const wind = windDirRef.current;

            // 波光：緩慢的全域明暗脈動；微風時更亮更活躍（BALANCE.WEATHER_BREEZE_*）
            const sg = sparkleGfxRef.current;
            if (sg) {
              const base = weatherNow === "BREEZE" ? 0.42 : 0.22;
              sg.alpha = base + 0.12 * Math.sin(now / 900);
            }

            // 風紋：沿當日風向緩慢平移的短弧線，超出地圖範圍環繞回來——風看得見。
            const wg = windStreakGfxRef.current;
            if (wg && wind !== null) {
              const originPx = hexToPixel({ col: 0, row: 0 });
              const nextPx = hexToPixel(hexNeighborInDirection({ col: 0, row: 0 }, wind));
              const dlen = Math.hypot(nextPx.x - originPx.x, nextPx.y - originPx.y) || 1;
              const ux = (nextPx.x - originPx.x) / dlen;
              const uy = (nextPx.y - originPx.y) / dlen;
              const speed = 14;
              wg.clear();
              for (const s of windStreaksRef.current) {
                s.x += ux * speed * dt;
                s.y += uy * speed * dt;
                if (s.x < 0) s.x += mapPixelW;
                if (s.x > mapPixelW) s.x -= mapPixelW;
                if (s.y < 0) s.y += mapPixelH;
                if (s.y > mapPixelH) s.y -= mapPixelH;
                wg.moveTo(s.x - ux * 4, s.y - uy * 4)
                  .lineTo(s.x, s.y)
                  .stroke({ width: 0.6, color: 0xbfe8ff, alpha: 0.25 });
              }
            }

            // 霧：半透明灰白 overlay（螢幕座標，緩慢淡入淡出避免天氣切換時跳變）
            const fg = fogGfxRef.current;
            if (fg) {
              const targetFog = weatherNow === "FOG" ? 0.32 : 0;
              fogAlpha += (targetFog - fogAlpha) * Math.min(1, dt * 2);
              fg.clear();
              if (fogAlpha > 0.001) {
                fg.rect(0, 0, app.screen.width, app.screen.height).fill({
                  color: 0xdbe7f3,
                  alpha: fogAlpha,
                });
              }
            }

            // 風暴醞釀：色調壓暗 + 斜向雨絲 + 偶發閃光（預兆，不是風暴事件本身）
            const stg = stormTintGfxRef.current;
            const rg = rainGfxRef.current;
            if (stg && rg) {
              const brewing = weatherNow === "STORM_BREWING";
              const targetTint = brewing ? 0.3 : 0;
              stormTintAlpha += (targetTint - stormTintAlpha) * Math.min(1, dt * 2);
              if (brewing && Math.random() < 0.003) lightningUntilRef.current = now + 120;
              const flash = now < lightningUntilRef.current ? 0.35 : 0;
              stg.clear();
              if (stormTintAlpha > 0.001) {
                stg.rect(0, 0, app.screen.width, app.screen.height).fill({
                  color: 0x0b1526,
                  alpha: stormTintAlpha,
                });
              }
              if (flash > 0) {
                stg.rect(0, 0, app.screen.width, app.screen.height).fill({
                  color: 0xffffff,
                  alpha: flash,
                });
              }

              rg.clear();
              if (brewing) {
                for (const s of rainStreaksRef.current) {
                  s.x -= 60 * dt;
                  s.y += 220 * dt;
                  if (s.y > app.screen.height) {
                    s.y -= app.screen.height;
                    s.x = Math.random() * app.screen.width;
                  }
                  if (s.x < 0) s.x += app.screen.width;
                  rg.moveTo(s.x, s.y)
                    .lineTo(s.x + 4, s.y - 14)
                    .stroke({ width: 1, color: 0x9fc3e0, alpha: 0.35 });
                }
              }
            }
          } else {
            // 特效關閉：確保殘留的 overlay 不會卡在半透明狀態
            fogGfxRef.current?.clear();
            stormTintGfxRef.current?.clear();
            rainGfxRef.current?.clear();
            if (sparkleGfxRef.current) sparkleGfxRef.current.alpha = 0;
            fogAlpha = 0;
            stormTintAlpha = 0;
          }

          // 風暴事件實際觸發（server:event）：全屏短促閃白 + 輕微震動，
          // 與上面「風暴醞釀」天氣預兆是兩回事——這裡不受特效開關影響（重要狀態變化，不是氛圍裝飾）。
          const sfg = stormFlashGfxRef.current;
          if (sfg) {
            const elapsed = now - stormFlashAtRef.current;
            if (elapsed >= 0 && elapsed < 260) {
              const t = elapsed / 260;
              sfg.clear().rect(0, 0, app.screen.width, app.screen.height).fill({
                color: 0xffffff,
                alpha: (1 - t) * 0.6,
              });
              const shake = (1 - t) * 4;
              app.stage.position.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
            } else if (app.stage.position.x !== 0 || app.stage.position.y !== 0) {
              sfg.clear();
              app.stage.position.set(0, 0);
            }
          }

          // M15：地圖外框（尺寸變動時重畫）與羅盤（指針平滑轉向當日風向）
          if (app.screen.width !== frameW || app.screen.height !== frameH) {
            frameW = app.screen.width;
            frameH = app.screen.height;
            frame
              .clear()
              .rect(3, 3, frameW - 6, frameH - 6)
              .stroke({ width: 1.5, color: 0xd9a441, alpha: 0.45 })
              .rect(7, 7, frameW - 14, frameH - 14)
              .stroke({ width: 0.6, color: 0xd9a441, alpha: 0.25 });
          }
          compass.position.set(app.screen.width - 46, app.screen.height - 46);
          const windNow = windDirRef.current;
          compass.visible = windNow !== null;
          if (windNow !== null) {
            // 與 HUD 箭頭同一約定：dir 0=東、逆時針；螢幕 y 向下故取負角
            const targetRot = (-Math.PI / 3) * windNow;
            let cd = targetRot - windNeedle.rotation;
            while (cd > Math.PI) cd -= 2 * Math.PI;
            while (cd < -Math.PI) cd += 2 * Math.PI;
            windNeedle.rotation += cd * Math.min(1, dt * 5);
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

  // M30：其他艦隊標記——每次清單變動整層重繪（無逐幀動畫，簡化標記＋名稱）
  useEffect(() => {
    const container = otherFleetsContainerRef.current;
    if (!container) return;
    container.removeChildren();
    for (const other of otherFleets) {
      const center = hexToPixel(other.pos);
      const marker = new Graphics()
        .poly([0, -5, 4.3, 2.5, -4.3, 2.5])
        .fill({ color: 0x1d5f92, alpha: 0.85 })
        .stroke({ width: 1, color: 0xd9e8f5, alpha: 0.9 });
      marker.position.set(center.x, center.y);
      container.addChild(marker);

      const label = new Text({
        text: other.name,
        style: {
          fontFamily: "Palatino, Georgia, 'Noto Serif TC', serif",
          fontSize: 8,
          fill: 0xbcd6ec,
          stroke: { color: 0x08111f, width: 2 },
        },
        resolution: 2,
      });
      label.anchor.set(0.5, 1);
      label.position.set(center.x, center.y - 6);
      container.addChild(label);
    }
  }, [otherFleets]);

  // 開始航行時自動恢復鏡頭跟隨
  useEffect(() => {
    if (sailing) setFollowBoth(true);
  }, [sailing]);

  // M14：風暴事件實際觸發時（server:event）閃一次白＋震動；跳過掛載當下的初值。
  const stormFlashMountedRef = useRef(false);
  useEffect(() => {
    if (!stormFlashMountedRef.current) {
      stormFlashMountedRef.current = true;
      stormFlashTriggerRef.current = stormFlashTrigger;
      return;
    }
    if (stormFlashTrigger !== stormFlashTriggerRef.current) {
      stormFlashTriggerRef.current = stormFlashTrigger;
      stormFlashAtRef.current = performance.now();
    }
  }, [stormFlashTrigger]);

  // 港口標記／標籤隨造訪狀態更新
  useEffect(() => {
    for (const port of PORTS) {
      const vis = portVisualsRef.current.get(port.id);
      if (!vis) continue;
      const visited = visitedPortIds.has(port.id);
      drawPortRing(vis.marker, visited);
      vis.anchorGlyph.style.fill = visited ? 0xffe08a : 0x9aa4b2;
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
    <div className="map-stage">
      <div
        ref={hostRef}
        className="h-[480px] w-full overflow-hidden md:h-[64vh] md:min-h-[560px]"
      />
      <button
        className={
          follow
            ? "absolute right-3 top-3 rounded border border-gold/80 bg-gold/90 px-2 py-1 text-xs font-medium text-abyss"
            : "absolute right-3 top-3 rounded border border-foam/25 bg-slate-900/90 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700/85"
        }
        onClick={() => setFollowBoth(!followRef.current)}
      >
        {follow ? "鏡頭跟隨中" : "回到艦隊"}
      </button>
      <button
        className="absolute left-3 top-10 rounded border border-foam/20 bg-slate-900/90 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700/85"
        onClick={toggleEffects}
        title="關閉／開啟波光、風紋、霧、風暴等天氣視覺效果"
      >
        {effectsEnabled ? "天氣特效：開" : "天氣特效：關"}
      </button>
      <span className="pointer-events-none absolute bottom-3 left-3 rounded border border-foam/15 bg-slate-950/80 px-2 py-1 text-xs text-slate-300">
        點港口或海面設定航向 · 拖曳平移 · 滾輪縮放
      </span>
    </div>
  );
}
