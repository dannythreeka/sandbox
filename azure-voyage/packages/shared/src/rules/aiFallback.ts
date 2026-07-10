/**
 * 規則版 fallback 產生器（docs/06 §1 fallback/rule-fallback.service）。
 * AI 停用、逾時或輸出驗證失敗時一律落到這裡——純函式、無 IO，
 * 保證 `AI_ENABLED=false` 時遊戲仍完整可玩（docs/06 §2 鐵律 2）。
 */
import { BALANCE } from "../content/constants";
import { Rng } from "./rng";
import type { AiEventProposal, NpcGoalKind, NpcPersonaGen, NpcStrategy, OfficerPersonaGen } from "../schemas/ai";

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
