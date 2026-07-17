'use client';

type TelemetryPrimitive = string | number | boolean | null;
type TelemetryPayload = Record<string, TelemetryPrimitive>;
type TelemetryLevel = 'info' | 'error';
export type TelemetryEventName =
  | 'session.start'
  | 'gameplay.interact.hit'
  | 'gameplay.interact.miss'
  | 'gameplay.continue'
  | 'gameplay.choice.select'
  | 'gameplay.wait.advance_time'
  | 'gameplay.travel.scene'
  | 'gameplay.travel.scene_failed'
  | 'gameplay.travel.area'
  | 'gameplay.travel.area_failed'
  | 'gameplay.new_game.confirmed'
  | 'gameplay.transition'
  | 'runtime.window.error'
  | 'runtime.window.unhandled_rejection';

interface TelemetryEvent {
  source: 'azure-voyage-rpg-web';
  level: TelemetryLevel;
  event: TelemetryEventName;
  timestamp: string;
  sessionId: string;
  pathname: string;
  payload: TelemetryPayload;
}

export const TELEMETRY_EVENT_SCHEMA: Record<
  TelemetryEventName,
  { level: TelemetryLevel; payloadKeys: string[]; description: string }
> = {
  'session.start': {
    level: 'info',
    payloadKeys: ['sceneId', 'day', 'phase', 'saveStatus'],
    description: 'Session bootstrap summary.',
  },
  'gameplay.interact.hit': {
    level: 'info',
    payloadKeys: ['hotspotId', 'sceneId', 'day', 'phase', 'nextNodeKind'],
    description: 'Interaction found an eligible event.',
  },
  'gameplay.interact.miss': {
    level: 'info',
    payloadKeys: ['hotspotId', 'sceneId', 'day', 'phase'],
    description: 'Interaction had no eligible event.',
  },
  'gameplay.continue': {
    level: 'info',
    payloadKeys: ['fromNodeKind', 'toNodeKind', 'sceneId', 'day'],
    description: 'Continue in dialogue/check flow.',
  },
  'gameplay.choice.select': {
    level: 'info',
    payloadKeys: ['choiceIndex', 'toNodeKind', 'sceneId', 'day'],
    description: 'Player selected a branching choice.',
  },
  'gameplay.wait.advance_time': {
    level: 'info',
    payloadKeys: ['fromDay', 'fromPhase', 'toDay', 'toPhase', 'sceneId'],
    description: 'Player advanced time manually.',
  },
  'gameplay.travel.scene': {
    level: 'info',
    payloadKeys: ['fromSceneId', 'toSceneId', 'day', 'phase'],
    description: 'Scene-to-scene travel success.',
  },
  'gameplay.travel.scene_failed': {
    level: 'error',
    payloadKeys: ['fromSceneId', 'toSceneId', 'errorName', 'errorMessage'],
    description: 'Scene travel failed.',
  },
  'gameplay.travel.area': {
    level: 'info',
    payloadKeys: ['fromAreaId', 'toAreaId', 'toSceneId', 'day', 'phase'],
    description: 'Area travel success.',
  },
  'gameplay.travel.area_failed': {
    level: 'error',
    payloadKeys: ['toAreaId', 'toSceneId', 'errorName', 'errorMessage'],
    description: 'Area travel failed.',
  },
  'gameplay.new_game.confirmed': {
    level: 'info',
    payloadKeys: ['previousPlaythrough', 'previousDay', 'previousSceneId'],
    description: 'Player confirmed reset/new game.',
  },
  'gameplay.transition': {
    level: 'info',
    payloadKeys: ['kind', 'label', 'fromSceneId', 'toSceneId', 'day', 'phase'],
    description: 'Visual transition between scene/area.',
  },
  'runtime.window.error': {
    level: 'error',
    payloadKeys: ['filename', 'line', 'column', 'errorName', 'errorMessage'],
    description: 'Window error event captured globally.',
  },
  'runtime.window.unhandled_rejection': {
    level: 'error',
    payloadKeys: ['errorName', 'errorMessage'],
    description: 'Unhandled promise rejection captured globally.',
  },
};

const OBS_ENABLED = process.env.NEXT_PUBLIC_OBSERVABILITY_ENABLED === '1';
const OBS_ENDPOINT = process.env.NEXT_PUBLIC_OBSERVABILITY_ENDPOINT ?? '';
const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function normalizeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return {
    name: 'UnknownError',
    message: typeof error === 'string' ? error : 'unknown error',
  };
}

function enqueue(event: TelemetryEvent) {
  if (!OBS_ENABLED) return;
  if (!OBS_ENDPOINT) {
    console.info('[obs:event]', event);
    return;
  }

  const body = JSON.stringify(event);
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.sendBeacon === 'function'
  ) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(OBS_ENDPOINT, blob);
    return;
  }

  fetch(OBS_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch((error: unknown) => {
    const normalized = normalizeError(error);
    console.warn('[obs:send_failed]', normalized.message);
  });
}

function send(
  level: TelemetryLevel,
  event: TelemetryEventName,
  payload: TelemetryPayload = {},
) {
  enqueue({
    source: 'azure-voyage-rpg-web',
    level,
    event,
    timestamp: new Date().toISOString(),
    sessionId,
    pathname: typeof window === 'undefined' ? '/' : window.location.pathname,
    payload,
  });
}

export function trackEvent(
  event: TelemetryEventName,
  payload: TelemetryPayload = {},
) {
  send('info', event, payload);
}

export function reportError(
  event: TelemetryEventName,
  error: unknown,
  payload: TelemetryPayload = {},
) {
  const normalized = normalizeError(error);
  send('error', event, {
    ...payload,
    errorName: normalized.name,
    errorMessage: normalized.message,
  });
}
