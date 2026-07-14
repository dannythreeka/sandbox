import type { Area, WorldRegion } from "@azure-voyage/rpg-engine";

export const REGIONS: Record<string, WorldRegion> = {
  "region.amber_gulf": {
    id: "region.amber_gulf",
    name: "琥珀灣",
    unlockCondition: { kind: "always" },
    areas: ["area.aurelia", "area.perlan"],
  },
};

export const AREAS: Record<string, Area> = {
  "area.aurelia": {
    id: "area.aurelia",
    regionId: "region.amber_gulf",
    name: "奧雷利亞",
    kind: "PORT",
    unlockCondition: { kind: "always" },
    scenes: ["scene.aurelia.harbor_office", "scene.aurelia.tavern", "scene.aurelia.market"],
  },
  // 佩爾蘭在小說第四章登場——凡恩組好班底、在奧雷利亞站穩腳跟後才順道繞去補鹽。
  // 用 flag.crew_assembled 當解鎖條件，呼應這個敘事順序（見 events/tavern.ts）。
  "area.perlan": {
    id: "area.perlan",
    regionId: "region.amber_gulf",
    name: "佩爾蘭",
    kind: "PORT",
    unlockCondition: { kind: "flag", flag: "flag.crew_assembled", value: true },
    scenes: ["scene.perlan.docks"],
  },
};
