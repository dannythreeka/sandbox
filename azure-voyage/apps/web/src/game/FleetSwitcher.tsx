"use client";

import { portById, type FleetView } from "@azure-voyage/shared";

const ACTIVITY_LABELS: Record<FleetView["activity"], string> = {
  DOCKED: "停靠中",
  SAILING: "航行中",
  ANCHORED: "下錨中",
  EXPLORING: "探索中",
  IN_BATTLE: "海戰中",
};

interface Props {
  fleets: FleetView[];
  selectedFleetId: string;
  onSelect: (fleetId: string) => void;
}

/**
 * 艦隊切換列（M29）：玩家有多支艦隊時，用來挑選「目前操作中」的那一支——
 * 海圖、貿易、造船廠等面板都跟著這裡選的艦隊走。只有一支艦隊時不顯示。
 */
export function FleetSwitcher({ fleets, selectedFleetId, onSelect }: Props) {
  if (fleets.length <= 1) return null;

  return (
    <section className="panel flex flex-wrap items-center gap-2 py-2">
      <span className="text-sm text-slate-400">艦隊：</span>
      {fleets.map((f) => (
        <button
          key={f.id}
          className={f.id === selectedFleetId ? "btn" : "btn-ghost"}
          onClick={() => onSelect(f.id)}
        >
          {f.name}
          <span className="ml-1 text-xs opacity-70">
            （{ACTIVITY_LABELS[f.activity]}
            {f.dockedPortId ? `・${portById(f.dockedPortId).name}` : ""}・{f.ships.length} 船）
          </span>
        </button>
      ))}
    </section>
  );
}
