import type { Scene } from "@azure-voyage-rpg/engine";

export const PERLAN_SCENES: Record<string, Scene> = {
  "scene.perlan.docks": {
    id: "scene.perlan.docks",
    areaId: "area.perlan",
    name: "佩爾蘭碼頭",
    visual: {
      summary: "偏遠小港比奧雷利亞安靜許多，潮水拍著木樁，荒鹽田的白痕在遠處像還沒癒合的舊傷。",
      ambience: "docks",
      theme: "perlan-tide-mist",
      themePresetId: "perlan-tide-mist",
      backdrop: { category: "port-scene", id: "amber_gulf-s2" },
      camera: { focusX: 70, focusY: 46, zoom: 1.12 },
      overlay: { category: "event", id: "storm", position: "right", size: "md", opacity: 0.24 },
      palette: {
        sky: "#7ea0be",
        horizon: "#cfd2cb",
        sea: "#2a425f",
        accent: "#a8d3d1",
        glow: "#dce8ef",
      },
    },
    hotspots: [
      {
        id: "hotspot.perlan.old_fisherman",
        label: "老漁夫圖克",
        eventPool: ["event.perlan.meet_tuk", "event.perlan.saltfield_reopened", "event.perlan.supply_convoy"],
        position: { x: 62, y: 66 },
      },
    ],
  },
};
