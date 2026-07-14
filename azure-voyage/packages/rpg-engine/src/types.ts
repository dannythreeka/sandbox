/**
 * Azure Voyage RPG 引擎核心型別（docs/29）。純框架，不含任何蒼瀾世界的具體
 * 內容——內容由 @azure-voyage/rpg-content 以這裡定義的型別宣告。
 */

// ── 提督五維（復用既有沙盒版 M27 概念，用於技能判定）──
export const CAPTAIN_STATS = ["lead", "nav", "combat", "trade", "lore"] as const;
export type CaptainStat = (typeof CAPTAIN_STATS)[number];

// ── 時間 ──
export const GAME_PHASES = ["DAWN", "DAY", "DUSK", "NIGHT"] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

export const SEASONS = ["SPRING", "SUMMER", "AUTUMN", "WINTER"] as const;
export type Season = (typeof SEASONS)[number];

export interface GameClock {
  day: number;
  phase: GamePhase;
  season: Season;
}

export interface TimeWindow {
  phases?: GamePhase[];
  seasons?: Season[];
  minDay?: number;
  maxDay?: number;
}

// ── 條件語言：所有系統共用的唯一判定式 ──
export type Condition =
  | { kind: "flag"; flag: string; value: boolean }
  | { kind: "worldState"; path: string; op: ">=" | "<=" | "=="; value: number | string }
  | { kind: "affinity"; npc: string; op: ">="; value: number }
  | { kind: "stat"; stat: CaptainStat; op: ">="; value: number }
  | { kind: "reputation"; area: string; op: ">="; value: number }
  | { kind: "time"; window: TimeWindow }
  | { kind: "exploration"; area: string; op: ">="; value: number }
  | { kind: "eventCompleted"; event: string }
  | { kind: "and"; all: Condition[] }
  | { kind: "or"; any: Condition[] }
  | { kind: "not"; cond: Condition }
  | { kind: "always" };

// ── 後果語言：事件如何改變世界 ──
export interface Effect {
  setFlags?: string[];
  worldState?: { path: string; delta?: number; set?: number | string }[];
  affinity?: { npc: string; delta: number }[];
  reputation?: { area: string; delta: number }[];
  unlock?: { regions?: string[]; areas?: string[]; scenes?: string[] };
  advanceTime?: number; // 推進幾個「時段」（DAWN→DAY→DUSK→NIGHT→隔天 DAWN）
  giveItem?: string[];
}

// ── 世界狀態：少數幾條連續/多值軸，取代大量離散 Flag ──
export interface WorldState {
  crimsonThreat: number; // 0–100
  guildOrder: Record<string, number>;
  seaOmen: "CALM" | "STIRRING" | "AWAKENED";
  regionCorruption: Record<string, number>;
  truthProgress: number; // 0–5
  playerStance: "NONE" | "TRADER" | "AVENGER" | "SEEKER";
}

export function initialWorldState(): WorldState {
  return {
    crimsonThreat: 0,
    guildOrder: {},
    seaOmen: "CALM",
    regionCorruption: {},
    truthProgress: 0,
    playerStance: "NONE",
  };
}

// ── 三層世界架構 ──
export interface WorldRegion {
  id: string;
  name: string;
  unlockCondition: Condition;
  areas: string[];
}

export interface ExplorationMilestone {
  at: number; // 0-100 門檻
  reveal: { scenes?: string[]; discoveries?: string[]; events?: string[] };
}

export interface ExplorationTrack {
  milestones: ExplorationMilestone[];
}

export interface Area {
  id: string;
  regionId: string;
  name: string;
  kind: "PORT" | "WILDERNESS";
  unlockCondition: Condition;
  scenes: string[];
  exploration?: ExplorationTrack;
}

export interface Hotspot {
  id: string;
  label: string;
  eventPool: string[];
  visibleIf?: Condition;
}

export interface Scene {
  id: string;
  areaId: string;
  name: string;
  hotspots: Hotspot[];
  timeGate?: TimeWindow;
}

// ── 事件系統 ──
export interface DialogueNode {
  kind: "dialogue";
  id: string;
  speaker: string;
  text: string;
  goto: string;
}

export interface ChoiceOption {
  label: string;
  visibleIf?: Condition;
  goto: string;
}

export interface ChoiceNode {
  kind: "choice";
  id: string;
  prompt: string;
  options: ChoiceOption[];
}

export interface SkillCheckNode {
  kind: "skillCheck";
  id: string;
  stat: CaptainStat;
  difficulty: number;
  modifierFrom?: { cond: Condition; bonus: number }[];
  onSuccess: string;
  onFailure: string;
}

export interface EffectNode {
  kind: "effect";
  id: string;
  effect: Effect;
  goto: string;
}

export interface GotoNode {
  kind: "goto";
  id: string;
  goto: string;
}

export type EventNode = DialogueNode | ChoiceNode | SkillCheckNode | EffectNode | GotoNode;

export interface GameEvent {
  id: string;
  precondition: Condition;
  weight: number;
  once: boolean;
  cooldownDays?: number;
  entryNodeId: string;
  nodes: EventNode[];
}

// ── NPC ──
export interface AffinityTier {
  threshold: number;
  unlockEvents: string[];
}

export interface ScheduleEntry {
  when: Condition;
  scene: string;
}

export interface Npc {
  id: string;
  name: string;
  portrait: string;
  homeScene: string;
  schedule?: ScheduleEntry[];
  affinityTiers?: AffinityTier[];
}

// ── 任務 ──
export interface Objective {
  id: string;
  description: string;
  completeWhen: Condition;
}

export interface Quest {
  id: string;
  kind: "MAIN" | "SIDE" | "HIDDEN" | "TIMED";
  title: string;
  giver?: string;
  precondition: Condition;
  objectives: Objective[];
  deadline?: { atDay: number; onExpire: Effect };
  rewards: Effect;
}

// ── 內容包：rpg-content 注入給引擎的完整宣告式資料 ──
export interface ContentPack {
  regions: Record<string, WorldRegion>;
  areas: Record<string, Area>;
  scenes: Record<string, Scene>;
  events: Record<string, GameEvent>;
  npcs: Record<string, Npc>;
  quests: Record<string, Quest>;
  startSceneId: string;
}

// ── 存檔 ──
export interface EventHistoryEntry {
  count: number;
  lastAtDay: number;
}

export interface SaveState {
  clock: GameClock;
  flags: string[];
  worldState: WorldState;
  affinity: Record<string, number>;
  reputation: Record<string, number>;
  exploration: Record<string, number>;
  captainStats: Record<CaptainStat, number>;
  eventHistory: Record<string, EventHistoryEntry>;
  questProgress: Record<string, { active: boolean; completed: boolean; objectivesDone: string[] }>;
  unlocked: { regions: string[]; areas: string[]; scenes: string[] };
  inventory: string[];
  playthrough: number;
  currentSceneId: string;
}

export function createInitialSaveState(opts: {
  startSceneId: string;
  startAreaId: string;
  startRegionId: string;
  captainStats?: Partial<Record<CaptainStat, number>>;
}): SaveState {
  return {
    clock: { day: 1, phase: "DAWN", season: "SPRING" },
    flags: [],
    worldState: initialWorldState(),
    affinity: {},
    reputation: {},
    exploration: {},
    captainStats: {
      lead: 20,
      nav: 20,
      combat: 20,
      trade: 20,
      lore: 20,
      ...opts.captainStats,
    },
    eventHistory: {},
    questProgress: {},
    unlocked: {
      regions: [opts.startRegionId],
      areas: [opts.startAreaId],
      scenes: [opts.startSceneId],
    },
    inventory: [],
    playthrough: 1,
    currentSceneId: opts.startSceneId,
  };
}
