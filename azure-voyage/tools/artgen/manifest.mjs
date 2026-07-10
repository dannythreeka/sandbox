/**
 * M16 P0 生圖訂單表（docs/11 §2/§4）：每筆對應 `apps/web/public/art/<category>/<id>.webp`。
 * 風格方向 A（古典油畫×羊皮紙），prompt 由 content 資料展開，不含 KOEI／大航海時代等字樣。
 */

export const STYLE_PREFIX =
  "classical oil painting, age of sail era, warm candlelight palette, " +
  "consistent painterly style, game asset, clean composition, " +
  "no text, no watermark, no signature";

export const NEGATIVE_PROMPT =
  "modern objects, photograph, real person, text, watermark, frame, border, low quality";

// ── A. 港口場景（M18：7 海域 × 實際存在的規模，取代 M16 只做 size=2 代表圖的做法）──
// 規模詞：size1=小漁村、size2=中型商港（M16 既有）、size3=首府大港；
// coral_arc／dusk_expanse 在 ports.ts 裡沒有 size3 港口，故不產生對應圖。
const SIZE_WORDS = {
  1: "a small fishing village harbor, a handful of modest wooden docks, a few humble sailing boats",
  2: "a mid-sized harbor town, sailing ships at anchor, stone piers",
  3: "a grand capital harbor city, bustling waterfront crowded with tall ships, guild banners, grand stone architecture",
};

const PORT_SCENE_REGIONS = [
  {
    regionId: "north_reach",
    sizes: [1, 2, 3],
    words: "snow-dusted timber roofs, cold windswept fjord harbor, grey stone piers, pine-covered hills",
  },
  {
    regionId: "amber_gulf",
    sizes: [1, 2, 3],
    words: "golden sandstone buildings, calm turquoise gulf waters, olive groves on the hillside",
  },
  {
    regionId: "ironcliff",
    sizes: [1, 2, 3],
    words: "dark iron-hued cliffs, rugged coastline, weathered granite piers, forge smoke over rooftops",
  },
  {
    regionId: "silkwind",
    sizes: [1, 2, 3],
    words: "terraced silk-trade town, colorful silk banners, narrow strait with lantern-lit junks",
  },
  {
    regionId: "meridian",
    sizes: [1, 2, 3],
    words: "bustling equatorial crossroads harbor, spice warehouses, distant storm clouds on the horizon",
  },
  {
    regionId: "coral_arc",
    sizes: [1, 2],
    words: "coral reef lagoon, white sand beaches, turquoise shallows, thatched-roof stilt houses",
  },
  {
    regionId: "dusk_expanse",
    sizes: [1, 2],
    words: "twilight sky with deep crimson clouds, remote windswept outpost, black volcanic rock shoreline",
  },
];

const PORT_SCENES = PORT_SCENE_REGIONS.flatMap(({ regionId, sizes, words }) =>
  sizes.map((size) => ({
    category: "port-scene",
    id: `${regionId}-s${size}`,
    width: 1600,
    height: 900,
    prompt: `${STYLE_PREFIX}, wide establishing shot of ${SIZE_WORDS[size]}, ${words}`,
  })),
);

// ── B. 航海士立繪（12 名，特徵詞取自 officersPool.ts 的技能／數值傾向）──
const OFFICER_PORTRAITS = [
  { id: "sera", words: "young female ship's navigator, calm intelligent gaze, star charts nearby, scholarly air" },
  { id: "bram", words: "gruff middle-aged male gunner, weathered face, broad shoulders, confident stance" },
  { id: "nerissa", words: "sharp-eyed female trade officer, shrewd knowing smile, fine merchant coat" },
  { id: "tovan", words: "lean young male lookout, alert eyes, wind-tousled hair, rope-worn hands" },
  { id: "ismay", words: "elegant multilingual female diplomat-officer, refined posture, calm composed expression" },
  { id: "darrok", words: "scarred battle-hardened male swordsman, intense stare, cutlass at his side" },
  { id: "lyra", words: "gentle female ship's healer, thoughtful expression, herb pouch at her belt" },
  { id: "garvin", words: "sturdy male shipwright officer, calloused hands, practical no-nonsense demeanor" },
  { id: "ophira", words: "commanding older female captain-officer, regal bearing, gold-trimmed coat" },
  { id: "kesh", words: "weathered male cartographer-scout, squinting toward the horizon, rolled charts in hand" },
  { id: "fenna", words: "meticulous female purser, sharp focus, ledger and quill in hand" },
  { id: "rudger", words: "bold young male swordsman-officer, fierce determined look, dueling scar on cheek" },
].map(({ id, words }) => ({
  category: "portrait",
  id,
  width: 768,
  height: 1024,
  prompt: `${STYLE_PREFIX}, half-body portrait of a ${words}, dark plain background`,
}));

// ── E. 船級側視圖（10 級，descriptor 取自 shipClasses.ts 的定位）──
const SHIP_VIEWS = [
  { id: "ship.lugger", words: "small light lugger-rigged fishing boat, single mast, modest sails" },
  { id: "ship.sloop", words: "single-masted sloop, fast and nimble, taut rigging" },
  { id: "ship.coaster", words: "sturdy broad-beamed coastal trading vessel, low freeboard" },
  { id: "ship.schooner", words: "two-masted schooner, fore-and-aft rigged, sleek hull" },
  { id: "ship.brigantine", words: "two-masted brigantine, square-rigged foremast, rows of gun ports" },
  { id: "ship.merchantman", words: "large three-masted merchantman, deep cargo hold" },
  { id: "ship.corvette", words: "agile armed corvette, many cannon ports, raked masts" },
  { id: "ship.frigate", words: "proud three-masted frigate, tiered gun decks, battle ensign" },
  { id: "ship.galleon", words: "grand ocean-going galleon, towering stern castle, ornate carved transom" },
  { id: "ship.ship_of_line", words: "massive multi-deck ship of the line, imposing rows of cannon, flagship presence" },
].map(({ id, words }) => ({
  category: "ship",
  id: id.replace(/^ship\./, ""),
  width: 1024,
  height: 768,
  prompt: `${STYLE_PREFIX}, side view of a ${words}, full sails, calm sea, horizon composition`,
}));

// ── F. 標題／登入頁主視覺（1 張）──
const KEY_VISUALS = [
  {
    id: "title",
    words:
      "a lone tall ship at full sail crossing sunlit open ocean under a dramatic sky, " +
      "sense of adventure and discovery, wide cinematic composition",
  },
].map(({ id, words }) => ({
  category: "key-visual",
  id,
  width: 1600,
  height: 900,
  prompt: `${STYLE_PREFIX}, grand title illustration, ${words}`,
}));

// ── G. 戰鬥背景（平靜海／風暴海／夜戰，3 張）──
const BATTLE_BACKGROUNDS = [
  { id: "calm", words: "calm turquoise sea battlefield, gentle waves, clear sky, ships engaged at a distance" },
  { id: "storm", words: "stormy grey-green sea battlefield, heavy rain, lightning, tall crashing waves" },
  { id: "night", words: "night sea battlefield under moonlight, dark deep-blue water, distant ship lanterns" },
].map(({ id, words }) => ({
  category: "battle-bg",
  id,
  width: 1600,
  height: 900,
  prompt: `${STYLE_PREFIX}, wide battle scene backdrop, ${words}, dramatic composition`,
}));

// ── C. NPC 商會會長立繪（5 名，特徵詞取自 npcGuilds.ts 的 archetype）──
const GUILD_LEADER_PORTRAITS = [
  {
    id: "frost_compact",
    words: "stern older guild leader in fur-lined coat, cautious calculating expression, northern harbor air",
  },
  {
    id: "crimson_sails",
    words: "roguish guild leader with crimson sash, half-smirk, dangerous confident air",
  },
  {
    id: "gilded_scale",
    words: "wealthy guild leader in fine embroidered coat, holding a balance scale, shrewd composed expression",
  },
  {
    id: "silkwind_caravan",
    words: "silk-robed guild leader with ornate turban, calm commanding presence, trade ledger in hand",
  },
  {
    id: "tideglass_league",
    words: "weathered explorer guild leader, sun-bronzed skin, spyglass in hand, adventurous confident look",
  },
].map(({ id, words }) => ({
  category: "portrait",
  id: `guild-${id}`,
  width: 768,
  height: 1024,
  prompt: `${STYLE_PREFIX}, half-body portrait of a ${words}, dark plain background`,
}));

// ── H. 事件插圖（風暴/慶典/傳聞/發現/下錨探索/海賊，6 張）──
const EVENT_ILLUSTRATIONS = [
  { id: "storm", words: "a violent sea storm brewing, dark clouds and whitecaps, dramatic lighting" },
  { id: "festival", words: "a harbor festival at night, lanterns and fireworks over the water, joyful atmosphere" },
  { id: "rumor", words: "a hooded figure whispering at a candlelit tavern table, mysterious atmosphere" },
  { id: "discovery", words: "an ancient shipwreck glimpsed underwater near a reef, sense of wonder" },
  { id: "anchor", words: "a ship's anchor dropping into calm turquoise water, sunlight rays" },
  { id: "pirate", words: "a pirate ship's black flag and cutlass silhouette against a stormy horizon" },
].map(({ id, words }) => ({
  category: "event",
  id,
  width: 512,
  height: 512,
  prompt: `${STYLE_PREFIX}, small narrative illustration of ${words}`,
}));

// ── I. 商品類別圖示（8 大類，取自 commodities.ts 的 COMMODITY_CATEGORIES）──
const GOODS_ICONS = [
  { id: "food", words: "dried fish and salt barrels, still life" },
  { id: "drink", words: "a wine bottle and rum cask, still life" },
  { id: "textile", words: "folded silk and wool bolts, still life" },
  { id: "ore", words: "raw iron and copper ore chunks, still life" },
  { id: "weaponry", words: "a cutlass and cannonball, still life" },
  { id: "craft", words: "blown glasswork and pottery, still life" },
  { id: "luxury", words: "pearls and amber jewelry, still life" },
  { id: "spice", words: "peppercorns and cinnamon sticks in small sacks, still life" },
].map(({ id, words }) => ({
  category: "goods",
  id,
  width: 256,
  height: 256,
  prompt: `${STYLE_PREFIX}, small icon illustration of ${words}, centered composition`,
}));

export const MANIFEST = [
  ...PORT_SCENES,
  ...OFFICER_PORTRAITS,
  ...SHIP_VIEWS,
  ...KEY_VISUALS,
  ...BATTLE_BACKGROUNDS,
  ...GUILD_LEADER_PORTRAITS,
  ...EVENT_ILLUSTRATIONS,
  ...GOODS_ICONS,
];
