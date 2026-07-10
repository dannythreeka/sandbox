"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { GameArt } from "./GameArt";

interface Props {
  worldId: string;
  fleetId: string;
  activity: string;
  onChanged: () => void;
}

/** 下錨／收錨與探索控制（docs/01 §4.6；M6 簡化 UI）。 */
export function ExplorationPanel({ worldId, fleetId, activity, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** 事件插圖（M17；docs/11 §2 H）：下錨＝anchor，探索成功＝discovery */
  const [messageKind, setMessageKind] = useState<"anchor" | "discovery" | null>(null);

  async function toggleAnchor() {
    setBusy(true);
    setMessage(null);
    setMessageKind(null);
    try {
      await api.anchor(worldId, fleetId);
      if (activity !== "ANCHORED") {
        setMessage("已下錨，可以開始探索周邊海域。");
        setMessageKind("anchor");
      }
      onChanged();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "操作失敗");
    } finally {
      setBusy(false);
    }
  }

  async function explore() {
    setBusy(true);
    setMessage(null);
    setMessageKind(null);
    try {
      const result = await api.explore(worldId, fleetId);
      setMessage(result.narrative);
      if (result.success) setMessageKind("discovery");
      onChanged();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "探索失敗");
    } finally {
      setBusy(false);
    }
  }

  if (activity !== "SAILING" && activity !== "ANCHORED") return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-ghost" disabled={busy} onClick={toggleAnchor}>
        {activity === "ANCHORED" ? "收錨繼續航行" : "下錨"}
      </button>
      {activity === "ANCHORED" && (
        <button className="btn" disabled={busy} onClick={explore}>
          探索周邊海域
        </button>
      )}
      {message && (
        <span className="flex items-center gap-2 text-sm text-amber-300">
          {messageKind && (
            <GameArt
              category="event"
              id={messageKind}
              alt=""
              className="h-8 w-8 shrink-0 rounded border border-gold/40 object-cover"
              fallback={<></>}
            />
          )}
          {message}
        </span>
      )}
    </div>
  );
}
