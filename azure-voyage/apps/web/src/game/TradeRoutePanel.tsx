"use client";

import { useEffect, useState } from "react";
import { commodityById, type TradeRouteSuggestion } from "@azure-voyage/shared";
import { api, ApiError } from "@/lib/api";

interface Props {
  worldId: string;
  portId: string;
  onSetRoute: (targetPortId: string) => void | Promise<void>;
}

/** 貿易路線建議（docs/01 §4.2；M24）：目前港口買、去哪賣最划算，按獲利/距離排序。 */
export function TradeRoutePanel({ worldId, portId, onSetRoute }: Props) {
  const [suggestions, setSuggestions] = useState<TradeRouteSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSuggestions(null);
    api
      .getTradeRoutes(worldId, portId)
      .then(setSuggestions)
      .catch((err) => setError(err instanceof ApiError ? err.message : "載入貿易路線建議失敗"));
  }, [worldId, portId]);

  async function goTo(targetPortId: string) {
    setBusy(true);
    setError(null);
    try {
      await onSetRoute(targetPortId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "設定航線失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-foam">貿易路線建議</h3>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!suggestions && !error && <p className="text-sm text-slate-400">計算中…</p>}
      {suggestions && suggestions.length === 0 && (
        <p className="text-sm text-slate-400">目前沒有明顯有利可圖的路線。</p>
      )}
      {suggestions && suggestions.length > 0 && (
        <ul className="space-y-2">
          {suggestions.map((s, i) => (
            <li
              key={`${s.commodityId}-${s.sellPortId}-${i}`}
              className="flex items-center justify-between rounded-md border border-foam/20 p-2 text-sm"
            >
              <span>
                {commodityById(s.commodityId).name}：本港買 {s.buyPrice}，運至{" "}
                <span className="text-foam">{s.sellPortName}</span> 賣 {s.sellPrice}
                （單位獲利 <span className="text-gold">+{s.profitPerUnit}</span>・距離 {s.distance} 格）
              </span>
              <button className="btn-ghost" disabled={busy} onClick={() => goTo(s.sellPortId)}>
                前往
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
