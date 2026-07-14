import type { GameEvent } from "@azure-voyage/rpg-engine";

/** 錨與星酒館：招募班底（docs/28 第三章改編）。 */
export const TAVERN_EVENTS: Record<string, GameEvent> = {
  "event.tavern.recruit_bram": {
    id: "event.tavern.recruit_bram",
    precondition: { kind: "and", all: [{ kind: "flag", flag: "flag.game_started", value: true }, { kind: "not", cond: { kind: "flag", flag: "flag.recruited_bram", value: true } }] },
    weight: 100,
    once: true,
    entryNodeId: "n1",
    nodes: [
      {
        kind: "dialogue",
        id: "n1",
        speaker: "旁白",
        text: "角落坐著一個話少、手上有常年握舵磨出厚繭的漢子，正專注地擦拭一支老舊的六分儀。",
        goto: "check_lead",
      },
      {
        kind: "skillCheck",
        id: "check_lead",
        stat: "lead",
        difficulty: 15,
        onSuccess: "n_win",
        onFailure: "n_hard",
      },
      {
        kind: "dialogue",
        id: "n_win",
        speaker: "布拉姆·霍特",
        text: "「你出海之前，讓我先看一遍你的索具。」他站起身，比你高出半個頭，「你叫什麼？」",
        goto: "n_recruited",
      },
      {
        kind: "dialogue",
        id: "n_hard",
        speaker: "布拉姆·霍特",
        text: "他盯著你看了很久，才慢慢放下六分儀。「補過的帆，逆風時最容易再裂……好吧。我上船。」",
        goto: "n_recruited",
      },
      {
        kind: "effect",
        id: "n_recruited",
        effect: { setFlags: ["flag.recruited_bram"], affinity: [{ npc: "npc.bram", delta: 15 }] },
        goto: "n_close",
      },
      {
        kind: "dialogue",
        id: "n_close",
        speaker: "布拉姆·霍特",
        text: "「掌過三條船的舵，沉過一條——那不是我的錯。走吧。」",
        goto: "END",
      },
    ],
  },
  "event.tavern.recruit_sera": {
    id: "event.tavern.recruit_sera",
    precondition: { kind: "and", all: [{ kind: "flag", flag: "flag.recruited_bram", value: true }, { kind: "not", cond: { kind: "flag", flag: "flag.recruited_sera", value: true } }] },
    weight: 100,
    once: true,
    entryNodeId: "n1",
    nodes: [
      {
        kind: "dialogue",
        id: "n1",
        speaker: "旁白",
        text: "吧檯另一頭，一個帳房出身的女人正把一本磨得起毛邊的帳冊拍在桌上，像是在跟誰賭氣。",
        goto: "check_trade",
      },
      {
        kind: "skillCheck",
        id: "check_trade",
        stat: "trade",
        difficulty: 15,
        onSuccess: "n_win",
        onFailure: "n_hard",
      },
      {
        kind: "dialogue",
        id: "n_win",
        speaker: "賽菈·凡德",
        text: "「鎏金天秤只在乎錢。你會嗎？」她盯著你，等你回答的樣子讓人無處可躲。",
        goto: "n_answer",
      },
      {
        kind: "dialogue",
        id: "n_hard",
        speaker: "賽菈·凡德",
        text: "她皺著眉，把帳冊翻了好幾頁才抬頭。「你這條船，帳算得清楚嗎？」",
        goto: "n_answer",
      },
      {
        kind: "dialogue",
        id: "n_answer",
        speaker: "你",
        text: "「我不知道。但我會盡量不把人當算盤珠子撥。」",
        goto: "n_recruited",
      },
      {
        kind: "effect",
        id: "n_recruited",
        effect: {
          setFlags: ["flag.recruited_sera", "flag.crew_assembled"],
          affinity: [{ npc: "npc.sera", delta: 15 }],
        },
        goto: "n_close",
      },
      {
        kind: "dialogue",
        id: "n_close",
        speaker: "賽菈·凡德",
        text: "「這個回答比『不會』誠實。」她合上帳冊，「我跟你走。」",
        goto: "END",
      },
    ],
  },
  "event.tavern.crimson_rumor": {
    id: "event.tavern.crimson_rumor",
    precondition: { kind: "flag", flag: "flag.game_started", value: true },
    weight: 15,
    once: false,
    cooldownDays: 2,
    entryNodeId: "n1",
    nodes: [
      {
        kind: "dialogue",
        id: "n1",
        speaker: "旁白",
        text: "隔壁桌的水手壓低聲音議論：「聽說緋帆團上個月在灣口劫了一條運鹽船，船上的人一個沒傷，貨卻搬得一乾二淨。」",
        goto: "END",
      },
    ],
  },
};
