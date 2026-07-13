/**
 * 主線任務章節（M28，往大航海時代靠近：讓遊戲從純沙盒經營多一條有推進感的
 * 敘事骨架）。原創單一主線，不分主角/分支——單一商會從初出茅廬到名留蒼瀾的
 * 六個章節。每章目標刻意選成「用既有可查詢狀態就能判定完成」，不需要額外的
 * 行動計數器（見 apps/api QuestService 的判定邏輯）。
 */
export interface QuestChapter {
  id: string;
  title: string;
  /** 玩家在任務面板看到的目標描述 */
  objective: string;
  /** 完成時的原創過場敘事文字 */
  narrative: string;
  goldReward: number;
  fameReward: number;
}

export const QUEST_CHAPTERS: QuestChapter[] = [
  {
    id: "ch1",
    title: "初出茅廬",
    objective: "完成第一筆交易，讓商會的名字開始在琥珀灣流傳",
    narrative:
      "帳本上第一筆墨跡未乾，碼頭的掮客已經開始打聽你的名字。這只是開始——" +
      "蒼瀾海域從不缺野心勃勃的新面孔，能走多遠，看的是接下來的每一個決定。",
    goldReward: 500,
    fameReward: 5,
  },
  {
    id: "ch2",
    title: "組建班底",
    objective: "艦隊招募滿 2 名航海士",
    narrative:
      "一個人跑不動整支商隊。甲板上多了幾張新面孔，帳房與瞭望台都有人可用了——" +
      "從今以後，這艘船承載的不再只是貨物，還有一群把身家性命都押在你判斷上的人。",
    goldReward: 800,
    fameReward: 5,
  },
  {
    id: "ch3",
    title: "海上見真章",
    objective: "贏得一場海戰",
    narrative:
      "砲聲停了，甲板上瀰漫著硝煙與海水的氣味。這是你的艦隊第一次在敵人的砲口下" +
      "全身而退並取勝——消息會傳開，海賊們以後看到你的旗幟，得多想一想。",
    goldReward: 1200,
    fameReward: 10,
  },
  {
    id: "ch4",
    title: "站穩腳跟",
    objective: "在任一海域的港口取得 20% 以上的影響力",
    narrative:
      "港務長開始主動向你通報行情，市場裡也有人願意賒帳做生意了。這不是偶然——" +
      "是你一趟趟航行、一筆筆交易換來的地位。蒼瀾海域終於有了屬於你的一角。",
    goldReward: 2000,
    fameReward: 15,
  },
  {
    id: "ch5",
    title: "海道先驅",
    objective: "商會總資產達到 100,000 金幣",
    narrative:
      "十萬金幣——足夠買下一支像樣的艦隊，也足夠讓其他商會坐下來跟你談條件。" +
      "從初次啟航到如今，你已經不再是那個只能跑短程貿易糊口的新手船長了。",
    goldReward: 4000,
    fameReward: 20,
  },
  {
    id: "ch6",
    title: "蒼瀾傳說",
    objective: "達成任一正式勝利條件（海域霸權／總資產／傳世遺物）",
    narrative:
      "史官已經提筆——不論你是靠鐵腕拿下了海域的霸權、靠精明的算計堆起了無人能及" +
      "的財富，還是靠不懈的探索找齊了傳世遺物，蒼瀾海域都會記得這個名字。你的故事，" +
      "從碼頭上那第一筆墨跡未乾的帳，走到了這裡。",
    goldReward: 0,
    fameReward: 50,
  },
];
