"use client";

import type { CSSProperties } from "react";
import type { SceneTheme, SceneThemeElementTemplate, SceneThemeTemplate } from "@azure-voyage-rpg/engine";

export interface RenderableThemeElement extends SceneThemeElementTemplate {
  styleAt: (index: number) => CSSProperties;
}

export interface RenderableSceneThemeTemplate {
  rootClassName: string;
  elements: RenderableThemeElement[];
}

export const SCENE_THEME_BY_SCENE_ID: Record<string, SceneTheme> = {
  "scene.aurelia.harbor_office": "harbor-ledger-haze",
  "scene.aurelia.tavern": "tavern-hearth-smoke",
  "scene.aurelia.market": "market-bustle-sails",
  "scene.perlan.docks": "perlan-tide-mist",
};

const DEFAULT_SCENE_THEME_TEMPLATES: Record<SceneTheme, Required<SceneThemeTemplate>> = {
  "harbor-ledger-haze": {
    rootClassName: "theme-harbor-ledger-haze",
    elements: [
      {
        keyPrefix: "ledger",
        className: "theme-ledger",
        count: 5,
        left: { start: 14, step: 16, unit: "%" },
        delay: { step: -1.1, unit: "s" },
      },
      {
        keyPrefix: "dust",
        className: "theme-dust",
        count: 8,
        left: { start: 6, step: 11, unit: "%" },
        delay: { step: -0.6, unit: "s" },
      },
    ],
  },
  "tavern-hearth-smoke": {
    rootClassName: "theme-tavern-hearth-smoke",
    elements: [
      {
        keyPrefix: "ember",
        className: "theme-ember",
        count: 10,
        left: { start: 8, step: 8, unit: "%" },
        delay: { step: -0.4, unit: "s" },
      },
      {
        keyPrefix: "plume",
        className: "theme-smoke",
        count: 3,
        left: { start: 24, step: 22, unit: "%" },
        delay: { step: -1.2, unit: "s" },
      },
    ],
  },
  "market-bustle-sails": {
    rootClassName: "theme-market-bustle-sails",
    elements: [
      {
        keyPrefix: "banner",
        className: "theme-banner",
        count: 4,
        left: { start: 12, step: 20, unit: "%" },
        delay: { step: -1.5, unit: "s" },
      },
      {
        keyPrefix: "shadow",
        className: "theme-crowd-shadow",
        count: 5,
        left: { start: 10, step: 18, unit: "%" },
        delay: { step: -0.7, unit: "s" },
      },
    ],
  },
  "perlan-tide-mist": {
    rootClassName: "theme-perlan-tide-mist",
    elements: [
      {
        keyPrefix: "mist",
        className: "theme-mist-band",
        count: 4,
        top: { start: 34, step: 9, unit: "%" },
        delay: { step: -1.2, unit: "s" },
      },
      {
        keyPrefix: "beacon",
        className: "theme-beacon",
        count: 3,
        left: { start: 58, step: 11, unit: "%" },
        delay: { step: -0.9, unit: "s" },
      },
    ],
  },
};

function toCssValue(value: number, unit: string): string {
  return `${value}${unit}`;
}

function styleAt(element: SceneThemeElementTemplate, index: number): CSSProperties {
  const style: CSSProperties = {};
  if (element.left) {
    style.left = toCssValue(element.left.start + element.left.step * index, element.left.unit ?? "%");
  }
  if (element.top) {
    style.top = toCssValue(element.top.start + element.top.step * index, element.top.unit ?? "%");
  }
  if (element.delay) {
    style.animationDelay = toCssValue(
      (element.delay.start ?? 0) + element.delay.step * index,
      element.delay.unit ?? "s",
    );
  }
  return style;
}

export function resolveSceneThemeTemplate(
  theme: SceneTheme,
  override?: SceneThemeTemplate,
): RenderableSceneThemeTemplate {
  const fallback = DEFAULT_SCENE_THEME_TEMPLATES[theme];
  const rootClassName = override?.rootClassName ?? fallback.rootClassName;
  const sourceElements = override?.elements?.length ? override.elements : fallback.elements;
  return {
    rootClassName,
    elements: sourceElements.map((element) => ({
      ...element,
      styleAt: (index) => styleAt(element, index),
    })),
  };
}
