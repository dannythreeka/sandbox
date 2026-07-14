"use client";

import dynamic from "next/dynamic";

// GameClient 讀寫 localStorage 存檔，開局狀態依裝置而異——用 ssr:false 避免
// 伺服器端渲染出的初始 HTML 跟客戶端 hydrate 後的存檔內容對不上。
const GameClient = dynamic(() => import("@/game/GameClient").then((m) => m.GameClient), { ssr: false });

export default function Page() {
  return <GameClient />;
}
