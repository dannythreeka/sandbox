# 29 — Azure Voyage RPG：敘事探索框架設計（Narrative Exploration RPG Framework）

> 依使用者願景，以《蒼瀾航路》小說（docs/28）與世界觀為底，設計一套完整、
> 可維護、支撐多周目與多結局的 **RPG 框架**。核心定位是「探索型劇情 RPG」
> ——不是刷怪升級，而是：**探索世界 → 遇見人物 → 做選擇 → 影響世界 →
> 解開真相**。
>
> 本文是設計提案（尚未實作），目的是把使用者的玩法構想「提升一層」成一套
> 可套用的框架：日後新增任何港口、人物、章節，都直接套同一套資料模型與
> 事件引擎，而不是每次重寫流程。
>
> **重要對映原則**：使用者舉的通用例子（王都／森林／天空都市／皇宮／黑市…）
> 在本文全部翻譯成蒼瀾海域的既有原創設定（奧雷利亞／暮色洋／港務廳／夜間
> 黑市碼頭…），並盡量復用既有系統（提督五維 M27、發現物 M22、NPC 商會、
> tick/季節、影響力/聲望），而不是另造一套。

---

## 0. 定位與設計理念

### 0.1 這是一款「新遊戲」，但共用同一個世界

現有的《蒼瀾航路》(apps/web + apps/api) 是**即時沙盒經營模擬**：航行、貿易、
影響力、海戰、勝利條件。它的核心動詞是「經營」。

`azure-voyage-rpg` 是**敘事探索 RPG**：核心動詞是「探索與抉擇」。兩者共用
同一個世界觀、人物、美術、敘事資產（`packages/shared` 的 regions/ports/
notables/discoveries/commodities/小說文本），但玩法內核完全不同。

因此**不改動現有沙盒遊戲**，而是新開一條線：

```
packages/
  shared/          # 既有：世界觀/內容/規則（兩款遊戲共用）
  rpg-engine/      # 新增：純框架（無內容）——世界狀態機、事件引擎、判定、存檔
  rpg-content/     # 新增：蒼瀾世界的 RPG 內容包（Scene/Event/NPC/Quest 宣告式資料）
apps/
  web/             # 既有：沙盒經營版
  api/             # 既有：沙盒後端
  rpg/             # 新增：RPG 前端（可先做純前端 + 本地存檔，後端後補）
```

`rpg-engine` 對內容一無所知——它只認資料結構。所有蒼瀾世界的具體內容（哪個
港口有酒館、酒館裡有什麼事件、柯爾的好感門檻）都在 `rpg-content` 裡宣告。
**這是「框架」與「內容」分離的關鍵**：換一套內容包，同一個引擎可以跑另一個
世界的 RPG。

### 0.2 設計理念的拆解（參考作品 → 蒼瀾映射）

不照抄任何作品，只借用它們被驗證過的設計理念：

| 參考理念 | 來源 | 蒼瀾如何用 |
|---|---|---|
| 事件驅動的地點探索 | 活俠傳 | 每個場景是「事件池」，反覆造訪抽出不同事件，地點永遠有新東西 |
| 技能判定即敘事（成功/失敗都推進） | Disco Elysium | 用提督五維（統率/航海/戰鬥/交易/見聞）做判定，失敗不是 game over 而是另一條敘事岔路 |
| 世界狀態隨時間/選擇改變 | Pentiment | World State 骨架：政治/環境/陣營三軸，同一港口在不同狀態下是不同的地方 |
| 資源與時間的壓力 | Citizen Sleeper | 時間一直流動，拖延會讓世界狀態惡化（緋帆團擴張），行動有機會成本 |

### 0.3 三大支柱

1. **開放但漸進**：世界是開放的，但不是一開始全部能去。隨劇情/世界狀態解鎖
   新海域、新港口、新場景。
2. **世界會自己變**：主線不逼玩家，但時間流動 + World State 讓世界持續演化。
   拖太久，緋帆團會擴張、海域會出現異象、某些人物會離開或死去。
3. **多周目揭真相**：第一周目玩家像凡恩一樣一無所知；後續周目保留「世界知識」
   與「殘圖線索」，能直接觸發第一周目看不到的事件，導向真結局。

---

## 1. 三層世界架構（World / Area / Scene）

使用者的三層設計完全採納，映射到蒼瀾海域：

### 第一層・World Map（世界地圖）= 7 海域

節點是 7 大海域，玩家在世界地圖上選擇要去的海域。一開始只開放琥珀灣，其餘
隨劇情/探索解鎖。

```
                    暮色洋（終局・封鎖中）
                        │
        ┌───────────────┼───────────────┐
     北環海          子午之海          珊瑚環弧
        │               │               │
     琥珀灣 ●────────鐵崖海岸────────絹風海峽
     (起點)
```

World Map 只負責四件事：**移動、顯示已開放海域、顯示任務位置、顯示事件標記**。
它不需要很大——蒼瀾的世界地圖沿用既有 hex 海圖的「海域縮略圖」即可。

### 第二層・Area（區域）= 15 港口 + 野外海域

進入一個海域後，看到該海域的「地點清單」。以琥珀灣為例：

```
琥珀灣
─────────────
● 奧雷利亞（首府・起點）
● 米倫港（工藝重鎮）
○ 佩爾蘭（漁村・需解鎖）
◇ 灣區暗流（野外・發現物）
─────────────
```

每個港口是一個 Area。Area 也可以是「野外海域」（對應使用者的「森林/沙漠」），
野外 Area 有**探索度**（見 §9），探索越深開放越多子地點與發現物。

### 第三層・Scene（場景）= 港口內的具體地點

進入 Area（港口）後，看到該港口的場景清單。以奧雷利亞（對映使用者的「王都」）
為例：

```
奧雷利亞
─────────────
▶ 港務廳      （對映：皇宮——白天開，馬瑟斯在此）
▶ 錨與星酒館   （對映：酒館——招募航海士、情報、人物事件）
▶ 中央市場     （對映：市場——交易、NPC、告示）
▶ 工坊區       （對映：教堂/工匠——玻璃/釀酒工坊）
▶ 漁人巷       （對映：貧民區——底層人物、支線）
▶ 黑市碼頭     （對映：黑市——夜間開，走私情報）
▶ 離港
─────────────
```

每個 Scene 內有可互動的「熱點」（人物、告示欄、酒桌、二樓…），點不同熱點觸發
不同事件——這就是使用者描述的「踩不同地方觸發不同事件」。

### 資料模型

```ts
interface WorldRegion {          // 第一層節點
  id: string;                    // "region.amber_gulf"（復用既有 region id）
  name: string;
  unlockCondition: Condition;    // 解鎖條件（見 §3 Condition）
  areas: string[];               // Area id 列表
}

interface Area {                 // 第二層
  id: string;                    // "area.aurelia"
  regionId: string;
  name: string;
  kind: "PORT" | "WILDERNESS";
  unlockCondition: Condition;
  scenes: string[];              // Scene id 列表
  exploration?: ExplorationTrack;// 野外才有（見 §9）
}

interface Scene {                // 第三層
  id: string;                    // "scene.aurelia.anchor_star_tavern"
  areaId: string;
  name: string;
  hotspots: Hotspot[];           // 可互動熱點
  timeGate?: TimeWindow;         // 場景是否只在特定時段開（見 §7）
}

interface Hotspot {
  id: string;                    // "hotspot.tavern.bulletin_board"
  label: string;                 // "公告欄"
  eventPool: string[];           // 綁定的事件 id 池（見 §4）
}
```

---

## 2. World State（世界狀態）—— 整個遊戲的骨架

這是使用者特別強調的核心系統，也是本框架最重要的設計決策：**用「世界狀態」
而非「大量離散 Flag」當骨架**。

### 2.1 為什麼

純 Flag（幾百個布林值）會讓「同一座城市在不同時間點呈現不同樣貌」的邏輯散落
在無數 `if flag_a && flag_b && !flag_c` 裡，難維護、難推理、難支撐多周目。

World State 把世界抽象成**少數幾條連續/多值的軸**，每個重要事件推動這些軸，
場景/NPC/商店只需要讀「當前世界狀態」就能決定自己的樣貌。

### 2.2 蒼瀾的世界狀態軸

```ts
interface WorldState {
  // ── 政治軸：緋帆團 vs 秩序 ──
  crimsonThreat: number;         // 0–100 緋帆團威脅度。拖延/失敗上升，反擊下降
  guildOrder: Record<GuildId, number>; // 五大商會各自的影響力（0–100）

  // ── 環境軸：海域異象 ──
  seaOmen: "CALM" | "STIRRING" | "AWAKENED"; // 暮色洋異象階段（靜止之星劇情）
  regionCorruption: Record<RegionId, number>; // 各海域「異變/危險」程度

  // ── 真相軸：海賊王之謎的揭露進度 ──
  truthProgress: number;         // 0–5 對應小說線索：0未知→半圖→拼圖→星象→真相→終焉

  // ── 玩家立場軸 ──
  playerReputation: Record<AreaId, number>; // 各港口聲望（見 §10）
  playerStance: "TRADER" | "AVENGER" | "SEEKER"; // 傾向，影響結局分歧
}
```

### 2.3 世界狀態如何改變場景

同一個「奧雷利亞中央市場」場景，在不同世界狀態下是不同的地方：

```
crimsonThreat < 30   → 市場繁榮，NPC 談生意，物價正常
crimsonThreat 30–70  → 市場蕭條，NPC 談緋帆團劫掠，物價上漲，出現難民 NPC
crimsonThreat > 70   → 市場半封閉，出現緋帆團眼線，部分商店關門
seaOmen == AWAKENED  → 市場出現「靜止之星」異象傳聞的 NPC 與新事件
```

實作上，Scene 的 hotspot 事件池會依 World State 過濾——不需要為每種狀態寫死
一個場景，而是同一個場景「讀狀態、抽對應事件」。

---

## 3. Flag / 進度系統（與 World State 分工）

World State 管「連續/多值的世界大勢」；**Flag 管「離散的劇情里程碑」**——某件
事發生了沒、認不認識某人、某物拿到了沒。兩者分工明確。

```ts
type FlagId = string;            // "flag.met_kohl", "flag.map_assembled"
type FlagStore = Set<FlagId>;    // 存在即 true（一次性、不可逆的劇情事實）

// 統一的條件判定式——事件/場景/NPC/任務全部用它決定「能不能觸發/顯示」
type Condition =
  | { kind: "flag"; flag: FlagId; value: boolean }
  | { kind: "worldState"; path: string; op: ">=" | "<=" | "=="; value: number | string }
  | { kind: "affinity"; npc: NpcId; op: ">="; value: number }
  | { kind: "stat"; stat: CaptainStat; op: ">="; value: number }
  | { kind: "reputation"; area: AreaId; op: ">="; value: number }
  | { kind: "time"; window: TimeWindow }
  | { kind: "exploration"; area: AreaId; op: ">="; value: number }
  | { kind: "and"; all: Condition[] }
  | { kind: "or"; any: Condition[] }
  | { kind: "not"; cond: Condition };
```

**命名規範**：`flag.<動詞>_<對象>`（`flag.met_kohl`、`flag.assembled_map`、
`flag.heard_pirate_king_truth`）。World State 路徑用點記法
（`worldState.crimsonThreat`、`worldState.seaOmen`）。

這個統一的 `Condition` 型別是整個框架的黏合劑——所有系統都用同一套條件語言，
內容作者只需學一次。

---

## 4. 事件系統（Event Engine）—— 框架的心臟

### 4.1 事件池與抽選

每個 hotspot 綁定一個事件池。玩家點熱點時，引擎：

1. 過濾出所有 `precondition` 成立、且沒有被冷卻/一次性擋掉的事件
2. 依權重加權隨機抽一個（或依 priority 取最高優先）
3. 執行該事件的流程
4. 套用事件的 effects（改 Flag / World State / 好感 / 聲望 / 時間）

這實現了使用者要的「酒館永遠有東西看」——事件池 + 條件過濾，讓同一個地點
隨進度不斷吐出新內容。

### 4.2 事件定義 schema

```ts
interface GameEvent {
  id: string;                    // "event.bassoro.meet_kohl"
  precondition: Condition;       // 何時可觸發
  weight: number;                // 加權隨機（priority 事件可設極高）
  once: boolean;                 // 是否一次性
  cooldown?: number;             // 幾個時間單位內不重複
  nodes: EventNode[];            // 事件流程節點（對話/選項/判定/結果）
  entryNodeId: string;
}

type EventNode =
  | DialogueNode                 // 一段對白/旁白，可帶立繪
  | ChoiceNode                   // 玩家選項分支
  | SkillCheckNode               // 技能判定（見 §8）
  | EffectNode                   // 套用後果
  | GotoNode;                    // 跳到另一節點或結束

interface ChoiceNode {
  kind: "choice";
  id: string;
  prompt: string;
  options: {
    label: string;
    visibleIf?: Condition;       // 選項是否顯示（例：好感夠才出現的選項）
    goto: string;                // 選了跳到哪個節點
  }[];
}

interface Effect {               // 事件後果——如何改變世界
  setFlags?: FlagId[];
  worldState?: { path: string; delta?: number; set?: number | string }[];
  affinity?: { npc: NpcId; delta: number }[];
  reputation?: { area: AreaId; delta: number }[];
  unlock?: { areas?: AreaId[]; scenes?: SceneId[] };
  advanceTime?: number;
  giveItem?: ItemId[];
}
```

### 4.3 完整範例：巴索羅初遇柯爾（小說第十章改編）

這一段展示框架如何把小說的一個場景變成可玩事件——含技能判定與世界狀態依賴：

```ts
{
  id: "event.bassoro.meet_kohl",
  precondition: {
    kind: "and", all: [
      { kind: "flag", flag: "flag.reached_bassoro", value: true },
      { kind: "not", cond: { kind: "flag", flag: "flag.met_kohl", value: true } },
    ],
  },
  weight: 100, once: true,
  entryNodeId: "n1",
  nodes: [
    { kind: "dialogue", id: "n1",
      speaker: "旁白",
      text: "酒館最裡面的角落，坐著一個一言不發的老人。別人都在吹噓當年戰績，只有他的眼睛，比整間酒館加起來都清醒。",
      goto: "n2" },
    { kind: "choice", id: "n2", prompt: "你要？",
      options: [
        { label: "上前搭話", goto: "check_read" },
        { label: "先靜靜坐在他旁邊，陪他沉默", goto: "n_silence" },
      ] },
    // 見聞判定：讀懂該不該開口
    { kind: "skillCheck", id: "check_read",
      stat: "lore", difficulty: 40,
      onSuccess: "n_silence",   // 見聞高：直覺選對了，等於陪坐
      onFailure: "n_rebuff" },
    { kind: "dialogue", id: "n_silence",
      speaker: "柯爾·巴索",
      text: "『你不像來喝酒的。』老人終於側過頭看了你一眼。",
      goto: "e_met" },
    { kind: "dialogue", id: "n_rebuff",
      speaker: "柯爾·巴索",
      text: "老人瞥了你一眼，重新盯著酒杯。『年輕人，這裡的酒不招待急性子。』",
      goto: "e_met_cold" },
    { kind: "effect", id: "e_met",
      effect: { setFlags: ["flag.met_kohl"], affinity: [{ npc: "npc.kohl", delta: 15 }] },
      goto: "END" },
    { kind: "effect", id: "e_met_cold",
      effect: { setFlags: ["flag.met_kohl"], affinity: [{ npc: "npc.kohl", delta: 5 }] },
      goto: "END" },
  ],
}
```

同一個引擎，日後要加「凱什瓦初遇蕾希瑪」只是再寫一份這樣的宣告式資料——
**不碰任何引擎程式碼**。這就是框架的價值。

---

## 5. NPC 與好感度系統

### 5.1 資料模型

```ts
interface Npc {
  id: string;                    // "npc.kohl"（復用既有 port notable / 小說人物）
  name: string;
  portrait: string;              // 復用既有立繪資產
  homeScene: string;             // 常駐場景
  schedule?: ScheduleEntry[];    // 依時段/世界狀態出現在不同場景
  affinityTiers: AffinityTier[]; // 好感階段解鎖的事件
}

interface ScheduleEntry {
  when: Condition;               // 例：{ time: 夜晚 } 或 { worldState.crimsonThreat >= 70 }
  scene: string;                 // 這個條件下 NPC 在哪
}

interface AffinityTier {
  threshold: number;             // 0/20/40/60/80/100
  unlockEvents: string[];        // 達到此好感解鎖的事件
}
```

### 5.2 蒼瀾人物映射（好感度階段）

沿用小說既有人物聲音。以柯爾為例（他是主線關鍵 NPC）：

```
好感 0   ：初遇，沉默寡言
好感 20  ：願意閒聊當年海上見聞
好感 40  ：透露他曾在「某艘船」上當舵手
好感 60  ：支線《柯爾的試探》開放
好感 80  ：鬆口海賊王沉船線索第一段（設 flag.kohl_hint_1）
好感 100 ：說出完整真相（真結局關鍵，設 flag.heard_pirate_king_truth）
```

15 位港口人物 + 班底（布拉姆/賽菈）+ 三位主線關鍵（柯爾/賽菈斐娜/奧丁）+ 反派
維岡，全部套同一個模型。好感透過事件選項、支線完成、送禮（既有商品）累積。

---

## 6. 任務系統

```ts
interface Quest {
  id: string;
  kind: "MAIN" | "SIDE" | "HIDDEN" | "TIMED";
  giver?: NpcId;
  precondition: Condition;
  objectives: Objective[];       // 有序或無序目標
  deadline?: { at: number; onExpire: Effect }; // TIMED 專用（見 §7）
  rewards: Effect;               // 完成後果（金/聲望/好感/解鎖/flag）
}

interface Objective {
  id: string;
  description: string;
  completeWhen: Condition;       // 用統一條件語言判定完成——沿用 M28 QuestService 哲學
}
```

### 蒼瀾任務映射

- **主線（MAIN）**：小說三部/既有 6 章，重寫成事件鏈。每章 objective 沿用既有
  可查詢狀態（第一筆交易、招募 2 名航海士、贏一場海戰…），完成推動 `truthProgress`。
- **支線（SIDE）**：小說裡的 12 則港口支線（佩爾蘭鹽田、塔恩維克龍骨、絹風關稅、
  珊瑚環弧潛水…），各綁一位港口人物，獎勵沿用既有機制（金/聲望/稀有航海士/折扣）。
- **隱藏（HIDDEN）**：三條真結局支線（柯爾/賽菈斐娜/奧丁），需高好感 + 特定
  world state 才開放，全通才觸發真結局。
- **限時（TIMED）**：世界狀態驅動——例如「緋帆團圍攻佩爾蘭」在 Day N 前不馳援
  就失去該港聲望並推高 `crimsonThreat`。呼應使用者的「Day 30 王都被攻擊」。

---

## 7. 時間系統

```ts
interface GameClock {
  day: number;
  phase: "DAWN" | "DAY" | "DUSK" | "NIGHT"; // 時段
  season: Season;                // 復用既有 SPRING/SUMMER/AUTUMN/WINTER
}
```

- **時間流動**：移動、探索、觸發事件、休息都消耗時間（推進 phase/day）。
- **時段閘門**：場景/NPC 依時段變化——白天港務廳開（馬瑟斯在）、夜晚黑市碼頭開
  （走私情報）。對映使用者的「白天皇宮、夜晚黑市」。
- **季節**：復用既有季風/天氣系統，某些發現物/事件只在特定季節開放。
- **截止事件**：TIMED 任務 + World State 惡化。**拖太久世界會變**——這是使用者
  強調的機制：主線不逼你，但 `crimsonThreat` 會隨時間緩升，到閾值觸發「緋帆團
  擴張」的世界事件，關閉某些機會、開啟另一些。

---

## 8. 能力判定與（輕）戰鬥

**核心原則**：以劇情與策略驅動，不刷怪升級。判定用**提督五維**（復用 M27）：

```ts
type CaptainStat = "lead" | "nav" | "combat" | "trade" | "lore";
// 統率 / 航海 / 戰鬥 / 交易 / 見聞

interface SkillCheckNode {
  kind: "skillCheck";
  stat: CaptainStat;
  difficulty: number;            // 對照玩家該維數值 + 隨機擾動
  modifierFrom?: Condition[];    // 情境加成（有柯爾同行 combat +10…）
  onSuccess: string;             // 成功跳轉節點
  onFailure: string;             // 失敗跳轉節點（不是死亡，是另一條敘事）
}
```

- **判定即敘事**（Disco Elysium 理念）：`combat 35 / 需求 40 → 失敗`，但失敗只是
  導向另一段劇情（受傷、丟臉、被迫用別的辦法），不是 game over。
- **五維各有敘事分工**：統率（帶隊/服眾）、航海（風浪/暗礁/導航）、戰鬥（威懾/
  自保）、交易（議價/識破詐術）、見聞（解謎/讀懂人心/辨識發現物）。
- **輕量策略戰鬥**：海戰保留為「少量、有份量」的關鍵戰（可簡化復用既有 battle
  系統或做成回合判定序列），不是隨機遭遇刷經驗。大部分「衝突」用技能判定解決。
- **成長**：五維透過「做選擇、完成事件」成長（呼應小說裡凡恩從見習船長一路成長
  的稱謂變化），而非殺怪 XP。

---

## 9. 探索度系統

野外 Area 不是踩一次就完，而是有 0–100% 探索度，門檻解鎖事件與發現物（復用
既有 M22 discoveries）。

```ts
interface ExplorationTrack {
  progress: number;              // 0–100
  milestones: {
    at: number;                  // 30 / 60 / 90 / 100
    reveal: { scenes?: SceneId[]; discoveries?: DiscoveryId[]; events?: EventId[] };
  }[];
}
```

映射使用者的「森林 30% 找到湖泊 / 60% 精靈村 / 90% 古神祭壇」：

```
暮色洋・靜水海域
  30% → 發現「低吟海流」（既有 C 級發現物）
  60% → 發現「琉璃暗礁群」（既有 B 級）
  90% → 靜止之星觀測點顯現（既有 S 級，需 lore 判定）
 100% → 解鎖沉船座標事件（truthProgress 推進的關鍵）
```

探索靠時間 + 航海判定推進，越深越危險（`regionCorruption` 影響判定難度）。

---

## 10. 聲望系統

每個港口/海域有玩家聲望，復用既有影響力/fame 概念：

```
聲望高 → 物價優惠、港務廳/秘密場景開放、專屬支線、NPC 主動給情報
聲望低 → 物價上漲、被緋帆團眼線盯上、部分場景封閉、觸發追捕事件
```

聲望透過支線、交易、事件選擇累積或流失，直接餵進 World State 的
`playerReputation`，並作為條件被場景/事件讀取。

---

## 11. 多周目與結局系統

### 11.1 四結局（沿用小說正史 + 三外傳）

```ts
type Ending =
  | "LEGEND_END"    // 傳說終焉（真結局，需 truthProgress==5 + 三隱藏支線全通）
  | "SEA_SOVEREIGN" // 海道霸主（REGION_DOMINANCE 傾向）
  | "GILDED_EMPIRE" // 金融霸業（ASSET 傾向）
  | "SUNSET_GUILD"; // 落日商會（失敗/破產傾向）
```

結局由 `playerStance` + `truthProgress` + 隱藏支線完成度決定，對映小說已寫好的
四種收尾文本（docs/28 正史 + 三外傳可直接作為結局過場）。

### 11.2 多周目（New Game+）

```ts
interface CarryOver {
  worldKnowledge: FlagId[];      // 保留「已知真相」——第二周目直接看得懂某些事件
  mapClues: boolean;             // 保留殘圖線索——可提早拼圖
  unlockedTrueRoute: boolean;    // 真結局路線是否已解鎖
  statFloor?: Partial<Record<CaptainStat, number>>; // 保留部分能力下限
}
```

映射使用者的構想：第一周目看到「奇怪石碑」看不懂；第二周目（帶著 worldKnowledge）
直接觸發破解事件。多周目不是重玩，是**用新視角揭開第一周目錯過的真相層**——
這正好契合小說「海賊王沉船的真相要層層揭開」的敘事。

---

## 12. 內容創作格式（Content Authoring）

框架的終極目標：**新增任何城市、角色、章節，只寫宣告式內容，不碰引擎**。

`packages/rpg-content` 的結構：

```
rpg-content/
  regions/          # WorldRegion 宣告（含解鎖條件）
  areas/            # Area 宣告（港口/野外 + 場景清單 + 探索軌）
  scenes/           # Scene 宣告（熱點 → 事件池）
  events/           # GameEvent 宣告（一個檔一個事件，如上 §4.3 範例）
  npcs/             # Npc 宣告（好感階段/排程）
  quests/           # Quest 宣告
  worldState.ts     # World State 軸定義與初始值
  endings/          # 結局條件 + 文本引用（指向 docs/28）
```

每種內容都用同一套 `Condition` 條件語言 + `Effect` 後果語言。內容作者學一次條件
與後果的寫法，就能無限擴充世界。引擎提供一個 `validateContent()` 在建置時檢查
所有 id 引用完整、條件語法正確、事件節點不成孤島。

---

## 13. 技術架構與存檔

### 13.1 引擎核心（rpg-engine，純框架）

```ts
class RpgEngine {
  state: SaveState;
  content: ContentPack;          // 注入的內容包（rpg-content）

  enterScene(sceneId): SceneView;          // 回傳當前可見熱點（已依條件過濾）
  interact(hotspotId): EventRunner;        // 抽事件、開始跑流程
  choose(nodeId, optionIndex): EventStep;  // 推進事件節點
  evaluate(cond: Condition): boolean;      // 統一條件求值（所有系統共用）
  applyEffect(effect: Effect): void;       // 統一後果套用（改 state + 觸發解鎖）
}
```

### 13.2 存檔模型

```ts
interface SaveState {
  clock: GameClock;
  flags: FlagId[];
  worldState: WorldState;
  affinity: Record<NpcId, number>;
  reputation: Record<AreaId, number>;
  exploration: Record<AreaId, number>;
  captainStats: Record<CaptainStat, number>;
  eventHistory: Record<EventId, { count: number; lastAt: number }>; // 冷卻/一次性
  unlocked: { regions: RegionId[]; areas: AreaId[]; scenes: SceneId[] };
  inventory: ItemId[];
  playthrough: number;           // 第幾周目
  carryOver: CarryOver;
}
```

存檔完全由「狀態」構成，事件引擎是純函式（給 state + 選擇 → 新 state）。這讓
存讀檔、多周目、甚至日後做「時間回溯/多結局存檔分支」都很自然。前端可先做
純本地存檔（localStorage/IndexedDB），後端存雲端後補。

---

## 14. 實作路線圖（分階段 PR，逐步驗收）

| 階段 | 內容 | 產出 |
|---|---|---|
| **P0 引擎骨架** | `packages/rpg-engine`：型別定義 + `Condition` 求值 + `Effect` 套用 + 事件跑者 + `validateContent`，含單元測試 | 純框架，無內容，可測 |
| **P1 垂直切片** | `rpg-content` 最小內容：奧雷利亞 1 港 3 場景（港務廳/酒館/市場）+ 5–8 個事件（含開場、招募、初遇一位人物）+ World State 初值；`apps/rpg` 最小前端把切片跑起來 | 可玩的「第一個 15 分鐘」 |
| **P2 主線第一部** | 小說第一部（初出茅廬）完整事件鏈 + 佩爾蘭支線 + 提督五維判定 + 時間系統 | 可玩到第一部結束 |
| **P3 世界擴張** | 開放鐵崖/絹風/子午海域 + 對應港口/人物/支線 + 聲望/探索系統 | 中盤開放世界 |
| **P4 真相與結局** | 賽菈斐娜/奧丁/柯爾三隱藏支線 + 暮色洋解鎖 + 四結局 + 多周目 | 單周目可通關 |
| **P5 打磨** | 立繪/音效/存檔雲端化/平衡 | 可發布 |

每階段一到數個 PR，可獨立驗收——不是一次性大改。P0+P1 是「證明框架能跑」的
最小可玩切片，建議優先。

---

## 15. 為什麼這套框架適配蒼瀾

小說與既有系統已經天然具備 RPG 骨架，這套框架幾乎全是「把既有資產重新接線」：

| RPG 需求 | 蒼瀾既有資產 |
|---|---|
| 世界地圖三層 | 7 海域 / 15 港口 / 港口內場景 |
| 能力判定 | 提督五維（M27） |
| 探索度 | 發現物系統（M22） |
| 陣營 | 5 NPC 商會 |
| 人物與好感 | 15 港口人物（M25）+ 小說班底/反派 |
| 多結局 | 四結局（docs/28 正史 + 三外傳） |
| 時間/季節 | tick / 季風 / 天氣 |
| 聲望 | 影響力 / fame |
| 敘事文本 | 小說 20,000 字 + 港口/海域簡介（M26） |

框架真正**新做**的，只有：`Condition`/`Effect` 條件語言、事件引擎、World State
機、場景/熱點層、多周目存檔。其餘全是既有內容的重新組裝。

---

本文為設計提案，不含程式碼變更。若方向認可，建議下一步從 **P0 引擎骨架 +
P1 垂直切片**開始——先用「奧雷利亞港務廳開場 → 錨與星酒館招募 → 第一個事件」
這個最小可玩切片，證明整套框架跑得起來，再逐步把小說接進去。
