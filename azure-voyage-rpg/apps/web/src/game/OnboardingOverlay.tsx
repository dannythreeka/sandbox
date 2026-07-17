'use client';

import { useEffect, useState } from 'react';

const ONBOARDING_KEY = 'azure-voyage-rpg.onboarding.v1';

const STEPS = [
  {
    icon: '🌊',
    title: '點擊熱點，觸發事件',
    body: '場景中發光的按鈕是「互動熱點」。點一下就會觸發身邊的故事——對話、選擇或意外。',
  },
  {
    icon: '⚓',
    title: '做出選擇，影響世界',
    body: '每次選擇都會改變你的能力、與角色的關係、甚至世界的走向。沒有絕對正確的答案。',
  },
  {
    icon: '📅',
    title: '等待與移動',
    body: '部分場景有時段限制。點「等待一段時間」可以推進時段；切換場景或港口可解鎖新事件。',
  },
  {
    icon: '📖',
    title: 'J 鍵開啟日誌',
    body: '按 J 快速切換任務日誌，隨時查看目前主線目標與指引提示。Enter 繼續對話、1-9 選選項。',
  },
] as const;

export function OnboardingOverlay() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const done = window.localStorage.getItem(ONBOARDING_KEY);
    if (!done) setVisible(true);
  }, []);

  function handleDismiss() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ONBOARDING_KEY, '1');
    }
    setVisible(false);
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleDismiss();
    }
  }

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="遊戲入門指引"
    >
      <div className="onboarding-card">
        <div className="onboarding-step-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`onboarding-dot ${i === step ? 'is-active' : ''}`}
            />
          ))}
        </div>

        <p className="onboarding-icon" aria-hidden="true">
          {current.icon}
        </p>
        <h2 className="onboarding-title">{current.title}</h2>
        <p className="onboarding-body">{current.body}</p>

        <div className="onboarding-actions">
          <button className="btn-ghost" onClick={handleDismiss}>
            跳過
          </button>
          <button className="btn" onClick={handleNext} autoFocus>
            {isLast ? '開始旅程' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
}
