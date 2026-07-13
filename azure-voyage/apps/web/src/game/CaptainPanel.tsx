"use client";

import { BALANCE, type CaptainView } from "@azure-voyage/shared";

interface Props {
  captain: CaptainView;
  onClose: () => void;
}

const STAT_LABELS: { key: keyof CaptainView["stats"]; label: string; effect: string }[] = [
  { key: "lead", label: "統率", effect: "欠薪時緩解官員忠誠度下滑" },
  { key: "nav", label: "航海", effect: "艦隊航速加成" },
  { key: "combat", label: "戰鬥", effect: "海戰砲擊傷害加成" },
  { key: "trade", label: "商才", effect: "買賣折扣加成" },
  { key: "lore", label: "學識", effect: "降低風暴／海賊遭遇機率" },
];

/** 提督（艦長）個人狀態面板（M27，往大航海時代靠近：玩家角色本人的 RPG 成長）。 */
export function CaptainPanel({ captain, onClose }: Props) {
  const expIntoLevel = captain.exp % BALANCE.CAPTAIN_EXP_PER_LEVEL;
  const expPct = Math.round((expIntoLevel / BALANCE.CAPTAIN_EXP_PER_LEVEL) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="panel flex max-h-[85vh] w-full max-w-lg flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foam">提督狀態</h3>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-xl font-bold text-gold">{captain.title}</p>
          <p className="text-sm text-slate-400">等級 {captain.level}</p>
          <div className="mt-1 h-2 w-full rounded bg-black/30">
            <div className="h-2 rounded bg-emerald-500" style={{ width: `${expPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {expIntoLevel} / {BALANCE.CAPTAIN_EXP_PER_LEVEL} 經驗至下一級
          </p>
        </div>

        <ul className="space-y-2 text-sm">
          {STAT_LABELS.map(({ key, label, effect }) => (
            <li key={key} className="rounded-md border border-foam/20 p-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">{label}</span>
                <span className="font-mono text-gold">{captain.stats[key]}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{effect}</p>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs text-slate-500">
          航行抵港、完成交易、海戰獲勝、登錄發現物都能累積經驗；升級時五維各 +1。
        </p>
      </div>
    </div>
  );
}
