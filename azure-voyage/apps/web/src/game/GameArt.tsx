"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
  const imgRef = useRef<HTMLImageElement>(null);

  // 靜態預渲染頁（如登入/註冊）在瀏覽器解析 HTML 當下就會開始載入 <img>，
  // 缺圖 404 常常在 React hydrate、掛上 onError 監聽器之前就已經觸發完畢，
  // 導致原生 error 事件被錯過。掛載後主動檢查 img.complete + naturalWidth
  // 補上這個 race condition 的判斷，而不是只依賴 onError。
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      missing.add(key);
      setFailed(true);
    }
  }, [key]);

  if (failed) return <>{fallback}</>;
  return (
    // 一般 <img>（而非 next/image）：資產是可缺席的靜態檔案，需要 onError fallback
    // 語意，且不想為每張圖配置 next/image 的尺寸最佳化管線。
    <img
      ref={imgRef}
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
