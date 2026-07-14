import type { ContentPack, EventNode } from "./types";

function nodeTargets(node: EventNode): string[] {
  switch (node.kind) {
    case "dialogue":
      return [node.goto];
    case "choice":
      return node.options.map((o) => o.goto);
    case "skillCheck":
      return [node.onSuccess, node.onFailure];
    case "effect":
      return [node.goto];
    case "goto":
      return [node.goto];
  }
}

/**
 * 建置期內容檢查（docs/29 §12）：所有 id 引用是否完整、事件節點是否成孤島。
 * 回傳錯誤訊息陣列；空陣列代表內容包合法。
 */
export function validateContent(pack: ContentPack): string[] {
  const errors: string[] = [];

  if (!pack.scenes[pack.startSceneId]) {
    errors.push(`startSceneId 指向不存在的場景: ${pack.startSceneId}`);
  }

  for (const region of Object.values(pack.regions)) {
    for (const areaId of region.areas) {
      if (!pack.areas[areaId]) errors.push(`海域 ${region.id} 引用了不存在的 area: ${areaId}`);
    }
  }

  for (const area of Object.values(pack.areas)) {
    if (!pack.regions[area.regionId]) {
      errors.push(`area ${area.id} 引用了不存在的 region: ${area.regionId}`);
    }
    for (const sceneId of area.scenes) {
      if (!pack.scenes[sceneId]) errors.push(`area ${area.id} 引用了不存在的 scene: ${sceneId}`);
    }
  }

  for (const scene of Object.values(pack.scenes)) {
    if (!pack.areas[scene.areaId]) {
      errors.push(`scene ${scene.id} 引用了不存在的 area: ${scene.areaId}`);
    }
    for (const hotspot of scene.hotspots) {
      for (const eventId of hotspot.eventPool) {
        if (!pack.events[eventId]) {
          errors.push(`scene ${scene.id} 熱點 ${hotspot.id} 引用了不存在的 event: ${eventId}`);
        }
      }
    }
  }

  for (const event of Object.values(pack.events)) {
    const nodeIds = new Set(event.nodes.map((n) => n.id));
    if (!nodeIds.has(event.entryNodeId)) {
      errors.push(`event ${event.id} 的 entryNodeId 找不到對應節點: ${event.entryNodeId}`);
    }
    for (const node of event.nodes) {
      for (const target of nodeTargets(node)) {
        if (target !== "END" && !nodeIds.has(target)) {
          errors.push(`event ${event.id} 節點 ${node.id} 指向不存在的節點: ${target}`);
        }
      }
    }
  }

  for (const quest of Object.values(pack.quests)) {
    if (quest.giver && !pack.npcs[quest.giver]) {
      errors.push(`quest ${quest.id} 引用了不存在的 npc: ${quest.giver}`);
    }
  }

  return errors;
}
