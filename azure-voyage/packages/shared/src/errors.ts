/**
 * 錯誤碼字典（前後端共用）。
 * 後端以 GameError 攜帶這些碼；前端據此查 i18n 文案，不自行編錯誤訊息。
 */
export const ERROR_CODES = [
  // 通用
  "VALIDATION_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "WORLD_BUSY",
  "INTERNAL",
  // 認證
  "EMAIL_TAKEN",
  "INVALID_CREDENTIALS",
  "INVALID_REFRESH_TOKEN",
  // 世界
  "WORLD_LIMIT_REACHED",
  "WORLD_NOT_ACTIVE",
  // 之後里程碑使用（先佔位，維持字典單一來源）
  "INSUFFICIENT_GOLD",
  "CARGO_FULL",
  "PORT_NOT_DOCKED",
  "AI_UNAVAILABLE",
  // 航行（M2）
  "ROUTE_INVALID",
  "NO_ROUTE_SET",
  "FLEET_BUSY",
  // 貿易（M3）
  "STOCK_INSUFFICIENT",
  "COMMODITY_UNAVAILABLE",
  // 航海士與造船廠（M4）
  "OFFICER_UNAVAILABLE",
  "CANNOT_SELL_LAST_SHIP",
  // 多艦隊管理（M29）
  "CANNOT_SPLIT_ALL_SHIPS",
  // 海戰（M5）
  "BATTLE_ACTION_INVALID",
  "BATTLE_NOT_ACTIVE",
  // 探索與發現物（M6）
  "NOT_NEAR_DISCOVERY_SITE",
  "DISCOVERY_ALREADY_REGISTERED",
  "NO_GUILD_HALL",
  // 對話代理（M20）
  "DIALOGUE_COOLDOWN",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export interface ApiOkBody<T> {
  ok: true;
  data: T;
}

export type ApiResponse<T> = ApiOkBody<T> | ApiErrorBody;

/** 錯誤碼 → 繁中預設文案（i18n 表的種子，M6 移入完整 i18n） */
export const ERROR_MESSAGES_ZH_TW: Record<ErrorCode, string> = {
  VALIDATION_FAILED: "輸入資料格式不正確",
  UNAUTHORIZED: "請先登入",
  FORBIDDEN: "你沒有權限執行此操作",
  NOT_FOUND: "找不到目標資源",
  WORLD_BUSY: "世界正在推進中，請稍候",
  INTERNAL: "伺服器發生未預期的錯誤",
  EMAIL_TAKEN: "此電子郵件已被註冊",
  INVALID_CREDENTIALS: "帳號或密碼錯誤",
  INVALID_REFRESH_TOKEN: "登入已過期，請重新登入",
  WORLD_LIMIT_REACHED: "存檔數量已達上限",
  WORLD_NOT_ACTIVE: "此世界已結束或已放棄",
  INSUFFICIENT_GOLD: "資金不足",
  CARGO_FULL: "貨艙已滿",
  PORT_NOT_DOCKED: "艦隊未停靠此港口",
  AI_UNAVAILABLE: "智慧內容暫時無法使用",
  ROUTE_INVALID: "找不到通往目的港的航線",
  NO_ROUTE_SET: "尚未設定航線",
  FLEET_BUSY: "艦隊目前無法執行此操作",
  STOCK_INSUFFICIENT: "數量不足（市場庫存或貨艙存貨不夠）",
  COMMODITY_UNAVAILABLE: "此港口不販售此商品",
  OFFICER_UNAVAILABLE: "此航海士目前無法招募",
  CANNOT_SELL_LAST_SHIP: "無法賣出艦隊僅存的最後一艘船",
  CANNOT_SPLIT_ALL_SHIPS: "不能把艦隊裡所有的船都分出去，至少要留一艘",
  BATTLE_ACTION_INVALID: "無效的戰鬥行動",
  BATTLE_NOT_ACTIVE: "戰鬥已結束",
  NOT_NEAR_DISCOVERY_SITE: "附近沒有可探索的發現物",
  DISCOVERY_ALREADY_REGISTERED: "此發現物已登錄過",
  NO_GUILD_HALL: "此港口沒有學會分部",
  DIALOGUE_COOLDOWN: "對話太頻繁了，稍等一下再試",
};
