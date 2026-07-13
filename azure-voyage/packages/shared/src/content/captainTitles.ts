/**
 * 提督（艦長）稱號（M27）：純粹風味，依等級門檻解鎖，不影響數值。
 * 原創稱號，呼應「蒼瀾海域」世界觀，由低到高排列。
 */
export interface CaptainTitleTier {
  minLevel: number;
  title: string;
}

export const CAPTAIN_TITLES: CaptainTitleTier[] = [
  { minLevel: 0, title: "見習船長" },
  { minLevel: 3, title: "自由船長" },
  { minLevel: 6, title: "商隊領航員" },
  { minLevel: 10, title: "海道先驅" },
  { minLevel: 15, title: "七海提督" },
  { minLevel: 20, title: "蒼瀾傳說" },
];

/** 依等級找出目前解鎖的最高稱號（門檻由低到高，取最後一個符合的）。 */
export function captainTitleForLevel(level: number): string {
  let title = CAPTAIN_TITLES[0].title;
  for (const tier of CAPTAIN_TITLES) {
    if (level >= tier.minLevel) title = tier.title;
  }
  return title;
}
