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

      {/* 海鷗（SVG 路徑，比 ⌃ 符號更接近真實海鷗剪影） */}
      <div className="pointer-events-none absolute inset-x-0 top-12 h-10">
        <svg
          viewBox="0 0 32 12"
          className="cutscene-gull absolute h-5 w-8 fill-foam/60"
          aria-hidden="true"
        >
          <path d="M16,6 Q10,2 0,4 Q8,4 16,6 Q24,4 32,4 Q22,2 16,6Z" />
        </svg>
        <svg
          viewBox="0 0 32 12"
          className="cutscene-gull absolute top-4 h-4 w-6 fill-foam/35"
          aria-hidden="true"
          style={{ animationDelay: "1.1s" }}
        >
          <path d="M16,6 Q10,2 0,4 Q8,4 16,6 Q24,4 32,4 Q22,2 16,6Z" />
        </svg>
        <svg
          viewBox="0 0 32 12"
          className="cutscene-gull absolute top-1 h-3 w-5 fill-foam/25"
          aria-hidden="true"
          style={{ animationDelay: "2.3s", animationDuration: "4.8s" }}
        >
          <path d="M16,6 Q10,2 0,4 Q8,4 16,6 Q24,4 32,4 Q22,2 16,6Z" />
        </svg>
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

      {/* 動態海浪層：雙份路徑寬度以實現無縫循環；<use> 複用同一段波形避免重複 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 overflow-hidden opacity-50">
        <svg
          viewBox="0 0 1200 48"
          className="cutscene-wave absolute bottom-0 h-full"
          style={{ width: "200%" }}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <path
              id="wave-primary"
              d="M0,24 C100,8 200,40 300,24 C400,8 500,40 600,24 C700,8 800,40 900,24 C1000,8 1100,40 1200,24 L1200,48 L0,48Z"
            />
            <path
              id="wave-secondary"
              d="M0,28 C100,12 200,44 300,28 C400,12 500,44 600,28 L600,48 L0,48Z"
            />
          </defs>
          <use href="#wave-primary" fill="#12283f" opacity="0.8" />
          <use href="#wave-secondary" fill="#0b1526" opacity="0.6" />
          {/* 鏡像段以形成無縫循環，偏移 1200px */}
          <use href="#wave-primary" fill="#12283f" opacity="0.8" transform="translate(1200,0)" />
          <use href="#wave-secondary" fill="#0b1526" opacity="0.6" transform="translate(1200,0)" />
        </svg>
      </div>

      <svg
        viewBox="0 0 24 10"
        className={
          "h-10 w-24 " +
          (state.kind === "depart"
            ? "cutscene-ship-depart"
            : state.kind === "defeat"
              ? "cutscene-ship-idle"
              : "cutscene-ship-arrive")
        }
      >
        {/* 船帆 */}
        <polygon
          points="11,5 11,1 15,5"
          fill={state.kind === "defeat" ? "#3a1a1a" : "#9fc3e0"}
          opacity="0.8"
        />
        {/* 船體 */}
        <polygon
          points="1,5 9,2.4 21,5 9,7.6"
          fill={state.kind === "defeat" ? "#4a2a2a" : "#7a5230"}
          stroke="#3a2716"
          strokeWidth={0.4}
        />
        {/* 桅杆 */}
        <line x1="11" y1="5" x2="11" y2="1" stroke="#3a2716" strokeWidth="0.5" />
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
