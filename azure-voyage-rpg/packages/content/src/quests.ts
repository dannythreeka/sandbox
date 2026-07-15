import type { Quest } from "@azure-voyage-rpg/engine";

/**
 * 主線第一部（docs/28 第一部）+ 佩爾蘭支線的任務宣告。目標判定沿用 M28
 * QuestService「用既有可查詢狀態」的哲學——這裡全部讀事件留下的 flag，
 * 不需要另外的計數器。獎勵已經在完成任務的事件 effect 節點裡直接發放
 * （見 events/*.ts），這裡的 rewards 欄位純粹是任務面板顯示用的文案來源，
 * 引擎不會自動套用它——避免重複發放。
 *
 * 每個 objective 都帶 hint（引路提示），明確告訴玩家「去哪、什麼時候」才能
 * 推進——這是探索型 RPG 最容易卡關的地方（觸發點藏在特定場景 + 特定時段 +
 * 特定前置條件裡，玩家找不到就以為遊戲壞了）。
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
        hint: "中央市場只在白晝營業，點「貨攤」談生意。",
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
        hint: "錨與星酒館黃昏後才開門，到「吧檯」找人（先招舵手，再招帳房）。時間不對就用「等待一段時間」。",
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
        hint: "白晝回到中央市場，班底到齊後那裡會多出「碼頭瞭望」——去查看緋帆團的動向。",
        completeWhen: { kind: "flag", flag: "flag.first_battle_done", value: true },
      },
    ],
    rewards: {},
  },
  "quest.ch4_report_back": {
    id: "quest.ch4_report_back",
    kind: "MAIN",
    title: "序章・尾聲",
    giver: "npc.mathers",
    precondition: { kind: "flag", flag: "flag.first_battle_done", value: true },
    objectives: [
      {
        id: "obj.report_back",
        description: "回港務廳向馬瑟斯覆命",
        hint: "港務廳白晝／黃昏開門，點「長桌前的馬瑟斯」。",
        completeWhen: { kind: "flag", flag: "flag.part_one_complete", value: true },
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
        hint: "頂住緋帆團後，用上方「世界地圖」切到佩爾蘭，再點「老漁夫圖克」。",
        completeWhen: { kind: "flag", flag: "flag.perlan_quest_completed", value: true },
      },
    ],
    rewards: {},
  },
};
