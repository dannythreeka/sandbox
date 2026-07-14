import type { GameEvent } from "@azure-voyage/rpg-engine";

/** 開場（docs/28 楔子改編）：港務廳掛名入行，取得起始委託。 */
export const OPENING_EVENTS: Record<string, GameEvent> = {
  "event.opening": {
    id: "event.opening",
    precondition: { kind: "always" },
    weight: 100,
    once: true,
    entryNodeId: "n1",
    nodes: [
      {
        kind: "dialogue",
        id: "n1",
        speaker: "旁白",
        text: "奧雷利亞的清晨，是從鹽與松脂的氣味裡醒來的。你把父親留下的半張殘圖攤在港務廳的長桌上，指尖還在抖。",
        goto: "n2",
      },
      {
        kind: "dialogue",
        id: "n2",
        speaker: "馬瑟斯·凡登霍夫",
        text: "「這種東西，我這輩子見過不下二十張。每一個拿著它來的人，都覺得自己跟別人不一樣。」",
        goto: "n3",
      },
      {
        kind: "choice",
        id: "n3",
        prompt: "你要怎麼回應？",
        options: [
          { label: "「那我就證明給你看。」", goto: "n_confident" },
          { label: "什麼也不說，只是把圖收好", goto: "n_quiet" },
        ],
      },
      {
        kind: "dialogue",
        id: "n_confident",
        speaker: "馬瑟斯",
        text: "老人看了你一眼，像是看慣了做夢的年輕人，卻沒有嘲笑的意思。「口氣不小。」",
        goto: "n4",
      },
      {
        kind: "dialogue",
        id: "n_quiet",
        speaker: "馬瑟斯",
        text: "老人沒有追問，只是把一枚黃銅印信推過長桌。「不愛說話的人，通常撐得比較久。」",
        goto: "n4",
      },
      {
        kind: "dialogue",
        id: "n4",
        speaker: "馬瑟斯",
        text: "「一艘縱帆船，停在西三號泊位，船況不算好。名字你自己取——晨汐商會，就這麼定了。」",
        goto: "n5",
      },
      {
        kind: "effect",
        id: "n5",
        effect: { setFlags: ["flag.game_started"], advanceTime: 1 },
        goto: "n6",
      },
      {
        kind: "dialogue",
        id: "n6",
        speaker: "馬瑟斯",
        text: "「對了——最近別往灣口外面太遠的地方跑。緋帆團的巡哨船，這陣子出沒得勤。」",
        goto: "END",
      },
    ],
  },
  "event.harbor_office.rumor": {
    id: "event.harbor_office.rumor",
    precondition: { kind: "flag", flag: "flag.game_started", value: true },
    weight: 20,
    once: false,
    cooldownDays: 2,
    entryNodeId: "n1",
    nodes: [
      {
        kind: "dialogue",
        id: "n1",
        speaker: "公告欄",
        text: "貼著幾張懸賞與航運告示，其中一張被人用炭筆潦草地補了一行字：「緋帆團又在灣口攔船了，各家船長自己小心。」",
        goto: "END",
      },
    ],
  },
};
