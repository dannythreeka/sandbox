import type { Scene } from "@azure-voyage-rpg/engine";

export const PERLAN_SCENES: Record<string, Scene> = {
  "scene.perlan.docks": {
    id: "scene.perlan.docks",
    areaId: "area.perlan",
    name: "佩爾蘭碼頭",
    hotspots: [
      {
        id: "hotspot.perlan.old_fisherman",
        label: "老漁夫圖克",
        eventPool: ["event.perlan.meet_tuk", "event.perlan.saltfield_reopened"],
      },
    ],
  },
};
