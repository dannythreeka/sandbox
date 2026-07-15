import { createInitialSaveState, type ContentPack, type SaveState, type Scene } from "@azure-voyage-rpg/engine";
import { REGIONS, AREAS } from "./regionsAreas";
import { AURELIA_SCENES } from "./scenes/aurelia";
import { PERLAN_SCENES } from "./scenes/perlan";
import { OPENING_EVENTS } from "./events/opening";
import { TAVERN_EVENTS } from "./events/tavern";
import { MARKET_EVENTS } from "./events/market";
import { PERLAN_EVENTS } from "./events/perlan";
import { NPCS } from "./npcs";
import { QUESTS } from "./quests";
import { THEME_PRESETS } from "./themePresets";

function injectThemePreset(scene: Scene): Scene {
  const visual = scene.visual;
  if (!visual?.themePresetId) {
    return scene;
  }

  const preset = THEME_PRESETS[visual.themePresetId as keyof typeof THEME_PRESETS];
  if (!preset) {
    return scene;
  }

  const override = visual.themeTemplate;
  return {
    ...scene,
    visual: {
      ...visual,
      themeTemplate: {
        ...preset,
        ...override,
        elements: override?.elements?.length ? override.elements : preset.elements,
      },
    },
  };
}

const BASE_SCENES: Record<string, Scene> = {
  ...AURELIA_SCENES,
  ...PERLAN_SCENES,
};

const SCENES: Record<string, Scene> = Object.fromEntries(
  Object.entries(BASE_SCENES).map(([sceneId, scene]) => [sceneId, injectThemePreset(scene)]),
);

/**
 * P1/P2 垂直切片內容包（docs/29 §14 路線圖）：奧雷利亞 3 場景 + 佩爾蘭支線。
 * 對映小說（docs/28）第一部第一～四章、第六章。
 */
export const AZURE_VOYAGE_RPG_CONTENT: ContentPack = {
  regions: REGIONS,
  areas: AREAS,
  scenes: SCENES,
  events: { ...OPENING_EVENTS, ...TAVERN_EVENTS, ...MARKET_EVENTS, ...PERLAN_EVENTS },
  npcs: NPCS,
  quests: QUESTS,
  startSceneId: "scene.aurelia.harbor_office",
};

/**
 * 新遊戲存檔：抵達一個已解鎖的港口，該港口全部場景一開始就看得到（沒有
 * 港內迷霧），玩家可以自由在港務廳／酒館／市場之間走動——只是各場景是否
 * 「開門」還要看 timeGate（見 scenes/aurelia.ts）。
 */
export function createStartState(): SaveState {
  const base = createInitialSaveState({
    startSceneId: AZURE_VOYAGE_RPG_CONTENT.startSceneId,
    startAreaId: "area.aurelia",
    startRegionId: "region.amber_gulf",
  });
  return {
    ...base,
    unlocked: { ...base.unlocked, scenes: [...AREAS["area.aurelia"].scenes] },
  };
}
