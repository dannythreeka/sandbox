"use client";

import { io, type Socket } from "socket.io-client";
import { API_BASE } from "./api";
import { getAccessToken } from "./auth";

/** 建立 /game namespace 連線（handshake 帶 JWT，見 docs/04 §7）。 */
export function createGameSocket(): Socket {
  return io(`${API_BASE}/game`, {
    transports: ["websocket"],
    auth: { token: getAccessToken() },
  });
}
