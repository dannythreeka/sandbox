"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DIFFICULTIES, type Difficulty, type WorldSummary } from "@azure-voyage/shared";
import { api, ApiError } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "順風（簡單）",
  NORMAL: "商人之路（普通）",
  HARD: "怒濤（困難）",
};

export default function WorldsPage() {
  const router = useRouter();
  const [worlds, setWorlds] = useState<WorldSummary[] | null>(null);
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("NORMAL");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setWorlds(await api.listWorlds());
    } catch (err) {
      if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
        router.push("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "載入失敗");
    }
  }, [router]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    void reload();
  }, [reload, router]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const world = await api.createWorld({ name, difficulty });
      setName("");
      await reload();
      router.push(`/play/${world.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setBusy(false);
    }
  }

  async function onAbandon(id: string) {
    if (!window.confirm("確定要放棄這個世界？此動作無法復原。")) return;
    try {
      await api.abandonWorld(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗");
    }
  }

  function onLogout() {
    clearTokens();
    router.push("/");
  }

  return (
    <main className="space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foam">我的航海誌</h1>
        <button className="btn-ghost" onClick={onLogout}>
          登出
        </button>
      </header>

      <section className="panel">
        <h2 className="mb-4 text-xl font-semibold text-foam">開啟新的航路</h2>
        <form className="flex flex-wrap items-end gap-4" onSubmit={onCreate}>
          <div className="min-w-48 flex-1">
            <label className="label" htmlFor="name">
              世界名稱
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder="例：初次遠航"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="difficulty">
              難度
            </label>
            <select
              id="difficulty"
              className="input"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
          <button className="btn" disabled={busy}>
            {busy ? "建立中…" : "建立世界"}
          </button>
        </form>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="space-y-3">
        {worlds === null ? (
          <p className="text-slate-400">載入中…</p>
        ) : worlds.length === 0 ? (
          <p className="text-slate-400">還沒有任何存檔——建立你的第一個世界吧。</p>
        ) : (
          worlds.map((w) => (
            <div key={w.id} className="panel flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-semibold text-slate-100">
                  {w.name}
                  <span className="ml-2 text-sm text-slate-400">
                    {DIFFICULTY_LABELS[w.difficulty]} · 第 {w.currentTick} 日 · {w.status}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  建立於 {new Date(w.createdAt).toLocaleString("zh-TW")}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/play/${w.id}`} className="btn">
                  繼續航行
                </Link>
                <button className="btn-ghost" onClick={() => onAbandon(w.id)}>
                  放棄
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
