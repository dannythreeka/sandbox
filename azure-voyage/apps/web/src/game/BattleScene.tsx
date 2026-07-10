"use client";

import { useState } from "react";
import type { Socket } from "socket.io-client";
import { WS_EVENTS, type BattleActionInput, type BattleStateView, type WeatherKind } from "@azure-voyage/shared";
import { GameArt } from "./GameArt";

interface Props {
  socket: Socket;
  battleId: string;
  state: BattleStateView;
  log: string[];
  /** 交戰當下的天氣/時刻，決定背景（M17；docs/11 §2 G）；缺就走平靜海。 */
  weather?: WeatherKind | null;
  tick?: number;
}

/** 沒有晝夜系統，用 tick 奇偶當「夜戰」的簡單決定性判斷；風暴醞釀則優先顯示暴風海。 */
function pickBattleBg(weather?: WeatherKind | null, tick?: number): "calm" | "storm" | "night" {
  if (weather === "STORM_BREWING") return "storm";
  return (tick ?? 0) % 2 === 0 ? "calm" : "night";
}

const ACTION_LABELS: Record<BattleActionInput["type"], string> = {
  MOVE: "移動",
  FIRE: "砲擊",
  BOARD: "接舷",
  REPAIR: "搶修",
  FLEE: "逃跑",
};

/** 海戰場景（M5 簡化版：清單式棋盤，非完整 Pixi 六角board，見 docs/07 待補）。 */
export function BattleScene({ socket, battleId, state, log, weather, tick }: Props) {
  const battleBg = pickBattleBg(weather, tick);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(
    state.pendingUnitIds.find((id) => state.units.find((u) => u.id === id)?.side === "PLAYER") ?? null,
  );
  const [actionType, setActionType] = useState<BattleActionInput["type"]>("FIRE");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState({ q: 0, r: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const playerUnits = state.units.filter((u) => u.side === "PLAYER");
  const enemyUnits = state.units.filter((u) => u.side === "ENEMY");
  const actingUnit = state.units.find((u) => u.id === selectedUnitId);
  const canAct = actingUnit && state.pendingUnitIds[0] === actingUnit.id;

  function submit() {
    if (!selectedUnitId) return;
    let action: BattleActionInput;
    switch (actionType) {
      case "FIRE":
      case "BOARD":
        if (!targetId) {
          setError("請先選擇目標");
          return;
        }
        action = { type: actionType, unitId: selectedUnitId, targetId };
        break;
      case "MOVE":
        action = { type: "MOVE", unitId: selectedUnitId, to: moveTo };
        break;
      default:
        action = { type: actionType, unitId: selectedUnitId };
    }
    setBusy(true);
    setError(null);
    socket.emit(WS_EVENTS.BATTLE_ACTION, { battleId, action }, (ack: unknown) => {
      setBusy(false);
      if (ack && typeof ack === "object" && "error" in ack) {
        setError(String((ack as { error: { message: string } }).error.message));
      }
    });
  }

  function hpBar(hull: number, maxHull: number) {
    const pct = Math.max(0, Math.round((hull / maxHull) * 100));
    return (
      <div className="h-2 w-full rounded bg-black/30">
        <div
          className={pct > 40 ? "h-2 rounded bg-emerald-500" : "h-2 rounded bg-red-500"}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <GameArt
        category="battle-bg"
        id={battleBg}
        alt=""
        className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-30"
        fallback={<></>}
      />
      <div className="panel relative max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto">
        <h2 className="flex items-center gap-2 text-xl font-bold text-foam">
          <GameArt
            category="event"
            id="pirate"
            alt=""
            className="h-8 w-8 rounded border border-gold/40 object-cover"
            fallback={<span className="text-2xl">☠️</span>}
          />
          海戰進行中 · 第 {state.round} 回合，正在行動：
          {state.units.find((u) => u.id === state.pendingUnitIds[0])?.name ?? "—"}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 font-medium text-emerald-300">我方</h3>
            <ul className="space-y-2">
              {playerUnits.map((u) => (
                <li
                  key={u.id}
                  className={`cursor-pointer rounded border p-2 text-sm ${
                    selectedUnitId === u.id ? "border-gold" : "border-foam/20"
                  } ${u.destroyed || u.fled ? "opacity-40" : ""}`}
                  onClick={() => !u.destroyed && !u.fled && setSelectedUnitId(u.id)}
                >
                  <p>
                    {u.name} ({u.pos.q},{u.pos.r}) {u.fled ? "已撤離" : u.destroyed ? "已沉沒" : ""}
                  </p>
                  {hpBar(u.hull, u.maxHull)}
                  <p className="text-xs text-slate-400">船員 {u.crew}/{u.maxCrew}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 font-medium text-red-300">敵方</h3>
            <ul className="space-y-2">
              {enemyUnits.map((u) => (
                <li
                  key={u.id}
                  className={`cursor-pointer rounded border p-2 text-sm ${
                    targetId === u.id ? "border-gold" : "border-foam/20"
                  } ${u.destroyed || u.fled ? "opacity-40" : ""}`}
                  onClick={() => !u.destroyed && !u.fled && setTargetId(u.id)}
                >
                  <p>
                    {u.name} ({u.pos.q},{u.pos.r}) {u.fled ? "已撤離" : u.destroyed ? "已沉沒" : ""}
                  </p>
                  {hpBar(u.hull, u.maxHull)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(ACTION_LABELS) as BattleActionInput["type"][]).map((t) => (
            <button
              key={t}
              className={actionType === t ? "btn" : "btn-ghost"}
              onClick={() => setActionType(t)}
            >
              {ACTION_LABELS[t]}
            </button>
          ))}
          {actionType === "MOVE" && (
            <span className="flex items-center gap-1 text-sm">
              q
              <input
                type="number"
                className="input w-16 py-1"
                value={moveTo.q}
                onChange={(e) => setMoveTo((m) => ({ ...m, q: Number(e.target.value) }))}
              />
              r
              <input
                type="number"
                className="input w-16 py-1"
                value={moveTo.r}
                onChange={(e) => setMoveTo((m) => ({ ...m, r: Number(e.target.value) }))}
              />
            </span>
          )}
          <button className="btn" disabled={!canAct || busy} onClick={submit}>
            {busy ? "送出中…" : "執行"}
          </button>
        </div>
        {!canAct && (
          <p className="text-xs text-amber-300">目前不是我方可行動的單位（正在等待敵方行動或已行動過）。</p>
        )}

        <div className="max-h-32 overflow-y-auto rounded border border-foam/20 p-2 text-xs text-slate-400">
          {log.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
