import type { Scene } from "@azure-voyage-rpg/engine";

export const AURELIA_SCENES: Record<string, Scene> = {
  "scene.aurelia.harbor_office": {
    id: "scene.aurelia.harbor_office",
    areaId: "area.aurelia",
    name: "港務廳",
    timeGate: { phases: ["DAWN", "DAY", "DUSK"] }, // 夜裡不辦公
    visual: {
      summary: "帶著鹽霧與紙張氣味的長廳裡，晨光從港邊窗格斜切進來，像替你的新航路蓋下第一枚印記。",
      ambience: "harbor-office",
      theme: "harbor-ledger-haze",
      themePresetId: "aurelia-harbor-ledger-haze",
      backdrop: { category: "port-scene", id: "amber_gulf-s2" },
      camera: { focusX: 34, focusY: 40, zoom: 1.1 },
      overlay: { category: "event", id: "anchor", position: "right", size: "md", opacity: 0.3 },
      palette: {
        sky: "#7ab4de",
        horizon: "#f2b76a",
        sea: "#12304d",
        accent: "#f4d189",
        glow: "#ffe3a8",
      },
    },
    hotspots: [
      {
        id: "hotspot.harbor_office.desk",
        label: "長桌前的馬瑟斯",
        eventPool: ["event.opening"],
        position: { x: 31, y: 66 },
      },
      {
        id: "hotspot.harbor_office.notice_board",
        label: "公告欄",
        eventPool: ["event.harbor_office.rumor"],
        visibleIf: { kind: "flag", flag: "flag.game_started", value: true },
        position: { x: 74, y: 38 },
      },
    ],
  },
  "scene.aurelia.tavern": {
    id: "scene.aurelia.tavern",
    areaId: "area.aurelia",
    name: "錨與星酒館",
    timeGate: { phases: ["DUSK", "NIGHT"] }, // 傍晚才開始熱鬧
    visual: {
      summary: "橘金燈火映在木桌與玻璃杯上，海員的笑罵與樂聲混在一起，像整座港都的心跳。",
      ambience: "tavern",
      theme: "tavern-hearth-smoke",
      themePresetId: "aurelia-tavern-hearth-smoke",
      backdrop: { category: "port-scene", id: "amber_gulf-s2" },
      camera: { focusX: 56, focusY: 52, zoom: 1.14 },
      overlay: { category: "event", id: "festival", position: "center", size: "lg", opacity: 0.22 },
      palette: {
        sky: "#5e3555",
        horizon: "#f49a58",
        sea: "#241127",
        accent: "#ffc46b",
        glow: "#ffdcb1",
      },
    },
    hotspots: [
      {
        id: "hotspot.tavern.bar",
        label: "吧檯",
        eventPool: ["event.tavern.recruit_bram", "event.tavern.recruit_sera"],
        visibleIf: { kind: "flag", flag: "flag.game_started", value: true },
        position: { x: 33, y: 63 },
      },
      {
        id: "hotspot.tavern.corner_table",
        label: "角落的桌子",
        eventPool: ["event.tavern.crimson_rumor"],
        visibleIf: { kind: "flag", flag: "flag.game_started", value: true },
        position: { x: 72, y: 58 },
      },
    ],
  },
  "scene.aurelia.market": {
    id: "scene.aurelia.market",
    areaId: "area.aurelia",
    name: "中央市場",
    timeGate: { phases: ["DAWN", "DAY"] }, // 只在白天營業
    visual: {
      summary: "帆布棚下堆滿香料、橄欖油與麻布，討價還價聲一路延伸到碼頭邊的風裡。",
      ambience: "market",
      theme: "market-bustle-sails",
      themePresetId: "aurelia-market-bustle-sails",
      backdrop: { category: "port-scene", id: "amber_gulf-s2" },
      camera: { focusX: 62, focusY: 44, zoom: 1.08 },
      overlay: { category: "event", id: "rumor", position: "left", size: "md", opacity: 0.26 },
      palette: {
        sky: "#88bed0",
        horizon: "#f7cd76",
        sea: "#204567",
        accent: "#ffcf5b",
        glow: "#fff0bf",
      },
    },
    hotspots: [
      {
        id: "hotspot.market.stalls",
        label: "貨攤",
        eventPool: ["event.market.first_trade"],
        visibleIf: { kind: "flag", flag: "flag.game_started", value: true },
        position: { x: 34, y: 67 },
      },
      {
        id: "hotspot.market.lookout",
        label: "碼頭瞭望",
        eventPool: ["event.market.crimson_scout"],
        visibleIf: { kind: "flag", flag: "flag.crew_assembled", value: true },
        position: { x: 76, y: 39 },
      },
    ],
  },
};
