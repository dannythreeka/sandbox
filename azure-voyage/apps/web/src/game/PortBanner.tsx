"use client";

import { generatePortSilhouette, portById, regionForCoord } from "@azure-voyage/shared";
import { GameArt } from "./GameArt";

/**
 * 停靠面板頂部的港口場景橫幅（docs/11 §3 整合點 A）。
 * 有 `art/port-scene/<regionId>-s<size>.webp` 就顯示場景圖；沒有就用
 * M13 的確定性剪影生成器畫一張「夜港剪影」——同港永遠同構圖。
 */
export function PortBanner({ portId }: { portId: string }) {
  const port = portById(portId);
  const region = regionForCoord(port.coord);
  const artId = `${region.id.replace("region.", "")}-s${port.size}`;

  return (
    <div className="relative h-28 overflow-hidden rounded-lg border border-gold/30 md:h-36">
      <GameArt
        category="port-scene"
        id={artId}
        alt={`${port.name}港景`}
        className="h-full w-full object-cover"
        fallback={<SilhouetteBanner portId={portId} />}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-abyss/90 via-transparent to-transparent" />
      <div className="absolute bottom-2 left-4">
        <span className="font-serif text-xl font-bold tracking-wide text-gold drop-shadow">
          {port.name}
        </span>
        <span className="ml-3 text-xs text-foam/80">
          {region.name} · 規模 {"⭐".repeat(port.size)}
        </span>
      </div>
    </div>
  );
}

function SilhouetteBanner({ portId }: { portId: string }) {
  const port = portById(portId);
  const s = generatePortSilhouette(portId, port.size);

  return (
    <svg
      viewBox={`0 0 ${s.totalWidth} 60`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label={`${port.name}剪影`}
    >
      <defs>
        <linearGradient id={`sky-${portId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b1526" />
          <stop offset="70%" stopColor="#1d3352" />
          <stop offset="100%" stopColor="#2a4568" />
        </linearGradient>
      </defs>
      <rect width={s.totalWidth} height={60} fill={`url(#sky-${portId})`} />
      <circle cx={s.totalWidth * 0.78} cy={14} r={5} fill="#f5eedc" opacity={0.85} />
      <rect x={0} y={54} width={s.dockWidth} height={6} fill="#3a2716" />
      {s.buildings.map((b, i) => (
        <g key={i} fill="#101f33" stroke="#08111f" strokeWidth={0.5}>
          <rect x={b.x} y={54 - b.height} width={b.width} height={b.height} />
          {b.roofPeak > 0 && (
            <polygon
              points={`${b.x},${54 - b.height} ${b.x + b.width / 2},${54 - b.height - b.roofPeak} ${b.x + b.width},${54 - b.height}`}
            />
          )}
          {/* 幾扇亮著燭光的窗，讓夜港剪影有生活感（確定性：以序號取模） */}
          {b.width >= 12 && b.height >= 24 && (
            <rect
              x={b.x + 3 + (i % 3) * 2}
              y={54 - b.height + 6 + (i % 4) * 3}
              width={2}
              height={3}
              fill="#d9a441"
              stroke="none"
              opacity={0.9}
            />
          )}
        </g>
      ))}
    </svg>
  );
}
