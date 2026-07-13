/**
 * 規則版 fallback 產生器（docs/06 §1 fallback/rule-fallback.service）。
 * AI 停用、逾時或輸出驗證失敗時一律落到這裡——純函式、無 IO，
 * 保證 `AI_ENABLED=false` 時遊戲仍完整可玩（docs/06 §2 鐵律 2）。
 */
import { BALANCE } from "../content/constants";
import { Rng } from "./rng";
import type { AiEventProposal, NpcGoalKind, NpcPersonaGen, NpcStrategy, OfficerPersonaGen } from "../schemas/ai";
import type { DiscoveryCategory } from "../content/discoveries";
import type { PortNotableArchetype } from "../content/portNotables";

const FALLBACK_GOAL_KINDS: readonly NpcGoalKind[] = ["EXPAND_INFLUENCE", "CONSOLIDATE", "INVEST_PORT"];

export function fallbackNpcStrategy(input: { seed: number; tick: number; homeRegionId: string }): NpcStrategy {
  const rng = new Rng(input.seed);
  const kind = rng.pick(FALLBACK_GOAL_KINDS);
  return {
    goals: [{ kind, regionId: input.homeRegionId, portIds: [], priority: 3 }],
    validUntilTick: input.tick + BALANCE.NPC_STRATEGY_INTERVAL_TICKS,
  };
}

const RUMOR_TEMPLATES = [
  (port: string) => `碼頭工人低聲私語，${port}外海似乎有艘沉船，貨艙裡的清單也許還值點錢。`,
  (port: string) => `${port}的酒館裡流傳一則傳聞：某支商隊願意重金求購一批消息靈通的情報。`,
  (port: string) => `旅人帶來${port}周邊海域風向轉變的消息，懂得順勢而為的船長能省下不少補給。`,
  (port: string) => `${port}的老水手講起一段陳年軼事，聽者若懂得引申，倒也能換來幾分名望。`,
] as const;

export function fallbackRumorEvent(input: { seed: number; portName: string }): AiEventProposal {
  const rng = new Rng(input.seed);
  const narrative = rng.pick(RUMOR_TEMPLATES)(input.portName);
  return {
    type: "RUMOR",
    title: "港邊傳聞",
    narrative,
    goldReward: rng.int(50, 300),
    fameReward: rng.int(1, 5),
  };
}

const NPC_PERSONA_TEMPLATES: Record<string, { description: (name: string) => string; greeting: (name: string) => string }> = {
  DEFENSIVE_TRADER: {
    description: (name) => `${name}行事謹慎保守，寧可少賺也不願冒進，靠穩紮穩打的航線經營站穩腳跟。`,
    greeting: (name) => `「${name}向來不打沒把握的仗，你若是來談生意，我們洗耳恭聽。」`,
  },
  RAIDER_MERCHANT: {
    description: (name) => `${name}遊走在商賈與海盜的灰色地帶，機會來時毫不猶豫，風評毀譽參半。`,
    greeting: (name) => `「${name}可不是什麼善男信女，不過只要利益夠大，什麼都好談。」`,
  },
  FINANCIER: {
    description: (name) => `${name}擅長金融操作，靠放貸與投資編織出一張橫跨數個港口的利益網。`,
    greeting: (name) => `「歡迎光臨，${name}的大門永遠為有價值的合作對象敞開。」`,
  },
  ROUTE_MONOPOLIST: {
    description: (name) => `${name}長年壟斷幾條關鍵航線，對任何想分一杯羹的新面孔都保持高度警覺。`,
    greeting: (name) => `「這條航線是${name}打下的江山，想通行，先說說你的來意。」`,
  },
  EXPLORER_TRADER: {
    description: (name) => `${name}熱衷於開拓未知海域，商隊裡總帶著幾份還沒繪完的海圖。`,
    greeting: (name) => `「${name}的船隊剛從外海回來，你猜我們又發現了什麼？」`,
  },
};

/** NPC 商會人設 fallback：依 archetype 決定性挑對應模板，AI 停用/失敗時使用。 */
export function fallbackNpcPersonaGen(input: { guildName: string; archetype: string }): NpcPersonaGen {
  const template = NPC_PERSONA_TEMPLATES[input.archetype] ?? NPC_PERSONA_TEMPLATES.DEFENSIVE_TRADER;
  return {
    description: template.description(input.guildName),
    greeting: template.greeting(input.guildName),
  };
}

const OFFICER_PERSONA_TEMPLATES = [
  (name: string) => ({
    description: `${name}話不多，但只要開口，句句都切中要害，是艦隊裡沉默卻可靠的存在。`,
    greeting: `「${name}在。有任務儘管吩咐。」`,
  }),
  (name: string) => ({
    description: `${name}性格爽朗，喜歡跟船員們插科打諢，是甲板上士氣的來源之一。`,
    greeting: `「哈，又見面了！今天要聊點什麼？」`,
  }),
  (name: string) => ({
    description: `${name}做事一絲不苟，任何交辦的事務都會反覆確認，深得同僚信賴。`,
    greeting: `「提督，有什麼吩咐，${name}隨時待命。」`,
  }),
] as const;

/** 航海士人設 fallback：AI 停用/失敗時使用，用序列式模板池輪替避免千篇一律。 */
export function fallbackOfficerPersonaGen(input: { seed: number; officerName: string }): OfficerPersonaGen {
  const rng = new Rng(input.seed);
  return rng.pick(OFFICER_PERSONA_TEMPLATES)(input.officerName);
}

const DIALOGUE_FALLBACK_TEMPLATES = [
  "「嗯……讓我想想該怎麼回答你。」",
  "「這個嘛，一時之間不知道從何說起。」",
  "「抱歉，現在有點忙，晚點再聊吧。」",
] as const;

/** 對話 fallback：AI 停用/失敗時使用，優先用對方既有的開場白，否則走通用模板池。 */
export function fallbackDialogueReply(input: { seed: number; greeting?: string }): string {
  if (input.greeting) return input.greeting;
  const rng = new Rng(input.seed);
  return rng.pick(DIALOGUE_FALLBACK_TEMPLATES);
}

const NARRATIVE_TEMPLATES_BY_CATEGORY: Record<DiscoveryCategory, ((name: string) => string)[]> = {
  GEOGRAPHY: [
    (name) => `艦隊在圖鑑上記下了「${name}」的位置——這片地貌透露出的訊息，或許遠比第一眼看到的更多。`,
    (name) => `測繪員仔細描下「${name}」的輪廓，這樣的紀錄一旦收進學會檔案，往後的船隊便能少走一段冤枉路。`,
  ],
  BIOLOGY: [
    (name) => `「${name}」的蹤跡被記錄了下來，博物學者對這類發現總是格外興奮，誰知道牠們還藏著什麼秘密。`,
    (name) => `船員們議論紛紛，說起「${name}」時眼神裡帶著幾分敬畏，這一路的風浪似乎也值得了。`,
  ],
  RELIC: [
    (name) => `「${name}」被打撈記錄在案，殘破的遺跡背後究竟藏著什麼樣的故事，恐怕只有時間才能給出答案。`,
    (name) => `學會的文獻員接過「${name}」的紀錄，眼神專注——每一件遺物都是拼湊失落過往的一塊碎片。`,
  ],
  CELESTIAL: [
    (name) => `夜觀「${name}」的那一刻，甲板上一片靜默，彷彿連海浪都放輕了聲音。`,
    (name) => `「${name}」被鄭重記入星圖，天文學者相信，這樣的異象總有一天會透露更深的規律。`,
  ],
};

/** 發現物圖鑑敘事 fallback：AI 停用/失敗時使用，依類別挑選模板池，避免千篇一律。 */
export function fallbackDiscoveryNarrative(input: {
  seed: number;
  name: string;
  category: DiscoveryCategory;
}): string {
  const rng = new Rng(input.seed);
  const templates = NARRATIVE_TEMPLATES_BY_CATEGORY[input.category];
  return rng.pick(templates)(input.name);
}

const PORT_NOTABLE_TEMPLATES_BY_ARCHETYPE: Record<
  PortNotableArchetype,
  { description: (name: string, portName: string) => string; greeting: (name: string) => string }
> = {
  HARBORMASTER: {
    description: (name, portName) => `${name}是${portName}的港務總管，稅收、泊位、糾紛樣樣都得經手，說話帶著不容置疑的分量。`,
    greeting: (name) => `「${name}在此。想在本港做生意，先把規矩弄清楚。」`,
  },
  FUR_TRADER: {
    description: (name, portName) => `${name}常年往返${portName}與北境獵場之間，一身皮草行頭是走過風雪的見證。`,
    greeting: (name) => `「${name}剛從內陸回來，貨還新鮮，你要不要瞧瞧？」`,
  },
  GUILD_ELDER: {
    description: (name, portName) => `${name}是${portName}工藝商會的元老，看人看貨的眼光幾十年沒失手過。`,
    greeting: (name) => `「${name}見識過的商隊比你想像的多，有話直說無妨。」`,
  },
  OLD_FISHERMAN: {
    description: (name, portName) => `${name}在${portName}討海一輩子，海況、魚汛、天色，沒有他看不出的門道。`,
    greeting: (name) => `「${name}啊，今天風向不對，你這艘船最好晚點出港。」`,
  },
  BLACKSMITH: {
    description: (name, portName) => `${name}掌管${portName}的鍛爐，船錨到砲管，經他手打的東西沒有一件會讓人失望。`,
    greeting: (name) => `「爐火還旺著，${name}隨時可以開工，你要修什麼？」`,
  },
  SILK_MERCHANT: {
    description: (name, portName) => `${name}在${portName}經營絲織生意，貨架上的織品花色，一半是這座港口說話的方式。`,
    greeting: (name) => `「${name}剛進了一批好貨，識貨的人才配看第一眼。」`,
  },
  RETIRED_PRIVATEER: {
    description: (name, portName) => `${name}當年在${portName}外海掛過私掠旗，如今金盆洗手，酒館裡的故事多半有他一份。`,
    greeting: (name) => `「${name}退下來了，不過老本行的門道，倒還沒忘乾淨。」`,
  },
  PEARL_MERCHANT: {
    description: (name, portName) => `${name}壟斷${portName}周邊珊瑚礁的珍珠買賣，眼力毒辣，一顆珠子的成色瞞不過她。`,
    greeting: (name) => `「歡迎，${name}這裡的珍珠，顆顆都經得起細看。」`,
  },
  DIVER_ELDER: {
    description: (name, portName) => `${name}是${portName}潛水人裡輩分最高的一位，帶過的徒弟撐起了半個漁村。`,
    greeting: (name) => `「${name}下水前總要看一眼天色，你若心急，先坐下喝口水。」`,
  },
  CARTOGRAPHER: {
    description: (name, portName) => `${name}窩在${portName}的閣樓裡繪製海圖，外洋每一次新發現都會被她仔細描進圖裡。`,
    greeting: (name) => `「${name}正在校對海圖，你帶回來的見聞，說不定能補上一角。」`,
  },
  HERMIT_ASTRONOMER: {
    description: (name, portName) => `${name}獨居在${portName}邊緣，夜夜觀星，話不多，但說出口的話往往意有所指。`,
    greeting: (name) => `「${name}見你進來——星象今夜不太尋常，你也看出來了嗎？」`,
  },
};

/** 港口人物人設 fallback：依 archetype 決定性挑對應模板，AI 停用/失敗時使用。 */
export function fallbackPortNotablePersonaGen(input: {
  name: string;
  portName: string;
  archetype: PortNotableArchetype;
}): NpcPersonaGen {
  const template = PORT_NOTABLE_TEMPLATES_BY_ARCHETYPE[input.archetype];
  return {
    description: template.description(input.name, input.portName),
    greeting: template.greeting(input.name),
  };
}
