"use client";

import { useMemo, useState } from "react";
import {
  RpgEngine,
  evaluateCondition,
  type CaptainStat,
  type GamePhase,
  type PlayNode,
  type Season,
} from "@azure-voyage/rpg-engine";
import { AZURE_VOYAGE_RPG_CONTENT as content, createStartState } from "@azure-voyage/rpg-content";
import { clearSave, loadSave, persistSave } from "@/lib/save";

const STAT_LABELS: Record<CaptainStat, string> = {
  lead: "統率",
  nav: "航海",
  combat: "戰鬥",
  trade: "交易",
  lore: "見聞",
};

const PHASE_LABELS: Record<GamePhase, string> = {
  DAWN: "黎明",
  DAY: "白晝",
  DUSK: "黃昏",
  NIGHT: "夜晚",
};

const SEASON_LABELS: Record<Season, string> = {
  SPRING: "春",
  SUMMER: "夏",
  AUTUMN: "秋",
  WINTER: "冬",
};

function makeEngine(): RpgEngine {
  const saved = loadSave();
  return new RpgEngine(content, saved ?? createStartState());
}

export function GameClient() {
  const [engine, setEngine] = useState<RpgEngine>(() => makeEngine());
  const [activeNode, setActiveNode] = useState<PlayNode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showJournal, setShowJournal] = useState(false);

  // 每次互動後用一個新的 SaveState 參照觸發重繪，同時寫入 localStorage。
  const [, setVersion] = useState(0);
  function sync() {
    persistSave(engine.state);
    setVersion((v) => v + 1);
  }

  function settle(node: PlayNode) {
    setActiveNode(node.kind === "end" ? null : node);
    sync();
  }

  function handleInteract(hotspotId: string) {
    setNotice(null);
    const node = engine.interact(hotspotId);
    if (!node) {
      setNotice("這裡暫時沒有新的事情發生。");
      return;
    }
    settle(node);
  }

  function handleContinue() {
    settle(engine.continue());
  }

  function handleChoose(index: number) {
    settle(engine.choose(index));
  }

  function handleWait() {
    setNotice(null);
    engine.advanceTime(1);
    sync();
  }

  function handleTravel(sceneId: string) {
    setNotice(null);
    try {
      engine.travelTo(sceneId);
      sync();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "現在還不能去那裡。");
    }
  }

  /** 世界地圖層：切換到另一個已解鎖的港口，預設進入該港口的第一個場景。 */
  function handleEnterArea(areaId: string) {
    setNotice(null);
    const target = content.areas[areaId];
    const entryScene = target.scenes[0];
    try {
      engine.travelTo(entryScene);
      sync();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "現在還不能去那裡。");
    }
  }

  function handleNewGame() {
    if (!window.confirm("要放棄目前的存檔，重新開始一輪新旅程嗎？")) return;
    clearSave();
    const fresh = new RpgEngine(content, createStartState());
    setEngine(fresh);
    setActiveNode(null);
    setNotice(null);
    persistSave(fresh.state);
    setVersion((v) => v + 1);
  }

  const state = engine.state;
  const scene = content.scenes[state.currentSceneId];
  const sceneView = engine.getSceneView(state.currentSceneId);
  const area = content.areas[scene.areaId];
  const areaView = engine.getAreaView(area.id);
  const sceneOpen = engine.isSceneOpen(scene);

  const questSummaries = useMemo(
    () =>
      Object.values(content.quests)
        .filter((q) => evaluateCondition(q.precondition, state))
        .map((q) => ({
          quest: q,
          objectives: q.objectives.map((o) => ({
            objective: o,
            done: evaluateCondition(o.completeWhen, state),
          })),
        })),
    [state],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <header className="panel flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gold">蒼瀾航路：晨汐紀事</h1>
          <p className="text-sm text-foam/80">
            第 {state.clock.day} 日・{PHASE_LABELS[state.clock.phase]}・{SEASON_LABELS[state.clock.season]}季
          </p>
        </div>
        <div className="flex gap-3 text-xs text-foam/80">
          {Object.entries(STAT_LABELS).map(([stat, label]) => (
            <span key={stat}>
              {label} {state.captainStats[stat as CaptainStat]}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setShowJournal((v) => !v)}>
            {showJournal ? "關閉日誌" : "航海日誌"}
          </button>
          <button className="btn-ghost" onClick={handleNewGame}>
            重新開始
          </button>
        </div>
      </header>

      {showJournal && (
        <section className="panel space-y-3">
          <h2 className="font-semibold text-foam">航海日誌</h2>
          {questSummaries.length === 0 && <p className="text-sm text-foam/60">目前沒有進行中的任務。</p>}
          {questSummaries.map(({ quest, objectives }) => (
            <div key={quest.id} className="space-y-1 border-t border-foam/10 pt-2 first:border-none first:pt-0">
              <p className="text-sm font-medium text-gold">
                [{quest.kind === "MAIN" ? "主線" : quest.kind === "SIDE" ? "支線" : quest.kind}] {quest.title}
              </p>
              {objectives.map(({ objective, done }) => (
                <p key={objective.id} className={`text-xs ${done ? "text-foam/50 line-through" : "text-foam/90"}`}>
                  {done ? "✓" : "□"} {objective.description}
                </p>
              ))}
            </div>
          ))}
        </section>
      )}

      {state.unlocked.areas.length > 1 && (
        <nav className="panel flex flex-wrap gap-2">
          <span className="text-xs text-foam/60">世界地圖・{content.regions[area.regionId].name}：</span>
          {state.unlocked.areas.map((areaId) => {
            const a = content.areas[areaId];
            return (
              <button
                key={a.id}
                className={a.id === area.id ? "btn" : "btn-ghost"}
                disabled={a.id === area.id}
                onClick={() => handleEnterArea(a.id)}
              >
                {a.name}
              </button>
            );
          })}
        </nav>
      )}

      <nav className="panel flex flex-wrap gap-2">
        <span className="text-xs text-foam/60">{area.name}：</span>
        {areaView.scenes.map(({ scene: s, open }) => (
          <button
            key={s.id}
            className={s.id === scene.id ? "btn" : "btn-ghost"}
            disabled={!open || s.id === scene.id}
            onClick={() => handleTravel(s.id)}
            title={open ? undefined : "現在沒有開放"}
          >
            {s.name}
            {!open && "（休息中）"}
          </button>
        ))}
      </nav>

      <section className="panel space-y-3">
        <h2 className="text-base font-semibold text-foam">{scene.name}</h2>
        {!sceneOpen && (
          <p className="text-sm text-foam/60">
            現在不是這裡開放的時段，先在附近等等吧。
            <button className="btn-ghost ml-2" onClick={handleWait}>
              等待一段時間
            </button>
          </p>
        )}
        {sceneOpen && (
          <div className="flex flex-wrap gap-2">
            {sceneView.hotspots.map((h) => (
              <button key={h.id} className="btn-ghost" onClick={() => handleInteract(h.id)} disabled={!!activeNode}>
                {h.label}
              </button>
            ))}
            <button className="btn-ghost" onClick={handleWait} disabled={!!activeNode}>
              等待一段時間
            </button>
          </div>
        )}
        {notice && <p className="text-sm text-foam/60">{notice}</p>}
      </section>

      {activeNode && (
        <section className="panel space-y-3 border-gold/40">
          {activeNode.kind === "dialogue" && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gold">{activeNode.speaker}</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foam/90">{activeNode.text}</p>
              <button className="btn" onClick={handleContinue}>
                繼續
              </button>
            </div>
          )}
          {activeNode.kind === "checkResult" && (
            <div className="space-y-3">
              <p className="text-sm text-foam/80">
                {STAT_LABELS[activeNode.stat]}判定（門檻 {activeNode.difficulty}，你的實力 {activeNode.playerValue}）
              </p>
              <p className={`text-base font-semibold ${activeNode.success ? "text-gold" : "text-foam/70"}`}>
                {activeNode.success ? "順利過關" : "沒能如意，但故事還是往下走"}
              </p>
              <button className="btn" onClick={handleContinue}>
                繼續
              </button>
            </div>
          )}
          {activeNode.kind === "choice" && (
            <div className="space-y-3">
              <p className="text-sm text-foam/90">{activeNode.prompt}</p>
              <div className="flex flex-col gap-2">
                {activeNode.options.map((opt) => (
                  <button key={opt.index} className="btn-ghost text-left" onClick={() => handleChoose(opt.index)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
