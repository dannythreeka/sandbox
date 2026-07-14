import type { GameEvent } from "@azure-voyage/rpg-engine";

/** 佩爾蘭支線：老漁夫的家傳鹽田（docs/28 第四章改編；docs/27 支線清單）。 */
export const PERLAN_EVENTS: Record<string, GameEvent> = {
  "event.perlan.meet_tuk": {
    id: "event.perlan.meet_tuk",
    precondition: { kind: "always" },
    weight: 100,
    once: true,
    entryNodeId: "n1",
    nodes: [
      {
        kind: "dialogue",
        id: "n1",
        speaker: "旁白",
        text: "一個老人坐在碼頭邊，望著一片荒廢的曬鹽場，眼神空得像退了潮的灘。",
        goto: "n2",
      },
      {
        kind: "dialogue",
        id: "n2",
        speaker: "圖克·佩蘭",
        text: "「這幾年，來收鹽的越來越少了。那本來是全佩爾蘭最好的一塊鹽田，現在雜草比鹽還多。」",
        goto: "n3",
      },
      {
        kind: "choice",
        id: "n3",
        prompt: "你要怎麼回應？",
        options: [
          { label: "「我多收一點——往後每次經過都來補鹽，你把鹽田重新開起來。」", goto: "n_help" },
          { label: "「我只是路過收鹽，幫不上這個忙。」", goto: "n_decline" },
        ],
      },
      {
        kind: "effect",
        id: "n_help",
        effect: { setFlags: ["flag.perlan_help_promised"], affinity: [{ npc: "npc.tuk", delta: 20 }] },
        goto: "n_help_close",
      },
      {
        kind: "dialogue",
        id: "n_help_close",
        speaker: "圖克·佩蘭",
        text: "老人愣住了，隨即露出一個久違的笑：「你圖什麼？外來的商會不會做賠本生意。」你沒有回答，只是笑了笑。",
        goto: "END",
      },
      {
        kind: "effect",
        id: "n_decline",
        effect: { setFlags: ["flag.perlan_declined"], affinity: [{ npc: "npc.tuk", delta: 2 }] },
        goto: "n_decline_close",
      },
      {
        kind: "dialogue",
        id: "n_decline_close",
        speaker: "圖克·佩蘭",
        text: "老人點點頭，沒有多說什麼，只是轉身望向那片荒鹽場，背影比方才更佝僂了一些。",
        goto: "END",
      },
    ],
  },
  "event.perlan.saltfield_reopened": {
    id: "event.perlan.saltfield_reopened",
    precondition: { kind: "flag", flag: "flag.perlan_help_promised", value: true },
    weight: 100,
    once: true,
    entryNodeId: "n1",
    nodes: [
      {
        kind: "dialogue",
        id: "n1",
        speaker: "旁白",
        text: "再訪佩爾蘭，那片荒廢的鹽田已經重新開了起來——圖克把家傳的曬鹽手藝，一點一點教回給村裡的年輕人。",
        goto: "n2",
      },
      {
        kind: "dialogue",
        id: "n2",
        speaker: "圖克·佩蘭",
        text: "「這是頭一鍋。」老人往你手裡塞了一小袋雪白的鹽，「海給的東西，第一口最鮮。往後不管你在哪片海上，嚐到這口鹹，就想起佩爾蘭還有個老頭記著你。」",
        goto: "n_close",
      },
      {
        kind: "effect",
        id: "n_close",
        effect: {
          setFlags: ["flag.perlan_quest_completed"],
          giveItem: ["item.perlan_salt"],
          reputation: [{ area: "area.perlan", delta: 10 }],
        },
        goto: "END",
      },
    ],
  },
};
