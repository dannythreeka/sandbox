"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type {
  GamePhase,
  Hotspot,
  PlayNode,
  Scene,
  SceneTheme,
  SceneThemeTemplate,
  Season,
} from "@azure-voyage-rpg/engine";
import { GameArt } from "@/game/GameArt";
import { SCENE_THEME_BY_SCENE_ID, resolveSceneThemeTemplate } from "@/game/sceneThemeTemplates";

interface SceneStageProps {
  scene: Scene;
  hotspots: Hotspot[];
  sceneOpen: boolean;
  activeNode: PlayNode | null;
  phase: GamePhase;
  season: Season;
  travelLabel?: string | null;
  travelKind?: "scene" | "area";
  onInteract: (hotspotId: string) => void;
  onWait: () => void;
}

export function SceneStage({
  scene,
  hotspots,
  sceneOpen,
  activeNode,
  phase,
  season,
  travelLabel,
  travelKind,
  onInteract,
  onWait,
}: SceneStageProps) {
  const visual = scene.visual;
  const palette = visual?.palette;
  const [entering, setEntering] = useState(true);
  const camera = useMemo(
    () => ({
      focusX: visual?.camera?.focusX ?? 50,
      focusY: visual?.camera?.focusY ?? 45,
      zoom: visual?.camera?.zoom ?? 1.08,
    }),
    [visual?.camera?.focusX, visual?.camera?.focusY, visual?.camera?.zoom],
  );
  const style = {
    "--scene-sky": palette?.sky ?? "#6f99c0",
    "--scene-horizon": palette?.horizon ?? "#f0c37f",
    "--scene-sea": palette?.sea ?? "#15324d",
    "--scene-accent": palette?.accent ?? "#f7ce75",
    "--scene-glow": palette?.glow ?? "#f6e4b0",
    "--camera-focus-x": `${camera.focusX}%`,
    "--camera-focus-y": `${camera.focusY}%`,
    "--camera-zoom": `${camera.zoom}`,
  } as CSSProperties;
  const phaseKey = phase.toLowerCase();
  const seasonKey = season.toLowerCase();
  const phaseBackdropById: Record<GamePhase, "calm" | "night" | "storm"> = {
    DAWN: "calm",
    DAY: "calm",
    DUSK: "storm",
    NIGHT: "night",
  };
  const phaseBackdropId = phaseBackdropById[phase];
  const showRain = visual?.ambience === "docks" || phase === "NIGHT";
  const showLanterns = phase === "DUSK" || phase === "NIGHT";
  const showGulls = phase === "DAWN" || phase === "DAY";
  const sceneTheme = visual?.theme ?? SCENE_THEME_BY_SCENE_ID[scene.id] ?? "harbor-ledger-haze";

  useEffect(() => {
    setEntering(true);
    const timer = window.setTimeout(() => setEntering(false), 900);
    return () => window.clearTimeout(timer);
  }, [scene.id]);

  return (
    <section className="scene-stage panel">
      <div
        className={`scene-stage-media ambience-${visual?.ambience ?? "harbor-office"} phase-${phaseKey} season-${seasonKey} ${entering ? `is-entering transition-${travelKind ?? "scene"}` : ""}`}
        style={style}
      >
        {visual?.backdrop ? (
          <GameArt
            category={visual.backdrop.category}
            id={visual.backdrop.id}
            alt={scene.name}
            className="scene-stage-backdrop"
            fallback={<SceneBackdropFallback sceneName={scene.name} />}
          />
        ) : (
          <SceneBackdropFallback sceneName={scene.name} />
        )}
        <div className="scene-stage-shade" />
        <GameArt
          category="battle-bg"
          id={phaseBackdropId}
          alt=""
          className="scene-stage-weather-backdrop"
          fallback={<div className="scene-stage-weather-fallback" aria-hidden="true" />}
        />
        {showRain && (
          <div className="scene-stage-rain" aria-hidden="true">
            {Array.from({ length: 22 }).map((_, index) => (
              <span key={index} style={{ left: `${(index * 9) % 100}%`, animationDelay: `${(index % 6) * -0.35}s` }} />
            ))}
          </div>
        )}
        {showLanterns && (
          <div className="scene-stage-lanterns" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <span key={index} style={{ left: `${8 + index * 16}%`, animationDelay: `${index * -0.8}s` }} />
            ))}
          </div>
        )}
        {showGulls && (
          <div className="scene-stage-gulls" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <span key={index} className={`gull-${index + 1}`} />
            ))}
          </div>
        )}
        <SceneThemePackage theme={sceneTheme} templateOverride={visual?.themeTemplate} />
        <div className="scene-stage-sheen" />
        <div className="scene-stage-orb orb-a" />
        <div className="scene-stage-orb orb-b" />
        <div className="scene-stage-wave wave-a" />
        <div className="scene-stage-wave wave-b" />
        {visual?.overlay && (
          <GameArt
            category={visual.overlay.category}
            id={visual.overlay.id}
            alt=""
            className={`scene-stage-overlay overlay-${visual.overlay.position ?? "right"} overlay-${visual.overlay.size ?? "md"}`}
            style={{ opacity: visual.overlay.opacity ?? 0.22 }}
            fallback={
              <div
                className="scene-stage-overlay-fallback"
                aria-hidden="true"
              />
            }
          />
        )}

        <header className="scene-stage-copy">
          <span className="scene-stage-kicker">Interactive Scene</span>
          <h2>{scene.name}</h2>
          {visual?.summary && <p>{visual.summary}</p>}
        </header>
        {travelLabel && (
          <div className={`scene-stage-travel-banner kind-${travelKind ?? "scene"}`}>
            <span>{travelKind === "area" ? "海域轉場" : "場景切換"}</span>
            <strong>{travelLabel}</strong>
          </div>
        )}

        {sceneOpen ? (
          <div className="scene-stage-hotspots">
            {hotspots.map((hotspot, index) => {
              const position = hotspot.position ?? {
                x: 24 + index * 26,
                y: 70 - (index % 2) * 18,
              };
              return (
                <button
                  key={hotspot.id}
                  className="scene-hotspot"
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  onClick={() => onInteract(hotspot.id)}
                  disabled={!!activeNode}
                  title={hotspot.label}
                  aria-label={`互動：${hotspot.label}`}
                >
                  <span className="scene-hotspot-ping" />
                  <span className="scene-hotspot-label">{hotspot.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="scene-stage-closed">
            <p>
              現在不是這裡開放的時段，先在附近等等，等港口氣氛轉到對的節奏。
            </p>
            <button className="btn" onClick={onWait}>
              等待一段時間
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function SceneBackdropFallback({ sceneName }: { sceneName: string }) {
  return (
    <div className="scene-stage-backdrop-fallback" aria-label={sceneName}>
      <div className="fallback-sky" />
      <div className="fallback-sun" />
      <div className="fallback-water" />
      <div className="fallback-city" />
    </div>
  );
}

function SceneThemePackage({
  theme,
  templateOverride,
}: {
  theme: SceneTheme;
  templateOverride?: SceneThemeTemplate;
}) {
  const template = resolveSceneThemeTemplate(theme, templateOverride);
  return (
    <div className={`scene-theme ${template.rootClassName}`} aria-hidden="true">
      {template.elements.map((spec) =>
        Array.from({ length: spec.count }).map((_, index) => (
          <span key={`${spec.keyPrefix}-${index}`} className={spec.className} style={spec.styleAt(index)} />
        )),
      )}
    </div>
  );
}
