import raw from "./hexmap.json";
import { assertValidMap, type HexMap } from "../../rules/hexmap";

/** 世界海圖（由 scripts/mapgen.ts 產生並 commit；載入時驗證尺寸）。 */
export const HEXMAP: HexMap = raw as HexMap;

assertValidMap(HEXMAP);
