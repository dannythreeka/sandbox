"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  axialToOddr,
  BALANCE,
  ERROR_MESSAGES_ZH_TW,
  firstNavigableHeading,
  HEXMAP,
  HOME_PORT_ID,
  openingNarrativeFor,
  portById,
  regionForCoord,
  seasonAtTick,
  weatherAtTick,
  windAtTick,
  WS_EVENTS,
  type Season,
  type BattleStateView,
  type FleetTickDelta,
  type OffsetCoord,
  type RouteView,
  type ServerArrivalPayload,
  type ServerBattleEndPayload,
  type ServerBattleStartPayload,
  type ServerBattleUpdatePayload,
  type ServerEventPayload,
  type ServerJoinedPayload,
  type ServerQuestChapterPayload,
  type ServerResyncPayload,
  type ServerTickPayload,
  type ServerVictoryPayload,
  type WorldSnapshot,
} from "@azure-voyage/shared";
import { api, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { createGameSocket } from "@/lib/socket";
import { SeaMap } from "@/game/SeaMap";
import { FleetOverviewPanel } from "@/game/FleetOverviewPanel";
import { FleetSwitcher } from "@/game/FleetSwitcher";
import { TradePanel } from "@/game/TradePanel";
import { PortNotablePanel } from "@/game/PortNotablePanel";
import { TradeRoutePanel } from "@/game/TradeRoutePanel";
import { TavernShipyardPanel } from "@/game/TavernShipyardPanel";
import { BattleScene } from "@/game/BattleScene";
import { ExplorationPanel } from "@/game/ExplorationPanel";
import { DiscoveryPanel } from "@/game/DiscoveryPanel";
import { DiscoveryCodexPanel } from "@/game/DiscoveryCodexPanel";
import { CaptainPanel } from "@/game/CaptainPanel";
import { InfluencePanel } from "@/game/InfluencePanel";
import { PortCutscene, type CutsceneState } from "@/game/PortCutscene";
import { QuestChapterCutscene } from "@/game/QuestChapterCutscene";
import { GameArt } from "@/game/GameArt";
import { PortBanner } from "@/game/PortBanner";

/** M13：使用者選過「不再顯示這個動畫」後永久跳過過場（不影響其他玩家/裝置） */
const CUTSCENE_SKIP_KEY = "azure-voyage:skip-cutscenes";
function cutscenesSkipped(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CUTSCENE_SKIP_KEY) === "1";
}
function skipCutscenesForever(): void {
  window.localStorage.setItem(CUTSCENE_SKIP_KEY, "1");
}

/** M26：世界開篇敘事只在剛開局的頭幾天顯示一次，關閉後記在這個世界自己的 key。 */
const OPENING_SEEN_PREFIX = "azure-voyage:opening-seen:";
function openingSeen(worldId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(OPENING_SEEN_PREFIX + worldId) === "1";
}
function markOpeningSeen(worldId: string): void {
  window.localStorage.setItem(OPENING_SEEN_PREFIX + worldId, "1");
}

type WsState = "connecting" | "joined" | "disconnected";

/** 航行速度檔位（毫秒／tick，docs/07 §3） */
const SPEED_PRESETS = [
  { label: "暫停", intervalMs: 0 },
  { label: "1x", intervalMs: 1500 },
  { label: "2x", intervalMs: 750 },
  { label: "4x", intervalMs: 300 },
] as const;

const SEASON_LABELS: Record<Season, string> = {
  SPRING: "春",
  SUMMER: "夏",
  AUTUMN: "秋",
  WINTER: "冬",
};
/** 風向名稱（0=東，逆時針；row 向下為南） */
const WIND_NAMES = ["東", "東北", "西北", "西", "西南", "東南"] as const;
/** 夾角檔位 0–3 的標籤與顏色（順風綠、逆風紅） */
const WIND_GAP_LABELS = [
  { text: "順風", cls: "text-emerald-300" },
  { text: "側順", cls: "text-emerald-200" },
  { text: "側風", cls: "text-slate-300" },
  { text: "逆風", cls: "text-red-400" },
] as const;
/** 勝利條件文案（M22 新增 RELIC_COLLECTOR） */
const VICTORY_REASON_LABELS: Record<ServerVictoryPayload["reason"], string> = {
  REGION_DOMINANCE: "海域霸權",
  ASSET_TARGET: "累積總資產",
  RELIC_COLLECTOR: "傳世遺物蒐集",
};
/** M14：天氣標籤與顏色 */
const WEATHER_LABELS: Record<string, { text: string; cls: string }> = {
  CLEAR: { text: "晴朗", cls: "text-slate-300" },
  BREEZE: { text: "微風", cls: "text-emerald-300" },
  FOG: { text: "起霧", cls: "text-slate-400" },
  STORM_BREWING: { text: "風暴醞釀", cls: "text-red-400" },
};

export default function PlayPage() {
  const params = useParams<{ worldId: string }>();
  const router = useRouter();
  const worldId = params.worldId;

  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  const [wsState, setWsState] = useState<WsState>("connecting");
  const [tick, setTick] = useState<number | null>(null);
  const [fleetDelta, setFleetDelta] = useState<FleetTickDelta | null>(null);
  const [route, setRoute] = useState<RouteView | null>(null);
  // M12：DOCKED/ANCHORED 時尚未送達伺服器 tick 前的本地「瞄準」航向
  // （伺服器回報的 fleetDelta.heading 一旦出現即為準；這裡只補伺服器尚未
  // 確認前的樂觀顯示，且入港時重置，避免殘留上一段航程的方向）
  const [pendingHeading, setPendingHeading] = useState<number | null>(null);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  /** 世界事件插圖（M17；docs/11 §2 H），只有 STORM/FESTIVAL/RUMOR 三種世界事件才有對應插圖 */
  const [noticeKind, setNoticeKind] = useState<"storm" | "festival" | "rumor" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [battleId, setBattleId] = useState<string | null>(null);
  const [battleState, setBattleState] = useState<BattleStateView | null>(null);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [victory, setVictory] = useState<ServerVictoryPayload | null>(null);
  const [cutscene, setCutscene] = useState<CutsceneState | null>(null);
  const [codexOpen, setCodexOpen] = useState(false);
  const [captainOpen, setCaptainOpen] = useState(false);
  const [questCutscene, setQuestCutscene] = useState<ServerQuestChapterPayload | null>(null);
  // M29：多艦隊管理——玩家目前選擇操作的艦隊；null 表示尚未選過，預設第一支
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  const [openingNarrative, setOpeningNarrative] = useState<string | null>(null);
  // M14：每次遞增觸發一次海圖的全屏閃光＋震動（風暴事件實際觸發時）
  const [stormFlashTrigger, setStormFlashTrigger] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const tickRef = useRef<number>(0);
  const inFlightRef = useRef(false);
  const lastSteerAtRef = useRef(0);
  // tick delta 依艦隊 id 過濾（不能拿 fleets[0]：清單只含「該 tick 有航行」的艦隊，
  // 順序與歸屬都不保證是玩家自己的）
  const playerFleetIdRef = useRef<string | null>(null);
  // M13：WS handler 註冊在只跑一次的 effect 裡，讀 state 會拿到掛載當下的
  // 舊值（stale closure）；用 ref 讓 server:arrival 算航程摘要時能拿到最新艦隊資料。
  const latestFleetRef = useRef<FleetTickDelta | null>(null);
  const tripStartRef = useRef<{ tick: number; food: number; water: number } | null>(null);
  const tripEventCountRef = useRef(0);
  // M30：跨艦隊事件通知要能查到「不是目前選中艦隊」的名字；同樣是 ref（見上方
  // stale-closure 說明），跟著 snapshot 更新。
  const fleetsRef = useRef<WorldSnapshot["fleets"]>([]);
  useEffect(() => {
    fleetsRef.current = snapshot?.fleets ?? [];
  }, [snapshot]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }

    api
      .getWorld(worldId)
      .then((snap) => {
        setSnapshot(snap);
        // M26：只在剛開局（頭兩天內）且這台裝置沒關過這個世界的開篇時顯示一次
        if (snap.world.currentTick <= 1 && !openingSeen(worldId)) {
          setOpeningNarrative(openingNarrativeFor(snap.world.seed));
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "載入世界失敗"));

    const socket = createGameSocket();
    socketRef.current = socket;

    socket.on("connect", () => socket.emit(WS_EVENTS.CLIENT_JOIN, { worldId }));
    socket.on(WS_EVENTS.SERVER_JOINED, (payload: ServerJoinedPayload) => {
      setWsState("joined");
      setTick(payload.tick);
      tickRef.current = payload.tick;
    });
    socket.on(WS_EVENTS.SERVER_RESYNC, (payload: ServerResyncPayload) => {
      setTick(payload.tick);
      tickRef.current = payload.tick;
      setSnapshot(payload.snapshot);
    });
    socket.on(WS_EVENTS.SERVER_TICK, (payload: ServerTickPayload) => {
      inFlightRef.current = false;
      setTick(payload.tick);
      tickRef.current = payload.tick;
      const mine = playerFleetIdRef.current
        ? payload.fleets.find((f) => f.id === playerFleetIdRef.current)
        : payload.fleets[0];
      if (mine) {
        setFleetDelta(mine);
        latestFleetRef.current = mine;
        if (mine.activity === "DOCKED" || mine.activity === "ANCHORED") setRoute(null);
      }
      if (payload.notices.length > 0) {
        setNotice(payload.notices.join(" "));
        setNoticeKind(null);
      }
      // tick 有成功推進，「世界正在推進中」這類瞬時壅塞錯誤即已過期，自動清掉
      setError((prev) => (prev === ERROR_MESSAGES_ZH_TW.WORLD_BUSY ? null : prev));
    });
    socket.on(WS_EVENTS.SERVER_ARRIVAL, (payload: ServerArrivalPayload) => {
      const isSelectedFleet = !playerFleetIdRef.current || payload.fleetId === playerFleetIdRef.current;
      if (!isSelectedFleet) {
        // M30：不是目前操作中的艦隊——不搶用選中艦隊的過場/航程摘要狀態，
        // 只用一則輕量通知提醒是「哪一支」艦隊抵達，畫面焦點不強制切換。
        const otherName = fleetsRef.current.find((f) => f.id === payload.fleetId)?.name ?? "另一支艦隊";
        setNotice(`「${otherName}」已抵達 ${portById(payload.portId).name}`);
        setNoticeKind(null);
        api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
        return;
      }
      // M13：入港過場的航程摘要——自出港以來累計，後端無感知
      const start = tripStartRef.current;
      const nowFood = latestFleetRef.current?.food ?? start?.food ?? 0;
      const nowWater = latestFleetRef.current?.water ?? start?.water ?? 0;
      const summary = {
        days: start ? payload.tick - start.tick : 0,
        food: start ? Math.max(0, start.food - nowFood) : 0,
        water: start ? Math.max(0, start.water - nowWater) : 0,
        events: tripEventCountRef.current,
      };
      tripStartRef.current = null;
      tripEventCountRef.current = 0;
      if (cutscenesSkipped()) {
        setNotice(`艦隊已抵達 ${portById(payload.portId).name}`);
        setNoticeKind(null);
      } else {
        setCutscene({ kind: "arrival", portId: payload.portId, day: payload.tick, summary });
      }
      api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
    });
    socket.on(WS_EVENTS.SERVER_EVENT, (payload: ServerEventPayload) => {
      const isSelectedFleet = !payload.fleetId || payload.fleetId === playerFleetIdRef.current;
      if (isSelectedFleet) {
        tripEventCountRef.current += 1;
        // M14：風暴事件實際觸發（與「風暴醞釀」天氣預兆不同）在海圖上閃光＋震動一次
        if (payload.event.type === "STORM") {
          setStormFlashTrigger((n) => n + 1);
        }
      }
      // M30：事件屬於「非選中」艦隊時，通知文字掛上該艦隊名字，不然玩家會誤以為
      // 是自己正在看的這支艦隊發生了事
      const otherName =
        payload.fleetId && !isSelectedFleet
          ? (fleetsRef.current.find((f) => f.id === payload.fleetId)?.name ?? "另一支艦隊")
          : null;
      setNotice(otherName ? `「${otherName}」：${payload.event.narrative}` : payload.event.narrative);
      setNoticeKind(
        payload.event.type === "STORM" || payload.event.type === "FESTIVAL" || payload.event.type === "RUMOR"
          ? (payload.event.type.toLowerCase() as "storm" | "festival" | "rumor")
          : null,
      );
      api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
    });
    socket.on(WS_EVENTS.SERVER_BATTLE_START, (payload: ServerBattleStartPayload) => {
      setBattleId(payload.battleId);
      setBattleState(payload.battle.state);
      setBattleLog([]);
    });
    socket.on(WS_EVENTS.BATTLE_UPDATE, (payload: ServerBattleUpdatePayload) => {
      setBattleState(payload.state);
      setBattleLog((prev) => [...prev, payload.log]);
    });
    socket.on(WS_EVENTS.BATTLE_END, (payload: ServerBattleEndPayload) => {
      if (payload.status === "PLAYER_LOSE") {
        // bug 修復：戰敗被拖回母港是刻意設計的懲罰，但過去只用一閃即逝的
        // notice 顯示，很容易被忽略／切分頁錯過，玩家常常搞不清楚為什麼
        // 「無緣無故」回到起始城市。改用跟入港一樣明確、不可略過的過場畫面。
        setCutscene({
          kind: "defeat",
          portId: HOME_PORT_ID,
          day: tickRef.current,
          ransom: payload.ransom,
        });
      } else {
        setNotice(payload.status === "PLAYER_WIN" ? "戰鬥勝利！" : "成功脫離戰場。");
        setNoticeKind(null);
      }
      setBattleId(null);
      setBattleState(null);
      api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
    });
    socket.on(WS_EVENTS.SERVER_VICTORY, (payload: ServerVictoryPayload) => {
      setVictory(payload);
    });
    socket.on(WS_EVENTS.SERVER_QUEST_CHAPTER, (payload: ServerQuestChapterPayload) => {
      setQuestCutscene(payload);
      api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
    });
    socket.on(WS_EVENTS.SERVER_ERROR, (err: { message: string }) => {
      inFlightRef.current = false;
      setError(err.message);
    });
    socket.on("disconnect", () => setWsState("disconnected"));
    socket.io.on("reconnect", () => {
      socket.emit(WS_EVENTS.CLIENT_RESYNC, { worldId, lastTick: tickRef.current });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [worldId, router]);

  const fleet = snapshot?.fleets.find((f) => f.id === selectedFleetId) ?? snapshot?.fleets[0];
  playerFleetIdRef.current = fleet?.id ?? playerFleetIdRef.current;

  // bug 修復：重新連線／重新整理時，若（目前選擇的）艦隊其實還卡在一場進行中的
  // 海戰裡（沒收到當初那次 SERVER_BATTLE_START 推播），主動把戰鬥畫面接回來，
  // 而不是讓玩家看到正常海圖卻永遠無法動彈。
  useEffect(() => {
    const activeBattleId = fleet?.activeBattleId;
    if (!activeBattleId || battleId) return;
    api
      .getBattle(worldId, activeBattleId)
      .then((battle) => {
        setBattleId(battle.id);
        setBattleState(battle.state);
      })
      .catch(() => undefined);
  }, [fleet?.activeBattleId, worldId, battleId]);

  /** M29：切換操作中的艦隊——清掉屬於「上一支艦隊」的暫存畫面狀態，避免混淆。 */
  function switchFleet(fleetId: string) {
    if (fleetId === selectedFleetId) return;
    setSelectedFleetId(fleetId);
    setFleetDelta(null);
    setRoute(null);
    setPendingHeading(null);
    setBattleId(null);
    setBattleState(null);
    setBattleLog([]);
    latestFleetRef.current = null;
    tripStartRef.current = null;
    tripEventCountRef.current = 0;
  }
  const activity = fleetDelta?.activity ?? fleet?.activity;
  const pos = fleetDelta?.pos ?? fleet?.pos;
  const food = fleetDelta?.food ?? fleet?.food ?? 0;
  const water = fleetDelta?.water ?? fleet?.water ?? 0;
  const morale = fleetDelta?.morale ?? fleet?.morale ?? 0;
  const dockedPortId = fleetDelta ? fleetDelta.dockedPortId : (fleet?.dockedPortId ?? null);
  const currentPort = snapshot?.knownPorts.find((p) => p.portId === dockedPortId);
  const visitedPortIds = useMemo(
    () => new Set(snapshot?.knownPorts.filter((p) => p.visited).map((p) => p.portId) ?? []),
    [snapshot],
  );
  // M30：海圖同時標出玩家其他艦隊（非目前選中）的位置，不用逐幀動畫，僅供概覽
  const otherFleetMarkers = useMemo(
    () =>
      (snapshot?.fleets ?? [])
        .filter((f) => f.id !== fleet?.id)
        .map((f) => ({ id: f.id, name: f.name, pos: axialToOddr(f.pos) })),
    [snapshot, fleet?.id],
  );
  // 伺服器存 axial 座標；SeaMap 畫布用 offset（col,row）座標系
  const fleetOffsetPos = pos ? axialToOddr(pos) : null;
  // ── M11 風向 HUD：航行中用伺服器 delta（含對航向的修正）；停靠/下錨時
  // 前端以同一套 shared 純函式自算當日風向（world seed 確定性，兩端必一致）──
  const currentTick = tick ?? snapshot?.world.currentTick ?? 0;
  const region = fleetOffsetPos ? regionForCoord(fleetOffsetPos) : null;
  const windDir =
    fleetDelta?.wind?.dir ??
    (region && snapshot ? windAtTick(region.id, currentTick, snapshot.world.seed) : null);
  const windGapIdx =
    activity === "SAILING" && fleetDelta?.wind
      ? ([...BALANCE.WIND_MODIFIERS] as number[]).indexOf(fleetDelta.wind.modifier)
      : -1;
  // M14：天氣同一套「航行中用伺服器 delta、停靠時前端自算」的模式
  const weather =
    fleetDelta?.weather ??
    (region && snapshot ? weatherAtTick(region.id, currentTick, snapshot.world.seed) : null);
  // M12：手動操舵航向——伺服器一旦回報（含 SAILING 中或 DOCKED/ANCHORED 已選定）即為準；
  // 否則落回本地尚待確認的樂觀值
  const displayedHeading = fleetDelta?.heading ?? pendingHeading ?? null;
  // 入港後重置本地瞄準值，避免殘留上一段航程的方向
  useEffect(() => {
    if (activity === "DOCKED") setPendingHeading(null);
  }, [activity]);
  // 重新整理頁面時若世界早已結束（例如先前已達成勝利），仍要顯示終局畫面
  const gameEnded = victory !== null || (snapshot ? snapshot.world.status !== "ACTIVE" : false);

  // ── 節奏器：SAILING 時依速度檔每隔 N ms 送出 client:advance ──
  // M13：過場動畫期間暫停（與「暫停」檔語意一致，無資料面副作用）。
  useEffect(() => {
    const intervalMs = SPEED_PRESETS[speedIdx].intervalMs;
    if (
      activity !== "SAILING" ||
      intervalMs === 0 ||
      battleId !== null ||
      victory !== null ||
      cutscene !== null
    ) {
      return;
    }
    const timer = setInterval(() => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      socketRef.current?.emit(WS_EVENTS.CLIENT_ADVANCE, { worldId, ticks: 1 });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [activity, speedIdx, worldId, battleId, victory, cutscene]);

  /**
   * 樂觀更新艦隊活動狀態。世界剛建立、尚未收到任何 server:tick 時 fleetDelta
   * 仍是 null，必須以目前快照補滿欄位，否則更新會整個變成 no-op，
   * 玩家會卡在「已出港」但畫面仍顯示停靠中、tick 節奏器也不會啟動。
   */
  function seedFleetActivity(
    nextActivity: FleetTickDelta["activity"],
    supplies?: { food: number; water: number },
  ) {
    if (!fleet) return;
    setFleetDelta((prev) => ({
      id: fleet.id,
      pos: prev?.pos ?? fleet.pos,
      food: prev?.food ?? fleet.food,
      water: prev?.water ?? fleet.water,
      morale: prev?.morale ?? fleet.morale,
      ...prev,
      activity: nextActivity,
      dockedPortId: null,
      ...(supplies ?? {}),
    }));
  }

  /** 點擊海圖設定航向（港口或任意海面）；海上下錨中伺服器會原子地收錨續航。 */
  async function handleMapTarget(dest: { targetPortId: string } | { target: OffsetCoord }) {
    if (!fleet || gameEnded || activity === "IN_BATTLE" || activity === "EXPLORING") return;
    setError(null);
    try {
      const r = await api.setRoute(worldId, fleet.id, dest);
      setRoute(r);
      setPendingHeading(null); // 互斥：改走自動尋路即清掉本地手動航向顯示
      if (activity === "ANCHORED") {
        seedFleetActivity("SAILING");
        setNotice(null);
        setNoticeKind(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "設定航線失敗");
    }
  }

  /**
   * M12：確保出港/收錨前已有航線或航向可用——若兩者皆無（玩家從未點過地圖
   * 也沒按過方向鍵），挑一個當前位置的預設可航行方位並等伺服器確認
   * （emitWithAck：後續動作依賴這個航向已寫入，不能用 fire-and-forget）。
   * 回傳 "already"＝沿用既有航線/航向；"set-now"＝剛用預設值收錨續航
   * （setHeading 在 ANCHORED 時會原子收錨，呼叫端不必再另外收錨）；
   * "failed"＝附近沒有可航行方位（理論上不會發生，港口必臨海）。
   */
  async function ensureCourseChosen(): Promise<"already" | "set-now" | "failed"> {
    if (!fleet) return "failed";
    if (route || (displayedHeading !== null && displayedHeading !== undefined)) return "already";
    const def = fleetOffsetPos ? firstNavigableHeading(HEXMAP, fleetOffsetPos) : null;
    if (def === null) {
      setError("附近沒有可航行的海域");
      return "failed";
    }
    await socketRef.current?.emitWithAck(WS_EVENTS.CLIENT_STEER, {
      worldId,
      fleetId: fleet.id,
      heading: def,
    });
    setPendingHeading(def);
    return "set-now";
  }

  async function handleDepart() {
    if (!fleet) return;
    setError(null);
    try {
      if ((await ensureCourseChosen()) === "failed") return;
      const departingPortId = currentPort?.portId;
      const r = await api.depart(worldId, fleet.id);
      const foodAfter = fleet.food + r.resupplied.food;
      const waterAfter = fleet.water + r.resupplied.water;
      // M13：出港過場的航程摘要起點——後端無感知，純前端累計
      tripStartRef.current = { tick: currentTick, food: foodAfter, water: waterAfter };
      tripEventCountRef.current = 0;
      seedFleetActivity("SAILING", { food: foodAfter, water: waterAfter });
      setNotice(
        r.resupplied.cost > 0
          ? `出港前完成補給：糧 +${r.resupplied.food}、水 +${r.resupplied.water}，花費 ${r.resupplied.cost} 金。`
          : null,
      );
      // 更新商會資金顯示
      api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
      if (departingPortId && !cutscenesSkipped()) {
        setCutscene({ kind: "depart", portId: departingPortId, day: currentTick });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "出港失敗");
    }
  }

  /** ↑/W（下錨中）：收錨續航，需要有航線或航向。 */
  async function handleResumeSailing() {
    if (!fleet) return;
    setError(null);
    try {
      const outcome = await ensureCourseChosen();
      if (outcome === "failed") return;
      // "set-now" 代表 ensureCourseChosen 內的 setHeading 已原子收錨；
      // "already" 代表航線/航向早已存在，這裡才需要另外送收錨請求。
      if (outcome === "already") await api.anchor(worldId, fleet.id);
      seedFleetActivity("SAILING");
      setNotice(null);
      setNoticeKind(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "操作失敗");
    }
  }

  /** ↑/W：依目前狀態出港或收錨續航；SAILING／其他狀態下無作用。 */
  function handleThrottleUp() {
    if (!fleet || gameEnded) return;
    if (activity === "DOCKED") void handleDepart();
    else if (activity === "ANCHORED") void handleResumeSailing();
  }

  /** 空白鍵：SAILING → 下錨；ANCHORED → 收錨續航（需航線/航向）。 */
  function handleAnchorKey() {
    if (!fleet || gameEnded) return;
    if (activity === "SAILING") {
      setError(null);
      api
        .anchor(worldId, fleet.id)
        .then(() => seedFleetActivity("ANCHORED"))
        .catch((err) => setError(err instanceof ApiError ? err.message : "操作失敗"));
    } else if (activity === "ANCHORED") {
      void handleResumeSailing();
    }
  }

  /** ←/→（或 A/D）：以 60° 為單位轉舵，切換／維持手動操舵模式（M12）。 */
  function rotateHeading(delta: 1 | -1) {
    if (!fleet || gameEnded || !fleetOffsetPos) return;
    if (activity === "IN_BATTLE" || activity === "EXPLORING") return;
    const now = Date.now();
    if (now - lastSteerAtRef.current < 150) return; // 前端節流：150ms 至多一發
    lastSteerAtRef.current = now;
    const base = displayedHeading ?? firstNavigableHeading(HEXMAP, fleetOffsetPos) ?? 0;
    const next = (((base + delta) % 6) + 6) % 6;
    setPendingHeading(next);
    setRoute(null); // 互斥：操舵即切手動模式，清掉航線預覽
    socketRef.current?.emit(WS_EVENTS.CLIENT_STEER, { worldId, fleetId: fleet.id, heading: next });
  }

  /** M13：過場結束（逾時／ESC／點擊跳過皆走這裡）。 */
  function handleCutsceneDone() {
    setCutscene(null);
  }
  /** M13：「不再顯示這個動畫」——存 localStorage 並立即跳過當次。 */
  function handleCutsceneSkipForever() {
    skipCutscenesForever();
    setCutscene(null);
  }

  // M12 鍵盤操舵：監聽器只掛載一次，透過 ref 讀最新的 handler 閉包，
  // 避免每次 render（尤其航行中每個 tick 都會 render）都重新綁定 window 監聽器。
  const keyHandlersRef = useRef({
    rotateHeading,
    handleThrottleUp,
    handleAnchorKey,
    cutsceneActive: cutscene !== null,
  });
  keyHandlersRef.current = {
    rotateHeading,
    handleThrottleUp,
    handleAnchorKey,
    cutsceneActive: cutscene !== null,
  };

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const h = keyHandlersRef.current;
      // M13：過場動畫中吃掉所有遊戲操作鍵，避免同時操舵；ESC 跳過由
      // PortCutscene 自己的監聽器處理（過場元件掛載時才存在，職責單純）。
      if (h.cutsceneActive) return;
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          h.rotateHeading(-1);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          h.rotateHeading(1);
          break;
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          h.handleThrottleUp();
          break;
        case " ":
          e.preventDefault();
          h.handleAnchorKey();
          break;
        case "1":
          setSpeedIdx(0);
          break;
        case "2":
          setSpeedIdx(1);
          break;
        case "3":
          setSpeedIdx(2);
          break;
        case "4":
          setSpeedIdx(3);
          break;
        default:
          return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /** 目的地顯示名稱：港口用中文名，自由航行顯示海域座標 */
  const destinationLabel = route
    ? route.targetPortId
      ? portById(route.targetPortId).name
      : `海域 (${route.waypoints[route.waypoints.length - 1].col}, ${route.waypoints[route.waypoints.length - 1].row})`
    : null;

  return (
    <main className="game-shell">
      <header className="game-topbar flex items-center justify-between gap-3">
        <Link href="/worlds" className="btn-ghost">
          ← 回航海誌
        </Link>
        <span
          className={
            wsState === "joined"
              ? "rounded-full bg-emerald-500/20 px-3 py-1 text-sm text-emerald-300"
              : "rounded-full bg-amber-500/20 px-3 py-1 text-sm text-amber-300"
          }
        >
          {wsState === "joined" ? "已連線" : wsState === "connecting" ? "連線中…" : "已斷線，重連中…"}
        </span>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {notice && (
        <p className="flex items-center gap-2 text-sm text-emerald-300">
          {noticeKind && (
            <GameArt
              category="event"
              id={noticeKind}
              alt=""
              className="h-8 w-8 shrink-0 rounded border border-gold/40 object-cover"
              fallback={<></>}
            />
          )}
          {notice}
        </p>
      )}

      {openingNarrative && (
        <section className="panel border border-gold/40 bg-gold/5">
          <p className="text-sm italic leading-relaxed text-slate-300">{openingNarrative}</p>
          <button
            className="btn-ghost mt-2"
            onClick={() => {
              markOpeningSeen(worldId);
              setOpeningNarrative(null);
            }}
          >
            啟航
          </button>
        </section>
      )}

      {gameEnded && (
        <section className="panel border-2 border-gold bg-gold/10 text-center">
          <h2 className="text-2xl font-bold text-gold">
            商會稱霸四海！
            {victory ? `第 ${victory.tick} 日達成勝利` : ""}
          </h2>
          {victory && (
            <p className="mt-1 text-sm text-slate-300">
              {VICTORY_REASON_LABELS[victory.reason]}達成勝利條件。
            </p>
          )}
          <Link href="/worlds" className="btn mt-3 inline-block">
            回航海誌
          </Link>
        </section>
      )}

      {snapshot && fleet && fleetOffsetPos ? (
        <>
          <section className="captain-hud flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative z-10">
              <p className="section-kicker">Captain's Log</p>
              <h1 className="text-2xl font-bold text-foam">{snapshot.world.name}</h1>
              <p className="mt-1 text-sm text-slate-400">
                第 <span className="font-mono text-gold">{tick ?? snapshot.world.currentTick}</span>{" "}
                日 ·{" "}
                <button
                  className="text-gold underline decoration-dotted underline-offset-2"
                  onClick={() => setCaptainOpen(true)}
                  title="查看提督狀態"
                >
                  {snapshot.playerGuild.captain.title}
                </button>{" "}
                {snapshot.playerGuild.name} · 資金{" "}
                <span className="font-mono text-gold">
                  {snapshot.playerGuild.gold.toLocaleString("zh-TW")}
                </span>
              </p>
            </div>
            <div className="relative z-10 flex flex-wrap items-center gap-2 text-sm text-slate-300">
              {region && windDir !== null && (
                <span className="stat-chip flex items-center gap-1.5">
                  <span className="text-foam" title={region.description}>{region.name}</span>
                  <span>{SEASON_LABELS[seasonAtTick(currentTick)]}季</span>
                  <span
                    className="inline-block font-bold text-gold"
                    style={{ transform: `rotate(${-60 * windDir}deg)` }}
                    title={`風向：${WIND_NAMES[windDir]}風`}
                  >
                    →
                  </span>
                  <span>{WIND_NAMES[windDir]}風</span>
                  {windGapIdx >= 0 && (
                    <span className={WIND_GAP_LABELS[windGapIdx].cls}>
                      {WIND_GAP_LABELS[windGapIdx].text}
                    </span>
                  )}
                  {weather && (
                    <span className={WEATHER_LABELS[weather].cls}>
                      · {WEATHER_LABELS[weather].text}
                    </span>
                  )}
                </span>
              )}
              <span className="stat-chip">糧<strong>{food}</strong></span>
              <span className="stat-chip">水<strong>{water}</strong></span>
              <span className="stat-chip">士氣<strong>{morale}</strong></span>
              <span className="stat-chip">
                霸權<strong>{snapshot.victoryProgress.regionsDominated}/{BALANCE.VICTORY_REGIONS_REQUIRED}</strong>
              </span>
              <span className="stat-chip">資產<strong>{snapshot.victoryProgress.totalAssets.toLocaleString("zh-TW")}</strong></span>
              <span className="stat-chip">
                遺物<strong>{snapshot.victoryProgress.relicsFound}/{BALANCE.VICTORY_RELICS_REQUIRED}</strong>
              </span>
              <button className="btn-ghost" onClick={() => setCodexOpen(true)}>
                圖鑑
              </button>
            </div>
          </section>

          <FleetSwitcher fleets={snapshot.fleets} selectedFleetId={fleet.id} onSelect={switchFleet} />

          <section className="panel py-2 text-sm text-slate-300">
            {snapshot.quest.completed ? (
              <span className="text-gold">主線．全部章節已完成——你的名字已寫進蒼瀾海域的史冊。</span>
            ) : (
              snapshot.quest.currentChapter && (
                <span>
                  <span className="text-gold">
                    主線．第 {snapshot.quest.chapterIndex + 1}/{snapshot.quest.totalChapters} 章：
                    {snapshot.quest.currentChapter.title}
                  </span>{" "}
                  — {snapshot.quest.currentChapter.objective}
                </span>
              )
            )}
          </section>

          {codexOpen && <DiscoveryCodexPanel worldId={worldId} onClose={() => setCodexOpen(false)} />}
          {captainOpen && (
            <CaptainPanel captain={snapshot.playerGuild.captain} onClose={() => setCaptainOpen(false)} />
          )}
          {questCutscene && (
            <QuestChapterCutscene payload={questCutscene} onDone={() => setQuestCutscene(null)} />
          )}

          <SeaMap
            fleetPos={fleetOffsetPos}
            sailing={activity === "SAILING"}
            routeWaypoints={route?.waypoints ?? null}
            visitedPortIds={visitedPortIds}
            otherFleets={otherFleetMarkers}
            previewHeading={
              (activity === "DOCKED" || activity === "ANCHORED" ? displayedHeading : null) as
                | 0
                | 1
                | 2
                | 3
                | 4
                | 5
                | null
            }
            onPortClick={(portId) => void handleMapTarget({ targetPortId: portId })}
            onSeaClick={(coord) => void handleMapTarget({ target: coord })}
            windDir={windDir as 0 | 1 | 2 | 3 | 4 | 5 | null}
            weather={weather}
            stormFlashTrigger={stormFlashTrigger}
          />

          {activity === "DOCKED" && currentPort && <PortBanner portId={currentPort.portId} />}

          <section className="panel command-deck flex flex-wrap items-center gap-4">
            {activity === "DOCKED" && currentPort && (
              <>
                <p className="text-slate-200">
                  停靠於 <span className="font-medium text-gold">{currentPort.name}</span>
                  ——點擊海圖上的港口或任一海面設定航線，或用 ←/→ 選定出港方向。
                </p>
                {route && destinationLabel ? (
                  <button className="btn" onClick={handleDepart}>
                    出港（前往 {destinationLabel}）
                  </button>
                ) : (
                  displayedHeading !== null &&
                  displayedHeading !== undefined && (
                    <button className="btn" onClick={handleDepart}>
                      出港（航向 {WIND_NAMES[displayedHeading]}）
                    </button>
                  )
                )}
              </>
            )}
            {activity === "SAILING" && (
              <div className="flex items-center gap-2">
                <span className="text-slate-300">航速：</span>
                {SPEED_PRESETS.map((s, i) => (
                  <button
                    key={s.label}
                    className={i === speedIdx ? "btn" : "btn-ghost"}
                    onClick={() => setSpeedIdx(i)}
                  >
                    {s.label}
                  </button>
                ))}
                {destinationLabel ? (
                  <span className="text-sm text-slate-400">航向 {destinationLabel}</span>
                ) : (
                  displayedHeading !== null &&
                  displayedHeading !== undefined && (
                    <span className="text-sm text-slate-400">
                      手動操舵 → {WIND_NAMES[displayedHeading]}（←/→ 轉舵）
                    </span>
                  )
                )}
              </div>
            )}
            {activity === "ANCHORED" && (
              <p className="text-slate-200">
                艦隊在海上<span className="font-medium text-gold">下錨中</span>
                ——點擊海面或港口設定新航向，或用 ←/→ 選方向後按 ↑ 收錨續航；也可探索周邊海域。
              </p>
            )}
            <ExplorationPanel
              worldId={worldId}
              fleetId={fleet.id}
              activity={activity ?? ""}
              onChanged={() => {
                api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
              }}
            />
            <span className="text-xs text-slate-500">
              鍵盤：←/→ 轉舵・↑ 出港/收錨・空白鍵 下錨・1–4 航速
            </span>
          </section>

          {activity === "DOCKED" && currentPort && (
            <div className="port-grid">
              <section className="panel xl:col-span-2">
                <PortNotablePanel worldId={worldId} portId={currentPort.portId} />
              </section>
              {fleet.ships[0] && (
                <section className="panel">
                  <FleetOverviewPanel fleet={fleet} />
                </section>
              )}
              <section className="panel">
                <TradeRoutePanel
                  worldId={worldId}
                  portId={currentPort.portId}
                  onSetRoute={(targetPortId) => handleMapTarget({ targetPortId })}
                />
              </section>
              {fleet.ships[0] && (
                <section className="panel xl:col-span-2">
                  <TradePanel
                    worldId={worldId}
                    portId={currentPort.portId}
                    fleetId={fleet.id}
                    shipId={fleet.ships[0].id}
                    onTraded={() => {
                      api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
                    }}
                  />
                </section>
              )}
              <section className="panel xl:col-span-2">
                <TavernShipyardPanel
                  worldId={worldId}
                  portId={currentPort.portId}
                  fleet={fleet}
                  onChanged={() => {
                    api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
                  }}
                />
              </section>
              <section className="panel">
                <DiscoveryPanel
                  worldId={worldId}
                  portId={currentPort.portId}
                  onChanged={() => {
                    api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
                  }}
                />
              </section>
              <section className="panel">
                <InfluencePanel
                  worldId={worldId}
                  portId={currentPort.portId}
                  gold={snapshot.playerGuild.gold}
                  npcGuilds={snapshot.npcGuilds}
                  onInvested={() => {
                    api.getWorld(worldId).then(setSnapshot).catch(() => undefined);
                  }}
                />
              </section>
            </div>
          )}
        </>
      ) : (
        !error && <p className="text-slate-400">載入世界中…</p>
      )}

      {battleId && battleState && socketRef.current && (
        <BattleScene
          socket={socketRef.current}
          battleId={battleId}
          state={battleState}
          log={battleLog}
          weather={weather}
          tick={tick ?? undefined}
        />
      )}

      {cutscene && (
        <PortCutscene
          state={cutscene}
          onDone={handleCutsceneDone}
          onSkipForever={handleCutsceneSkipForever}
        />
      )}
    </main>
  );
}
