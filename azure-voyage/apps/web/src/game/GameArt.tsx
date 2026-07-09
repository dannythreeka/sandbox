"use client";

import { useState, type ReactNode } from "react";

/**
 * 資產管線的前端端點（docs/11 §3）：嘗試載入 `public/art/<category>/<id>.webp`，
 * 不存在或載入失敗時渲染 fallback（程式繪製版）。缺任何一張圖遊戲照常可玩——
 * 美術資產是漸進增強，不是硬相依。
 */

/** 已知缺檔快取：同一張缺圖只嘗試一次，重渲染不再打 404。 */
const missing = new Set<string>();

export interface GameArtProps {
  category: "port-scene" | "portrait" | "ship" | "key-visual" | "battle-bg" | "event" | "goods";
  id: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
}

export function GameArt({ category, id, alt, className, fallback }: GameArtProps) {
  const key = `${category}/${id}`;
  const [failed, setFailed] = useState(missing.has(key));

  if (failed) return <>{fallback}</>;
  return (
    // 一般 <img>（而非 next/image）：資產是可缺席的靜態檔案，需要 onError fallback
    // 語意，且不想為每張圖配置 next/image 的尺寸最佳化管線。
    <img
      src={`/art/${key}.webp`}
      alt={alt}
      className={className}
      onError={() => {
        missing.add(key);
        setFailed(true);
      }}
    />
  );
}
