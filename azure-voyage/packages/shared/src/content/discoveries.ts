/** 發現物（docs/01 §4.6）。座標為 offset（col,row），皆位於外洋/邊陲海域。 */

export const DISCOVERY_CATEGORIES = ["GEOGRAPHY", "BIOLOGY", "RELIC", "CELESTIAL"] as const;
export type DiscoveryCategory = (typeof DISCOVERY_CATEGORIES)[number];

export const DISCOVERY_RARITIES = ["C", "B", "A", "S"] as const;
export type DiscoveryRarity = (typeof DISCOVERY_RARITIES)[number];

export interface DiscoveryDef {
  id: string;
  name: string;
  category: DiscoveryCategory;
  rarity: DiscoveryRarity;
  coord: { col: number; row: number };
  /** 探索檢定門檻：航海士 lore 屬性需達到的參考值 */
  requiredLore: number;
  /** 登錄學會可得獎勵 */
  goldReward: number;
  fameReward: number;
  /** 圖鑑基礎描述（原創，找到後即可見；AI 敘事文本是另外固化在 DiscoveryRecord.narrative 的加值層） */
  description: string;
}

export const DISCOVERIES: readonly DiscoveryDef[] = [
  // ── 暮色洋／子午之海／珊瑚環弧／鐵崖海岸南緣（M6 原始批次）──
  { id: "disc.the_glass_reef", name: "琉璃暗礁群", category: "GEOGRAPHY", rarity: "B", coord: { col: 24, row: 60 }, requiredLore: 40, goldReward: 800, fameReward: 5, description: "退潮時透出琉璃般的光澤，傳說是古代一場異變將整片礁石染成半透明的青色，船員都說夜裡靠近會聽見細碎的回聲。" },
  { id: "disc.singing_current", name: "低吟海流", category: "GEOGRAPHY", rarity: "C", coord: { col: 48, row: 64 }, requiredLore: 25, goldReward: 400, fameReward: 3, description: "一股恆常低鳴的暖流，聲音據說來自海底裂縫擠壓岩層產生的共鳴，老水手視為平安的預兆。" },
  { id: "disc.sunken_arch", name: "沉沒的拱門", category: "RELIC", rarity: "A", coord: { col: 10, row: 56 }, requiredLore: 60, goldReward: 2000, fameReward: 12, description: "半沒入海底的巨大石拱，雕工遠非現存任何港口工匠所能及，沒人知道是哪個年代、哪個文明留下的。" },
  { id: "disc.driftwood_colony", name: "浮木群島聚落", category: "GEOGRAPHY", rarity: "C", coord: { col: 60, row: 68 }, requiredLore: 20, goldReward: 350, fameReward: 2, description: "由經年累月漂流木堆疊而成的天然浮島，島上長出了奇異的耐鹽植被，成了海鳥棲息的中繼站。" },
  { id: "disc.ashen_lighthouse", name: "灰燼燈塔遺跡", category: "RELIC", rarity: "B", coord: { col: 36, row: 68 }, requiredLore: 45, goldReward: 900, fameReward: 6, description: "燈塔頂端早已崩塌，殘存的塔身佈滿焦黑痕跡，附近漁民相傳這裡曾在一夜之間被無名大火吞沒。" },
  { id: "disc.pale_leviathan", name: "蒼白巨獸的蹤跡", category: "BIOLOGY", rarity: "A", coord: { col: 38, row: 68 }, requiredLore: 55, goldReward: 1600, fameReward: 10, description: "巨大到能掀翻中型帆船的白色軀體只在濃霧中現身，見過的船員形容牠的鳴叫像是遠方教堂的鐘聲。" },
  { id: "disc.mirror_shoal", name: "鏡面魚群", category: "BIOLOGY", rarity: "C", coord: { col: 60, row: 66 }, requiredLore: 22, goldReward: 380, fameReward: 2, description: "魚群鱗片能完美反射天色，成群游動時遠遠望去像一片會移動的破碎鏡面。" },
  { id: "disc.the_still_star", name: "靜止之星觀測點", category: "CELESTIAL", rarity: "S", coord: { col: 48, row: 78 }, requiredLore: 75, goldReward: 4000, fameReward: 25, description: "此處海面終年風平浪靜，夜裡有一顆星子彷彿永遠停在同一個位置，學者們爭論了數十年也沒有定論。" },
  { id: "disc.amber_current_map", name: "琥珀洋流古圖", category: "RELIC", rarity: "B", coord: { col: 24, row: 70 }, requiredLore: 42, goldReward: 850, fameReward: 5, description: "以某種琥珀樹脂封存的殘破海圖，圖上標記的航線與現有海圖多有出入，似乎繪於一個海岸線截然不同的年代。" },
  { id: "disc.whispering_shoals", name: "低語淺灘", category: "GEOGRAPHY", rarity: "C", coord: { col: 70, row: 60 }, requiredLore: 18, goldReward: 300, fameReward: 2, description: "退潮後裸露的沙洲會發出細微的嘶鳴聲，其實是沙粒間空氣擠壓的自然現象，卻讓不少船員信誓旦旦說聽見了人聲。" },
  { id: "disc.coral_throne", name: "珊瑚王座", category: "RELIC", rarity: "A", coord: { col: 94, row: 58 }, requiredLore: 58, goldReward: 1800, fameReward: 11, description: "一整塊珊瑚天然生長成王座的形狀，座前散落著早已鏽蝕的青銅器皿，像是某場儀式倉促中斷後的遺留。" },
  { id: "disc.twin_moon_tide", name: "雙月異潮", category: "CELESTIAL", rarity: "B", coord: { col: 102, row: 62 }, requiredLore: 48, goldReward: 950, fameReward: 6, description: "每逢特定夜晚，海面會出現兩次方向相反的潮汐疊加，短暫形成一圈詭異的靜止水域。" },

  // ── M22 擴充：補齊北環海／琥珀灣／絹風海峽／鐵崖北緣／子午北緣（原本完全沒有發現物的海域）──
  { id: "disc.frostbound_reef", name: "凍浪礁群", category: "GEOGRAPHY", rarity: "C", coord: { col: 51, row: 4 }, requiredLore: 20, goldReward: 320, fameReward: 2, description: "終年浮著薄冰的礁岩帶，浪花拍打瞬間便凝結成霜，北境漁民口耳相傳這裡是「魔鬼的牙齒」。" },
  { id: "disc.iceblade_pod", name: "冰刃鯨群", category: "BIOLOGY", rarity: "B", coord: { col: 33, row: 4 }, requiredLore: 44, goldReward: 900, fameReward: 6, description: "背鰭銳利如刃、成群出沒於浮冰之間的巨鯨，牠們破冰而出的聲響能傳出數里之外。" },
  { id: "disc.frost_shrouded_wreck", name: "霜封殘骸", category: "RELIC", rarity: "B", coord: { col: 55, row: 20 }, requiredLore: 46, goldReward: 920, fameReward: 6, description: "一艘被冰層整個封住的古老商船，桅杆從冰面探出，船身輪廓與現今任何船級都對不上。" },
  { id: "disc.drowned_academy", name: "沉沒學院", category: "RELIC", rarity: "A", coord: { col: 65, row: 33 }, requiredLore: 58, goldReward: 1900, fameReward: 11, description: "一整棟石造學堂沉在灣區海床上，窗框裡還卡著發黑的書卷殘頁，據信是文明中心某段動盪歷史的見證。" },
  { id: "disc.gulf_undertow", name: "灣區暗流", category: "GEOGRAPHY", rarity: "C", coord: { col: 32, row: 42 }, requiredLore: 18, goldReward: 300, fameReward: 2, description: "看似平靜的灣區水面下藏著一股強勁暗流，熟悉水性的船長會刻意繞行，生手卻常被拖得偏離航道。" },
  { id: "disc.silk_caravan_remnant", name: "絲道商隊殘跡", category: "RELIC", rarity: "B", coord: { col: 115, row: 14 }, requiredLore: 43, goldReward: 870, fameReward: 5, description: "半埋在沙洲裡的載貨殘骸，殘存的織品碎片色澤鮮豔如新，顯然是走私商隊某次翻覆的下場。" },
  { id: "disc.thousand_mirror_shoal", name: "萬鏡淺灘", category: "GEOGRAPHY", rarity: "C", coord: { col: 115, row: 39 }, requiredLore: 22, goldReward: 360, fameReward: 2, description: "布滿平滑礁面的淺灘，退潮時積水如鏡，倒映著天光雲影，是絹風海峽船員口中的絕景。" },
  { id: "disc.plumed_flock_roost", name: "彩羽海鳥群棲地", category: "BIOLOGY", rarity: "C", coord: { col: 78, row: 41 }, requiredLore: 24, goldReward: 380, fameReward: 3, description: "羽色斑斕的海鳥群年年在此繁殖，牠們的羽毛在絹風海峽的市集裡向來是搶手的裝飾材料。" },
  { id: "disc.lodestone_shoal", name: "磁鐵暗礁", category: "GEOGRAPHY", rarity: "B", coord: { col: 21, row: 23 }, requiredLore: 47, goldReward: 930, fameReward: 6, description: "礁石中蘊含大量天然磁鐵礦，羅盤靠近便會失準，不少船隻曾在此莫名偏航觸礁。" },
  { id: "disc.corsair_kings_wreck", name: "海賊王的沉船", category: "RELIC", rarity: "S", coord: { col: 41, row: 50 }, requiredLore: 78, goldReward: 4200, fameReward: 26, description: "傳說中橫行子午之海數十年的梟雄座艦最終葬身於此，船艙深處據信仍藏著他畢生劫掠的寶藏。" },
  { id: "disc.southern_star_pool", name: "南天星域鏡池", category: "CELESTIAL", rarity: "S", coord: { col: 115, row: 75 }, requiredLore: 76, goldReward: 4100, fameReward: 25, description: "群島圍出的一汪靜謐潟湖，晴夜裡能同時映出滿天星斗與海面倒影，天文學者稱之為觀測南天星域的絕佳地點。" },
] as const;

export const DISCOVERY_IDS = DISCOVERIES.map((d) => d.id);

export function discoveryById(id: string): DiscoveryDef {
  const discovery = DISCOVERIES.find((d) => d.id === id);
  if (!discovery) throw new Error(`unknown discovery: ${id}`);
  return discovery;
}

/** S 級（「傳世遺物」）發現物 id，供勝利條件（RELIC_COLLECTOR）與圖鑑分區使用。 */
export const RELIC_DISCOVERY_IDS = DISCOVERIES.filter((d) => d.rarity === "S").map((d) => d.id);
