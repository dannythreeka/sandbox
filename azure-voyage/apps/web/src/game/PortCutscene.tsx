"use client";

import { useEffect } from "react";
import { generatePortSilhouette, portById } from "@azure-voyage/shared";

export interface CutsceneState {
  kind: "depart" | "arrival" | "defeat";
  portId: string;
  day: number;
  /** 僅入港過場帶：自出港以來的統計，前端自行累計，不需後端改動 */
  summary?: { days: number; food: number; water: number; events: number };
  /** 僅戰敗過場帶：被拖回母港時扣的贖金（bug 修復：讓戰敗有明確、不易錯過的回饋，
   * 不再只靠一閃即逝的通知，玩家才不會誤以為「無緣無故被傳回起始城市」） */
  ransom?: number;
}

interface PortCutsceneProps {
  state: CutsceneState;
  onDone: () => void;
  onSkipForever: () => void;
}

const DEPART_MS = 2500;
const ARRIVAL_MS = 2000;
const DEFEAT_MS = 3500;

/**
 * 港口進出過場（docs/10 §M13）：純 React overlay + CSS 動畫，零美術資產。
 * 港口剪影用 shared 的確定性生成器，同一港永遠長一樣、彼此不同。
 * 純前端狀態機，後端無感知；逾時自動收尾，斷線重連落在過場中也不會卡死。
 */
export function PortCutscene({ state, onDone, onSkipForever }: PortCutsceneProps) {
  const port = portById(state.portId);
  const silhouette = generatePortSilhouette(state.portId, port.size);
  const duration = state.kind === "depart" ? DEPART_MS : state.kind === "defeat" ? DEFEAT_MS : ARRIVAL_MS;

  useEffect(() => {
    const timer = setTimeout(onDone, duration);
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
    // duration/onDone 隨 state 變動才需要重掛：同一過場實例中途不應該被重置計時器
  }, [state.kind, state.portId, state.day]);

  return (
    <div className="cutscene-overlay fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-abyss via-wave to-abyss">
      <button className="btn-ghost absolute right-4 top-4 text-sm" onClick={onDone}>
        跳過（ESC）
      </button>

      <div className="pointer-events-none absolute inset-x-0 top-12 h-10">
        <span className="cutscene-gull absolute text-lg text-foam/60">⌃</span>
        <span
          className="cutscene-gull absolute top-3 text-base text-foam/40"
          style={{ animationDelay: "1.1s" }}
        >
          ⌃
        </span>
      </div>

      <svg
        viewBox={`0 0 ${silhouette.totalWidth} 60`}
        className="h-40 w-full max-w-3xl opacity-90"
        preserveAspectRatio="xMidYMax meet"
      >
        <rect x={0} y={54} width={silhouette.dockWidth} height={6} fill="#3a2716" />
        {silhouette.buildings.map((b, i) => (
          <g key={i} fill="#12283f" stroke="#08111f" strokeWidth={0.5}>
            <rect x={b.x} y={54 - b.height} width={b.width} height={b.height} />
            {b.roofPeak > 0 && (
              <polygon
                points={`${b.x},${54 - b.height} ${b.x + b.width / 2},${54 - b.height - b.roofPeak} ${b.x + b.width},${54 - b.height}`}
              />
            )}
          </g>
        ))}
      </svg>

      <svg
        viewBox="0 0 24 10"
        className={"h-10 w-24 " + (state.kind === "depart" ? "cutscene-ship-depart" : "cutscene-ship-arrive")}
      >
        <polygon
          points="1,5 9,2.4 21,5 9,7.6"
          fill={state.kind === "defeat" ? "#4a2a2a" : "#7a5230"}
          stroke="#3a2716"
          strokeWidth={0.4}
        />
      </svg>

      <div className="mt-6 text-center">
        <h2 className={"text-2xl font-bold " + (state.kind === "defeat" ? "text-red-400" : "text-gold")}>
          {port.name}
        </h2>
        <p className="mt-1 text-slate-300">
          第 {state.day} 日{" "}
          {state.kind === "depart" ? "啟航" : state.kind === "defeat" ? "戰敗，艦隊被拖回母港療傷" : "抵達"}
        </p>
        {state.kind === "arrival" && state.summary && (
          <p className="mt-2 text-sm text-slate-400">
            航行 {state.summary.days} 天 · 消耗糧 {state.summary.food}／水 {state.summary.water}
            {state.summary.events > 0 ? ` · 途中發生 ${state.summary.events} 起事件` : ""}
          </p>
        )}
        {state.kind === "defeat" && (
          <p className="mt-2 text-sm text-slate-400">
            {state.ransom !== undefined && state.ransom > 0
              ? `商會支付了 ${state.ransom.toLocaleString()} 金幣贖金，船隻已就地搶修完畢`
              : "船隻已就地搶修完畢"}
          </p>
        )}
      </div>

      <label className="mt-6 flex items-center gap-2 text-xs text-slate-500">
        <input
          type="checkbox"
          className="accent-gold"
          onChange={(e) => {
            if (e.target.checked) onSkipForever();
          }}
        />
        不再顯示這個動畫
      </label>
    </div>
  );
}
