"use client";

import { commodityById, shipClassById, type FleetView } from "@azure-voyage/shared";

interface Props {
  fleet: FleetView;
}

/**
 * 艦隊總覽（玩家回饋：到新港口交易前不知道自己貨艙裡有什麼，得逐項嘗試）。
 * 跨船彙總貨艙、列出每艘船耐久/貨艙用量、航海士摘要，交易前先看一眼即可。
 */
export function FleetOverviewPanel({ fleet }: Props) {
  const cargoTotals = new Map<string, { quantity: number; totalCost: number }>();
  for (const ship of fleet.ships) {
    for (const c of ship.cargo) {
      const prev = cargoTotals.get(c.commodityId) ?? { quantity: 0, totalCost: 0 };
      cargoTotals.set(c.commodityId, {
        quantity: prev.quantity + c.quantity,
        totalCost: prev.totalCost + c.quantity * c.avgBuyPrice,
      });
    }
  }
  const cargoRows = [...cargoTotals.entries()]
    .map(([commodityId, t]) => ({
      commodityId,
      name: commodityById(commodityId).name,
      quantity: t.quantity,
      avgBuyPrice: Math.round(t.totalCost / t.quantity),
    }))
    .sort((a, b) => b.quantity - a.quantity);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foam">艦隊總覽</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-1 text-sm font-medium text-slate-300">貨艙（跨船彙總）</h4>
          {cargoRows.length === 0 ? (
            <p className="text-sm text-slate-500">貨艙是空的。</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {cargoRows.map((r) => (
                <li key={r.commodityId} className="flex justify-between">
                  <span className="text-slate-300">{r.name}</span>
                  <span className="font-mono">
                    <span className="text-gold">{r.quantity}</span>
                    <span className="text-slate-500"> · 均價 {r.avgBuyPrice}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="mb-1 text-sm font-medium text-slate-300">船隻</h4>
          <ul className="space-y-1 text-sm">
            {fleet.ships.map((s) => {
              const cls = shipClassById(s.shipClassId);
              const cargoUsed = s.cargo.reduce((sum, c) => sum + c.quantity, 0);
              return (
                <li key={s.id} className="flex justify-between text-slate-300">
                  <span>
                    {s.isFlagship ? "⚓ " : ""}
                    {s.name}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    耐久 {s.hull}/{cls.maxHull} · 船員 {s.crew} · 貨 {cargoUsed}/{cls.cargoCapacity}
                  </span>
                </li>
              );
            })}
          </ul>
          <h4 className="mb-1 mt-3 text-sm font-medium text-slate-300">航海士</h4>
          {fleet.officers.length === 0 ? (
            <p className="text-sm text-slate-500">目前沒有隨行航海士。</p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-300">
              {fleet.officers.map((o) => (
                <li key={o.id} className="flex justify-between">
                  <span>{o.name}</span>
                  <span className="text-xs text-slate-400">{o.role ?? "未指派"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
