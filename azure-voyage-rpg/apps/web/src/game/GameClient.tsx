"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  RpgEngine,
  evaluateCondition,
  type ArtCategory,
  type CaptainStat,
  type GamePhase,
  type Npc,
  type PlayNode,
  type Season,
} from "@azure-voyage-rpg/engine";
import { AZURE_VOYAGE_RPG_CONTENT as content, createStartState } from "@azure-voyage-rpg/content";
import { clearSave, loadSave, persistSave } from "@/lib/save";
import { GameArt } from "@/game/GameArt";
import { SceneStage } from "@/game/SceneStage";
import { AudioDock } from "@/game/AudioDock";
import { BattleCinematic } from "@/game/BattleCinematic";

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

interface SpeakerVisual {
  name: string;
  accentColor: string;
  background: string;
  portraitId?: string;
  portraitCategory?: ArtCategory;
}

interface TravelTransition {
  label: string;
  kind: "scene" | "area";
}

interface CastEntry {
  npc: Npc;
  visual: SpeakerVisual;
}

const SPECIAL_SPEAKERS: Record<string, SpeakerVisual> = {
  "旁白": {
    name: "旁白",
    accentColor: "#99d8e4",
    background: "linear-gradient(135deg, #10253b 0%, #1a3854 100%)",
    portraitCategory: "event",
    portraitId: "discovery",
  },
  "你": {
    name: "你",
    accentColor: "#f6cf7d",
    background: "linear-gradient(135deg, #4b2e15 0%, #1a2438 100%)",
    portraitCategory: "portrait",
    portraitId: "lyra",
  },
  "市場掮客": {
    name: "市場掮客",
    accentColor: "#f3ad54",
    background: "linear-gradient(135deg, #4a3320 0%, #172c44 100%)",
    portraitCategory: "event",
    portraitId: "festival",
  },
  公告欄: {
    name: "公告欄",
    accentColor: "#b8c7d9",
    background: "linear-gradient(135deg, #3d4b5a 0%, #1d2430 100%)",
    portraitCategory: "event",
    portraitId: "rumor",
  },
};

const SPEAKER_VISUAL_INDEX = createSpeakerVisualIndex();

function createSpeakerVisualIndex() {
  const index = new Map<string, SpeakerVisual>();
  for (const npc of Object.values(content.npcs)) {
    const visual: SpeakerVisual = {
      name: npc.name,
      accentColor: npc.visual?.accentColor ?? "#9adce1",
      background: npc.visual?.background ?? "linear-gradient(135deg, #183349 0%, #101b2b 100%)",
      portraitCategory: "portrait",
      portraitId: npc.visual?.portraitId,
    };
    for (const alias of [npc.name, ...(npc.aliases ?? [])]) index.set(alias, visual);
  }
  for (const [speaker, visual] of Object.entries(SPECIAL_SPEAKERS)) index.set(speaker, visual);
  return index;
}

function makeEngine(): RpgEngine {
  const saved = loadSave();
  return new RpgEngine(content, saved ?? createStartState());
}

function monogram(name: string) {
  return name.replace(/[·・\s]/g, "").slice(0, 2) || "旅人";
}

function resolveSpeakerVisual(speaker: string): SpeakerVisual {
  return (
    SPEAKER_VISUAL_INDEX.get(speaker) ?? {
      name: speaker,
      accentColor: "#85d9df",
      background: "linear-gradient(135deg, #1a3145 0%, #251a3b 100%)",
    }
  );
}

function isBattleNarrativeText(text: string) {
  return ["緋帆", "砲聲", "快船", "撤退", "甲板", "戰"].some((token) => text.includes(token));
}

export function GameClient() {
  const [engine, setEngine] = useState<RpgEngine>(() => makeEngine());
  const [activeNode, setActiveNode] = useState<PlayNode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showJournal, setShowJournal] = useState(true);
  const [travelTransition, setTravelTransition] = useState<TravelTransition | null>(null);

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
      setNotice("這個角落暫時沒有新的事件，但海風裡像還藏著下一段故事。");
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
  const activeSpeaker = activeNode?.kind === "dialogue" ? resolveSpeakerVisual(activeNode.speaker) : null;
  const previousSceneIdRef = useRef(state.currentSceneId);

  useEffect(() => {
    const previousSceneId = previousSceneIdRef.current;
    if (previousSceneId === state.currentSceneId) return;

    const previousScene = content.scenes[previousSceneId];
    const previousArea = previousScene ? content.areas[previousScene.areaId] : null;
    const nextArea = content.areas[scene.areaId];
    const kind = previousArea && previousArea.id !== nextArea.id ? "area" : "scene";
    const label =
      kind === "area" && previousArea
        ? `${previousArea.name} → ${nextArea.name}`
        : previousScene
          ? `${previousScene.name} → ${scene.name}`
          : scene.name;

    setTravelTransition({ label, kind });
    previousSceneIdRef.current = state.currentSceneId;

    const timer = window.setTimeout(() => setTravelTransition(null), 1400);
    return () => window.clearTimeout(timer);
  }, [scene, state.currentSceneId]);

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

  const crewCount = ["flag.recruited_bram", "flag.recruited_sera"].filter((flag) => state.flags.includes(flag)).length;
  const inventoryLabel = state.inventory.length > 0 ? state.inventory.join("、") : "尚未獲得特殊物品";
  const currentAreaIndex = state.unlocked.areas.findIndex((areaId) => areaId === area.id);
  const castEntries = useMemo<CastEntry[]>(
    () =>
      Object.values(content.npcs)
        .filter((npc) => state.unlocked.scenes.includes(npc.homeScene))
        .map((npc) => ({ npc, visual: resolveSpeakerVisual(npc.name) })),
    [state.unlocked.scenes],
  );
  const battlePhase = useMemo<"engage" | "resolution" | null>(() => {
    if (!activeNode) return null;
    if (activeNode.kind === "checkResult" && (activeNode.stat === "combat" || activeNode.stat === "nav")) {
      return "resolution";
    }
    if (activeNode.kind === "dialogue" && isBattleNarrativeText(activeNode.text)) {
      return "engage";
    }
    return null;
  }, [activeNode]);
  const battleSuccessHint = activeNode?.kind === "checkResult" ? activeNode.success : undefined;
  const phaseBackdropById: Record<GamePhase, "calm" | "night" | "storm"> = {
    DAWN: "calm",
    DAY: "calm",
    DUSK: "storm",
    NIGHT: "night",
  };
  const sceneMoodFrames = useMemo(
    () => [
      { id: phaseBackdropById[state.clock.phase], category: "battle-bg" as const, label: `${PHASE_LABELS[state.clock.phase]}氛圍` },
      { id: "title", category: "key-visual" as const, label: "蒼瀾主視覺" },
      { id: scene.visual?.overlay?.id ?? "discovery", category: (scene.visual?.overlay?.category ?? "event") as ArtCategory, label: "場景焦點" },
      { id: state.clock.phase === "NIGHT" ? "ismay" : "lyra", category: "portrait" as const, label: "角色氛圍" },
    ],
    [scene.visual?.overlay?.category, scene.visual?.overlay?.id, state.clock.phase],
  );
  // 目前該做什麼：第一條「已開啟、未完成」的主線目標——常駐顯示，玩家不必開
  // 日誌就知道下一步往哪走（探索型 RPG 最怕的就是玩家不知道觸發點在哪）。
  const currentGuidance = useMemo(() => {
    for (const { quest, objectives } of questSummaries) {
      if (quest.kind !== "MAIN") continue;
      const next = objectives.find((o) => !o.done);
      if (next) return { title: quest.title, objective: next.objective };
    }
    return null;
  }, [questSummaries]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 md:px-6">
      <header className="panel game-banner">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-foam/60">Azure Voyage RPG</p>
          <h1 className="text-2xl font-semibold text-gold">蒼瀾航路：晨汐紀事</h1>
          <p className="mt-1 text-sm text-foam/80">
            第 {state.clock.day} 日・{PHASE_LABELS[state.clock.phase]}・{SEASON_LABELS[state.clock.season]}季
          </p>
        </div>
        <div className="game-stat-row">
          {Object.entries(STAT_LABELS).map(([stat, label]) => (
            <div key={stat} className="game-stat-pill">
              <span>{label}</span>
              <strong>{state.captainStats[stat as CaptainStat]}</strong>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => setShowJournal((v) => !v)}>
            {showJournal ? "收起任務" : "展開任務"}
          </button>
          <button className="btn-ghost" onClick={handleNewGame}>
            重新開始
          </button>
        </div>
      </header>

      <div className="game-layout">
        <main className="space-y-4">
          {currentGuidance && (
            <section className="panel guidance-banner">
              <p className="text-xs text-foam/60">目前主線・{currentGuidance.title}</p>
              <p className="text-sm text-foam/90">◆ {currentGuidance.objective.description}</p>
              {currentGuidance.objective.hint && (
                <p className="mt-1 text-xs text-gold/80">↳ {currentGuidance.objective.hint}</p>
              )}
            </section>
          )}

          {state.unlocked.areas.length > 0 && (
            <section className="panel route-map-panel">
              <div className="route-map-header">
                <div>
                  <p className="scene-nav-label">世界航路</p>
                  <h2 className="route-map-title">{content.regions[area.regionId].name}</h2>
                </div>
                <p className="route-map-caption">
                  目前停靠：{area.name}／{scene.name}
                </p>
              </div>
              <div className="route-area-track" role="list" aria-label="已解鎖港口">
                {state.unlocked.areas.map((areaId, index) => {
                  const unlockedArea = content.areas[areaId];
                  const isCurrent = unlockedArea.id === area.id;
                  const isVisited = index <= currentAreaIndex;
                  return (
                    <button
                      key={unlockedArea.id}
                      role="listitem"
                      className={`route-area-node ${isCurrent ? "is-current" : ""} ${isVisited ? "is-visited" : ""}`}
                      disabled={isCurrent}
                      onClick={() => handleEnterArea(unlockedArea.id)}
                    >
                      <span className="route-area-index">{index + 1}</span>
                      <span className="route-area-meta">
                        <strong>{unlockedArea.name}</strong>
                        <small>{unlockedArea.kind === "PORT" ? "港口" : "荒野"}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="route-scene-track" role="list" aria-label={`${area.name} 場景航點`}>
                {areaView.scenes.map(({ scene: nextScene, open }, index) => {
                  const isCurrent = nextScene.id === scene.id;
                  return (
                    <button
                      key={nextScene.id}
                      role="listitem"
                      className={`route-scene-node ${isCurrent ? "is-current" : ""}`}
                      disabled={!open || isCurrent}
                      onClick={() => handleTravel(nextScene.id)}
                      title={open ? undefined : "現在沒有開放"}
                    >
                      <span className="route-scene-bullet">{index + 1}</span>
                      <span>{nextScene.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <SceneStage
            scene={scene}
            hotspots={sceneView.hotspots}
            sceneOpen={sceneOpen}
            activeNode={activeNode}
            phase={state.clock.phase}
            season={state.clock.season}
            travelLabel={travelTransition?.label}
            travelKind={travelTransition?.kind}
            onInteract={handleInteract}
            onWait={handleWait}
          />

          {notice && <section className="panel notice-banner">{notice}</section>}

          {activeNode ? (
            <section className="panel dialogue-panel">
              {battlePhase && <BattleCinematic phase={battlePhase} successHint={battleSuccessHint} />}

              {activeNode.kind === "dialogue" && activeSpeaker && (
                <div className="dialogue-layout">
                  <SpeakerPortraitCard speaker={activeSpeaker} />
                  <div className="dialogue-bubble" key={`${activeNode.speaker}:${activeNode.text}`}>
                    <p className="dialogue-speaker" style={{ color: activeSpeaker.accentColor }}>
                      {activeNode.speaker}
                    </p>
                    <p className="dialogue-text">{activeNode.text}</p>
                    <button className="btn" onClick={handleContinue}>
                      繼續
                    </button>
                  </div>
                </div>
              )}

              {activeNode.kind === "checkResult" && (
                <div className="dialogue-bubble system-bubble">
                  <p className="dialogue-speaker">
                    {STAT_LABELS[activeNode.stat]}判定・門檻 {activeNode.difficulty}
                  </p>
                  <p className="dialogue-text">
                    你的基礎實力是 {activeNode.playerValue}。{activeNode.success ? "這一步走得漂亮，局面穩住了。" : "這次沒能盡如人意，但故事還沒結束。"}
                  </p>
                  <button className="btn" onClick={handleContinue}>
                    繼續
                  </button>
                </div>
              )}

              {activeNode.kind === "choice" && (
                <div className="dialogue-bubble choice-bubble">
                  <p className="dialogue-speaker">你的選擇</p>
                  <p className="dialogue-text">{activeNode.prompt}</p>
                  <div className="choice-grid">
                    {activeNode.options.map((opt) => (
                      <button key={opt.index} className="btn-ghost choice-btn" onClick={() => handleChoose(opt.index)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="panel idle-panel">
              {sceneOpen
                ? "從場景中的發光節點開始互動。每次選擇都會推進你在琥珀灣的命運。"
                : "這個場景現在尚未開放；你可以先等待，或切去同港口的其他場所。"}
            </section>
          )}

          {state.unlocked.areas.length > 1 && (
            <nav className="panel scene-nav">
              <span className="scene-nav-label">世界地圖・{content.regions[area.regionId].name}</span>
              <div className="scene-nav-buttons">
                {state.unlocked.areas.map((areaId) => {
                  const unlockedArea = content.areas[areaId];
                  return (
                    <button
                      key={unlockedArea.id}
                      className={unlockedArea.id === area.id ? "btn" : "btn-ghost"}
                      disabled={unlockedArea.id === area.id}
                      onClick={() => handleEnterArea(unlockedArea.id)}
                    >
                      {unlockedArea.name}
                    </button>
                  );
                })}
              </div>
            </nav>
          )}

          <nav className="panel scene-nav">
            <span className="scene-nav-label">{area.name} 場景</span>
            <div className="scene-nav-buttons">
              {areaView.scenes.map(({ scene: nextScene, open }) => (
                <button
                  key={nextScene.id}
                  className={nextScene.id === scene.id ? "btn" : "btn-ghost"}
                  disabled={!open || nextScene.id === scene.id}
                  onClick={() => handleTravel(nextScene.id)}
                  title={open ? undefined : "現在沒有開放"}
                >
                  {nextScene.name}
                  {!open && "（休息中）"}
                </button>
              ))}
            </div>
          </nav>
        </main>

        <aside className="space-y-4">
          <AudioDock
            ambience={scene.visual?.ambience}
            transitionKey={travelTransition?.label ?? null}
            choiceOpen={activeNode?.kind === "choice"}
          />

          <section className="panel">
            <h2 className="panel-title">視覺圖庫</h2>
            <div className="scene-gallery">
              {sceneMoodFrames.map((frame) => (
                <article key={`${frame.category}:${frame.id}`} className="scene-gallery-card">
                  <GameArt
                    category={frame.category}
                    id={frame.id}
                    alt={frame.label}
                    className="scene-gallery-image"
                    fallback={<div className="scene-gallery-fallback" />}
                  />
                  <p>{frame.label}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel status-panel">
            <h2 className="panel-title">航海狀態</h2>
            <div className="status-grid">
              <div>
                <span>所在港口</span>
                <strong>{area.name}</strong>
              </div>
              <div>
                <span>目前場景</span>
                <strong>{scene.name}</strong>
              </div>
              <div>
                <span>已招募船員</span>
                <strong>{crewCount} / 2</strong>
              </div>
              <div>
                <span>威脅等級</span>
                <strong>{state.worldState.crimsonThreat}</strong>
              </div>
            </div>
            <div className="status-subpanel">
              <h3>特殊物品</h3>
              <p>{inventoryLabel}</p>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">探索摘要</h2>
            <div className="status-grid">
              <div>
                <span>已解鎖港口</span>
                <strong>{state.unlocked.areas.length}</strong>
              </div>
              <div>
                <span>已完成事件</span>
                <strong>{Object.keys(state.eventHistory).length}</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">角色圖鑑</h2>
            <div className="cast-grid">
              {castEntries.map(({ npc, visual }) => (
                <article key={npc.id} className="cast-card">
                  <div className="cast-portrait-frame">
                    {visual.portraitId ? (
                      <GameArt
                        category={visual.portraitCategory ?? "portrait"}
                        id={visual.portraitId}
                        alt={npc.name}
                        className="cast-portrait-image"
                        fallback={<PortraitFallback speaker={npc.name} accentColor={visual.accentColor} />}
                      />
                    ) : (
                      <PortraitFallback speaker={npc.name} accentColor={visual.accentColor} />
                    )}
                  </div>
                  <div className="cast-copy">
                    <p className="cast-name">{npc.name}</p>
                    <p className="cast-scene">常駐：{content.scenes[npc.homeScene]?.name ?? npc.homeScene}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {showJournal && (
            <section className="panel space-y-3">
              <h2 className="panel-title">航海日誌</h2>
              {questSummaries.length === 0 && <p className="text-sm text-foam/60">目前沒有進行中的任務。</p>}
              {questSummaries.map(({ quest, objectives }) => (
                <div key={quest.id} className="quest-card">
                  <p className="text-sm font-medium text-gold">
                    [{quest.kind === "MAIN" ? "主線" : quest.kind === "SIDE" ? "支線" : quest.kind}] {quest.title}
                  </p>
                  {objectives.map(({ objective, done }) => (
                    <div key={objective.id} className="space-y-0.5">
                      <p className={`text-xs ${done ? "text-foam/50 line-through" : "text-foam/90"}`}>
                        {done ? "✓" : "□"} {objective.description}
                      </p>
                      {!done && objective.hint && (
                        <p className="pl-4 text-[11px] text-gold/70">↳ {objective.hint}</p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function SpeakerPortraitCard({ speaker }: { speaker: SpeakerVisual }) {
  const frameStyle = {
    borderColor: `${speaker.accentColor}66`,
    boxShadow: `0 24px 60px -30px ${speaker.accentColor}`,
    background: speaker.background,
  } as CSSProperties;

  return (
    <div className="speaker-card" style={frameStyle}>
      <div className="speaker-card-frame">
        {speaker.portraitId ? (
          <GameArt
            category={speaker.portraitCategory ?? "portrait"}
            id={speaker.portraitId}
            alt={speaker.name}
            className="speaker-portrait-image"
            fallback={<PortraitFallback speaker={speaker.name} accentColor={speaker.accentColor} />}
          />
        ) : (
          <PortraitFallback speaker={speaker.name} accentColor={speaker.accentColor} />
        )}
      </div>
      <p className="speaker-card-name">{speaker.name}</p>
    </div>
  );
}

function PortraitFallback({ speaker, accentColor }: { speaker: string; accentColor: string }) {
  return (
    <div className="portrait-fallback" style={{ color: accentColor }}>
      <span>{monogram(speaker)}</span>
    </div>
  );
}
