/**
 * P1.6 SLO/Alert 門檻設定（azure-voyage-rpg-web）
 *
 * 此模組宣告三條 SLO 及對應 alert 設定，可直接匯入至監控工具 SDK，
 * 或作為設定 Datadog/Grafana/BigQuery Scheduled Alerts 的規格來源。
 *
 * 設計原則
 * ─────────
 * - 所有門檻皆保守（soft beta 標準），上線穩定後再收緊。
 * - 計量視窗採 5 分鐘（短線告警）+ 1 小時（趨勢確認）兩層。
 * - severity: P1 = 立即通知、P2 = 下個工作日處理。
 */

export type SloSeverity = 'P1' | 'P2';

export interface SloDefinition {
  /** SLO 識別 ID */
  id: string;
  /** 人類可讀名稱 */
  name: string;
  /** 計量視窗（分鐘） */
  windowMinutes: number;
  /** 觸發 alert 的門檻（依 metric 不同，意義各異） */
  threshold: number;
  /** 門檻單位說明 */
  unit: string;
  /** 嚴重程度 */
  severity: SloSeverity;
  /** 觸發條件說明（人類可讀） */
  condition: string;
  /** 計算所需事件集合 */
  numeratorEvents: string[];
  denominatorEvents?: string[];
  /** 短版 runbook 提示（下一步查什麼） */
  runbookHint: string;
  /** 是否暫時停用（新版本初期觀察用） */
  disabled?: boolean;
}

/**
 * SLO 一覽。
 *
 * SLO-1  整體 error rate          — error 事件佔所有事件的比率
 * SLO-2  travel fail rate         — travel 失敗佔所有 travel 的比率
 * SLO-3  runtime exception burst  — 任何 5 分鐘視窗的 runtime 例外事件數
 */
export const SLO_DEFINITIONS = [
  {
    id: 'slo.error_rate',
    name: '整體 error rate',
    windowMinutes: 5,
    threshold: 0.03,
    unit: 'ratio (error / all events)',
    severity: 'P1',
    condition: 'error events / all events > 3 % in rolling 5 min window',
    numeratorEvents: ['*'],
    denominatorEvents: ['*'],
    runbookHint:
      '1. 查 runtime.window.error payload 的 filename/line 定位來源\n' +
      '2. 查 gameplay.travel.*_failed 的 toSceneId 確認是否特定場景卡點\n' +
      '3. 若是 save/load 問題，看 session.start.saveStatus 是否出現 corrupted_reset',
  },
  {
    id: 'slo.error_rate_hourly',
    name: '整體 error rate（1 小時確認）',
    windowMinutes: 60,
    threshold: 0.02,
    unit: 'ratio (error / all events)',
    severity: 'P2',
    condition: 'error events / all events > 2 % in rolling 1 hour window',
    numeratorEvents: ['*'],
    denominatorEvents: ['*'],
    runbookHint:
      '趨勢超標但 5 分鐘不觸發 P1，代表緩發型問題（如特定場景高機率失敗）。\n' +
      '查 BigQuery 每日錯誤率趨勢，確認上線後哪天開始升高。',
  },
  {
    id: 'slo.travel_fail_rate',
    name: 'travel fail rate',
    windowMinutes: 5,
    threshold: 0.05,
    unit: 'ratio (travel_failed / all_travel)',
    severity: 'P1',
    condition:
      '(gameplay.travel.scene_failed + gameplay.travel.area_failed) ' +
      '/ (gameplay.travel.scene + gameplay.travel.area + failed) > 5 % in rolling 5 min',
    numeratorEvents: [
      'gameplay.travel.scene_failed',
      'gameplay.travel.area_failed',
    ],
    denominatorEvents: [
      'gameplay.travel.scene',
      'gameplay.travel.area',
      'gameplay.travel.scene_failed',
      'gameplay.travel.area_failed',
    ],
    runbookHint:
      '1. 依 toSceneId Top 排行找出問題場景\n' +
      '2. 確認 content package 的 unlockCondition / timeGate 是否過嚴\n' +
      '3. 若是 engine.travelTo 拋出未預期錯誤，檢查 engine version 是否有 hotfix',
  },
  {
    id: 'slo.runtime_exception_burst',
    name: 'runtime exception burst',
    windowMinutes: 5,
    threshold: 10,
    unit: 'count (runtime errors in window)',
    severity: 'P1',
    condition:
      '(runtime.window.error + runtime.window.unhandled_rejection) > 10 in rolling 5 min',
    numeratorEvents: [
      'runtime.window.error',
      'runtime.window.unhandled_rejection',
    ],
    runbookHint:
      '1. 查 payload.errorName 確認是不是同一個錯誤爆發\n' +
      '2. 查 payload.filename 定位前端 chunk\n' +
      '3. 若集中在 session.start 之後立刻爆發，可能是 save migration 或 content load 失敗',
  },
  {
    id: 'slo.interact_hit_ratio',
    name: 'interact 命中率下限',
    windowMinutes: 60,
    threshold: 0.3,
    unit: 'ratio (hit / hit+miss)',
    severity: 'P2',
    condition:
      'gameplay.interact.hit / (hit + miss) < 30 % in rolling 1 hour — ' +
      '玩家大量觸發「沒有事件」代表內容空窗，不是 bug 但影響留存',
    numeratorEvents: ['gameplay.interact.hit'],
    denominatorEvents: ['gameplay.interact.hit', 'gameplay.interact.miss'],
    runbookHint:
      '1. 確認哪個 sceneId + hotspotId 組合 miss 最多\n' +
      '2. 增加 P0/P1 repeatable events 填補空窗\n' +
      '3. 確認事件 precondition 是否設太嚴',
    disabled: false,
  },
] satisfies SloDefinition[];

export type SloId =
  | 'slo.error_rate'
  | 'slo.error_rate_hourly'
  | 'slo.travel_fail_rate'
  | 'slo.runtime_exception_burst'
  | 'slo.interact_hit_ratio';

/** 取得單一 SLO（typesafe） */
export function getSlo(id: SloId): SloDefinition {
  return SLO_DEFINITIONS.find((s) => s.id === id) as SloDefinition;
}

/** 只列出啟用中（未 disabled）的 SLO */
export function getActiveSlos(): SloDefinition[] {
  return SLO_DEFINITIONS.filter((s) => !s.disabled);
}
