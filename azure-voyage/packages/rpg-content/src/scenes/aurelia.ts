import type { Scene } from "@azure-voyage/rpg-engine";

export const AURELIA_SCENES: Record<string, Scene> = {
  "scene.aurelia.harbor_office": {
    id: "scene.aurelia.harbor_office",
    areaId: "area.aurelia",
    name: "港務廳",
    timeGate: { phases: ["DAWN", "DAY", "DUSK"] }, // 夜裡不辦公
    hotspots: [
      {
        id: "hotspot.harbor_office.desk",
        label: "長桌前的馬瑟斯",
        eventPool: ["event.opening"],
      },
      {
        id: "hotspot.harbor_office.notice_board",
        label: "公告欄",
        eventPool: ["event.harbor_office.rumor"],
        visibleIf: { kind: "flag", flag: "flag.game_started", value: true },
      },
    ],
  },
  "scene.aurelia.tavern": {
    id: "scene.aurelia.tavern",
    areaId: "area.aurelia",
    name: "錨與星酒館",
    timeGate: { phases: ["DUSK", "NIGHT"] }, // 傍晚才開始熱鬧
    hotspots: [
      {
        id: "hotspot.tavern.bar",
        label: "吧檯",
        eventPool: ["event.tavern.recruit_bram", "event.tavern.recruit_sera"],
        visibleIf: { kind: "flag", flag: "flag.game_started", value: true },
      },
      {
        id: "hotspot.tavern.corner_table",
        label: "角落的桌子",
        eventPool: ["event.tavern.crimson_rumor"],
        visibleIf: { kind: "flag", flag: "flag.game_started", value: true },
      },
    ],
  },
  "scene.aurelia.market": {
    id: "scene.aurelia.market",
    areaId: "area.aurelia",
    name: "中央市場",
    timeGate: { phases: ["DAWN", "DAY"] }, // 只在白天營業
    hotspots: [
      {
        id: "hotspot.market.stalls",
        label: "貨攤",
        eventPool: ["event.market.first_trade"],
        visibleIf: { kind: "flag", flag: "flag.game_started", value: true },
      },
      {
        id: "hotspot.market.lookout",
        label: "碼頭瞭望",
        eventPool: ["event.market.crimson_scout"],
        visibleIf: { kind: "flag", flag: "flag.crew_assembled", value: true },
      },
    ],
  },
};
