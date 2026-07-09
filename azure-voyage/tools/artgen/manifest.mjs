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

// ── A. 港口場景（7 海域代表圖，size=2；size 1/3 港口沿用同張，缺檔則走 M13 剪影 fallback）──
const PORT_SCENES = [
  {
    regionId: "north_reach",
    words: "snow-dusted timber roofs, cold windswept fjord harbor, grey stone piers, pine-covered hills",
  },
  {
    regionId: "amber_gulf",
    words: "golden sandstone buildings, calm turquoise gulf waters, olive groves on the hillside",
  },
  {
    regionId: "ironcliff",
    words: "dark iron-hued cliffs, rugged coastline, weathered granite piers, forge smoke over rooftops",
  },
  {
    regionId: "silkwind",
    words: "terraced silk-trade town, colorful silk banners, narrow strait with lantern-lit junks",
  },
  {
    regionId: "meridian",
    words: "bustling equatorial crossroads harbor, spice warehouses, distant storm clouds on the horizon",
  },
  {
    regionId: "coral_arc",
    words: "coral reef lagoon, white sand beaches, turquoise shallows, thatched-roof stilt houses",
  },
  {
    regionId: "dusk_expanse",
    words: "twilight sky with deep crimson clouds, remote windswept outpost, black volcanic rock shoreline",
  },
].map(({ regionId, words }) => ({
  category: "port-scene",
  id: `${regionId}-s2`,
  width: 1600,
  height: 900,
  prompt: `${STYLE_PREFIX}, wide establishing shot of a mid-sized harbor town, sailing ships at anchor, stone piers, ${words}`,
}));

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

export const MANIFEST = [...PORT_SCENES, ...OFFICER_PORTRAITS, ...SHIP_VIEWS];
