"use client";

import { useEffect, useState } from "react";
import type { DiscoveryCodexEntry } from "@azure-voyage/shared";
import { api, ApiError } from "@/lib/api";

interface Props {
  worldId: string;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  GEOGRAPHY: "地理",
  BIOLOGY: "生物",
  RELIC: "遺跡",
  CELESTIAL: "天象",
};

const RARITY_LABELS: Record<string, string> = { C: "C 級", B: "B 級", A: "A 級", S: "S 級（傳世遺物）" };

/** 發現物圖鑑（docs/01 §4.6；M22）。未找到的項目以剪影呈現，不洩漏名稱與獎勵。 */
export function DiscoveryCodexPanel({ worldId, onClose }: Props) {
  const [entries, setEntries] = useState<DiscoveryCodexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .discoveryCodex(worldId)
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : "載入圖鑑失敗"));
  }, [worldId]);

  const foundCount = entries?.filter((e) => e.found).length ?? 0;
  const total = entries?.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="panel flex max-h-[85vh] w-full max-w-2xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foam">
            發現物圖鑑 {entries && <span className="text-sm text-slate-400">（{foundCount}/{total}）</span>}
          </h3>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>
            ✕
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!entries && !error && <p className="text-sm text-slate-400">載入中…</p>}
        {entries && (
          <ul className="flex-1 space-y-2 overflow-y-auto pr-1 text-sm">
            {entries.map((e) => (
              <li
                key={e.discoveryId}
                className={`rounded-md border p-2 ${
                  e.found ? "border-foam/20" : "border-slate-700/60 text-slate-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{e.found ? e.name : "？？？"}</span>
                  <span className="text-xs text-slate-400">
                    {CATEGORY_LABELS[e.category] ?? e.category} · {RARITY_LABELS[e.rarity] ?? e.rarity}
                  </span>
                </div>
                {e.found ? (
                  <>
                    <p className="mt-1 text-slate-300">{e.description}</p>
                    {e.narrative && <p className="mt-1 italic text-gold/80">「{e.narrative}」</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      {e.registered ? "已登錄" : "已發現，尚未登錄學會"} · 獎勵 {e.goldReward} 金 / {e.fameReward} 聲望
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-slate-600">尚未發現——駕船前往外洋，讓學識淵博的航海士探索看看吧。</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
