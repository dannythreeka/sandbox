"use client";

import { useEffect, useState } from "react";
import { NPC_GUILD_TEMPLATES } from "@azure-voyage/shared";
import { api, ApiError } from "@/lib/api";
import { GameArt } from "./GameArt";

interface Props {
  worldId: string;
  portId: string;
  gold: number;
  onInvested: () => void;
}

/** 商會名稱查對 NPC 模板 key，玩家自己的商會名稱是自訂的，查不到就沒有立繪（M17）。 */
function guildArtId(guildName: string): string | null {
  const template = NPC_GUILD_TEMPLATES.find((t) => t.name === guildName);
  return template ? `guild-${template.key.replace(/^npc\./, "")}` : null;
}

/** 港口影響力投資面板（docs/01 §4.3；docs/05 §6）。 */
export function InfluencePanel({ worldId, portId, gold, onInvested }: Props) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.getPort>> | null>(null);
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setDetail(await api.getPort(worldId, portId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "載入影響力失敗");
    }
  }

  useEffect(() => {
    void reload();
    // reload 每次 render 都重建，故意不放進 deps，只在 world/port 變更時重抓
  }, [worldId, portId]);

  async function invest() {
    if (amount <= 0 || amount > gold) return;
    setBusy(true);
    setError(null);
    try {
      await api.invest(worldId, portId, amount);
      setAmount(0);
      await reload();
      onInvested();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "投資失敗");
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foam">港口影響力</h3>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <ul className="space-y-1 text-sm">
        {detail.influences.map((inf) => {
          const artId = guildArtId(inf.guildName);
          return (
            <li key={inf.guildId} className="flex items-center gap-2">
              {artId ? (
                <GameArt
                  category="portrait"
                  id={artId}
                  alt={inf.guildName}
                  className="h-8 w-7 shrink-0 rounded border border-gold/40 object-cover"
                  fallback={
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: inf.color }}
                    />
                  }
                />
              ) : (
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: inf.color }} />
              )}
              <span className="flex-1 text-slate-300">{inf.guildName}</span>
              <span className="font-mono text-gold">{inf.share.toFixed(1)}%</span>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={gold}
          className="input w-32 py-1"
          value={amount || ""}
          onChange={(e) => setAmount(Number(e.target.value))}
          placeholder="投資金額"
        />
        <button className="btn-ghost" disabled={busy || amount <= 0 || amount > gold} onClick={invest}>
          投資
        </button>
      </div>
    </div>
  );
}
