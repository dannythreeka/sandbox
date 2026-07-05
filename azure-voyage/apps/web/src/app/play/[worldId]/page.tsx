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

      {world ? (
        <section className="panel space-y-2">
          <h1 className="text-2xl font-bold text-foam">{world.name}</h1>
          <p className="text-slate-300">
            航行第 <span className="font-mono text-gold">{tick ?? world.currentTick}</span> 日 ·
            難度 {world.difficulty} · 世界種子 <span className="font-mono">{world.seed}</span>
          </p>
          <p className="text-sm text-slate-500">
            內容版本 {world.contentVersion} —— 海圖與艦隊將在 M2 里程碑登場。
          </p>
        </section>
      ) : (
        !error && <p className="text-slate-400">載入世界中…</p>
      )}
    </main>
  );
}
