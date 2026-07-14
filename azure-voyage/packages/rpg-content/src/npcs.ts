import type { Npc } from "@azure-voyage/rpg-engine";

/**
 * P1/P2 垂直切片人物（docs/28《蒼瀾航路》第一部）。好感階段沿用 docs/29 §5
 * 的設計，但目前的事件內容還沒把每一階都寫滿——先把骨架接好，之後補內容
 * 只需要在 affinityTiers 加項目、寫對應事件，不用碰引擎或這裡的其他人物。
 */
export const NPCS: Record<string, Npc> = {
  "npc.mathers": {
    id: "npc.mathers",
    name: "馬瑟斯·凡登霍夫",
    portrait: "portrait.notable_aurelia",
    homeScene: "scene.aurelia.harbor_office",
  },
  "npc.bram": {
    id: "npc.bram",
    name: "布拉姆·霍特",
    portrait: "portrait.officer_generic_1",
    homeScene: "scene.aurelia.tavern",
    affinityTiers: [{ threshold: 15, unlockEvents: [] }],
  },
  "npc.sera": {
    id: "npc.sera",
    name: "賽菈·凡德",
    portrait: "portrait.officer_generic_2",
    homeScene: "scene.aurelia.tavern",
    affinityTiers: [{ threshold: 15, unlockEvents: [] }],
  },
  "npc.tuk": {
    id: "npc.tuk",
    name: "圖克·佩蘭",
    portrait: "portrait.notable_perlan",
    homeScene: "scene.perlan.docks",
    affinityTiers: [{ threshold: 20, unlockEvents: ["event.perlan.saltfield_reopened"] }],
  },
};
