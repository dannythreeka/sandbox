"use client";

import { useEffect } from "react";
import type { ServerQuestChapterPayload } from "@azure-voyage/shared";

interface Props {
  payload: ServerQuestChapterPayload;
  onDone: () => void;
}

const QUEST_CUTSCENE_MS = 5000;

/**
 * 主線任務章節完成過場（M28）：純 React overlay，跟 PortCutscene 同一套視覺語言，
 * 但不綁定特定港口——顯示章節標題、原創過場敘事與獎勵，逾時自動收尾。
 */
export function QuestChapterCutscene({ payload, onDone }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, QUEST_CUTSCENE_MS);
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onDone();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
    // chapterId 變動才需要重掛：同一過場實例中途不應該被重置計時器
  }, [payload.chapterId, onDone]);

  return (
    <div className="cutscene-overlay fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-abyss via-wave to-abyss p-8">
      <button className="btn-ghost absolute right-4 top-4 text-sm" onClick={onDone}>
        跳過（ESC）
      </button>

      <p className="quest-kicker text-sm uppercase tracking-widest text-gold/70">
        主線任務完成
      </p>

      {/* 黃金分隔線，完成後由中心向外展開 */}
      <div className="quest-rule my-3 h-px w-48 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

      <h2 className="quest-title mt-1 text-3xl font-bold text-gold">{payload.title}</h2>

      <p className="quest-text mt-6 max-w-xl text-center leading-relaxed text-slate-200">{payload.narrative}</p>

      {(payload.goldReward > 0 || payload.fameReward > 0) && (
        <p className="quest-reward mt-6 rounded-lg border border-gold/30 bg-abyss/40 px-4 py-2 text-sm text-slate-400">
          {payload.goldReward > 0 && `獲得 ${payload.goldReward.toLocaleString()} 金幣`}
          {payload.goldReward > 0 && payload.fameReward > 0 ? " · " : ""}
          {payload.fameReward > 0 && `聲望 +${payload.fameReward}`}
        </p>
      )}
    </div>
  );
}
