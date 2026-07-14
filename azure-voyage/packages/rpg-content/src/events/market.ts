import type { GameEvent } from "@azure-voyage/rpg-engine";

/** 中央市場：第一筆交易（docs/28 第二章改編）與緋帆團初現（第六章改編）。 */
export const MARKET_EVENTS: Record<string, GameEvent> = {
  "event.market.first_trade": {
    id: "event.market.first_trade",
    precondition: { kind: "flag", flag: "flag.game_started", value: true },
    weight: 100,
    once: true,
    entryNodeId: "n1",
    nodes: [
      {
        kind: "dialogue",
        id: "n1",
        speaker: "市場掮客",
        text: "「新來的？」他打量著你，又打量著你那艘船況不佳的縱帆船，「要進貨還是出貨？」",
        goto: "check_trade",
      },
      {
        kind: "skillCheck",
        id: "check_trade",
        stat: "trade",
        difficulty: 15,
        onSuccess: "n_win",
        onFailure: "n_ok",
      },
      {
        kind: "dialogue",
        id: "n_win",
        speaker: "旁白",
        text: "你精準地看穿了對方的報價空間，用低於市價的成本，換到了一船划算的橄欖油。",
        goto: "n_close",
      },
      {
        kind: "dialogue",
        id: "n_ok",
        speaker: "旁白",
        text: "你花了比預期多一點的價錢，但貨到底是進了船艙。帳本上第一筆墨跡，還是落下了。",
        goto: "n_close",
      },
      {
        kind: "effect",
        id: "n_close",
        effect: { setFlags: ["flag.first_trade_done"], advanceTime: 1 },
        goto: "n_end",
      },
      {
        kind: "dialogue",
        id: "n_end",
        speaker: "旁白",
        text: "碼頭的掮客多看了你的船兩眼，壓低聲音議論——「新來的。撐得過這季風暴嗎？」",
        goto: "END",
      },
    ],
  },
  "event.market.crimson_scout": {
    id: "event.market.crimson_scout",
    precondition: {
      kind: "and",
      all: [
        { kind: "flag", flag: "flag.crew_assembled", value: true },
        { kind: "not", cond: { kind: "flag", flag: "flag.first_battle_done", value: true } },
      ],
    },
    weight: 100,
    once: true,
    entryNodeId: "n1",
    nodes: [
      {
        kind: "dialogue",
        id: "n1",
        speaker: "旁白",
        text: "碼頭瞭望台傳來示警的鐘聲——一艘掛著緋紅船帆的武裝快船，正朝著晨汐商會的方向撲來。",
        goto: "n2",
      },
      {
        kind: "choice",
        id: "n2",
        prompt: "布拉姆看著你，等你下令。",
        options: [
          { label: "迎上去，正面周旋", goto: "check_combat" },
          { label: "把船逼進淺水暗礁區，甩開他們", goto: "check_nav" },
        ],
      },
      {
        kind: "skillCheck",
        id: "check_combat",
        stat: "combat",
        difficulty: 25,
        onSuccess: "n_win",
        onFailure: "n_scar",
      },
      {
        kind: "skillCheck",
        id: "check_nav",
        stat: "nav",
        difficulty: 20,
        onSuccess: "n_win",
        onFailure: "n_scar",
      },
      {
        kind: "dialogue",
        id: "n_win",
        speaker: "旁白",
        text: "砲聲停下的時候，甲板上瀰漫著硝煙與海水的氣味。緋帆快船掛著兩道焦痕，不甘地掉頭撤退。",
        goto: "n_effect_win",
      },
      {
        kind: "dialogue",
        id: "n_scar",
        speaker: "旁白",
        text: "海燕號的主帆又裂開了一道口子，但船還浮著，人一個沒少——這是不體面、卻活下來的一仗。",
        goto: "n_effect_scar",
      },
      {
        kind: "effect",
        id: "n_effect_win",
        effect: {
          setFlags: ["flag.first_battle_done", "flag.first_battle_won"],
          worldState: [{ path: "crimsonThreat", delta: 10 }],
          unlock: { areas: ["area.perlan"], scenes: ["scene.perlan.docks"] },
        },
        goto: "n_end",
      },
      {
        kind: "effect",
        id: "n_effect_scar",
        effect: {
          setFlags: ["flag.first_battle_done", "flag.first_battle_fled"],
          worldState: [{ path: "crimsonThreat", delta: 10 }],
          unlock: { areas: ["area.perlan"], scenes: ["scene.perlan.docks"] },
        },
        goto: "n_end",
      },
      {
        kind: "dialogue",
        id: "n_end",
        speaker: "布拉姆",
        text: "「有個人站在船尾一直看著我們，」他抹了把臉上的硝煙，「像在記你的臉。」",
        goto: "END",
      },
    ],
  },
};
