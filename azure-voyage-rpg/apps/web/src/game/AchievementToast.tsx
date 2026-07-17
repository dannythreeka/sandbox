'use client';

import { useEffect, useState } from 'react';

interface ToastEntry {
  id: number;
  message: string;
}

interface AchievementToastProps {
  achievements: string[];
  onClear: (message: string) => void;
}

export function AchievementToast({ achievements, onClear }: AchievementToastProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => {
    if (achievements.length === 0) return;
    const last = achievements[achievements.length - 1];
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message: last }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      onClear(last);
    }, 3200);
    return () => clearTimeout(timer);
  }, [achievements]);

  if (toasts.length === 0) return null;

  return (
    <div className="achievement-toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="achievement-toast">
          {toast.message}
        </div>
      ))}
    </div>
  );
}
