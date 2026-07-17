"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  RpgEngine,
  CAPTAIN_STATS,
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
import { reportError, trackEvent } from "@/lib/telemetry";
import { GameArt } from "@/game/GameArt";
import { SceneStage } from "@/game/SceneStage";
import { AudioDock } from "@/game/AudioDock";
import { BattleCinematic } from "@/game/BattleCinematic";
import { OnboardingOverlay } from "@/game/OnboardingOverlay";
import { ConfirmModal } from "@/game/ConfirmModal";
import { CaptainNameModal } from "@/game/CaptainNameModal";
import { AchievementToast } from "@/game/AchievementToast";

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

const ACHIEVEMENT_FLAGS: Record<string, string> = {
  'flag.recruited_bram': '⚓ 新夥伴：布拉姆·霍特加入船隊',
  'flag.recruited_sera': '📒 新夥伴：賽菈·凡德加入船隊',
  'flag.crew_assembled': '🚢 船隊集結完畢！可以出海了',
  'flag.first_battle_done': '⚔️ 首戰告捷！緋帆團吃了一次虧',
  'flag.part_one_complete': '🏆 第一部完結：晨汐商會的名字開始流傳',
};

function bootstrapGame() {
  const loaded = loadSave();
  const engine = new RpgEngine(content, loaded.state ?? createStartState());
  return {
    engine,
    notice: loaded.notice,
    saveStatus: loaded.status,
    captainName: engine.state.captainName ?? '',
  };
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
  const [bootstrap] = useState(bootstrapGame);
  const [engine, setEngine] = useState<RpgEngine>(() => bootstrap.engine);
  const [activeNode, setActiveNode] = useState<PlayNode | null>(null);
  const [notice, setNotice] = useState<string | null>(() => bootstrap.notice);
  const [showJournal, setShowJournal] = useState(true);
  const [travelTransition, setTravelTransition] = useState<TravelTransition | null>(null);
  const [captainName, setCaptainName] = useState<string>(() => bootstrap.captainName);
  const [showConfirmNew, setShowConfirmNew] = useState(false);
  const [showCaptainNameModal, setShowCaptainNameModal] = useState(false);
  const [pendingAchievements, setPendingAchievements] = useState<string[]>([]);
  const [statDeltas, setStatDeltas] = useState<Partial<Record<CaptainStat, number>>>({});
  const prevFlagsRef = useRef(engine.state.flags);
  const prevStatsRef = useRef({ ...engine.state.captainStats });

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
      trackEvent("gameplay.interact.miss", {
        hotspotId,
        sceneId: engine.state.currentSceneId,
        day: engine.state.clock.day,
        phase: engine.state.clock.phase,
      });
      setNotice("這個角落暫時沒有新的事件，但海風裡像還藏著下一段故事。");
      return;
    }
    trackEvent("gameplay.interact.hit", {
      hotspotId,
      sceneId: engine.state.currentSceneId,
      day: engine.state.clock.day,
      phase: engine.state.clock.phase,
      nextNodeKind: node.kind,
    });
    settle(node);
  }

  function handleContinue() {
    const beforeKind = activeNode?.kind ?? "idle";
    const nextNode = engine.continue();
    trackEvent("gameplay.continue", {
      fromNodeKind: beforeKind,
      toNodeKind: nextNode.kind,
      sceneId: engine.state.currentSceneId,
      day: engine.state.clock.day,
    });
    settle(nextNode);
  }

  function handleChoose(index: number) {
    const nextNode = engine.choose(index);
    trackEvent("gameplay.choice.select", {
      choiceIndex: index,
      toNodeKind: nextNode.kind,
      sceneId: engine.state.currentSceneId,
      day: engine.state.clock.day,
    });
    settle(nextNode);
  }

  function handleWait() {
    setNotice(null);
    const beforePhase = engine.state.clock.phase;
    const beforeDay = engine.state.clock.day;
    engine.advanceTime(1);
    trackEvent("gameplay.wait.advance_time", {
      fromDay: beforeDay,
      fromPhase: beforePhase,
      toDay: engine.state.clock.day,
      toPhase: engine.state.clock.phase,
      sceneId: engine.state.currentSceneId,
    });
    sync();
  }

  function handleTravel(sceneId: string) {
    setNotice(null);
    try {
      const fromSceneId = engine.state.currentSceneId;
      engine.travelTo(sceneId);
      trackEvent("gameplay.travel.scene", {
        fromSceneId,
        toSceneId: sceneId,
        day: engine.state.clock.day,
        phase: engine.state.clock.phase,
      });
      sync();
    } catch (err) {
      reportError("gameplay.travel.scene_failed", err, {
        fromSceneId: engine.state.currentSceneId,
        toSceneId: sceneId,
      });
      setNotice(err instanceof Error ? err.message : "現在還不能去那裡。");
    }
  }

  function handleEnterArea(areaId: string) {
    setNotice(null);
    const target = content.areas[areaId];
    const entryScene = target.scenes[0];
    try {
      const fromAreaId = content.scenes[engine.state.currentSceneId]?.areaId ?? "";
      engine.travelTo(entryScene);
      trackEvent("gameplay.travel.area", {
        fromAreaId,
        toAreaId: areaId,
        toSceneId: entryScene,
        day: engine.state.clock.day,
        phase: engine.state.clock.phase,
      });
      sync();
    } catch (err) {
      reportError("gameplay.travel.area_failed", err, {
        toAreaId: areaId,
        toSceneId: entryScene,
      });
      setNotice(err instanceof Error ? err.message : "現在還不能去那裡。");
    }
  }

  function handleNewGame() {
    setShowConfirmNew(true);
  }

  function handleConfirmNewGame() {
    setShowConfirmNew(false);
    setShowCaptainNameModal(true);
  }

  function handleStartNewGame(name: string) {
    trackEvent("gameplay.new_game.confirmed", {
      previousPlaythrough: engine.state.playthrough,
      previousDay: engine.state.clock.day,
      previousSceneId: engine.state.currentSceneId,
    });
    clearSave();
    const fresh = new RpgEngine(content, createStartState({ captainName: name }));
    setCaptainName(name);
    setEngine(fresh);
    setActiveNode(null);
    setNotice(null);
    persistSave(fresh.state);
    setVersion((v) => v + 1);
    setShowCaptainNameModal(false);
    prevFlagsRef.current = fresh.state.flags;
    prevStatsRef.current = { ...fresh.state.captainStats };
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
    trackEvent("session.start", {
      sceneId: bootstrap.engine.state.currentSceneId,
      day: bootstrap.engine.state.clock.day,
      phase: bootstrap.engine.state.clock.phase,
      saveStatus: bootstrap.saveStatus,
    });
  }, [bootstrap]);

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
    trackEvent("gameplay.transition", {
      kind,
      label,
      fromSceneId: previousSceneId,
      toSceneId: state.currentSceneId,
      day: state.clock.day,
      phase: state.clock.phase,
    });
    previousSceneIdRef.current = state.currentSceneId;

    const timer = window.setTimeout(() => setTravelTransition(null), 1400);
    return () => window.clearTimeout(timer);
  }, [scene, state.currentSceneId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if ((event.key === "j" || event.key === "J") && !event.repeat) {
        event.preventDefault();
        setShowJournal((value) => !value);
        return;
      }

      if (activeNode?.kind === "choice") {
        const optionIndex = Number(event.key) - 1;
        if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < activeNode.options.length) {
          event.preventDefault();
          handleChoose(optionIndex);
        }
        return;
      }

      if (event.key === "Enter" && (activeNode?.kind === "dialogue" || activeNode?.kind === "checkResult")) {
        event.preventDefault();
        handleContinue();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeNode, handleChoose, handleContinue]);

  useEffect(() => {
    const prev = prevFlagsRef.current;
    const curr = state.flags;
    const newFlags = curr.filter((f) => !prev.includes(f));
    if (newFlags.length === 0) return;
    prevFlagsRef.current = curr;
    const toAdd = newFlags.filter((f) => ACHIEVEMENT_FLAGS[f]).map((f) => ACHIEVEMENT_FLAGS[f]);
    if (toAdd.length > 0) setPendingAchievements((a) => [...a, ...toAdd]);
  }, [state.flags]);

  useEffect(() => {
    const prev = prevStatsRef.current;
    const curr = state.captainStats;
    const deltas: Partial<Record<CaptainStat, number>> = {};
    for (const s of CAPTAIN_STATS) {
      const d = curr[s] - prev[s];
      if (d !== 0) deltas[s] = d;
    }
    if (Object.keys(deltas).length === 0) return;
    prevStatsRef.current = { ...curr };
    setStatDeltas(deltas);
    const timer = window.setTimeout(() => setStatDeltas({}), 1600);
    return () => window.clearTimeout(timer);
  }, [state.captainStats]);

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

  function getNextOpenPhaseLabel(): string | null {
    if (!scene.timeGate?.phases?.length) return null;
    const phaseOrder: GamePhase[] = ["DAWN", "DAY", "DUSK", "NIGHT"];
    const phaseLabels: Record<GamePhase, string> = { DAWN: "黎明", DAY: "白晝", DUSK: "黃昏", NIGHT: "夜晚" };
    const idx = phaseOrder.indexOf(state.clock.phase);
    for (let i = 1; i <= 4; i++) {
      const next = phaseOrder[(idx + i) % 4] as GamePhase;
      if (scene.timeGate.phases.includes(next)) return phaseLabels[next];
    }
    return null;
  }
  const nextOpenPhaseLabel = getNextOpenPhaseLabel();

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 md:px-6">
      <OnboardingOverlay />
      <header className="panel game-banner">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-foam/60">Azure Voyage RPG</p>
          <h1 className="text-2xl font-semibold text-gold">蒼瀾航路：晨汐紀事</h1>
          {captainName && (
            <p className="text-xs text-foam/70 mt-0.5">船長：{captainName}</p>
          )}
          <p className="mt-1 text-sm text-foam/80">
            第 {state.clock.day} 日・{PHASE_LABELS[state.clock.phase]}・{SEASON_LABELS[state.clock.season]}季
          </p>
          <p className="game-hotkey-hint">快捷鍵：J 切換日誌／Enter 繼續／1-9 選項</p>
        </div>
        <div className="game-stat-row">
          {Object.entries(STAT_LABELS).map(([stat, label]) => {
            const delta = statDeltas[stat as CaptainStat];
            return (
              <div key={stat} className="game-stat-pill">
                <span>{label}</span>
                <strong>{state.captainStats[stat as CaptainStat]}</strong>
                {delta !== undefined && (
                  <span key={delta} className={`stat-delta ${delta > 0 ? 'is-positive' : 'is-negative'}`}>
                    {delta > 0 ? `+${delta}` : `${delta}`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => setShowJournal((v) => !v)} title="快捷鍵 J">
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

          {notice && (
            <section className="panel notice-banner" role="status" aria-live="polite">
              {notice}
            </section>
          )}

          {activeNode ? (
            <section className="panel dialogue-panel">
              {battlePhase && <BattleCinematic phase={battlePhase} successHint={battleSuccessHint} />}

              {activeNode.kind === "dialogue" && activeSpeaker && (
                <div className="dialogue-layout">
                  <SpeakerPortraitCard speaker={activeSpeaker} />
                  <div className="dialogue-bubble" key={`${activeNode.speaker}:${activeNode.text}`} role="status" aria-live="polite">
                    <p className="dialogue-speaker" style={{ color: activeSpeaker.accentColor }}>
                      {activeNode.speaker === "你" && captainName ? captainName : activeNode.speaker}
                    </p>
                    <p className="dialogue-text">{activeNode.text}</p>
                    <button className="btn" onClick={handleContinue}>
                      繼續
                    </button>
                  </div>
                </div>
              )}

              {activeNode.kind === "checkResult" && (
                <div className={`dialogue-bubble system-bubble check-result-bubble ${activeNode.success ? 'is-success' : 'is-failure'}`} role="status" aria-live="polite">
                  <div className="check-result-icon" aria-hidden="true">
                    {activeNode.success ? '✅' : '❌'}
                  </div>
                  <p className="check-result-label">
                    {STAT_LABELS[activeNode.stat]}判定・門檻 {activeNode.difficulty}・你的實力 {activeNode.playerValue}
                  </p>
                  <p className="dialogue-text">
                    {activeNode.success ? "這一步走得漂亮，局面穩住了。" : "這次沒能盡如人意，但故事還沒結束。"}
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
                    {activeNode.options.map((opt, choiceIndex) => (
                      <button key={opt.index} className="btn-ghost choice-btn" onClick={() => handleChoose(opt.index)}>
                        <span className="choice-shortcut">{choiceIndex + 1}.</span>
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
                : (
                  <span>
                    【{scene.name}】{scene.timeGate?.phases ? `${scene.timeGate.phases.map(p => ({ DAWN:'黎明', DAY:'白晝', DUSK:'黃昏', NIGHT:'夜晚' })[p]).join('／')}開放` : '目前封鎖'}
                    {nextOpenPhaseLabel && <strong className="time-gate-next">{" "}下一開放時段：{nextOpenPhaseLabel}</strong>}
                  </span>
                )}
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
            <h2 className="panel-title">場景氛圍</h2>
            <p className="text-xs text-foam/50 mb-2">當前場景的視覺情境</p>
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
      {showConfirmNew && (
        <ConfirmModal
          message="要放棄目前存檔，展開新旅程嗎？"
          onConfirm={handleConfirmNewGame}
          onCancel={() => setShowConfirmNew(false)}
        />
      )}
      {showCaptainNameModal && (
        <CaptainNameModal
          onConfirm={handleStartNewGame}
          onCancel={() => setShowCaptainNameModal(false)}
        />
      )}
      <AchievementToast
        achievements={pendingAchievements}
        onClear={(msg) => setPendingAchievements((a) => a.filter((x) => x !== msg))}
      />
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
