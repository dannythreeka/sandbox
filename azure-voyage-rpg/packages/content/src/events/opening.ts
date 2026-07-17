import type { GameEvent } from "@azure-voyage-rpg/engine";

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
  "event.harbor_office.risk_bulletin": {
    id: "event.harbor_office.risk_bulletin",
    precondition: {
      kind: "and",
      all: [
        { kind: "flag", flag: "flag.game_started", value: true },
        { kind: "flag", flag: "flag.first_trade_done", value: true },
      ],
    },
    weight: 35,
    once: false,
    cooldownDays: 1,
    entryNodeId: "n1",
    nodes: [
      {
        kind: "dialogue",
        id: "n1",
        speaker: "公告欄",
        text: "你發現新貼上的航運告示：『三日內完成物資配送的商會，將獲得下一輪港務靠泊優先權。』旁邊有人補註：『晚到一天，保費翻倍。』",
        goto: "n2",
      },
      {
        kind: "effect",
        id: "n2",
        effect: {
          setFlags: ["flag.risk_bulletin_seen"],
          worldState: [{ path: "crimsonThreat", delta: 1 }],
        },
        goto: "END",
      },
    ],
  },
  "event.harbor_office.part_one_end": {
    id: "event.harbor_office.part_one_end",
    precondition: {
      kind: "and",
      all: [
        { kind: "flag", flag: "flag.first_battle_done", value: true },
        { kind: "not", cond: { kind: "flag", flag: "flag.part_one_complete", value: true } },
      ],
    },
    weight: 200,
    once: true,
    entryNodeId: "n1",
    nodes: [
      {
        kind: "dialogue",
        id: "n1",
        speaker: "馬瑟斯·凡登霍夫",
        text: "「頂住緋帆團一次了？」老人放下手裡的帳冊，難得地正眼看了你很久。「當年拿著半張圖來的那個年輕人，總算活過了第一個風暴季。」",
        goto: "n2",
      },
      {
        kind: "dialogue",
        id: "n2",
        speaker: "馬瑟斯",
        text: "「但這只是開始。緋帆團不會善罷甘休，鐵崖、絹風、子午之海……你父親那半張圖指向的地方，還遠得很。」他把印信推回給你，「去吧。晨汐商會的名字，才剛開始有人記得。」",
        goto: "n3",
      },
      {
        kind: "effect",
        id: "n3",
        effect: { setFlags: ["flag.part_one_complete"] },
        goto: "n_ooc",
      },
      {
        kind: "dialogue",
        id: "n_ooc",
        speaker: "【第一部・完】",
        text: "感謝遊玩《蒼瀾航路：晨汐紀事》的原型。第一部「初出茅廬」到此告一段落——後續章節（跨海域擴張、緋帆團的真正面目、暮色洋盡頭的沉船真相）正在開發中。你隨時可以繼續在琥珀灣走動、探索佩爾蘭，或用右上角「重新開始」再走一遍不同的選擇。",
        goto: "END",
      },
    ],
  },
};
