"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  WS_EVENTS,
  type ServerJoinedPayload,
  type ServerResyncPayload,
  type WorldSnapshot,
} from "@azure-voyage/shared";
import { api, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { createGameSocket } from "@/lib/socket";

type WsState = "connecting" | "joined" | "disconnected";

/**
 * M0 的遊戲頁：載入世界快照 + 建立 WS 房間連線並顯示連線狀態。
 * M2 起這裡換成 GameRoot（PixiJS 海圖場景，見 docs/07）。
 */
export default function PlayPage() {
  const params = useParams<{ worldId: string }>();
  const router = useRouter();
  const worldId = params.worldId;

  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  const [wsState, setWsState] = useState<WsState>("connecting");
  const [tick, setTick] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const tickRef = useRef<number>(0);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }

    api
      .getWorld(worldId)
      .then(setSnapshot)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "載入世界失敗");
      });

    const socket = createGameSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit(WS_EVENTS.CLIENT_JOIN, { worldId });
    });
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
    socket.on(WS_EVENTS.SERVER_ERROR, (err: { message: string }) => {
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

  const world = snapshot?.world;

  return (
    <main className="space-y-6">
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
          {wsState === "joined"
            ? "已連線至世界頻道"
            : wsState === "connecting"
              ? "連線中…"
              : "已斷線，重連中…"}
        </span>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {world && snapshot ? (
        <>
          <section className="panel space-y-2">
            <h1 className="text-2xl font-bold text-foam">{world.name}</h1>
            <p className="text-slate-300">
              航行第 <span className="font-mono text-gold">{tick ?? world.currentTick}</span> 日
              · 難度 {world.difficulty} · 世界種子 <span className="font-mono">{world.seed}</span>
            </p>
            <p className="text-slate-300">
              {snapshot.playerGuild.name} · 資金{" "}
              <span className="font-mono text-gold">
                {snapshot.playerGuild.gold.toLocaleString("zh-TW")}
              </span>{" "}
              金 · 聲望 {snapshot.playerGuild.fame}
            </p>
            <p className="text-sm text-slate-500">
              內容版本 {world.contentVersion} · 已知港口 {snapshot.knownPorts.length} · 對手商會{" "}
              {snapshot.npcGuilds.map((g) => g.name).join("、")}
            </p>
          </section>

          {snapshot.fleets.map((fleet) => {
            const home = snapshot.knownPorts.find((p) => p.portId === fleet.dockedPortId);
            return (
              <section key={fleet.id} className="panel space-y-3">
                <h2 className="text-xl font-semibold text-foam">
                  {fleet.name}
                  <span className="ml-2 text-sm font-normal text-slate-400">
                    {fleet.activity === "DOCKED" && home
                      ? `停靠於 ${home.name}`
                      : fleet.activity}
                    · 糧 {fleet.food} · 水 {fleet.water} · 士氣 {fleet.morale}
                  </span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {fleet.ships.map((ship) => (
                    <div key={ship.id} className="rounded-md border border-foam/20 p-3">
                      <p className="font-medium">
                        {ship.isFlagship ? "⚓ " : ""}
                        {ship.name}
                      </p>
                      <p className="text-sm text-slate-400">
                        耐久 {ship.hull} · 帆 {ship.sails}% · 船員 {ship.crew}
                      </p>
                    </div>
                  ))}
                  {fleet.officers.map((officer) => (
                    <div key={officer.id} className="rounded-md border border-foam/20 p-3">
                      <p className="font-medium">{officer.name}</p>
                      <p className="text-sm text-slate-400">
                        統率 {officer.stats.lead} · 航海 {officer.stats.nav} · 戰鬥{" "}
                        {officer.stats.combat} · 商才 {officer.stats.trade} · 學識{" "}
                        {officer.stats.lore}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">海圖航行將在 M2 里程碑開放。</p>
              </section>
            );
          })}
        </>
      ) : (
        !error && <p className="text-slate-400">載入世界中…</p>
      )}
    </main>
  );
}
