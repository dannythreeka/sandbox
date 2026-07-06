"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  axialToOddr,
  WS_EVENTS,
  type FleetTickDelta,
  type RouteView,
  type ServerArrivalPayload,
  type ServerJoinedPayload,
  type ServerResyncPayload,
  type ServerTickPayload,
  type WorldSnapshot,
} from "@azure-voyage/shared";
import { api, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { createGameSocket } from "@/lib/socket";
import { SeaMap } from "@/game/SeaMap";
import { TradePanel } from "@/game/TradePanel";

type WsState = "connecting" | "joined" | "disconnected";

/** 航行速度檔位（毫秒／tick，docs/07 §3） */
const SPEED_PRESETS = [
  { label: "暫停", intervalMs: 0 },
  { label: "1x", intervalMs: 1500 },
  { label: "2x", intervalMs: 750 },
  { label: "4x", intervalMs: 300 },
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
  const socketRef = useRef<Socket | null>(null);
  const tickRef = useRef<number>(0);
  const inFlightRef = useRef(false);

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
      const mine = payload.fleets[0]; // M2：玩家僅一支艦隊
      if (mine) {
        setFleetDelta(mine);
        if (mine.activity === "DOCKED") setRoute(null);
      }
    });
    socket.on(WS_EVENTS.SERVER_ARRIVAL, (payload: ServerArrivalPayload) => {
      setNotice(`艦隊已抵達 ${payload.portId}`);
      api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
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

  // ── 節奏器：SAILING 時依速度檔每隔 N ms 送出 client:advance ──
  useEffect(() => {
    const intervalMs = SPEED_PRESETS[speedIdx].intervalMs;
    if (activity !== "SAILING" || intervalMs === 0) return;
    const timer = setInterval(() => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      socketRef.current?.emit(WS_EVENTS.CLIENT_ADVANCE, { worldId, ticks: 1 });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [activity, speedIdx, worldId]);

  async function handlePortClick(portId: string) {
    if (!fleet || activity === "IN_BATTLE" || activity === "EXPLORING") return;
    setError(null);
    try {
      const r = await api.setRoute(worldId, fleet.id, portId);
      setRoute(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "設定航線失敗");
    }
  }

  async function handleDepart() {
    if (!fleet) return;
    setError(null);
    try {
      await api.depart(worldId, fleet.id);
      setFleetDelta((prev) => (prev ? { ...prev, activity: "SAILING", dockedPortId: null } : prev));
      setNotice(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "出港失敗");
    }
  }

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
            <div className="flex gap-4 text-sm text-slate-300">
              <span>糧 {food}</span>
              <span>水 {water}</span>
              <span>士氣 {morale}</span>
            </div>
          </section>

          <SeaMap
            fleetPos={fleetOffsetPos}
            routeWaypoints={route?.waypoints ?? null}
            visitedPortIds={visitedPortIds}
            onPortClick={handlePortClick}
          />

          <section className="panel flex flex-wrap items-center gap-4">
            {activity === "DOCKED" && currentPort && (
              <>
                <p className="text-slate-200">
                  停靠於 <span className="font-medium text-gold">{currentPort.name}</span>
                  ——點擊海圖上的港口標記設定航線。
                </p>
                {route && (
                  <button className="btn" onClick={handleDepart}>
                    出港（前往 {route.targetPortId}）
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
                {route?.targetPortId && (
                  <span className="text-sm text-slate-400">航向 {route.targetPortId}</span>
                )}
              </div>
            )}
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
        </>
      ) : (
        !error && <p className="text-slate-400">載入世界中…</p>
      )}
    </main>
  );
}
