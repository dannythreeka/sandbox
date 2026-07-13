"use client";

import {
  ERROR_MESSAGES_ZH_TW,
  type ApiResponse,
  type AuthResult,
  type AuthTokens,
  type CreateWorldInput,
  type DialogueRequest,
  type DialogueResponse,
  type DiscoveryCodexEntry,
  type DiscoveryRecordView,
  type ErrorCode,
  type ExploreResult,
  type InvestResult,
  type LoginInput,
  type OffsetCoord,
  type PortDetail,
  type RegisterDiscoveryResult,
  type RegisterInput,
  type RouteView,
  type TradeInput,
  type TradeResult,
  type TradeRouteSuggestion,
  type WorldSnapshot,
  type WorldSummary,
} from "@azure-voyage/shared";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./auth";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? ERROR_MESSAGES_ZH_TW[code] ?? code);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean; retryOn401?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true, retryOn401 = true } = options;
  const headers: Record<string, string> = {};
  // 只在真的有 body 時帶 Content-Type：Fastify 會拒絕「聲稱 JSON 卻無 body」的請求
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const parsed = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (parsed?.ok) {
    return parsed.data;
  }

  const code: ErrorCode = parsed && !parsed.ok ? parsed.error.code : "INTERNAL";

  // access token 過期 → 用 refresh token 換一次後重試
  if (response.status === 401 && auth && retryOn401 && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, { ...options, retryOn401: false });
    }
    clearTokens();
  }

  throw new ApiError(
    code,
    parsed && !parsed.ok ? parsed.error.message : undefined,
    parsed && !parsed.ok ? parsed.error.details : undefined,
  );
}

async function tryRefresh(): Promise<boolean> {
  try {
    const tokens = await request<AuthTokens>("/auth/refresh", {
      method: "POST",
      body: { refreshToken: getRefreshToken() },
      auth: false,
      retryOn401: false,
    });
    saveTokens(tokens);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  register: (input: RegisterInput) =>
    request<AuthResult>("/auth/register", { method: "POST", body: input, auth: false }),
  login: (input: LoginInput) =>
    request<AuthResult>("/auth/login", { method: "POST", body: input, auth: false }),
  listWorlds: () => request<WorldSummary[]>("/worlds"),
  createWorld: (input: CreateWorldInput) =>
    request<WorldSummary>("/worlds", { method: "POST", body: input }),
  getWorld: (id: string) => request<WorldSnapshot>(`/worlds/${id}`),
  abandonWorld: (id: string) => request<WorldSummary>(`/worlds/${id}`, { method: "DELETE" }),
  setRoute: (
    worldId: string,
    fleetId: string,
    dest: { targetPortId: string } | { target: OffsetCoord },
  ) =>
    request<RouteView>(`/worlds/${worldId}/fleets/${fleetId}/route`, {
      method: "POST",
      body: dest,
    }),
  depart: (worldId: string, fleetId: string) =>
    request<{
      departed: boolean;
      resupplied: { food: number; water: number; cost: number };
    }>(`/worlds/${worldId}/fleets/${fleetId}/depart`, {
      method: "POST",
    }),
  getPort: (worldId: string, portId: string) =>
    request<PortDetail>(`/worlds/${worldId}/ports/${portId}`),
  getTradeRoutes: (worldId: string, portId: string) =>
    request<TradeRouteSuggestion[]>(`/worlds/${worldId}/ports/${portId}/trade-routes`),
  trade: (worldId: string, portId: string, input: TradeInput) =>
    request<TradeResult>(`/worlds/${worldId}/ports/${portId}/trade`, {
      method: "POST",
      body: input,
    }),
  anchor: (worldId: string, fleetId: string) =>
    request<{ activity: string }>(`/worlds/${worldId}/fleets/${fleetId}/anchor`, {
      method: "POST",
    }),
  explore: (worldId: string, fleetId: string) =>
    request<ExploreResult>(`/worlds/${worldId}/fleets/${fleetId}/explore`, { method: "POST" }),
  listDiscoveries: (worldId: string) =>
    request<DiscoveryRecordView[]>(`/worlds/${worldId}/discoveries`),
  discoveryCodex: (worldId: string) =>
    request<DiscoveryCodexEntry[]>(`/worlds/${worldId}/discoveries/codex`),
  registerDiscovery: (worldId: string, portId: string, discoveryRecordId: string) =>
    request<RegisterDiscoveryResult>(
      `/worlds/${worldId}/ports/${portId}/guild-hall/register-discovery`,
      { method: "POST", body: { discoveryRecordId } },
    ),
  invest: (worldId: string, portId: string, amount: number) =>
    request<InvestResult>(`/worlds/${worldId}/ports/${portId}/invest`, {
      method: "POST",
      body: { amount },
    }),
  dialogue: (worldId: string, input: DialogueRequest) =>
    request<DialogueResponse>(`/worlds/${worldId}/dialogue`, {
      method: "POST",
      body: input,
    }),
};
