'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SceneVisual } from '@azure-voyage-rpg/engine';

type Ambience = NonNullable<SceneVisual['ambience']>;

interface AudioDockProps {
  ambience?: Ambience;
  transitionKey?: string | null;
  choiceOpen: boolean;
}

interface LayerBundle {
  context: AudioContext;
  master: GainNode;
  bassGain: GainNode;
  midGain: GainNode;
  airGain: GainNode;
}

const AMBIENCE_PROFILE: Record<
  Ambience,
  { bass: number; mid: number; air: number }
> = {
  'harbor-office': { bass: 0.16, mid: 0.09, air: 0.04 },
  tavern: { bass: 0.22, mid: 0.12, air: 0.06 },
  market: { bass: 0.2, mid: 0.1, air: 0.05 },
  docks: { bass: 0.17, mid: 0.08, air: 0.03 },
};

function setupAudioGraph(): LayerBundle {
  const context = new window.AudioContext();
  const master = context.createGain();
  master.gain.value = 0.0001;
  master.connect(context.destination);

  const bass = context.createOscillator();
  bass.type = 'sine';
  bass.frequency.value = 54;
  const bassGain = context.createGain();
  bassGain.gain.value = 0;
  bass.connect(bassGain);
  bassGain.connect(master);

  const mid = context.createOscillator();
  mid.type = 'triangle';
  mid.frequency.value = 108;
  const midGain = context.createGain();
  midGain.gain.value = 0;
  mid.connect(midGain);
  midGain.connect(master);

  const air = context.createOscillator();
  air.type = 'sine';
  air.frequency.value = 320;
  const airGain = context.createGain();
  airGain.gain.value = 0;
  air.connect(airGain);
  airGain.connect(master);

  const lfo = context.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.14;
  const lfoGain = context.createGain();
  lfoGain.gain.value = 0.008;
  lfo.connect(lfoGain);
  lfoGain.connect(airGain.gain);

  bass.start();
  mid.start();
  air.start();
  lfo.start();

  return { context, master, bassGain, midGain, airGain };
}

export function AudioDock({
  ambience,
  transitionKey,
  choiceOpen,
}: AudioDockProps) {
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(65);
  const [supported, setSupported] = useState(true);
  const layerRef = useRef<LayerBundle | null>(null);
  const prevTransitionRef = useRef<string | null>(null);
  const prevChoiceOpenRef = useRef(false);

  const targetAmbience = useMemo<Ambience>(
    () => ambience ?? 'harbor-office',
    [ambience],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasAudioContext = typeof window.AudioContext !== 'undefined';
    setSupported(hasAudioContext);
  }, []);

  useEffect(() => {
    return () => {
      if (!layerRef.current) return;
      layerRef.current.context.close();
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !enabled) return;
    const now = layer.context.currentTime;
    const profile = AMBIENCE_PROFILE[targetAmbience];
    layer.bassGain.gain.setTargetAtTime(profile.bass, now, 0.45);
    layer.midGain.gain.setTargetAtTime(profile.mid, now, 0.45);
    layer.airGain.gain.setTargetAtTime(profile.air, now, 0.45);
  }, [enabled, targetAmbience]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const now = layer.context.currentTime;
    const target = muted || !enabled ? 0.0001 : volume / 100;
    layer.master.gain.setTargetAtTime(target, now, 0.1);
  }, [enabled, muted, volume]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !enabled || muted) return;
    if (!transitionKey || transitionKey === prevTransitionRef.current) return;
    prevTransitionRef.current = transitionKey;
    playPing(layer.context, layer.master, 660, 0.08);
    window.setTimeout(
      () => playPing(layer.context, layer.master, 440, 0.08),
      90,
    );
  }, [enabled, muted, transitionKey]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !enabled || muted) return;
    if (choiceOpen && !prevChoiceOpenRef.current) {
      playPing(layer.context, layer.master, 520, 0.07);
    }
    prevChoiceOpenRef.current = choiceOpen;
  }, [choiceOpen, enabled, muted]);

  function handleEnableAudio() {
    if (!supported) return;
    if (!layerRef.current) {
      layerRef.current = setupAudioGraph();
    }
    void layerRef.current.context.resume();
    setEnabled(true);
  }

  return (
    <section className="panel audio-dock">
      <div className="audio-dock-header">
        <h2 className="panel-title">音效與 BGM</h2>
        <span className={`audio-status ${enabled && !muted ? 'is-on' : ''}`}>
          {enabled ? (muted ? '已靜音' : '播放中') : '尚未啟用'}
        </span>
      </div>

      {!supported && (
        <p className="audio-note">此裝置不支援 Web Audio，音效系統無法啟用。</p>
      )}

      {supported && (
        <>
          {!enabled ? (
            <button className="btn" onClick={handleEnableAudio}>
              啟用音效
            </button>
          ) : (
            <div className="audio-controls">
              <button
                className={muted ? 'btn-ghost' : 'btn'}
                onClick={() => setMuted((v) => !v)}
              >
                {muted ? '取消靜音' : '靜音'}
              </button>
              <label className="audio-volume">
                <span>音量 {volume}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                />
              </label>
            </div>
          )}

          <p className="audio-note">目前場景音場：{targetAmbience}</p>
        </>
      )}
    </section>
  );
}

function playPing(
  context: AudioContext,
  master: GainNode,
  frequency: number,
  duration: number,
) {
  const osc = context.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(frequency, context.currentTime);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    context.currentTime + duration,
  );
  osc.connect(gain);
  gain.connect(master);
  osc.start();
  osc.stop(context.currentTime + duration + 0.02);
}
