import type { SceneThemeTemplate } from '@azure-voyage-rpg/engine';

export type ThemePresetId =
  | 'aurelia-harbor-ledger-haze'
  | 'aurelia-tavern-hearth-smoke'
  | 'aurelia-market-bustle-sails'
  | 'perlan-tide-mist';

export const THEME_PRESETS: Record<ThemePresetId, SceneThemeTemplate> = {
  'aurelia-harbor-ledger-haze': {
    elements: [
      {
        keyPrefix: 'ledger',
        className: 'theme-ledger',
        count: 6,
        left: { start: 10, step: 14, unit: '%' },
        delay: { step: -0.95, unit: 's' },
      },
      {
        keyPrefix: 'dust',
        className: 'theme-dust',
        count: 10,
        left: { start: 4, step: 9, unit: '%' },
        delay: { step: -0.45, unit: 's' },
      },
    ],
  },
  'aurelia-tavern-hearth-smoke': {
    elements: [
      {
        keyPrefix: 'ember',
        className: 'theme-ember',
        count: 12,
        left: { start: 6, step: 7, unit: '%' },
        delay: { step: -0.35, unit: 's' },
      },
      {
        keyPrefix: 'plume',
        className: 'theme-smoke',
        count: 4,
        left: { start: 18, step: 20, unit: '%' },
        delay: { step: -0.9, unit: 's' },
      },
    ],
  },
  'aurelia-market-bustle-sails': {
    elements: [
      {
        keyPrefix: 'banner',
        className: 'theme-banner',
        count: 5,
        left: { start: 10, step: 17, unit: '%' },
        delay: { step: -1.15, unit: 's' },
      },
      {
        keyPrefix: 'shadow',
        className: 'theme-crowd-shadow',
        count: 6,
        left: { start: 8, step: 15, unit: '%' },
        delay: { step: -0.55, unit: 's' },
      },
    ],
  },
  'perlan-tide-mist': {
    elements: [
      {
        keyPrefix: 'mist',
        className: 'theme-mist-band',
        count: 5,
        top: { start: 30, step: 8, unit: '%' },
        delay: { step: -0.95, unit: 's' },
      },
      {
        keyPrefix: 'beacon',
        className: 'theme-beacon',
        count: 4,
        left: { start: 52, step: 10, unit: '%' },
        delay: { step: -0.75, unit: 's' },
      },
    ],
  },
};
