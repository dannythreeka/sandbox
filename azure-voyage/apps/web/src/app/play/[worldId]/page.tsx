"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  axialToOddr,
  BALANCE,
  ERROR_MESSAGES_ZH_TW,
  portById,
  regionAt,
  seasonAtTick,
  windAtTick,
  WS_EVENTS,
  type Season,
  type BattleStateView,
  type FleetTickDelta,
  type OffsetCoord,
  type RouteView,
  type ServerArrivalPayload,
  type ServerBattleEndPayload,
  type ServerBattleStartPayload,
  type ServerBattleUpdatePayload,
  type ServerEventPayload,
  type ServerJoinedPayload,
  type ServerResyncPayload,
  type ServerTickPayload,
  type ServerVictoryPayload,
  type WorldSnapshot,
} from "@azure-voyage/shared";
import { api, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { createGameSocket } from "@/lib/socket";
import { SeaMap } from "@/game/SeaMap";
import { TradePanel } from "@/game/TradePanel";
import { TavernShipyardPanel } from "@/game/TavernShipyardPanel";
import { BattleScene } from "@/game/BattleScene";
import { ExplorationPanel } from "@/game/ExplorationPanel";
import { DiscoveryPanel } from "@/game/DiscoveryPanel";
import { InfluencePanel } from "@/game/InfluencePanel";

type WsState = "connecting" | "joined" | "disconnected";

/** 航行速度檔位（毫秒／tick，docs/07 §3） */
const SPEED_PRESETS = [
  { label: "暫停", intervalMs: 0 },
  { label: "1x", intervalMs: 1500 },
  { label: "2x", intervalMs: 750 },
  { label: "4x", intervalMs: 300 },
] as const;

const SEASON_LABELS: Record<Season, string> = {
  SPRING: "春",
  SUMMER: "夏",
  AUTUMN: "秋",
  WINTER: "冬",
};
/** 風向名稱（0=東，逆時針；row 向下為南） */
const WIND_NAMES = ["東", "東北", "西北", "西", "西南", "東南"] as const;
/** 夾角檔位 0–3 的標籤與顏色（順風綠、逆風紅） */
const WIND_GAP_LABELS = [
  { text: "順風", cls: "text-emerald-300" },
  { text: "側順", cls: "text-emerald-200" },
  { text: "側風", cls: "text-slate-300" },
  { text: "逆風", cls: "text-red-400" },
] as const;

export default function PlayPage() {
  const params = useParams<{ worldId: string }>();
  const router = useRouter();
  const worldId = params.worldId;

  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  const [wsState, setWsState] = useState<WsState>("connecting");
  const [tick, setTick] = useState<number | null>(null);
  const [fleetDelta, setFleetDelta] = useState<FleetTickDelta | null>(null);
  const [route, setRoute] = useState<RouteView | null>(null);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [battleId, setBattleId] = useState<string | null>(null);
  const [battleState, setBattleState] = useState<BattleStateView | null>(null);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [victory, setVictory] = useState<ServerVictoryPayload | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const tickRef = useRef<number>(0);
  const inFlightRef = useRef(false);
  // tick delta 依艦隊 id 過濾（不能拿 fleets[0]：清單只含「該 tick 有航行」的艦隊，
  // 順序與歸屬都不保證是玩家自己的）
  const playerFleetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }

    api
      .getWorld(worldId)
      .then(setSnapshot)
      .catch((err) => setError(err instanceof ApiError ? err.message : "載入世界失敗"));

    const socket = createGameSocket();
    socketRef.current = socket;

    socket.on("connect", () => socket.emit(WS_EVENTS.CLIENT_JOIN, { worldId }));
    socket.on(WS_EVENTS.SERVER_JOINED, (payload: ServerJoinedPayload) => {
      setWsState("joined");
      setTick(payload.tick);
      tickRef.current = payload.tick;
    });
    socket.on(WS_EVENTS.SERVER_RESYNC, (payload: ServerResyncPayload) => {
      setTick(payload.tick);
      tickRef.current = payload.tick;
      setSnapshot(payload.snapshot);
    });
    socket.on(WS_EVENTS.SERVER_TICK, (payload: ServerTickPayload) => {
      inFlightRef.current = false;
      setTick(payload.tick);
      tickRef.current = payload.tick;
      const mine = playerFleetIdRef.current
        ? payload.fleets.find((f) => f.id === playerFleetIdRef.current)
        : payload.fleets[0];
      if (mine) {
        setFleetDelta(mine);
        if (mine.activity === "DOCKED" || mine.activity === "ANCHORED") setRoute(null);
      }
      if (payload.notices.length > 0) setNotice(payload.notices.join(" "));
      // tick 有成功推進，「世界正在推進中」這類瞬時壅塞錯誤即已過期，自動清掉
      setError((prev) => (prev === ERROR_MESSAGES_ZH_TW.WORLD_BUSY ? null : prev));
    });
    socket.on(WS_EVENTS.SERVER_ARRIVAL, (payload: ServerArrivalPayload) => {
      if (playerFleetIdRef.current && payload.fleetId !== playerFleetIdRef.current) return;
      setNotice(`艦隊已抵達 ${portById(payload.portId).name}`);
      api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
    });
    socket.on(WS_EVENTS.SERVER_EVENT, (payload: ServerEventPayload) => {
      setNotice(payload.event.narrative);
      api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
    });
    socket.on(WS_EVENTS.SERVER_BATTLE_START, (payload: ServerBattleStartPayload) => {
      setBattleId(payload.battleId);
      setBattleState(payload.battle.state);
      setBattleLog([]);
    });
    socket.on(WS_EVENTS.BATTLE_UPDATE, (payload: ServerBattleUpdatePayload) => {
      setBattleState(payload.state);
      setBattleLog((prev) => [...prev, payload.log]);
    });
    socket.on(WS_EVENTS.BATTLE_END, (payload: ServerBattleEndPayload) => {
      setNotice(
        payload.status === "PLAYER_WIN"
          ? "戰鬥勝利！"
          : payload.status === "FLED"
            ? "成功脫離戰場。"
            : "艦隊戰敗，被拖回母港療傷……",
      );
      setBattleId(null);
      setBattleState(null);
      api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
    });
    socket.on(WS_EVENTS.SERVER_VICTORY, (payload: ServerVictoryPayload) => {
      setVictory(payload);
    });
    socket.on(WS_EVENTS.SERVER_ERROR, (err: { message: string }) => {
      inFlightRef.current = false;
      setError(err.message);
    });
    socket.on("disconnect", () => setWsState("disconnected"));
    socket.io.on("reconnect", () => {
      socket.emit(WS_EVENTS.CLIENT_RESYNC, { worldId, lastTick: tickRef.current });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [worldId, router]);

  const fleet = snapshot?.fleets[0];
  playerFleetIdRef.current = fleet?.id ?? playerFleetIdRef.current;
  const activity = fleetDelta?.activity ?? fleet?.activity;
  const pos = fleetDelta?.pos ?? fleet?.pos;
  const food = fleetDelta?.food ?? fleet?.food ?? 0;
  const water = fleetDelta?.water ?? fleet?.water ?? 0;
  const morale = fleetDelta?.morale ?? fleet?.morale ?? 0;
  const dockedPortId = fleetDelta ? fleetDelta.dockedPortId : (fleet?.dockedPortId ?? null);
  const currentPort = snapshot?.knownPorts.find((p) => p.portId === dockedPortId);
  const visitedPortIds = useMemo(
    () => new Set(snapshot?.knownPorts.filter((p) => p.visited).map((p) => p.portId) ?? []),
    [snapshot],
  );
  // 伺服器存 axial 座標；SeaMap 畫布用 offset（col,row）座標系
  const fleetOffsetPos = pos ? axialToOddr(pos) : null;
  // ── M11 風向 HUD：航行中用伺服器 delta（含對航向的修正）；停靠/下錨時
  // 前端以同一套 shared 純函式自算當日風向（world seed 確定性，兩端必一致）──
  const currentTick = tick ?? snapshot?.world.currentTick ?? 0;
  const region = fleetOffsetPos ? regionAt(fleetOffsetPos) : null;
  const windDir =
    fleetDelta?.wind?.dir ??
    (region && snapshot ? windAtTick(region.id, currentTick, snapshot.world.seed) : null);
  const windGapIdx =
    activity === "SAILING" && fleetDelta?.wind
      ? ([...BALANCE.WIND_MODIFIERS] as number[]).indexOf(fleetDelta.wind.modifier)
      : -1;
  // 重新整理頁面時若世界早已結束（例如先前已達成勝利），仍要顯示終局畫面
  const gameEnded = victory !== null || (snapshot ? snapshot.world.status !== "ACTIVE" : false);

  // ── 節奏器：SAILING 時依速度檔每隔 N ms 送出 client:advance ──
  useEffect(() => {
    const intervalMs = SPEED_PRESETS[speedIdx].intervalMs;
    if (activity !== "SAILING" || intervalMs === 0 || battleId !== null || victory !== null) return;
    const timer = setInterval(() => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      socketRef.current?.emit(WS_EVENTS.CLIENT_ADVANCE, { worldId, ticks: 1 });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [activity, speedIdx, worldId, battleId, victory]);

  /**
   * 樂觀更新艦隊活動狀態。世界剛建立、尚未收到任何 server:tick 時 fleetDelta
   * 仍是 null，必須以目前快照補滿欄位，否則更新會整個變成 no-op，
   * 玩家會卡在「已出港」但畫面仍顯示停靠中、tick 節奏器也不會啟動。
   */
  function seedFleetActivity(
    nextActivity: FleetTickDelta["activity"],
    supplies?: { food: number; water: number },
  ) {
    if (!fleet) return;
    setFleetDelta((prev) => ({
      id: fleet.id,
      pos: prev?.pos ?? fleet.pos,
      food: prev?.food ?? fleet.food,
      water: prev?.water ?? fleet.water,
      morale: prev?.morale ?? fleet.morale,
      ...prev,
      activity: nextActivity,
      dockedPortId: null,
      ...(supplies ?? {}),
    }));
  }

  /** 點擊海圖設定航向（港口或任意海面）；海上下錨中伺服器會原子地收錨續航。 */
  async function handleMapTarget(dest: { targetPortId: string } | { target: OffsetCoord }) {
    if (!fleet || gameEnded || activity === "IN_BATTLE" || activity === "EXPLORING") return;
    setError(null);
    try {
      const r = await api.setRoute(worldId, fleet.id, dest);
      setRoute(r);
      if (activity === "ANCHORED") {
        seedFleetActivity("SAILING");
        setNotice(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "設定航線失敗");
    }
  }

  async function handleDepart() {
    if (!fleet) return;
    setError(null);
    try {
      const r = await api.depart(worldId, fleet.id);
      seedFleetActivity("SAILING", {
        food: fleet.food + r.resupplied.food,
        water: fleet.water + r.resupplied.water,
      });
      setNotice(
        r.resupplied.cost > 0
          ? `出港前完成補給：糧 +${r.resupplied.food}、水 +${r.resupplied.water}，花費 ${r.resupplied.cost} 金。`
          : null,
      );
      // 更新商會資金顯示
      api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "出港失敗");
    }
  }

  /** 目的地顯示名稱：港口用中文名，自由航行顯示海域座標 */
  const destinationLabel = route
    ? route.targetPortId
      ? portById(route.targetPortId).name
      : `海域 (${route.waypoints[route.waypoints.length - 1].col}, ${route.waypoints[route.waypoints.length - 1].row})`
    : null;

  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between">
        <Link href="/worlds" className="btn-ghost">
          ← 回航海誌
        </Link>
        <span
          className={
            wsState === "joined"
              ? "rounded-full bg-emerald-500/20 px-3 py-1 text-sm text-emerald-300"
              : "rounded-full bg-amber-500/20 px-3 py-1 text-sm text-amber-300"
          }
        >
          {wsState === "joined" ? "已連線" : wsState === "connecting" ? "連線中…" : "已斷線，重連中…"}
        </span>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {notice && <p className="text-sm text-emerald-300">{notice}</p>}

      {gameEnded && (
        <section className="panel border-2 border-gold bg-gold/10 text-center">
          <h2 className="text-2xl font-bold text-gold">
            商會稱霸四海！
            {victory ? `第 ${victory.tick} 日達成勝利` : ""}
          </h2>
          {victory && (
            <p className="mt-1 text-sm text-slate-300">
              {victory.reason === "REGION_DOMINANCE" ? "海域霸權" : "累積總資產"}達成勝利條件。
            </p>
          )}
          <Link href="/worlds" className="btn mt-3 inline-block">
            回航海誌
          </Link>
        </section>
      )}

      {snapshot && fleet && fleetOffsetPos ? (
        <>
          <section className="panel flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-foam">{snapshot.world.name}</h1>
              <p className="text-sm text-slate-400">
                第 <span className="font-mono text-gold">{tick ?? snapshot.world.currentTick}</span>{" "}
                日 · {snapshot.playerGuild.name} · 資金{" "}
                <span className="font-mono text-gold">
                  {snapshot.playerGuild.gold.toLocaleString("zh-TW")}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
              {region && windDir !== null && (
                <span className="flex items-center gap-1.5">
                  <span className="text-foam">{region.name}</span>
                  <span>{SEASON_LABELS[seasonAtTick(currentTick)]}季</span>
                  <span
                    className="inline-block font-bold text-gold"
                    style={{ transform: `rotate(${-60 * windDir}deg)` }}
                    title={`風向：${WIND_NAMES[windDir]}風`}
                  >
                    →
                  </span>
                  <span>{WIND_NAMES[windDir]}風</span>
                  {windGapIdx >= 0 && (
                    <span className={WIND_GAP_LABELS[windGapIdx].cls}>
                      {WIND_GAP_LABELS[windGapIdx].text}
                    </span>
                  )}
                </span>
              )}
              <span>糧 {food}</span>
              <span>水 {water}</span>
              <span>士氣 {morale}</span>
              <span>
                霸權海域 {snapshot.victoryProgress.regionsDominated}/{BALANCE.VICTORY_REGIONS_REQUIRED}
              </span>
              <span>總資產 {snapshot.victoryProgress.totalAssets.toLocaleString("zh-TW")}</span>
            </div>
          </section>

          <SeaMap
            fleetPos={fleetOffsetPos}
            sailing={activity === "SAILING"}
            routeWaypoints={route?.waypoints ?? null}
            visitedPortIds={visitedPortIds}
            onPortClick={(portId) => void handleMapTarget({ targetPortId: portId })}
            onSeaClick={(coord) => void handleMapTarget({ target: coord })}
          />

          <section className="panel flex flex-wrap items-center gap-4">
            {activity === "DOCKED" && currentPort && (
              <>
                <p className="text-slate-200">
                  停靠於 <span className="font-medium text-gold">{currentPort.name}</span>
                  ——點擊海圖上的港口或任一海面設定航線。
                </p>
                {route && destinationLabel && (
                  <button className="btn" onClick={handleDepart}>
                    出港（前往 {destinationLabel}）
                  </button>
                )}
              </>
            )}
            {activity === "SAILING" && (
              <div className="flex items-center gap-2">
                <span className="text-slate-300">航速：</span>
                {SPEED_PRESETS.map((s, i) => (
                  <button
                    key={s.label}
                    className={i === speedIdx ? "btn" : "btn-ghost"}
                    onClick={() => setSpeedIdx(i)}
                  >
                    {s.label}
                  </button>
                ))}
                {destinationLabel && (
                  <span className="text-sm text-slate-400">航向 {destinationLabel}</span>
                )}
              </div>
            )}
            {activity === "ANCHORED" && (
              <p className="text-slate-200">
                艦隊在海上<span className="font-medium text-gold">下錨中</span>
                ——點擊海面或港口設定新航向（自動收錨啟航），或探索周邊海域。
              </p>
            )}
            <ExplorationPanel
              worldId={worldId}
              fleetId={fleet.id}
              activity={activity ?? ""}
              onChanged={() => {
                api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
              }}
            />
          </section>

          {activity === "DOCKED" && currentPort && fleet.ships[0] && (
            <section className="panel">
              <TradePanel
                worldId={worldId}
                portId={currentPort.portId}
                fleetId={fleet.id}
                shipId={fleet.ships[0].id}
                onTraded={() => {
                  api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
                }}
              />
            </section>
          )}

          {activity === "DOCKED" && currentPort && (
            <section className="panel">
              <TavernShipyardPanel
                worldId={worldId}
                portId={currentPort.portId}
                fleet={fleet}
                onChanged={() => {
                  api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
                }}
              />
            </section>
          )}

          {activity === "DOCKED" && currentPort && (
            <section className="panel">
              <DiscoveryPanel
                worldId={worldId}
                portId={currentPort.portId}
                onChanged={() => {
                  api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
                }}
              />
            </section>
          )}

          {activity === "DOCKED" && currentPort && (
            <section className="panel">
              <InfluencePanel
                worldId={worldId}
                portId={currentPort.portId}
                gold={snapshot.playerGuild.gold}
                onInvested={() => {
                  api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
                }}
              />
            </section>
          )}
        </>
      ) : (
        !error && <p className="text-slate-400">載入世界中…</p>
      )}

      {battleId && battleState && socketRef.current && (
        <BattleScene
          socket={socketRef.current}
          battleId={battleId}
          state={battleState}
          log={battleLog}
        />
      )}
    </main>
  );
}
