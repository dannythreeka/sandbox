"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";

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

  async function toggleAnchor() {
    setBusy(true);
    setMessage(null);
    try {
      await api.anchor(worldId, fleetId);
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
    try {
      const result = await api.explore(worldId, fleetId);
      setMessage(result.narrative);
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
      {message && <span className="text-sm text-amber-300">{message}</span>}
    </div>
  );
}
