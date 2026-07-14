"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ArtCategory } from "@azure-voyage-rpg/engine";

const missing = new Set<string>();

interface GameArtProps {
  category: ArtCategory;
  id: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  fallback: ReactNode;
}

export function GameArt({ category, id, alt, className, style, fallback }: GameArtProps) {
  const key = `${category}/${id}`;
  const [failed, setFailed] = useState(missing.has(key));
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      missing.add(key);
      setFailed(true);
    }
  }, [key]);

  if (failed) return <>{fallback}</>;

  return (
    <img
      ref={imgRef}
      src={`/art/${key}.webp`}
      alt={alt}
      className={className}
      style={style}
      onError={() => {
        missing.add(key);
        setFailed(true);
      }}
    />
  );
}
