"use client";

import { useEffect, useState } from "react";
import type { DiscoveryRecordView } from "@azure-voyage/shared";
import { api, ApiError } from "@/lib/api";

interface Props {
  worldId: string;
  portId: string;
  onChanged: () => void;
}

/** 學會登錄面板（docs/01 §4.6；docs/04 guild-hall）。 */
export function DiscoveryPanel({ worldId, portId, onChanged }: Props) {
  const [records, setRecords] = useState<DiscoveryRecordView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setRecords(await api.listDiscoveries(worldId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "載入發現物失敗");
    }
  }

  useEffect(() => {
    void reload();
    // reload 每次 render 都重建，故意不放進 deps
  }, [worldId]);

  async function register(recordId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.registerDiscovery(worldId, portId, recordId);
      await reload();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登錄失敗");
    } finally {
      setBusy(false);
    }
  }

  const unregistered = records?.filter((r) => !r.registered) ?? [];
  if (records !== null && unregistered.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-foam">學會分部</h3>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {unregistered.length === 0 ? (
        <p className="text-sm text-slate-400">沒有待登錄的發現物。</p>
      ) : (
        <ul className="space-y-2">
          {unregistered.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-md border border-foam/20 p-2 text-sm">
              <span>
                {r.name}（{r.rarity} 級）· 獎勵 {r.goldReward} 金 / {r.fameReward} 聲望
              </span>
              <button className="btn-ghost" disabled={busy} onClick={() => register(r.id)}>
                登錄
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
