import { evaluateCondition } from "./condition";
import { applyEffect } from "./effect";
import type {
  Area,
  CaptainStat,
  ContentPack,
  EventNode,
  GameEvent,
  Hotspot,
  Scene,
  SaveState,
  WorldRegion,
} from "./types";

export interface SceneView {
  scene: Scene;
  hotspots: Hotspot[]; // 已依 visibleIf 過濾
}

export interface AreaSceneEntry {
  scene: Scene;
  open: boolean; // 依 timeGate + 目前時鐘判定是否開放進入
}

export interface AreaView {
  area: Area;
  scenes: AreaSceneEntry[];
}

export interface WorldMapView {
  unlockedRegions: WorldRegion[];
}

export type PlayNode =
  | { kind: "dialogue"; speaker: string; text: string }
  | { kind: "choice"; prompt: string; options: { index: number; label: string }[] }
  | { kind: "checkResult"; stat: CaptainStat; difficulty: number; playerValue: number; success: boolean }
  | { kind: "end" };

interface ActiveEvent {
  event: GameEvent;
  nodeId: string;
}

/**
 * 事件抽選：從熱點事件池中，過濾出前置條件成立、且未被一次性/冷卻擋掉的事件，
 * 依權重加權隨機抽一個。回傳 null 代表這個熱點暫時沒有可觸發的事件。
 */
export function pickEligibleEvent(
  hotspot: Hotspot,
  content: ContentPack,
  state: SaveState,
  rng: () => number,
): GameEvent | null {
  const candidates = hotspot.eventPool
    .map((id) => content.events[id])
    .filter((ev): ev is GameEvent => !!ev)
    .filter((ev) => {
      // weight <= 0 事件永遠不進隨機池——只能靠 startEvent() 直接觸發（例如
      // 主線關鍵事件由任務系統直接指定，而非讓場景隨機抽到）。
      if (ev.weight <= 0) return false;
      const history = state.eventHistory[ev.id];
      if (ev.once && history && history.count > 0) return false;
      if (ev.cooldownDays && history && state.clock.day - history.lastAtDay < ev.cooldownDays) return false;
      return evaluateCondition(ev.precondition, state);
    });
  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((acc, ev) => acc + ev.weight, 0);
  let roll = rng() * totalWeight;
  for (const ev of candidates) {
    roll -= ev.weight;
    if (roll <= 0) return ev;
  }
  return candidates[candidates.length - 1];
}

function resolveSkillCheck(
  node: Extract<EventNode, { kind: "skillCheck" }>,
  state: SaveState,
  rng: () => number,
): { success: boolean; playerValue: number } {
  const base = state.captainStats[node.stat];
  const modifier = (node.modifierFrom ?? []).reduce(
    (acc, m) => acc + (evaluateCondition(m.cond, state) ? m.bonus : 0),
    0,
  );
  const spread = Math.floor(rng() * 21) - 10; // -10..+10
  const roll = base + modifier + spread;
  return { success: roll >= node.difficulty, playerValue: base + modifier };
}

/**
 * RPG 引擎（docs/29）。純框架：對內容一無所知，只認 ContentPack 的資料結構。
 * 場景瀏覽（getSceneView）與事件推進（interact/continue/choose）是唯二的
 * 玩家互動入口；所有狀態改變只透過 applyEffect 發生，方便測試與存讀檔。
 */
export class RpgEngine {
  private _state: SaveState;
  private active: ActiveEvent | null = null;
  private readonly rng: () => number;

  constructor(
    private readonly content: ContentPack,
    initialState: SaveState,
    rng: () => number = Math.random,
  ) {
    this._state = initialState;
    this.rng = rng;
  }

  get state(): SaveState {
    return this._state;
  }

  getWorldMapView(): WorldMapView {
    return {
      unlockedRegions: this._state.unlocked.regions
        .map((id) => this.content.regions[id])
        .filter((r): r is WorldRegion => !!r),
    };
  }

  getAreaView(areaId: string): AreaView {
    const area = this.content.areas[areaId];
    if (!area) throw new Error(`unknown area: ${areaId}`);
    const scenes = area.scenes
      .map((id) => this.content.scenes[id])
      .filter((s): s is Scene => !!s)
      .map((scene) => ({ scene, open: this.isSceneOpen(scene) }));
    return { area, scenes };
  }

  /** 場景是否依 timeGate 對目前時鐘開放（無 timeGate 視為永遠開放）。 */
  isSceneOpen(scene: Scene): boolean {
    if (!scene.timeGate) return true;
    return evaluateCondition({ kind: "time", window: scene.timeGate }, this._state);
  }

  /** 玩家主動「等待」推進時間（不觸發任何事件），例如等某場景開門。 */
  advanceTime(steps: number): void {
    this._state = applyEffect({ advanceTime: steps }, this._state);
  }

  getSceneView(sceneId: string): SceneView {
    const scene = this.content.scenes[sceneId];
    if (!scene) throw new Error(`unknown scene: ${sceneId}`);
    const hotspots = scene.hotspots.filter(
      (h) => !h.visibleIf || evaluateCondition(h.visibleIf, this._state),
    );
    return { scene, hotspots };
  }

  /** 玩家移動到某個場景（僅記錄當前位置，不觸發事件）。 */
  travelTo(sceneId: string): void {
    if (!this._state.unlocked.scenes.includes(sceneId)) {
      throw new Error(`scene not unlocked: ${sceneId}`);
    }
    const scene = this.content.scenes[sceneId];
    if (!scene) throw new Error(`unknown scene: ${sceneId}`);
    if (!this.isSceneOpen(scene)) {
      throw new Error(`scene not open at this hour: ${sceneId}`);
    }
    this._state = { ...this._state, currentSceneId: sceneId };
  }

  /** 點擊熱點：抽一個符合條件的事件並開始播放。沒有可觸發事件時回傳 null。 */
  interact(hotspotId: string): PlayNode | null {
    const scene = this.content.scenes[this._state.currentSceneId];
    const hotspot = scene?.hotspots.find((h) => h.id === hotspotId);
    if (!hotspot) throw new Error(`unknown hotspot: ${hotspotId}`);

    const event = pickEligibleEvent(hotspot, this.content, this._state, this.rng);
    if (!event) return null;
    return this.startEvent(event.id);
  }

  startEvent(eventId: string): PlayNode {
    const event = this.content.events[eventId];
    if (!event) throw new Error(`unknown event: ${eventId}`);
    this.active = { event, nodeId: event.entryNodeId };
    return this.resolveToPause();
  }

  /** 推進對話/判定結果節點（不需要玩家選擇的節點）到下一個需要暫停的節點。 */
  continue(): PlayNode {
    if (!this.active) throw new Error("no active event");
    const node = this.currentNode();
    if (node.kind !== "dialogue" && node.kind !== "skillCheck") {
      throw new Error(`continue() called on non-continuable node: ${node.kind}`);
    }
    if (node.kind === "dialogue") {
      this.active.nodeId = node.goto;
      return this.resolveToPause();
    }
    // skillCheck 節點在 resolveToPause 已經算完結果並暫停在 checkResult 上，
    // continue() 這裡是玩家看完判定結果後，才真正走向 onSuccess/onFailure。
    const resolved = this.lastCheckResolution;
    if (!resolved) throw new Error("skill check not resolved");
    this.active.nodeId = resolved.success ? node.onSuccess : node.onFailure;
    this.lastCheckResolution = undefined;
    return this.resolveToPause();
  }

  choose(optionIndex: number): PlayNode {
    if (!this.active) throw new Error("no active event");
    const node = this.currentNode();
    if (node.kind !== "choice") throw new Error("choose() called on non-choice node");
    const visible = node.options.filter((o) => !o.visibleIf || evaluateCondition(o.visibleIf, this._state));
    const option = visible[optionIndex];
    if (!option) throw new Error(`invalid option index: ${optionIndex}`);
    this.active.nodeId = option.goto;
    return this.resolveToPause();
  }

  private lastCheckResolution: { success: boolean } | undefined;

  private currentNode(): EventNode {
    if (!this.active) throw new Error("no active event");
    const node = this.active.event.nodes.find((n) => n.id === this.active!.nodeId);
    if (!node) throw new Error(`unknown node: ${this.active.nodeId} in event ${this.active.event.id}`);
    return node;
  }

  /** 自動吃掉 effect/goto 節點，直到遇到需要玩家看/選的節點，或事件結束。 */
  private resolveToPause(): PlayNode {
    if (!this.active) throw new Error("no active event");

    while (true) {
      if (this.active.nodeId === "END") {
        this.finishActiveEvent();
        return { kind: "end" };
      }

      const node = this.currentNode();
      switch (node.kind) {
        case "dialogue":
          return { kind: "dialogue", speaker: node.speaker, text: node.text };
        case "choice": {
          const visible = node.options.filter(
            (o) => !o.visibleIf || evaluateCondition(o.visibleIf, this._state),
          );
          return {
            kind: "choice",
            prompt: node.prompt,
            options: visible.map((o, index) => ({ index, label: o.label })),
          };
        }
        case "skillCheck": {
          const result = resolveSkillCheck(node, this._state, this.rng);
          this.lastCheckResolution = { success: result.success };
          return {
            kind: "checkResult",
            stat: node.stat,
            difficulty: node.difficulty,
            playerValue: result.playerValue,
            success: result.success,
          };
        }
        case "effect":
          this._state = applyEffect(node.effect, this._state);
          this.active.nodeId = node.goto;
          continue;
        case "goto":
          this.active.nodeId = node.goto;
          continue;
      }
    }
  }

  private finishActiveEvent(): void {
    if (!this.active) return;
    const id = this.active.event.id;
    const prev = this._state.eventHistory[id];
    this._state = {
      ...this._state,
      eventHistory: {
        ...this._state.eventHistory,
        [id]: { count: (prev?.count ?? 0) + 1, lastAtDay: this._state.clock.day },
      },
    };
    this.active = null;
  }
}
