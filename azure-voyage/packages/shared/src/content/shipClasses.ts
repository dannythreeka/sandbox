/** 10 個船級（docs/01 §4.1、§4.4）。船型名為通用航海詞彙，數值原創。 */

export interface ShipClassDef {
  id: string;
  name: string;
  /** 速度值（/10 = 每 tick 基礎格數） */
  speed: number;
  maxHull: number;
  /** 貨艙容量（volume 單位；糧水共用） */
  cargoCapacity: number;
  cannonSlots: number;
  crewMax: number;
  crewMin: number;
  price: number;
}

export const SHIP_CLASSES: readonly ShipClassDef[] = [
  { id: "ship.lugger", name: "輕便帆船", speed: 36, maxHull: 55, cargoCapacity: 45, cannonSlots: 2, crewMax: 10, crewMin: 3, price: 9000 },
  { id: "ship.sloop", name: "單桅快船", speed: 42, maxHull: 50, cargoCapacity: 35, cannonSlots: 4, crewMax: 12, crewMin: 4, price: 12000 },
  { id: "ship.coaster", name: "近海貨船", speed: 30, maxHull: 70, cargoCapacity: 90, cannonSlots: 2, crewMax: 14, crewMin: 5, price: 16000 },
  { id: "ship.schooner", name: "雙桅縱帆船", speed: 44, maxHull: 75, cargoCapacity: 80, cannonSlots: 6, crewMax: 20, crewMin: 7, price: 28000 },
  { id: "ship.brigantine", name: "雙桅橫帆船", speed: 40, maxHull: 110, cargoCapacity: 120, cannonSlots: 10, crewMax: 35, crewMin: 12, price: 52000 },
  { id: "ship.merchantman", name: "大商船", speed: 32, maxHull: 140, cargoCapacity: 220, cannonSlots: 8, crewMax: 45, crewMin: 15, price: 78000 },
  { id: "ship.corvette", name: "護衛艦", speed: 46, maxHull: 130, cargoCapacity: 70, cannonSlots: 16, crewMax: 60, crewMin: 20, price: 95000 },
  { id: "ship.frigate", name: "巡防艦", speed: 42, maxHull: 180, cargoCapacity: 110, cannonSlots: 24, crewMax: 90, crewMin: 30, price: 150000 },
  { id: "ship.galleon", name: "遠洋大帆船", speed: 34, maxHull: 220, cargoCapacity: 280, cannonSlots: 20, crewMax: 110, crewMin: 36, price: 210000 },
  { id: "ship.ship_of_line", name: "戰列艦", speed: 36, maxHull: 300, cargoCapacity: 150, cannonSlots: 36, crewMax: 160, crewMin: 55, price: 320000 },
] as const;

export const SHIP_CLASS_IDS = SHIP_CLASSES.map((s) => s.id);

export function shipClassById(id: string): ShipClassDef {
  const shipClass = SHIP_CLASSES.find((s) => s.id === id);
  if (!shipClass) throw new Error(`unknown ship class: ${id}`);
  return shipClass;
}

/** 新開局的起始船 */
export const STARTER_SHIP_CLASS_ID = "ship.lugger";
