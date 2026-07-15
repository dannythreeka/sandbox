"use client";

import { useEffect, useState } from "react";
import { GameArt } from "@/game/GameArt";

interface BattleCinematicProps {
  phase: "engage" | "resolution";
  successHint?: boolean;
}

export function BattleCinematic({ phase, successHint }: BattleCinematicProps) {
  const [flashOn, setFlashOn] = useState(false);
  const backdropId = phase === "engage" ? "storm" : successHint ? "calm" : "night";

  useEffect(() => {
    setFlashOn(true);
    const timer = window.setTimeout(() => setFlashOn(false), 340);
    return () => window.clearTimeout(timer);
  }, [phase, successHint]);

  return (
    <section className={`battle-cinematic ${phase === "resolution" ? "is-resolution" : ""}`}>
      <GameArt
        category="battle-bg"
        id={backdropId}
        alt="海戰背景"
        className="battle-cinematic-backdrop"
        fallback={<div className="battle-cinematic-fallback" />}
      />
      <GameArt
        category="event"
        id="pirate"
        alt=""
        className="battle-cinematic-emblem"
        fallback={<div className="battle-emblem-fallback" />}
      />
      <div className={`battle-flash ${flashOn ? "is-on" : ""}`} />
      <div className="battle-waterline" />
      <div className="battle-smoke smoke-a" />
      <div className="battle-smoke smoke-b" />
      <div className="battle-ship fleet-player">
        <GameArt
          category="ship"
          id="sloop"
          alt="晨汐商會船隊"
          className="battle-ship-image"
          fallback={<div className="battle-ship-fallback" />}
        />
      </div>
      <div className="battle-ship fleet-enemy">
        <GameArt
          category="ship"
          id="brigantine"
          alt="緋帆團快船"
          className="battle-ship-image"
          fallback={<div className="battle-ship-fallback enemy" />}
        />
      </div>
      <div className={`battle-status ${successHint ? "is-success" : "is-risk"}`}>
        {phase === "engage" ? "交火中：海霧與砲聲壓近" : successHint ? "戰況回穩：敵艦退卻" : "強行脫離：艦體受損"}
      </div>
    </section>
  );
}
