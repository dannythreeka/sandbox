"use client";

import { useEffect, useState } from "react";
import { commodityById } from "@azure-voyage/shared";
import { api, ApiError } from "@/lib/api";
import { GameArt } from "./GameArt";

/** 商品分類的 emoji fallback（缺圖示時），對應 commodities.ts 的 COMMODITY_CATEGORIES。 */
const CATEGORY_FALLBACK_EMOJI: Record<string, string> = {
  FOOD: "🐟",
  DRINK: "🍷",
  TEXTILE: "🧵",
  ORE: "⛏️",
  WEAPONRY: "⚔️",
  CRAFT: "🏺",
  LUXURY: "💎",
  SPICE: "🌶️",
};

interface TradePanelProps {
  worldId: string;
  portId: string;
  fleetId: string;
  shipId: string;
  onTraded: () => void;
}

/** 港內交易面板（docs/07 §4「交易」流程；M3 簡化：單商品單筆送出，不做購物車批次）。 */
export function TradePanel({ worldId, portId, fleetId, shipId, onTraded }: TradePanelProps) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.getPort>> | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setDetail(await api.getPort(worldId, portId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "載入市場失敗");
    }
  }

  useEffect(() => {
    void reload();
    // reload 每次 render 都重建，故意不放進 deps，只在 world/port 變更時重抓
  }, [worldId, portId]);

  async function submit(commodityId: string, side: "BUY" | "SELL") {
    const quantity = quantities[commodityId] || 0;
    if (quantity <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.trade(worldId, portId, {
        fleetId,
        shipId,
        orders: [{ commodityId, side, quantity }],
      });
      await reload();
      onTraded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "交易失敗");
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return <p className="text-slate-400">載入市場中…</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foam">{detail.name} 市場</h3>
        <span className="text-sm text-slate-400">
          我方影響力 {detail.playerShare.toFixed(1)}%
        </span>
      </div>
      <p className="text-xs italic text-slate-500">{detail.description}</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="pb-2">商品</th>
              <th className="pb-2">庫存</th>
              <th className="pb-2">買價</th>
              <th className="pb-2">賣價</th>
              <th className="pb-2">數量</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {detail.market.map((m) => {
              const commodity = commodityById(m.commodityId);
              return (
              <tr key={m.commodityId} className="border-t border-foam/10">
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <GameArt
                      category="goods"
                      id={commodity.category.toLowerCase()}
                      alt={commodity.category}
                      className="h-6 w-6 shrink-0 rounded object-cover"
                      fallback={<span className="text-base">{CATEGORY_FALLBACK_EMOJI[commodity.category]}</span>}
                    />
                    {commodity.name}
                  </span>
                </td>
                <td className="py-2 font-mono">{m.stock}</td>
                <td className="py-2 font-mono text-emerald-300">{m.buyPrice}</td>
                <td className="py-2 font-mono text-amber-300">{m.sellPrice}</td>
                <td className="py-2">
                  <input
                    type="number"
                    min={0}
                    className="input w-20 py-1"
                    value={quantities[m.commodityId] ?? ""}
                    onChange={(e) =>
                      setQuantities((q) => ({ ...q, [m.commodityId]: Number(e.target.value) }))
                    }
                  />
                </td>
                <td className="flex gap-2 py-2">
                  <button className="btn-ghost" disabled={busy} onClick={() => submit(m.commodityId, "BUY")}>
                    買入
                  </button>
                  <button className="btn-ghost" disabled={busy} onClick={() => submit(m.commodityId, "SELL")}>
                    賣出
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
