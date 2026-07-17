import type { Quest } from "@azure-voyage-rpg/engine";

/**
 * 主線第一部（docs/28 第一部）+ 佩爾蘭支線的任務宣告。目標判定沿用 M28
 * QuestService「用既有可查詢狀態」的哲學——這裡全部讀事件留下的 flag，
 * 不需要另外的計數器。獎勵已經在完成任務的事件 effect 節點裡直接發放
 * （見 events/*.ts），這裡的 rewards 欄位純粹是任務面板顯示用的文案來源，
 * 引擎不會自動套用它——避免重複發放。
 */
export const QUESTS: Record<string, Quest> = {
  "quest.ch1_first_trade": {
    id: "quest.ch1_first_trade",
    kind: "MAIN",
    title: "初出茅廬",
    giver: "npc.mathers",
    precondition: { kind: "flag", flag: "flag.game_started", value: true },
    objectives: [
      {
        id: "obj.first_trade",
        description: "在中央市場完成第一筆交易",
        completeWhen: { kind: "flag", flag: "flag.first_trade_done", value: true },
      },
    ],
    rewards: {},
  },
  "quest.ch2_crew": {
    id: "quest.ch2_crew",
    kind: "MAIN",
    title: "組建班底",
    giver: "npc.mathers",
    precondition: { kind: "flag", flag: "flag.game_started", value: true },
    objectives: [
      {
        id: "obj.recruit_crew",
        description: "在錨與星酒館招募滿 2 名班底",
        completeWhen: { kind: "flag", flag: "flag.crew_assembled", value: true },
      },
    ],
    rewards: {},
  },
  "quest.ch3_first_battle": {
    id: "quest.ch3_first_battle",
    kind: "MAIN",
    title: "海上見真章",
    giver: "npc.mathers",
    precondition: { kind: "flag", flag: "flag.crew_assembled", value: true },
    objectives: [
      {
        id: "obj.first_battle",
        description: "頂住緋帆團的第一次試探",
        completeWhen: { kind: "flag", flag: "flag.first_battle_done", value: true },
      },
    ],
    rewards: {},
  },
  "quest.side_perlan": {
    id: "quest.side_perlan",
    kind: "SIDE",
    title: "老漁夫的家傳鹽田",
    giver: "npc.tuk",
    precondition: { kind: "flag", flag: "flag.perlan_help_promised", value: true },
    objectives: [
      {
        id: "obj.reopen_saltfield",
        description: "再訪佩爾蘭，看看鹽田重開的結果",
        completeWhen: { kind: "flag", flag: "flag.perlan_quest_completed", value: true },
      },
    ],
    rewards: {},
  },
  "quest.side_supply_line": {
    id: "quest.side_supply_line",
    kind: "SIDE",
    title: "商會補給線",
    giver: "npc.sera",
    precondition: {
      kind: "and",
      all: [
        { kind: "flag", flag: "flag.first_trade_done", value: true },
        { kind: "flag", flag: "flag.crew_assembled", value: true },
      ],
    },
    objectives: [
      {
        id: "obj.sign_supply_contract",
        description: "在中央市場簽下第一份穩定補給單",
        completeWhen: { kind: "flag", flag: "flag.supply_contract_signed", value: true },
      },
      {
        id: "obj.finish_crew_drill",
        description: "在酒館完成一次夜間班底演練",
        completeWhen: { kind: "flag", flag: "flag.crew_drill_done", value: true },
      },
      {
        id: "obj.secure_perlan_convoy",
        description: "護送佩爾蘭補給船隊安全返港",
        completeWhen: { kind: "flag", flag: "flag.perlan_convoy_secured", value: true },
      },
    ],
    rewards: {},
  },
};
