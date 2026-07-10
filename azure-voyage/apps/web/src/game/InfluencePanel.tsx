"use client";

import { useEffect, useState } from "react";
import { NPC_GUILD_TEMPLATES, type NpcGuildPublicView } from "@azure-voyage/shared";
import { api, ApiError } from "@/lib/api";
import { DialoguePanel } from "./DialoguePanel";
import { GameArt } from "./GameArt";

interface Props {
  worldId: string;
  portId: string;
  gold: number;
  /** M19：查找 PERSONA 補全的人設描述，用商會名稱比對；找不到就沒有 tooltip 可看。 */
  npcGuilds: NpcGuildPublicView[];
  onInvested: () => void;
}

/** 商會名稱查對 NPC 模板 key，玩家自己的商會名稱是自訂的，查不到就沒有立繪（M17）。 */
function guildArtId(guildName: string): string | null {
  const template = NPC_GUILD_TEMPLATES.find((t) => t.name === guildName);
  return template ? `guild-${template.key.replace(/^npc\./, "")}` : null;
}

/** 港口影響力投資面板（docs/01 §4.3；docs/05 §6）。 */
export function InfluencePanel({ worldId, portId, gold, npcGuilds, onInvested }: Props) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.getPort>> | null>(null);
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogueTargetId, setDialogueTargetId] = useState<string | null>(null);

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
          const matchedGuild = npcGuilds.find((g) => g.name === inf.guildName);
          const persona = matchedGuild?.persona;
          return (
            <li key={inf.guildId} className="flex items-center gap-2" title={persona?.greeting}>
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
              <span className="flex-1 text-slate-300">
                {inf.guildName}
                {persona && <span className="ml-1 text-xs text-foam/60">· {persona.description}</span>}
              </span>
              <span className="font-mono text-gold">{inf.share.toFixed(1)}%</span>
              {matchedGuild && (
                <button className="btn-ghost px-2 py-0.5 text-xs" onClick={() => setDialogueTargetId(matchedGuild.id)}>
                  對話
                </button>
              )}
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
      {dialogueTargetId && (
        <DialoguePanel
          worldId={worldId}
          targetType="GUILD"
          targetId={dialogueTargetId}
          targetName={npcGuilds.find((g) => g.id === dialogueTargetId)?.name ?? "使節"}
          onClose={() => setDialogueTargetId(null)}
        />
      )}
    </div>
  );
}
