"use client";

import { useState } from "react";
import type { DialogueTargetType } from "@azure-voyage/shared";
import { api, ApiError } from "@/lib/api";

interface Props {
  worldId: string;
  targetType: DialogueTargetType;
  targetId: string;
  targetName: string;
  onClose: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * 對話視窗（docs/06 §5 DIALOGUE；M20）。MVP 先做非串流：送出後一次性拿到完整回覆，
 * 不做逐字打字機效果。對話本身不影響遊戲狀態，僅可能觸發一則傳聞事件的提示。
 */
export function DialoguePanel({ worldId, targetType, targetId, targetName, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    try {
      const res = await api.dialogue(worldId, { targetType, targetId, message: text });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply },
        ...(res.rumorTriggered
          ? [{ role: "assistant" as const, content: "（似乎打聽到了一些消息……可以到酒館或學會留意看看）" }]
          : []),
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "對話失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="panel flex max-h-[80vh] w-full max-w-md flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foam">與 {targetName} 對話</h3>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="min-h-[6rem] flex-1 space-y-2 overflow-y-auto text-sm">
          {messages.length === 0 && <p className="text-slate-500">開口說點什麼吧……</p>}
          {messages.map((m, i) => (
            <p key={i} className={m.role === "user" ? "text-right text-gold" : "text-left text-slate-200"}>
              {m.content}
            </p>
          ))}
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <div className="mt-3 flex gap-2">
          <input
            className="input flex-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
            placeholder="輸入訊息…"
            maxLength={300}
            disabled={busy}
          />
          <button className="btn" onClick={() => void send()} disabled={busy || !input.trim()}>
            {busy ? "…" : "送出"}
          </button>
        </div>
      </div>
    </div>
  );
}
