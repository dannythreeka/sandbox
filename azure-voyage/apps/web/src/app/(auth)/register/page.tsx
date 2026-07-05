"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RegisterInputSchema } from "@azure-voyage/shared";
import { api, ApiError } from "@/lib/api";
import { saveTokens } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = { email, password, displayName };
    const check = RegisterInputSchema.safeParse(input);
    if (!check.success) {
      setError("請確認：密碼至少 8 碼、名稱 1–30 字、電子郵件格式正確");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.register(check.data);
      saveTokens(result.tokens);
      router.push("/worlds");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "連線失敗，請稍後再試");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto mt-16 max-w-md">
      <h1 className="mb-6 text-center text-3xl font-bold text-foam">建立帳號</h1>
      <form className="panel space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="label" htmlFor="displayName">
            提督名號
          </label>
          <input
            id="displayName"
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={30}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="email">
            電子郵件
          </label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            密碼（至少 8 碼）
          </label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn w-full" disabled={busy}>
          {busy ? "建立中…" : "啟航"}
        </button>
        <p className="text-center text-sm text-slate-400">
          已有帳號？{" "}
          <Link href="/login" className="text-gold hover:underline">
            登入
          </Link>
        </p>
      </form>
    </main>
  );
}
