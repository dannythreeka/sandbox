/**
 * 規則版 fallback 產生器（docs/06 §1 fallback/rule-fallback.service）。
 * AI 停用、逾時或輸出驗證失敗時一律落到這裡——純函式、無 IO，
 * 保證 `AI_ENABLED=false` 時遊戲仍完整可玩（docs/06 §2 鐵律 2）。
 */
import { BALANCE } from "../content/constants";
import { Rng } from "./rng";
import type { AiEventProposal, NpcGoalKind, NpcStrategy } from "../schemas/ai";

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
