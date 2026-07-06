"use client";

import type {
  BuildShipInput,
  RepairInput,
  SellShipInput,
  TavernOfficerView,
} from "@azure-voyage/shared";
import { API_BASE } from "./api";
import { getAccessToken } from "./auth";

async function req<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as { ok: boolean; data?: T; error?: { message: string } };
  if (!json.ok) throw new Error(json.error?.message ?? "操作失敗");
  return json.data as T;
}

export const officerApi = {
  getTavern: (worldId: string, portId: string) =>
    req<TavernOfficerView[]>(`/worlds/${worldId}/ports/${portId}/tavern`, "GET"),
  recruit: (worldId: string, portId: string, fleetId: string, officerId: string) =>
    req<{ recruited: boolean }>(`/worlds/${worldId}/ports/${portId}/tavern/recruit`, "POST", {
      fleetId,
      officerId,
    }),
  assignRole: (worldId: string, fleetId: string, officerId: string, role: string | null) =>
    req<{ role: string | null }>(
      `/worlds/${worldId}/fleets/${fleetId}/officers/${officerId}/assign`,
      "POST",
      { role },
    ),
  build: (worldId: string, portId: string, input: BuildShipInput) =>
    req<{ shipId: string; goldRemaining: number }>(
      `/worlds/${worldId}/ports/${portId}/shipyard/build`,
      "POST",
      input,
    ),
  repair: (worldId: string, portId: string, input: RepairInput) =>
    req<{ cost: number; goldRemaining: number }>(
      `/worlds/${worldId}/ports/${portId}/shipyard/repair`,
      "POST",
      input,
    ),
  sell: (worldId: string, portId: string, input: SellShipInput) =>
    req<{ refund: number; goldRemaining: number }>(
      `/worlds/${worldId}/ports/${portId}/shipyard/sell`,
      "POST",
      input,
    ),
};
